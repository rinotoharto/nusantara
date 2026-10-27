import * as THREE from 'three';
import type { Input } from './input';
import { tinggiLantai, dorongKeluar, cariTebing, type DataTabrakan } from '../world/collision';
import { PERMUKAAN_AIR, UKURAN_MEDAN } from '../world/terrain';
import { SILUMAN } from '../stealth/config';

export const TINGGI_PEMAIN = 1.7;
export const JARI_PEMAIN = 0.35;

const KECEPATAN_JALAN = 4;
const KECEPATAN_LARI = 7.5;
const PERCEPATAN = 30;
const GRAVITASI = 22;
const LOMPAT = 7; // tinggi lompat sekitar 1,1 m, tidak cukup untuk tebing 2 m
const LAMA_PANJAT = 0.7;
const MIRING_MAKS = 0.2; // radian, kapsul condong ke arah gerak

/** Perintah dari modul pertarungan yang mengubah cara pemain bergerak pada satu frame. */
export interface PerintahGerak {
  /** Abaikan WASD. */
  kunciGerak: boolean;
  /** Pengali kecepatan maksimum, 1 = normal. */
  pengaliKecepatan: number;
  /** Kecepatan datar paksa (m/s) untuk frame ini, misalnya luncuran hindar; null = tidak ada. */
  dorongan: THREE.Vector3 | null;
  /** Arah hadap yang dikunci (radian); null = ikut arah gerak. */
  hadapPaksa: number | null;
  bolehLompat: boolean;
}

export const PERINTAH_BEBAS: Readonly<PerintahGerak> = {
  kunciGerak: false,
  pengaliKecepatan: 1,
  dorongan: null,
  hadapPaksa: null,
  bolehLompat: true,
};

/** Arah gerak dari WASD relatif terhadap yaw kamera, sudah dinormalkan. */
export function arahInputRelatifKamera(input: Input, yawKamera: number): { x: number; z: number; ada: boolean } {
  const depanX = -Math.sin(yawKamera);
  const depanZ = -Math.cos(yawKamera);
  const kananX = Math.cos(yawKamera);
  const kananZ = -Math.sin(yawKamera);
  let gx = 0;
  let gz = 0;
  if (input.ditekan('KeyW')) { gx += depanX; gz += depanZ; }
  if (input.ditekan('KeyS')) { gx -= depanX; gz -= depanZ; }
  if (input.ditekan('KeyD')) { gx += kananX; gz += kananZ; }
  if (input.ditekan('KeyA')) { gx -= kananX; gz -= kananZ; }
  const panjang = Math.hypot(gx, gz);
  if (panjang > 0) return { x: gx / panjang, z: gz / panjang, ada: true };
  return { x: 0, z: 0, ada: false };
}

/** Pemain berupa kapsul. `posisi` adalah titik kaki. */
export class Pemain {
  readonly grup = new THREE.Group();
  readonly posisi = this.grup.position;
  /** Berputar ke arah hadap dan condong saat lari. */
  readonly badan = new THREE.Group();
  /** Anak `badan`; modul pertarungan memakai ini untuk condong, meluncur, dan memasang keris. */
  readonly pose = new THREE.Group();
  readonly kapsul: THREE.Mesh<THREE.CapsuleGeometry, THREE.MeshStandardMaterial>;
  private readonly kecepatan = new THREE.Vector3();
  private kecepatanY = 0;
  diTanah = false;
  /** Arah hadap (radian); 0 = menghadap +z (selatan). */
  hadap = 0;
  private miring = 0;
  /** Berjongkok (tombol C): lebih lambat, tidak bisa lari atau lompat, kapsul memendek. */
  jongkok = false;
  /** Skala tinggi badan sekarang, 1 berdiri, menuju `skalaJongkok` saat jongkok; dipakai modul pertarungan. */
  skalaBadan = 1;
  /** Batas kecepatan dari misi (m/s), misalnya saat membawa Gajah Pagon; null = normal. */
  batasLaju: number | null = null;

