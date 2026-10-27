import * as THREE from 'three';
import type { Input } from '../character/input';
import {
  JARI_PEMAIN,
  PERINTAH_BEBAS,
  arahInputRelatifKamera,
  type Pemain,
  type PerintahGerak,
} from '../character/player';
import { KONFIG } from './config';

const K = KONFIG.pemain;

/** Status aksi pemain. Hanya satu aksi berjalan pada satu waktu. */
export type StatusAksi =
  | 'bebas'
  | 'mengisi' // klik kiri ditahan, belum jelas ringan atau berat
  | 'serangRingan'
  | 'serangBerat'
  | 'tangkis'
  | 'hindar'
  | 'terpukul';

/** Satu serangan yang siap diuji kena; dikeluarkan sekali per ayunan. */
export interface Serangan {
  damage: number;
  jangkauan: number;
  sudutKena: number;
  dorong: number;
  berat: boolean;
}

export type KeadaanTangkis = 'tidak' | 'pas' | 'biasa';

const WARNA_BADAN = new THREE.Color(0xc8402c);
const WARNA_TANGKIS = new THREE.Color(0x4aa3ff);
const WARNA_BERAT = new THREE.Color(0xffa030);
const WARNA_KENA = new THREE.Color(0xffffff);
const WARNA_TERTANGKIS = new THREE.Color(0x9ad0ff);

