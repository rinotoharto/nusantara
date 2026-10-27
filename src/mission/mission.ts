import * as THREE from 'three';
import type { Pemain } from '../character/player';
import type { PengelolaPengikut } from '../character/follower';
import type { PengelolaLawan } from '../combat/enemy-manager';
import type { PengelolaSiluman } from '../stealth/stealth-manager';
import type { Penjaga } from '../stealth/guard';
import { buatObor } from '../world/torch';
import { DIALOG } from '../dialog/config';
import { KITAB_PER_ID } from '../codex/config';
import { SEGMEN, TEKS_MISI, type Segmen, type PemicuSegmen, type SyaratPemicu } from './config';
import type { StatusPermainan } from './state';
import type { Rombongan, NilaiRombongan } from './party';
import { PengelolaNpc, type Npc } from './npc';

/** Hal-hal di luar misi yang dipakai pelaksana: dunia, UI, dan cara memulai percakapan. */
export interface KetergantunganMisi {
  scene: THREE.Scene;
  status: StatusPermainan;
  rombongan: Rombongan;
  siluman: PengelolaSiluman;
  npc: PengelolaNpc;
  pengikut: PengelolaPengikut;
  pemain: Pemain;
  lawan: PengelolaLawan;
  /** Mengganti teks tujuan di HUD. */
  aturTujuan: (teks: string) => void;
  /** Menampilkan panel teks; `lama` 0 berarti menunggu klik. Memanggil `selesai` saat tertutup. */
  bukaPanel: (paragraf: string[], lama: number, selesai: () => void) => void;
  /** Memulai percakapan; `lawanBicara` null kalau pembicaranya para pengikut. */
  mulaiDialog: (id: string, lawanBicara: THREE.Vector3 | null) => void;
  /** Menyegarkan tampilan rombongan setelah nilainya dipulihkan. */
  segarkanRombongan: () => void;
}

/**
 * Pelaksana misi: menjalankan daftar segmen dari misi3.json. Isi tanpa `syarat` dipasang
 * sekali saat misi mulai; isi bersyarat dipasang saat segmennya mulai. Tiap segmen punya
 * tujuan, obor penanda, pemicu area, dan syarat selesai; kode ini tidak tahu isi ceritanya.
 */
export class PelaksanaMisi {
  /** Indeks segmen sekarang di SEGMEN; -1 sebelum misi mulai. */
  indeks = -1;
  selesai = false;
  /** Dipanggil saat segmen terakhir selesai. */
  saatSelesai: (() => void) | null = null;
  private readonly obor: THREE.Group[] = [];
  private readonly penjagaBersyarat: Penjaga[] = [];
  private readonly npcBersyarat: Npc[] = [];
  private readonly pemicuSudah = new Set<PemicuSegmen>();
  private isiGlobalTerpasang = false;
  private simpananRombongan: NilaiRombongan | null = null;

  constructor(private readonly d: KetergantunganMisi) {}

  get segmen(): Segmen | null {
    return SEGMEN[this.indeks] ?? null;
  }

  /** Memeriksa misi3.json: id percakapan, Kitab, dan kunci teks harus ada. */
  validasi(): string[] {
    const pesan: string[] = [];
    SEGMEN.forEach((s, i) => {
      const nama = `misi3 segmen "${s.id ?? i + 1}"`;
      const cekDialog = (id: string | undefined, di: string) => {
        if (id && !DIALOG[id]) pesan.push(`${nama}: percakapan "${id}" (${di}) tidak ada di dialog.json`);
      };
      cekDialog(s.saatMulai?.percakapan, 'saatMulai');
      cekDialog(s.selesai?.percakapan, 'selesai');
      if (s.saatMulai?.panel && !TEKS_MISI[s.saatMulai.panel]) pesan.push(`${nama}: teks panel "${s.saatMulai.panel}" tidak ada`);
      for (const n of s.npc ?? []) for (const id of n.percakapan) cekDialog(id, `npc ${n.id}`);
      for (const p of s.pemicu ?? []) {
        cekDialog(p.percakapan, 'pemicu');
        for (const k of p.bukaKitab ?? []) if (!KITAB_PER_ID.has(k)) pesan.push(`${nama}: bukaKitab "${k}" tidak ada di codex`);
      }
      if (!s.selesai) pesan.push(`${nama}: tidak punya syarat selesai`);
    });
    return pesan;
  }

