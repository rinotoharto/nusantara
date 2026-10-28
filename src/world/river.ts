import * as THREE from 'three';
import { PERMUKAAN_AIR, LEBAR_SUNGAI } from './terrain';
import { DUNIA, type Titik2 } from './world-config';

const bahanAir = new THREE.MeshStandardMaterial({
  color: 0x2f6f9a,
  roughness: 0.25,
  metalness: 0.1,
  transparent: true,
  opacity: 0.85,
});

/** Bidang air biru: pita mengikuti jalur sungai (lebih lebar di bagian deras) dan cakram di teluk muara. */
export function buatSungai(): THREE.Group {
  const grup = new THREE.Group();
  const jalur = DUNIA.sungai.jalur as Titik2[];
  const S = DUNIA.sungai;
  const titik: number[] = [];
  const indeks: number[] = [];
  for (let i = 0; i < jalur.length; i++) {
    const [x, z] = jalur[i];
    // Arah rata-rata ruas sebelum dan sesudah supaya sambungan di tikungan rapi.
    const sebelum = jalur[Math.max(0, i - 1)];
    const sesudah = jalur[Math.min(jalur.length - 1, i + 1)];
    let ax = sesudah[0] - sebelum[0];
    let az = sesudah[1] - sebelum[1];
    const panjang = Math.hypot(ax, az) || 1;
    ax /= panjang;
    az /= panjang;
    const deras = Math.min(1, Math.max(0, (S.deras.xMulai - x) / S.deras.peralihan));
    const setengah = (LEBAR_SUNGAI + S.deras.lebarTambahan * deras) / 2 + 3;
    titik.push(x - az * setengah, PERMUKAAN_AIR, z + ax * setengah, x + az * setengah, PERMUKAAN_AIR, z - ax * setengah);
    if (i > 0) {
      const a = (i - 1) * 2;
      indeks.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geometri = new THREE.BufferGeometry();
  geometri.setAttribute('position', new THREE.Float32BufferAttribute(titik, 3));
  geometri.setIndex(indeks);
  geometri.computeVertexNormals();
  const air = new THREE.Mesh(geometri, bahanAir);
  air.receiveShadow = true;
  air.name = 'sungai';
  grup.add(air);

  const M = DUNIA.muara;
  const geoTeluk = new THREE.CircleGeometry(M.sigma * 1.7, 32);
  geoTeluk.rotateX(-Math.PI / 2);
  const teluk = new THREE.Mesh(geoTeluk, bahanAir);
  teluk.position.set(M.x, PERMUKAAN_AIR - 0.01, M.z);
  teluk.receiveShadow = true;
  teluk.name = 'teluk';
  grup.add(teluk);
  return grup;
}
