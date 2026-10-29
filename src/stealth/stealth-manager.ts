import * as THREE from 'three';
import type { Pemain } from '../character/player';
import type { Pengikut } from '../character/follower';
import type { PengelolaLawan } from '../combat/enemy-manager';
import type { Dunia } from '../world';
import { tinggiMedan, PERMUKAAN_AIR } from '../world/terrain';
import { LingkaranSuara } from './sound-ring';
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

/** Satu sumber suara langkah pada frame ini: pusat dan radius dengarnya. */
export interface SumberSuara {
  x: number;
  z: number;
  radius: number;
  /** Benar untuk langkah pemain sendiri: tidak terdengar penjaga yang pemain berjongkok tepat di belakangnya. */
  dariPemain?: boolean;
}

export interface KonteksSiluman {
  pemain: KeadaanPemain;
  /** Suara langkah pemain dan pengikut yang sedang bergerak pada frame ini. */
  suara: SumberSuara[];
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
    suara: [],
    pengikutTerbuka: [],
    penjaga: this.penjaga,
    semak: this.semak,
    penghalangSemak: [],
    saatKetahuan: null,
  };
  /** Pengali laju curiga dari rombongan; disalin ke keadaan pemain tiap frame. */
  pengaliCuriga = 1;
  /** Lingkaran suara di sekitar pemain; tampil saat bergerak dekat penjaga. */
  readonly lingkaranSuara = new LingkaranSuara();
  /** Dipanggil saat ada penjaga yang mulai mengejar sementara belum ada penjaga lain yang mengejar. */
  saatKetahuan: (() => void) | null = null;
  /** Radius suara tambahan di posisi pemain pada frame ini (meter), misalnya keris Sergap; 0 kalau tidak ada. */
  suaraTambahan = 0;

  constructor(
    private readonly dunia: Dunia,
    private readonly scene: THREE.Scene,
    private readonly lawan: PengelolaLawan,
  ) {
    this.scene.add(this.lingkaranSuara.garis);
    this.konteks.saatKetahuan = (p) => {
      // Satu kejadian ketahuan per episode: kalau sudah ada kawan yang mengejar, tidak dihitung lagi.
      if (this.penjaga.some((q) => q !== p && q.mengejar)) return;
      this.saatKetahuan?.();
    };
  }

  /** Batu padat: menghalangi gerak, pandangan, dan kamera; `bisaDipanjat` untuk tebing pendek. Mengembalikan pencabutnya. */
  tambahBatu(b: DataBatu, bisaDipanjat = false): () => void {
    const yTanah = tinggiMedan(b.x, b.z);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.lebar, b.tinggi + 1, b.dalam), bahanBatu);
    mesh.position.set(b.x, yTanah + b.tinggi / 2 - 0.5, b.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = 'batu';
    mesh.updateMatrixWorld(true);
    this.scene.add(mesh);
    const padat = { kotak: new THREE.Box3().setFromObject(mesh), bisaDipanjat };
    this.dunia.tabrakan.padat.push(padat);
    this.dunia.penghalangKamera.push(mesh);
    return () => {
      this.scene.remove(mesh);
      const i = this.dunia.tabrakan.padat.indexOf(padat);
      if (i >= 0) this.dunia.tabrakan.padat.splice(i, 1);
      const j = this.dunia.penghalangKamera.indexOf(mesh);
      if (j >= 0) this.dunia.penghalangKamera.splice(j, 1);
    };
  }

  tambahSemak(x: number, z: number): Semak {
    const semak = new Semak(x, z);
    this.scene.add(semak.mesh);
    this.semak.push(semak);
    return semak;
  }

  hapusSemak(semak: Semak): void {
    const i = this.semak.indexOf(semak);
    if (i >= 0) this.semak.splice(i, 1);
    this.scene.remove(semak.mesh);
  }

  tambahPenjaga(rute: RutePatroli): Penjaga {
    const penjaga = new Penjaga(this.dunia.tabrakan, rute, this.konteks);
    this.scene.add(penjaga.grup, penjaga.kerucut.mesh, penjaga.kerucutTepi.mesh);
    this.lawan.tambah(penjaga);
    this.penjaga.push(penjaga);
    return penjaga;
  }

  hapusPenjaga(penjaga: Penjaga): void {
    const i = this.penjaga.indexOf(penjaga);
    if (i >= 0) this.penjaga.splice(i, 1);
    this.lawan.hapus(penjaga);
    this.scene.remove(penjaga.grup, penjaga.kerucut.mesh, penjaga.kerucutTepi.mesh);
  }

  /**
   * Saksi Sergap: penjaga lain yang melihat sasaran di `posisiSasaran` atau pemain di kerucut utamanya
   * langsung mengejar dan berteriak. Mengembalikan jumlah penjaga yang baru memergoki pada frame ini.
   */
  periksaSaksiSergap(posisiSasaran: THREE.Vector3): number {
    let jumlah = 0;
    for (const p of this.penjaga) {
      if (p.posisi === posisiSasaran) continue;
      if (!p.memergoki(posisiSasaran)) continue;
      p.sadar();
      jumlah += 1;
    }
    return jumlah;
  }

  /** Radius suara langkah untuk laju dan sikap tertentu; 0 kalau diam. */
  private radiusSuara(laju: number, jongkok: boolean, lari: boolean, diAir: boolean): number {
    const S = SILUMAN.suara;
    if (laju < 0.3) return 0;
    let r = jongkok ? S.jongkok : lari ? S.lari : S.jalan;
    if (diAir) r *= S.pengaliAir;
    return r;
  }

  /** Dipanggil tiap frame sebelum `lawan.perbarui`. */
  perbarui(pemain: Pemain, pengikut: readonly Pengikut[], dt = 0): void {
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
    // Obor menyala (sprint 7): terlihat dari lebih jauh dan tidak pernah tersembunyi.
    if (pemain.oborMenyala) {
      k.faktorJarak = SILUMAN.obor.faktorJarak;
      k.tersembunyi = false;
    }
    const penghalang = this.konteks.penghalangSemak;
    penghalang.length = 0;
    for (const s of this.semak) if (s !== k.semak) penghalang.push(s.kotak);

    // Suara langkah: pemain menurut geraknya, pengikut lebih pelan (Gajah Pagon tidak, karena pincang).
    const S = SILUMAN.suara;
    const suara = this.konteks.suara;
    suara.length = 0;
    const diAir = pemain.posisi.y < PERMUKAAN_AIR - 0.3;
    const radiusPemain = this.radiusSuara(pemain.laju, pemain.jongkok, k.lari, diAir);
    if (radiusPemain > 0) suara.push({ x: pemain.posisi.x, z: pemain.posisi.z, radius: radiusPemain, dariPemain: true });
    if (this.suaraTambahan > 0) suara.push({ x: pemain.posisi.x, z: pemain.posisi.z, radius: this.suaraTambahan });
    for (const p of pengikut) {
      const lajuP = p.laju;
      const r = this.radiusSuara(lajuP, p.jongkok, lajuP > SILUMAN.pemain.lajuLari, p.posisi.y < PERMUKAAN_AIR - 0.3);
      if (r > 0) suara.push({ x: p.posisi.x, z: p.posisi.z, radius: r * (p.opsi.pincang ? S.pengaliPagon : S.pengaliPengikut) });
    }
    // Lingkaran suara di lantai hanya saat ada penjaga hidup dalam jarak tampil.
    const adaPenjagaDekat = this.penjaga.some(
      (g) => g.hidup && Math.hypot(g.posisi.x - pemain.posisi.x, g.posisi.z - pemain.posisi.z) < S.jarakTampilLingkaran,
    );
    this.lingkaranSuara.perbarui(pemain.posisi.x, pemain.posisi.z, adaPenjagaDekat ? radiusPemain : 0, dt);
  }
}
