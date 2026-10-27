/** Pembaca keyboard dan mouse. Pointer lock saat kanvas diklik, Esc melepasnya. */
export class Input {
  private ditekanSekarang = new Set<string>();
  private baruSaja = new Set<string>();
  private mouseDX = 0;
  private mouseDY = 0;
  terkunci = false;

  constructor(private kanvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.ditekanSekarang.add(e.code);
      this.baruSaja.add(e.code);
      if (e.code === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.ditekanSekarang.delete(e.code));
    window.addEventListener('blur', () => this.ditekanSekarang.clear());

    kanvas.addEventListener('click', () => {
      if (!this.terkunci) kanvas.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', () => {
      this.terkunci = document.pointerLockElement === this.kanvas;
      if (!this.terkunci) this.ditekanSekarang.clear();
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.terkunci) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
  }

  ditekan(kode: string): boolean {
    return this.ditekanSekarang.has(kode);
  }

  /** Benar hanya pada frame tombol pertama kali ditekan. */
  baruDitekan(kode: string): boolean {
    return this.baruSaja.has(kode);
  }

  /** Mengambil gerak mouse sejak frame lalu, lalu mengosongkannya. */
  ambilGerakMouse(): { dx: number; dy: number } {
    const hasil = { dx: this.mouseDX, dy: this.mouseDY };
    this.mouseDX = 0;
    this.mouseDY = 0;
    return hasil;
  }

  /** Dipanggil di akhir tiap frame. */
  akhirFrame(): void {
    this.baruSaja.clear();
  }
}
