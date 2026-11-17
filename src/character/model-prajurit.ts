import * as THREE from 'three';
import { clone as klonKerangka } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Lawan, StatusLawan } from '../combat/enemy';
import { KONFIG } from '../combat/config';
import DATA_MODEL from '../data/models.json';
import { ModelKarakter, cariTulang, muatGlb, type TabelKlip } from './model-karakter';

/**
 * Model prajurit beranimasi untuk penjaga, lawan, dan perampok; hanya aktif dengan `?model=prajurit`.
 * Satu GLB dimuat sekali lalu digandakan per karakter (kerangka sendiri, geometri dan tekstur bersama).
 * Kapsul tabrakan dan logika lawan tidak berubah: model hanya membaca status, arah hadap, dan laju lawan.
 * Angka di src/data/models.json.
 */

const M = DATA_MODEL.prajurit;
const TABEL: TabelKlip = {
  laju: M.lajuKlip,
  fase: M.faseKlip,
  skalaWaktu: M.skalaWaktu,
  sekali: new Set(['serang-1', 'serang-2', 'serang-3', 'serang-berat', 'hindar', 'terkena', 'mati']),
  skalaGerak: M.skalaGerak,
  crossfade: M.crossfade,
};

export type JenisSenjata = 'tombak' | 'golok';
type WarnaPihak = { ikat: string; kain: string } | null;

/** Status di luar pertarungan: berdiri memakai idle, bukan siaga. */
const TENANG: ReadonlySet<StatusLawan> = new Set<StatusLawan>(['diam', 'patroli', 'curiga', 'mencari', 'kembali', 'pergi']);

/** Peta lingkungan kecil (gradasi langit sore ke tanah) sebagai cahaya pengisi kulit, sama seperti model Wijaya. */
let lingkungan: THREE.CubeTexture | null = null;
function petaLingkungan(): THREE.CubeTexture {
  if (lingkungan) return lingkungan;
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
  const samping = (): HTMLCanvasElement => sisi(['#e8b47a', '#c98f55', '#5a4a2c']);
  lingkungan = new THREE.CubeTexture([samping(), samping(), sisi(['#e8b47a']), sisi(['#5a4a2c']), samping(), samping()]);
  lingkungan.colorSpace = THREE.SRGBColorSpace;
  lingkungan.needsUpdate = true;
  return lingkungan;
}

/**
 * Bahan per karakter (supaya sinar isyarat dan kilatan kena bisa berbeda tiap karakter) dengan pewarnaan
 * ulang kain dan ikat kepala menurut pihak (topeng dari posisi dan rona, lihat models.json), terangnya dipertahankan. Semua salinan memakai satu
 * program shader.
 */
function bahanPihak(asal: THREE.MeshStandardMaterial, pihak: string): THREE.MeshStandardMaterial {
  const bahan = asal.clone();
  bahan.envMap = petaLingkungan();
  bahan.envMapIntensity = M.lingkungan;
  const W = M.warna;
  const warna = (W.pihak as Record<string, WarnaPihak>)[pihak] ?? null;
  const seragam = {
    uKuatPihak: { value: warna ? 1 : 0 },
    uWarnaIkat: { value: new THREE.Color(warna?.ikat ?? '#ffffff') },
    uWarnaKain: { value: new THREE.Color(warna?.kain ?? '#ffffff') },
    uAmbangNila: { value: new THREE.Vector2(W.ambang[0], W.ambang[1]) },
    uAmbangHangat: { value: new THREE.Vector2(W.hangat[0], W.hangat[1]) },
    uZonaKain: { value: new THREE.Vector2(W.zonaKain[0], W.zonaKain[1]) },
    uTinggiIkat: { value: W.tinggiIkat },
    uTerangAcuan: { value: W.terangAcuan },
  };
  bahan.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, seragam);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vTinggiModel;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTinggiModel = position.y;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying float vTinggiModel;
