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

// --- Segmen misi -------------------------------------------------------------------------

export interface TitikXZ {
  x: number;
  z: number;
}

export interface DataPenjaga {
  nama: string;
  mode: string;
  titik: TitikXZ[];
  /** Tanda yang harus ada supaya penjaga ini dipasang. */
  syarat?: string;
}

export interface DataBatuMisi {
  x: number;
  z: number;
  lebar: number;
  tinggi: number;
  dalam: number;
}

export interface DataNpcMisi {
  id: string;
  nama: string;
  posisi: [number, number];
  hadap: number;
  percakapan: string[];
  syarat?: string;
}

/** Syarat tambahan sebuah pemicu; semua anggota harus terpenuhi. */
export interface SyaratPemicu {
  perbekalanKurangDari?: number;
  tanda?: string;
}

export interface PemicuSegmen {
  jenis: 'area';
  pusat: [number, number];
  jari: number;
  percakapan?: string;
  bukaKitab?: string[];
  jika?: SyaratPemicu;
}

/** Kapan segmen dianggap selesai: percakapan tertentu berakhir, pemain masuk area, atau tanda muncul. */
export interface SyaratSelesai {
  percakapan?: string;
  area?: { pusat: [number, number]; jari: number };
  tanda?: string;
}

export interface Segmen {
  id: string;
  /** Teks tujuan di HUD kiri atas. */
  tujuan: string;
  /** Titik simpan: posisi pemain saat segmen dimuat ulang. */
  mulai: { posisi: [number, number]; hadap: number };
  /** Tanda yang harus ada; kalau tidak, segmen dilewati. */
  syarat?: string;
  /** Posisi obor penanda dunia selama segmen ini. */
  penanda?: [number, number][];
  penjaga?: DataPenjaga[];
  /** Hanya `n` penjaga pertama dari daftar yang dipasang, `n` dari aturan rombongan. */
  jumlahPenjagaDariAturan?: 'penjagaSungai';
  batu?: DataBatuMisi[];
  semak?: TitikXZ[];
  npc?: DataNpcMisi[];
  /** Yang terjadi saat segmen mulai: panel teks (kunci di `teks`), lalu percakapan otomatis. */
  saatMulai?: { panel?: string; lamaPanel?: number; percakapan?: string };
  pemicu?: PemicuSegmen[];
  selesai: SyaratSelesai;
}

/** Daftar segmen misi berurutan. */
export const SEGMEN: Segmen[] = data.segmen as unknown as Segmen[];

/** Teks naskah misi: panel pembuka, jeda waktu, dan sebagainya. */
export const TEKS_MISI: Record<string, string | string[]> = data.teks as Record<string, string | string[]>;

/** Pemetaan id tokoh dialog ke indeks pengikut, untuk arah kamera sinematik. */
export const PENGIKUT_TOKOH: Record<string, number> = data.pengikutTokoh;

/** Tata letak dunia yang ditentukan data misi. */
export const DUNIA_MISI = data.dunia;
