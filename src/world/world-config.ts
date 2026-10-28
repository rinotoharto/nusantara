import data from '../data/misi3.json';

/** Tata letak dunia dari misi3.json bagian `dunia`: ukuran, sungai, bukit, hutan, jalan. Angka diubah di data, bukan di kode. */
export type TataLetakDunia = typeof data.dunia;
export const DUNIA: TataLetakDunia = data.dunia;
export type Titik2 = [number, number];
