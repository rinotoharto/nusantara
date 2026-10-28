import data from '../data/misi1.json';
import { KITAB_PER_ID, LABEL_SAH, type LabelEntri } from '../codex/config';

/** Satu panel prolog: gambar (belum ada selama prototipe), narasi, label sumber, dan entri Kitab yang dibuka. */
export interface PanelProlog {
  id: string;
  /** Kunci gaya gambar (`jawa`, `mongol`); namanya ada di `DataProlog.gaya`. */
  gaya: string;
  gambar: string | null;
  lapisan: number;
  gerak: string;
  /** Perkiraan durasi narasi bersuara (detik); belum dipakai selama teks diketik. */
  durasi: number;
  narasi: string;
  label: LabelEntri;
  sumber: string;
  bukaKitab: string[];
}

export interface DataProlog {
  jenis: string;
  judul: string;
  /** Tombol "Lewati prolog" muncul mulai panel ke-n (dihitung dari 1). */
  bolehLewatiSetelah: number;
  /** Nama gaya gambar untuk placeholder, misalnya jawa → "relief". */
  gaya: Record<string, string>;
  panel: PanelProlog[];
  penutup: { teks: string; lamaTeks: number; lanjutKe: string };
}

/** Seluruh data prolog (misi 1) dari src/data/misi1.json. */
export const PROLOG: DataProlog = data as unknown as DataProlog;

/** Tujuan `penutup.lanjutKe` yang dikenal kode. */
export const TUJUAN_PROLOG: readonly string[] = ['misi3'];

/** Memeriksa misi1.json: label, id Kitab, batas lewati, dan tujuan penutup. Mengembalikan daftar pesan masalah. */
export function validasiProlog(): string[] {
  const pesan: string[] = [];
  const terlihat = new Set<string>();
  if (PROLOG.panel.length === 0) pesan.push('prolog: tidak ada panel');
  PROLOG.panel.forEach((p, i) => {
    const nama = `prolog panel ${i + 1} "${p.id}"`;
    if (terlihat.has(p.id)) pesan.push(`${nama}: id ganda`);
    terlihat.add(p.id);
    if (!p.narasi) pesan.push(`${nama}: narasi kosong`);
    if (!LABEL_SAH.includes(p.label)) pesan.push(`${nama}: label "${p.label}" tidak dikenal`);
    if (!PROLOG.gaya[p.gaya]) pesan.push(`${nama}: gaya "${p.gaya}" tidak ada di daftar gaya`);
    for (const id of p.bukaKitab) if (!KITAB_PER_ID.has(id)) pesan.push(`${nama}: entri Kitab "${id}" tidak ada`);
  });
  if (PROLOG.bolehLewatiSetelah < 1 || PROLOG.bolehLewatiSetelah > PROLOG.panel.length) {
    pesan.push(`prolog: bolehLewatiSetelah ${PROLOG.bolehLewatiSetelah} di luar jumlah panel`);
  }
  if (!TUJUAN_PROLOG.includes(PROLOG.penutup.lanjutKe)) pesan.push(`prolog: penutup.lanjutKe "${PROLOG.penutup.lanjutKe}" tidak dikenal`);
  return pesan;
}
