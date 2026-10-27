import * as THREE from 'three';
import type { Pemain } from '../character/player';
import type { PengelolaPengikut } from '../character/follower';
import type { PengelolaLawan } from '../combat/enemy-manager';
import type { PengelolaSiluman } from '../stealth/stealth-manager';
import type { Penjaga } from '../stealth/guard';
import type { Semak } from '../stealth/bush';
import { buatObor } from '../world/torch';
import { DIALOG } from '../dialog/config';
import { KITAB_PER_ID } from '../codex/config';
import { ATURAN, SEGMEN, TEKS_MISI, type Segmen, type PemicuSegmen, type SyaratPemicu, type DataNpcMisi, type DataPenjaga } from './config';
import type { StatusPermainan, TitikSimpan } from './state';
import type { Rombongan } from './party';
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
  /** Pengali terang cahaya dunia; 1 = normal. */
  aturCahaya: (pengali: number) => void;
  /** Menampilkan panel teks; `lama` 0 berarti menunggu klik. Memanggil `selesai` saat tertutup. */
  bukaPanel: (paragraf: string[], lama: number, selesai: () => void) => void;
  /** Memulai percakapan; `lawanBicara` null kalau pembicaranya para pengikut. */
  mulaiDialog: (id: string, lawanBicara: THREE.Vector3 | null) => void;
  /** Menyegarkan tampilan rombongan setelah nilainya dipulihkan. */
  segarkanRombongan: () => void;
}

/** Isi segmen yang dipasang saat segmen mulai dan dicabut saat misi diulang. */
interface IsiDinamis {
  penjaga: Penjaga[];
  npc: Npc[];
  semak: Semak[];
  pencabutBatu: (() => void)[];
}

/**
 * Pelaksana misi: menjalankan daftar segmen dari misi3.json. Isi tanpa `syarat` dan tanpa
 * `dinamis` dipasang sekali saat misi mulai; isi lainnya dipasang saat segmennya mulai.
 * Tiap segmen punya tujuan, obor penanda, pemicu area, rantai percakapan, dan syarat selesai;
 * kode ini tidak tahu isi ceritanya.
 */
