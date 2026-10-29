import type * as THREE from 'three';
import type { Pemain } from '../character/player';
import { JARI_PEMAIN } from '../character/player';
import { pisahkan } from '../world/collision';
import { Lawan, JARI_LAWAN, type PemberiGiliran } from './enemy';
import { dalamJangkauan, menghadap } from './hit';
import type { PertarunganPemain } from './player-combat';

/** Jarak seruan: lawan yang waspada membangunkan kawan sejauh ini. */
const JARAK_SERU = 10;

/**
 * Mengelola semua lawan: pembaruan, tabrakan antar kapsul, serangan pemain yang mengenai lawan,
 * dan antrean giliran serangan supaya hanya satu lawan menyerang pada satu waktu.
 */
export class PengelolaLawan implements PemberiGiliran {
  readonly daftar: Lawan[] = [];
  private penyerang: Lawan | null = null;
  private readonly antrean: Lawan[] = [];

  /** Semua lawan dibuat modul lain (penjaga dari data misi) dan didaftarkan lewat `tambah`. */
  constructor() {}

  /** Mendaftarkan lawan yang dibuat modul lain (misalnya penjaga) supaya ikut aturan yang sama. */
  tambah(lawan: Lawan): void {
    this.daftar.push(lawan);
  }

  /** Mencabut lawan dari pengelolaan (misalnya penjaga bersyarat saat misi diulang). */
  hapus(lawan: Lawan): void {
    const i = this.daftar.indexOf(lawan);
    if (i >= 0) this.daftar.splice(i, 1);
    this.lepasGiliran(lawan);
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

  /** Jarak ke lawan terdekat yang sedang bertarung dari `pos`, atau Infinity. */
  jarakTerdekat(pos: THREE.Vector3): number {
    let terdekat = Infinity;
    for (const l of this.daftar) {
      if (!l.bertarung) continue;
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

  /** Lawan terhuyung terdekat dalam jarak `maks` dari `pos`, untuk Tikaman Keris. */
  lawanTerhuyungTerdekat(pos: THREE.Vector3, maks: number): Lawan | null {
    let terdekat: Lawan | null = null;
    let jarakTerdekat = maks;
    for (const l of this.daftar) {
      if (l.status !== 'terhuyung') continue;
      const d = Math.hypot(l.posisi.x - pos.x, l.posisi.z - pos.z) - JARI_LAWAN;
      if (d < jarakTerdekat) {
        jarakTerdekat = d;
        terdekat = l;
      }
    }
    return terdekat;
  }

  /**
   * Lawan lengah terdekat yang bisa disergap dari `pos`: dalam `maks` meter dari tepi kapsulnya dan
   * `pos` berada di dalam kerucut `sudutBelakang` di belakang arah hadapnya (Sergap).
   */
  lawanBisaDisergap(pos: THREE.Vector3, maks: number, sudutBelakang: number): Lawan | null {
    let terdekat: Lawan | null = null;
    let jarakTerdekat = maks;
    for (const l of this.daftar) {
      if (!l.bisaDisergap) continue;
      const d = Math.hypot(l.posisi.x - pos.x, l.posisi.z - pos.z) - JARI_LAWAN;
      if (d >= jarakTerdekat) continue;
      if (Math.abs(l.posisi.y - pos.y) > 1.5) continue;
      if (!menghadap(l.posisi, l.hadap + Math.PI, pos, sudutBelakang)) continue;
      jarakTerdekat = d;
      terdekat = l;
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

    // Giliran yang macet dilepas: hanya lawan yang sedang mendekat, mengelilingi, atau menyerang yang memegangnya.
    if (this.penyerang) {
      const s = this.penyerang.status;
      if (s !== 'mendekat' && s !== 'mengelilingi' && s !== 'bersiap' && s !== 'menyerang') this.penyerang = null;
    }
    // Giliran kosong diberikan ke antrean paling depan yang masih siap.
    while (this.penyerang === null && this.antrean.length > 0) {
      const calon = this.antrean.shift()!;
      if (calon.hidup && (calon.status === 'mengelilingi' || calon.status === 'mendekat')) this.penyerang = calon;
    }

    this.pisahkanKapsul(pemain);

    // Serangan pemain mengenai setiap lawan hidup di dalam kerucut keris;
    // serangan bersasaran (Tikaman Keris) hanya mengenai sasarannya.
    const serangan = tarung.ambilSerangan();
    if (serangan) {
      for (const l of this.daftar) {
        if (!l.hidup) continue;
        if (serangan.sasaran && serangan.sasaran !== l) continue;
        if (dalamJangkauan(pemain.posisi, pemain.hadap, l.posisi, serangan.jangkauan, JARI_LAWAN, serangan.sudutKena)) {
          l.terkena(serangan, pemain.posisi);
        }
      }
    }
  }

  /** Lawan yang sudah waspada membangunkan kawan yang masih diam dalam jarak JARAK_SERU. */
  private bangunkanKawan(): void {
    for (const waspada of this.daftar) {
      if (!waspada.bertarung || waspada.status === 'diam') continue;
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
      // Pemain lebih "berat": lawan yang lebih banyak bergeser. Terkaman harimau dibiarkan menembus.
      if (!hidup[i].menembus) pisahkan(hidup[i].posisi, pemain.posisi, JARI_LAWAN + JARI_PEMAIN, 0.75);
    }
  }
}
