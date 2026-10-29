import * as THREE from 'three';
import type { Input } from './input';
import { tinggiMedan } from '../world/terrain';
import { KONFIG } from '../combat/config';
import type { PoseKamera } from '../dialog/sinematik';
import { PEMANDU } from '../world/guide-config';
import { INPUT } from './gamepad';

const SENSITIVITAS = 0.0022;
const JARAK = 5.5;
const TINGGI_SASARAN = 1.4;
const PITCH_MIN = -0.25;
const PITCH_MAKS = 1.15;
const JARAK_AMAN = 0.3;
const PITCH_AWAL = 0.3;
const LAMA_CAMPUR_SINEMATIK = 0.8; // detik peralihan masuk dan keluar pose sinematik
const LAJU_SINEMATIK = 3; // seberapa cepat kamera mengejar pose sinematik yang berpindah

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Selisih sudut terpendek dari `dari` ke `ke`, dalam (-PI, PI]. */
function selisihSudut(dari: number, ke: number): number {
  const d = ke - dari;
  return Math.atan2(Math.sin(d), Math.cos(d));
}

/** Kamera orang ketiga di belakang pemain. Tidak menembus medan maupun benda padat. */
export class KameraOrangKetiga {
  yaw = 0;
  pitch = PITCH_AWAL;
  private readonly raycaster = new THREE.Raycaster();
  private readonly sasaran = new THREE.Vector3();
  private readonly arah = new THREE.Vector3();
  private readonly posisiNormal = new THREE.Vector3();
  private readonly sasaranAkhir = new THREE.Vector3();
  private jarakSekarang = JARAK;
  /** Saat bertarung kamera sedikit menjauh dan agak lebih tinggi supaya lawan terlihat. */
  modeTarung = false;
  private faktorTarung = 0;
  /** Pengurangan jarak sementara (meter), misalnya saat Tikaman Keris mengenai. */
  mendekat = 0;
  /** Penurunan titik pandang sementara (meter), misalnya saat Sergap: kamera ikut merendah. */
  merendah = 0;
  /** Pose sinematik (dialog). Selama ada, mouse diabaikan dan kamera bergerak pelan ke pose ini. */
  sinematik: PoseKamera | null = null;
  private campurSinematik = 0;
  private readonly posisiSinematik = new THREE.Vector3();
  private readonly sasaranSinematik = new THREE.Vector3();
  /** Pengaturan pemain: pengali kepekaan mouse dan stik, balik sumbu Y. */
  kepekaanMouse = 1;
  kepekaanStik = 1;
  balikY = false;
  /** Arahan: kamera menoleh halus ke titik ini (x, z) lalu kembali; batal begitu mouse bergerak. */
  private arahanTitik: { x: number; z: number } | null = null;
  private arahanWaktu = 0;
  private yawSebelumArahan = 0;

  constructor(
    readonly kamera: THREE.PerspectiveCamera,
    private penghalang: THREE.Object3D[],
  ) {}

  /**
   * Arahan ke penanda: yaw berputar halus ke arah titik (fase putar), ditahan sampai `lama`,
   * lalu kembali ke yaw semula. Kamera memandang dari belakang pemain, jadi yaw yang
   * "melihat ke arah (dx, dz)" adalah atan2(-dx, -dz).
   */
  private perbaruiArahan(dt: number, kakiPemain: THREE.Vector3): void {
    const A = PEMANDU.arahanKamera;
    const t = this.arahanTitik as { x: number; z: number };
    this.arahanWaktu += dt;
    const yawKe = Math.atan2(-(t.x - kakiPemain.x), -(t.z - kakiPemain.z));
    if (this.arahanWaktu <= A.lama) {
      const k = Math.min(1, (A.lamaPutar > 0 ? dt / A.lamaPutar : 1) * 3);
      this.yaw += selisihSudut(this.yaw, yawKe) * k;
      return;
    }
    const sisa = this.arahanWaktu - A.lama;
    const k = Math.min(1, (A.lamaPutar > 0 ? dt / A.lamaPutar : 1) * 3);
    this.yaw += selisihSudut(this.yaw, this.yawSebelumArahan) * k;
    if (sisa >= A.lamaPutar || Math.abs(selisihSudut(this.yaw, this.yawSebelumArahan)) < 0.01) {
      this.yaw = this.yawSebelumArahan;
      this.arahanTitik = null;
    }
  }

  /** Benar selama arahan kamera ke penanda sedang berjalan. */
  get sedangDiarahkan(): boolean {
    return this.arahanTitik !== null;
  }

  /** Mulai arahan: menoleh ke arah (x, z) selama `lama` detik lalu kembali ke yaw semula. */
  arahkanKe(x: number, z: number): void {
    this.arahanTitik = { x, z };
    this.arahanWaktu = 0;
    this.yawSebelumArahan = this.yaw;
  }

