import * as THREE from 'three';
import type { Lawan } from '../combat/enemy';
import type { Pemain } from './player';
import { JARI_PEMAIN, TINGGI_PEMAIN } from './player';
import { tinggiLantai, dorongKeluar, pisahkan, type DataTabrakan } from '../world/collision';
import { SILUMAN } from '../stealth/config';
import { arusSungai, tinggiMedan, LERENG_MAKS } from '../world/terrain';
import type { KeadaanPemain } from '../stealth/stealth-manager';

const F = SILUMAN.pengikut;
const WARNA = [0x7a5a3a, 0x6e4f33, 0x85643f]; // cokelat, nanti Ranggalawe, Nambi, Lembu Sora
const WARNA_PAGON = 0x8c8a56; // zaitun pudar: Gajah Pagon yang terluka
const GOYANG_PINCANG = 0.14; // radian, goyangan kapsul ke samping saat berjalan pincang
const TURUN_PINCANG = 0.07; // meter, badan turun tiap langkah kaki yang terluka
const MIRING_MAKS = 0.18;
const LEBAR_GARIS_KAMERA = 1.6; // pengikut digeser keluar dari garis kamera-pemain selebar ini
const JARAK_PUDAR = 3.5; // pengikut memudar kalau lebih dekat dari ini ke kamera

/** Geseran slot formasi: ke belakang dan ke samping relatif terhadap hadap pemain. */
const SLOT = [
  { belakang: F.jarakBelakang, samping: -F.lebarFormasi },
  { belakang: F.jarakBelakang, samping: F.lebarFormasi },
  { belakang: F.jarakBelakangJauh, samping: 0 },
  { belakang: F.jarakBelakangJauh + 1.6, samping: 0.9 }, // Gajah Pagon, paling belakang
];
/** Geseran slot di dalam semak relatif terhadap pusat semak. */
const SLOT_SEMAK = [
  { x: -0.55, z: -0.55 },
  { x: 0.55, z: -0.55 },
  { x: 0, z: 0.6 },
  { x: 0.7, z: 0.2 },
];

/** Pilihan tampilan dan gerak satu pengikut. */
export interface OpsiPengikut {
  warna: number;
  /** Kecepatan maksimum sendiri (m/s); Gajah Pagon lebih lambat. */
  lajuMaks: number;
  /** Berjalan pincang: kapsul bergoyang dan turun tiap langkah. */
  pincang: boolean;
}

export interface KonteksPengikut {
  pemain: Pemain;
  keadaan: KeadaanPemain;
  /** Lawan hidup yang sedang bertarung, untuk mundur dan tabrakan. */
  lawanBertarung: Lawan[];
  frustum: THREE.Frustum;
  posisiKamera: THREE.Vector3;
  /** Batas kecepatan semua pengikut dari misi (m/s); null = normal. */
  batasLaju: number | null;
}

/**
 * Pengikut: kapsul cokelat yang mengikuti pemain dalam formasi longgar seperti anjing
 * mengikuti tuannya. Tidak bertarung dan tidak bisa mati di sprint ini.
 */
export class Pengikut {
  readonly grup = new THREE.Group();
  readonly posisi = this.grup.position;
  private readonly badan = new THREE.Group();
  private readonly bahan: THREE.MeshStandardMaterial;
  private readonly kecepatan = new THREE.Vector3();
  private readonly tujuan = new THREE.Vector3();
  private adaTujuan = false;
  hadap = 0;
  jongkok = false;
  /** Salah kalau pengikut ini ditinggal: berdiri diam di tempat sebagai NPC, tidak mengikuti. */
  aktif = true;
  private skalaBadan = 1;
  private miring = 0;
  private fasePincang = 0;
  private readonly sementara = new THREE.Vector3();
  readonly opsi: OpsiPengikut;
  /** Tugas sementara menunjuk jalan: berjalan ke titik ini lalu kembali ke formasi. */
  private tugas: { x: number; z: number; sisa: number } | null = null;

