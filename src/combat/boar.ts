import * as THREE from 'three';
import type { Pemain } from '../character/player';
import { JARI_PEMAIN } from '../character/player';
import { tinggiLantai, dorongKeluar, type DataTabrakan } from '../world/collision';
import { KONFIG } from './config';
import { Lawan, JARI_LAWAN, type PemberiGiliran, type StatusLawan } from './enemy';
import type { PertarunganPemain, Serangan } from './player-combat';

const BB = KONFIG.babi;
const WARNA = new THREE.Color(0x5a5650); // kelabu
const WARNA_KENA = new THREE.Color(0xffffff);
const JARI_BADAN = 0.34;

/**
 * Babi hutan (sprint 7): kapsul rendah kelabu yang keluar dari semak saat pemain dekat, lalu
 * menyeruduk lurus. Berbalik pelan, menyeruduk lagi; lari setelah satu kali kena atau beberapa
 * serudukan. Tiap serudukan berisik: kejadian memberi tahu penjaga terdekat.
 */
export class Babi extends Lawan {
  private readonly arahSeruduk = new THREE.Vector3();
  private jarakDitempuh = 0;
  private serudukKena = false;
  private jumlahSeruduk = 0;
  private readonly titikPergi = new THREE.Vector3();
  private sudahPergi = false;
  /** Dipanggil tiap kali mulai menyeruduk (berisik). */
  saatMenyeruduk: (() => void) | null = null;

  constructor(data: DataTabrakan, x: number, z: number) {
    super(data, x, z);
    this.masuk('mengintai');
  }

  protected override nyawaMaks(): number {
    return BB.nyawa;
  }

