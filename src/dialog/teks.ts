/** Pengolah teks dialog: istilah `[[istilah|id]]` dan pemotongan halaman. */

export interface PotonganTeks {
  teks: string;
  /** Id entri Kitab kalau potongan ini istilah yang bisa diklik. */
  kitab?: string;
}

const POLA_ISTILAH = /\[\[([^\]|]+)\|([^\]]+)\]\]/g;

/** Memecah teks menjadi potongan biasa dan istilah. */
export function pecahIstilah(teks: string): PotonganTeks[] {
  const hasil: PotonganTeks[] = [];
  let akhir = 0;
  for (const m of teks.matchAll(POLA_ISTILAH)) {
    const mulai = m.index ?? 0;
    if (mulai > akhir) hasil.push({ teks: teks.slice(akhir, mulai) });
    hasil.push({ teks: m[1], kitab: m[2].trim() });
    akhir = mulai + m[0].length;
  }
  if (akhir < teks.length) hasil.push({ teks: teks.slice(akhir) });
  return hasil;
}

/** Id Kitab yang dirujuk istilah di dalam teks. */
export function idIstilah(teks: string): string[] {
  return [...teks.matchAll(POLA_ISTILAH)].map((m) => m[2].trim());
}

/** Teks tanpa tanda istilah, untuk menghitung panjang yang terlihat. */
export function teksPolos(teks: string): string {
  return teks.replace(POLA_ISTILAH, '$1');
}

/**
 * Memotong teks per kalimat menjadi halaman yang panjang terlihatnya paling banyak `maks` karakter.
 * Satu kalimat yang lebih panjang dari `maks` tetap utuh di halamannya sendiri.
 */
export function pecahHalaman(teks: string, maks: number): string[] {
  const kalimat = teks.trim().split(/(?<=[.!?…])\s+/).filter((k) => k.length > 0);
  const halaman: string[] = [];
  let sekarang = '';
  for (const k of kalimat) {
    const gabung = sekarang ? `${sekarang} ${k}` : k;
    if (sekarang && teksPolos(gabung).length > maks) {
      halaman.push(sekarang);
      sekarang = k;
    } else {
      sekarang = gabung;
    }
  }
  if (sekarang) halaman.push(sekarang);
  return halaman.length > 0 ? halaman : [''];
}