  constructor(
    private data: DataTabrakan,
    readonly indeks: number,
    opsi?: Partial<OpsiPengikut>,
  ) {
    this.opsi = { warna: WARNA[indeks % WARNA.length], lajuMaks: F.kecepatanMaks, pincang: false, ...opsi };
    this.bahan = new THREE.MeshStandardMaterial({ color: this.opsi.warna, roughness: 0.8, transparent: true });
    const kapsul = new THREE.Mesh(
      new THREE.CapsuleGeometry(JARI_PEMAIN, TINGGI_PEMAIN - 2 * JARI_PEMAIN, 6, 12),
      this.bahan,
    );
    kapsul.position.y = TINGGI_PEMAIN / 2;
    kapsul.castShadow = true;
    const hidung = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.14, 0.2),
      new THREE.MeshStandardMaterial({ color: 0xf2e2c0 }),
    );
    hidung.position.set(0, TINGGI_PEMAIN - 0.35, JARI_PEMAIN);
    this.badan.add(kapsul, hidung);
    this.grup.add(this.badan);
    this.grup.name = `pengikut-${indeks}`;
  }

  /** Laju datar saat ini (m/s), untuk suara langkah. */
  get laju(): number {
    return Math.hypot(this.kecepatan.x, this.kecepatan.z);
  }

  /** Letakkan di (x, z) di atas tanah dan hentikan geraknya. */
  taruhDi(x: number, z: number): void {
    this.posisi.set(x, tinggiLantai(this.data, x, z, 1e9), z);
    this.kecepatan.set(0, 0, 0);
    this.adaTujuan = false;
  }

  /** Menunjuk jalan: berjalan `jarak` meter dari pemain ke arah `ke`, paling lama `lama` detik, lalu kembali. */
  tunjukArah(dariPemain: THREE.Vector3, ke: [number, number], jarak: number, lama: number): void {
    const dx = ke[0] - dariPemain.x;
    const dz = ke[1] - dariPemain.z;
    const d = Math.hypot(dx, dz) || 1;
    this.tugas = { x: dariPemain.x + (dx / d) * jarak, z: dariPemain.z + (dz / d) * jarak, sisa: lama };
  }

  /** Slot formasi di belakang pemain untuk pengikut ini. */
  slotFormasi(pemain: Pemain, keluar: THREE.Vector3): THREE.Vector3 {
    const s = SLOT[this.indeks % SLOT.length];
    const h = pemain.hadap;
    const depanX = Math.sin(h);
    const depanZ = Math.cos(h);
    const kananX = Math.cos(h);
    const kananZ = -Math.sin(h);
    return keluar.set(
      pemain.posisi.x - depanX * s.belakang + kananX * s.samping,
      pemain.posisi.y,
      pemain.posisi.z - depanZ * s.belakang + kananZ * s.samping,
    );
  }

  perbarui(dt: number, ctx: KonteksPengikut): void {
    const pemain = ctx.pemain;
    const dxP = pemain.posisi.x - this.posisi.x;
    const dzP = pemain.posisi.z - this.posisi.z;
    const jarakPemain = Math.hypot(dxP, dzP);
    this.jongkok = pemain.jongkok;

    // Pilih tujuan: mundur dari pertarungan, masuk semak bersama pemain, atau slot formasi.
    // Saat bertarung, pengikut mundur dari lawan dan menunggu, kecuali pemain sudah jauh: menyusul.
    const lawan = jarakPemain < F.jarakMenyusul ? this.lawanTerdekat(ctx.lawanBertarung) : null;
    if (lawan) {
      const dx = this.posisi.x - lawan.posisi.x;
      const dz = this.posisi.z - lawan.posisi.z;
      const d = Math.hypot(dx, dz) || 1;
      if (d < F.jarakMundur) {
        this.tujuan.set(lawan.posisi.x + (dx / d) * (F.jarakMundur + 0.5), 0, lawan.posisi.z + (dz / d) * (F.jarakMundur + 0.5));
        this.adaTujuan = true;
      } else {
        this.adaTujuan = false; // sudah cukup jauh: menunggu
      }
    } else if (this.tugas) {
      // Menunjuk jalan: ke titik tugas, selesai saat sampai atau waktunya habis.
      this.tugas.sisa -= dt;
      this.tujuan.set(this.tugas.x, 0, this.tugas.z);
      this.adaTujuan = true;
      if (this.tugas.sisa <= 0 || Math.hypot(this.tugas.x - this.posisi.x, this.tugas.z - this.posisi.z) < F.jarakBerhenti) this.tugas = null;
    } else if (ctx.keadaan.semak) {
      const s = SLOT_SEMAK[this.indeks % SLOT_SEMAK.length];
      const pusat = ctx.keadaan.semak.pusat;
      this.tujuan.set(pusat.x + s.x, 0, pusat.z + s.z);
      this.adaTujuan = true;
    } else {
      this.slotFormasi(pemain, this.tujuan);
      this.hindariGarisKamera(pemain, ctx.posisiKamera);
      const pemainDiam = pemain.laju < 0.3;
      // Pemain berhenti: pengikut ikut berhenti selama masih cukup dekat dan tidak menutupi kamera.
      const menutupiKamera = this.jarakKeGarisKamera(pemain, ctx.posisiKamera) < LEBAR_GARIS_KAMERA * 0.7;
      this.adaTujuan = !(pemainDiam && jarakPemain < F.jarakLonggar && !menutupiKamera);
    }

    // Tertinggal jauh dan tidak terlihat kamera: berpindah ke titik tepat di belakang kamera
    // (di luar layar), lalu berjalan masuk ke formasi seperti biasa.
    if (jarakPemain > F.jarakTertinggal) {
      const diLayar = ctx.frustum.containsPoint(this.sementara.copy(this.posisi).setY(this.posisi.y + 0.9));
      if (!diLayar) {
        const dx = ctx.posisiKamera.x - pemain.posisi.x;
        const dz = ctx.posisiKamera.z - pemain.posisi.z;
        const d = Math.hypot(dx, dz) || 1;
        const jauh = d + 1.5 + this.indeks * 0.8;
        this.taruhDi(pemain.posisi.x + (dx / d) * jauh, pemain.posisi.z + (dz / d) * jauh);
        return;
      }
    }

    // Kecepatan sebanding dengan jarak ke tujuan, dibatasi kecepatan lari.
    let tujuanX = 0;
    let tujuanZ = 0;
    if (this.adaTujuan) {
      const dx = this.tujuan.x - this.posisi.x;
      const dz = this.tujuan.z - this.posisi.z;
      const d = Math.hypot(dx, dz);
      if (d > F.jarakBerhenti) {
        // Batas misi berlaku untuk pengikut biasa; Gajah Pagon memakai lajunya sendiri supaya bisa menyusul.
        const lajuMaks = this.opsi.pincang ? this.opsi.lajuMaks : Math.min(this.opsi.lajuMaks, ctx.batasLaju ?? Infinity);
        const laju = Math.min(lajuMaks, d * F.pengaliKecepatan);
        tujuanX = (dx / d) * laju;
        tujuanZ = (dz / d) * laju;
      }
    }
    const faktor = Math.min(1, 10 * dt);
    this.kecepatan.x += (tujuanX - this.kecepatan.x) * faktor;
    this.kecepatan.z += (tujuanZ - this.kecepatan.z) * faktor;
    // Arus deras menyeret ke tepi; lereng curam tidak bisa dilalui (sama dengan pemain).
    const arus = arusSungai(this.posisi.x, this.posisi.z, this.posisi.y, this.sementara);
    if (arus) {
      this.kecepatan.x = arus.x;
      this.kecepatan.z = arus.z;
    }
    const xBaru = this.posisi.x + this.kecepatan.x * dt;
    const zBaru = this.posisi.z + this.kecepatan.z * dt;
    const jarakDatar = Math.hypot(xBaru - this.posisi.x, zBaru - this.posisi.z);
    if (jarakDatar > 1e-4) {
      const selisihTanah = tinggiMedan(xBaru, zBaru) - tinggiMedan(this.posisi.x, this.posisi.z);
      if (Math.abs(selisihTanah) / jarakDatar > LERENG_MAKS) this.kecepatan.set(0, 0, 0);
      else {
        this.posisi.x = xBaru;
        this.posisi.z = zBaru;
      }
    }

    // Tabrakan dengan rumah, batu, pohon, dan lawan; lalu pijak tanah.
    dorongKeluar(this.data, this.posisi, JARI_PEMAIN);
    for (const l of ctx.lawanBertarung) pisahkan(this.posisi, l.posisi, JARI_PEMAIN * 2 + 0.1, 1);
    this.posisi.y = tinggiLantai(this.data, this.posisi.x, this.posisi.z, this.posisi.y + 0.5);

    this.perbaruiBadan(dt, pemain);
  }

  /** Jarak datar pengikut ke ruas kamera-pemain; Infinity kalau di luar ruas itu. */
  private jarakKeGarisKamera(pemain: Pemain, kamera: THREE.Vector3): number {
    const cx = kamera.x - pemain.posisi.x;
    const cz = kamera.z - pemain.posisi.z;
    const panjang = Math.hypot(cx, cz);
    if (panjang < 0.1) return Infinity;
    const ux = cx / panjang;
    const uz = cz / panjang;
    const tx = this.posisi.x - pemain.posisi.x;
    const tz = this.posisi.z - pemain.posisi.z;
    const sepanjang = tx * ux + tz * uz;
    if (sepanjang < 0 || sepanjang > panjang + 1) return Infinity;
    return Math.abs(tx * -uz + tz * ux);
  }

  /** Geser `tujuan` keluar dari garis kamera-pemain supaya pengikut tidak menutupi pandangan. */
  private hindariGarisKamera(pemain: Pemain, kamera: THREE.Vector3): void {
    const cx = kamera.x - pemain.posisi.x;
    const cz = kamera.z - pemain.posisi.z;
    const panjang = Math.hypot(cx, cz);
    if (panjang < 0.1) return;
    const ux = cx / panjang;
    const uz = cz / panjang;
    const tx = this.tujuan.x - pemain.posisi.x;
    const tz = this.tujuan.z - pemain.posisi.z;
    const sepanjang = tx * ux + tz * uz;
    if (sepanjang < 0 || sepanjang > panjang + 1) return;
    const samping = tx * -uz + tz * ux;
    if (Math.abs(samping) >= LEBAR_GARIS_KAMERA) return;
    // Ke sisi yang sudah condong; kalau tepat di garis, ganjil ke kiri, genap ke kanan.
    const tanda = samping > 0.05 ? 1 : samping < -0.05 ? -1 : this.indeks % 2 === 0 ? 1 : -1;
    const geser = LEBAR_GARIS_KAMERA * tanda - samping;
    this.tujuan.x += -uz * geser;
    this.tujuan.z += ux * geser;
  }

  private lawanTerdekat(daftar: Lawan[]): Lawan | null {
    let terdekat: Lawan | null = null;
    let jarak = F.jarakPertarungan;
    for (const l of daftar) {
      const d = Math.hypot(l.posisi.x - this.posisi.x, l.posisi.z - this.posisi.z);
      if (d < jarak) {
        jarak = d;
        terdekat = l;
      }
    }
    return terdekat;
  }

  private perbaruiBadan(dt: number, pemain: Pemain): void {
    const laju = Math.hypot(this.kecepatan.x, this.kecepatan.z);
    if (laju > 0.3) {
      const tujuanHadap = Math.atan2(this.kecepatan.x, this.kecepatan.z);
      let selisih = tujuanHadap - this.hadap;
      selisih = Math.atan2(Math.sin(selisih), Math.cos(selisih));
      this.hadap += selisih * Math.min(1, 10 * dt);
    } else {
      // Diam: menghadap ke arah yang sama dengan pemain.
      let selisih = pemain.hadap - this.hadap;
      selisih = Math.atan2(Math.sin(selisih), Math.cos(selisih));
      this.hadap += selisih * Math.min(1, 3 * dt);
    }
    const miringTujuan = Math.min(1, laju / F.kecepatanMaks) * MIRING_MAKS;
    this.miring += (miringTujuan - this.miring) * Math.min(1, 8 * dt);
    const skalaTujuan = this.jongkok ? SILUMAN.pemain.skalaJongkok : 1;
    this.skalaBadan += (skalaTujuan - this.skalaBadan) * Math.min(1, 12 * dt);
    // Pincang: goyang ke samping dan turun tiap langkah, hanya saat berjalan.
    let goyang = 0;
    let turun = 0;
    if (this.opsi.pincang) {
      if (laju > 0.3) this.fasePincang += dt * (2.2 + laju * 1.2);
      const kuat = Math.min(1, laju / 2);
      goyang = Math.sin(this.fasePincang) * GOYANG_PINCANG * kuat;
      turun = Math.max(0, -Math.sin(this.fasePincang)) * TURUN_PINCANG * kuat;
    }
    this.badan.rotation.set(this.miring, this.hadap, goyang, 'YXZ');
    this.badan.scale.y = this.skalaBadan;
    this.badan.position.y = -turun;
  }

  /** Memudar saat terlalu dekat ke kamera supaya tidak menutupi layar. */
  perbaruiPudar(posisiKamera: THREE.Vector3): void {
    const d = Math.hypot(posisiKamera.x - this.posisi.x, posisiKamera.y - (this.posisi.y + 0.9), posisiKamera.z - this.posisi.z);
    const opasitas = Math.min(1, Math.max(0.15, (d - 1.0) / (JARAK_PUDAR - 1.0)));
    this.bahan.opacity = opasitas;
  }
}

