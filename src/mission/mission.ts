import * as THREE from 'three';
import type { Pemain } from '../character/player';
import type { PengelolaPengikut } from '../character/follower';
import type { PengelolaLawan } from '../combat/enemy-manager';
import type { PengelolaSiluman } from '../stealth/stealth-manager';
import type { Penjaga } from '../stealth/guard';
import type { Semak } from '../stealth/bush';
import { Obor } from '../world/torch';
import { DIALOG } from '../dialog/config';
import { KITAB_PER_ID } from '../codex/config';
import { ATURAN, SEGMEN, TEKS_MISI, JENIS_KEJADIAN, langkahSegmen, type Segmen, type PemicuSegmen, type SyaratPemicu, type DataNpcMisi, type DataPenjaga, type LangkahTujuan } from './config';
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
  /** Kejadian di jalur (sprint 7): diundi ulang tiap segmen mulai dari benih misi. */
  kejadian: { mulaiSegmen(s: Segmen, benih: number): void; bersihkan(): void };
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
  /** Dipanggil saat langkah tujuan baru muncul, dengan penanda yang bisa dituju kamera (null kalau tidak ada). */
  saatLangkahBaru: ((penanda: [number, number] | null) => void) | null = null;
  /** Indeks langkah tujuan sekarang di dalam segmen. */
  indeksLangkah = 0;
  /** Titik simpan segmen sekarang: dipakai saat gugur. */
  private titik: TitikSimpan | null = null;
  private readonly obor: Obor[] = [];
  private readonly dinamis: IsiDinamis = { penjaga: [], npc: [], semak: [], pencabutBatu: [] };
  /** NPC dinamis segmen sekarang; dicabut saat segmen selesai. */
  private npcSegmen: Npc[] = [];
  private readonly pemicuSudah = new Set<PemicuSegmen>();
  private isiGlobalTerpasang = false;
  /** Benih undian kejadian, dibuat saat misi mulai dan disimpan di titik simpan. */
  private benih = 0;

  constructor(private readonly d: KetergantunganMisi) {}

  get segmen(): Segmen | null {
    return SEGMEN[this.indeks] ?? null;
  }

  /** Langkah tujuan sekarang, atau null di luar misi. */
  get langkah(): LangkahTujuan | null {
    const s = this.segmen;
    return s ? langkahSegmen(s)[this.indeksLangkah] ?? null : null;
  }

  /** Penanda yang berlaku sekarang: penanda langkah kalau ada, kalau tidak penanda segmen. */
  get penandaSekarang(): [number, number][] {
    const s = this.segmen;
    if (!s || this.selesai) return [];
    const l = this.langkah;
    return l?.penanda ? [l.penanda] : s.penanda ?? [];
  }

  /** Penanda terdekat dari posisi (x, z), atau null. */
  penandaTerdekat(x: number, z: number): [number, number] | null {
    let terbaik: [number, number] | null = null;
    let jarak = Infinity;
    for (const p of this.penandaSekarang) {
      const d = Math.hypot(p[0] - x, p[1] - z);
      if (d < jarak) {
        jarak = d;
        terbaik = p;
      }
    }
    return terbaik;
  }

  /** Menggerakkan pendar dan asap obor penanda; dipanggil tiap frame dari loop render. */
  perbaruiPenanda(dt: number, posisiKamera: THREE.Vector3): void {
    for (const o of this.obor) o.perbarui(dt, posisiKamera);
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
      for (const k of s.kejadian ?? []) {
        cekDialog(k.percakapan, `kejadian ${k.id}`);
        if (!JENIS_KEJADIAN.includes(k.jenis)) pesan.push(`${nama}: kejadian "${k.id}" berjenis "${k.jenis}" yang tidak dikenal`);
        if (k.undian && (k.undian.ke < 0 || k.undian.ke >= k.undian.dari)) pesan.push(`${nama}: kejadian "${k.id}" undian.ke di luar 0..dari-1`);
      }
      if (!s.selesai) pesan.push(`${nama}: tidak punya syarat selesai`);
      const langkah = langkahSegmen(s);
      langkah.forEach((l, k) => {
        if (k < langkah.length - 1 && !l.selesai?.area) pesan.push(`${nama}: langkah ${k + 1} bukan yang terakhir tapi tidak punya selesai.area`);
      });
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
    this.benih = Date.now() >>> 0;
    this.d.rombongan.reset();
    this.d.segarkanRombongan();
    this.d.pengikut.pagonIkut = this.d.rombongan.pagonIkut;
    this.masukSegmen(dariSegmen, true, false);
  }

  /**
   * Melanjutkan dari titik simpan: tanda, percakapan, dan rombongan dipulihkan, isi dinamis segmen
   * yang sudah lewat dipasang lagi sesuai tanda (misalnya penjaga pagi kalau menginap; NPC sekali
   * pakai segmen tidak), lalu segmen itu dimulai tanpa pembukanya.
   */
  lanjutkan(titik: TitikSimpan): void {
    this.bersihkanUntukMulai();
    this.benih = titik.benih ?? 0;
    this.d.status.pulihkanDariTitik(titik);
    this.pulihkanRombongan(titik);
    const i = Math.max(0, SEGMEN.findIndex((s) => s.id === titik.segmen));
    for (let j = 0; j < i; j++) {
      const s = SEGMEN[j];
      if (s.syarat && !this.d.status.tanda.has(s.syarat)) continue;
      this.pasangIsi(s, true, true);
    }
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
    this.d.kejadian.mulaiSegmen(s, this.benih);
    this.taruhPemain(s);
    this.mulaiLangkah(0);
  }

  private bersihkanUntukMulai(): void {
    this.selesai = false;
    this.pemicuSudah.clear();
    this.cabutDinamis();
    this.d.kejadian.bersihkan();
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
    // Langkah tujuan di dalam segmen: berganti saat areanya tercapai; langkah terakhir memakai syarat selesai segmen.
    const langkah = langkahSegmen(s);
    const l = langkah[this.indeksLangkah];
    if (this.indeksLangkah < langkah.length - 1 && l?.selesai?.area && this.dalamArea(posisiPemain, l.selesai.area.pusat, l.selesai.area.jari)) {
      this.mulaiLangkah(this.indeksLangkah + 1);
      return;
    }
    const akhir = s.selesai;
    if (akhir.area && this.dalamArea(posisiPemain, akhir.area.pusat, akhir.area.jari)) this.segmenBerikut();
    else if (akhir.tanda && this.adaTanda(akhir.tanda)) this.segmenBerikut();
  }

  /** Memulai langkah tujuan ke-`k` segmen sekarang: teks HUD, obor, dan arahan kamera. */
  private mulaiLangkah(k: number): void {
    const s = this.segmen;
    if (!s) return;
    const langkah = langkahSegmen(s);
    this.indeksLangkah = Math.min(k, langkah.length - 1);
    const l = langkah[this.indeksLangkah];
    this.d.aturTujuan(l.teks);
    this.bersihkanObor();
    for (const [x, z] of this.penandaSekarang) {
      const o = new Obor(x, z);
      this.d.scene.add(o.grup);
      this.obor.push(o);
    }
    this.saatLangkahBaru?.(this.penandaTerdekat(this.d.pemain.posisi.x, this.d.pemain.posisi.z));
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
      this.d.kejadian.bersihkan();
      this.d.aturTujuan('');
      this.saatSelesai?.();
      return;
    }
    this.indeks = j;
    const s = SEGMEN[j];
    if (import.meta.env.DEV) console.log(`[misi] segmen ${j + 1}/${SEGMEN.length}: ${s.id}`);
    this.pasangIsi(s, true);
    this.d.kejadian.mulaiSegmen(s, this.benih);
    this.titik = {
      segmen: s.id,
      rombongan: this.d.rombongan.salin(),
      tanda: [...this.d.status.tanda],
      percakapan: [...this.d.status.percakapanSelesai],
      waktu: 0,
      benih: this.benih,
    };
    this.d.aturCahaya(s.cahaya && (!s.cahaya.syarat || this.d.status.tanda.has(s.cahaya.syarat)) ? s.cahaya.pengali : 1);
    if (taruhPemain) this.taruhPemain(s);
    this.mulaiLangkah(0);
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
   * `segmenLewat`: segmen yang sudah selesai (saat Lanjutkan): NPC dinamis segmen tidak dipasang.
   */
  private pasangIsi(s: Segmen, saatSegmen: boolean, segmenLewat = false): void {
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
    if (s.jumlahPenjagaDariAturan === 'penjagaSungai') {
      let n = this.d.rombongan.jumlahPenjagaSungai;
      // Dibagi antar segmen: bagian ke-i dari k mendapat floor((n + k - 1 - i) / k).
      if (s.bagianPenjaga) n = Math.floor((n + s.bagianPenjaga.dari - 1 - s.bagianPenjaga.ke) / s.bagianPenjaga.dari);
      daftarPenjaga = daftarPenjaga.slice(0, n);
    }
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
      if (segmenLewat && n.dinamis) continue;
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
    for (const o of this.obor) {
      this.d.scene.remove(o.grup);
      o.buang();
    }
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
