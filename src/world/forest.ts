import * as THREE from 'three';
import { tinggiMedan, PERMUKAAN_AIR, titikTerdekatJalur, type TitikJalur } from './terrain';
import { DUNIA, type Titik2 } from './world-config';

// Pembangkit acak dengan benih tetap supaya tata letak hutan tidak berubah tiap muat.
export function acakBerbenih(benih: number): () => number {
  let a = benih >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Pohon {
  x: number;
  z: number;
  jari: number;
}

/** Indeks pohon per sel supaya tabrakan dan garis pandang tidak memeriksa ribuan pohon sekaligus. */
export class IndeksPohon {
  private readonly sel = new Map<number, Pohon[]>();
  constructor(
    readonly semua: Pohon[],
    private readonly ukuranSel = 12,
  ) {
    for (const p of semua) this.selDi(p.x, p.z, true)?.push(p);
  }

  private kunci(ix: number, iz: number): number {
    return (ix + 1000) * 4096 + (iz + 1000);
  }

  private selDi(x: number, z: number, buat: boolean): Pohon[] | undefined {
    const k = this.kunci(Math.floor(x / this.ukuranSel), Math.floor(z / this.ukuranSel));
    let d = this.sel.get(k);
    if (!d && buat) {
      d = [];
      this.sel.set(k, d);
    }
    return d;
  }

  /** Memanggil `fn` untuk tiap pohon di sel yang bersinggungan dengan kotak datar. */
  dalamKotak(xMin: number, zMin: number, xMaks: number, zMaks: number, fn: (p: Pohon) => boolean | void): void {
    const ix0 = Math.floor(xMin / this.ukuranSel);
    const ix1 = Math.floor(xMaks / this.ukuranSel);
    const iz0 = Math.floor(zMin / this.ukuranSel);
    const iz1 = Math.floor(zMaks / this.ukuranSel);
    for (let ix = ix0; ix <= ix1; ix++) {
      for (let iz = iz0; iz <= iz1; iz++) {
        const d = this.sel.get(this.kunci(ix, iz));
        if (!d) continue;
        for (const p of d) if (fn(p) === true) return;
      }
    }
  }
}

export interface Hutan {
  grup: THREE.Group;
  pohon: Pohon[];
  indeks: IndeksPohon;
  /** Menyembunyikan petak yang lebih jauh dari `jarakLod` dari kamera. */
  perbaruiLod: (posisiKamera: THREE.Vector3) => void;
}

interface JenisPohon {
  batang: [number, number];
  tajuk: [number, number];
  jariTajuk: [number, number];
  jariBatang: number;
  warnaTajuk: number;
}
const JENIS: Record<string, JenisPohon> = {
  // Rimba: batang pendek, tajuk kerucut besar.
  rimba: { batang: [2, 4], tajuk: [4, 8], jariTajuk: [1.6, 3.2], jariBatang: 0.4, warnaTajuk: 0x2f5a2a },
  // Jati: batang tinggi dan rapat, tajuk kecil lebih terang.
  jati: { batang: [5, 7.5], tajuk: [3, 4.5], jariTajuk: [1.4, 2.2], jariBatang: 0.42, warnaTajuk: 0x4f7a35 },
};

interface Calon {
  x: number;
  z: number;
  jenis: JenisPohon;
}

/** Hutan dari silinder (batang) dan kerucut (tajuk) per petak dengan instancing, tata letak dari data `dunia.hutan`. */
export function buatHutan(): Hutan {
  const H = DUNIA.hutan;
  const acak = acakBerbenih(1293);
  const jalurSungai = DUNIA.sungai.jalur as Titik2[];
  const jalurJalan = DUNIA.jalan.jalur as Titik2[][];
  const tj: TitikJalur = { jarak: 0, x: 0, z: 0, sisi: 1, arahX: 0, arahZ: 0 };
  const pandakan = DUNIA.pandakan;
  const setengah = DUNIA.ukuran / 2 - 6;

  /** Menolak tempat yang tidak cocok: desa, dukuh, air, jalan setapak, lereng curam. */
  function cocok(x: number, z: number): boolean {
    if (Math.abs(x) > setengah || Math.abs(z) > setengah) return false;
    if (Math.hypot(x, z) < H.hindari.desa) return false;
    for (const r of pandakan) if (Math.hypot(x - r.x, z - r.z) < 9) return false;
    const y = tinggiMedan(x, z);
    if (y < PERMUKAAN_AIR + H.hindari.air) return false;
    const lereng = Math.abs(tinggiMedan(x + 1, z) - y) + Math.abs(tinggiMedan(x, z + 1) - y);
    if (lereng > H.hindari.lerengMaks) return false;
    for (const j of jalurJalan) if (titikTerdekatJalur(j, x, z, tj).jarak < H.hindari.jalan) return false;
    return true;
  }

  const calon: Calon[] = [];
  for (const area of H.area) {
    const jenis = JENIS[area.jenis] ?? JENIS.rimba;
    const jarak = area.jarak;
    if (area.kotak) {
      const [x0, z0, x1, z1] = area.kotak;
      for (let z = z0; z <= z1; z += jarak) {
        for (let x = x0; x <= x1; x += jarak) {
          const px = x + (acak() - 0.5) * jarak * 0.9;
          const pz = z + (acak() - 0.5) * jarak * 0.9;
          if (cocok(px, pz)) calon.push({ x: px, z: pz, jenis });
        }
      }
    } else if (area.pita) {
      // Pita sejajar sungai di satu sisi: kisi segitiga rapat, lalu disaring menurut jarak ke jalur.
      const p = area.pita;
      const sisi = p.sisi === 'timur-laut' ? 1 : -1;
      const x0 = Math.min(p.xMulai, p.xSelesai);
      const x1 = Math.max(p.xMulai, p.xSelesai);
      const zMin = -DUNIA.ukuran / 2;
      const zMaks = DUNIA.ukuran / 2;
      let baris = 0;
      for (let z = zMin; z <= zMaks; z += jarak * 0.87, baris++) {
        for (let x = x0 - p.sampaiJarak; x <= x1 + p.sampaiJarak; x += jarak) {
          const px = x + (baris % 2) * jarak * 0.5 + (acak() - 0.5) * jarak * 0.3;
          const pz = z + (acak() - 0.5) * jarak * 0.3;
          const t = titikTerdekatJalur(jalurSungai, px, pz, tj);
          if (t.sisi !== sisi || t.jarak < p.dariJarak || t.jarak > p.sampaiJarak) continue;
          if (t.x < x0 || t.x > x1) continue;
          if (cocok(px, pz)) calon.push({ x: px, z: pz, jenis });
        }
      }
    }
  }

  // Kelompokkan per petak; tiap petak satu InstancedMesh batang dan satu tajuk.
  const petak = new Map<number, Calon[]>();
  const ukuranPetak = H.petak;
  const jumlahPetak = Math.ceil(DUNIA.ukuran / ukuranPetak);
  for (const c of calon) {
    const ix = Math.min(jumlahPetak - 1, Math.floor((c.x + DUNIA.ukuran / 2) / ukuranPetak));
    const iz = Math.min(jumlahPetak - 1, Math.floor((c.z + DUNIA.ukuran / 2) / ukuranPetak));
    const k = ix * 1000 + iz;
    let d = petak.get(k);
    if (!d) {
      d = [];
      petak.set(k, d);
    }
    d.push(c);
  }

  const geoBatang = new THREE.CylinderGeometry(0.25, 0.35, 1, 6);
  const geoTajuk = new THREE.ConeGeometry(1, 1, 7);
  const bahanBatang = new THREE.MeshStandardMaterial({ color: 0x5a3f28, roughness: 1 });
  const bahanTajuk = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
  const grup = new THREE.Group();
  grup.name = 'hutan';
  const pohon: Pohon[] = [];
  const m = new THREE.Matrix4();
  const warna = new THREE.Color();
  const daftarPetak: { mesh: THREE.Group; xMin: number; zMin: number; xMaks: number; zMaks: number }[] = [];

  for (const [k, isi] of petak) {
    const batang = new THREE.InstancedMesh(geoBatang, bahanBatang, isi.length);
    const tajuk = new THREE.InstancedMesh(geoTajuk, bahanTajuk, isi.length);
    batang.castShadow = true;
    tajuk.castShadow = true;
    tajuk.receiveShadow = true;
    let xMin = Infinity;
    let zMin = Infinity;
    let xMaks = -Infinity;
    let zMaks = -Infinity;
    isi.forEach((c, i) => {
      const j = c.jenis;
      const y = tinggiMedan(c.x, c.z);
      const tinggiBatang = j.batang[0] + acak() * (j.batang[1] - j.batang[0]);
      const tinggiTajuk = j.tajuk[0] + acak() * (j.tajuk[1] - j.tajuk[0]);
      const jariTajuk = j.jariTajuk[0] + acak() * (j.jariTajuk[1] - j.jariTajuk[0]);
      m.makeScale(1, tinggiBatang, 1).setPosition(c.x, y + tinggiBatang / 2, c.z);
      batang.setMatrixAt(i, m);
      m.makeScale(jariTajuk, tinggiTajuk, jariTajuk).setPosition(c.x, y + tinggiBatang + tinggiTajuk / 2, c.z);
      tajuk.setMatrixAt(i, m);
      warna.setHex(j.warnaTajuk).offsetHSL(0, 0, (acak() - 0.5) * 0.06);
      tajuk.setColorAt(i, warna);
      pohon.push({ x: c.x, z: c.z, jari: j.jariBatang });
      xMin = Math.min(xMin, c.x);
      zMin = Math.min(zMin, c.z);
      xMaks = Math.max(xMaks, c.x);
      zMaks = Math.max(zMaks, c.z);
    });
    batang.instanceMatrix.needsUpdate = true;
    tajuk.instanceMatrix.needsUpdate = true;
    if (tajuk.instanceColor) tajuk.instanceColor.needsUpdate = true;
    const meshPetak = new THREE.Group();
    meshPetak.name = `petak-${k}`;
    meshPetak.add(batang, tajuk);
    grup.add(meshPetak);
    daftarPetak.push({ mesh: meshPetak, xMin, zMin, xMaks, zMaks });
  }

  const perbaruiLod = (kamera: THREE.Vector3): void => {
    for (const p of daftarPetak) {
      const dx = Math.max(p.xMin - kamera.x, 0, kamera.x - p.xMaks);
      const dz = Math.max(p.zMin - kamera.z, 0, kamera.z - p.zMaks);
      p.mesh.visible = dx * dx + dz * dz < H.jarakLod * H.jarakLod;
    }
  };

  return { grup, pohon, indeks: new IndeksPohon(pohon), perbaruiLod };
}
