import { UI } from './config';

/** HUD sederhana: penghitung fps di pojok kiri atas, petunjuk tombol di pojok kiri bawah. */
export class Hud {
  private readonly fpsEl: HTMLDivElement;
  private readonly petunjukEl: HTMLDivElement;
  private readonly kunciEl: HTMLDivElement;
  private readonly aksiEl: HTMLDivElement;
  private akumulasi = 0;
  private jumlahFrame = 0;

  constructor() {
    this.fpsEl = document.createElement('div');
    this.fpsEl.className = 'hud hud-fps';
    this.fpsEl.textContent = 'fps: --';

    this.petunjukEl = document.createElement('div');
    this.petunjukEl.className = 'hud hud-petunjuk';
    this.petunjukEl.innerHTML = UI.hud.petunjuk.map(([tombol, teks]) => `<b>${tombol}</b> ${teks}`).join('<br>');

    this.kunciEl = document.createElement('div');
    this.kunciEl.className = 'hud hud-kunci';
    this.kunciEl.textContent = UI.hud.kunci;

    this.aksiEl = document.createElement('div');
    this.aksiEl.className = 'hud hud-aksi';

    document.body.append(this.fpsEl, this.petunjukEl, this.kunciEl, this.aksiEl);
  }

  /** Petunjuk aksi di tengah bawah layar, misalnya "E: Bicara"; null menyembunyikannya. */
  tampilkanAksi(teks: string | null): void {
    this.aksiEl.style.display = teks ? 'block' : 'none';
    if (teks && this.aksiEl.textContent !== teks) this.aksiEl.textContent = teks;
  }

  /** Dipanggil tiap frame; angka fps diperbarui tiap setengah detik. */
  perbarui(dt: number, mouseTerkunci: boolean): void {
    this.akumulasi += dt;
    this.jumlahFrame += 1;
    if (this.akumulasi >= 0.5) {
      const fps = Math.round(this.jumlahFrame / this.akumulasi);
      this.fpsEl.textContent = `fps: ${fps}`;
      this.akumulasi = 0;
      this.jumlahFrame = 0;
    }
    this.kunciEl.style.display = mouseTerkunci ? 'none' : 'block';
  }
}