  protected override bangunBadan(): THREE.MeshStandardMaterial {
    const bahan = new THREE.MeshStandardMaterial({ color: WARNA, roughness: 0.95 });
    const tubuh = new THREE.Mesh(new THREE.CapsuleGeometry(JARI_BADAN, 1.4 - 2 * JARI_BADAN, 4, 10), bahan);
    tubuh.rotation.x = Math.PI / 2;
    tubuh.position.y = JARI_BADAN + 0.02;
    tubuh.castShadow = true;
    const moncong = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.3), new THREE.MeshStandardMaterial({ color: 0x3a3632 }));
    moncong.position.set(0, 0.3, 0.8);
    const bahanTaring = new THREE.MeshStandardMaterial({ color: 0xe8e0c8 });
    for (const s of [-1, 1]) {
      const taring = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.04), bahanTaring);
      taring.position.set(s * 0.12, 0.26, 0.92);
      taring.rotation.x = -0.5;
      this.badan.add(taring);
    }
    this.badan.add(tubuh, moncong);
    return bahan;
  }

  override waspada(): void {}

  override get menembus(): boolean {
    return this.status === 'menyerang';
  }

  get selesai(): boolean {
    return this.sudahPergi || (this.status === 'mati' && this.waktu >= BB.hilangSetelahMati);
  }

  override terkena(serangan: Serangan, dari: THREE.Vector3): void {
    if (!this.hidup) return;
    super.terkena(serangan, dari);
    // Satu kali kena: lari (kecuali mati).
    if (this.hidup && this.status !== 'pergi') this.mulaiPergi(dari);
  }

  private mulaiPergi(dariPemain: THREE.Vector3): void {
    const dx = this.posisi.x - dariPemain.x;
    const dz = this.posisi.z - dariPemain.z;
    const d = Math.hypot(dx, dz) || 1;
    this.titikPergi.set(this.posisi.x + (dx / d) * BB.pergi.jarak, 0, this.posisi.z + (dz / d) * BB.pergi.jarak);
    this.masuk('pergi');
  }

  protected override masuk(status: StatusLawan): void {
    super.masuk(status);
    if (status === 'menyerang') {
      this.jarakDitempuh = 0;
      this.serudukKena = false;
    }
  }

  override perbarui(dt: number, pemain: Pemain, tarung: PertarunganPemain, _giliran: PemberiGiliran): void {
    this.waktu += dt;
    if (this.status === 'mati') {
      this.perbaruiMati(dt);
      return;
    }
    if (this.sudahPergi) return;
    const pos = pemain.posisi;
    const dx = pos.x - this.posisi.x;
    const dz = pos.z - this.posisi.z;
    const jarak = Math.hypot(dx, dz) || 1e-4;
    let gerakX = 0;
    let gerakZ = 0;

    switch (this.status) {
      case 'mengintai':
        // Bersembunyi di semak sampai pemain dekat.
        if (jarak <= BB.jarakKeluar) {
          this.hadap = Math.atan2(dx, dz);
          this.masuk('bersiap');
        }
        break;
      case 'bersiap':
        this.hadap = Math.atan2(dx, dz);
        if (this.waktu >= BB.bersiap) {
          this.arahSeruduk.set(dx / jarak, 0, dz / jarak);
          this.jumlahSeruduk += 1;
          this.saatMenyeruduk?.();
          this.masuk('menyerang');
        }
        break;
      case 'menyerang': {
        const S = BB.seruduk;
        const langkah = S.kecepatan * dt;
        gerakX = this.arahSeruduk.x * S.kecepatan;
        gerakZ = this.arahSeruduk.z * S.kecepatan;
        this.jarakDitempuh += langkah;
        this.hadap = Math.atan2(this.arahSeruduk.x, this.arahSeruduk.z);
        if (!this.serudukKena && jarak < S.lebarKena + JARI_PEMAIN) {
          this.serudukKena = true;
          if (!tarung.kebal) tarung.jatuhkan(this.posisi, S.dorong, S.damage, S.jatuh);
        }
        if (this.jarakDitempuh >= S.jarak) {
          if (this.jumlahSeruduk >= BB.jumlahSerudukMaks) this.mulaiPergi(pos);
          else this.masuk('mundur'); // berbalik pelan
        }
        break;
      }
      case 'mundur': {
        // Berbalik pelan ke arah pemain, lalu menyeruduk lagi.
        const tujuan = Math.atan2(dx, dz);
        let selisih = tujuan - this.hadap;
        selisih = Math.atan2(Math.sin(selisih), Math.cos(selisih));
        const putar = Math.sign(selisih) * Math.min(Math.abs(selisih), BB.lajuPutar * dt);
        this.hadap += putar;
        if (this.waktu >= BB.jedaSeruduk) this.masuk('bersiap');
        break;
      }
      case 'pergi': {
        const px = this.titikPergi.x - this.posisi.x;
        const pz = this.titikPergi.z - this.posisi.z;
        const d = Math.hypot(px, pz);
        if (d < 0.6 || this.waktu > 8) {
          this.sudahPergi = true;
          this.grup.visible = false;
          break;
        }
        this.hadap = Math.atan2(px, pz);
        gerakX = (px / d) * BB.pergi.kecepatan;
        gerakZ = (pz / d) * BB.pergi.kecepatan;
        break;
      }
      default:
        this.masuk('mengintai');
    }

    if (this.sisaDoronganKena > 0) {
      this.sisaDoronganKena -= dt;
      gerakX += this.doronganKena.x;
      gerakZ += this.doronganKena.z;
    }
    this.posisi.x += gerakX * dt;
    this.posisi.z += gerakZ * dt;
    dorongKeluar(this.data, this.posisi, JARI_LAWAN);
    this.posisi.y = tinggiLantai(this.data, this.posisi.x, this.posisi.z, this.posisi.y + 0.5);
    this.perbaruiVisual(dt);
  }

  protected override perbaruiVisual(dt: number): void {
    let condong = 0;
    let goyang = 0;
    let skalaY = 1;
    switch (this.status) {
      case 'mengintai':
        skalaY = 0.8;
        break;
      case 'bersiap':
        goyang = Math.sin(this.waktu * 50) * 0.05;
        condong = 0.15;
        break;
      case 'menyerang':
        condong = 0.2;
        break;
      case 'pergi':
        condong = 0.1;
        break;
    }
    const laju = Math.min(1, 16 * dt);
    this.badan.rotation.y = this.hadap;
    this.badan.rotation.x += (condong - this.badan.rotation.x) * laju;
    this.badan.rotation.z += (goyang - this.badan.rotation.z) * laju;
    this.badan.scale.y += (skalaY - this.badan.scale.y) * laju;
    if (this.sisaKilat > 0) {
      this.sisaKilat -= dt;
      this.bahan.emissive.copy(WARNA_KENA);
      this.bahan.emissiveIntensity = 1.5;
    } else {
      this.bahan.emissiveIntensity = 0;
    }
  }

  protected override perbaruiMati(dt: number): void {
    super.perbaruiMati(dt);
    const laju = Math.min(1, 5 * dt);
    this.badan.rotation.x += (0 - this.badan.rotation.x) * laju;
    this.badan.rotation.z += (1.4 - this.badan.rotation.z) * laju;
  }
}
