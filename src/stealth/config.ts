import data from '../data/stealth.json';
import uji from '../data/stealth-uji.json';

/** Angka menyelinap: pandangan penjaga, curiga, jongkok. Ubah di src/data/stealth.json. */
export type KonfigurasiSiluman = typeof data;
export const SILUMAN: KonfigurasiSiluman = data;

/** Tata letak area uji: titik awal, tujuan, penjaga, batu, semak. Ubah di src/data/stealth-uji.json. */
export type AreaUji = typeof uji;
export const AREA_UJI: AreaUji = uji;
