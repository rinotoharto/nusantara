import * as THREE from 'three';
import type { Pemain } from '../character/player';
import { JARI_PEMAIN, TINGGI_PEMAIN } from '../character/player';
import { tinggiLantai, type DataTabrakan } from '../world/collision';
import { KONFIG } from './config';
import { dalamJangkauan, menghadap, sudutKe } from './hit';
import type { PertarunganPemain } from './player-combat';

const L = KONFIG.lawan;
const WARNA = new THREE.Color(0x6e6a5a);
const WARNA_ISYARAT = new THREE.Color(0xffd23a);
const WARNA_TERHUYUNG = new THREE.Color(0x4aa3ff);
const WARNA_KENA = new THREE.Color(0xffffff);

type StatusBoneka = 'diam' | 'bersiap' | 'menusuk' | 'mundur' | 'terhuyung';

/**
 * Boneka latihan sementara untuk menguji tahap A: diam di tempat, menghadap pemain,
 * menusuk dengan isyarat kuning kalau pemain dekat, terhuyung kalau ditangkis pas.
 * Diganti lawan sungguhan di tahap B.
 */
export class BonekaLatihan {
  readonly grup = new THREE.Group();
  readonly posisi = this.grup.position;
  private readonly badan = new THREE.Group();
  private readonly bahan: THREE.MeshStandardMaterial;
  private readonly tombak = new THREE.Group();
  private status: StatusBoneka = 'diam';
  private waktu = 0;
  private jedaMundur = 1.5;
  private sisaKilat = 0;
  private tusukanSudahKeluar = false;
  hadap = 0;
  jumlahKena = 0;

