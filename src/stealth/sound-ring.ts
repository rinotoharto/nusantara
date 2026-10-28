import * as THREE from 'three';
import { tinggiMedan } from '../world/terrain';

const SEGMEN = 40;
const TINGGI = 0.1;

/**
 * Lingkaran suara tipis di lantai mengelilingi pemain: radius suara langkahnya saat ini.
 * Hanya tampil saat pemain bergerak dan ada penjaga cukup dekat, supaya pemain belajar aturannya.
 */
export class LingkaranSuara {
  readonly garis: THREE.LineLoop;
  private readonly atribut: THREE.BufferAttribute;
  private readonly bahan: THREE.LineBasicMaterial;

  constructor() {
    const geometri = new THREE.BufferGeometry();
    this.atribut = new THREE.BufferAttribute(new Float32Array(SEGMEN * 3), 3).setUsage(THREE.DynamicDrawUsage);
    geometri.setAttribute('position', this.atribut);
    this.bahan = new THREE.LineBasicMaterial({ color: 0xf4e9d4, transparent: true, opacity: 0.35, depthWrite: false });
    this.garis = new THREE.LineLoop(geometri, this.bahan);
    this.garis.frustumCulled = false;
    this.garis.visible = false;
    this.garis.name = 'lingkaran-suara';
  }

  /** Menggambar lingkaran berjari `radius` di sekitar (x, z) mengikuti kontur; radius 0 menyembunyikannya. */
  perbarui(x: number, z: number, radius: number, dt: number): void {
    const tujuanTampil = radius > 0;
    this.bahan.opacity += ((tujuanTampil ? 0.35 : 0) - this.bahan.opacity) * Math.min(1, 8 * dt);
    this.garis.visible = this.bahan.opacity > 0.01;
    if (!tujuanTampil) return;
    for (let i = 0; i < SEGMEN; i++) {
      const a = (i / SEGMEN) * Math.PI * 2;
      const px = x + Math.cos(a) * radius;
      const pz = z + Math.sin(a) * radius;
      this.atribut.setXYZ(i, px, tinggiMedan(px, pz) + TINGGI, pz);
    }
    this.atribut.needsUpdate = true;
  }
}
