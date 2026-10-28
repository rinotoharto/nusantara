import * as THREE from 'three';
import { tinggiMedan } from '../world/terrain';
import type { DataTabrakan } from '../world/collision';

/** Jumlah segmen busur kerucut pandang di lantai. */
const SEGMEN = 18;
const TINGGI_KERUCUT = 0.08; // sedikit di atas tanah supaya tidak berkedip dengan medan

/** Benar kalau ruas datar (x1,z1)-(x2,z2) memotong kotak sejajar sumbu `k` (hanya x dan z). */
function ruasMemotongKotak(x1: number, z1: number, x2: number, z2: number, k: THREE.Box3): boolean {
  const dx = x2 - x1;
  const dz = z2 - z1;
  let tMasuk = 0;
  let tKeluar = 1;
  for (const [p, d, min, maks] of [
    [x1, dx, k.min.x, k.max.x],
    [z1, dz, k.min.z, k.max.z],
  ]) {
    if (Math.abs(d) < 1e-9) {
      if (p < min || p > maks) return false;
      continue;
    }
    let t1 = (min - p) / d;
    let t2 = (maks - p) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMasuk = Math.max(tMasuk, t1);
    tKeluar = Math.min(tKeluar, t2);
    if (tMasuk > tKeluar) return false;
  }
  return true;
}

/** Benar kalau ruas datar memotong lingkaran berpusat (cx, cz) berjari `r`. */
function ruasMemotongLingkaran(x1: number, z1: number, x2: number, z2: number, cx: number, cz: number, r: number): boolean {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const panjang2 = dx * dx + dz * dz || 1e-9;
  let t = ((cx - x1) * dx + (cz - z1) * dz) / panjang2;
  t = Math.min(1, Math.max(0, t));
  const px = x1 + dx * t - cx;
  const pz = z1 + dz * t - cz;
  return px * px + pz * pz < r * r;
}

/**
 * Garis pandang dari mata pengamat ke sasaran bebas dari rumah, tebing, batu, dan batang pohon.
 * Diuji di bidang datar; benda padat menghalangi kalau puncaknya lebih tinggi dari mata.
 */
export function garisPandangBebas(
  data: DataTabrakan,
  dari: THREE.Vector3,
  ke: THREE.Vector3,
  tinggiMata: number,
  kotakTambahan: readonly THREE.Box3[] = [],
): boolean {
  const yMata = Math.min(dari.y, ke.y) + tinggiMata;
  for (const p of data.padat) {
    if (p.kotak.max.y <= yMata) continue;
    if (ruasMemotongKotak(dari.x, dari.z, ke.x, ke.z, p.kotak)) return false;
  }
  // Penghalang tambahan (semak) menutup pandangan walau lebih rendah dari mata.
  for (const k of kotakTambahan) {
    if (ruasMemotongKotak(dari.x, dari.z, ke.x, ke.z, k)) return false;
  }
  let terhalang = false;
  data.indeksPohon.dalamKotak(
    Math.min(dari.x, ke.x) - 1,
    Math.min(dari.z, ke.z) - 1,
    Math.max(dari.x, ke.x) + 1,
    Math.max(dari.z, ke.z) + 1,
    (t) => {
      if (ruasMemotongLingkaran(dari.x, dari.z, ke.x, ke.z, t.x, t.z, t.jari + 0.2)) {
        terhalang = true;
        return true;
      }
    },
  );
  return !terhalang;
}

export interface HasilPandang {
  terlihat: boolean;
  jarak: number;
}

/**
 * Uji apakah `sasaran` terlihat oleh pengamat di `posisi` yang menghadap `hadap`:
 * di dalam kerucut `sudutDerajat` sejauh `jarakMaks`, dan garis pandangnya tidak terhalang.
 */
export function ujiPandang(
  posisi: THREE.Vector3,
  hadap: number,
  sudutDerajat: number,
  jarakMaks: number,
  sasaran: THREE.Vector3,
  data: DataTabrakan,
  tinggiMata: number,
  kotakTambahan: readonly THREE.Box3[] = [],
): HasilPandang {
  const dx = sasaran.x - posisi.x;
  const dz = sasaran.z - posisi.z;
  const jarak = Math.hypot(dx, dz);
  if (jarak > jarakMaks) return { terlihat: false, jarak };
  if (jarak > 1e-4) {
    const cos = (Math.sin(hadap) * dx + Math.cos(hadap) * dz) / jarak;
    if (cos < Math.cos((sudutDerajat * Math.PI) / 180 / 2)) return { terlihat: false, jarak };
  }
  return { terlihat: garisPandangBebas(data, posisi, sasaran, tinggiMata, kotakTambahan), jarak };
}

/**
 * Kerucut pandang yang digambar di lantai sebagai kipas transparan mengikuti kontur medan.
 * Geometrinya dalam koordinat dunia dan diperbarui tiap frame.
 */
export class KerucutPandang {
  readonly mesh: THREE.Mesh;
  private readonly posisiAtribut: THREE.BufferAttribute;
  private readonly bahan: THREE.MeshBasicMaterial;

  constructor(
    private sudutDerajat: number,
    private jarak: number,
    opasitas = 0.22,
  ) {
    const geometri = new THREE.BufferGeometry();
    this.posisiAtribut = new THREE.BufferAttribute(new Float32Array((SEGMEN + 2) * 3), 3);
    this.posisiAtribut.setUsage(THREE.DynamicDrawUsage);
    geometri.setAttribute('position', this.posisiAtribut);
    const indeks: number[] = [];
    for (let i = 1; i <= SEGMEN; i++) indeks.push(0, i, i + 1);
    geometri.setIndex(indeks);
    this.bahan = new THREE.MeshBasicMaterial({
      color: 0x3fbf5a,
      transparent: true,
      opacity: opasitas,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geometri, this.bahan);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.mesh.name = 'kerucut-pandang';
  }

  perbarui(posisi: THREE.Vector3, hadap: number, warna: THREE.Color, faktorJarak = 1): void {
    const a = this.posisiAtribut;
    a.setXYZ(0, posisi.x, tinggiMedan(posisi.x, posisi.z) + TINGGI_KERUCUT, posisi.z);
    const setengah = (this.sudutDerajat * Math.PI) / 180 / 2;
    const r = this.jarak * faktorJarak;
    for (let i = 0; i <= SEGMEN; i++) {
      const sudut = hadap - setengah + (2 * setengah * i) / SEGMEN;
      const x = posisi.x + Math.sin(sudut) * r;
      const z = posisi.z + Math.cos(sudut) * r;
      a.setXYZ(i + 1, x, tinggiMedan(x, z) + TINGGI_KERUCUT, z);
    }
    a.needsUpdate = true;
    this.bahan.color.copy(warna);
  }

  set tampil(nilai: boolean) {
    this.mesh.visible = nilai;
  }
}
