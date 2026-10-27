import type * as THREE from 'three';

/**
 * Uji kena sederhana tanpa raycast: sasaran dianggap kena kalau jarak datar (dikurangi jari
 * sasaran) tidak lebih dari jangkauan senjata dan sasaran berada di dalam kerucut hadap penyerang.
 */
export function dalamJangkauan(
  dariPos: THREE.Vector3,
  hadap: number,
  kePos: THREE.Vector3,
  jangkauan: number,
  jariSasaran: number,
  sudutDerajat: number,
): boolean {
  const dx = kePos.x - dariPos.x;
  const dz = kePos.z - dariPos.z;
  const jarak = Math.hypot(dx, dz);
  if (jarak - jariSasaran > jangkauan) return false;
  if (Math.abs(kePos.y - dariPos.y) > 1.5) return false;
  // Jarak tempel: pasti kena tanpa peduli arah, supaya kapsul yang saling menempel tidak lolos.
  if (jarak <= jariSasaran + 0.4) return true;
  const cos = (Math.sin(hadap) * dx + Math.cos(hadap) * dz) / jarak;
  return cos >= Math.cos((sudutDerajat * Math.PI) / 180 / 2);
}

/** Benar kalau `hadap` di `pos` mengarah ke `sasaran` dalam kerucut `sudutDerajat`. */
export function menghadap(pos: THREE.Vector3, hadap: number, sasaran: THREE.Vector3, sudutDerajat: number): boolean {
  const dx = sasaran.x - pos.x;
  const dz = sasaran.z - pos.z;
  const jarak = Math.hypot(dx, dz);
  if (jarak < 1e-4) return true;
  const cos = (Math.sin(hadap) * dx + Math.cos(hadap) * dz) / jarak;
  return cos >= Math.cos((sudutDerajat * Math.PI) / 180 / 2);
}

/** Sudut hadap (radian) dari `dari` ke `ke`, sesuai konvensi hadap pemain. */
export function sudutKe(dari: THREE.Vector3, ke: THREE.Vector3): number {
  return Math.atan2(ke.x - dari.x, ke.z - dari.z);
}
