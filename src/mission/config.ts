import data from '../data/misi3.json';

/** Status Gajah Pagon: ikut rombongan atau ditinggal dirawat. */
export type StatusPagon = 'ikut' | 'ditinggal';

/** Perubahan variabel rombongan yang dipicu satu tanda dialog. Semua anggota opsional. */
export interface AturanTanda {
  pengikut?: number;
  perbekalan?: number;
  kewaspadaan?: number;
  pagon?: StatusPagon;
  /** Kecepatan lari maksimum rombongan sampai akhir misi (m/s). */
  lajuLari?: number;
  /** Teks kecil di HUD rombongan; tanpa teks, perubahan tidak diumumkan. */
  teks?: string;
}

export interface AturanRombongan {
  awal: { pengikut: number; perbekalan: number; pagon: StatusPagon; kewaspadaan: number; kaliKetahuan: number };
  /** Pemetaan tanda dialog ke perubahan variabel. */
  tanda: Record<string, AturanTanda>;
  ketahuan: { kewaspadaan: number; kaliKetahuan: number; pengikutJikaPagon: number; maksPengikutJikaPagon: number; teks: string };
  /** `lajuMaks` membatasi pemain dan pengikut lain; `lajuPagon` sedikit lebih tinggi supaya ia bisa menyusul. */
  pagonIkut: { lajuMaks: number; lajuPagon: number; pengaliCuriga: number };
  penjagaSungai: { dasar: number; maks: number };
}

/** Seluruh data misi 3 dari src/data/misi3.json. */
export const MISI = data;

/** Aturan variabel rombongan. Angka diubah di misi3.json, bukan di kode. */
export const ATURAN: AturanRombongan = data.aturan as unknown as AturanRombongan;
