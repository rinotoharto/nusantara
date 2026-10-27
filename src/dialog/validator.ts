import { DIALOG, NADA_SAH, type Percakapan } from './config';
import { KITAB_PER_ID } from '../codex/config';
import { idIstilah } from './teks';

/** Memeriksa satu percakapan; mengembalikan daftar pesan masalah (kosong kalau sehat). */
export function validasiPercakapan(id: string, p: Percakapan): string[] {
  const pesan: string[] = [];
  const awalan = `dialog "${id}"`;
  if (!p.simpul[p.mulai]) pesan.push(`${awalan}: simpul mulai "${p.mulai}" tidak ada`);
  for (const [idSimpul, s] of Object.entries(p.simpul)) {
    const nama = `${awalan} simpul "${idSimpul}"`;
    if (!p.tokoh[s.tokoh]) pesan.push(`${nama}: tokoh "${s.tokoh}" tidak ada di daftar tokoh`);
    if (s.lanjut !== undefined && !p.simpul[s.lanjut]) pesan.push(`${nama}: lanjut "${s.lanjut}" tidak ada`);
    if (!s.pilihan && !s.selesai && s.lanjut === undefined) pesan.push(`${nama}: tidak punya lanjut, pilihan, maupun selesai`);
    if (s.teks === undefined && !s.pilihan) pesan.push(`${nama}: tidak punya teks maupun pilihan`);
    for (const k of idIstilah(s.teks ?? '')) {
      if (!KITAB_PER_ID.has(k)) pesan.push(`${nama}: istilah merujuk entri Kitab "${k}" yang tidak ada`);
    }
    for (const k of s.bukaKitab ?? []) {
      if (!KITAB_PER_ID.has(k)) pesan.push(`${nama}: bukaKitab "${k}" tidak ada di codex`);
    }
    for (const [i, pil] of (s.pilihan ?? []).entries()) {
      if (!NADA_SAH.includes(pil.nada)) pesan.push(`${nama} pilihan ${i + 1}: nada "${pil.nada}" tidak sah`);
      if (!p.simpul[pil.lanjut]) pesan.push(`${nama} pilihan ${i + 1}: lanjut "${pil.lanjut}" tidak ada`);
      for (const k of idIstilah(pil.teks)) {
        if (!KITAB_PER_ID.has(k)) pesan.push(`${nama} pilihan ${i + 1}: istilah merujuk entri Kitab "${k}" yang tidak ada`);
      }
    }
  }
  return pesan;
}

/** Memeriksa seluruh dialog.json. */
export function validasiDialog(): string[] {
  const pesan: string[] = [];
  for (const [id, p] of Object.entries(DIALOG)) pesan.push(...validasiPercakapan(id, p));
  return pesan;
}
