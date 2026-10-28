import * as THREE from 'three';
import { tinggiMedan } from './terrain';

const bahanBatang = new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.9 });
const bahanNyala = new THREE.MeshStandardMaterial({ color: 0xffc866, emissive: 0xffa030, emissiveIntensity: 2 });

// Pendar jauh: ukuran di layar dijaga tetap dengan menaikkan skala sprite sebanding jarak kamera.
const SKALA_PENDAR_PER_METER = 0.07;
const SKALA_PENDAR_MIN = 2.0;
const JARAK_PENDAR_MAKS = 150;
// Asap tipis: beberapa bidang transparan naik pelan, melebar dan memudar, lalu diulang dari bawah.
const JUMLAH_ASAP = 3;
const TINGGI_ASAP = 11;
const LAJU_ASAP = 1.4;

let teksturPendar: THREE.CanvasTexture | null = null;
/** Tekstur gradasi radial lembut untuk sprite pendar; dibuat sekali. */
function ambilTeksturPendar(): THREE.CanvasTexture {
  if (teksturPendar) return teksturPendar;
  const kanvas = document.createElement('canvas');
  kanvas.width = 64;
  kanvas.height = 64;
  const ctx = kanvas.getContext('2d') as CanvasRenderingContext2D;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255, 240, 200, 1)');
  g.addColorStop(0.18, 'rgba(255, 190, 90, 0.85)');
  g.addColorStop(0.5, 'rgba(255, 130, 40, 0.3)');
  g.addColorStop(1, 'rgba(255, 100, 30, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  teksturPendar = new THREE.CanvasTexture(kanvas);
  return teksturPendar;
}

const geoAsap = new THREE.PlaneGeometry(1, 1);

/**
 * Obor penanda tujuan: tiang pendek dengan bola bercahaya dan lampu titik, ditambah pendar besar
 * yang terlihat dari jauh (tidak kena kabut) dan tiang asap tipis, sesuai GDD: penanda ada di dunia,
 * bukan ikon di layar.
 */
export class Obor {
  readonly grup = new THREE.Group();
  private readonly pendar: THREE.Sprite;
  private readonly bahanPendar: THREE.SpriteMaterial;
  private readonly asap: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[] = [];
  private readonly faseAsap: number[] = [];
  private waktu = Math.random() * 10;

  constructor(x: number, z: number) {
    this.grup.position.set(x, tinggiMedan(x, z), z);
    this.grup.name = 'obor';
    const batang = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 2.2, 8), bahanBatang);
    batang.position.y = 1.1;
    const nyala = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), bahanNyala);
    nyala.position.y = 2.3;
    const cahaya = new THREE.PointLight(0xffb060, 8, 14, 1.5);
    cahaya.position.y = 2.3;
    this.grup.add(batang, nyala, cahaya);

    this.bahanPendar = new THREE.SpriteMaterial({
      map: ambilTeksturPendar(),
      color: 0xffd090,
      transparent: true,
      depthWrite: false,
      depthTest: false, // pendar menembus pohon dan bukit yang menghalangi, seperti cahaya di kejauhan
      fog: false, // pendar harus tembus kabut supaya arah tetap terasa dari jauh
    });
    this.pendar = new THREE.Sprite(this.bahanPendar);
    this.pendar.position.y = 2.4;
    this.pendar.renderOrder = 3;
    this.grup.add(this.pendar);

    for (let i = 0; i < JUMLAH_ASAP; i++) {
      const bahan = new THREE.MeshBasicMaterial({
        color: 0xb0a898,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const bidang = new THREE.Mesh(geoAsap, bahan);
      bidang.renderOrder = 1;
      this.asap.push(bidang);
      this.faseAsap.push(i / JUMLAH_ASAP);
      this.grup.add(bidang);
    }
  }

  /** Menyesuaikan pendar dengan jarak kamera dan menggerakkan asap. */
  perbarui(dt: number, posisiKamera: THREE.Vector3): void {
    this.waktu += dt;
    const p = this.grup.position;
    const jarak = Math.hypot(posisiKamera.x - p.x, posisiKamera.y - p.y - 2.4, posisiKamera.z - p.z);
    // Skala sebanding jarak supaya ukuran di layar stabil; berdenyut pelan seperti nyala.
    const denyut = 1 + Math.sin(this.waktu * 5.3) * 0.06 + Math.sin(this.waktu * 1.7) * 0.05;
    const skala = Math.max(SKALA_PENDAR_MIN, jarak * SKALA_PENDAR_PER_METER) * denyut;
    this.pendar.scale.set(skala, skala, 1);
    this.pendar.visible = jarak < JARAK_PENDAR_MAKS * 1.2;
    this.bahanPendar.opacity = jarak < JARAK_PENDAR_MAKS ? 0.9 : Math.max(0, 0.9 * (1 - (jarak - JARAK_PENDAR_MAKS) / (JARAK_PENDAR_MAKS * 0.2)));

    // Asap: bidang menghadap kamera (hanya putaran y), naik, melebar, memudar.
    const yawKamera = Math.atan2(posisiKamera.x - p.x, posisiKamera.z - p.z);
    this.asap.forEach((bidang, i) => {
      let fase = this.faseAsap[i] + (this.waktu * LAJU_ASAP) / TINGGI_ASAP;
      fase -= Math.floor(fase);
      const tinggi = 2.6 + fase * TINGGI_ASAP;
      const lebar = 0.5 + fase * 2.2;
      const goyang = Math.sin(this.waktu * 0.8 + i * 2.1 + fase * 4) * 0.5 * fase;
      bidang.position.set(goyang, tinggi, 0);
      bidang.scale.set(lebar, 1.6 + fase * 2.5, 1);
      bidang.rotation.y = yawKamera;
      bidang.material.opacity = 0.3 * (1 - fase) * Math.min(1, fase * 6);
    });
  }

  /** Melepas bahan yang dibuat per obor (tekstur pendar dipakai bersama, tidak dibuang). */
  buang(): void {
    this.bahanPendar.dispose();
    for (const a of this.asap) a.material.dispose();
  }
}
