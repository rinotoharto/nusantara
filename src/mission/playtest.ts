import data from '../data/playtest.json';
import type { HasilMisi } from './state';
import type { HasilProlog } from './panels';

const PLAYTEST = data as { parameter: string; kunciSimpan: string; namaBerkas: string; maksSesi: number; versi: number };

/** Satu segmen yang dimasuki pemain; `lama` dihitung saat segmen berikutnya mulai atau misi selesai. */
interface CatatanSegmen {
  id: string;
  mulai: number;
  selesai: number | null;
  lama: number | null;
  ketahuan: number;
  gugur: number;
}

interface Kejadian {
  t: number;
  segmen: string;
  x?: number;
  z?: number;
}

export interface SesiPlaytest {
  versi: number;
  mulaiPada: string;
  selesaiPada: string | null;
  /** Benar kalau sesi diteruskan dari titik simpan (tombol Lanjutkan), bukan Mulai baru. */
  dilanjutkan: boolean;
  peramban: string;
  segmen: CatatanSegmen[];
  ketahuan: Kejadian[];
  gugur: Kejadian[];
  pilihanDialog: { t: number; segmen: string; percakapan: string; simpul: string; indeks: number; nada: string }[];
  /** Berapa kali pemandu dipakai: kunang (Tab), peta (M), nambi (petunjuk otomatis). */
  petunjuk: { kunang: number; peta: number; nambi: number };
  petunjukKejadian: (Kejadian & { jenis: 'kunang' | 'peta' | 'nambi' })[];
  /** Entri Kitab: kapan terbuka (detik misi) dan berapa detik dibaca di layar Kitab. */
  kitab: { id: string; terbukaPada: number | null; dibaca: number }[];
  /** Sergap (perbaikan 1): berapa kali berhasil dan berapa di antaranya dipergoki penjaga lain, beserta tempatnya. */
  sergap: { jumlah: number; ketahuan: number };
  sergapKejadian: (Kejadian & { ketahuan: boolean })[];
  /** Prolog: lama (detik nyata), dilewati atau tidak, dan di panel ke berapa; null kalau tidak diputar di sesi ini. */
  prolog: HasilProlog | null;
  hasil: HasilMisi | null;
}

interface Simpanan {
  versi: number;
  sesi: SesiPlaytest[];
}

/**
 * Catatan playtest: merekam waktu per segmen, ketahuan, gugur, pilihan dialog, pemakaian pemandu,
 * dan pembacaan Kitab ke localStorage. Hanya aktif kalau URL memuat `?playtest=1`; di luar itu
 * semua metode tidak berbuat apa-apa.
 */
export class CatatanPlaytest {
  readonly aktif: boolean;
  private simpanan: Simpanan = { versi: PLAYTEST.versi, sesi: [] };

  /** `waktu` mengembalikan detik misi sekarang (waktuMisi di main.ts). */
  constructor(private readonly waktu: () => number) {
    this.aktif = new URLSearchParams(window.location.search).get(PLAYTEST.parameter) === '1';
    if (!this.aktif) return;
    try {
      const mentah = localStorage.getItem(PLAYTEST.kunciSimpan);
      if (mentah) {
        const s = JSON.parse(mentah) as Simpanan;
        if (s.versi === PLAYTEST.versi && Array.isArray(s.sesi)) this.simpanan = s;
      }
    } catch (e) {
      console.warn('[playtest] catatan lama tidak terbaca, mulai kosong', e);
    }
  }

  private get sesi(): SesiPlaytest | null {
    return this.simpanan.sesi[this.simpanan.sesi.length - 1] ?? null;
  }

  private get segmenSekarang(): CatatanSegmen | null {
    const s = this.sesi;
    return s ? (s.segmen[s.segmen.length - 1] ?? null) : null;
  }

  get jumlahSesi(): number {
    return this.simpanan.sesi.length;
  }

  /** Mulai baru: sesi baru. Lanjutkan: sesi terakhir diteruskan kalau belum selesai, kalau tidak sesi baru bertanda dilanjutkan. */
  mulaiSesi(dilanjutkan = false): void {
    if (!this.aktif) return;
    const s = this.sesi;
    if (dilanjutkan && s && !s.selesaiPada) return;
    this.simpanan.sesi.push({
      versi: PLAYTEST.versi,
      mulaiPada: new Date().toISOString(),
      selesaiPada: null,
      dilanjutkan,
      peramban: navigator.userAgent,
      segmen: [],
      ketahuan: [],
      gugur: [],
      pilihanDialog: [],
      petunjuk: { kunang: 0, peta: 0, nambi: 0 },
      petunjukKejadian: [],
      kitab: [],
      sergap: { jumlah: 0, ketahuan: 0 },
      sergapKejadian: [],
      prolog: null,
      hasil: null,
    });
    while (this.simpanan.sesi.length > PLAYTEST.maksSesi) this.simpanan.sesi.shift();
    this.simpan();
  }

  /** Segmen mulai (juga saat diulang setelah gugur: segmen yang sama tidak dicatat dua kali). */
  masukSegmen(id: string): void {
    const s = this.sesi;
    if (!s) return;
    const t = this.waktu();
    const lama = this.segmenSekarang;
    if (lama && lama.id === id && lama.selesai === null) return;
    if (lama && lama.selesai === null) this.tutupSegmen(lama, t);
    s.segmen.push({ id, mulai: this.bulat(t), selesai: null, lama: null, ketahuan: 0, gugur: 0 });
    this.simpan();
  }

