import * as THREE from 'three';
import { tinggiMedan, UKURAN_MEDAN } from './terrain';

// Pembangkit acak dengan benih tetap supaya tata letak hutan tidak berubah tiap muat.
function acakBerbenih(benih: number): () => number {
  let a = benih >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Pohon {
  x: number;
  z: number;
  jari: number;
}

/** Hutan di selatan sungai dari silinder (batang) dan kerucut (tajuk), memakai instancing. */
export function buatHutan(): { grup: THREE.Group; pohon: Pohon[] } {
  const acak = acakBerbenih(1293);
  const jumlah = 160;
  const pohon: Pohon[] = [];

  const geoBatang = new THREE.CylinderGeometry(0.25, 0.35, 1, 6);
  const geoTajuk = new THREE.ConeGeometry(1, 1, 7);
  const bahanBatang = new THREE.MeshStandardMaterial({ color: 0x5a3f28, roughness: 1 });
  const bahanTajuk = new THREE.MeshStandardMaterial({ color: 0x2f5a2a, roughness: 1 });

  const batang = new THREE.InstancedMesh(geoBatang, bahanBatang, jumlah);
  const tajuk = new THREE.InstancedMesh(geoTajuk, bahanTajuk, jumlah);
  batang.castShadow = true;
  tajuk.castShadow = true;
  tajuk.receiveShadow = true;

  const m = new THREE.Matrix4();
  const setengah = UKURAN_MEDAN / 2;
  for (let i = 0; i < jumlah; i++) {
    const x = (acak() * 2 - 1) * (setengah - 8);
    const z = 72 + acak() * (setengah - 80);
    const y = tinggiMedan(x, z);
    const tinggiBatang = 2 + acak() * 2;
    const tinggiTajuk = 4 + acak() * 4;
    const jariTajuk = 1.6 + acak() * 1.6;

    m.makeScale(1, tinggiBatang, 1).setPosition(x, y + tinggiBatang / 2, z);
    batang.setMatrixAt(i, m);
    m.makeScale(jariTajuk, tinggiTajuk, jariTajuk).setPosition(x, y + tinggiBatang + tinggiTajuk / 2, z);
    tajuk.setMatrixAt(i, m);

    pohon.push({ x, z, jari: 0.4 });
  }
  batang.instanceMatrix.needsUpdate = true;
  tajuk.instanceMatrix.needsUpdate = true;

  const grup = new THREE.Group();
  grup.add(batang, tajuk);
  grup.name = 'hutan';
  return { grup, pohon };
}
