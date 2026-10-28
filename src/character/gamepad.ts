import data from '../data/input.json';

export const INPUT = data;
const G = data.gamepad;

/** Pembaca Gamepad API: tombol dan sumbu gamepad pertama yang tersambung, dengan zona mati. */
export class PembacaGamepad {
  /** Keadaan tombol sekarang (indeks pemetaan standar). */
  readonly tombol: boolean[] = [];
  readonly sumbu: number[] = [0, 0, 0, 0];
  tersambung = false;

  /** Membaca keadaan terbaru; benar kalau ada tombol ditekan atau stik digerakkan pada frame ini. */
  baca(): boolean {
    this.tersambung = false;
    if (typeof navigator.getGamepads !== 'function') return false;
    let pad: Gamepad | null = null;
    for (const g of navigator.getGamepads()) {
      if (g && g.connected) {
        pad = g;
        break;
      }
    }
    if (!pad) {
      this.tombol.length = 0;
      this.sumbu.fill(0);
      return false;
    }
    this.tersambung = true;
    let aktif = false;
    for (let i = 0; i < pad.buttons.length; i++) {
      const ditekan = pad.buttons[i].pressed || pad.buttons[i].value > 0.5;
      if (ditekan) aktif = true;
      this.tombol[i] = ditekan;
    }
    for (let i = 0; i < 4; i++) {
      const v = pad.axes[i] ?? 0;
      const besar = Math.abs(v);
      // Zona mati lalu diskalakan ulang supaya mulai dari 0 dengan halus.
      const nilai = besar < G.sumbu.zonaMati ? 0 : Math.sign(v) * Math.min(1, (besar - G.sumbu.zonaMati) / (1 - G.sumbu.zonaMati));
      if (nilai !== 0) aktif = true;
      this.sumbu[i] = nilai;
    }
    return aktif;
  }
}
