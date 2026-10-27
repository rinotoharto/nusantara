import * as THREE from 'three';
import type { Pemain } from '../character/player';
import type { PengelolaLawan } from '../combat/enemy-manager';
import type { Dunia } from '../world';
import { tinggiMedan } from '../world/terrain';
import { AREA_UJI, SILUMAN } from './config';
import { Penjaga } from './guard';

/** Keadaan pemain yang dinilai penjaga; diperbarui tiap frame sebelum lawan bergerak. */
export interface KeadaanPemain {
  posisi: THREE.Vector3;
  /** Sedang berlari (lebih cepat dari `lajuLari`). */
  lari: boolean;
  /** Pengali jarak pandang penjaga terhadap pemain: 1 normal, 0,5 saat jongkok atau di semak. */
  faktorJarak: number;
}

export interface KonteksSiluman {
  pemain: KeadaanPemain;
}

const bahanBatu = new THREE.MeshStandardMaterial({ color: 0x6f6a60, roughness: 1 });

/**
 * Pengelola menyelinap: membangun area uji dari data (batu, penjaga, tiang tujuan),
 * menyusun keadaan pemain untuk penjaga, dan mendaftarkan penjaga ke pengelola lawan
 * supaya pertarungan berjalan dengan aturan yang sama.
 */
export class PengelolaSiluman {
  readonly penjaga: Penjaga[] = [];
  readonly konteks: KonteksSiluman = {
    pemain: { posisi: new THREE.Vector3(), lari: false, faktorJarak: 1 },
  };
  readonly mulai = AREA_UJI.mulai;
  readonly tujuan = AREA_UJI.tujuan;

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

    for (const rute of AREA_UJI.penjaga) {
      const penjaga = new Penjaga(dunia.tabrakan, rute, this.konteks);
      scene.add(penjaga.grup, penjaga.kerucut.mesh);
      lawan.tambah(penjaga);
      this.penjaga.push(penjaga);
    }
  }

  /** Dipanggil tiap frame sebelum `lawan.perbarui`. */
  perbarui(pemain: Pemain): void {
    const k = this.konteks.pemain;
    k.posisi.copy(pemain.posisi);
    k.lari = pemain.laju > SILUMAN.pemain.lajuLari;
    k.faktorJarak = 1;
  }
}