  private panjatDari: THREE.Vector3 | null = null;
  private panjatKe: THREE.Vector3 | null = null;
  private panjatWaktu = 0;

  constructor(private data: DataTabrakan) {
    const geometri = new THREE.CapsuleGeometry(JARI_PEMAIN, TINGGI_PEMAIN - 2 * JARI_PEMAIN, 6, 12);
    this.kapsul = new THREE.Mesh(geometri, new THREE.MeshStandardMaterial({ color: 0xc8402c, roughness: 0.7 }));
    this.kapsul.position.y = TINGGI_PEMAIN / 2;
    this.kapsul.castShadow = true;
    this.pose.add(this.kapsul);

    // Penanda arah hadap: balok kecil di "wajah" kapsul.
    const hidung = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.14, 0.2),
      new THREE.MeshStandardMaterial({ color: 0xf2e2c0 }),
    );
    hidung.position.set(0, TINGGI_PEMAIN - 0.35, JARI_PEMAIN);
    this.pose.add(hidung);

    this.badan.add(this.pose);
    this.grup.add(this.badan);
  }

  get sedangMemanjat(): boolean {
    return this.panjatKe !== null;
  }

  /** Laju datar saat ini (m/s). */
  get laju(): number {
    return Math.hypot(this.kecepatan.x, this.kecepatan.z);
  }

  /** Letakkan pemain di (x, z) tepat di atas tanah dan hentikan geraknya. */
  taruhDi(x: number, z: number): void {
    this.posisi.set(x, tinggiLantai(this.data, x, z, 1e9), z);
    this.kecepatan.set(0, 0, 0);
    this.kecepatanY = 0;
  }

  /** Langsung menghadap titik (x, z), misalnya ke lawan bicara saat dialog mulai. */
  hadapKe(x: number, z: number): void {
    this.hadap = Math.atan2(x - this.posisi.x, z - this.posisi.z);
    this.miring = 0;
    this.badan.rotation.set(0, this.hadap, 0, 'YXZ');
  }

  perbarui(dt: number, input: Input, yawKamera: number, perintah: Readonly<PerintahGerak> = PERINTAH_BEBAS): void {
    if (this.panjatKe && this.panjatDari) {
      this.perbaruiPanjat(dt);
      return;
    }

    const arah = arahInputRelatifKamera(input, yawKamera);
    const gx = perintah.kunciGerak ? 0 : arah.x;
    const gz = perintah.kunciGerak ? 0 : arah.z;

    if (input.baruDitekan('KeyC') && this.diTanah) this.jongkok = !this.jongkok;
    const skalaTujuan = this.jongkok ? SILUMAN.pemain.skalaJongkok : 1;
    this.skalaBadan += (skalaTujuan - this.skalaBadan) * Math.min(1, 12 * dt);

    const diAir = this.posisi.y < PERMUKAAN_AIR - 0.3;
    const lari = (input.ditekan('ShiftLeft') || input.ditekan('ShiftRight')) && !this.jongkok;
    let kecepatanMaks = this.jongkok ? SILUMAN.pemain.kecepatanJongkok : lari ? KECEPATAN_LARI : KECEPATAN_JALAN;
    if (this.batasLaju !== null) kecepatanMaks = Math.min(kecepatanMaks, this.batasLaju);
    if (diAir) kecepatanMaks *= 0.5;
    kecepatanMaks *= perintah.pengaliKecepatan;

    // Percepatan halus menuju kecepatan tujuan.
    const tujuanX = gx * kecepatanMaks;
    const tujuanZ = gz * kecepatanMaks;
    const faktor = Math.min(1, PERCEPATAN * dt / Math.max(kecepatanMaks, 0.5));
    this.kecepatan.x += (tujuanX - this.kecepatan.x) * faktor;
    this.kecepatan.z += (tujuanZ - this.kecepatan.z) * faktor;
    if (perintah.dorongan) {
      this.kecepatan.x = perintah.dorongan.x;
      this.kecepatan.z = perintah.dorongan.z;
    }

    // Memanjat atau melompat.
    if (perintah.bolehLompat && !this.jongkok && input.baruDitekan('Space') && this.diTanah) {
      const tebing = cariTebing(this.data, this.posisi, JARI_PEMAIN);
      if (tebing) {
        this.mulaiPanjat(tebing.tujuan);
        return;
      }
      this.kecepatanY = LOMPAT;
      this.diTanah = false;
    }

    // Gravitasi dan gerak.
    this.kecepatanY -= GRAVITASI * dt;
    this.posisi.x += this.kecepatan.x * dt;
    this.posisi.z += this.kecepatan.z * dt;
    this.posisi.y += this.kecepatanY * dt;

    // Batas medan.
    const batas = UKURAN_MEDAN / 2 - 2;
    this.posisi.x = Math.min(batas, Math.max(-batas, this.posisi.x));
    this.posisi.z = Math.min(batas, Math.max(-batas, this.posisi.z));

    // Tabrakan dengan rumah, tebing, dan pohon, lalu pijak lantai.
    dorongKeluar(this.data, this.posisi, JARI_PEMAIN);
    const lantai = tinggiLantai(this.data, this.posisi.x, this.posisi.z, this.posisi.y);
    if (this.posisi.y <= lantai) {
      this.posisi.y = lantai;
      this.kecepatanY = 0;
      this.diTanah = true;
    } else {
      this.diTanah = this.posisi.y - lantai < 0.05;
    }

    this.perbaruiBadan(dt, perintah.hadapPaksa);
  }

  private mulaiPanjat(tujuan: THREE.Vector3): void {
    this.panjatDari = this.posisi.clone();
    this.panjatKe = tujuan;
    this.panjatWaktu = 0;
    this.kecepatan.set(0, 0, 0);
    this.kecepatanY = 0;
    this.hadap = Math.atan2(tujuan.x - this.posisi.x, tujuan.z - this.posisi.z);
  }

  private perbaruiPanjat(dt: number): void {
    if (!this.panjatKe || !this.panjatDari) return;
    this.panjatWaktu += dt;
    const t = Math.min(1, this.panjatWaktu / LAMA_PANJAT);
    const halus = t * t * (3 - 2 * t);
    // Naik dulu, baru maju: tinggi mengikuti kurva lebih cepat daripada posisi datar.
    const tNaik = Math.min(1, t * 1.6);
    this.posisi.x = this.panjatDari.x + (this.panjatKe.x - this.panjatDari.x) * halus;
    this.posisi.z = this.panjatDari.z + (this.panjatKe.z - this.panjatDari.z) * halus;
    this.posisi.y = this.panjatDari.y + (this.panjatKe.y - this.panjatDari.y) * tNaik;
    this.badan.rotation.y = this.hadap;
    if (t >= 1) {
      this.panjatDari = null;
      this.panjatKe = null;
      this.diTanah = true;
    }
  }

  private perbaruiBadan(dt: number, hadapPaksa: number | null): void {
    const laju = this.laju;
    if (hadapPaksa !== null) {
      this.hadap = hadapPaksa;
    } else if (laju > 0.3) {
      const tujuanHadap = Math.atan2(this.kecepatan.x, this.kecepatan.z);
      let selisih = tujuanHadap - this.hadap;
      selisih = Math.atan2(Math.sin(selisih), Math.cos(selisih));
      this.hadap += selisih * Math.min(1, 12 * dt);
    }
    // Condong hanya dari gerak yang mengikuti arah hadap; luncuran hindar ditangani modul pertarungan.
    const lajuHadap = hadapPaksa === null ? laju : 0;
    const miringTujuan = Math.min(1, lajuHadap / KECEPATAN_LARI) * MIRING_MAKS;
    this.miring += (miringTujuan - this.miring) * Math.min(1, 8 * dt);
    this.badan.rotation.set(this.miring, this.hadap, 0, 'YXZ');
  }
}