  /** Misi dari awal: rombongan direset, isi bersyarat dicabut, pemain ke titik awal segmen pertama. */
  mulai(): void {
    this.selesai = false;
    this.pemicuSudah.clear();
    for (const p of this.penjagaBersyarat) this.d.siluman.hapusPenjaga(p);
    this.penjagaBersyarat.length = 0;
    for (const n of this.npcBersyarat) this.d.npc.hapus(n);
    this.npcBersyarat.length = 0;
    this.d.rombongan.reset();
    this.d.segarkanRombongan();
    this.d.pengikut.pagonIkut = this.d.rombongan.pagonIkut;
    this.d.lawan.hidupkanSemua();
    if (!this.isiGlobalTerpasang) {
      for (const s of SEGMEN) this.pasangIsi(s, false);
      this.isiGlobalTerpasang = true;
    }
    this.masukSegmen(0, true);
  }

  /** Gugur: kembali ke titik simpan segmen; rombongan kembali ke nilai saat segmen dimulai. */
  muatUlangSegmen(): void {
    const s = this.segmen;
    if (!s) return;
    if (this.simpananRombongan) {
      this.d.rombongan.pulihkan(this.simpananRombongan);
      this.d.segarkanRombongan();
      this.d.pengikut.pagonIkut = this.d.rombongan.pagonIkut;
    }
    this.d.lawan.hidupkanSemua();
    this.taruhPemain(s);
  }

  /** Dipanggil tiap frame permainan. */
  perbarui(posisiPemain: THREE.Vector3): void {
    const s = this.segmen;
    if (!s || this.selesai) return;
    for (const p of s.pemicu ?? []) {
      if (this.pemicuSudah.has(p) || p.jenis !== 'area') continue;
      if (!this.dalamArea(posisiPemain, p.pusat, p.jari) || !this.syaratTerpenuhi(p.jika)) continue;
      this.pemicuSudah.add(p);
      for (const k of p.bukaKitab ?? []) this.d.status.bukaKitab(k);
      if (p.percakapan) this.d.mulaiDialog(p.percakapan, null);
    }
    const akhir = s.selesai;
    if (akhir.area && this.dalamArea(posisiPemain, akhir.area.pusat, akhir.area.jari)) this.segmenBerikut();
    else if (akhir.tanda && this.d.status.tanda.has(akhir.tanda)) this.segmenBerikut();
  }

  /** Dipanggil saat sebuah percakapan berakhir. */
  saatDialogSelesai(id: string): void {
    const s = this.segmen;
    if (!s || this.selesai) return;
    if (s.selesai.percakapan === id) this.segmenBerikut();
  }

  private segmenBerikut(): void {
    this.masukSegmen(this.indeks + 1, false);
  }

  /** Masuk ke segmen ke-`i` (atau yang berikutnya kalau syaratnya tidak terpenuhi). */
  private masukSegmen(i: number, taruhPemain: boolean): void {
    let j = i;
    while (j < SEGMEN.length && SEGMEN[j].syarat && !this.d.status.tanda.has(SEGMEN[j].syarat as string)) j++;
    this.bersihkanObor();
    if (j >= SEGMEN.length) {
      this.selesai = true;
      this.d.aturTujuan('');
      this.saatSelesai?.();
      return;
    }
    this.indeks = j;
    const s = SEGMEN[j];
    if (import.meta.env.DEV) console.log(`[misi] segmen ${j + 1}/${SEGMEN.length}: ${s.id}`);
    if (s.syarat) this.pasangIsi(s, true);
    else this.pasangIsiBersyarat(s);
    this.simpananRombongan = this.d.rombongan.salin();
    this.d.aturTujuan(s.tujuan);
    for (const [x, z] of s.penanda ?? []) {
      const o = buatObor(x, z);
      this.d.scene.add(o);
      this.obor.push(o);
    }
    if (taruhPemain) this.taruhPemain(s);

    const mulai = s.saatMulai;
    if (!mulai) return;
    const percakapan = () => {
      if (mulai.percakapan) this.d.mulaiDialog(mulai.percakapan, null);
    };
    if (mulai.panel) {
      const teks = TEKS_MISI[mulai.panel];
      this.d.bukaPanel(Array.isArray(teks) ? teks : [teks], mulai.lamaPanel ?? 0, percakapan);
    } else {
      percakapan();
    }
  }

