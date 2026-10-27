import * as THREE from 'three';
import type { Pemain } from '../character/player';
import type { Pengikut } from '../character/follower';
import type { PengelolaLawan } from '../combat/enemy-manager';
import type { Dunia } from '../world';
import { tinggiMedan } from '../world/terrain';
import { AREA_UJI, SILUMAN } from './config';
import { Penjaga } from './guard';
import { Semak, semakDi } from './bush';

/** Keadaan pemain yang dinilai penjaga; diperbarui tiap frame sebelum lawan bergerak. */
export interface KeadaanPemain {
  posisi: THREE.Vector3;
  /** Sedang berlari (lebih cepat dari `lajuLari`). */
  lari: boolean;
  jongkok: boolean;
  /** Pengali jarak pandang penjaga terhadap pemain: 1 normal, 0,5 saat jongkok atau di semak. */
  faktorJarak: number;
  /** Pengali laju meteran curiga, misalnya 1,25 saat rombongan membawa Gajah Pagon. */
  pengaliCuriga: number;
  /** Semak yang sedang ditempati, atau null. */
  semak: Semak | null;
  /** Berjongkok di dalam semak: tidak terlihat kecuali penjaga lebih dekat dari `jarakTembus`. */
  tersembunyi: boolean;
  jarakTembus: number;
}

export interface KonteksSiluman {
  pemain: KeadaanPemain;
  /** Posisi pengikut yang berada di luar semak; hanya dinilai saat pemain tersembunyi. */
  pengikutTerbuka: THREE.Vector3[];
  penjaga: Penjaga[];
  semak: Semak[];
  /** Kotak semak yang menghalangi pandangan ke pemain: semua kecuali semak yang ditempatinya. */
  penghalangSemak: THREE.Box3[];
}

const bahanBatu = new THREE.MeshStandardMaterial({ color: 0x6f6a60, roughness: 1 });

/**
 * Pengelola menyelinap: membangun area uji dari data (batu, penjaga, tiang tujuan),
 * menyusun keadaan pemain untuk penjaga, dan mendaftarkan penjaga ke pengelola lawan
 * supaya pertarungan berjalan dengan aturan yang sama.
 */
export class PengelolaSiluman {
  readonly penjaga: Penjaga[] = [];
  readonly semak: Semak[] = [];
  readonly konteks: KonteksSiluman = {
    pemain: {
      posisi: new THREE.Vector3(),
      lari: false,
      jongkok: false,
      faktorJarak: 1,
      pengaliCuriga: 1,
      semak: null,
      tersembunyi: false,
      jarakTembus: SILUMAN.semak.jarakTembus,
    },
    pengikutTerbuka: [],
    penjaga: this.penjaga,
    semak: this.semak,
    penghalangSemak: [],
  };
  readonly mulai = AREA_UJI.mulai;
  readonly tujuan = AREA_UJI.tujuan;
  /** Pengali laju curiga dari rombongan; disalin ke keadaan pemain tiap frame. */
  pengaliCuriga = 1;

  constructor(dunia: Dunia, scene: THREE.Scene, lawan: PengelolaLawan) {
    // Batu penghalang pandang: balok padat, menghalangi gerak, pandangan, dan kamera.
    for (const b of AREA_UJI.batu) {
      const yTanah = tinggiMedan(b.x, b.z);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.lebar, b.tinggi + 1, b.dalam), bahanBatu);
      mesh.position.set(b.x, yTanah + b.tinggi / 2 - 0.5, b.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = 'batu';
      mesh.updateMatrixWorld(true);
      scene.add(mesh);
      dunia.tabrakan.padat.push({ kotak: new THREE.Box3().setFromObject(mesh), bisaDipanjat: false });
      dunia.penghalangKamera.push(mesh);
    }

    // Tiang tujuan dengan cahaya di ujung utara.
    const tiang = new THREE.Group();
    const yTujuan = tinggiMedan(this.tujuan.x, this.tujuan.z);
    tiang.position.set(this.tujuan.x, yTujuan, this.tujuan.z);
    const batang = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 3, 8),
      new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.9 }),
    );
    batang.position.y = 1.5;
    const lampu = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xffc866, emissive: 0xffa030, emissiveIntensity: 2 }),
    );
    lampu.position.y = 3.1;
    const cahaya = new THREE.PointLight(0xffb060, 8, 14, 1.5);
    cahaya.position.y = 3.1;
    tiang.add(batang, lampu, cahaya);
    tiang.name = 'tiang-tujuan';
    scene.add(tiang);

    for (const s of AREA_UJI.semak) {
      const semak = new Semak(s.x, s.z);
      scene.add(semak.mesh);
      this.semak.push(semak);
    }

    for (const rute of AREA_UJI.penjaga) {
      const penjaga = new Penjaga(dunia.tabrakan, rute, this.konteks);
      scene.add(penjaga.grup, penjaga.kerucut.mesh);
      lawan.tambah(penjaga);
      this.penjaga.push(penjaga);
    }
  }

  /** Dipanggil tiap frame sebelum `lawan.perbarui`. */
  perbarui(pemain: Pemain, pengikut: readonly Pengikut[]): void {
    const k = this.konteks.pemain;
    const terbuka = this.konteks.pengikutTerbuka;
    terbuka.length = 0;
    for (const p of pengikut) if (!semakDi(this.semak, p.posisi)) terbuka.push(p.posisi);
    k.posisi.copy(pemain.posisi);
    k.lari = pemain.laju > SILUMAN.pemain.lajuLari;
    k.jongkok = pemain.jongkok;
    k.pengaliCuriga = this.pengaliCuriga;
    k.semak = semakDi(this.semak, pemain.posisi);
    // Jongkok atau di dalam semak: hanya terlihat dari jarak setengah. Keduanya: tersembunyi.
    k.faktorJarak = k.semak ? SILUMAN.pemain.faktorJarakSemak : pemain.jongkok ? SILUMAN.pemain.faktorJarakJongkok : 1;
    k.tersembunyi = pemain.jongkok && k.semak !== null;
    const penghalang = this.konteks.penghalangSemak;
    penghalang.length = 0;
    for (const s of this.semak) if (s !== k.semak) penghalang.push(s.kotak);
  }
}