uniform float uKuatPihak;
uniform vec3 uWarnaIkat;
uniform vec3 uWarnaKain;
uniform vec2 uAmbangNila;
uniform vec2 uAmbangHangat;
uniform vec2 uZonaKain;
uniform float uTinggiIkat;
uniform float uTerangAcuan;`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
if (uKuatPihak > 0.0) {
  vec3 asalNila = diffuseColor.rgb;
  float kanalMaks = max(asalNila.r, max(asalNila.g, asalNila.b));
  // Ikat kepala (di atas uTinggiIkat): texel berona biru. Kain (zona tinggi pada pose istirahat): semua texel
  // yang tidak hangat, sehingga kulit paha dan sabuk cokelat di zona yang sama tidak ikut diwarnai.
  float kebiruan = (asalNila.b - max(asalNila.r, asalNila.g)) / max(kanalMaks, 1e-3);
  float hangat = (asalNila.r - asalNila.b) / max(kanalMaks, 1e-3);
  float diIkat = step(uTinggiIkat, vTinggiModel);
  float diKain = step(uZonaKain.x, vTinggiModel) * step(vTinggiModel, uZonaKain.y);
  float topengNila = diIkat * smoothstep(uAmbangNila.x, uAmbangNila.y, kebiruan)
    + diKain * (1.0 - smoothstep(uAmbangHangat.x, uAmbangHangat.y, hangat));
  float terang = dot(asalNila, vec3(0.2126, 0.7152, 0.0722)) / uTerangAcuan;
  vec3 sasaran = mix(uWarnaKain, uWarnaIkat, diIkat);
  diffuseColor.rgb = mix(asalNila, sasaran * terang, clamp(topengNila, 0.0, 1.0) * uKuatPihak);
}`,
      );
  };
  bahan.customProgramCacheKey = () => 'prajurit-pihak';
  return bahan;
}

function balok(x: number, y: number, z: number, warna: number, logam = 0): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(x, y, z),
    new THREE.MeshStandardMaterial({ color: warna, metalness: logam, roughness: logam > 0 ? 0.35 : 0.9 }),
  );
  m.castShadow = true;
  return m;
}

export class ModelPrajurit extends ModelKarakter {
  siap = false;
  private dibuang = false;
  private statusSebelum: StatusLawan | '' = '';
  private readonly posisiSebelum = new THREE.Vector3();
  private laju = 0;
  private maju = 1;
  private tebasanKedua = false;
  private readonly bahanSemua: THREE.MeshStandardMaterial[] = [];
  private readonly meshSemua: THREE.Mesh[] = [];
  private tulangTangan: THREE.Object3D | null = null;
  /** Tombak: mengikuti tangan, arahnya di ruang badan (lihat models.json). */
  private tombak: THREE.Group | null = null;
  private readonly arahTombak = new THREE.Quaternion();
  private readonly bantu = new THREE.Vector3();
  private readonly bantuQ = new THREE.Quaternion();
  private lompatFrame = false;
  private tunggak = 0;
  private readonly bola = new THREE.Sphere(new THREE.Vector3(), 1.6);

  constructor(readonly lawan: Lawan, private readonly jenis: JenisSenjata) {
    super(TABEL);
    lawan.grup.add(this.grup);
    this.posisiSebelum.copy(lawan.posisi);
  }

