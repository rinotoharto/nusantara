/** Subtitle kecil di bawah layar untuk ucapan singkat di luar dialog (misalnya Nambi menunjuk jalan). */
export class Subtitle {
  private readonly el: HTMLDivElement;
  private readonly namaEl: HTMLSpanElement;
  private readonly teksEl: HTMLSpanElement;
  private sisa = 0;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'hud subtitle';
    this.namaEl = document.createElement('span');
    this.namaEl.className = 'subtitle-nama';
    this.teksEl = document.createElement('span');
    this.el.append(this.namaEl, this.teksEl);
    document.body.append(this.el);
  }

  tampilkan(nama: string, teks: string, lama: number): void {
    this.namaEl.textContent = nama ? `${nama}: ` : '';
    this.teksEl.textContent = teks;
    this.sisa = lama;
    this.el.classList.add('tampil');
  }

  perbarui(dt: number): void {
    if (this.sisa <= 0) return;
    this.sisa -= dt;
    if (this.sisa <= 0) this.el.classList.remove('tampil');
  }
}
