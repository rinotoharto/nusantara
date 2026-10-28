import type { Dunia } from '../world';
import { UKURAN_MEDAN, PERMUKAAN_AIR, Z_SUNGAI, LEBAR_SUNGAI, X_MUARA } from '../world/terrain';
import { PEMANDU } from '../world/guide-config';
import { UI } from './config';

const K = PEMANDU.peta;
// Warna gaya lontar: dasar kecokelatan, lebih gelap di tempat tinggi, sungai biru pudar, hutan hijau pudar.
const WARNA_RENDAH = [230, 214, 178];
const WARNA_TINGGI = [150, 112, 66];
const WARNA_AIR = [112, 142, 156];
const WARNA_HUTAN = 'rgba(70, 96, 50, 0.75)';
const WARNA_RUMAH = 'rgba(70, 44, 24, 0.9)';

/**
 * Peta orientasi (tombol M): tampilan atas seluruh medan digambar sekali ke kanvas 2D dari fungsi
 * tinggi, lalu tiap frame ditimpa posisi dan arah pemain, penanda tujuan, dan sel yang sudah dilalui.
 * Tanpa penjaga, semak, atau tujuan pilihan: untuk orientasi, bukan untuk menyelinap.
 */
export class Peta {
  private readonly lapis: HTMLDivElement;
  private readonly kanvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private dasar: HTMLCanvasElement | null = null;
  private readonly dikunjungi = new Set<number>();
  private waktu = 0;
  private tampil = false;
  saatTutup: (() => void) | null = null;
  /** Berapa kali peta dibuka (untuk catatan playtest). */
  jumlahDibuka = 0;

  constructor(private readonly dunia: Dunia) {
    this.lapis = document.createElement('div');
    this.lapis.className = 'peta-lapis';
    const kotak = document.createElement('div');
    kotak.className = 'peta';
    const kepala = document.createElement('div');
    kepala.className = 'peta-kepala';
    const judul = document.createElement('span');
    judul.className = 'peta-judul';
    judul.textContent = UI.peta.judul;
    const tutup = document.createElement('button');
    tutup.className = 'peta-tutup';
    tutup.textContent = UI.peta.tutup;
    tutup.tabIndex = -1;
    tutup.addEventListener('click', () => this.saatTutup?.());
    kepala.append(judul, tutup);
    const ukuran = UKURAN_MEDAN * K.pikselPerMeter;
    this.kanvas = document.createElement('canvas');
    this.kanvas.width = ukuran;
    this.kanvas.height = ukuran;
    this.kanvas.className = 'peta-kanvas';
    this.ctx = this.kanvas.getContext('2d') as CanvasRenderingContext2D;
    const keterangan = document.createElement('div');
    keterangan.className = 'peta-keterangan';
    keterangan.textContent = `${UI.peta.keterangan} ${UI.peta.petunjuk}.`;
    kotak.append(kepala, this.kanvas, keterangan);
    this.lapis.append(kotak);
    this.lapis.addEventListener('click', (e) => {
      if (e.target === this.lapis) this.saatTutup?.();
    });
    document.body.append(this.lapis);
  }

  get aktif(): boolean {
    return this.tampil;
  }

  buka(): void {
    if (!this.dasar) this.dasar = this.gambarDasar();
    this.tampil = true;
    this.jumlahDibuka += 1;
    this.lapis.classList.add('tampil');
  }

  tutup(): void {
    this.tampil = false;
    this.lapis.classList.remove('tampil');
  }

  /** Mencatat sel yang dilalui pemain; dipanggil tiap frame permainan. */
  catatKunjungan(x: number, z: number): void {
    const n = Math.ceil(UKURAN_MEDAN / K.ukuranSel);
    const ix = Math.floor((x + UKURAN_MEDAN / 2) / K.ukuranSel);
    const iz = Math.floor((z + UKURAN_MEDAN / 2) / K.ukuranSel);
    this.dikunjungi.add(iz * n + ix);
  }

  /** Mengosongkan jejak (misi dimulai ulang). */
  reset(): void {
    this.dikunjungi.clear();
  }

  /** Menggambar lapisan dinamis di atas peta dasar; dipanggil tiap frame selama peta terbuka. */
  perbarui(dt: number, pemain: { x: number; z: number }, hadap: number, penanda: [number, number][]): void {
    if (!this.tampil || !this.dasar) return;
    this.waktu += dt;
    const s = K.pikselPerMeter;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.kanvas.width, this.kanvas.height);
    ctx.drawImage(this.dasar, 0, 0);

    // Sel yang sudah dilalui: sedikit lebih terang.
    const n = Math.ceil(UKURAN_MEDAN / K.ukuranSel);
    const sel = K.ukuranSel * s;
    ctx.fillStyle = 'rgba(255, 250, 230, 0.32)';
    for (const kunci of this.dikunjungi) {
      const ix = kunci % n;
      const iz = Math.floor(kunci / n);
      ctx.fillRect(ix * sel, iz * sel, sel, sel);
    }

