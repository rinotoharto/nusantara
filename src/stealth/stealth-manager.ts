import * as THREE from 'three';
import type { Pemain } from '../character/player';
import type { Pengikut } from '../character/follower';
import type { PengelolaLawan } from '../combat/enemy-manager';
import type { Dunia } from '../world';
import { tinggiMedan } from '../world/terrain';
import { SILUMAN } from './config';
import { Penjaga, type RutePatroli } from './guard';
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
  /** Dipanggil saat seorang penjaga melihat pemain sendiri dan mulai mengejar. */
  saatKetahuan: ((penjaga: Penjaga) => void) | null;
}

/** Batu penghalang pandang dari data misi. */
export interface DataBatu {
  x: number;
  z: number;
  lebar: number;
  tinggi: number;
  dalam: number;
}

const bahanBatu = new THREE.MeshStandardMaterial({ color: 0x6f6a60, roughness: 1 });

/**
 * Pengelola menyelinap: memasang batu, semak, dan penjaga yang diminta misi,
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
    saatKetahuan: null,
  };
  /** Pengali laju curiga dari rombongan; disalin ke keadaan pemain tiap frame. */
  pengaliCuriga = 1;
  /** Dipanggil saat ada penjaga yang mulai mengejar sementara belum ada penjaga lain yang mengejar. */
  saatKetahuan: (() => void) | null = null;

  constructor(
    private readonly dunia: Dunia,
    private readonly scene: THREE.Scene,
    private readonly lawan: PengelolaLawan,
  ) {
    this.konteks.saatKetahuan = (p) => {
      // Satu kejadian ketahuan per episode: kalau sudah ada kawan yang mengejar, tidak dihitung lagi.
      if (this.penjaga.some((q) => q !== p && q.mengejar)) return;
      this.saatKetahuan?.();
    };
  }

  /** Batu padat: menghalangi gerak, pandangan, dan kamera. */
  tambahBatu(b: DataBatu): void {
    const yTanah = tinggiMedan(b.x, b.z);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.lebar, b.tinggi + 1, b.dalam), bahanBatu);
    mesh.position.set(b.x, yTanah + b.tinggi / 2 - 0.5, b.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = 'batu';
    mesh.updateMatrixWorld(true);
    this.scene.add(mesh);
    this.dunia.tabrakan.padat.push({ kotak: new THREE.Box3().setFromObject(mesh), bisaDipanjat: false });
    this.dunia.penghalangKamera.push(mesh);
  }

  tambahSemak(x: number, z: number): Semak {
    const semak = new Semak(x, z);
    this.scene.add(semak.mesh);
    this.semak.push(semak);
    return semak;
  }

  tambahPenjaga(rute: RutePatroli): Penjaga {
    const penjaga = new Penjaga(this.dunia.tabrakan, rute, this.konteks);
    this.scene.add(penjaga.grup, penjaga.kerucut.mesh);
    this.lawan.tambah(penjaga);
    this.penjaga.push(penjaga);
    return penjaga;
  }

  hapusPenjaga(penjaga: Penjaga): void {
    const i = this.penjaga.indexOf(penjaga);
    if (i >= 0) this.penjaga.splice(i, 1);
    this.lawan.hapus(penjaga);
    this.scene.remove(penjaga.grup, penjaga.kerucut.mesh);
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
