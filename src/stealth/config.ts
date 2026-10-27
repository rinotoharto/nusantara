import data from '../data/stealth.json';

/** Angka menyelinap: pandangan penjaga, curiga, jongkok. Ubah di src/data/stealth.json. */
export type KonfigurasiSiluman = typeof data;
export const SILUMAN: KonfigurasiSiluman = data;
