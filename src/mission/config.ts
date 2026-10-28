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
  /** Tempat Gajah Pagon berdiri saat permainan dilanjutkan setelah ia ditinggal. */
  pagonDitinggal: { posisi: [number, number] };
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
  /** Tanda yang harus ada supaya penjaga ini dipasang (saat segmennya mulai). */
  syarat?: string;
  /** Dipasang saat segmennya mulai walau tanpa syarat. */
  dinamis?: boolean;
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
  /** Dipasang saat segmennya mulai dan dicabut saat segmen selesai. */
  dinamis?: boolean;
  /** Dicabut begitu percakapannya selesai (misalnya prajurit yang bergabung). */
  hapusSetelahPercakapan?: boolean;
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

/** Satu langkah tujuan: teks HUD, penanda obor, dan area yang menyelesaikannya (langkah terakhir memakai `selesai` segmen). */
export interface LangkahTujuan {
  teks: string;
  /** Posisi obor penanda selama langkah ini; tanpa ini dipakai `penanda` segmen. */
  penanda?: [number, number];
  selesai?: { area: { pusat: [number, number]; jari: number } };
}

/** Daftar langkah sebuah segmen; tujuan berupa string menjadi satu langkah tanpa penanda sendiri. */
export function langkahSegmen(s: Segmen): LangkahTujuan[] {
  return typeof s.tujuan === 'string' ? [{ teks: s.tujuan }] : s.tujuan;
}

/** Kapan segmen dianggap selesai: percakapan tertentu berakhir, pemain masuk area, atau tanda muncul. */
export interface SyaratSelesai {
  percakapan?: string;
  area?: { pusat: [number, number]; jari: number };
  /** Satu tanda, atau daftar yang salah satunya cukup. */
  tanda?: string | string[];
}

/** Percakapan lanjutan yang otomatis dimulai setelah percakapan lain selesai. */
export interface RantaiPercakapan {
  setelah: string;
  percakapan: string;
}

export interface Segmen {
  id: string;
  /** Teks tujuan di HUD kiri atas, atau daftar langkah yang berganti saat areanya tercapai. */
  tujuan: string | LangkahTujuan[];
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
  rantai?: RantaiPercakapan[];
  /** Pengali terang cahaya selama segmen (misalnya pagi setelah menginap), kalau syaratnya ada. */
  cahaya?: { syarat?: string; pengali: number };
  selesai: SyaratSelesai;
}

/** Daftar segmen misi berurutan. */
export const SEGMEN: Segmen[] = data.segmen as unknown as Segmen[];

/** Teks panel naskah (kunci dipakai `saatMulai.panel`): paragraf atau satu kalimat. */
export const TEKS_MISI: Record<string, string | string[]> = { pembuka: data.teks.pembuka, jeda: data.teks.jeda };

/** Teks layar misi selesai: ringkasan sejarah, kutipan, dan catatan bersumber dua versi. */
export const TEKS_SELESAI = data.teks.selesai;

/** Pemetaan id tokoh dialog ke indeks pengikut, untuk arah kamera sinematik. */
export const PENGIKUT_TOKOH: Record<string, number> = data.pengikutTokoh;

/** Tata letak dunia yang ditentukan data misi. */
export const DUNIA_MISI = data.dunia;

/** Gaya partikel pemandu (Tab) untuk misi ini: `kunang` malam, `daun` siang. */
export const GAYA_PEMANDU = data.pemandu;
