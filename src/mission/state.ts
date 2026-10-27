/**
 * Status permainan yang bertahan antar sesi: tanda dari dialog, entri Kitab yang terbuka,
 * percakapan yang sudah selesai, dan pengaturan. Disimpan ke localStorage.
 */

import type { NilaiRombongan } from './party';
import type { StatusPagon } from './config';

export type UkuranHuruf = 'kecil' | 'sedang' | 'besar';

/** Titik simpan di awal segmen: cukup untuk memulai ulang segmen itu dengan keadaan yang sama. */
export interface TitikSimpan {
  segmen: string;
  rombongan: NilaiRombongan;
  tanda: string[];
  percakapan: string[];
  /** Detik permainan sejak misi mulai. */
  waktu: number;
}

/** Hasil misi 3 yang disimpan sebagai tanda untuk misi 4. */
export interface HasilMisi {
  pengikutTiba: number;
  pagon: StatusPagon;
  rute: string | null;
  kewaspadaanDaha: number;
  kaliKetahuan: number;
  waktu: number;
}

interface DataSimpanan {
  tanda: string[];
  kitab: string[];
  percakapan: string[];
  pengaturan: { ukuranHuruf: UkuranHuruf };
  titikSimpan?: TitikSimpan | null;
  hasilMisi3?: HasilMisi | null;
}

const KUNCI_SIMPAN = 'nusantara.status';

export class StatusPermainan {
  readonly tanda = new Set<string>();
  /** Id entri Kitab yang terbuka, urut sesuai waktu terbuka. */
  readonly kitab: string[] = [];
  readonly percakapanSelesai = new Set<string>();
  pengaturan: { ukuranHuruf: UkuranHuruf } = { ukuranHuruf: 'sedang' };
  /** Titik simpan segmen terakhir; null kalau tidak ada misi yang sedang berjalan. */
  titikSimpan: TitikSimpan | null = null;
  /** Hasil misi 3 terakhir yang selesai, untuk misi 4. */
  hasilMisi3: HasilMisi | null = null;
  /** Dipanggil saat entri Kitab baru terbuka (untuk pemberitahuan). */
  saatKitabTerbuka: ((id: string) => void) | null = null;
  /** Dipanggil saat tanda baru (belum pernah ada) disimpan; rombongan menerapkan aturannya. */
  saatTanda: ((tanda: string) => void) | null = null;

  constructor() {
    this.muat();
  }

  kitabTerbuka(id: string): boolean {
    return this.kitab.includes(id);
  }

  /** Membuka entri; benar kalau entri itu baru terbuka sekarang. */
  bukaKitab(id: string): boolean {
    if (this.kitab.includes(id)) return false;
    this.kitab.push(id);
    this.simpan();
    this.saatKitabTerbuka?.(id);
    return true;
  }

  tandai(tanda: string): void {
    const baru = !this.tanda.has(tanda);
    this.tanda.add(tanda);
    this.simpan();
    if (import.meta.env.DEV) console.log(`[status] tanda: ${tanda}`, [...this.tanda]);
    if (baru) this.saatTanda?.(tanda);
  }

  selesaikanPercakapan(id: string): void {
    this.percakapanSelesai.add(id);
    this.simpan();
  }

  simpanTitik(titik: TitikSimpan): void {
    this.titikSimpan = titik;
    this.simpan();
  }

  /** Mengembalikan tanda dan percakapan ke isi titik simpan (tanpa memanggil `saatTanda`). */
  pulihkanDariTitik(titik: TitikSimpan): void {
    this.tanda.clear();
    for (const t of titik.tanda) this.tanda.add(t);
    this.percakapanSelesai.clear();
    for (const p of titik.percakapan) this.percakapanSelesai.add(p);
    this.simpan();
  }

  /** Misi selesai: hasilnya disimpan sebagai tanda untuk misi berikutnya, titik simpan dihapus. */
  selesaikanMisi(hasil: HasilMisi): void {
    this.hasilMisi3 = hasil;
    this.titikSimpan = null;
    this.simpan();
  }

  aturUkuranHuruf(ukuran: UkuranHuruf): void {
    this.pengaturan.ukuranHuruf = ukuran;
    this.simpan();
  }

  /** Mengulang misi: tanda, percakapan, dan titik simpan dihapus; entri Kitab, hasil misi, dan pengaturan tetap. */
  ulangMisi(): void {
    this.tanda.clear();
    this.percakapanSelesai.clear();
    this.titikSimpan = null;
    this.simpan();
  }

  /** Menghapus seluruh simpanan (permainan baru). */
  reset(): void {
    this.tanda.clear();
    this.kitab.length = 0;
    this.percakapanSelesai.clear();
    this.pengaturan = { ukuranHuruf: 'sedang' };
    this.titikSimpan = null;
    this.hasilMisi3 = null;
    try {
      localStorage.removeItem(KUNCI_SIMPAN);
    } catch {
      /* localStorage tidak tersedia */
    }
  }

  private simpan(): void {
    const data: DataSimpanan = {
      tanda: [...this.tanda],
      kitab: [...this.kitab],
      percakapan: [...this.percakapanSelesai],
      pengaturan: this.pengaturan,
      titikSimpan: this.titikSimpan,
      hasilMisi3: this.hasilMisi3,
    };
    try {
      localStorage.setItem(KUNCI_SIMPAN, JSON.stringify(data));
    } catch {
      /* localStorage tidak tersedia (mis. mode privat); status hanya hidup selama sesi */
    }
  }

  private muat(): void {
    let mentah: string | null = null;
    try {
      mentah = localStorage.getItem(KUNCI_SIMPAN);
    } catch {
      return;
    }
    if (!mentah) return;
    try {
      const data = JSON.parse(mentah) as Partial<DataSimpanan>;
      for (const t of data.tanda ?? []) this.tanda.add(t);
      for (const k of data.kitab ?? []) if (!this.kitab.includes(k)) this.kitab.push(k);
      for (const p of data.percakapan ?? []) this.percakapanSelesai.add(p);
      const u = data.pengaturan?.ukuranHuruf;
      if (u === 'kecil' || u === 'sedang' || u === 'besar') this.pengaturan.ukuranHuruf = u;
      if (data.titikSimpan && typeof data.titikSimpan.segmen === 'string') this.titikSimpan = data.titikSimpan;
      if (data.hasilMisi3) this.hasilMisi3 = data.hasilMisi3;
    } catch {
      console.warn('[status] simpanan rusak, mulai dari kosong');
    }
  }
}
