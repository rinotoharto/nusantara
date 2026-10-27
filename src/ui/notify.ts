import { KITAB_PER_ID } from '../codex/config';
import { UI, isiPola } from './config';

/**
 * Kartu kecil di pojok kanan atas saat entri Kitab terbuka, 3 detik per entri,
 * satu per satu. Ditunda selama `tunda` benar (misalnya saat dialog).
 */
export class PemberitahuanKitab {
  private readonly el: HTMLDivElement;
  private readonly antrean: string[] = [];
  private sisa = 0;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'kitab-pemberitahuan';
    document.body.append(this.el);
  }

  tambah(id: string): void {
    this.antrean.push(id);
  }

  perbarui(dt: number, tunda: boolean): void {
    if (this.sisa > 0) {
      this.sisa -= dt;
      if (this.sisa <= 0) this.el.classList.remove('tampil');
      return;
    }
    if (tunda || this.antrean.length === 0) return;
    const id = this.antrean.shift() as string;
    const entri = KITAB_PER_ID.get(id);
    this.el.textContent = isiPola(UI.kitab.pemberitahuan, { judul: entri?.judul ?? id });
    this.el.classList.add('tampil');
    this.sisa = UI.kitab.lamaPemberitahuan;
  }
}
