import * as THREE from 'three';

// Medan 300 x 300 m. Sumbu: +x = timur, -z = utara, +z = selatan.
// Tinggi medan dihitung oleh satu fungsi supaya pemain dan kamera bisa
// mengikuti kontur tanpa pustaka fisika.
export const UKURAN_MEDAN = 300;
export const SEGMEN_MEDAN = 150;

// Sungai mengalir timur ke barat di sebelah selatan desa.
export const Z_SUNGAI = 55;
export const LEBAR_SUNGAI = 14;
export const PERMUKAAN_AIR = -1.0;

function smoothstep(tepi0: number, tepi1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - tepi0) / (tepi1 - tepi0)));
  return t * t * (3 - 2 * t);
}

/** Tinggi tanah (meter) pada titik (x, z). */
export function tinggiMedan(x: number, z: number): number {
  // Bukit di utara: mulai naik di z = -45, puncak sekitar z = -140.
  const naik = smoothstep(0, 1, (-45 - z) / 95);
  const bukit = naik * 22 + naik * Math.sin(x * 0.035) * 3.5;

  // Gelombang lembut di seluruh medan, diratakan di sekitar desa.
  const gelombang =
    Math.sin(x * 0.05) * Math.cos(z * 0.04) * 0.8 + Math.sin(x * 0.13 + z * 0.09) * 0.3;
  const jarakDesa = Math.hypot(x, z);
  const faktorDesa = smoothstep(25, 60, jarakDesa);

  // Cekungan sungai berbentuk lonceng.
  const dz = z - Z_SUNGAI;
  const sigma = LEBAR_SUNGAI / 2.5;
  const parit = Math.exp(-(dz * dz) / (2 * sigma * sigma)) * 2.6;

  return bukit + gelombang * faktorDesa - parit;
}

/** Membuat mesh medan dari fungsi tinggi. */
export function buatMedan(): THREE.Mesh {
  const geometri = new THREE.PlaneGeometry(UKURAN_MEDAN, UKURAN_MEDAN, SEGMEN_MEDAN, SEGMEN_MEDAN);
  geometri.rotateX(-Math.PI / 2);

  const posisi = geometri.attributes.position as THREE.BufferAttribute;
  const warna = new Float32Array(posisi.count * 3);
  const hijau = new THREE.Color(0x5e7a36);
  const cokelat = new THREE.Color(0x6b5a3a);
  const pasir = new THREE.Color(0x8a7a55);
  const sementara = new THREE.Color();

  for (let i = 0; i < posisi.count; i++) {
    const x = posisi.getX(i);
    const z = posisi.getZ(i);
    const y = tinggiMedan(x, z);
    posisi.setY(i, y);

    // Warna: tepi sungai berpasir, lereng curam kecokelatan, sisanya hijau.
    if (y < PERMUKAAN_AIR + 0.8) {
      sementara.copy(pasir);
    } else {
      const lereng = Math.abs(tinggiMedan(x + 1, z) - y) + Math.abs(tinggiMedan(x, z + 1) - y);
      sementara.copy(hijau).lerp(cokelat, Math.min(1, Math.max(0, lereng - 0.15) * 0.9));
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
