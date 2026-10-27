import * as THREE from 'three';
import { tinggiMedan } from './terrain';

/** Satu rumah balok beserta kotak tabrakannya. */
export interface Rumah {
  grup: THREE.Group;
  kotak: THREE.Box3;
}

// Posisi dan arah hadap 6 rumah desa Kudadu di tengah medan.
const TATA_LETAK: { x: number; z: number; putar: number; skala?: number }[] = [
  { x: -18, z: -12, putar: 0.3 },
  { x: 14, z: -16, putar: -0.2 },
  { x: -8, z: 12, putar: 1.6 },
  { x: 20, z: 8, putar: 1.3 },
  { x: -26, z: 14, putar: -0.4 },
  { x: 4, z: -28, putar: 0.1, skala: 1.3 }, // rumah kepala desa, yang terbesar
];

const LEBAR = 7;
const DALAM = 5;
const TINGGI_LANTAI = 0.8; // rumah panggung sederhana
const TINGGI_DINDING = 2.6;
const TINGGI_ATAP = 2.4;

const bahanDinding = new THREE.MeshStandardMaterial({ color: 0x9a7b4f, roughness: 0.9 });
const bahanAtap = new THREE.MeshStandardMaterial({ color: 0x5a3b26, roughness: 1 });
const bahanTiang = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 1 });

function buatRumah(x: number, z: number, putar: number, skala = 1): Rumah {
  const grup = new THREE.Group();
  const yTanah = tinggiMedan(x, z);
  grup.position.set(x, yTanah, z);
  grup.rotation.y = putar;
  grup.scale.setScalar(skala);

  // Badan rumah di atas tiang.
  const badan = new THREE.Mesh(new THREE.BoxGeometry(LEBAR, TINGGI_DINDING, DALAM), bahanDinding);
  badan.position.y = TINGGI_LANTAI + TINGGI_DINDING / 2;
  badan.castShadow = true;
  badan.receiveShadow = true;
  grup.add(badan);

  // Empat tiang penyangga.
  const geoTiang = new THREE.BoxGeometry(0.3, TINGGI_LANTAI + 0.5, 0.3);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const tiang = new THREE.Mesh(geoTiang, bahanTiang);
      tiang.position.set(sx * (LEBAR / 2 - 0.4), (TINGGI_LANTAI + 0.5) / 2 - 0.5, sz * (DALAM / 2 - 0.4));
      tiang.castShadow = true;
      grup.add(tiang);
    }
  }

  // Atap limas dari kerucut bersisi empat.
  const jariAtap = Math.hypot(LEBAR / 2 + 0.6, DALAM / 2 + 0.6);
  const atap = new THREE.Mesh(new THREE.ConeGeometry(jariAtap, TINGGI_ATAP, 4), bahanAtap);
  atap.rotation.y = Math.PI / 4;
  atap.scale.set(1, 1, DALAM / LEBAR);
  atap.position.y = TINGGI_LANTAI + TINGGI_DINDING + TINGGI_ATAP / 2;
  atap.castShadow = true;
  grup.add(atap);

  // Kotak tabrakan sejajar sumbu, dihitung setelah grup diposisikan.
  grup.updateMatrixWorld(true);
  const kotak = new THREE.Box3().setFromObject(badan);
  kotak.min.y = yTanah - 1;

  return { grup, kotak };
}

/** Enam rumah desa Kudadu. */
export function buatDesa(): Rumah[] {
  return TATA_LETAK.map((r) => buatRumah(r.x, r.z, r.putar, r.skala));
}
