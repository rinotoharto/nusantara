import data from '../data/guide.json';

/** Angka pemandu arah: arahan kamera, partikel pemandu, Nambi, peta. Ubah di src/data/guide.json. */
export type KonfigurasiPemandu = typeof data;
export const PEMANDU: KonfigurasiPemandu = data;
export type GayaPemandu = keyof typeof data.partikel.gaya;
