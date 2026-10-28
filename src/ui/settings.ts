import type { StatusPermainan, Kualitas } from '../mission/state';
import { UI } from './config';
import { buatPilihanUkuran } from './font-size';
import data from '../data/settings.json';

/** Angka pengaturan (kualitas, rentang kepekaan, pemilihan otomatis). Ubah di src/data/settings.json. */
export const PENGATURAN = data;
const KUALITAS: readonly Kualitas[] = ['rendah', 'sedang', 'tinggi'];

/** Halaman pengaturan di menu jeda: ukuran huruf, kepekaan mouse dan stik, balik Y, kualitas. */
export function buatPengaturan(status: StatusPermainan): HTMLDivElement {
  const wadah = document.createElement('div');
  wadah.className = 'pengaturan';
  wadah.append(buatPilihanUkuran(status));

  const geser = (label: string, kunci: 'kepekaanMouse' | 'kepekaanStik'): HTMLDivElement => {
    const baris = document.createElement('div');
    baris.className = 'pengaturan-baris';
    const teks = document.createElement('span');
    teks.className = 'pengaturan-label';
    const nilai = document.createElement('span');
    nilai.className = 'pengaturan-nilai';
    const masukan = document.createElement('input');
    masukan.type = 'range';
    masukan.min = String(PENGATURAN.kepekaan.min);
    masukan.max = String(PENGATURAN.kepekaan.maks);
    masukan.step = String(PENGATURAN.kepekaan.langkah);
    masukan.value = String(status.pengaturan[kunci]);
    masukan.tabIndex = -1;
    const segarkan = () => {
      nilai.textContent = `${Number(masukan.value).toFixed(1)}x`;
    };
    masukan.addEventListener('input', () => {
      status.aturPengaturan({ [kunci]: Number(masukan.value) });
      segarkan();
    });
    teks.textContent = label;
    segarkan();
    baris.append(teks, masukan, nilai);
    return baris;
  };
  wadah.append(geser(UI.pengaturan.kepekaanMouse, 'kepekaanMouse'), geser(UI.pengaturan.kepekaanStik, 'kepekaanStik'));

  const barisY = document.createElement('label');
  barisY.className = 'pengaturan-baris';
  const kotakY = document.createElement('input');
  kotakY.type = 'checkbox';
  kotakY.checked = status.pengaturan.balikY;
  kotakY.tabIndex = -1;
  kotakY.addEventListener('change', () => status.aturPengaturan({ balikY: kotakY.checked }));
  const teksY = document.createElement('span');
  teksY.className = 'pengaturan-label';
  teksY.textContent = UI.pengaturan.balikY;
  barisY.append(teksY, kotakY);
  wadah.append(barisY);

  const barisK = document.createElement('div');
  barisK.className = 'pilihan-ukuran';
  const labelK = document.createElement('span');
  labelK.className = 'pilihan-ukuran-label';
  labelK.textContent = UI.pengaturan.kualitas;
  barisK.append(labelK);
  const tombolK: HTMLButtonElement[] = [];
  const segarkanK = () => {
    for (const [i, t] of tombolK.entries()) t.classList.toggle('aktif', KUALITAS[i] === status.pengaturan.kualitas);
  };
  for (const k of KUALITAS) {
    const t = document.createElement('button');
    t.className = 'pilihan-ukuran-tombol';
    t.tabIndex = -1;
    t.textContent = UI.pengaturan.kualitasPilihan[k];
    t.addEventListener('click', (e) => {
      e.stopPropagation();
      status.aturPengaturan({ kualitas: k });
      segarkanK();
    });
    tombolK.push(t);
    barisK.append(t);
  }
  document.addEventListener('pengaturan-berubah', segarkanK);
  segarkanK();
  wadah.append(barisK);
  const catatan = document.createElement('div');
  catatan.className = 'menu-catatan';
  catatan.textContent = UI.pengaturan.kualitasOtomatis;
  wadah.append(catatan);
  return wadah;
}

/** Memilih kualitas dari fps rata-rata: di bawah fpsRendah → rendah, di bawah fpsTinggi → sedang, selain itu tinggi. */
export function kualitasDariFps(fps: number): Kualitas {
  const o = PENGATURAN.otomatis;
  return fps < o.fpsRendah ? 'rendah' : fps < o.fpsTinggi ? 'sedang' : 'tinggi';
}