  selesaiMisi(hasil: HasilMisi): void {
    const s = this.sesi;
    if (!s) return;
    const t = this.waktu();
    const seg = this.segmenSekarang;
    if (seg && seg.selesai === null) this.tutupSegmen(seg, t);
    s.hasil = hasil;
    s.selesaiPada = new Date().toISOString();
    this.simpan();
  }

  ketahuan(x: number, z: number): void {
    const s = this.sesi;
    const seg = this.segmenSekarang;
    if (!s || !seg) return;
    seg.ketahuan += 1;
    s.ketahuan.push(this.kejadian(seg, x, z));
    this.simpan();
  }

  gugur(x: number, z: number): void {
    const s = this.sesi;
    const seg = this.segmenSekarang;
    if (!s || !seg) return;
    seg.gugur += 1;
    s.gugur.push(this.kejadian(seg, x, z));
    this.simpan();
  }

  pilihanDialog(percakapan: string, simpul: string, indeks: number, nada: string): void {
    const s = this.sesi;
    if (!s) return;
    s.pilihanDialog.push({ t: this.bulat(this.waktu()), segmen: this.segmenSekarang?.id ?? '', percakapan, simpul, indeks, nada });
    this.simpan();
  }

  petunjuk(jenis: 'kunang' | 'peta' | 'nambi', x: number, z: number): void {
    const s = this.sesi;
    if (!s) return;
    s.petunjuk[jenis] += 1;
    s.petunjukKejadian.push({ jenis, ...this.kejadian(this.segmenSekarang, x, z) });
    this.simpan();
  }

  /** Sergap berhasil di (x, z); `ketahuan` benar kalau ada penjaga lain yang memergokinya. */
  sergap(x: number, z: number, ketahuan: boolean): void {
    const s = this.sesi;
    if (!s) return;
    s.sergap ??= { jumlah: 0, ketahuan: 0 };
    s.sergapKejadian ??= [];
    s.sergap.jumlah += 1;
    if (ketahuan) s.sergap.ketahuan += 1;
    s.sergapKejadian.push({ ...this.kejadian(this.segmenSekarang, x, z), ketahuan });
    this.simpan();
  }

  /** Sergap terakhir ternyata dipergoki penjaga lain beberapa frame kemudian (masih dalam 1 detik pelaksanaan). */
  sergapDipergoki(): void {
    const s = this.sesi;
    const akhir = s?.sergapKejadian?.[s.sergapKejadian.length - 1];
    if (!s || !akhir || akhir.ketahuan) return;
    akhir.ketahuan = true;
    s.sergap.ketahuan += 1;
    this.simpan();
  }

  kitabTerbuka(id: string): void {
    const s = this.sesi;
    if (!s) return;
    this.entriKitab(s, id).terbukaPada = this.bulat(this.waktu());
    this.simpan();
  }

  /** Entri `id` selesai dibaca selama `detik` (Kitab ditutup atau entri lain dipilih). */
  kitabDibaca(id: string, detik: number): void {
    const s = this.sesi;
    if (!s || detik < 0.5) return;
    const e = this.entriKitab(s, id);
    e.dibaca = this.bulat(e.dibaca + detik);
    this.simpan();
  }

  /** Prolog selesai atau dilewati (hanya sesi yang sedang berjalan). */
  prolog(hasil: HasilProlog): void {
    const s = this.sesi;
    if (!s) return;
    s.prolog = hasil;
    this.simpan();
  }

  /** Mengunduh semua sesi tersimpan sebagai satu berkas JSON. */
  unduh(): void {
    if (!this.aktif) return;
    const isi = JSON.stringify(this.simpanan, null, 2);
    const blob = new Blob([isi], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const tanggal = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    a.href = url;
    a.download = `${PLAYTEST.namaBerkas}-${tanggal}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /** Salinan simpanan, untuk pengujian. */
  get isi(): Simpanan {
    return JSON.parse(JSON.stringify(this.simpanan)) as Simpanan;
  }

  private tutupSegmen(seg: CatatanSegmen, t: number): void {
    seg.selesai = this.bulat(t);
    seg.lama = this.bulat(Math.max(0, t - seg.mulai));
  }

  private entriKitab(s: SesiPlaytest, id: string): SesiPlaytest['kitab'][number] {
    let e = s.kitab.find((k) => k.id === id);
    if (!e) {
      e = { id, terbukaPada: null, dibaca: 0 };
      s.kitab.push(e);
    }
    return e;
  }

  private kejadian(seg: CatatanSegmen | null, x: number, z: number): Kejadian {
    return { t: this.bulat(this.waktu()), segmen: seg?.id ?? '', x: this.bulat(x), z: this.bulat(z) };
  }

  private bulat(n: number): number {
    return Math.round(n * 10) / 10;
  }

  private simpan(): void {
    if (!this.aktif) return;
    try {
      localStorage.setItem(PLAYTEST.kunciSimpan, JSON.stringify(this.simpanan));
    } catch (e) {
      console.warn('[playtest] gagal menyimpan catatan', e);
    }
  }
}
