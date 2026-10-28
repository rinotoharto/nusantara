import * as THREE from 'three';
import { DUNIA, type Titik2 } from './world-config';

// Medan persegi UKURAN_MEDAN x UKURAN_MEDAN m. Sumbu: +x = timur, -z = utara, +z = selatan.
// Tinggi medan dihitung oleh satu fungsi supaya pemain, kamera, dan peta mengikuti kontur
// yang sama tanpa pustaka fisika. Semua angka tata letak ada di misi3.json bagian `dunia`.
export const UKURAN_MEDAN = DUNIA.ukuran;
export const SEGMEN_MEDAN = 400;
export const PERMUKAAN_AIR = DUNIA.sungai.permukaanAir;
export const LEBAR_SUNGAI = DUNIA.sungai.lebar;
const S = DUNIA.sungai;
const B = DUNIA.bukit;
const M = DUNIA.muara;
const JALUR_SUNGAI = S.jalur as Titik2[];
const JALUR_BUKIT = B.jalur as Titik2[];

function smoothstep(tepi0: number, tepi1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - tepi0) / (tepi1 - tepi0)));
  return t * t * (3 - 2 * t);
}

/** Hasil pencarian titik terdekat pada sebuah polyline. */
export interface TitikJalur {
  /** Jarak datar ke jalur. */
  jarak: number;
  /** Titik terdekat di jalur. */
  x: number;
  z: number;
  /** Sisi: +1 kalau silang arah jalur dengan titik positif (jalur ke barat: utara, +1; selatan, -1), -1 sebaliknya. */
  sisi: number;
  /** Arah satuan jalur pada ruas terdekat. */
  arahX: number;
  arahZ: number;
}

/** Titik terdekat pada polyline `jalur` dari (x, z). */
export function titikTerdekatJalur(jalur: Titik2[], x: number, z: number, keluar: TitikJalur): TitikJalur {
  let terbaik = Infinity;
  for (let i = 0; i < jalur.length - 1; i++) {
    const ax = jalur[i][0];
    const az = jalur[i][1];
    const dx = jalur[i + 1][0] - ax;
    const dz = jalur[i + 1][1] - az;
    const panjang2 = dx * dx + dz * dz || 1e-9;
    const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / panjang2));
    const px = ax + dx * t;
    const pz = az + dz * t;
    const d2 = (x - px) * (x - px) + (z - pz) * (z - pz);
    if (d2 < terbaik) {
      terbaik = d2;
      const panjang = Math.sqrt(panjang2);
      keluar.x = px;
      keluar.z = pz;
      keluar.arahX = dx / panjang;
      keluar.arahZ = dz / panjang;
      const silang = keluar.arahX * (z - pz) - keluar.arahZ * (x - px);
      keluar.sisi = silang >= 0 ? 1 : -1;
    }
  }
  keluar.jarak = Math.sqrt(terbaik);
  return keluar;
}

const sementaraSungai: TitikJalur = { jarak: 0, x: 0, z: 0, sisi: 1, arahX: 0, arahZ: 0 };
const sementaraBukit: TitikJalur = { jarak: 0, x: 0, z: 0, sisi: 1, arahX: 0, arahZ: 0 };

/** Pengali bagian deras (0 di timur, 1 di barat `deras.xMulai`). */
function faktorDeras(x: number): number {
  return smoothstep(0, 1, (S.deras.xMulai - x) / S.deras.peralihan);
}

/** Pengali tebing curam di sisi selatan punggung bukit menurut x: 1 di antara xMulai dan xSelesai. */
function faktorCuram(x: number): number {
  const c = B.curam;
  return smoothstep(0, 1, (c.xMulai - x) / c.peralihan) * (1 - smoothstep(0, 1, (c.xSelesai - x) / c.peralihan));
}

/** Tinggi tanah (meter) pada titik (x, z). */
export function tinggiMedan(x: number, z: number): number {
  // Gelombang lembut di seluruh medan, diratakan di sekitar desa.
  const gelombang = Math.sin(x * 0.05) * Math.cos(z * 0.04) * 0.8 + Math.sin(x * 0.13 + z * 0.09) * 0.3;
  const jarakDesa = Math.hypot(x, z);
  const faktorDesa = smoothstep(25, 60, jarakDesa);

  // Punggung bukit: landai di sisi utara, di sisi selatan landai dekat desa dan di celah muara, curam di antaranya.
  const tb = titikTerdekatJalur(JALUR_BUKIT, x, z, sementaraBukit);
  const dBukit = Math.max(0, tb.jarak - B.lebarPuncak / 2);
  // Jalur bukit menuju barat: sisi selatan bernilai -1.
  const selatan = tb.sisi < 0;
  const lerengSelatan = B.lerengLandai + (B.lerengCuram - B.lerengLandai) * faktorCuram(x);
  const lereng = selatan ? lerengSelatan : B.lerengUtara;
  const bukit = B.tinggi * (1 - smoothstep(0, 1, dBukit / lereng));

  // Cekungan sungai berbentuk lonceng mengikuti jalur; di barat lebih lebar dan dalam.
  const ts = titikTerdekatJalur(JALUR_SUNGAI, x, z, sementaraSungai);
  const deras = faktorDeras(x);
  const lebar = S.lebar + S.deras.lebarTambahan * deras;
  const sigma = lebar / 2.5;
  let parit = Math.exp(-(ts.jarak * ts.jarak) / (2 * sigma * sigma)) * (S.dalam + S.deras.dalamTambahan * deras);
  // Tempat dangkal penyeberangan (hanya di bagian lurus timur): cekungan tinggal 30 persen.
  const dangkal = 1 - smoothstep(0, 1, Math.abs(x - S.dangkal.x) / (S.dangkal.lebar / 2));
  parit *= 1 - 0.7 * dangkal;
  // Teluk muara: cekungan bundar tambahan.
  const dm = Math.hypot(x - M.x, z - M.z);
  parit += Math.exp(-(dm * dm) / (2 * M.sigma * M.sigma)) * M.dalam;

  return bukit + gelombang * faktorDesa - parit;
}

