import * as THREE from 'three';
import { tinggiMedan } from '../world/terrain';
import { SILUMAN } from './config';

const S = SILUMAN.semak;
const bahanSemak = new THREE.MeshStandardMaterial({
  color: 0x1f4a22,
  roughness: 1,
  transparent: true,
  opacity: 0.6,
  depthWrite: false,
});

/** Semak persembunyian: balok hijau gelap setengah transparan. Tidak menghalangi gerak maupun kamera. */
export class Semak {
  readonly mesh: THREE.Mesh;
  readonly kotak: THREE.Box3;
  readonly pusat: THREE.Vector3;

  constructor(x: number, z: number) {
    const yTanah = tinggiMedan(x, z);
    this.mesh = new THREE.Mesh(new THREE.BoxGeometry(S.lebar, S.tinggi + 0.6, S.dalam), bahanSemak);
    this.mesh.position.set(x, yTanah + S.tinggi / 2 - 0.3, z);
    this.mesh.castShadow = true;
    this.mesh.name = 'semak';
    this.mesh.updateMatrixWorld(true);
    this.kotak = new THREE.Box3().setFromObject(this.mesh);
    this.pusat = new THREE.Vector3(x, yTanah, z);
  }

  /** Benar kalau titik kaki `pos` berada di dalam tapak semak dan tidak di atasnya. */
  berisi(pos: THREE.Vector3): boolean {
    const k = this.kotak;
    return pos.x >= k.min.x && pos.x <= k.max.x && pos.z >= k.min.z && pos.z <= k.max.z && pos.y < k.max.y - 0.3;
  }
}

/** Semak yang berisi `pos`, atau null. */
export function semakDi(semua: Semak[], pos: THREE.Vector3): Semak | null {
  for (const s of semua) if (s.berisi(pos)) return s;
  return null;
}
