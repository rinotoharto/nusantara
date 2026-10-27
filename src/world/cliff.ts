import * as THREE from 'three';
import { tinggiMedan } from './terrain';

export interface Tebing {
  mesh: THREE.Mesh;
  kotak: THREE.Box3;
}

// Tebing rendah di kaki bukit utara. Setinggi 2 m dari tanah di sisi selatannya,
// cukup tinggi untuk tidak bisa dilompati tapi bisa dipanjat.
const PUSAT = new THREE.Vector3(-15, 0, -58);
const LEBAR = 22;
const DALAM = 10;
const TINGGI_ATAS = 2;
const TERBENAM = 2.5; // bagian yang tertanam supaya tidak ada celah di tanah bergelombang

export function buatTebing(): Tebing {
  const dasar = tinggiMedan(PUSAT.x, PUSAT.z + DALAM / 2); // tinggi tanah di sisi depan (selatan)
  const tinggiTotal = TINGGI_ATAS + TERBENAM;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(LEBAR, tinggiTotal, DALAM),
    new THREE.MeshStandardMaterial({ color: 0x7d6a52, roughness: 1 }),
  );
  mesh.position.set(PUSAT.x, dasar + TINGGI_ATAS - tinggiTotal / 2, PUSAT.z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'tebing';
  mesh.updateMatrixWorld(true);

  const kotak = new THREE.Box3().setFromObject(mesh);
  return { mesh, kotak };
}
