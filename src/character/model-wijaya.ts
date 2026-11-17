import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import type { Pemain } from './player';
import type { PertarunganPemain, StatusAksi } from '../combat/player-combat';
import { SILUMAN } from '../stealth/config';
import { KONFIG } from '../combat/config';
import { tinggiMedan } from '../world/terrain';

/**
 * Model Wijaya beranimasi (glTF + Draco), hanya aktif dengan `?model=wijaya`. Mengganti kapsul pemain
 * dengan mesh berkulit dan memilih aksi dari status Pemain dan PertarunganPemain. Kapsul tabrakan tetap.
 *
 * Nama aksi mengikuti tools/blender/gabung_animasi.py: idle, siaga, jalan (jalan pelan), lari-santai,
 * lari-kencang, jongkok-jalan, jongkok-diam, serang-1..3, serang-berat, tangkis, hindar, terkena, mati.
 */

/**
 * Kecepatan langkah tiap klip (m/s), diukur dari laju kaki tumpu relatif pinggul pada FBX sumber
 * (jalan 1,43; lari-santai 2,35; lari-kencang 4,5; jongkok-jalan
 * 1,10). timeScale = laju / nilai ini, dibatasi SKALA_GERAK supaya langkah tidak tampak dipercepat.
 */
const LAJU_KLIP: Record<string, number> = { jalan: 1.43, 'lari-santai': 2.35, 'lari-kencang': 4.5, 'jongkok-jalan': 1.1 };
const SKALA_GERAK = { min: 0.6, maks: 1.5 };
/**
 * Fase kaki tiap klip gerak, diukur dari FBX sumber: `awal` = bagian siklus saat kaki kiri paling depan,
 * `siklus` = jumlah siklus langkah dalam satu klip. Dipakai supaya pindah klip tidak mengganti kaki tumpu.
 */
const FASE_KLIP: Record<string, { awal: number; siklus: number }> = {
  jalan: { awal: 0.256, siklus: 1 },
  'lari-santai': { awal: 0.23, siklus: 1 },
  'lari-kencang': { awal: 0.21, siklus: 2 },
  'jongkok-jalan': { awal: 0.271, siklus: 1 },
};
/**
 * Pengali waktu klip aksi tetap. Klip serang tidak di sini: pengalinya dihitung dari panjang klip dibagi durasi
 * serangan di combat.json (ringan 0,6 s / 0,5 s = 1,2; berat 1,0 s / 0,95 s = 1,05), sehingga bingkai kontak
 * (bingkai 8 dan 15) jatuh di tengah jendela kena.
 */