  constructor(private data: DataTabrakan, x: number, z: number) {
    this.bahan = new THREE.MeshStandardMaterial({ color: WARNA, roughness: 0.8 });
    const kapsul = new THREE.Mesh(
      new THREE.CapsuleGeometry(JARI_PEMAIN, TINGGI_PEMAIN - 2 * JARI_PEMAIN, 6, 12),
      this.bahan,
    );
    kapsul.position.y = TINGGI_PEMAIN / 2;
    kapsul.castShadow = true;
    this.badan.add(kapsul);

    const batang = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.06, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x7a5a36, roughness: 0.9 }),
    );
    batang.position.z = 0.7;
    const mata = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.04, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.6, roughness: 0.3 }),
    );
    mata.position.z = 1.9;
    this.tombak.add(batang, mata);
    this.tombak.position.set(JARI_PEMAIN + 0.08, 1.0, 0);
    this.badan.add(this.tombak);

    this.grup.add(this.badan);
    this.posisi.set(x, tinggiLantai(data, x, z, 1e9), z);
  }

  perbarui(dt: number, pemain: Pemain, tarung: PertarunganPemain): void {
    this.waktu += dt;
    const posPemain = pemain.posisi;
    const jarak = Math.hypot(posPemain.x - this.posisi.x, posPemain.z - this.posisi.z);

    // Selalu menghadap pemain, kecuali saat terhuyung.
    if (this.status !== 'terhuyung') {
      const tujuan = sudutKe(this.posisi, posPemain);
      let selisih = tujuan - this.hadap;
      selisih = Math.atan2(Math.sin(selisih), Math.cos(selisih));
      this.hadap += selisih * Math.min(1, 6 * dt);
    }

    switch (this.status) {
      case 'diam':
        if (jarak < L.tombak.jangkauan + 0.3 && this.waktu > 0.8) this.masuk('bersiap');
        break;
      case 'bersiap':
        if (this.waktu >= L.isyarat) this.masuk('menusuk');
        break;
      case 'menusuk':
        if (!this.tusukanSudahKeluar && this.waktu >= 0.08) {
          this.tusukanSudahKeluar = true;
          this.tusuk(pemain, tarung);
        }
        if (this.waktu >= L.durasiTusuk) {
          this.jedaMundur = L.mundurMin + Math.random() * (L.mundurMaks - L.mundurMin);
          this.masuk('mundur');
        }
        break;
      case 'mundur':
        if (this.waktu >= this.jedaMundur) this.masuk('diam');
        break;
      case 'terhuyung':
        if (this.waktu >= L.terhuyung) this.masuk('diam');
        break;
    }

    // Pemain tidak boleh menembus kapsul boneka: dorong pemain keluar.
    const jarakMin = 2 * JARI_PEMAIN;
    if (jarak < jarakMin) {
      const dx = posPemain.x - this.posisi.x;
      const dz = posPemain.z - this.posisi.z;
      const d = Math.hypot(dx, dz) || 1e-6;
      posPemain.x = this.posisi.x + (dx / d) * jarakMin;
      posPemain.z = this.posisi.z + (dz / d) * jarakMin;
    }

    // Serangan pemain mengenai boneka?
    const serangan = tarung.ambilSerangan();
    if (serangan && dalamJangkauan(posPemain, pemain.hadap, this.posisi, serangan.jangkauan, JARI_PEMAIN, serangan.sudutKena)) {
      this.jumlahKena += 1;
      this.sisaKilat = 0.12;
      const dx = this.posisi.x - posPemain.x;
      const dz = this.posisi.z - posPemain.z;
      const d = Math.hypot(dx, dz) || 1;
      this.posisi.x += (dx / d) * serangan.dorong;
      this.posisi.z += (dz / d) * serangan.dorong;
      this.posisi.y = tinggiLantai(this.data, this.posisi.x, this.posisi.z, this.posisi.y);
      if (serangan.berat) this.masuk('terhuyung');
    }

    this.perbaruiVisual(dt);
  }

  private masuk(status: StatusBoneka): void {
    this.status = status;
    this.waktu = 0;
    this.tusukanSudahKeluar = false;
  }

  private tusuk(pemain: Pemain, tarung: PertarunganPemain): void {
    const kena = dalamJangkauan(this.posisi, this.hadap, pemain.posisi, L.tombak.jangkauan, JARI_PEMAIN, L.tombak.sudutKena);
    if (!kena || tarung.kebal) return;
    const keadaan = tarung.keadaanTangkis();
    const menghadapBoneka = menghadap(pemain.posisi, pemain.hadap, this.posisi, KONFIG.pemain.tangkis.sudutTangkis);
    if (keadaan === 'pas' && menghadapBoneka) {
      this.masuk('terhuyung');
      return;
    }
    if (keadaan === 'biasa' && menghadapBoneka) {
      tarung.terkena(this.posisi, KONFIG.pemain.tangkis.dorongTerkena, true);
      return;
    }
    tarung.terkena(this.posisi, L.tombak.dorong, false);
  }

  private perbaruiVisual(dt: number): void {
    let condong = 0;
    let miring = 0;
    let tombakZ = 0;
    let sinar = 0;
    const sinarWarna = new THREE.Color(0, 0, 0);

    switch (this.status) {
      case 'bersiap': {
        const t = Math.min(1, this.waktu / L.isyarat);
        condong = -0.15 * t;
        tombakZ = -0.6 * t; // tombak ditarik ke belakang
        sinar = 0.4 + 0.8 * t;
        sinarWarna.copy(WARNA_ISYARAT);
        break;
      }
      case 'menusuk': {
        const t = Math.min(1, this.waktu / L.durasiTusuk);
        const lengkung = Math.sin(Math.PI * t);
        condong = 0.3 * lengkung;
        tombakZ = 0.8 * lengkung;
        break;
      }
      case 'terhuyung': {
        const t = this.waktu / L.terhuyung;
        condong = -0.35 * (1 - t);
        miring = 0.25 * Math.sin(this.waktu * 9) * (1 - t);
        sinar = 0.8 * (1 - t);
        sinarWarna.copy(WARNA_TERHUYUNG);
        break;
      }
    }

    const laju = Math.min(1, 16 * dt);
    this.badan.rotation.y = this.hadap;
    this.badan.rotation.x += (condong - this.badan.rotation.x) * laju;
    this.badan.rotation.z += (miring - this.badan.rotation.z) * laju;
    this.tombak.position.z += (tombakZ - this.tombak.position.z) * laju;
    this.badan.rotation.order = 'YXZ';

    if (this.sisaKilat > 0) {
      this.sisaKilat -= dt;
      this.bahan.emissive.copy(WARNA_KENA);
      this.bahan.emissiveIntensity = 1.5;
    } else {
      this.bahan.emissive.copy(sinarWarna);
      this.bahan.emissiveIntensity = sinar;
    }
  }
}
