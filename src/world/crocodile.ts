import * as THREE from 'three';
import type { Pemain } from '../character/player';
import { JARI_PEMAIN } from '../character/player';
import { KONFIG } from '../combat/config';
import { menghadap } from '../combat/hit';
import type { PertarunganPemain } from '../combat/player-combat';
import { PERMUKAAN_AIR, tinggiMedan } from './terrain';

const B = KONFIG.buaya;
const JARI_BADAN = 0.32;
const bahanBadan = new THREE.MeshStandardMaterial({ color: 0x2f4a26, roughness: 0.95 });
const bahanRiak = new THREE.MeshBasicMaterial({ color: 0xcfe6ee, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false });

export type StatusBuaya = 'menyelam' | 'muncul' | 'menerkam';

/**
 * Buaya muara (sprint 7): kapsul pipih hijau tua yang hampir seluruhnya di bawah air; saat
 * menyelam hanya riak yang terlihat. Bukan lawan: tidak bisa dibunuh, tidak masuk pengelola
 * lawan. Menerkam pemain yang berada di air terlalu lama di dekatnya; tangkis pas membatalkan.
 */
export class Buaya {
  readonly grup = new THREE.Group();
  readonly posisi = this.grup.position;
  status: StatusBuaya = 'menyelam';
  private waktu = 0;
  private sisaStatus = B.lamaMenyelam;
  private readonly badan: THREE.Group;
  private readonly riak: THREE.Mesh;
  private hadap: number;
  private readonly pusat: THREE.Vector3;
  private readonly arahHanyut = new THREE.Vector3();
  private waktuDiDekat = 0;
  private readonly arahTerkam = new THREE.Vector3();
  private terkamKena = false;
  /** Dipanggil saat terkaman mengenai pemain (untuk tanda). */
  saatMenerkam: (() => void) | null = null;

