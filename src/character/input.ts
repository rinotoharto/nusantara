/**
 * Pembaca keyboard dan mouse. Pointer lock saat kanvas diklik, Esc melepasnya.
 * Tombol mouse dibaca dengan kode `Mouse0` (kiri), `Mouse1` (tengah), `Mouse2` (kanan),
 * hanya saat pointer terkunci.
 */
export class Input {
  private ditekanSekarang = new Set<string>();
  private baruSaja = new Set<string>();
  private baruLepas = new Set<string>();
  private waktuTekan = new Map<string, number>();
  private mouseDX = 0;
  private mouseDY = 0;
  terkunci = false;

  constructor(private kanvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.tekan(e.code);
      if (e.code === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.lepas(e.code));
    window.addEventListener('blur', () => this.lepasSemua());

    kanvas.addEventListener('click', () => {
      // Beberapa lingkungan (mis. iframe) menolak pointer lock; abaikan penolakannya.
      if (!this.terkunci) Promise.resolve(kanvas.requestPointerLock()).catch(() => undefined);
    });
    kanvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('mousedown', (e) => {
      if (!this.terkunci) return;
      e.preventDefault();
      this.tekan(`Mouse${e.button}`);
    });
    document.addEventListener('mouseup', (e) => {
      if (!this.terkunci) return;
      this.lepas(`Mouse${e.button}`);
    });
    document.addEventListener('pointerlockchange', () => {
      this.terkunci = document.pointerLockElement === this.kanvas;
      if (!this.terkunci) this.lepasSemua();
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.terkunci) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
  }

  private tekan(kode: string): void {
    if (this.ditekanSekarang.has(kode)) return;
    this.ditekanSekarang.add(kode);
    this.baruSaja.add(kode);
    this.waktuTekan.set(kode, performance.now());
  }

  private lepas(kode: string): void {
    if (!this.ditekanSekarang.has(kode)) return;
    this.ditekanSekarang.delete(kode);
    this.baruLepas.add(kode);
  }

  private lepasSemua(): void {
    for (const kode of this.ditekanSekarang) this.baruLepas.add(kode);
    this.ditekanSekarang.clear();
  }

  ditekan(kode: string): boolean {
    return this.ditekanSekarang.has(kode);
  }

  /** Benar hanya pada frame tombol pertama kali ditekan. */
  baruDitekan(kode: string): boolean {
    return this.baruSaja.has(kode);
  }

  /** Benar hanya pada frame tombol dilepas. */
  baruDilepas(kode: string): boolean {
    return this.baruLepas.has(kode);
  }

  /** Lama tombol ditahan dalam detik; 0 kalau tidak sedang ditekan. */
  lamaDitekan(kode: string): number {
    const mulai = this.waktuTekan.get(kode);
    if (mulai === undefined || !this.ditekanSekarang.has(kode)) return 0;
    return (performance.now() - mulai) / 1000;
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
    this.baruLepas.clear();
  }
}