    // Penanda tujuan: lingkaran berpendar yang berdenyut.
    for (const [x, z] of penanda) {
      const px = (x + UKURAN_MEDAN / 2) * s;
      const pz = (z + UKURAN_MEDAN / 2) * s;
      const r = 7 * s + Math.sin(this.waktu * 3) * 1.5 * s;
      const g = ctx.createRadialGradient(px, pz, 0, px, pz, r);
      g.addColorStop(0, 'rgba(255, 200, 90, 0.9)');
      g.addColorStop(0.5, 'rgba(255, 160, 50, 0.35)');
      g.addColorStop(1, 'rgba(255, 140, 40, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, pz, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(120, 60, 10, 0.8)';
      ctx.lineWidth = s;
      ctx.beginPath();
      ctx.arc(px, pz, 2.2 * s, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Pemain: segitiga kecil menghadap arah `hadap` (0 = selatan = ke bawah peta).
    const px = (pemain.x + UKURAN_MEDAN / 2) * s;
    const pz = (pemain.z + UKURAN_MEDAN / 2) * s;
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(-hadap);
    const u = 3.2 * s;
    ctx.beginPath();
    ctx.moveTo(0, u * 1.4);
    ctx.lineTo(-u, -u);
    ctx.lineTo(0, -u * 0.4);
    ctx.lineTo(u, -u);
    ctx.closePath();
    ctx.fillStyle = '#c8402c';
    ctx.strokeStyle = '#2b1d12';
    ctx.lineWidth = s;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  /** Peta dasar dari fungsi tinggi: warna menurut tinggi dengan bayangan lereng, air, hutan, rumah. */
  private gambarDasar(): HTMLCanvasElement {
    const s = K.pikselPerMeter;
    const ukuran = UKURAN_MEDAN * s;
    const kanvas = document.createElement('canvas');
    kanvas.width = ukuran;
    kanvas.height = ukuran;
    const ctx = kanvas.getContext('2d') as CanvasRenderingContext2D;
    const n = ukuran + 1;
    const tinggi = new Float32Array(n * n);
    let yMin = Infinity;
    let yMaks = -Infinity;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const y = this.dunia.tinggiMedan(i / s - UKURAN_MEDAN / 2, j / s - UKURAN_MEDAN / 2);
        tinggi[j * n + i] = y;
        if (y < yMin) yMin = y;
        if (y > yMaks) yMaks = y;
      }
    }
    const gambar = ctx.createImageData(ukuran, ukuran);
    const d = gambar.data;
    const rentang = Math.max(1, yMaks - Math.max(yMin, PERMUKAAN_AIR));
    for (let j = 0; j < ukuran; j++) {
      for (let i = 0; i < ukuran; i++) {
        const y = tinggi[j * n + i];
        const k = (j * ukuran + i) * 4;
        let r: number;
        let g: number;
        let b: number;
        const x = i / s - UKURAN_MEDAN / 2;
        const z = j / s - UKURAN_MEDAN / 2;
        // Air hanya di jalur sungai dan teluk muara (sesuai bidang air di river.ts), bukan tiap cekungan rendah.
        const diJalurAir = Math.abs(z - Z_SUNGAI) < LEBAR_SUNGAI / 2 + 3 || (x < X_MUARA + 10 && Math.abs(z - Z_SUNGAI) < 23);
        if (diJalurAir && y < PERMUKAAN_AIR + 0.15) {
          [r, g, b] = WARNA_AIR;
        } else {
          const t = Math.min(1, Math.max(0, (y - PERMUKAAN_AIR) / rentang));
          const tt = Math.pow(t, 0.7);
          r = WARNA_RENDAH[0] + (WARNA_TINGGI[0] - WARNA_RENDAH[0]) * tt;
          g = WARNA_RENDAH[1] + (WARNA_TINGGI[1] - WARNA_RENDAH[1]) * tt;
          b = WARNA_RENDAH[2] + (WARNA_TINGGI[2] - WARNA_RENDAH[2]) * tt;
          // Bayangan lereng: cahaya dari barat laut (kiri atas peta).
          const dx = tinggi[j * n + i + 1] - y;
          const dz = tinggi[(j + 1) * n + i] - y;
          const terang = 1 + Math.max(-0.35, Math.min(0.35, (-dx - dz) * 0.9 * s));
          r *= terang;
          g *= terang;
          b *= terang;
        }
        // Garis-garis halus lontar.
        const serat = j % 7 === 0 ? 0.96 : 1;
        d[k] = Math.min(255, r * serat);
        d[k + 1] = Math.min(255, g * serat);
        d[k + 2] = Math.min(255, b * serat);
        d[k + 3] = 255;
      }
    }
    ctx.putImageData(gambar, 0, 0);

    // Hutan: titik hijau pudar per pohon; rumah: kotak kecil.
    ctx.fillStyle = WARNA_HUTAN;
    for (const p of this.dunia.pohon) {
      ctx.beginPath();
      ctx.arc((p.x + UKURAN_MEDAN / 2) * s, (p.z + UKURAN_MEDAN / 2) * s, 1.6 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = WARNA_RUMAH;
    for (const r of this.dunia.rumah) {
      const k = r.kotak;
      ctx.fillRect((k.min.x + UKURAN_MEDAN / 2) * s, (k.min.z + UKURAN_MEDAN / 2) * s, (k.max.x - k.min.x) * s, (k.max.z - k.min.z) * s);
    }
    return kanvas;
  }
}
