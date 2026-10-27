import { UI } from './config';

/** Layar awal: judul, nama misi, tombol Mulai baru, Lanjutkan (kalau ada simpanan), dan Kitab. */
export class LayarJudul {
  private readonly lapis: HTMLDivElement;
  private readonly tombolLanjutkan: HTMLButtonElement;
  saatMulaiBaru: (() => void) | null = null;
  saatLanjutkan: (() => void) | null = null;
  saatKitab: (() => void) | null = null;

  constructor() {
    this.lapis = document.createElement('div');
    this.lapis.className = 'judul-lapis';
    const kotak = document.createElement('div');
    kotak.className = 'judul';
    const judul = document.createElement('div');
    judul.className = 'judul-utama';
    judul.textContent = UI.judul.judul;
    const sub = document.createElement('div');
    sub.className = 'judul-sub';
    sub.textContent = UI.judul.subjudul;
    const catatan = document.createElement('div');
    catatan.className = 'judul-catatan';
    catatan.textContent = UI.judul.prototipe;
    this.tombolLanjutkan = this.tombol(UI.judul.lanjutkan, () => this.saatLanjutkan?.());
    kotak.append(
      judul,
      sub,
      this.tombol(UI.judul.mulaiBaru, () => this.saatMulaiBaru?.()),
      this.tombolLanjutkan,
      this.tombol(UI.judul.kitab, () => this.saatKitab?.()),
      catatan,
    );
    this.lapis.append(kotak);
    document.body.append(this.lapis);
  }

  buka(adaSimpanan: boolean): void {
    this.tombolLanjutkan.style.display = adaSimpanan ? 'block' : 'none';
    this.lapis.classList.add('tampil');
  }

  tutup(): void {
    this.lapis.classList.remove('tampil');
  }

  private tombol(teks: string, aksi: () => void): HTMLButtonElement {
    const t = document.createElement('button');
    t.className = 'menu-tombol judul-tombol';
    t.tabIndex = -1;
    t.textContent = teks;
    t.addEventListener('click', aksi);
    return t;
  }
}
