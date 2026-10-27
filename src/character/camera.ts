import * as THREE from 'three';
import type { Input } from './input';
import { tinggiMedan } from '../world/terrain';
import { KONFIG } from '../combat/config';

const SENSITIVITAS = 0.0022;
const JARAK = 5.5;
const TINGGI_SASARAN = 1.4;
const PITCH_MIN = -0.25;
const PITCH_MAKS = 1.15;
const JARAK_AMAN = 0.3;
const PITCH_AWAL = 0.3;

/** Kamera orang ketiga di belakang pemain. Tidak menembus medan maupun benda padat. */
export class KameraOrangKetiga {
  yaw = 0;
  pitch = PITCH_AWAL;
  private readonly raycaster = new THREE.Raycaster();
  private readonly sasaran = new THREE.Vector3();
  private readonly arah = new THREE.Vector3();
  private jarakSekarang = JARAK;
  /** Saat bertarung kamera sedikit menjauh dan agak lebih tinggi supaya lawan terlihat. */
  modeTarung = false;
  private faktorTarung = 0;

  constructor(
    readonly kamera: THREE.PerspectiveCamera,
    private penghalang: THREE.Object3D[],
  ) {}

  perbarui(dt: number, input: Input, kakiPemain: THREE.Vector3): void {
    const { dx, dy } = input.ambilGerakMouse();
    this.yaw -= dx * SENSITIVITAS;
    this.pitch = Math.min(PITCH_MAKS, Math.max(PITCH_MIN, this.pitch + dy * SENSITIVITAS));

    // Peralihan halus masuk dan keluar mode bertarung.
    const tujuanTarung = this.modeTarung ? 1 : 0;
    this.faktorTarung += (tujuanTarung - this.faktorTarung) * Math.min(1, 3 * dt);
    const pitchEfektif = this.pitch + KONFIG.kamera.pitchTambahan * this.faktorTarung;
    const jarakTujuan = JARAK + KONFIG.kamera.jarakTambahan * this.faktorTarung;

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

    this.kamera.position.copy(this.sasaran).addScaledVector(this.arah, this.jarakSekarang);
    this.kamera.position.y = Math.max(
      this.kamera.position.y,
      tinggiMedan(this.kamera.position.x, this.kamera.position.z) + 0.4,
    );
    this.kamera.lookAt(this.sasaran);
  }
}
