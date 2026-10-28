import * as THREE from 'three';
import { UI } from './config';

const TEPI = 46; // piksel dari tepi layar untuk tanda yang sumbernya di luar pandangan

/**
 * HUD kejadian di jalur (sprint 7): geraman harimau sebagai "..." kecil di arah sumber suara.
 * Kalau sumbernya di luar layar, tanda ditempelkan ke tepi layar yang searah.
 */
export class HudKejadian {
  private readonly geramEl: HTMLDivElement;
  private readonly sumberGeram = new THREE.Vector3();
  private sisaGeram = 0;
  private readonly proyeksi = new THREE.Vector3();

  constructor() {
    this.geramEl = document.createElement('div');
    this.geramEl.className = 'hud hud-geram';
    this.geramEl.textContent = UI.kejadian.geram;
    document.body.append(this.geramEl);
  }

  /** Geraman terdengar dari `posisi` dunia. */
  geram(posisi: THREE.Vector3): void {
    this.sumberGeram.copy(posisi);
    this.sisaGeram = UI.kejadian.lamaGeram;
  }

  /** Dipanggil tiap frame; `tunda` benar saat HUD disembunyikan (dialog, menu). */
  perbarui(dt: number, kamera: THREE.Camera, tunda: boolean): void {
    if (this.sisaGeram <= 0 || tunda) {
      this.geramEl.classList.remove('tampil');
      return;
    }
    this.sisaGeram -= dt;
    const p = this.proyeksi.set(this.sumberGeram.x, this.sumberGeram.y + 0.8, this.sumberGeram.z).project(kamera);
    // Di belakang kamera: arah layar dibalik supaya tanda menunjuk ke arah yang benar.
    let x = p.x;
    let y = p.y;
    if (p.z > 1) {
      x = -x;
      y = -y;
    }
    const lebar = window.innerWidth;
    const tinggi = window.innerHeight;
    let px = ((x + 1) / 2) * lebar;
    let py = ((1 - y) / 2) * tinggi;
    const diLuar = p.z > 1 || Math.abs(x) > 1 || Math.abs(y) > 1;
    if (diLuar) {
      // Geser ke tepi searah dari pusat layar.
      const dx = px - lebar / 2;
      const dy = py - tinggi / 2;
      const skala = Math.min((lebar / 2 - TEPI) / Math.max(Math.abs(dx), 1e-3), (tinggi / 2 - TEPI) / Math.max(Math.abs(dy), 1e-3));
      px = lebar / 2 + dx * skala;
      py = tinggi / 2 + dy * skala;
    }
    px = Math.min(lebar - TEPI, Math.max(TEPI, px));
    py = Math.min(tinggi - TEPI, Math.max(TEPI, py));
    this.geramEl.style.transform = `translate(${px}px, ${py}px) translate(-50%, -50%)`;
    this.geramEl.classList.add('tampil');
  }
}