/** Benar kalau (x, z) berada di jalur air (sungai atau teluk muara), untuk peta dan pewarnaan. */
export function diJalurAir(x: number, z: number): boolean {
  const ts = titikTerdekatJalur(JALUR_SUNGAI, x, z, sementaraSungai);
  const lebar = S.lebar + S.deras.lebarTambahan * faktorDeras(x);
  return ts.jarak < lebar / 2 + 3 || Math.hypot(x - M.x, z - M.z) < M.sigma * 1.6;
}

/**
 * Arus deras di bagian barat sungai: kalau kaki di (x, z, y) terlalu dalam, mengembalikan
 * dorongan datar (m/s) ke tepi terdekat; null kalau aman. Dipakai pemain dan pengikut.
 */
export function arusSungai(x: number, z: number, y: number, keluar: THREE.Vector3): THREE.Vector3 | null {
  if (y > PERMUKAAN_AIR - S.deras.batasDalam) return null;
  const deras = faktorDeras(x);
  if (deras < 0.5) return null;
  const ts = titikTerdekatJalur(JALUR_SUNGAI, x, z, sementaraSungai);
  // Tegak lurus jalur ke arah sisi pemain.
  let nx = -ts.arahZ * ts.sisi;
  let nz = ts.arahX * ts.sisi;
  if (ts.jarak < 0.5) {
    nx = 0;
    nz = 1;
  }
  return keluar.set(nx * S.deras.dorong, 0, nz * S.deras.dorong);
}

/** Kemiringan maksimum yang masih bisa dilalui (tangen dari `dunia.lerengMaksDerajat`). */
export const LERENG_MAKS = Math.tan((DUNIA.lerengMaksDerajat * Math.PI) / 180);

/** Membuat mesh medan dari fungsi tinggi, dengan warna menurut tinggi, lereng, air, dan jalan setapak. */
export function buatMedan(): THREE.Mesh {
  const geometri = new THREE.PlaneGeometry(UKURAN_MEDAN, UKURAN_MEDAN, SEGMEN_MEDAN, SEGMEN_MEDAN);
  geometri.rotateX(-Math.PI / 2);

  const posisi = geometri.attributes.position as THREE.BufferAttribute;
  const n = SEGMEN_MEDAN + 1;
  const tinggi = new Float32Array(posisi.count);
  for (let i = 0; i < posisi.count; i++) {
    const y = tinggiMedan(posisi.getX(i), posisi.getZ(i));
    tinggi[i] = y;
    posisi.setY(i, y);
  }

  const warna = new Float32Array(posisi.count * 3);
  const hijau = new THREE.Color(0x5e7a36);
  const cokelat = new THREE.Color(0x6b5a3a);
  const pasir = new THREE.Color(0x8a7a55);
  const jalan = new THREE.Color(0x9c8a5c);
  const sementara = new THREE.Color();
  const jalurJalan = DUNIA.jalan.jalur as Titik2[][];
  const tj: TitikJalur = { jarak: 0, x: 0, z: 0, sisi: 1, arahX: 0, arahZ: 0 };
  const langkah = UKURAN_MEDAN / SEGMEN_MEDAN;

  for (let i = 0; i < posisi.count; i++) {
    const x = posisi.getX(i);
    const z = posisi.getZ(i);
    const y = tinggi[i];
    const kolom = i % n;
    const baris = Math.floor(i / n);
    const yKanan = tinggi[baris * n + Math.min(n - 1, kolom + 1)];
    const yBawah = tinggi[Math.min(n - 1, baris + 1) * n + kolom];
    const lereng = (Math.abs(yKanan - y) + Math.abs(yBawah - y)) / langkah;

    // Warna: tepi air berpasir, lereng curam kecokelatan, sisanya hijau; jalan setapak lebih terang.
    if (y < PERMUKAAN_AIR + 0.8 && diJalurAir(x, z)) {
      sementara.copy(pasir);
    } else {
      sementara.copy(hijau).lerp(cokelat, Math.min(1, Math.max(0, lereng - 0.15) * 0.9));
      let jarakJalan = Infinity;
      for (const jalur of jalurJalan) jarakJalan = Math.min(jarakJalan, titikTerdekatJalur(jalur, x, z, tj).jarak);
      const diJalan = 1 - smoothstep(DUNIA.jalan.lebar / 2 - 0.5, DUNIA.jalan.lebar / 2 + 0.6, jarakJalan);
      if (diJalan > 0) sementara.lerp(jalan, diJalan);
    }
    warna[i * 3] = sementara.r;
    warna[i * 3 + 1] = sementara.g;
    warna[i * 3 + 2] = sementara.b;
  }
  geometri.setAttribute('color', new THREE.BufferAttribute(warna, 3));
  geometri.computeVertexNormals();

  const bahan = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  const medan = new THREE.Mesh(geometri, bahan);
  medan.receiveShadow = true;
  medan.name = 'medan';
  return medan;
}
