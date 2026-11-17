import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

/**
 * Dasar model karakter beranimasi (glTF + Draco): pemuat bersama, AnimationMixer, dan pemilihan aksi dengan
 * peralihan halus. Dipakai Wijaya (model-wijaya.ts) dan prajurit (model-prajurit.ts). Nama aksi mengikuti
 * tools/blender/gabung_animasi.py.
 */

/** Tabel klip satu jenis karakter. */
export interface TabelKlip {
  /** Kecepatan langkah tiap klip gerak (m/s), diukur dari laju kaki tumpu relatif pinggul pada FBX sumber. */
  laju: Record<string, number>;
  /**
   * Fase kaki tiap klip gerak: `awal` = bagian siklus saat kaki kiri paling depan, `siklus` = jumlah siklus
   * langkah dalam satu klip. Dipakai supaya pindah klip tidak mengganti kaki tumpu.
   */
  fase: Record<string, { awal: number; siklus: number }>;
  /** Pengali waktu klip aksi tetap (bawaan 1). */
  skalaWaktu: Partial<Record<string, number>>;
  /** Klip yang diputar sekali lalu ditahan di bingkai terakhir. */
  sekali: ReadonlySet<string>;
  /** Batas timeScale klip gerak supaya langkah tidak tampak dipercepat atau diperlambat berlebihan. */
  skalaGerak: { min: number; maks: number };
  /** Lama peralihan antaraksi (detik). */
  crossfade: number;
}

let pemuat: GLTFLoader | null = null;
const tembolok = new Map<string, Promise<GLTF>>();

/** Muat GLB sekali per berkas; `dasar` adalah import.meta.env.BASE_URL. */
export function muatGlb(dasar: string, berkas: string): Promise<GLTF> {
  if (!pemuat) {
    const draco = new DRACOLoader();
    draco.setDecoderPath(`${dasar}draco/`);
    pemuat = new GLTFLoader();
    pemuat.setDRACOLoader(draco);
  }
  let janji = tembolok.get(berkas);
  if (!janji) {
    janji = pemuat.loadAsync(`${dasar}${berkas}`);
    tembolok.set(berkas, janji);
  }
  return janji;
}

/** Tulang Mixamo menurut akhiran nama (`RightHand`), dengan atau tanpa titik dua di awalan. */
export function cariTulang(akar: THREE.Object3D, akhiran: string): THREE.Object3D | undefined {
  return akar.getObjectByName(`mixamorig${akhiran}`) ?? akar.getObjectByName(`mixamorig:${akhiran}`);
}

export class ModelKarakter {
  readonly grup = new THREE.Group();
  protected mixer: THREE.AnimationMixer | null = null;
  protected readonly aksi = new Map<string, THREE.AnimationAction>();
  protected aktif: THREE.AnimationAction | null = null;
  protected namaAktif = '';

  constructor(protected readonly tabel: TabelKlip) {}

  /** Pasang mixer ke `akar` dan daftarkan semua klip. */
  protected pasangAksi(akar: THREE.Object3D, klipSemua: THREE.AnimationClip[]): void {
    this.mixer = new THREE.AnimationMixer(akar);
    for (const klip of klipSemua) {
      const a = this.mixer.clipAction(klip);
      if (this.tabel.sekali.has(klip.name)) {
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = true;
      }
      this.aksi.set(klip.name, a);
    }
  }

  /** Pindah ke aksi `nama`. `ulangDariAwal` memutar ulang aksi yang sama; `awal` = detik mulai di dalam klip. */
  protected mainkan(nama: string, ulangDariAwal = false, awal = 0): void {
    const a = this.aksi.get(nama);
    if (!a) return;
    if (a === this.aktif && !ulangDariAwal) return;
    // Fase langkah klip yang ditinggalkan (0 sampai 1), kalau keduanya klip gerak.
    const faseLama = this.tabel.fase[this.namaAktif];
    const faseBaru = this.tabel.fase[nama];
    let fase: number | null = null;
    if (this.aktif && faseLama && faseBaru && !ulangDariAwal) {
      const durLama = this.aktif.getClip().duration;
      fase = ((this.aktif.time / durLama) * faseLama.siklus - faseLama.awal + 8) % 1;
    }
    a.reset();
    if (fase !== null) a.time = (((fase + faseBaru.awal) / faseBaru.siklus) % 1) * a.getClip().duration;
    else if (awal > 0) a.time = Math.min(awal, a.getClip().duration);
    a.timeScale = this.tabel.skalaWaktu[nama] ?? 1;
    a.enabled = true;
    a.setEffectiveWeight(1);
    if (this.aktif && this.aktif !== a) {
      // Tanpa warp: warp memperlambat klip yang masuk selama peralihan menurut perbandingan panjang klip
      // (dari idle 7 detik ke serang 0,6 detik hampir berhenti dulu), sehingga kontak serang pertama terlambat
      // sekitar 0,07 detik dan bisa jatuh di luar jendela kena. Fase langkah sudah disamakan sendiri di atas.
      a.crossFadeFrom(this.aktif, this.tabel.crossfade, false);
    }
    a.play();
    this.aktif = a;
    this.namaAktif = nama;
  }

  /**
   * Klip gerak untuk laju sekarang; klip `nama` dipakai kalau ada di GLB, kalau tidak `cadangan`.
   * `arah` -1 memutar langkah mundur.
   */
  protected gerak(nama: string, cadangan: string, laju: number, arah = 1): void {
    const pakai = this.aksi.has(nama) ? nama : cadangan;
    this.mainkan(pakai);
    if (!this.aktif) return;
    const { min, maks } = this.tabel.skalaGerak;
    this.aktif.timeScale = arah * Math.min(maks, Math.max(min, laju / this.tabel.laju[pakai]));
  }

  /** Klip serang dari awal, diputar supaya seluruh klip habis tepat dalam `durasi` detik. */
  protected serang(nama: string, durasi: number): void {
    this.mainkan(nama, true);
    if (this.aktif && this.namaAktif === nama) this.aktif.timeScale = this.aktif.getClip().duration / durasi;
  }
}
