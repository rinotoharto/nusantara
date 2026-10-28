import * as THREE from 'three';
import { tinggiMedan } from './terrain';
import { PEMANDU, type GayaPemandu } from './guide-config';

const P = PEMANDU.partikel;

// Titik kecil dengan ukuran tetap di layar relatif jarak; alpha per titik lewat atribut.
const VERTEX = /* glsl */ `
  attribute float alpha;
  attribute float fase;
  uniform float ukuran;
  varying float vAlpha;
  varying float vFase;
  void main() {
    vAlpha = alpha;
    vFase = fase;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = ukuran * (320.0 / max(1.0, -mv.z));
    gl_Position = projectionMatrix * mv;
  }
`;
// Cakram lembut (kunang) atau lonjong berputar (daun); berkedip pelan menurut fase masing-masing.
const FRAGMENT = /* glsl */ `
  uniform vec3 warna;
  uniform float waktu;
  uniform float kedip;
  uniform float kedipDalam;
  uniform float putar;
  varying float vAlpha;
  varying float vFase;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    if (putar > 0.0) {
      float a = waktu * putar + vFase * 6.2832;
      c = mat2(cos(a), -sin(a), sin(a), cos(a)) * c;
      c.x *= 2.2;
    }
    float d = length(c) * 2.0;
    float bentuk = smoothstep(1.0, 0.3, d);
    float k = 1.0 - kedipDalam * (0.5 + 0.5 * sin(waktu * kedip + vFase * 6.2832));
    gl_FragColor = vec4(warna, bentuk * vAlpha * k);
  }
`;

/**
 * Partikel pemandu arah (tombol Tab): titik-titik cahaya muncul di sekitar pemain lalu hanyut
 * ke arah penanda tujuan, sedikit berkelok, memudar setelah beberapa detik atau beberapa puluh meter.
 * Gaya `kunang` (malam, hijau kekuningan berkedip) dan `daun` (siang, cokelat kekuningan berputar)
 * dipilih dari data misi; angkanya di guide.json.
 */
export class Pemandu {
  readonly titik: THREE.Points;
  private readonly posisi: Float32Array;
  private readonly alpha: Float32Array;
  private readonly atribPosisi: THREE.BufferAttribute;
  private readonly atribAlpha: THREE.BufferAttribute;
  private readonly bahan: THREE.ShaderMaterial;
  // Keadaan tiap partikel: titik dasar lintasan, arah, tinggi di atas tanah, umur, benih kelok.
  private readonly dasarX = new Float32Array(P.jumlah);
  private readonly dasarZ = new Float32Array(P.jumlah);
  private readonly arahX = new Float32Array(P.jumlah);
  private readonly arahZ = new Float32Array(P.jumlah);
  private readonly tinggi = new Float32Array(P.jumlah);
  private readonly umur = new Float32Array(P.jumlah);
  private readonly benih = new Float32Array(P.jumlah);
  private readonly hidup = new Uint8Array(P.jumlah);
  private waktu = 0;
  private aktif = false;
  /** Berapa kali pemandu dipicu (untuk catatan playtest). */
  jumlahDipicu = 0;

