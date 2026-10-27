import * as THREE from 'three';
import type { Penjaga } from '../stealth/guard';
import type { KeadaanPemain } from '../stealth/stealth-manager';

const JARAK_TANDA = 30; // tanda di atas kepala hanya tampil dalam jarak ini

/**
 * HUD menyelinap: tanda tanya di atas penjaga yang curiga atau mencari, tanda seru di atas
 * penjaga yang mengejar.
 */
export class HudSiluman {
  private readonly tanda = new Map<Penjaga, HTMLDivElement>();
  private readonly proyeksi = new THREE.Vector3();
  private readonly vignet: HTMLDivElement;
  private readonly sembunyi: HTMLDivElement;

  constructor() {
    this.vignet = document.createElement('div');
    this.vignet.className = 'hud-vignet';
    this.sembunyi = document.createElement('div');
    this.sembunyi.className = 'hud hud-sembunyi';
    document.body.append(this.vignet, this.sembunyi);
  }

  perbarui(penjagaSemua: Penjaga[], keadaan: KeadaanPemain, kamera: THREE.Camera): void {
    const posPemain = keadaan.posisi;
    // Di dalam semak: pinggiran layar gelap; teks memberi tahu apakah sudah tersembunyi.
    this.vignet.classList.toggle('tampil', keadaan.semak !== null);
    const teks = keadaan.tersembunyi ? 'Tersembunyi' : keadaan.semak ? 'Jongkok (C) untuk bersembunyi' : '';
    if (this.sembunyi.textContent !== teks) this.sembunyi.textContent = teks;
    this.sembunyi.classList.toggle('tersembunyi', keadaan.tersembunyi);

    for (const p of penjagaSemua) {
      let el = this.tanda.get(p);
      if (!el) {
        el = document.createElement('div');
        el.className = 'hud hud-tanda';
        document.body.append(el);
        this.tanda.set(p, el);
      }
      const teks = p.mengejar ? '!' : p.status === 'curiga' || p.status === 'mencari' ? '?' : '';
      const jarak = Math.hypot(p.posisi.x - posPemain.x, p.posisi.z - posPemain.z);
      const titik = teks && p.hidup && jarak < JARAK_TANDA ? this.keLayar(p.posisi, 2.4, kamera) : null;
      if (!titik) {
        el.style.display = 'none';
        continue;
      }
      if (el.textContent !== teks) {
        el.textContent = teks;
        el.classList.toggle('seru', teks === '!');
      }
      el.style.display = 'block';
      el.style.transform = `translate(${titik.x}px, ${titik.y}px) translate(-50%, -100%)`;
    }
  }

  private keLayar(pos: THREE.Vector3, naik: number, kamera: THREE.Camera): { x: number; y: number } | null {
    this.proyeksi.set(pos.x, pos.y + naik, pos.z).project(kamera);
    if (this.proyeksi.z > 1) return null;
    return {
      x: (this.proyeksi.x + 1) / 2 * window.innerWidth,
      y: (1 - this.proyeksi.y) / 2 * window.innerHeight,
    };
  }
}
