import data from '../data/codex.json';

export type JenisEntri = 'peristiwa' | 'tokoh' | 'tempat' | 'benda' | 'sumber' | 'istilah';
export type LabelEntri = 'fakta' | 'interpretasi' | 'legenda';

export interface Kutipan {
  teks: string;
  sumber: string;
}

export interface EntriKitab {
  id: string;
  judul: string;
  jenis: JenisEntri;
  label: LabelEntri;
  /** Satu kalimat untuk kartu istilah dan pemberitahuan. */
  ringkas: string;
  isi: string[];
  kutipan: Kutipan | null;
  sumber: string[];
  terkait: string[];
  /** Hanya catatan untuk penulis isi; pemicu sebenarnya ada di dialog.json dan misi3.json. */
  dibukaOleh?: string;
}

export const URUTAN_JENIS: readonly JenisEntri[] = ['peristiwa', 'tokoh', 'tempat', 'benda', 'sumber', 'istilah'];
export const LABEL_SAH: readonly LabelEntri[] = ['fakta', 'interpretasi', 'legenda'];

/** Semua entri Kitab dari src/data/codex.json, urutan seperti di berkas. */
export const KITAB: readonly EntriKitab[] = data.entri as EntriKitab[];

export const KITAB_PER_ID: ReadonlyMap<string, EntriKitab> = new Map(KITAB.map((e) => [e.id, e]));

/** Memeriksa codex.json: jenis, label, dan rujukan `terkait`. Mengembalikan daftar pesan masalah. */
export function validasiKitab(): string[] {
  const pesan: string[] = [];
  const terlihat = new Set<string>();
  for (const e of KITAB) {
    if (terlihat.has(e.id)) pesan.push(`codex: id ganda "${e.id}"`);
    terlihat.add(e.id);
    if (!URUTAN_JENIS.includes(e.jenis)) pesan.push(`codex "${e.id}": jenis "${e.jenis}" tidak dikenal`);
    if (!LABEL_SAH.includes(e.label)) pesan.push(`codex "${e.id}": label "${e.label}" tidak dikenal`);
    for (const t of e.terkait) {
      if (!KITAB_PER_ID.has(t)) pesan.push(`codex "${e.id}": terkait "${t}" tidak ada`);
    }
  }
  return pesan;
}
