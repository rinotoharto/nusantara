import { UI } from './config';

/**
 * Panel layar gelap dengan teks naskah: pembukaan misi, "beberapa jam kemudian", dan sejenisnya.
 * Klik atau Spasi melanjutkan; kalau `lama` diberikan, panel menutup sendiri setelah itu.
 */
export class PanelNaskah {
  private readonly lapis: HTMLDivElement;
  private readonly isi: HTMLDivElement;
  private readonly petunjuk: HTMLDivElement;
  private tampil = false;
  private sisa = 0;
  private bolehKlik = true;
  /** Dipanggil saat panel tertutup. */
  private saatTutup: (() => void) | null = null;

  constructor() {
    this.lapis = document.createElement('div');
    this.lapis.className = 'panel-lapis';
    this.isi = document.createElement('div');
    this.isi.className = 'panel-isi';
    this.petunjuk = document.createElement('div');
    this.petunjuk.className = 'panel-petunjuk';
    this.petunjuk.textContent = UI.misi.lanjut;
    this.lapis.append(this.isi, this.petunjuk);
    document.body.append(this.lapis);

    this.lapis.addEventListener('click', () => this.lanjut());
    window.addEventListener('keydown', (e) => {
      if (!this.tampil || e.repeat) return;
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        this.lanjut();
      }
    });
  }

  get aktif(): boolean {
    return this.tampil;
  }

  /** Menampilkan paragraf; dengan `lama` (detik) panel menutup sendiri dan tidak bisa diklik. */
  buka(paragraf: string[], saatTutup: () => void, lama = 0): void {
    this.isi.replaceChildren(
      ...paragraf.map((t) => {
        const p = document.createElement('p');
        p.textContent = t;
        return p;
      }),
    );
    this.saatTutup = saatTutup;
    this.sisa = lama;
    this.bolehKlik = lama <= 0;
    this.petunjuk.style.display = this.bolehKlik ? 'block' : 'none';
    this.tampil = true;
    this.lapis.classList.add('tampil');
  }

  perbarui(dt: number): void {
    if (!this.tampil || this.sisa <= 0) return;
    this.sisa -= dt;
    if (this.sisa <= 0) this.tutup();
  }

  private lanjut(): void {
    if (this.tampil && this.bolehKlik) this.tutup();
  }

  private tutup(): void {
    this.tampil = false;
    this.lapis.classList.remove('tampil');
    const cb = this.saatTutup;
    this.saatTutup = null;
    cb?.();
  }
}
