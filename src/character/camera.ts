import * as THREE from 'three';
import type { Input } from './input';
import { tinggiMedan } from '../world/terrain';
import { KONFIG } from '../combat/config';
import type { PoseKamera } from '../dialog/sinematik';

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
  /** Pose sinematik (dialog). Selama ada, mouse diabaikan dan kamera bergerak pelan ke pose ini. */
  sinematik: PoseKamera | null = null;
  private campurSinematik = 0;
  private readonly posisiSinematik = new THREE.Vector3();
  private readonly sasaranSinematik = new THREE.Vector3();

  constructor(
    readonly kamera: THREE.PerspectiveCamera,
    private penghalang: THREE.Object3D[],
  ) {}

  perbarui(dt: number, input: Input, kakiPemain: THREE.Vector3): void {
    const { dx, dy } = input.ambilGerakMouse();
    if (!this.sinematik) {
      this.yaw -= dx * SENSITIVITAS;
      this.pitch = Math.min(PITCH_MAKS, Math.max(PITCH_MIN, this.pitch + dy * SENSITIVITAS));
    }

    // Peralihan halus masuk dan keluar mode bertarung.
    const tujuanTarung = this.modeTarung ? 1 : 0;
    this.faktorTarung += (tujuanTarung - this.faktorTarung) * Math.min(1, 3 * dt);
    const pitchEfektif = this.pitch + KONFIG.kamera.pitchTambahan * this.faktorTarung;
    const jarakTujuan = Math.max(1.5, JARAK + KONFIG.kamera.jarakTambahan * this.faktorTarung - this.mendekat);

    this.sasaran.set(kakiPemain.x, kakiPemain.y + TINGGI_SASARAN, kakiPemain.z);
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
