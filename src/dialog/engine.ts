import { DIALOG, type Percakapan, type Simpul } from './config';
import type { StatusPermainan } from '../mission/state';

/**
 * Mesin percakapan: memegang simpul sekarang, menjalankan `bukaKitab` dan `tandai`
 * saat simpul tampil, dan berpindah lewat `lanjut` atau `pilih`. Tidak tahu apa-apa soal UI.
 */
export class MesinDialog {
  private percakapan: Percakapan | null = null;
  private idPercakapan = '';
  private idSimpul = '';
  /** Dipanggil saat percakapan berakhir, dengan id percakapannya. */
  saatSelesai: ((id: string) => void) | null = null;

  constructor(private status: StatusPermainan) {}

  get aktif(): boolean {
    return this.percakapan !== null;
  }

  get id(): string {
    return this.idPercakapan;
  }

  get judul(): string {
    return this.percakapan?.judul ?? '';
  }

  get simpul(): Simpul | null {
    return this.percakapan?.simpul[this.idSimpul] ?? null;
  }

  /** Id tokoh yang bicara di simpul sekarang. */
  get pembicara(): string {
    return this.simpul?.tokoh ?? '';
  }

  namaTokoh(id: string): string {
    return this.percakapan?.tokoh[id] ?? id;
  }

  /** Memulai percakapan; salah kalau id tidak ada. */
  mulai(id: string): boolean {
    const p = DIALOG[id];
    if (!p) {
      console.warn(`[dialog] percakapan "${id}" tidak ada`);
      return false;
    }
    this.percakapan = p;
    this.idPercakapan = id;
    this.masukSimpul(p.mulai);
    return true;
  }

  /** Maju ke simpul berikutnya; tidak berbuat apa-apa kalau simpul menuntut pilihan. */
  lanjut(): void {
    const s = this.simpul;
    if (!s) return;
    if (s.pilihan && s.pilihan.length > 0) return;
    if (s.selesai || s.lanjut === undefined) this.akhiri();
    else this.masukSimpul(s.lanjut);
  }

  /** Memilih pilihan ke-`indeks` (mulai 0) pada simpul sekarang. */
  pilih(indeks: number): void {
    const s = this.simpul;
    const pil = s?.pilihan?.[indeks];
    if (!pil) return;
    this.masukSimpul(pil.lanjut);
  }

  /** Menghentikan percakapan sekarang tanpa menandainya selesai. */
  batalkan(): void {
    this.percakapan = null;
    this.idSimpul = '';
  }

  private masukSimpul(id: string): void {
    const p = this.percakapan;
    if (!p) return;
    const s = p.simpul[id];
    if (!s) {
      console.warn(`[dialog] simpul "${id}" tidak ada di "${this.idPercakapan}", percakapan diakhiri`);
      this.akhiri();
      return;
    }
    this.idSimpul = id;
    for (const k of s.bukaKitab ?? []) this.status.bukaKitab(k);
    if (s.tandai) this.status.tandai(s.tandai);
  }

  private akhiri(): void {
    const id = this.idPercakapan;
    this.status.selesaikanPercakapan(id);
    this.percakapan = null;
    this.idSimpul = '';
    this.saatSelesai?.(id);
  }
}
