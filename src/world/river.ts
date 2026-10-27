import * as THREE from 'three';
import { UKURAN_MEDAN, Z_SUNGAI, LEBAR_SUNGAI, PERMUKAAN_AIR, X_MUARA } from './terrain';

const bahanAir = new THREE.MeshStandardMaterial({
  color: 0x2f6f9a,
  roughness: 0.25,
  metalness: 0.1,
  transparent: true,
  opacity: 0.85,
});

/** Bidang air biru di dalam cekungan sungai, ditambah teluk muara yang lebih lebar di ujung barat. */
export function buatSungai(): THREE.Group {
  const grup = new THREE.Group();
  const geometri = new THREE.PlaneGeometry(UKURAN_MEDAN, LEBAR_SUNGAI + 6);
  geometri.rotateX(-Math.PI / 2);
  const air = new THREE.Mesh(geometri, bahanAir);
  air.position.set(0, PERMUKAAN_AIR, Z_SUNGAI);
  air.receiveShadow = true;
  air.name = 'sungai';
  grup.add(air);

  const lebarTeluk = UKURAN_MEDAN / 2 + X_MUARA + 10; // dari tepi barat medan sampai sedikit lewat X_MUARA
  const geoTeluk = new THREE.PlaneGeometry(lebarTeluk, 46);
  geoTeluk.rotateX(-Math.PI / 2);
  const teluk = new THREE.Mesh(geoTeluk, bahanAir);
  teluk.position.set(-UKURAN_MEDAN / 2 + lebarTeluk / 2, PERMUKAAN_AIR - 0.01, Z_SUNGAI);
  teluk.receiveShadow = true;
  teluk.name = 'teluk';
  grup.add(teluk);
  return grup;
}
