import { UI } from './config';

/** Isi layar misi selesai; teks sejarah dan catatan dari misi3.json, ringkasan dari status pemain. */
export interface IsiSelesai {
  sejarah: string;
  kutipan: string;
  ringkasan: string[];
  catatan: string;
}

/** Layar misi selesai: ringkasan sejarah, ringkasan pemain, catatan bersumber, tombol Buka Kitab dan Main lagi. */
export class LayarSelesai {
  private readonly lapis: HTMLDivElement;
  private readonly sejarahEl: HTMLParagraphElement;
  private readonly kutipanEl: HTMLQuoteElement;
  private readonly ringkasanEl: HTMLUListElement;
  private readonly catatanEl: HTMLParagraphElement;
  saatKitab: (() => void) | null = null;
  saatMainLagi: (() => void) | null = null;
  /** Tombol unduh catatan playtest; hanya tampil di mode playtest. */
  saatUnduh: (() => void) | null = null;
  private readonly tombolUnduh: HTMLButtonElement;

  constructor() {
    this.lapis = document.createElement('div');
    this.lapis.className = 'selesai-lapis';
    const kotak = document.createElement('div');
    kotak.className = 'selesai';
    const judul = document.createElement('div');
    judul.className = 'selesai-judul';
    judul.textContent = UI.selesai.judul;
    this.sejarahEl = document.createElement('p');
    this.sejarahEl.className = 'selesai-sejarah';
    this.kutipanEl = document.createElement('blockquote');
    this.kutipanEl.className = 'selesai-kutipan';
    this.ringkasanEl = document.createElement('ul');
    this.ringkasanEl.className = 'selesai-ringkasan';
    this.catatanEl = document.createElement('p');
    this.catatanEl.className = 'selesai-catatan';
    const tombol = document.createElement('div');
    tombol.className = 'selesai-tombol';
    this.tombolUnduh = this.tombol(UI.selesai.unduhPlaytest, () => this.saatUnduh?.());
    this.tombolUnduh.hidden = true;
    tombol.append(this.tombol(UI.selesai.bukaKitab, () => this.saatKitab?.()), this.tombol(UI.selesai.mainLagi, () => this.saatMainLagi?.()), this.tombolUnduh);
    kotak.append(judul, this.sejarahEl, this.kutipanEl, this.ringkasanEl, this.catatanEl, tombol);
    this.lapis.append(kotak);
    document.body.append(this.lapis);
  }

  buka(isi: IsiSelesai): void {
    this.sejarahEl.textContent = isi.sejarah;
    this.kutipanEl.textContent = isi.kutipan;
    this.ringkasanEl.replaceChildren(
      ...isi.ringkasan.map((t) => {
        const li = document.createElement('li');
        li.textContent = t;
        return li;
      }),
    );
    this.catatanEl.textContent = isi.catatan;
    this.lapis.classList.add('tampil');
  }

  tutup(): void {
    this.lapis.classList.remove('tampil');
  }

  tampilkanUnduh(tampil: boolean): void {
    this.tombolUnduh.hidden = !tampil;
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