function halus(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Pertarungan pemain: serangan ringan (kombo 3), serangan berat (tahan klik kiri),
 * tangkis (klik kanan), dan hindar (Ctrl atau klik tengah). Menghasilkan perintah gerak
 * untuk `Pemain` dan menggerakkan kapsul serta keris karena belum ada animasi.
 */
export class PertarunganPemain {
  status: StatusAksi = 'bebas';
  /** Detik sejak masuk status sekarang. */
  private waktu = 0;
  /** Pukulan ke berapa dalam kombo (0 sampai maksKombo - 1). */
  private kombo = 0;
  private sejakSeranganTerakhir = 99;
  private komboHabis = false;
  private seranganTertunda = false;
  private seranganSudahKeluar = false;
  private seranganSiap: Serangan | null = null;
  private hadapAksi = 0;
  private readonly arahHindar = new THREE.Vector3();
  private readonly dorongan = new THREE.Vector3();
  private readonly doronganLuar = new THREE.Vector3();
  private sisaDoronganLuar = 0;
  private readonly perintah: PerintahGerak = { ...PERINTAH_BEBAS };

  private readonly keris = new THREE.Group();
  private readonly bahan: THREE.MeshStandardMaterial;
  private sisaKilat = 0;
  private readonly warnaKilat = new THREE.Color();

  constructor(private pemain: Pemain) {
    this.bahan = pemain.kapsul.material;

    // Keris: balok tipis di sisi kanan kapsul. Pivot di hulu, bilah menjulur ke +z.
    const bilah = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.05, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x55585e, metalness: 0.6, roughness: 0.35 }),
    );
    bilah.position.z = 0.3;
    bilah.castShadow = true;
    const hulu = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x8a5a2a, roughness: 0.8 }),
    );
    this.keris.add(bilah, hulu);
    this.keris.position.set(JARI_PEMAIN + 0.08, 1.0, 0.05);
    this.keris.rotation.set(0.5, 0, 0);
    pemain.pose.add(this.keris);
  }

  /** Benar saat pemain tidak bisa dilukai (awal hindar). */
  get kebal(): boolean {
    return this.status === 'hindar' && this.waktu < K.hindar.kebal;
  }

  /** Keadaan tangkis saat ini: 'pas' pada jendela awal, 'biasa' sesudahnya. */
  keadaanTangkis(): KeadaanTangkis {
    if (this.status !== 'tangkis') return 'tidak';
    return this.waktu < K.tangkis.jendelaPas ? 'pas' : 'biasa';
  }

  /** Serangan yang baru saja mengayun pada frame ini, sekali per ayunan. */
  ambilSerangan(): Serangan | null {
    const s = this.seranganSiap;
    this.seranganSiap = null;
    return s;
  }

  /**
   * Pemain terkena serangan dari arah `dari`. Tahap A: hanya kilatan dan dorongan;
   * nyawa menyusul di tahap C. `ditangkis` benar kalau serangan tertahan tangkisan biasa.
   */
  terkena(dari: THREE.Vector3, dorong: number, ditangkis: boolean): void {
    const pos = this.pemain.posisi;
    const dx = pos.x - dari.x;
    const dz = pos.z - dari.z;
    const d = Math.hypot(dx, dz) || 1;
    this.doronganLuar.set((dx / d) * dorong, 0, (dz / d) * dorong);
    this.sisaDoronganLuar = 0.15;
    this.sisaKilat = K.terpukul.kilatan;
    this.warnaKilat.copy(ditangkis ? WARNA_TERTANGKIS : WARNA_KENA);
    if (!ditangkis) this.masuk('terpukul');
  }

  private masuk(status: StatusAksi): void {
    this.status = status;
    this.waktu = 0;
    this.seranganSudahKeluar = false;
  }

  private mulaiSerangan(berat: boolean, input: Input, yawKamera: number): void {
    const arah = arahInputRelatifKamera(input, yawKamera);
    this.hadapAksi = arah.ada ? Math.atan2(arah.x, arah.z) : this.pemain.hadap;
    this.seranganTertunda = false;
    this.masuk(berat ? 'serangBerat' : 'serangRingan');
  }

  private mulaiHindar(input: Input, yawKamera: number): void {
    const arah = arahInputRelatifKamera(input, yawKamera);
    if (arah.ada) {
      this.arahHindar.set(arah.x, 0, arah.z);
    } else {
      // Diam: melompat mundur, tetap menghadap depan.
      this.arahHindar.set(-Math.sin(this.pemain.hadap), 0, -Math.cos(this.pemain.hadap));
    }
    this.hadapAksi = this.pemain.hadap;
    this.masuk('hindar');
  }

  /** Dipanggil tiap frame sebelum `pemain.perbarui`. Mengembalikan perintah gerak untuk frame ini. */
  perbarui(dt: number, input: Input, yawKamera: number): Readonly<PerintahGerak> {
    this.waktu += dt;
    this.sejakSeranganTerakhir += dt;
    if (this.sejakSeranganTerakhir > K.seranganRingan.jedaKombo) {
      this.kombo = 0;
      this.komboHabis = false;
    }

    const mintaHindar = input.baruDitekan('ControlLeft') || input.baruDitekan('ControlRight') || input.baruDitekan('Mouse1');
    const mintaSerang = input.baruDitekan('Mouse0');
    const tahanTangkis = input.ditekan('Mouse2');
    const bisaSerangLagi = !this.komboHabis || this.sejakSeranganTerakhir > K.seranganRingan.pemulihanSetelahKombo;

    switch (this.status) {
      case 'bebas':
        if (mintaHindar && this.pemain.diTanah) this.mulaiHindar(input, yawKamera);
        else if (tahanTangkis && this.pemain.diTanah) this.masuk('tangkis');
        else if (mintaSerang && bisaSerangLagi && this.pemain.diTanah) this.masuk('mengisi');
        break;

      case 'mengisi':
        if (mintaHindar) this.mulaiHindar(input, yawKamera);
        else if (tahanTangkis) this.masuk('tangkis');
        else if (input.baruDilepas('Mouse0')) this.mulaiSerangan(false, input, yawKamera);
        else if (this.waktu >= K.seranganBerat.tahan) this.mulaiSerangan(true, input, yawKamera);
        break;

      case 'serangRingan': {
        const r = K.seranganRingan;
        if (mintaSerang) this.seranganTertunda = true;
        this.keluarkanSerangan(r.jendelaKena, false);
        const lewatJendela = this.waktu >= r.jendelaKena[1];
        if (mintaHindar && lewatJendela) {
          this.selesaiSerangan();
          this.mulaiHindar(input, yawKamera);
        } else if (this.waktu >= r.durasi) {
          this.selesaiSerangan();
          if (this.seranganTertunda && !this.komboHabis) {
            this.kombo += 1;
            this.mulaiSerangan(false, input, yawKamera);
          }
        }
        break;
      }

      case 'serangBerat': {
        const b = K.seranganBerat;
        this.keluarkanSerangan(b.jendelaKena, true);
        if (mintaHindar && this.waktu >= b.jendelaKena[1]) {
          this.selesaiSerangan();
          this.mulaiHindar(input, yawKamera);
        } else if (this.waktu >= b.durasi) {
          this.selesaiSerangan();
        }
        break;
      }

      case 'tangkis':
        if (mintaHindar) this.mulaiHindar(input, yawKamera);
        else if (!tahanTangkis) this.masuk('bebas');
        break;

      case 'hindar':
        if (this.waktu >= K.hindar.durasi) this.masuk('bebas');
        break;

      case 'terpukul':
        if (this.waktu >= K.terpukul.durasi) this.masuk('bebas');
        break;
    }

    this.susunPerintah();
    this.perbaruiVisual(dt);
    return this.perintah;
  }

  /** Mengeluarkan serangan sekali saat ayunan memasuki jendela kena. */
  private keluarkanSerangan(jendela: number[], berat: boolean): void {
    if (this.seranganSudahKeluar || this.waktu < jendela[0]) return;
    this.seranganSudahKeluar = true;
    this.seranganSiap = {
      damage: berat ? K.keris.damageBerat : K.keris.damageRingan,
      jangkauan: K.keris.jangkauan,
      sudutKena: K.keris.sudutKena,
      dorong: berat ? K.keris.dorongBerat : K.keris.dorongRingan,
      berat,
    };
  }

  private selesaiSerangan(): void {
    this.sejakSeranganTerakhir = 0;
    if (this.status === 'serangBerat' || this.kombo >= K.seranganRingan.maksKombo - 1) {
      this.komboHabis = true;
      this.kombo = 0;
    }
    this.masuk('bebas');
  }

  private susunPerintah(): void {
    const p = this.perintah;
    p.kunciGerak = false;
    p.pengaliKecepatan = 1;
    p.dorongan = null;
    p.hadapPaksa = null;
    p.bolehLompat = true;
    const hadapX = Math.sin(this.hadapAksi);
    const hadapZ = Math.cos(this.hadapAksi);

    switch (this.status) {
      case 'mengisi':
        p.pengaliKecepatan = 0.6;
        p.bolehLompat = false;
        break;
      case 'serangRingan': {
        const r = K.seranganRingan;
        p.kunciGerak = true;
        p.bolehLompat = false;
        p.hadapPaksa = this.hadapAksi;
        // Melangkah maju kecil di awal pukulan.
        const lamaMaju = r.jendelaKena[0];
        if (this.waktu < lamaMaju) {
          const laju = r.majuPerPukulan / lamaMaju;
          p.dorongan = this.dorongan.set(hadapX * laju, 0, hadapZ * laju);
        }
        break;
      }
      case 'serangBerat': {
        const b = K.seranganBerat;
        p.kunciGerak = true;
        p.bolehLompat = false;
        p.hadapPaksa = this.hadapAksi;
        const mulai = b.jendelaKena[0] - 0.1;
        const selesai = b.jendelaKena[0] + 0.05;
        if (this.waktu >= mulai && this.waktu < selesai) {
          const laju = b.maju / (selesai - mulai);
          p.dorongan = this.dorongan.set(hadapX * laju, 0, hadapZ * laju);
        } else {
          p.dorongan = this.dorongan.set(0, 0, 0);
        }
        break;
      }
      case 'tangkis':
        p.pengaliKecepatan = K.tangkis.pengaliKecepatan;
        p.bolehLompat = false;
        p.hadapPaksa = this.pemain.hadap;
        break;
      case 'hindar': {
        const h = K.hindar;
        p.kunciGerak = true;
        p.bolehLompat = false;
        p.hadapPaksa = this.hadapAksi;
        // Cepat di awal, melambat di akhir; luas di bawah kurva = jarak hindar.
        const t = Math.min(1, this.waktu / h.durasi);
        const laju = (2 * h.jarak / h.durasi) * (1 - t);
        p.dorongan = this.dorongan.copy(this.arahHindar).multiplyScalar(laju);
        break;
      }
      case 'terpukul':
        p.kunciGerak = true;
        p.bolehLompat = false;
        break;
    }

    // Dorongan dari luar (terkena serangan) menimpa gerak sendiri sebentar.
    if (this.sisaDoronganLuar > 0) {
      p.dorongan = this.dorongan.copy(this.doronganLuar).multiplyScalar(1 / 0.15);
    }
  }

  private perbaruiVisual(dt: number): void {
    const pose = this.pemain.pose;
    const keris = this.keris;
    let condong = 0;
    let miringSamping = 0;
    let turun = 0;
    let skalaY = 1;
    let kerisX = 0.5;
    let kerisY = 0;
    let kerisMaju = 0.05;
    const warna = WARNA_BADAN;
    let sinar = 0;
    const sinarWarna = new THREE.Color(0, 0, 0);
    let langsung = false;

    switch (this.status) {
      case 'mengisi': {
        const t = halus(this.waktu / K.seranganBerat.tahan);
        condong = -0.12 * t;
        kerisX = lerp(0.5, -1.6, t); // keris diangkat ke atas
        sinar = 0.6 * t;
        sinarWarna.copy(WARNA_BERAT);
        break;
      }
      case 'serangRingan': {
        const r = K.seranganRingan;
        const t = this.waktu / r.durasi;
        condong = Math.sin(Math.PI * Math.min(1, t)) * 0.35;
        const ayun = halus((this.waktu - 0.02) / (r.jendelaKena[1] + 0.06));
        if (this.kombo === 0) kerisY = lerp(1.1, -1.0, ayun);
        else if (this.kombo === 1) kerisY = lerp(-1.1, 1.0, ayun);
        else { kerisY = 0; kerisX = 0.1; kerisMaju = lerp(0.05, 0.55, Math.sin(Math.PI * ayun)); }
        langsung = true;
        break;
      }
      case 'serangBerat': {
        const b = K.seranganBerat;
        const tAngkat = halus(this.waktu / (b.jendelaKena[0] - 0.08));
        const tTebas = halus((this.waktu - (b.jendelaKena[0] - 0.08)) / 0.14);
        const tPulih = halus((this.waktu - b.jendelaKena[1]) / (b.durasi - b.jendelaKena[1]));
        condong = lerp(lerp(-0.15, 0.55, tTebas), 0, tPulih);
        kerisX = lerp(lerp(lerp(0.5, -1.7, tAngkat), 1.1, tTebas), 0.5, tPulih);
        sinar = (1 - tTebas) * 0.6;
        sinarWarna.copy(WARNA_BERAT);
        langsung = true;
        break;
      }
      case 'tangkis': {
        condong = -0.12;
        kerisX = -0.6;
        kerisY = -0.9;
        const pas = this.keadaanTangkis() === 'pas';
        sinar = pas ? 1.4 : 0.6;
        sinarWarna.copy(WARNA_TANGKIS);
        break;
      }
      case 'hindar': {
        const t = this.waktu / K.hindar.durasi;
        const lengkung = Math.sin(Math.PI * Math.min(1, t));
        turun = -0.35 * lengkung;
        skalaY = 1 - 0.25 * lengkung;
        // Condong ke arah luncuran relatif terhadap hadap.
        const maju = this.arahHindar.x * Math.sin(this.hadapAksi) + this.arahHindar.z * Math.cos(this.hadapAksi);
        const samping = this.arahHindar.x * Math.cos(this.hadapAksi) - this.arahHindar.z * Math.sin(this.hadapAksi);
        condong = 0.45 * maju * lengkung;
        miringSamping = -0.45 * samping * lengkung;
        langsung = true;
        break;
      }
      case 'terpukul':
        condong = -0.25 * (1 - this.waktu / K.terpukul.durasi);
        break;
    }

    const laju = langsung ? 1 : Math.min(1, 14 * dt);
    pose.rotation.x += (condong - pose.rotation.x) * laju;
    pose.rotation.z += (miringSamping - pose.rotation.z) * laju;
    pose.position.y += (turun - pose.position.y) * laju;
    pose.scale.y += (skalaY - pose.scale.y) * laju;
    keris.rotation.x += (kerisX - keris.rotation.x) * laju;
    keris.rotation.y += (kerisY - keris.rotation.y) * laju;
    keris.position.z += (kerisMaju - keris.position.z) * laju;

    // Warna: kilatan terkena menimpa sinar aksi.
    this.bahan.color.copy(warna);
    if (this.sisaKilat > 0) {
      this.sisaKilat -= dt;
      this.bahan.emissive.copy(this.warnaKilat);
      this.bahan.emissiveIntensity = 1.5;
    } else {
      this.bahan.emissive.copy(sinarWarna);
      this.bahan.emissiveIntensity = sinar;
    }
    if (this.sisaDoronganLuar > 0) this.sisaDoronganLuar -= dt;
  }
}
