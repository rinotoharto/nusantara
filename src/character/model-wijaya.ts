import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import type { Pemain } from './player';
import type { PertarunganPemain, StatusAksi } from '../combat/player-combat';
import { SILUMAN } from '../stealth/config';

/**
 * Model Wijaya beranimasi (glTF + Draco), hanya aktif dengan `?model=wijaya`. Mengganti kapsul pemain
 * dengan mesh berkulit dan memilih aksi dari status Pemain dan PertarunganPemain. Kapsul tabrakan tetap.
 *
 * Nama aksi mengikuti tools/blender/gabung_animasi.py: idle, siaga, jalan (jalan pelan), lari (lari santai),
 * lari-kencang (lari kencang; lari sebagai cadangan), jongkok-jalan, jongkok-diam, serang-1..3, serang-berat, tangkis, hindar, terkena, mati.
 */

/**
 * Kecepatan langkah tiap klip (m/s), diukur dari laju kaki tumpu relatif pinggul pada FBX sumber
 * (jalan 1,43; lari lama 4,01, cocok dengan root 4,16; lari-santai 2,35; lari-kencang 4,5; jongkok-jalan
 * 1,10). timeScale = laju / nilai ini, dibatasi SKALA_GERAK supaya langkah tidak tampak dipercepat.
 */
const LAJU_KLIP: Record<string, number> = { jalan: 1.43, lari: 4.01, 'lari-santai': 2.35, 'lari-kencang': 4.5, 'jongkok-jalan': 1.1 };
const SKALA_GERAK = { min: 0.6, maks: 1.5 };
/**
 * Fase kaki tiap klip gerak, diukur dari FBX sumber: `awal` = bagian siklus saat kaki kiri paling depan,
 * `siklus` = jumlah siklus langkah dalam satu klip. Dipakai supaya pindah klip tidak mengganti kaki tumpu.
 */
const FASE_KLIP: Record<string, { awal: number; siklus: number }> = {
  jalan: { awal: 0.256, siklus: 1 },
  'lari-santai': { awal: 0.23, siklus: 1 },
  'lari-kencang': { awal: 0.21, siklus: 2 },
  lari: { awal: 0.244, siklus: 1 },
  'jongkok-jalan': { awal: 0.271, siklus: 1 },
};
/** Pengali waktu klip aksi tetap: kontak serang ringan jatuh di 0,16 s (bingkai 9 dari 19 pada 30 fps). */
const SKALA_WAKTU: Partial<Record<string, number>> = {
  'serang-1': 1.67, 'serang-2': 1.67, 'serang-3': 1.67, 'serang-berat': 1.03,
  hindar: 2.5, terkena: 2.0, mati: 1.0, tangkis: 1.0, idle: 1.0, siaga: 1.0, 'jongkok-diam': 1.0,
};
const SEKALI = new Set(['serang-1', 'serang-2', 'serang-3', 'serang-berat', 'hindar', 'terkena', 'mati']);
const CROSSFADE = 0.15;

/**
 * Peta lingkungan kecil khusus model ini (hanya dimuat dengan `?model=wijaya`; adegan tidak punya
 * scene.environment, dan benda lain tidak tersentuh). Dua guna:
 * - logam penuh (kalung emas, emas gelang lewat tekstur metallic) tanpa pantulan lingkungan tampil hitam;
 * - kulit mendapat cahaya pengisi lembut, supaya sisi wajah yang membelakangi matahari rendah tidak jatuh
 *   gelap (game hanya punya satu matahari dan ambien, tanpa cahaya pengisi).
 * Isinya gradasi langit sore ke tanah cokelat hangat (bukan hijau rumput, supaya emas tidak kehijauan).
 */