  constructor(scene: THREE.Scene, gaya: GayaPemandu) {
    const G = P.gaya[gaya];
    const geometri = new THREE.BufferGeometry();
    this.posisi = new Float32Array(P.jumlah * 3);
    this.alpha = new Float32Array(P.jumlah);
    const fase = new Float32Array(P.jumlah);
    for (let i = 0; i < P.jumlah; i++) fase[i] = Math.random();
    this.atribPosisi = new THREE.BufferAttribute(this.posisi, 3).setUsage(THREE.DynamicDrawUsage);
    this.atribAlpha = new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage);
    geometri.setAttribute('position', this.atribPosisi);
    geometri.setAttribute('alpha', this.atribAlpha);
    geometri.setAttribute('fase', new THREE.BufferAttribute(fase, 1));
    this.bahan = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        warna: { value: new THREE.Color(G.warna) },
        waktu: { value: 0 },
        ukuran: { value: P.ukuran },
        kedip: { value: G.kedip },
        kedipDalam: { value: G.kedipDalam },
        putar: { value: G.putar },
      },
      transparent: true,
      depthWrite: false,
      blending: gaya === 'kunang' ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.jatuh = G.jatuh;
    this.titik = new THREE.Points(geometri, this.bahan);
    this.titik.frustumCulled = false;
    this.titik.visible = false;
    this.titik.name = 'pemandu';
    scene.add(this.titik);
  }

  private readonly jatuh: number;

  /** Memancarkan partikel dari sekitar `dari` (titik kaki pemain) ke arah penanda (x, z). */
  pancarkan(dari: THREE.Vector3, ke: [number, number]): void {
    this.jumlahDipicu += 1;
    for (let i = 0; i < P.jumlah; i++) {
      const sudut = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * P.jariMuncul;
      this.dasarX[i] = dari.x + Math.cos(sudut) * r;
      this.dasarZ[i] = dari.z + Math.sin(sudut) * r;
      let ax = ke[0] - this.dasarX[i];
      let az = ke[1] - this.dasarZ[i];
      const d = Math.hypot(ax, az) || 1;
      ax /= d;
      az /= d;
      // Arah diacak sedikit (sekitar 12 derajat) supaya kawanan tidak segaris.
      const simpang = (Math.random() - 0.5) * 0.42;
      this.arahX[i] = ax * Math.cos(simpang) - az * Math.sin(simpang);
      this.arahZ[i] = ax * Math.sin(simpang) + az * Math.cos(simpang);
      this.tinggi[i] = P.tinggiMin + Math.random() * (P.tinggiMaks - P.tinggiMin);
      this.umur[i] = -Math.random() * 0.7; // mulai bergiliran selama 0,7 detik
      this.benih[i] = Math.random() * Math.PI * 2;
      this.hidup[i] = 1;
      this.alpha[i] = 0;
    }
    this.aktif = true;
    this.titik.visible = true;
  }

  perbarui(dt: number): void {
    if (!this.aktif) return;
    this.waktu += dt;
    this.bahan.uniforms.waktu.value = this.waktu;
    let adaHidup = false;
    for (let i = 0; i < P.jumlah; i++) {
      if (!this.hidup[i]) continue;
      this.umur[i] += dt;
      const u = this.umur[i];
      if (u < 0) {
        this.alpha[i] = 0;
        adaHidup = true;
        continue;
      }
      const jarak = P.laju * u;
      if (u >= P.umur || jarak >= P.jarakMaks) {
        this.hidup[i] = 0;
        this.alpha[i] = 0;
        continue;
      }
      adaHidup = true;
      this.dasarX[i] += this.arahX[i] * P.laju * dt;
      this.dasarZ[i] += this.arahZ[i] * P.laju * dt;
      // Kelok ke samping arah hanyut, naik-turun lembut, daun perlahan turun.
      const samping = Math.sin(u * P.frekuensiKelok * Math.PI * 2 + this.benih[i]) * P.kelok;
      const x = this.dasarX[i] - this.arahZ[i] * samping;
      const z = this.dasarZ[i] + this.arahX[i] * samping;
      const naik = Math.sin(u * 2.3 + this.benih[i]) * 0.3 - this.jatuh * u;
      const y = tinggiMedan(x, z) + Math.max(0.2, this.tinggi[i] + naik);
      this.posisi[i * 3] = x;
      this.posisi[i * 3 + 1] = y;
      this.posisi[i * 3 + 2] = z;
      // Muncul cepat, memudar menjelang akhir umur atau jarak.
      const sisa = Math.min(1 - u / P.umur, 1 - jarak / P.jarakMaks);
      this.alpha[i] = Math.min(1, u * 4) * Math.min(1, sisa * 2.5);
    }
    this.atribPosisi.needsUpdate = true;
    this.atribAlpha.needsUpdate = true;
    if (!adaHidup) {
      this.aktif = false;
      this.titik.visible = false;
    }
  }
}