const SKALA_WAKTU: Partial<Record<string, number>> = {
  hindar: 2.5, terkena: 2.0, mati: 1.0, tangkis: 1.0, idle: 1.0, siaga: 1.0, 'jongkok-diam': 1.0,
};
const SKALA_TIKAMAN = 1.67;
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
  /** Benar saat ada lawan dalam jarak siaga keris (combat.json pemain.keris.jarakSiaga); diisi main tiap frame. */
  lawanDekat = false;
  /** Lapisan lengan kiri: tulang rantai lengan dan pose jaganya (combat.json pemain.lenganJaga), bobot 0 sampai 1. */
  private readonly lenganJaga: { tulang: THREE.Object3D; pose: THREE.Quaternion }[] = [];
  private bobotJaga = 0;
  /** Sendi kaki dan tingginya di atas tanah pada pose istirahat, untuk mengangkat model di lereng. */
  private readonly sendiKaki: { tulang: THREE.Object3D; tinggi: number }[] = [];
  private angkat = 0;
  private readonly bantu = new THREE.Vector3();
  private kerisTangan: THREE.Object3D | null = null;
  private kerisSarung: THREE.Object3D | null = null;
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
    // Sendi kaki (pergelangan dan pangkal jari) dengan tinggi istirahatnya di atas titik kaki pemain.
    akar.updateWorldMatrix(true, true);
    const yKaki = this.pemain.grup.getWorldPosition(new THREE.Vector3()).y;
    for (const akhiran of ['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase']) {
      const tulang = akar.getObjectByName(`mixamorig${akhiran}`) ?? akar.getObjectByName(`mixamorig:${akhiran}`);
      if (tulang) this.sendiKaki.push({ tulang, tinggi: tulang.getWorldPosition(new THREE.Vector3()).y - yKaki });
    }
    // Pose jaga lengan kiri dari klip sumber pada bingkai kontaknya.
    const J = KONFIG.pemain.lenganJaga;
    const sumber = gltf.animations.find((k) => k.name === J.sumberKlip);
    if (sumber) {
      for (const akhiran of ['LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand']) {
        const tulang = akar.getObjectByName(`mixamorig${akhiran}`) ?? akar.getObjectByName(`mixamorig:${akhiran}`);
        const jalur = sumber.tracks.find((t) => tulang && t.name === `${tulang.name}.quaternion`);
        if (!tulang || !jalur) continue;
        // Kunci terdekat dengan waktu bingkai (klip disampel tiap bingkai, jadi tidak perlu interpolasi).
        const t = J.bingkai / 30;
        let i = 0;
        for (let k = 1; k < jalur.times.length; k++) if (Math.abs(jalur.times[k] - t) < Math.abs(jalur.times[i] - t)) i = k;
        this.lenganJaga.push({ tulang, pose: new THREE.Quaternion().fromArray(jalur.values, i * 4) });
      }
    }
    // Kapsul dan hidung disembunyikan; keris balok dipindah ke tulang tangan kanan.
    this.pemain.kapsul.visible = false;
    this.pemain.condongAktif = false;
    this.pemain.pose.children.forEach((c) => {
      if (c.name === 'hidung') c.visible = false;
    });
    if (this.tulangTangan) this.pasangKeris(this.tulangTangan, this.tarung.ambilKeris(), akar);
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
   * hulu di tengah telapak (jari menggenggam di semua klip), arah bilah dari combat.json (pasang.arahXfn,
   * dikalibrasi dari tusukan serang-3), sama dengan keris sementara di tools/blender/pratinjau_animasi.py.
   * Salinan kedua di pinggang kiri depan (tulang pinggul) tampil saat keris disarungkan.
   */
  private pasangKeris(tangan: THREE.Object3D, asli: THREE.Group, akar: THREE.Object3D): void {
    const K = KONFIG.pemain.keris;
    const pinggul = akar.getObjectByName('mixamorigHips') ?? akar.getObjectByName('mixamorig:Hips');
    if (pinggul) {
      akar.updateWorldMatrix(true, true);
      const sarung = asli.clone();
      sarung.visible = false;
      // Di ruang model: +x kiri tokoh, +y atas, +z depan.
      const p = pinggul.getWorldPosition(new THREE.Vector3());
      akar.worldToLocal(p).add(new THREE.Vector3(...(K.sarung.letak as [number, number, number])));
      const z = new THREE.Vector3(...(K.sarung.arah as [number, number, number])).normalize();
      const x = new THREE.Vector3(0, 0, 1).cross(z).normalize();
      const y = z.clone().cross(x);
      const ms = new THREE.Matrix4().makeBasis(x, y, z).setPosition(p).scale(new THREE.Vector3(K.pasang.skala, K.pasang.skala, K.pasang.skala));
      ms.premultiply(akar.matrixWorld).premultiply(new THREE.Matrix4().copy(pinggul.matrixWorld).invert());
      ms.decompose(sarung.position, sarung.quaternion, sarung.scale);
      pinggul.add(sarung);
      this.kerisSarung = sarung;
    }
    asli.visible = false;
    const keris = asli.clone();
    keris.visible = true;
    this.kerisTangan = keris;
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
    // Kerangka acuan tangan dari sendi: x garis buku jari ke sisi telunjuk, f arah jari, n normal telapak
    // (pada pose istirahat, lengan terentang, telapak menghadap bawah).
    const bukuJari = i1.clone().sub(p1).normalize();
    const jari = m1.clone().sub(t);
    jari.addScaledVector(bukuJari, -jari.dot(bukuJari)).normalize();
    const normal = bukuJari.clone().cross(jari).normalize();
    if (normal.y > 0) normal.negate();
    const pusat = t.clone().lerp(m1, 0.75).addScaledVector(normal, 0.03);
    const [ax, af, an] = K.pasang.arahXfn;
    const bilah = bukuJari.clone().multiplyScalar(ax).addScaledVector(jari, af).addScaledVector(normal, an).normalize(); // sumbu +z keris
    const atas = normal.clone().addScaledVector(bilah, -normal.dot(bilah)).normalize();
    const samping = atas.clone().cross(bilah);
    const m = new THREE.Matrix4().makeBasis(samping, atas, bilah).setPosition(pusat).scale(new THREE.Vector3(K.pasang.skala, K.pasang.skala, K.pasang.skala));
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
      // Tanpa warp: warp memperlambat klip yang masuk selama peralihan menurut perbandingan panjang klip
      // (dari idle 7 detik ke serang 0,6 detik hampir berhenti dulu), sehingga kontak serang pertama terlambat
      // sekitar 0,07 detik dan bisa jatuh di luar jendela kena. Fase langkah sudah disamakan sendiri di atas.
      a.crossFadeFrom(this.aktif, CROSSFADE, false);
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

  /** Klip serang dari awal, diputar supaya seluruh klip habis tepat dalam `durasi` detik. */
  private serang(nama: string, durasi: number): void {
    this.mainkan(nama, true);
    if (this.aktif && this.namaAktif === nama) this.aktif.timeScale = this.aktif.getClip().duration / durasi;
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
        } else if (laju > SILUMAN.pemain.lajuLari) this.gerak('lari-kencang', 'lari-santai', laju);
        else if (laju > SILUMAN.pemain.lajuLariSantai) this.gerak('lari-santai', 'jalan', laju);
        else if (laju > 0.3) this.gerak('jalan', 'jalan', laju);
        else if (status === 'mengisi' || this.siaga) this.mainkan('siaga');
        else this.mainkan('idle');
        break;
      }
      case 'serangRingan': {
        const nama = `serang-${(this.tarung.komboSekarang % 3) + 1}`;
        if (masukBaru || this.namaAktif !== nama) this.serang(nama, KONFIG.pemain.seranganRingan.durasi);
        break;
      }
      case 'serangBerat':
        if (masukBaru) this.serang('serang-berat', KONFIG.pemain.seranganBerat.durasi);
        break;
      case 'tikaman':
      case 'sergap':
        // Tikaman dan Sergap jauh lebih singkat daripada serang ringan: tusukan diputar cepat.
        if (masukBaru) {
          this.mainkan('serang-3', true);
          if (this.aktif) this.aktif.timeScale = SKALA_TIKAMAN;
        }
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
    // Keris terhunus saat menyerang atau menangkis, atau ada lawan dekat dan tidak sedang lari kencang;
    // selain itu disarungkan di pinggang.
    const beraksi = status === 'mengisi' || status === 'serangRingan' || status === 'serangBerat' || status === 'tikaman' || status === 'sergap' || status === 'tangkis';
    const lariKencang = !p.jongkok && p.laju > SILUMAN.pemain.lajuLari;
    const terhunus = beraksi || (this.lawanDekat && !lariKencang);
    if (this.kerisTangan) this.kerisTangan.visible = terhunus || !this.kerisSarung;
    if (this.kerisSarung) this.kerisSarung.visible = !terhunus;
    this.mixer.update(dt);
    // Lereng: tanpa IK kaki, kaki yang melangkah ke arah naik masuk tanah (sampai 20 cm di lereng 25 derajat).
    // Model diangkat sejauh sendi kaki terdalam berada di bawah tanah; naik cepat, turun pelan supaya tidak
    // berdenyut tiap langkah. Hanya saat pemain berdiri di medan (bukan di lantai rumah atau batu).
    let tembus = 0;
    if (p.diTanah && Math.abs(p.posisi.y - tinggiMedan(p.posisi.x, p.posisi.z)) < 0.05 && status !== 'mati') {
      for (const { tulang, tinggi } of this.sendiKaki) {
        tulang.getWorldPosition(this.bantu);
        tembus = Math.max(tembus, tinggiMedan(this.bantu.x, this.bantu.z) + tinggi - (this.bantu.y - this.angkat));
      }
    }
    this.angkat += (tembus - this.angkat) * Math.min(1, (tembus > this.angkat ? 18 : 3) * dt);
    this.grup.position.y = this.angkat;
    // Lapisan bertopeng: setelah klip dipasang ke tulang, rantai lengan kiri dicampur ke pose jaga.
    const J = KONFIG.pemain.lenganJaga;
    const jaga = (status === 'serangRingan' || status === 'serangBerat') && (J.klip as string[]).includes(this.namaAktif);
    const langkah = dt / Math.max(J.peralihan, 1e-3);
    this.bobotJaga = jaga ? Math.min(1, this.bobotJaga + langkah) : Math.max(0, this.bobotJaga - langkah);
    if (this.bobotJaga > 0) {
      const w = this.bobotJaga * this.bobotJaga * (3 - 2 * this.bobotJaga);
      for (const { tulang, pose } of this.lenganJaga) tulang.quaternion.slerp(pose, w);
    }
  }
}
