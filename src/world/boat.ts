import * as THREE from 'three';
import { PERMUKAAN_AIR } from './terrain';

const bahanKayu = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.95 });
const bahanLayar = new THREE.MeshStandardMaterial({ color: 0xd9c9a0, roughness: 1, side: THREE.DoubleSide });

/** Perahu nelayan dari balok: lambung, dua bangku, tiang, dan layar; mengapung di permukaan air. */
export interface Perahu {
  grup: THREE.Group;
  /** Tinggi geladak (y dunia) tempat kapsul berdiri. */
  geladak: number;
}

export function buatPerahu(x: number, z: number, putar: number): Perahu {
  const grup = new THREE.Group();
  grup.position.set(x, PERMUKAAN_AIR, z);
  grup.rotation.y = putar;
  const lambung = new THREE.Mesh(new THREE.BoxGeometry(6, 0.8, 2.2), bahanKayu);
  lambung.position.y = 0.1;
  lambung.castShadow = true;
  grup.add(lambung);
  const haluan = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 1.2), bahanKayu);
  haluan.position.set(3.4, 0.2, 0);
  haluan.rotation.y = Math.PI / 4;
  grup.add(haluan);
  for (const sx of [-1.5, 1.5]) {
    const bangku = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 2.2), bahanKayu);
    bangku.position.set(sx, 0.55, 0);
    grup.add(bangku);
  }
  const tiang = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4, 6), bahanKayu);
  tiang.position.set(0.5, 2.4, 0);
  grup.add(tiang);
  const layar = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.4), bahanLayar);
  layar.position.set(-0.9, 3.0, 0);
  layar.castShadow = true;
  grup.add(layar);
  grup.name = 'perahu';
  return { grup, geladak: PERMUKAAN_AIR + 0.5 };
}