  constructor(x: number, z: number) {
    this.pusat = new THREE.Vector3(x, 0, z);
    this.posisi.set(x, PERMUKAAN_AIR, z);
    this.hadap = Math.random() * Math.PI * 2;
    this.badan = new THREE.Group();
    const tubuh = new THREE.Mesh(new THREE.CapsuleGeometry(JARI_BADAN, B.panjang - 2 * JARI_BADAN, 4, 10), bahanBadan);
    tubuh.rotation.x = Math.PI / 2;
    tubuh.scale.y = 0.55; // pipih
    const kepala = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.7), bahanBadan);
    kepala.position.set(0, 0.02, B.panjang / 2 + 0.1);
    const bahanMata = new THREE.MeshStandardMaterial({ color: 0xe8e070, emissive: 0xb0a030, emissiveIntensity: 0.6 });
    for (const s of [-1, 1]) {
      const mata = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), bahanMata);
      mata.position.set(s * 0.17, 0.14, B.panjang / 2 - 0.1);
      kepala.add(mata);
    }
    this.badan.add(tubuh, kepala);
    this.grup.add(this.badan);
    this.riak = new THREE.Mesh(new THREE.RingGeometry(0.5, 1.4, 24), bahanRiak);
    this.riak.rotation.x = -Math.PI / 2;
    this.riak.position.y = 0.02;
    this.grup.add(this.riak);
    this.pilihArahHanyut();
    this.terapkanVisual(0);
  }

  private pilihArahHanyut(): void {
    const sudut = Math.random() * Math.PI * 2;
    this.arahHanyut.set(Math.sin(sudut), 0, Math.cos(sudut));
  }

  private masuk(status: StatusBuaya, lama: number): void {
    this.status = status;
    this.waktu = 0;
    this.sisaStatus = lama;
    this.terkamKena = false;
  }

  /** Benar kalau kaki `pos` berada di air cukup dalam untuk diincar. */
  private diAir(pos: THREE.Vector3): boolean {
    return pos.y < PERMUKAAN_AIR - B.kedalamanMin;
  }

  perbarui(dt: number, pemain: Pemain, tarung: PertarunganPemain): void {
    this.waktu += dt;
    const pos = pemain.posisi;
    const dx = pos.x - this.posisi.x;
    const dz = pos.z - this.posisi.z;
    const jarak = Math.hypot(dx, dz);

    if (this.status === 'menerkam') {
      const T = B.terkam;
      this.posisi.x += this.arahTerkam.x * T.kecepatan * dt;
      this.posisi.z += this.arahTerkam.z * T.kecepatan * dt;
      if (!this.terkamKena && jarak < T.lebarKena + JARI_PEMAIN) {
        this.terkamKena = true;
        if (!tarung.kebal) {
          const pas = tarung.keadaanTangkis() === 'pas' && menghadap(pos, pemain.hadap, this.posisi, KONFIG.pemain.tangkis.sudutTangkis);
          if (!pas) {
            // Seret ke arah buaya: dorongan negatif berarti menuju sumbernya.
            tarung.jatuhkan(this.posisi, -T.seret, T.damage, T.jatuh);
            this.saatMenerkam?.();
          }
        }
        this.masuk('menyelam', B.lamaMenyelamSetelahTerkam);
      } else if (this.waktu >= T.durasi) {
        this.masuk('menyelam', B.lamaMenyelamSetelahTerkam);
      }
      this.terapkanVisual(dt);
      return;
    }

    // Pemain di air dekat buaya lebih lama dari waktuTerkam: menerkam.
    if (this.diAir(pos) && jarak <= B.jarakTerkam) {
      this.waktuDiDekat += dt;
      if (this.waktuDiDekat >= B.waktuTerkam) {
        this.waktuDiDekat = 0;
        this.arahTerkam.set(dx / (jarak || 1), 0, dz / (jarak || 1));
        this.hadap = Math.atan2(this.arahTerkam.x, this.arahTerkam.z);
        this.masuk('menerkam', B.terkam.durasi);
        this.terapkanVisual(dt);
        return;
      }
    } else {
      this.waktuDiDekat = Math.max(0, this.waktuDiDekat - dt);
    }

    // Pola muncul dan menyelam sambil hanyut pelan di sekitar pusatnya, tetap di air.
    this.sisaStatus -= dt;
    if (this.sisaStatus <= 0) {
      if (this.status === 'muncul') this.masuk('menyelam', B.lamaMenyelam);
      else this.masuk('muncul', B.lamaMuncul);
      this.pilihArahHanyut();
    }
    const xBaru = this.posisi.x + this.arahHanyut.x * B.lajuHanyut * dt;
    const zBaru = this.posisi.z + this.arahHanyut.z * B.lajuHanyut * dt;
    const jauhDariPusat = Math.hypot(xBaru - this.pusat.x, zBaru - this.pusat.z);
    if (jauhDariPusat < B.jariHanyut && tinggiMedan(xBaru, zBaru) < PERMUKAAN_AIR - B.kedalamanMin) {
      this.posisi.x = xBaru;
      this.posisi.z = zBaru;
    } else {
      this.pilihArahHanyut();
    }
    const tujuanHadap = Math.atan2(this.arahHanyut.x, this.arahHanyut.z);
    let selisih = tujuanHadap - this.hadap;
    selisih = Math.atan2(Math.sin(selisih), Math.cos(selisih));
    this.hadap += selisih * Math.min(1, 1.5 * dt);
    this.terapkanVisual(dt);
  }

  private terapkanVisual(dt: number): void {
    // Tubuh: saat menyelam tenggelam penuh, saat muncul punggungnya sedikit di atas air, saat menerkam terangkat.
    const naik = this.status === 'menerkam' ? 0.15 : this.status === 'muncul' ? -0.08 : -0.55;
    const laju = dt > 0 ? Math.min(1, 4 * dt) : 1;
    this.badan.position.y += (naik - this.badan.position.y) * laju;
    this.badan.rotation.y = this.hadap;
    this.posisi.y = PERMUKAAN_AIR;
    // Riak: selalu ada, lebih besar dan lebih terlihat saat menyelam (satu-satunya petunjuk).
    const skala = this.status === 'menyelam' ? 1 + 0.15 * Math.sin(this.waktu * 3) : 0.6;
    this.riak.scale.set(skala, skala, 1);
    bahanRiak.opacity = this.status === 'menyelam' ? 0.5 : 0.3;
  }
}