function petaLingkunganModel(): THREE.CubeTexture {
  const sisi = (warna: string[]): HTMLCanvasElement => {
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    const g = c.getContext('2d')!;
    const gradasi = g.createLinearGradient(0, 0, 0, 16);
    warna.forEach((w, i) => gradasi.addColorStop(warna.length > 1 ? i / (warna.length - 1) : 0, w));
    g.fillStyle = gradasi;
    g.fillRect(0, 0, 16, 16);
    return c;
  };
  const langit = '#e8b47a';
  const kakiLangit = '#c98f55';
  const tanah = '#5a4a2c';
  const samping = (): HTMLCanvasElement => sisi([langit, kakiLangit, tanah]);
  const peta = new THREE.CubeTexture([samping(), samping(), sisi([langit]), sisi([tanah]), samping(), samping()]);
  peta.colorSpace = THREE.SRGBColorSpace;
  peta.needsUpdate = true;
  return peta;
}
/** Kekuatan peta lingkungan: penuh untuk logam murni, lemah untuk bahan badan (cahaya pengisi kulit). */
const LINGKUNGAN_LOGAM = 1.0;
const LINGKUNGAN_BADAN = 0.45;

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
    let lingkungan: THREE.CubeTexture | null = null;
    akar.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        const m = o as THREE.Mesh;
        m.castShadow = true;
        m.receiveShadow = false;
        m.frustumCulled = false;
        for (const bahan of Array.isArray(m.material) ? m.material : [m.material]) {
          const std = bahan as THREE.MeshStandardMaterial;
          if (!std.isMeshStandardMaterial) continue;
          lingkungan ??= petaLingkunganModel();
          std.envMap = lingkungan;
          std.envMapIntensity = std.metalness > 0.5 && !std.metalnessMap ? LINGKUNGAN_LOGAM : LINGKUNGAN_BADAN;
          std.needsUpdate = true;
        }
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
    if (this.tulangTangan) this.pasangKeris(this.tulangTangan, this.tarung.ambilKeris());
    this.waktuMuatMs = performance.now() - mulai;
    this.siap = true;
    this.mainkan('idle');
    if (import.meta.env.DEV) {
      console.log(`[model] wijaya.glb dimuat ${this.waktuMuatMs.toFixed(0)} ms, aksi: ${[...this.aksi.keys()].join(', ')}`);
    }
  }

  /**
   * Keris di genggaman tangan kanan. Keris balok milik modul pertarungan terus digerakkan untuk kapsul, jadi
   * yang ditempel ke tulang adalah salinannya (aslinya disembunyikan). Letaknya dihitung dari pose istirahat:
   * hulu di tengah telapak (jari menggenggam di semua klip), bilah keluar di sisi telunjuk condong ke depan,
   * sama dengan keris sementara di tools/blender/pratinjau_animasi.py. Panjang sekitar 40 cm.
   */
  private pasangKeris(tangan: THREE.Object3D, asli: THREE.Group): void {
    asli.visible = false;
    const keris = asli.clone();
    keris.visible = true;
    const cari = (akhiran: string): THREE.Object3D | undefined =>
      tangan.getObjectByName(`mixamorigRightHand${akhiran}`) ?? tangan.getObjectByName(`mixamorig:RightHand${akhiran}`);
    const telunjuk = cari('Index1');
    const tengah = cari('Middle1');
    const kelingking = cari('Pinky1');
    if (!telunjuk || !tengah || !kelingking) {
      // Kerangka tanpa jari: cara lama, bilah searah jari.
      keris.position.set(0, 0.08, 0.02);
      keris.rotation.set(-Math.PI / 2, 0, 0);
      tangan.add(keris);
      return;
    }
    tangan.updateWorldMatrix(true, true);
    const dunia = (o: THREE.Object3D): THREE.Vector3 => o.getWorldPosition(new THREE.Vector3());
    const t = dunia(tangan);
    const i1 = dunia(telunjuk);
    const m1 = dunia(tengah);
    const p1 = dunia(kelingking);
    // Normal telapak: pada pose istirahat (lengan terentang) telapak menghadap bawah.
    const normal = i1.clone().sub(t).cross(p1.clone().sub(t)).normalize();
    if (normal.y > 0) normal.negate();
    const bukuJari = i1.clone().sub(p1).normalize(); // ke sisi telunjuk
    const jari = m1.clone().sub(t);
    jari.addScaledVector(bukuJari, -jari.dot(bukuJari)).normalize();
    const pusat = t.clone().lerp(m1, 0.75).addScaledVector(normal, 0.03);
    const bilah = jari.clone().multiplyScalar(0.85).addScaledVector(bukuJari, 0.5).normalize(); // sumbu +z keris
    const atas = normal.clone().addScaledVector(bilah, -normal.dot(bilah)).normalize();
    const samping = atas.clone().cross(bilah);
    const m = new THREE.Matrix4().makeBasis(samping, atas, bilah).setPosition(pusat).scale(new THREE.Vector3(0.7, 0.7, 0.7));
    m.premultiply(new THREE.Matrix4().copy(tangan.matrixWorld).invert());
    m.decompose(keris.position, keris.quaternion, keris.scale);
    tangan.add(keris);
  }

  private mainkan(nama: string, ulangDariAwal = false): void {
    const a = this.aksi.get(nama);
    if (!a) return;
    if (a === this.aktif && !ulangDariAwal) return;
    // Fase langkah klip yang ditinggalkan (0 sampai 1), kalau keduanya klip gerak.
    const faseLama = FASE_KLIP[this.namaAktif];
    const faseBaru = FASE_KLIP[nama];
    let fase: number | null = null;
    if (this.aktif && faseLama && faseBaru && !ulangDariAwal) {
      const durLama = this.aktif.getClip().duration;
      fase = ((this.aktif.time / durLama) * faseLama.siklus - faseLama.awal + 8) % 1;
    }
    a.reset();
    if (fase !== null) a.time = (((fase + faseBaru.awal) / faseBaru.siklus) % 1) * a.getClip().duration;
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

  /** Klip gerak untuk laju sekarang; klip baru dipakai kalau ada di GLB, kalau tidak klip lama. */
  private gerak(nama: string, cadangan: string, laju: number): void {
    const pakai = this.aksi.has(nama) ? nama : cadangan;
    this.mainkan(pakai);
    this.aktif!.timeScale = Math.min(SKALA_GERAK.maks, Math.max(SKALA_GERAK.min, laju / LAJU_KLIP[pakai]));
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
          if (laju > 0.3) this.gerak('jongkok-jalan', 'jongkok-jalan', laju);
          else this.mainkan('jongkok-diam');
        } else if (laju > SILUMAN.pemain.lajuLari) this.gerak('lari-kencang', 'lari', laju);
        else if (laju > SILUMAN.pemain.lajuLariSantai) this.gerak('lari', 'jalan', laju);
        else if (laju > 0.3) this.gerak('jalan', 'jalan', laju);
        else if (status === 'mengisi' || this.siaga) this.mainkan('siaga');
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
