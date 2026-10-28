import type { StatusPermainan } from '../mission/state';
import { UI } from './config';
import { buatPilihanUkuran } from './font-size';

/** Menu jeda: Lanjutkan, Kitab, Peta, Pengaturan (ukuran huruf), Mulai ulang misi. */
export class MenuJeda {
  private readonly lapis: HTMLDivElement;
  private readonly utama: HTMLDivElement;
  private readonly pengaturan: HTMLDivElement;
  private tampil = false;
  saatLanjutkan: (() => void) | null = null;
  saatKitab: (() => void) | null = null;
  saatPeta: (() => void) | null = null;
  saatUlangMisi: (() => void) | null = null;

  constructor(status: StatusPermainan) {
    this.lapis = document.createElement('div');
    this.lapis.className = 'menu-lapis';
    const kotak = document.createElement('div');
    kotak.className = 'menu';

    this.utama = document.createElement('div');
    this.utama.className = 'menu-halaman';
    const judul = document.createElement('div');
    judul.className = 'menu-judul';
    judul.textContent = UI.menu.judul;
    this.utama.append(
      judul,
      this.tombol(UI.menu.lanjutkan, () => this.saatLanjutkan?.()),
      this.tombol(UI.menu.kitab, () => this.saatKitab?.()),
      this.tombol(UI.menu.peta, () => this.saatPeta?.()),
      this.tombol(UI.menu.pengaturan, () => this.tampilkanPengaturan(true)),
      this.tombol(UI.menu.ulangMisi, () => this.saatUlangMisi?.()),
    );

    this.pengaturan = document.createElement('div');
    this.pengaturan.className = 'menu-halaman';
    this.pengaturan.style.display = 'none';
    const judulPengaturan = document.createElement('div');
    judulPengaturan.className = 'menu-judul';
    judulPengaturan.textContent = UI.pengaturan.judul;
    const subtitle = document.createElement('div');
    subtitle.className = 'menu-catatan';
    subtitle.textContent = UI.pengaturan.subtitle;
    this.pengaturan.append(
      judulPengaturan,
      buatPilihanUkuran(status),
      subtitle,
      this.tombol(UI.menu.kembali, () => this.tampilkanPengaturan(false)),
    );

    kotak.append(this.utama, this.pengaturan);
    this.lapis.append(kotak);
    document.body.append(this.lapis);
  }

  get aktif(): boolean {
    return this.tampil;
  }

  buka(): void {
    this.tampil = true;
    this.tampilkanPengaturan(false);
    this.lapis.classList.add('tampil');
  }

  tutup(): void {
    this.tampil = false;
    this.lapis.classList.remove('tampil');
  }

  private tampilkanPengaturan(ya: boolean): void {
    this.utama.style.display = ya ? 'none' : 'flex';
    this.pengaturan.style.display = ya ? 'flex' : 'none';
  }

  private tombol(teks: string, aksi: () => void): HTMLButtonElement {
    const t = document.createElement('button');
    t.className = 'menu-tombol';
    t.tabIndex = -1;
    t.textContent = teks;
    t.addEventListener('click', aksi);
    return t;
  }
}
