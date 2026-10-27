import data from '../data/dialog.json';
import misi from '../data/misi3.json';

export type Nada = 'hormat' | 'tegas' | 'licik';
export const NADA_SAH: readonly Nada[] = ['hormat', 'tegas', 'licik'];

export interface Pilihan {
  nada: Nada;
  teks: string;
  lanjut: string;
}

export interface Simpul {
  /** Id tokoh, harus ada di `Percakapan.tokoh`. */
  tokoh: string;
  /** Boleh mengandung istilah `[[istilah|id-kitab]]`. */
  teks?: string;
  pilihan?: Pilihan[];
  lanjut?: string;
  selesai?: boolean;
  /** Id entri Kitab yang terbuka saat simpul tampil. */
  bukaKitab?: string[];
  /** Tanda bebas yang disimpan ke status permainan. */
  tandai?: string;
}

export interface Percakapan {
  judul: string;
  tokoh: Record<string, string>;
  mulai: string;
  simpul: Record<string, Simpul>;
}

/** Semua percakapan dari src/data/dialog.json, berkunci id percakapan. */
export const DIALOG: Readonly<Record<string, Percakapan>> = data as Record<string, Percakapan>;

/** Id tokoh yang dimainkan pemain (dipakai untuk arah kamera). */
export const TOKOH_PEMAIN: string = misi.tokohPemain;