/** Mengelola para pengikut: pembaruan, tabrakan antar pengikut dan dengan pemain, penempatan ulang. */
export class PengelolaPengikut {
  /** Semua pengikut, termasuk Gajah Pagon (indeks terakhir) walau sedang ditinggal. */
  readonly daftar: Pengikut[] = [];
  /** Gajah Pagon: pengikut keempat yang pincang dan lebih lambat. */
  readonly pagon: Pengikut;
  /** Batas kecepatan semua pengikut dari misi (m/s); null = normal. */
  batasLaju: number | null = null;
  private readonly frustum = new THREE.Frustum();
  private readonly matriks = new THREE.Matrix4();
  private readonly sementara = new THREE.Vector3();

  constructor(data: DataTabrakan, scene: THREE.Scene, lajuPagon: number) {
    for (let i = 0; i < F.jumlah; i++) {
      const p = new Pengikut(data, i);
      scene.add(p.grup);
      this.daftar.push(p);
    }
    this.pagon = new Pengikut(data, F.jumlah, { warna: WARNA_PAGON, lajuMaks: lajuPagon, pincang: true });
    scene.add(this.pagon.grup);
    this.daftar.push(this.pagon);
  }

  /** Pengikut yang sedang mengikuti pemain. */
  get aktif(): Pengikut[] {
    return this.daftar.filter((p) => p.aktif);
  }

