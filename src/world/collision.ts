import * as THREE from 'three';
import { tinggiMedan } from './terrain';
import type { Pohon, IndeksPohon } from './forest';

/** Benda padat berbentuk kotak sejajar sumbu: rumah dan tebing. */
export interface Padat {
  kotak: THREE.Box3;
  bisaDipanjat: boolean;
}

export interface DataTabrakan {
  padat: Padat[];
  pohon: Pohon[];
  /** Indeks sel pohon untuk pencarian cepat. */
  indeksPohon: IndeksPohon;
}

const TOLERANSI_PIJAK = 0.35; // kaki boleh sedikit di bawah permukaan atas dan tetap dianggap berdiri di atasnya

/** Tinggi lantai yang bisa dipijak di (x, z): tanah, atau atap benda padat kalau kaki sudah di atasnya. */
export function tinggiLantai(data: DataTabrakan, x: number, z: number, kakiY: number): number {
  let lantai = tinggiMedan(x, z);
  for (const p of data.padat) {
    const k = p.kotak;
    if (x >= k.min.x && x <= k.max.x && z >= k.min.z && z <= k.max.z) {
      if (kakiY >= k.max.y - TOLERANSI_PIJAK && k.max.y > lantai) lantai = k.max.y;
    }
  }
  return lantai;
}

/** Mendorong posisi (x, z) keluar dari benda padat dan pohon. Mengubah `pos` di tempat. */
export function dorongKeluar(data: DataTabrakan, pos: THREE.Vector3, jari: number): void {
  for (const p of data.padat) {
    const k = p.kotak;
    // Sudah berdiri di atasnya: bukan tembok.
    if (pos.y >= k.max.y - TOLERANSI_PIJAK) continue;
    // Kepala di bawah dasar benda (tidak terjadi di sprint ini, tapi aman).
    if (pos.y + 1.7 <= k.min.y) continue;

    const dx = Math.max(k.min.x - pos.x, 0, pos.x - k.max.x);
    const dz = Math.max(k.min.z - pos.z, 0, pos.z - k.max.z);
    if (dx * dx + dz * dz >= jari * jari) continue;

    // Titik terdekat ada di dalam kotak: dorong lewat sisi yang paling dekat.
    if (dx === 0 && dz === 0) {
      const keKiri = pos.x - k.min.x + jari;
      const keKanan = k.max.x - pos.x + jari;
      const keDepan = pos.z - k.min.z + jari;
      const keBelakang = k.max.z - pos.z + jari;
      const terkecil = Math.min(keKiri, keKanan, keDepan, keBelakang);
      if (terkecil === keKiri) pos.x = k.min.x - jari;
      else if (terkecil === keKanan) pos.x = k.max.x + jari;
      else if (terkecil === keDepan) pos.z = k.min.z - jari;
      else pos.z = k.max.z + jari;
    } else {
      // Dekat sudut atau sisi: dorong sepanjang vektor dari titik terdekat.
      const tx = Math.min(Math.max(pos.x, k.min.x), k.max.x);
      const tz = Math.min(Math.max(pos.z, k.min.z), k.max.z);
      const jarak = Math.hypot(pos.x - tx, pos.z - tz) || 1e-6;
      pos.x = tx + ((pos.x - tx) / jarak) * jari;
      pos.z = tz + ((pos.z - tz) / jarak) * jari;
    }
  }

  const r = jari + 1;
  data.indeksPohon.dalamKotak(pos.x - r, pos.z - r, pos.x + r, pos.z + r, (t) => {
    const jarakMin = jari + t.jari;
    const dx = pos.x - t.x;
    const dz = pos.z - t.z;
    const d2 = dx * dx + dz * dz;
    if (d2 >= jarakMin * jarakMin) return;
    const d = Math.sqrt(d2) || 1e-6;
    pos.x = t.x + (dx / d) * jarakMin;
    pos.z = t.z + (dz / d) * jarakMin;
  });
}

/** Mendorong dua titik datar menjauh sampai berjarak `jarakMin`; `bagianA` = porsi geser untuk a. */
export function pisahkan(a: THREE.Vector3, b: THREE.Vector3, jarakMin: number, bagianA: number): void {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const d2 = dx * dx + dz * dz;
  if (d2 >= jarakMin * jarakMin) return;
  const d = Math.sqrt(d2) || 1e-6;
  const kurang = jarakMin - d;
  const nx = d2 > 1e-12 ? dx / d : 1;
  const nz = d2 > 1e-12 ? dz / d : 0;
  a.x -= nx * kurang * bagianA;
  a.z -= nz * kurang * bagianA;
  b.x += nx * kurang * (1 - bagianA);
  b.z += nz * kurang * (1 - bagianA);
}

export interface TargetPanjat {
  tujuan: THREE.Vector3;
}

/**
 * Mencari tebing yang bisa dipanjat dari posisi kaki pemain: pemain berdiri di dekat sisi tebing
 * (dalam 1 m dari dinding) dan puncaknya berada 1,2 sampai 2,8 m di atas kaki.
 */
export function cariTebing(data: DataTabrakan, pos: THREE.Vector3, jari: number): TargetPanjat | null {
  for (const p of data.padat) {
    if (!p.bisaDipanjat) continue;
    const k = p.kotak;
    const selisih = k.max.y - pos.y;
    if (selisih < 1.2 || selisih > 2.8) continue;

    const dx = Math.max(k.min.x - pos.x, 0, pos.x - k.max.x);
    const dz = Math.max(k.min.z - pos.z, 0, pos.z - k.max.z);
    const jangkauan = jari + 1.0;
    if (dx * dx + dz * dz > jangkauan * jangkauan) continue;

    // Tujuan: sedikit masuk ke atas tebing dari titik terdekat.
    const tx = Math.min(Math.max(pos.x, k.min.x), k.max.x);
    const tz = Math.min(Math.max(pos.z, k.min.z), k.max.z);
    const masuk = jari + 0.4;
    const arahX = tx - pos.x;
    const arahZ = tz - pos.z;
    const d = Math.hypot(arahX, arahZ) || 1e-6;
    const tujuan = new THREE.Vector3(tx + (arahX / d) * masuk, k.max.y, tz + (arahZ / d) * masuk);
    return { tujuan };
  }
  return null;
}