  batalkanArahan(): void {
    this.arahanTitik = null;
  }

  perbarui(dt: number, input: Input, kakiPemain: THREE.Vector3): void {
    const mouse = input.ambilGerakMouse();
    const arahY = this.balikY ? -1 : 1;
    // Mouse dalam piksel; stik kanan dalam radian per detik penuh (INPUT.gamepad.kepekaanKamera).
    const dx = mouse.dx * SENSITIVITAS * this.kepekaanMouse + input.stikKamera.x * INPUT.gamepad.kepekaanKamera * this.kepekaanStik * dt;
    const dy = (mouse.dy * SENSITIVITAS * this.kepekaanMouse + input.stikKamera.y * INPUT.gamepad.kepekaanKamera * this.kepekaanStik * dt) * arahY;
    if (!this.sinematik) {
      this.yaw -= dx;
      this.pitch = Math.min(PITCH_MAKS, Math.max(PITCH_MIN, this.pitch + dy));
    }
    if (this.arahanTitik && (dx !== 0 || dy !== 0 || this.sinematik)) this.arahanTitik = null;
    if (this.arahanTitik) this.perbaruiArahan(dt, kakiPemain);

    // Peralihan halus masuk dan keluar mode bertarung.
    const tujuanTarung = this.modeTarung ? 1 : 0;
    this.faktorTarung += (tujuanTarung - this.faktorTarung) * Math.min(1, 3 * dt);
    const pitchEfektif = this.pitch + KONFIG.kamera.pitchTambahan * this.faktorTarung;
    const jarakTujuan = Math.max(1.5, JARAK + KONFIG.kamera.jarakTambahan * this.faktorTarung - this.mendekat);

    this.sasaran.set(kakiPemain.x, kakiPemain.y + TINGGI_SASARAN - this.merendah, kakiPemain.z);
    this.arah.set(
      Math.sin(this.yaw) * Math.cos(pitchEfektif),
      Math.sin(pitchEfektif),
      Math.cos(this.yaw) * Math.cos(pitchEfektif),
    );

    // Jarak terdekat ke benda padat sepanjang garis sasaran ke kamera.
    let jarak = jarakTujuan;
    this.raycaster.set(this.sasaran, this.arah);
    this.raycaster.far = jarakTujuan;
    const kena = this.raycaster.intersectObjects(this.penghalang, false);
    if (kena.length > 0) jarak = Math.min(jarak, Math.max(0.8, kena[0].distance - JARAK_AMAN));

    // Medan: cek beberapa titik sepanjang garis, pastikan tetap di atas tanah.
    const langkah = 10;
    for (let i = 1; i <= langkah; i++) {
      const d = (jarak * i) / langkah;
      const x = this.sasaran.x + this.arah.x * d;
      const y = this.sasaran.y + this.arah.y * d;
      const z = this.sasaran.z + this.arah.z * d;
      if (y < tinggiMedan(x, z) + 0.5) {
        jarak = Math.max(0.8, d - JARAK_AMAN);
        break;
      }
    }

    // Mendekat cepat saat terhalang, menjauh pelan saat lepas.
    const laju = jarak < this.jarakSekarang ? 1 : Math.min(1, 6 * dt);
    this.jarakSekarang += (jarak - this.jarakSekarang) * laju;

    this.posisiNormal.copy(this.sasaran).addScaledVector(this.arah, this.jarakSekarang);
    this.posisiNormal.y = Math.max(
      this.posisiNormal.y,
      tinggiMedan(this.posisiNormal.x, this.posisiNormal.z) + 0.4,
    );

    // Pose sinematik: dicampur halus dengan pose normal supaya masuk dan keluar dialog tidak melompat.
    if (this.sinematik) {
      if (this.campurSinematik === 0) {
        this.posisiSinematik.copy(this.kamera.position);
        this.sasaranSinematik.copy(this.sasaran);
      }
      this.campurSinematik = Math.min(1, this.campurSinematik + dt / LAMA_CAMPUR_SINEMATIK);
      const k = Math.min(1, LAJU_SINEMATIK * dt);
      this.posisiSinematik.lerp(this.sinematik.posisi, k);
      this.sasaranSinematik.lerp(this.sinematik.sasaran, k);
    } else if (this.campurSinematik > 0) {
      this.campurSinematik = Math.max(0, this.campurSinematik - dt / LAMA_CAMPUR_SINEMATIK);
    }
    const t = smoothstep(this.campurSinematik);
    this.kamera.position.lerpVectors(this.posisiNormal, this.posisiSinematik, t);
    this.kamera.position.y = Math.max(
      this.kamera.position.y,
      tinggiMedan(this.kamera.position.x, this.kamera.position.z) + 0.4,
    );
    this.sasaranAkhir.lerpVectors(this.sasaran, this.sasaranSinematik, t);
    this.kamera.lookAt(this.sasaranAkhir);
  }
}
