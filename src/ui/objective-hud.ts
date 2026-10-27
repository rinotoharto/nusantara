import { UI } from './config';

/** Tujuan segmen sekarang di kiri atas, teks singkat; berganti dengan kedipan pendek. */
export class HudTujuan {
  private readonly el: HTMLDivElement;
  private readonly teksEl: HTMLSpanElement;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'hud hud-tujuan';
    const label = document.createElement('span');
    label.className = 'hud-tujuan-label';
    label.textContent = UI.misi.tujuan;
    this.teksEl = document.createElement('span');
    this.teksEl.className = 'hud-tujuan-teks';
    this.el.append(label, this.teksEl);
    this.el.style.display = 'none';
    document.body.append(this.el);
  }

  /** Mengganti teks tujuan; string kosong menyembunyikan HUD. */
  atur(teks: string): void {
    this.el.style.display = teks ? 'flex' : 'none';
    if (this.teksEl.textContent === teks) return;
    this.teksEl.textContent = teks;
    this.el.classList.remove('baru');
    void this.el.offsetWidth;
    this.el.classList.add('baru');
  }
}