  /** Gajah Pagon ikut atau ditinggal. Saat ditinggal ia berdiri diam di tempatnya sekarang. */
  set pagonIkut(ikut: boolean) {
    this.pagon.aktif = ikut;
  }
  get pagonIkut(): boolean {
    return this.pagon.aktif;
  }

  /** Taruh semua pengikut aktif di slot formasinya di belakang pemain. */
  taruhDiBelakang(pemain: Pemain): void {
    for (const p of this.aktif) {
      const slot = p.slotFormasi(pemain, this.sementara);
      p.taruhDi(slot.x, slot.z);
      p.hadap = pemain.hadap;
    }
  }

  /**
   * Pemain baru selesai memanjat: pengikut yang masih di bawah (lebih rendah 1 m dari pemain)
   * berpindah ke titik tepat di belakang kamera, seperti aturan tertinggal sprint 3.
   */
  susulkanSetelahPanjat(pemain: Pemain, kamera: THREE.Camera): void {
    const dx = kamera.position.x - pemain.posisi.x;
    const dz = kamera.position.z - pemain.posisi.z;
    const d = Math.hypot(dx, dz) || 1;
    for (const p of this.aktif) {
      if (pemain.posisi.y - p.posisi.y < 1) continue;
      const jauh = d + 1.5 + p.indeks * 0.8;
      p.taruhDi(pemain.posisi.x + (dx / d) * jauh, pemain.posisi.z + (dz / d) * jauh);
      p.hadap = pemain.hadap;
    }
  }

  perbarui(dt: number, pemain: Pemain, keadaan: KeadaanPemain, lawanSemua: Lawan[], kamera: THREE.Camera): void {
    this.matriks.multiplyMatrices(kamera.projectionMatrix, kamera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.matriks);
    const ctx: KonteksPengikut = {
      pemain,
      keadaan,
      lawanBertarung: lawanSemua.filter((l) => l.bertarung),
      frustum: this.frustum,
      posisiKamera: kamera.position,
      batasLaju: this.batasLaju,
    };
    const aktif = this.aktif;
    for (const p of aktif) {
      p.perbarui(dt, ctx);
      p.perbaruiPudar(kamera.position);
    }

    // Pengikut saling mendorong dan menjauh dari pemain supaya tidak menumpuk.
    for (let i = 0; i < aktif.length; i++) {
      for (let j = i + 1; j < aktif.length; j++) {
        pisahkan(aktif[i].posisi, aktif[j].posisi, JARI_PEMAIN * 2 + 0.1, 0.5);
      }
      pisahkan(aktif[i].posisi, pemain.posisi, JARI_PEMAIN * 2 + 0.1, 1);
    }
  }
}
