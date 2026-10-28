import { PembacaGamepad, INPUT } from './gamepad';

export type NamaAksi = keyof typeof INPUT.aksi;
const AKSI = INPUT.aksi as Record<NamaAksi, string[]>;
const G = INPUT.gamepad;
const TOMBOL_PAD = G.tombol as Record<string, number | number[]>;

/** Kode virtual tombol gamepad ke-i, dicatat seperti tombol keyboard. */
const kodePad = (i: number): string => `Pad${i}`;

/**
 * Pembaca keyboard, mouse, dan gamepad. Kode mentah (`KeyW`, `Mouse0`, `Pad0`) dibungkus
 * menjadi aksi bernama dari src/data/input.json (`maju`, `serang`, ...). Pointer lock saat
 * kanvas diklik, Esc melepasnya. Tombol mouse `Mouse0` kiri, `Mouse1` tengah, `Mouse2` kanan,
 * hanya saat pointer terkunci. Gamepad dibaca tiap frame lewat `perbaruiGamepad`.
 */
export class Input {
  private ditekanSekarang = new Set<string>();
  private baruSaja = new Set<string>();
  private baruLepas = new Set<string>();
  private waktuTekan = new Map<string, number>();
  private mouseDX = 0;
  private mouseDY = 0;
  private waktuKameraDigerakkan = 0;
  private readonly pad = new PembacaGamepad();
  terkunci = false;
  /** Benar kalau masukan terakhir datang dari gamepad (petunjuk HUD mengikuti). */
  gamepadTerakhir = false;
  /** Stik kiri (gerak) dan kanan (kamera), -1 sampai 1, sudah lewat zona mati. */
  readonly stikGerak = { x: 0, y: 0 };
  readonly stikKamera = { x: 0, y: 0 };

  constructor(private kanvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.gamepadTerakhir = false;
      this.tekan(e.code);
      if (e.code === 'Space' || e.code === 'Tab') e.preventDefault(); // Tab: pemandu, jangan pindah fokus
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
      this.gamepadTerakhir = false;
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
      if (e.movementX !== 0 || e.movementY !== 0) {
        this.waktuKameraDigerakkan = performance.now();
        this.gamepadTerakhir = false;
      }
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

  /** Dipanggil di awal tiap frame: membaca gamepad, tombolnya dicatat sebagai kode `Pad<i>`. */
  perbaruiGamepad(): void {
    const aktif = this.pad.baca();
    for (let i = 0; i < 20; i++) {
      const kode = kodePad(i);
      if (this.pad.tombol[i]) this.tekan(kode);
      else if (this.ditekanSekarang.has(kode)) this.lepas(kode);
    }
    this.stikGerak.x = this.pad.sumbu[G.sumbu.gerakX];
    this.stikGerak.y = this.pad.sumbu[G.sumbu.gerakY];
    this.stikKamera.x = this.pad.sumbu[G.sumbu.kameraX];
    this.stikKamera.y = this.pad.sumbu[G.sumbu.kameraY];
    if (this.stikKamera.x !== 0 || this.stikKamera.y !== 0) this.waktuKameraDigerakkan = performance.now();
    if (aktif) this.gamepadTerakhir = true;
  }

  get gamepadTersambung(): boolean {
    return this.pad.tersambung;
  }

  // --- Kode mentah ----------------------------------------------------------------------

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

  // --- Aksi bernama (keyboard/mouse dan gamepad) ------------------------------------------

  private kodeAksi(aksi: NamaAksi | string): string[] {
    const daftar = [...(AKSI[aksi as NamaAksi] ?? [])];
    const t = TOMBOL_PAD[aksi];
    if (typeof t === 'number') daftar.push(kodePad(t));
    return daftar;
  }

  aksiDitekan(aksi: NamaAksi | string): boolean {
    return this.kodeAksi(aksi).some((k) => this.ditekanSekarang.has(k));
  }

  aksiBaru(aksi: NamaAksi | string): boolean {
    return this.kodeAksi(aksi).some((k) => this.baruSaja.has(k));
  }

  aksiLepas(aksi: NamaAksi | string): boolean {
    return this.kodeAksi(aksi).some((k) => this.baruLepas.has(k));
  }

  /** Tombol gamepad `menu...`/`dialog...` yang baru ditekan (hanya gamepad). */
  padBaru(nama: string): boolean {
    const t = TOMBOL_PAD[nama];
    return typeof t === 'number' && this.baruSaja.has(kodePad(t));
  }

  /** Indeks pilihan dialog (0..2) yang baru ditekan di gamepad, atau -1. */
  padPilihanDialog(): number {
    const daftar = TOMBOL_PAD.dialogPilihan;
    if (!Array.isArray(daftar)) return -1;
    return daftar.findIndex((t) => this.baruSaja.has(kodePad(t)));
  }

  /** Detik sejak kamera terakhir digerakkan (mouse atau stik kanan). */
  sejakKameraDigerakkan(): number {
    return (performance.now() - this.waktuKameraDigerakkan) / 1000;
  }

  /** Mengambil gerak mouse (piksel) sejak frame lalu, lalu mengosongkannya; stik kanan dibaca dari `stikKamera`. */
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