  private taruhPemain(s: Segmen): void {
    const [x, z] = s.mulai.posisi;
    this.d.pemain.taruhDi(x, z);
    this.d.pemain.hadap = s.mulai.hadap;
    this.d.pemain.hadapKe(x + Math.sin(s.mulai.hadap), z + Math.cos(s.mulai.hadap));
    this.d.pengikut.taruhDiBelakang(this.d.pemain);
  }

  /**
   * Memasang isi segmen. `bersyaratSaja` salah: hanya isi tanpa `syarat` (dipasang saat misi mulai);
   * benar: seluruh isi segmen bersyarat (dipasang saat segmennya mulai).
   */
  private pasangIsi(s: Segmen, bersyaratSaja: boolean): void {
    const boleh = (syarat?: string) => (bersyaratSaja ? true : !syarat);
    for (const b of s.batu ?? []) this.d.siluman.tambahBatu(b);
    for (const m of s.semak ?? []) this.d.siluman.tambahSemak(m.x, m.z);
    let daftarPenjaga = s.penjaga ?? [];
    if (s.jumlahPenjagaDariAturan === 'penjagaSungai') daftarPenjaga = daftarPenjaga.slice(0, this.d.rombongan.jumlahPenjagaSungai);
    for (const p of daftarPenjaga) {
      if (!boleh(p.syarat)) continue;
      if (bersyaratSaja && p.syarat && !this.d.status.tanda.has(p.syarat)) continue;
      const penjaga = this.d.siluman.tambahPenjaga(p);
      if (bersyaratSaja) this.penjagaBersyarat.push(penjaga);
    }
    for (const n of s.npc ?? []) {
      if (!boleh(n.syarat)) continue;
      if (bersyaratSaja && n.syarat && !this.d.status.tanda.has(n.syarat)) continue;
      const npc = this.d.npc.tambah(n);
      if (bersyaratSaja) this.npcBersyarat.push(npc);
    }
  }

  /** Isi bersyarat sebuah segmen tanpa syarat segmen: penjaga dan NPC yang punya `syarat` sendiri. */
  private pasangIsiBersyarat(s: Segmen): void {
    for (const p of s.penjaga ?? []) {
      if (!p.syarat || !this.d.status.tanda.has(p.syarat)) continue;
      this.penjagaBersyarat.push(this.d.siluman.tambahPenjaga(p));
    }
    for (const n of s.npc ?? []) {
      if (!n.syarat || !this.d.status.tanda.has(n.syarat)) continue;
      this.npcBersyarat.push(this.d.npc.tambah(n));
    }
  }

  private bersihkanObor(): void {
    for (const o of this.obor) this.d.scene.remove(o);
    this.obor.length = 0;
  }

  private dalamArea(pos: THREE.Vector3, pusat: [number, number], jari: number): boolean {
    return Math.hypot(pos.x - pusat[0], pos.z - pusat[1]) <= jari;
  }

  private syaratTerpenuhi(j?: SyaratPemicu): boolean {
    if (!j) return true;
    if (j.perbekalanKurangDari !== undefined && !(this.d.rombongan.nilai.perbekalan < j.perbekalanKurangDari)) return false;
    if (j.tanda && !this.d.status.tanda.has(j.tanda)) return false;
    return true;
  }
}
