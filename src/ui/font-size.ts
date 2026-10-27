import type { StatusPermainan, UkuranHuruf } from '../mission/state';
import { UI } from './config';

const UKURAN: readonly UkuranHuruf[] = ['kecil', 'sedang', 'besar'];

/** Menerapkan ukuran huruf ke body (kelas huruf-kecil, huruf-sedang, huruf-besar). */
export function terapkanUkuranHuruf(ukuran: UkuranHuruf): void {
  for (const u of UKURAN) document.body.classList.toggle(`huruf-${u}`, u === ukuran);
}

/** Baris tiga tombol ukuran huruf; pilihan tersimpan ke status. Semua salinan saling sinkron lewat body. */
export function buatPilihanUkuran(status: StatusPermainan): HTMLDivElement {
  const baris = document.createElement('div');
  baris.className = 'pilihan-ukuran';
  const label = document.createElement('span');
  label.className = 'pilihan-ukuran-label';
  label.textContent = UI.pengaturan.ukuranHuruf;
  baris.append(label);
  const tombol: HTMLButtonElement[] = [];
  const segarkan = (): void => {
    for (const [i, t] of tombol.entries()) t.classList.toggle('aktif', UKURAN[i] === status.pengaturan.ukuranHuruf);
  };
  for (const u of UKURAN) {
    const t = document.createElement('button');
    t.className = 'pilihan-ukuran-tombol';
    t.tabIndex = -1;
    t.textContent = UI.pengaturan.ukuran[u];
    t.addEventListener('click', (e) => {
      e.stopPropagation();
      status.aturUkuranHuruf(u);
      terapkanUkuranHuruf(u);
      document.dispatchEvent(new Event('ukuran-huruf-berubah'));
    });
    tombol.push(t);
    baris.append(t);
  }
  document.addEventListener('ukuran-huruf-berubah', segarkan);
  segarkan();
  return baris;
}
