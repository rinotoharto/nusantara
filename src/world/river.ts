import * as THREE from 'three';
import { UKURAN_MEDAN, Z_SUNGAI, LEBAR_SUNGAI, PERMUKAAN_AIR } from './terrain';

/** Bidang air biru di dalam cekungan sungai. */
export function buatSungai(): THREE.Mesh {
  const geometri = new THREE.PlaneGeometry(UKURAN_MEDAN, LEBAR_SUNGAI + 6);
  geometri.rotateX(-Math.PI / 2);
  const bahan = new THREE.MeshStandardMaterial({
    color: 0x2f6f9a,
    roughness: 0.25,
    metalness: 0.1,
    transparent: true,
    opacity: 0.85,
  });
  const air = new THREE.Mesh(geometri, bahan);
  air.position.set(0, PERMUKAAN_AIR, Z_SUNGAI);
  air.receiveShadow = true;
  air.name = 'sungai';
  return air;
}