  async muat(dasar: string): Promise<void> {
    const gltf = await muatGlb(dasar, M.berkas);
    if (this.dibuang) return;
    const akar = klonKerangka(gltf.scene);
    const bahanBaru = new Map<THREE.Material, THREE.MeshStandardMaterial>();
    akar.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = false;
      m.frustumCulled = false;
      const asal = m.material as THREE.MeshStandardMaterial;
      let baru = bahanBaru.get(asal);
      if (!baru) {
        baru = bahanPihak(asal, this.lawan.pihak);
        bahanBaru.set(asal, baru);
        this.bahanSemua.push(baru);
      }
      m.material = baru;
      this.meshSemua.push(m);
    });
    this.grup.add(akar);
    this.pasangAksi(akar, gltf.animations);
    this.tulangTangan = cariTulang(akar, 'RightHand') ?? null;
    akar.updateWorldMatrix(true, true);
    if (this.tulangTangan) {
      if (this.jenis === 'tombak') this.pasangTombak();
      else this.pasangGolok(this.tulangTangan);
    }
    this.lawan.simpulKapsul.visible = false;
    this.siap = true;
    this.mainkan('idle');
  }

  /** Lepas dari lawan (lawan dicabut dari misi); kapsulnya ditampilkan lagi. */
  buang(): void {
    this.dibuang = true;
    this.mixer?.stopAllAction();
    this.lawan.grup.remove(this.grup);
    this.lawan.simpulKapsul.visible = true;
    for (const b of this.bahanSemua) b.dispose();
  }

  private pasangTombak(): void {
    const T = M.senjata.tombak;
    const tombak = new THREE.Group();
    const batang = balok(T.tebal, T.tebal, T.depan + T.belakang, 0x7a5a36);
    batang.position.z = (T.depan - T.belakang) / 2;
    const mata = balok(T.tebal * 1.5, T.tebal * 0.7, T.mata, 0x9aa0a8, 0.6);
    mata.position.z = T.depan;
    tombak.add(batang, mata);
    this.grup.add(tombak);
    this.tombak = tombak;
    this.arahTombak.setFromEuler(new THREE.Euler(-THREE.MathUtils.degToRad(90 - T.condongBawa), 0, 0));
    tombak.quaternion.copy(this.arahTombak);
  }

  /**
   * Golok di genggaman, ditempel ke tulang tangan kanan. Kerangka prajurit hanya punya jempol dan telunjuk,
   * jadi kerangka acuan tangan dihitung dari keduanya pada pose istirahat: f arah jari, x sisi jempol, n normal
   * telapak (menghadap bawah).
   */
  private pasangGolok(tangan: THREE.Object3D): void {
    const G = M.senjata.golok;
    const golok = new THREE.Group();
    const bilah = balok(G.tebal, G.lebar, G.bilah, 0x8e9299, 0.6);
    bilah.position.z = G.bilah / 2 + G.gagang / 2;
    golok.add(bilah, balok(0.06, 0.06, G.gagang, 0x5a3a1e));
    const telunjuk = tangan.getObjectByName(`${tangan.name}Index1`);
    const jempol = tangan.getObjectByName(`${tangan.name}Thumb1`);
    if (!telunjuk || !jempol) {
      golok.position.set(0, 0.08, 0.02);
      golok.rotation.set(-Math.PI / 2, 0, 0);
      tangan.add(golok);
      return;
    }
    const dunia = (o: THREE.Object3D): THREE.Vector3 => o.getWorldPosition(new THREE.Vector3());
    const t = dunia(tangan);
    const jari = dunia(telunjuk).sub(t).normalize();
    const sisi = dunia(jempol).sub(t);
    sisi.addScaledVector(jari, -sisi.dot(jari)).normalize();
    const normal = sisi.clone().cross(jari).normalize();
    if (normal.y > 0) normal.negate();
    const pusat = t.clone().addScaledVector(jari, 0.07).addScaledVector(normal, 0.03);
    const [ax, af, an] = G.arahXfn;
    const arah = sisi.clone().multiplyScalar(ax).addScaledVector(jari, af).addScaledVector(normal, an).normalize();
    const atas = normal.clone().addScaledVector(arah, -normal.dot(arah)).normalize();
    const samping = atas.clone().cross(arah);
    const m = new THREE.Matrix4().makeBasis(samping, atas, arah).setPosition(pusat);
    m.premultiply(new THREE.Matrix4().copy(tangan.matrixWorld).invert());
    m.decompose(golok.position, golok.quaternion, golok.scale);
    tangan.add(golok);
  }

  /** Klip serang dimulai sedemikian sehingga bingkai kontaknya jatuh `saatKena` detik dari sekarang. */
  private serangTepat(nama: string, saatKena: number): void {
    const S = M.serang;
    const awal = Math.max(0, S.kontakDetik - saatKena * S.skala);
    this.mainkan(nama, true, awal);
    if (this.aktif && this.namaAktif === nama) this.aktif.timeScale = S.skala;
  }

  /** Dipanggil tiap frame logika sesudah lawan diperbarui. `posPemain` dan `kamera` untuk penghematan. */
  perbarui(dt: number, posPemain: THREE.Vector3, frustum: THREE.Frustum | null): void {
    if (!this.mixer || !this.siap || dt <= 0) return;
    const l = this.lawan;
    this.grup.rotation.y = l.hadap;
    // Laju dan arah gerak dari perpindahan kapsul.
    const dx = l.posisi.x - this.posisiSebelum.x;
    const dz = l.posisi.z - this.posisiSebelum.z;
    this.posisiSebelum.copy(l.posisi);
    const lajuKini = Math.min(8, Math.hypot(dx, dz) / dt);
    this.laju += (lajuKini - this.laju) * Math.min(1, 10 * dt);
    if (lajuKini > 0.2) this.maju = dx * Math.sin(l.hadap) + dz * Math.cos(l.hadap) < -0.3 * lajuKini * dt ? -1 : 1;
    if (!l.grup.visible) return;

    const status = l.status;
    const masukBaru = status !== this.statusSebelum;
    this.statusSebelum = status;
    const A = M.ambangLaju;
    let siapTombak = false;
    let tusuk = false;
    switch (status) {
      case 'mati':
        if (masukBaru) this.mainkan('mati', true);
        break;
      case 'terhuyung':
        if (masukBaru) this.mainkan('terkena', true);
        break;
      case 'bersiap':
        this.mainkan('siaga');
        siapTombak = true;
        break;
      case 'menyerang':
        if (this.jenis === 'tombak') {
          // Tusukan mengenai 0,08 detik setelah mulai menyerang (src/combat/enemy.ts).
          if (masukBaru) this.serangTepat('serang-3', 0.08);
          tusuk = true;
        } else {
          const T = KONFIG.perampok.tebasan;
          if (masukBaru) {
            this.tebasanKedua = false;
            this.serangTepat('serang-1', T.pertama);
          } else if (!this.tebasanKedua && l.waktuStatus >= T.kedua - M.serang.kontakDetik / M.serang.skala) {
            this.tebasanKedua = true;
            this.serangTepat('serang-2', Math.max(0, T.kedua - l.waktuStatus));
          }
        }
        break;
      default:
        if (this.laju < A.diam) this.mainkan(TENANG.has(status) ? 'idle' : 'siaga');
        else if (this.laju < A.jalan) this.gerak('jalan', 'jalan', this.laju, this.maju);
        else if (this.laju < A.lariSantai) this.gerak('lari-santai', 'jalan', this.laju);
        else this.gerak('lari-kencang', 'lari-santai', this.laju);
        siapTombak = status === 'mengelilingi' || status === 'mundur';
    }

    // Sinar isyarat (kuning), terhuyung (biru), dan kilatan kena diteruskan dari bahan kapsul.
    const kapsul = l.bahanKapsul;
    for (const b of this.bahanSemua) {
      b.emissive.copy(kapsul.emissive);
      b.emissiveIntensity = kapsul.emissiveIntensity * M.kilatan;
    }

    // Penghematan (models.json performa.hemat): jauh = setengah laju, luar kamera = tidak dianimasikan.
    // Waktu yang dilewati ditunggak lalu dibayar pada pembaruan berikutnya, supaya klip tidak melambat.
    const P = M.performa;
    const langkah = dt + this.tunggak;
    this.tunggak = 0;
    if (P.hemat) {
      const jarak = Math.hypot(l.posisi.x - posPemain.x, l.posisi.z - posPemain.z);
      const bayang = jarak < P.jarakBayangan;
      for (const m of this.meshSemua) m.castShadow = bayang;
      this.bantu.copy(l.posisi);
      this.bantu.y += 0.9;
      this.bola.center.copy(this.bantu);
      if (frustum && !frustum.intersectsSphere(this.bola)) {
        this.tunggak = Math.min(0.5, langkah);
        return;
      }
      if (jarak > P.jarakSetengah) {
        this.lompatFrame = !this.lompatFrame;
        if (this.lompatFrame) {
          this.tunggak = langkah;
          return;
        }
      }
    }
    this.mixer.update(langkah);

    if (this.tombak && this.tulangTangan) {
      const T = M.senjata.tombak;
      const condong = tusuk ? T.condongTusuk : siapTombak ? T.condongSiap : 90 - T.condongBawa;
      this.bantuQ.setFromEuler(new THREE.Euler(-THREE.MathUtils.degToRad(condong), 0, 0));
      this.arahTombak.slerp(this.bantuQ, Math.min(1, dt / Math.max(T.peralihan, 1e-3)));
      this.tombak.quaternion.copy(this.arahTombak);
      this.tulangTangan.getWorldPosition(this.bantu);
      this.grup.worldToLocal(this.bantu);
      this.tombak.position.set(this.bantu.x + T.geser[0], this.bantu.y + T.geser[1], this.bantu.z + T.geser[2]);
      this.tombak.visible = status !== 'mati' || l.waktuStatus < 0.4;
    }
  }
}

/** Memasang model prajurit ke tiap lawan yang didaftarkan dan memperbaruinya tiap frame. */
export class PengelolaModelPrajurit {
  private readonly model = new Map<Lawan, ModelPrajurit>();
  private readonly frustum = new THREE.Frustum();
  private readonly matriks = new THREE.Matrix4();

  constructor(private readonly dasar: string) {}

  get jumlah(): number {
    return this.model.size;
  }

  pasang(lawan: Lawan, jenis: JenisSenjata): void {
    if (this.model.has(lawan)) return;
    const m = new ModelPrajurit(lawan, jenis);
    this.model.set(lawan, m);
    m.muat(this.dasar).catch((e) => console.error('[model] gagal memuat prajurit.glb', e));
  }

  lepas(lawan: Lawan): void {
    this.model.get(lawan)?.buang();
    this.model.delete(lawan);
  }

  perbarui(dt: number, posPemain: THREE.Vector3, kamera: THREE.Camera): void {
    this.matriks.multiplyMatrices(kamera.projectionMatrix, kamera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.matriks);
    for (const m of this.model.values()) m.perbarui(dt, posPemain, this.frustum);
  }
}
