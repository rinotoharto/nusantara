import * as THREE from 'three';
import { tinggiMedan } from './terrain';

const bahanBatang = new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.9 });
const bahanNyala = new THREE.MeshStandardMaterial({ color: 0xffc866, emissive: 0xffa030, emissiveIntensity: 2 });

/** Obor penanda tujuan: tiang pendek dengan bola bercahaya dan lampu titik, sesuai GDD (penanda di dunia, bukan di layar). */
export function buatObor(x: number, z: number): THREE.Group {
  const grup = new THREE.Group();
  grup.position.set(x, tinggiMedan(x, z), z);
  const batang = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 2.2, 8), bahanBatang);
  batang.position.y = 1.1;
  const nyala = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), bahanNyala);
  nyala.position.y = 2.3;
  const cahaya = new THREE.PointLight(0xffb060, 8, 14, 1.5);
  cahaya.position.y = 2.3;
  grup.add(batang, nyala, cahaya);
  grup.name = 'obor';
  return grup;
}
