import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import type { Pemain } from './player';
import type { PertarunganPemain, StatusAksi } from '../combat/player-combat';

/**
 * Model Wijaya beranimasi (glTF + Draco), hanya aktif dengan `?model=wijaya`. Mengganti kapsul pemain
 * dengan mesh berkulit dan memilih aksi dari status Pemain dan PertarunganPemain. Kapsul tabrakan tetap.
 *
 * Nama aksi mengikuti tools/blender/gabung_animasi.py: idle, siaga, jalan, lari, jongkok-jalan,
 * jongkok-diam, serang-1..3, serang-berat, tangkis, hindar, terkena, mati.
 */

/**
 * Kecepatan langkah tiap klip (m/s), diukur dari laju kaki tumpu relatif pinggul pada FBX sumber
 * (jalan 1,43; lari 4,01, cocok dengan root 4,16; jongkok-jalan 1,10). timeScale = laju / nilai ini.
 */
const LAJU_KLIP = { jalan: 1.43, lari: 4.01, 'jongkok-jalan': 1.1 };
/** Pengali waktu klip aksi tetap: kontak serang ringan jatuh di 0,16 s (bingkai 9 dari 19 pada 30 fps). */
const SKALA_WAKTU: Partial<Record<string, number>> = {
  'serang-1': 1.67, 'serang-2': 1.88, 'serang-3': 1.67, 'serang-berat': 1.03,
  hindar: 2.5, terkena: 2.0, mati: 1.0, tangkis: 1.0, idle: 1.0, siaga: 1.0, 'jongkok-diam': 1.0,
};
const SEKALI = new Set(['serang-1', 'serang-2', 'serang-3', 'serang-berat', 'hindar', 'terkena', 'mati']);
const CROSSFADE = 0.15;
const AMBANG_LARI = 4.5;

export class ModelWijaya {
  readonly grup = new THREE.Group();
  private mixer: THREE.AnimationMixer | null = null;
  private readonly aksi = new Map<string, THREE.AnimationAction>();
  private aktif: THREE.AnimationAction | null = null;
  private namaAktif = '';
  private statusSebelum: StatusAksi = 'bebas';
  private tulangTangan: THREE.Object3D | null = null;
  /** Benar saat ada lawan dekat (kamera mode bertarung); diisi main tiap frame. */
  siaga = false;
  siap = false;
  waktuMuatMs = 0;

  constructor(private pemain: Pemain, private tarung: PertarunganPemain) {
    this.grup.frustumCulled = false;
    pemain.badan.add(this.grup);
  }

  /** Muat GLB; `dasar` adalah import.meta.env.BASE_URL. */
  async muat(dasar: string): Promise<void> {
    const mulai = performance.now();
    const draco = new DRACOLoader();
    draco.setDecoderPath(`${dasar}draco/`);
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);
    const gltf = await loader.loadAsync(`${dasar}models/wijaya.glb`);
    const akar = gltf.scene;
    akar.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        const m = o as THREE.Mesh;
        m.castShadow = true;
        m.receiveShadow = false;
        m.frustumCulled = false;
      }
      if (o.name === 'mixamorigRightHand' || o.name === 'mixamorig:RightHand') this.tulangTangan = o;
    });
    this.grup.add(akar);
    this.mixer = new THREE.AnimationMixer(akar);
    for (const klip of gltf.animations) {
      const a = this.mixer.clipAction(klip);
      if (SEKALI.has(klip.name)) {
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = true;
      }
      this.aksi.set(klip.name, a);
    }
    // Kapsul dan hidung disembunyikan; keris balok dipindah ke tulang tangan kanan.
    this.pemain.kapsul.visible = false;
    this.pemain.pose.children.forEach((c) => {
      if (c.name === 'hidung') c.visible = false;
    });
    if (this.tulangTangan) {
      const keris = this.tarung.ambilKeris();
      // Tulang tangan Mixamo: sumbu Y menyusur jari; keris balok menjulur ke +z, diputar supaya searah.
      keris.position.set(0, 0.08, 0.02);
      keris.rotation.set(-Math.PI / 2, 0, 0);
      this.tulangTangan.add(keris);
    }
    this.waktuMuatMs = performance.now() - mulai;
    this.siap = true;
    this.mainkan('idle');
    if (import.meta.env.DEV) {
      console.log(`[model] wijaya.glb dimuat ${this.waktuMuatMs.toFixed(0)} ms, aksi: ${[...this.aksi.keys()].join(', ')}`);
    }
  }

  private mainkan(nama: string, ulangDariAwal = false): void {
    const a = this.aksi.get(nama);
    if (!a) return;
    if (a === this.aktif && !ulangDariAwal) return;
    a.reset();
    a.timeScale = SKALA_WAKTU[nama] ?? 1;
    a.enabled = true;
    a.setEffectiveWeight(1);
    if (this.aktif && this.aktif !== a) {
      a.crossFadeFrom(this.aktif, CROSSFADE, true);
    }
    a.play();
    this.aktif = a;
    this.namaAktif = nama;
  }

  /** Dipanggil tiap frame logika dengan dt permainan. */
  perbarui(dt: number): void {
    if (!this.mixer || !this.siap) return;
    const status = this.tarung.status;
    const p = this.pemain;
    const masukBaru = status !== this.statusSebelum;
    this.statusSebelum = status;
    switch (status) {
      case 'bebas':
      case 'mengisi': {
        const laju = p.laju;
        if (p.jongkok) {
          if (laju > 0.3) {
            this.mainkan('jongkok-jalan');
            this.aktif!.timeScale = Math.min(2.5, laju / LAJU_KLIP['jongkok-jalan']);
          } else this.mainkan('jongkok-diam');
        } else if (laju > AMBANG_LARI) {
          this.mainkan('lari');
          this.aktif!.timeScale = Math.min(2.5, laju / LAJU_KLIP.lari);
        } else if (laju > 0.3) {
          this.mainkan('jalan');
          this.aktif!.timeScale = Math.min(3, laju / LAJU_KLIP.jalan);
        } else if (status === 'mengisi' || this.siaga) this.mainkan('siaga');
        else this.mainkan('idle');
        break;
      }
      case 'serangRingan': {
        const nama = `serang-${(this.tarung.komboSekarang % 3) + 1}`;
        if (masukBaru || this.namaAktif !== nama) this.mainkan(nama, true);
        break;
      }
      case 'serangBerat':
        if (masukBaru) this.mainkan('serang-berat', true);
        break;
      case 'tikaman':
      case 'sergap':
        if (masukBaru) this.mainkan('serang-3', true);
        break;
      case 'tangkis':
        this.mainkan('tangkis');
        break;
      case 'hindar':
        if (masukBaru) this.mainkan('hindar', true);
        break;
      case 'terpukul':
      case 'terjatuh':
        if (masukBaru) this.mainkan('terkena', true);
        break;
      case 'mati':
        if (masukBaru) this.mainkan('mati', true);
        break;
    }
    this.mixer.update(dt);
  }
}
