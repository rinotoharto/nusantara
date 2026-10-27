import * as THREE from 'three';
import type { Pemain } from '../character/player';
import { JARI_PEMAIN } from '../character/player';
import type { DataTabrakan } from '../world/collision';
import { Lawan, JARI_LAWAN, type PemberiGiliran } from './enemy';
import { dalamJangkauan } from './hit';
import type { PertarunganPemain } from './player-combat';

/** Jarak seruan: lawan yang waspada membangunkan kawan sejauh ini. */
const JARAK_SERU = 10;

/** Penempatan lawan untuk pengujian: tiga di tanah lapang timur desa, satu sendirian di barat. */
const PENEMPATAN: { x: number; z: number }[] = [
  { x: 42, z: 2 },
  { x: 46, z: -2 },
  { x: 45, z: 6 },
  { x: -46, z: 0 },
];

/**
 * Mengelola semua lawan: pembaruan, tabrakan antar kapsul, serangan pemain yang mengenai lawan,
 * dan antrean giliran serangan supaya hanya satu lawan menyerang pada satu waktu.
 */
export class PengelolaLawan implements PemberiGiliran {
  readonly daftar: Lawan[] = [];
  private penyerang: Lawan | null = null;
  private readonly antrean: Lawan[] = [];

  constructor(data: DataTabrakan, scene: THREE.Scene) {
    for (const p of PENEMPATAN) {
      const lawan = new Lawan(data, p.x, p.z);
      scene.add(lawan.grup);
      this.daftar.push(lawan);
    }
  }

  mintaGiliran(lawan: Lawan): boolean {
    if (this.penyerang === lawan) return true;
    if (this.penyerang === null) {
      this.penyerang = lawan;
      this.hapusDariAntrean(lawan);
      return true;
    }
    if (!this.antrean.includes(lawan)) this.antrean.push(lawan);
    return false;
  }

  lepasGiliran(lawan: Lawan): void {
    if (this.penyerang === lawan) this.penyerang = null;
    this.hapusDariAntrean(lawan);
  }

  private hapusDariAntrean(lawan: Lawan): void {
    const i = this.antrean.indexOf(lawan);
    if (i >= 0) this.antrean.splice(i, 1);
  }

  /** Jarak ke lawan hidup terdekat dari `pos`, atau Infinity. */
  jarakTerdekat(pos: THREE.Vector3): number {
    let terdekat = Infinity;
    for (const l of this.daftar) {
      if (!l.hidup) continue;
      const d = Math.hypot(l.posisi.x - pos.x, l.posisi.z - pos.z);
      if (d < terdekat) terdekat = d;
    }
    return terdekat;
  }

  /** Lawan hidup terdekat dalam jarak `maks` dari `pos`, atau null. */
  lawanTerdekat(pos: THREE.Vector3, maks: number): Lawan | null {
    let terdekat: Lawan | null = null;
    let jarakTerdekat = maks;
    for (const l of this.daftar) {
      if (!l.hidup) continue;
      const d = Math.hypot(l.posisi.x - pos.x, l.posisi.z - pos.z);
      if (d < jarakTerdekat) {
        jarakTerdekat = d;
        terdekat = l;
      }
    }
    return terdekat;
  }

  hidupkanSemua(): void {
    for (const l of this.daftar) l.hidupkan();
    this.penyerang = null;
    this.antrean.length = 0;
  }

  perbarui(dt: number, pemain: Pemain, tarung: PertarunganPemain): void {
    this.bangunkanKawan();
    // Saat pemain gugur, AI dibekukan; lawan yang mati tetap menyelesaikan rebahnya.
    for (const l of this.daftar) {
      if (!tarung.mati || !l.hidup) l.perbarui(dt, pemain, tarung, this);
    }

    // Giliran yang macet (pemegangnya mati, diam, atau terhuyung) dilepas.
    if (this.penyerang) {
      const s = this.penyerang.status;
      if (s === 'mati' || s === 'diam' || s === 'terhuyung' || s === 'mundur') this.penyerang = null;
    }
    // Giliran kosong diberikan ke antrean paling depan yang masih siap.
    while (this.penyerang === null && this.antrean.length > 0) {
      const calon = this.antrean.shift()!;
      if (calon.hidup && (calon.status === 'mengelilingi' || calon.status === 'mendekat')) this.penyerang = calon;
    }

    this.pisahkanKapsul(pemain);

    // Serangan pemain mengenai setiap lawan hidup di dalam kerucut keris.
    const serangan = tarung.ambilSerangan();
    if (serangan) {
      for (const l of this.daftar) {
        if (!l.hidup) continue;
        if (dalamJangkauan(pemain.posisi, pemain.hadap, l.posisi, serangan.jangkauan, JARI_LAWAN, serangan.sudutKena)) {
          l.terkena(serangan, pemain.posisi);
        }
      }
    }
  }

  /** Lawan yang sudah waspada membangunkan kawan yang masih diam dalam jarak JARAK_SERU. */
  private bangunkanKawan(): void {
    for (const waspada of this.daftar) {
      if (!waspada.hidup || waspada.status === 'diam') continue;
      for (const kawan of this.daftar) {
        if (kawan.status !== 'diam') continue;
        if (kawan.posisi.distanceTo(waspada.posisi) < JARAK_SERU) kawan.waspada();
      }
    }
  }

  /** Lawan saling mendorong dan mendorong pemain supaya kapsul tidak menumpuk. */
  private pisahkanKapsul(pemain: Pemain): void {
    const hidup = this.daftar.filter((l) => l.hidup);
    for (let i = 0; i < hidup.length; i++) {
      for (let j = i + 1; j < hidup.length; j++) {
        pisahkan(hidup[i].posisi, hidup[j].posisi, JARI_LAWAN * 2, 0.5);
      }
      // Pemain lebih "berat": lawan yang lebih banyak bergeser.
      pisahkan(hidup[i].posisi, pemain.posisi, JARI_LAWAN + JARI_PEMAIN, 0.75);
    }
  }
}

/** Mendorong dua titik datar menjauh sampai berjarak `jarakMin`; `bagianA` = porsi geser untuk a. */
function pisahkan(a: THREE.Vector3, b: THREE.Vector3, jarakMin: number, bagianA: number): void {
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