export class PelaksanaMisi {
  /** Indeks segmen sekarang di SEGMEN; -1 sebelum misi mulai. */
  indeks = -1;
  selesai = false;
  /** Dipanggil saat segmen terakhir selesai. */
  saatSelesai: (() => void) | null = null;
  /** Dipanggil tiap kali segmen baru dimulai dengan titik simpannya (waktu diisi pemanggil). */
  saatSegmenMulai: ((titik: TitikSimpan) => void) | null = null;
  /** Titik simpan segmen sekarang: dipakai saat gugur. */
  private titik: TitikSimpan | null = null;
  private readonly obor: THREE.Group[] = [];
  private readonly dinamis: IsiDinamis = { penjaga: [], npc: [], semak: [], pencabutBatu: [] };
  /** NPC dinamis segmen sekarang; dicabut saat segmen selesai. */
  private npcSegmen: Npc[] = [];
  private readonly pemicuSudah = new Set<PemicuSegmen>();
  private isiGlobalTerpasang = false;

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
      for (const r of s.rantai ?? []) {
        cekDialog(r.setelah, 'rantai.setelah');
        cekDialog(r.percakapan, 'rantai.percakapan');
      }
      if (!s.selesai) pesan.push(`${nama}: tidak punya syarat selesai`);
    });
    return pesan;
  }

  /** Memasang isi statis semua segmen dan menaruh pemain di awal misi, tanpa memulai (latar layar awal). */
  siapkan(): void {
    if (!this.isiGlobalTerpasang) {
      for (const s of SEGMEN) if (!s.syarat) this.pasangIsi(s, false);
      this.isiGlobalTerpasang = true;
    }
    this.taruhPemain(SEGMEN[0]);
  }

  /** Misi dari awal: rombongan direset, isi dinamis dicabut, pemain ke titik awal segmen pertama. */
  mulai(dariSegmen = 0): void {
    this.bersihkanUntukMulai();
    this.d.rombongan.reset();
    this.d.segarkanRombongan();
    this.d.pengikut.pagonIkut = this.d.rombongan.pagonIkut;
    this.masukSegmen(dariSegmen, true, false);
  }

  /** Melanjutkan dari titik simpan: tanda, percakapan, dan rombongan dipulihkan, lalu segmen itu dimulai tanpa pembukanya. */
  lanjutkan(titik: TitikSimpan): void {
    this.bersihkanUntukMulai();
    this.d.status.pulihkanDariTitik(titik);
    this.pulihkanRombongan(titik);
    const i = Math.max(0, SEGMEN.findIndex((s) => s.id === titik.segmen));
    this.masukSegmen(i, true, true);
  }

  /** Gugur: kembali ke titik simpan segmen; rombongan, tanda, dan percakapan kembali ke saat segmen dimulai. */
  muatUlangSegmen(): void {
    const s = this.segmen;
    if (!s) return;
    if (this.titik) {
      this.d.status.pulihkanDariTitik(this.titik);
      this.pulihkanRombongan(this.titik);
    }
    this.d.lawan.hidupkanSemua();
    this.taruhPemain(s);
  }

  private bersihkanUntukMulai(): void {
    this.selesai = false;
    this.pemicuSudah.clear();
    this.cabutDinamis();
    this.d.lawan.hidupkanSemua();
    this.d.aturCahaya(1);
    if (!this.isiGlobalTerpasang) {
      for (const s of SEGMEN) if (!s.syarat) this.pasangIsi(s, false);
      this.isiGlobalTerpasang = true;
    }
  }

  private pulihkanRombongan(titik: TitikSimpan): void {
    this.d.rombongan.pulihkan(titik.rombongan);
    this.d.segarkanRombongan();
    this.d.pengikut.pagonIkut = this.d.rombongan.pagonIkut;
    if (!this.d.rombongan.pagonIkut) {
      const [x, z] = ATURAN.pagonDitinggal.posisi;
      this.d.pengikut.pagon.taruhDi(x, z);
    }
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
    else if (akhir.tanda && this.adaTanda(akhir.tanda)) this.segmenBerikut();
  }

  /** Dipanggil saat sebuah percakapan berakhir: NPC sekali pakai dicabut, rantai dan syarat selesai diperiksa. */
  saatDialogSelesai(id: string): void {
    for (const n of [...this.d.npc.daftar]) {
      if (n.hapusSetelahPercakapan && n.punyaPercakapan(id)) this.d.npc.hapus(n);
    }
    const s = this.segmen;
    if (!s || this.selesai) return;
    const rantai = s.rantai?.find((r) => r.setelah === id);
    if (rantai) {
      this.d.mulaiDialog(rantai.percakapan, null);
      return;
    }
    if (s.selesai.percakapan === id) this.segmenBerikut();
  }

  private segmenBerikut(): void {
    for (const n of this.npcSegmen) this.d.npc.hapus(n);
    this.npcSegmen = [];
    this.masukSegmen(this.indeks + 1, false, false);
  }

  /**
   * Masuk ke segmen ke-`i` (atau yang berikutnya kalau syaratnya tidak terpenuhi).
   * `tanpaPembuka`: lewati panel dan percakapan `saatMulai` (saat melanjutkan dari titik simpan).
   */
  private masukSegmen(i: number, taruhPemain: boolean, tanpaPembuka: boolean): void {
    let j = i;
    while (j < SEGMEN.length && SEGMEN[j].syarat && !this.d.status.tanda.has(SEGMEN[j].syarat as string)) j++;
    this.bersihkanObor();
    if (j >= SEGMEN.length) {
      this.selesai = true;
      this.indeks = SEGMEN.length;
      this.d.aturTujuan('');
      this.saatSelesai?.();
      return;
    }
    this.indeks = j;
    const s = SEGMEN[j];
    if (import.meta.env.DEV) console.log(`[misi] segmen ${j + 1}/${SEGMEN.length}: ${s.id}`);
    this.pasangIsi(s, true);
    this.titik = {
      segmen: s.id,
      rombongan: this.d.rombongan.salin(),
      tanda: [...this.d.status.tanda],
      percakapan: [...this.d.status.percakapanSelesai],
      waktu: 0,
    };
    this.d.aturTujuan(s.tujuan);
    this.d.aturCahaya(s.cahaya && (!s.cahaya.syarat || this.d.status.tanda.has(s.cahaya.syarat)) ? s.cahaya.pengali : 1);
    for (const [x, z] of s.penanda ?? []) {
      const o = buatObor(x, z);
      this.d.scene.add(o);
      this.obor.push(o);
    }
    if (taruhPemain) this.taruhPemain(s);
    this.saatSegmenMulai?.(this.titik);

    const mulai = s.saatMulai;
    if (!mulai || tanpaPembuka) return;
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
    this.d.pemain.hadapKe(x + Math.sin(s.mulai.hadap), z + Math.cos(s.mulai.hadap));
    this.d.pengikut.taruhDiBelakang(this.d.pemain);
  }

  /** Benar kalau sebuah butir dipasang saat segmennya mulai (bukan saat misi mulai). */
  private dinamisButir(s: Segmen, b: { syarat?: string; dinamis?: boolean }): boolean {
    return Boolean(s.syarat || b.syarat || b.dinamis);
  }

  /**
   * Memasang isi segmen. `saatSegmen` salah: hanya butir statis (saat misi mulai);
   * benar: hanya butir dinamis yang syaratnya terpenuhi (saat segmen mulai).
   */
  private pasangIsi(s: Segmen, saatSegmen: boolean): void {
    const segmenDinamis = Boolean(s.syarat);
    if (saatSegmen === segmenDinamis) {
      for (const b of s.batu ?? []) {
        const cabut = this.d.siluman.tambahBatu(b);
        if (saatSegmen) this.dinamis.pencabutBatu.push(cabut);
      }
      for (const m of s.semak ?? []) {
        const semak = this.d.siluman.tambahSemak(m.x, m.z);
        if (saatSegmen) this.dinamis.semak.push(semak);
      }
    }
    let daftarPenjaga: DataPenjaga[] = s.penjaga ?? [];
    if (s.jumlahPenjagaDariAturan === 'penjagaSungai') daftarPenjaga = daftarPenjaga.slice(0, this.d.rombongan.jumlahPenjagaSungai);
    for (const p of daftarPenjaga) {
      if (this.dinamisButir(s, p) !== saatSegmen) continue;
      if (p.syarat && !this.d.status.tanda.has(p.syarat)) continue;
      const penjaga = this.d.siluman.tambahPenjaga(p);
      if (saatSegmen) this.dinamis.penjaga.push(penjaga);
    }
    const daftarNpc: DataNpcMisi[] = s.npc ?? [];
    for (const n of daftarNpc) {
      if (this.dinamisButir(s, n) !== saatSegmen) continue;
      if (n.syarat && !this.d.status.tanda.has(n.syarat)) continue;
      // NPC sekali pakai yang percakapannya sudah selesai (misalnya sudah direkrut) tidak dipasang lagi.
      if (n.hapusSetelahPercakapan && n.percakapan.every((id) => this.d.status.percakapanSelesai.has(id))) continue;
      const npc = this.d.npc.tambah(n);
      if (saatSegmen) {
        this.dinamis.npc.push(npc);
        if (n.dinamis) this.npcSegmen.push(npc);
      }
    }
  }

  private cabutDinamis(): void {
    for (const p of this.dinamis.penjaga) this.d.siluman.hapusPenjaga(p);
    for (const n of this.dinamis.npc) this.d.npc.hapus(n);
    for (const m of this.dinamis.semak) this.d.siluman.hapusSemak(m);
    for (const cabut of this.dinamis.pencabutBatu) cabut();
    this.dinamis.penjaga.length = 0;
    this.dinamis.npc.length = 0;
    this.dinamis.semak.length = 0;
    this.dinamis.pencabutBatu.length = 0;
    this.npcSegmen = [];
  }

  private bersihkanObor(): void {
    for (const o of this.obor) this.d.scene.remove(o);
    this.obor.length = 0;
  }

  private dalamArea(pos: THREE.Vector3, pusat: [number, number], jari: number): boolean {
    return Math.hypot(pos.x - pusat[0], pos.z - pusat[1]) <= jari;
  }

  private adaTanda(tanda: string | string[]): boolean {
    const daftar = Array.isArray(tanda) ? tanda : [tanda];
    return daftar.some((t) => this.d.status.tanda.has(t));
  }

  private syaratTerpenuhi(j?: SyaratPemicu): boolean {
    if (!j) return true;
    if (j.perbekalanKurangDari !== undefined && !(this.d.rombongan.nilai.perbekalan < j.perbekalanKurangDari)) return false;
    if (j.tanda && !this.d.status.tanda.has(j.tanda)) return false;
    return true;
  }
}
