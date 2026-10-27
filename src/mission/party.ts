import { ATURAN, type AturanTanda, type StatusPagon } from './config';

/** Nilai variabel rombongan (lihat tabel "Variabel rombongan" di naskah misi 3). */
export interface NilaiRombongan {
  pengikut: number;
  perbekalan: number;
  pagon: StatusPagon;
  kewaspadaan: number;
  kaliKetahuan: number;
  /** Batas kecepatan lari sampai akhir misi; null = normal. */
  lajuLari: number | null;
}

/** Satu perubahan yang diumumkan ke HUD. Delta nol berarti variabel itu tidak berubah. */
export interface PerubahanRombongan {
  pengikut: number;
  perbekalan: number;
  pagon: StatusPagon | null;
  teks: string | null;
}

/**
 * Variabel rombongan Wijaya. Aturan perubahannya dibaca dari misi3.json bagian `aturan`:
 * tanda dialog dipetakan ke perubahan lewat `aturan.tanda`, ketahuan patroli lewat `aturan.ketahuan`.
 */
export class Rombongan {
  nilai: NilaiRombongan = Rombongan.nilaiAwal();
  /** Dipanggil tiap kali ada perubahan, untuk HUD. */
  saatBerubah: ((p: PerubahanRombongan) => void) | null = null;
  /** Berapa kali pengikut sudah gugur karena ketahuan saat membawa Gajah Pagon. */
  private gugurKarenaPagon = 0;

  static nilaiAwal(): NilaiRombongan {
    return { ...ATURAN.awal, lajuLari: null };
  }

  /** Kembali ke nilai awal misi. */
  reset(): void {
    this.nilai = Rombongan.nilaiAwal();
    this.gugurKarenaPagon = 0;
  }

  /** Salinan nilai untuk titik simpan. */
  salin(): NilaiRombongan {
    return { ...this.nilai };
  }

  pulihkan(nilai: NilaiRombongan): void {
    this.nilai = { ...nilai };
  }

  get pagonIkut(): boolean {
    return this.nilai.pagon === 'ikut';
  }

  /** Batas kecepatan pemain dan pengikut (m/s), atau null kalau normal. */
  get lajuMaks(): number | null {
    if (this.pagonIkut) return ATURAN.pagonIkut.lajuMaks;
    return this.nilai.lajuLari;
  }

  /** Pengali laju meteran curiga penjaga. */
  get pengaliCuriga(): number {
    return this.pagonIkut ? ATURAN.pagonIkut.pengaliCuriga : 1;
  }

  /** Jumlah penjaga di rute sungai: dasar + kewaspadaan, dibatasi maksimum. */
  get jumlahPenjagaSungai(): number {
    const a = ATURAN.penjagaSungai;
    return Math.min(a.maks, a.dasar + this.nilai.kewaspadaan);
  }

  /** Menerapkan tanda dialog; benar kalau tanda itu punya aturan. */
  terapkanTanda(tanda: string): boolean {
    const aturan = ATURAN.tanda[tanda];
    if (!aturan) return false;
    this.terapkan(aturan);
    return true;
  }

  /** Ketahuan patroli: kewaspadaan dan hitungan naik; membawa Gajah Pagon membuat seorang pengikut gugur. */
  ketahuan(): void {
    const a = ATURAN.ketahuan;
    const perubahan: AturanTanda = { kewaspadaan: a.kewaspadaan };
    this.nilai.kaliKetahuan += a.kaliKetahuan;
    if (this.pagonIkut && this.gugurKarenaPagon < a.maksPengikutJikaPagon) {
      this.gugurKarenaPagon += 1;
      perubahan.pengikut = a.pengikutJikaPagon;
      perubahan.teks = a.teks;
    }
    this.terapkan(perubahan);
  }

  private terapkan(a: AturanTanda): void {
    const n = this.nilai;
    const p: PerubahanRombongan = { pengikut: a.pengikut ?? 0, perbekalan: a.perbekalan ?? 0, pagon: null, teks: a.teks ?? null };
    n.pengikut += p.pengikut;
    n.perbekalan += p.perbekalan;
    n.kewaspadaan += a.kewaspadaan ?? 0;
    if (a.pagon && a.pagon !== n.pagon) {
      n.pagon = a.pagon;
      p.pagon = a.pagon;
    }
    if (a.lajuLari !== undefined) n.lajuLari = a.lajuLari;
    if (import.meta.env.DEV) console.log('[rombongan]', { ...n });
    this.saatBerubah?.(p);
  }
}
