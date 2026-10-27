import data from '../data/combat.json';

/** Angka keseimbangan pertarungan. Ubah di src/data/combat.json, bukan di kode. */
export type KonfigurasiPertarungan = typeof data;
export const KONFIG: KonfigurasiPertarungan = data;
