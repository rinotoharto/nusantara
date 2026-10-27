import type * as THREE from 'three';

const JARAK_BELAKANG = 2.1; // kamera di belakang bahu pendengar
const GESER_SAMPING = 0.9; // ke kanan pendengar
const TINGGI_KAMERA = 1.8;
const TINGGI_SASARAN = 1.45; // kepala pembicara
const GESER_SASARAN = 0.25; // pembicara sedikit di kiri tengah layar

export interface PoseKamera {
  posisi: THREE.Vector3;
  sasaran: THREE.Vector3;
}

/**
 * Pose over-the-shoulder sederhana: kamera di belakang bahu kanan `pendengar`
 * memandang kepala `pembicara`. Kedua posisi adalah titik kaki.
 */
export function poseBahu(pendengar: THREE.Vector3, pembicara: THREE.Vector3, keluar: PoseKamera): void {
  let ax = pembicara.x - pendengar.x;
  let az = pembicara.z - pendengar.z;
  const panjang = Math.hypot(ax, az) || 1;
  ax /= panjang;
  az /= panjang;
  const kx = -az; // vektor kanan dari arah hadap (y ke atas)
  const kz = ax;
  keluar.posisi.set(
    pendengar.x - ax * JARAK_BELAKANG + kx * GESER_SAMPING,
    pendengar.y + TINGGI_KAMERA,
    pendengar.z - az * JARAK_BELAKANG + kz * GESER_SAMPING,
  );
  keluar.sasaran.set(
    pembicara.x + kx * GESER_SASARAN,
    pembicara.y + TINGGI_SASARAN,
    pembicara.z + kz * GESER_SASARAN,
  );
}
