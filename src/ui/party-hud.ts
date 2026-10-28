import type { Rombongan, PerubahanRombongan } from '../mission/party';
import { UI } from './config';

/**
 * HUD rombongan di kanan atas: jumlah Pengikut, ikon nasi bungkus sejumlah Perbekalan,
 * dan ikon Gajah Pagon selama ia ikut. Perubahan dikedipkan sebentar dan diumumkan
 * dengan teks kecil di bawahnya (dari misi3.json bagian `aturan`).
 */
export class HudRombongan {
  private readonly el: HTMLDivElement;
  private readonly pengikutEl: HTMLSpanElement;
  private readonly perbekalanEl: HTMLSpanElement;
  private readonly pagonEl: HTMLDivElement;
  private readonly teksEl: HTMLDivElement;
  private readonly antreanTeks: string[] = [];
  private sisaTeks = 0;

  constructor(private readonly rombongan: Rombongan) {
    this.el = document.createElement('div');
    this.el.className = 'hud hud-rombongan';

    const barisPengikut = this.baris(UI.rombongan.pengikut);
    this.pengikutEl = document.createElement('span');
    this.pengikutEl.className = 'rombongan-angka';
    barisPengikut.append(this.pengikutEl);

    const barisPerbekalan = this.baris(UI.rombongan.perbekalan);
    this.perbekalanEl = document.createElement('span');
    this.perbekalanEl.className = 'rombongan-nasi';
    barisPerbekalan.append(this.perbekalanEl);

    this.pagonEl = document.createElement('div');
    this.pagonEl.className = 'rombongan-baris rombongan-pagon';
    const ikon = document.createElement('span');
    ikon.className = 'pagon-ikon';
    this.pagonEl.append(ikon, document.createTextNode(UI.rombongan.pagon));

    this.teksEl = document.createElement('div');
    this.teksEl.className = 'rombongan-teks';

    this.el.append(barisPengikut, barisPerbekalan, this.pagonEl, this.teksEl);
    document.body.append(this.el);
    this.segarkan();
  }

  private baris(label: string): HTMLDivElement {
    const b = document.createElement('div');
    b.className = 'rombongan-baris';
    const l = document.createElement('span');
    l.className = 'rombongan-label';
    l.textContent = label;
    b.append(l);
    return b;
  }

  /** Menggambar ulang semua nilai dari rombongan. */
  segarkan(): void {
    const n = this.rombongan.nilai;
    this.pengikutEl.textContent = String(n.pengikut);
    this.perbekalanEl.replaceChildren();
    if (n.perbekalan < 0) {
      const kurang = document.createElement('span');
      kurang.className = 'nasi-kurang';
      kurang.textContent = String(n.perbekalan);
      this.perbekalanEl.append(kurang);
    } else {
      for (let i = 0; i < n.perbekalan; i++) {
        const nasi = document.createElement('span');
        nasi.className = 'nasi';
        this.perbekalanEl.append(nasi);
      }
      if (n.perbekalan === 0) {
        const nol = document.createElement('span');
        nol.className = 'nasi-kurang';
        nol.textContent = '0';
        this.perbekalanEl.append(nol);
      }
    }
    this.pagonEl.style.display = n.pagon === 'ikut' ? 'flex' : 'none';
  }

  /** Dipasang ke `Rombongan.saatBerubah`. */
  tampilkanPerubahan(p: PerubahanRombongan): void {
    this.segarkan();
    if (p.pengikut !== 0) this.kedip(this.pengikutEl, p.pengikut > 0);
    if (p.perbekalan !== 0) this.kedip(this.perbekalanEl, p.perbekalan > 0);
    if (p.pagon) this.kedip(this.pagonEl, p.pagon === 'ikut');
    if (p.teks) this.antreanTeks.push(p.teks);
  }

  /** Mengumumkan teks kecil tanpa perubahan nilai (misalnya obor diterima). */
  umumkan(teks: string): void {
    this.antreanTeks.push(teks);
  }

  private kedip(el: HTMLElement, naik: boolean): void {
    el.classList.remove('naik', 'turun');
    void el.offsetWidth; // memaksa reflow supaya animasi diulang
    el.classList.add(naik ? 'naik' : 'turun');
  }

  /** Dipanggil tiap frame; `tunda` benar saat HUD disembunyikan (dialog, menu). */
  perbarui(dt: number, tunda: boolean): void {
    if (tunda) return;
    if (this.sisaTeks > 0) {
      this.sisaTeks -= dt;
      if (this.sisaTeks <= 0) this.teksEl.classList.remove('tampil');
      return;
    }
    if (this.antreanTeks.length === 0) return;
    this.teksEl.textContent = this.antreanTeks.shift() as string;
    this.teksEl.classList.add('tampil');
    this.sisaTeks = UI.rombongan.lamaTeks;
  }
}
