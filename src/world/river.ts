import * as THREE from 'three';
import { PERMUKAAN_AIR, setengahJalurAir } from './terrain';
import { DUNIA, type Titik2 } from './world-config';

const bahanAir = new THREE.MeshStandardMaterial({
  color: 0x2f6f9a,
  roughness: 0.25,
  metalness: 0.1,
  transparent: true,
  opacity: 0.85,
});

/** Jarak antar titik contoh pita air sepanjang jalur sungai (meter). */
const LANGKAH_PITA = 10;

/**
 * Titik contoh sepanjang polyline: tiap simpul ditambah titik sisipan tiap `langkah` meter, supaya
 * lebar pita bisa mengikuti perubahan lebar sungai dan tikungan tidak menyempit.
 */
function contohJalur(jalur: Titik2[], langkah: number): Titik2[] {
  const hasil: Titik2[] = [jalur[0]];
  for (let i = 0; i < jalur.length - 1; i++) {
    const [ax, az] = jalur[i];
    const [bx, bz] = jalur[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / langkah));
    for (let k = 1; k <= n; k++) hasil.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
  }
  return hasil;
}

/**
 * Bidang air biru: pita mengikuti jalur sungai dengan lebar dari `setengahJalurAir` (sama dengan
 * `diJalurAir`) ditambah `pitaMargin`, dan cakram di teluk muara. Bagian pita yang berada di bawah
 * tanah tidak terlihat, jadi margin hanya menutup cekungan tepi yang berada di bawah permukaan.
 */
export function buatSungai(): THREE.Group {
  const grup = new THREE.Group();
  const S = DUNIA.sungai;
  const contoh = contohJalur(S.jalur as Titik2[], LANGKAH_PITA);
  const titik: number[] = [];
  const indeks: number[] = [];
  for (let i = 0; i < contoh.length; i++) {
    const [x, z] = contoh[i];
    // Arah rata-rata ruas sebelum dan sesudah supaya sambungan di tikungan rapi.
    const sebelum = contoh[Math.max(0, i - 1)];
    const sesudah = contoh[Math.min(contoh.length - 1, i + 1)];
    let ax = sesudah[0] - sebelum[0];
    let az = sesudah[1] - sebelum[1];
    const panjang = Math.hypot(ax, az) || 1;
    ax /= panjang;
    az /= panjang;
    const setengah = setengahJalurAir(x) + S.pitaMargin;
    titik.push(x - az * setengah, PERMUKAAN_AIR, z + ax * setengah, x + az * setengah, PERMUKAAN_AIR, z - ax * setengah);
    if (i > 0) {
      // Urutan berlawanan jarum jam dilihat dari atas, supaya sisi depan (normal +y) menghadap kamera;
      // urutan sebelumnya membuat pita menghadap ke bawah dan tidak pernah terlihat dari atas.
      const a = (i - 1) * 2;
      indeks.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
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
  const geoTeluk = new THREE.CircleGeometry(M.sigma * 1.7 + S.pitaMargin, 32);
  geoTeluk.rotateX(-Math.PI / 2);
  const teluk = new THREE.Mesh(geoTeluk, bahanAir);
  teluk.position.set(M.x, PERMUKAAN_AIR - 0.01, M.z);
  teluk.receiveShadow = true;
  teluk.name = 'teluk';
  grup.add(teluk);
  return grup;
}
