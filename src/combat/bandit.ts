import * as THREE from 'three';
import type { Pemain } from '../character/player';
import { JARI_PEMAIN, TINGGI_PEMAIN } from '../character/player';
import { tinggiLantai, dorongKeluar, type DataTabrakan } from '../world/collision';
import { KONFIG } from './config';
import { Lawan, JARI_LAWAN, type PemberiGiliran, type StatusLawan } from './enemy';
import { dalamJangkauan, menghadap, sudutKe } from './hit';
import type { PertarunganPemain, Serangan } from './player-combat';

const R = KONFIG.perampok;
const WARNA = new THREE.Color(0x4a3222); // cokelat tua
const WARNA_ISYARAT = new THREE.Color(0xffd23a);
const WARNA_TERHUYUNG = new THREE.Color(0x4aa3ff);
const WARNA_KENA = new THREE.Color(0xffffff);

/**
 * Gerombolan perampok: pengganti antrean giliran. Paling banyak `penyerangMaks` anggota boleh
 * menyerang bersamaan, dengan jeda `jedaAntarPenyerang` detik antara awal dua serangan.
 * `waktu` dimajukan oleh kejadian tiap frame.
 */
export class Gerombolan {
  readonly anggota: Perampok[] = [];
  waktu = 0;
  private waktuSeranganTerakhir = -99;

  /** Benar kalau `p` boleh maju untuk menyerang sekarang (jatah penyerang dan jeda terpenuhi). */
  bolehSerang(p: Perampok): boolean {
    const menyerang = this.anggota.filter((a) => a !== p && a.hidup && (a.status === 'bersiap' || a.status === 'menyerang')).length;
    if (menyerang >= R.penyerangMaks) return false;
    return this.waktu - this.waktuSeranganTerakhir >= R.jedaAntarPenyerang;
  }

  /** Dipanggil saat seorang anggota mulai bersiap, untuk jeda antar penyerang. */
  catatSerangan(): void {
    this.waktuSeranganTerakhir = this.waktu;
  }

  /** Semua anggota yang masih diam ikut bertarung. */
  serang(): void {
    for (const a of this.anggota) a.serang();
  }

  get adaYangHidup(): boolean {
    return this.anggota.some((a) => a.hidup);
  }
}

/**
 * Perampok (sprint 7): kapsul cokelat tua dengan golok pendek. Tanpa kerucut pandang: berdiri
 * menghadang jalan sampai kejadian memulai pertarungan atau ia diserang. Menyerang dua tebasan
 * beruntun dengan satu isyarat 0,35 detik; tebasan kedua datang tanpa isyarat.
 */
export class Perampok extends Lawan {
  declare private golok: THREE.Group;
  private tebasanKeluar = 0;
  private jedaMundurSendiri = 1;
  private arahPutar = Math.random() < 0.5 ? 1 : -1;
  private sisaGantiPutar = 3;
  private readonly titikPergi = new THREE.Vector3();
  private sudahPergi = false;

  constructor(
    data: DataTabrakan,
    x: number,
    z: number,
    private readonly gerombolan: Gerombolan,
  ) {
    super(data, x, z);
    gerombolan.anggota.push(this);
  }

  protected override nyawaMaks(): number {
    return R.nyawa;
  }

  protected override bangunBadan(): THREE.MeshStandardMaterial {
    const bahan = new THREE.MeshStandardMaterial({ color: WARNA, roughness: 0.85 });
    const kapsul = new THREE.Mesh(new THREE.CapsuleGeometry(JARI_LAWAN, TINGGI_PEMAIN - 2 * JARI_LAWAN, 6, 12), bahan);
    kapsul.position.y = TINGGI_PEMAIN / 2;
    kapsul.castShadow = true;
    const hidung = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.2), new THREE.MeshStandardMaterial({ color: 0xd9b58a }));
    hidung.position.set(0, TINGGI_PEMAIN - 0.35, JARI_LAWAN);
    this.badan.add(kapsul, hidung);
    // Golok: bilah pendek lebar di tangan kanan, pivot di gagang.
    this.golok = new THREE.Group();
    const bilah = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.11, 0.55),
      new THREE.MeshStandardMaterial({ color: 0x8e9299, metalness: 0.6, roughness: 0.35 }),
    );
    bilah.position.z = 0.35;
    bilah.castShadow = true;
    const gagang = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.16), new THREE.MeshStandardMaterial({ color: 0x5a3a1e }));
    this.golok.add(bilah, gagang);
    this.golok.position.set(JARI_LAWAN + 0.08, 1.0, 0.05);
    this.golok.rotation.set(0.6, 0, 0);
    this.badan.add(this.golok);
    return bahan;
  }

  /** Perampok tidak dibangunkan lawan lain; gerombolannya yang mengajak. */
  override waspada(): void {}

  /** Mulai bertarung (dari kejadian atau karena diserang). */
  serang(): void {
    if (this.hidup && this.status === 'diam') this.masuk('mendekat');
  }

  /** Terhuyung lebih lama di awal pertarungan (siasat licik: Ranggalawe menyergap yang paling depan). */
  terhuyungkan(): void {
    if (!this.hidup) return;
    this.masuk('terhuyung');
    this.waktu = -(R.terhuyungAwal - R.terhuyung);
  }

  /** Pergi meninggalkan jalan (dibayar atau gentar), menjauh dari pemain lalu hilang. */
  pergi(dariPemain: THREE.Vector3): void {
    if (!this.hidup) return;
    const dx = this.posisi.x - dariPemain.x;
    const dz = this.posisi.z - dariPemain.z;
    const d = Math.hypot(dx, dz) || 1;
    this.titikPergi.set(this.posisi.x + (dx / d) * R.pergi.jarak, 0, this.posisi.z + (dz / d) * R.pergi.jarak);
    this.masuk('pergi');
  }

  /** Benar setelah pergi dan hilang, atau mati dan hilang. */
  get selesai(): boolean {
    return this.sudahPergi || (this.status === 'mati' && this.waktu >= R.hilangSetelahMati);
  }

  override terkena(serangan: Serangan, dari: THREE.Vector3): void {
    if (!this.hidup) return;
    if (this.status === 'diam' || this.status === 'pergi') this.gerombolan.serang();
    if (this.status === 'pergi') this.masuk('mendekat');
    super.terkena(serangan, dari);
  }

  protected override masuk(status: StatusLawan): void {
    super.masuk(status);
    this.tebasanKeluar = 0;
  }

  override perbarui(dt: number, pemain: Pemain, tarung: PertarunganPemain, _giliran: PemberiGiliran): void {
    this.waktu += dt;
    if (this.status === 'mati') {
      this.perbaruiMati(dt);
      return;
    }
    if (this.sudahPergi) return;
    const posPemain = pemain.posisi;
    const dx = posPemain.x - this.posisi.x;
    const dz = posPemain.z - this.posisi.z;
    const jarak = Math.hypot(dx, dz);
    const keX = jarak > 1e-4 ? dx / jarak : 0;
    const keZ = jarak > 1e-4 ? dz / jarak : 0;
    const jarakSerang = R.golok.jangkauan - 0.2;

    if (this.status !== 'menyerang' && this.status !== 'terhuyung' && this.status !== 'pergi' && (this.status !== 'diam' || jarak < R.jarakDeteksi)) {
      let selisih = sudutKe(this.posisi, posPemain) - this.hadap;
      selisih = Math.atan2(Math.sin(selisih), Math.cos(selisih));
      this.hadap += selisih * Math.min(1, 7 * dt);
    }

    let gerakX = 0;
    let gerakZ = 0;
    switch (this.status) {
      case 'diam':
        break;
      case 'mendekat':
        if (!this.gerombolan.bolehSerang(this)) {
          this.masuk('mengelilingi');
        } else if (jarak <= jarakSerang) {
          this.gerombolan.catatSerangan();
          this.masuk('bersiap');
        } else {
          gerakX = keX * R.kecepatanMendekat;
          gerakZ = keZ * R.kecepatanMendekat;
        }
        break;
      case 'mengelilingi': {
        // Jatah penyerang kosong: maju lagi.
        if (this.gerombolan.bolehSerang(this)) {
          this.masuk('mendekat');
          break;
        }
        this.sisaGantiPutar -= dt;
        if (this.sisaGantiPutar <= 0) {
          this.arahPutar = -this.arahPutar;
          this.sisaGantiPutar = 2 + Math.random() * 3;
        }
        const tengah = (R.jarakMengelilingiMin + R.jarakMengelilingiMaks) / 2;
        let radial = 0;
        if (jarak > R.jarakMengelilingiMaks) radial = R.kecepatanMendekat * 0.8;
        else if (jarak < R.jarakMengelilingiMin) radial = -R.kecepatanMengelilingi;
        else radial = (tengah - jarak) * 0.8;
        gerakX = keX * radial + -keZ * this.arahPutar * R.kecepatanMengelilingi;
        gerakZ = keZ * radial + keX * this.arahPutar * R.kecepatanMengelilingi;
        break;
      }
      case 'bersiap':
        if (this.waktu >= R.isyarat) this.masuk('menyerang');
        break;
      case 'menyerang': {
        const T = R.tebasan;
        if (this.tebasanKeluar === 0 && this.waktu >= T.pertama) {
          this.tebasanKeluar = 1;
          this.tebas(pemain, tarung);
        } else if (this.tebasanKeluar === 1 && this.waktu >= T.kedua) {
          this.tebasanKeluar = 2;
          this.tebas(pemain, tarung);
        }
        if (this.status === 'menyerang' && this.waktu >= T.durasi) {
          this.jedaMundurSendiri = R.mundurMin + Math.random() * (R.mundurMaks - R.mundurMin);
          this.masuk('mundur');
        }
        break;
      }
      case 'mundur':
        if (jarak < R.jarakMengelilingiMin) {
          gerakX = -keX * R.kecepatanMengelilingi * 1.3;
          gerakZ = -keZ * R.kecepatanMengelilingi * 1.3;
        }
        if (this.waktu >= this.jedaMundurSendiri) this.masuk('mendekat');
        break;
      case 'terhuyung':
        if (this.waktu >= R.terhuyung) this.masuk('mendekat');
        break;
      case 'pergi': {
        const px = this.titikPergi.x - this.posisi.x;
        const pz = this.titikPergi.z - this.posisi.z;
        const d = Math.hypot(px, pz);
        if (d < 0.6 || this.waktu > 10) {
          this.sudahPergi = true;
          this.grup.visible = false;
          break;
        }
        this.hadap = Math.atan2(px, pz);
        gerakX = (px / d) * R.pergi.kecepatan;
        gerakZ = (pz / d) * R.pergi.kecepatan;
        break;
      }
      default:
        this.masuk('diam');
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

  /** Satu tebasan golok: sama seperti tusukan tombak, tapi jangkauan pendek dan damage kecil. */
  private tebas(pemain: Pemain, tarung: PertarunganPemain): void {
    const G = R.golok;
    const kena = dalamJangkauan(this.posisi, this.hadap, pemain.posisi, G.jangkauan, JARI_PEMAIN, G.sudutKena);
    if (!kena || tarung.kebal) return;
    const keadaan = tarung.keadaanTangkis();
    const menghadapLawan = menghadap(pemain.posisi, pemain.hadap, this.posisi, KONFIG.pemain.tangkis.sudutTangkis);
    if (keadaan === 'pas' && menghadapLawan) {
      this.masuk('terhuyung');
      return;
    }
    if (keadaan === 'biasa' && menghadapLawan) {
      tarung.terkena(this.posisi, KONFIG.pemain.tangkis.dorongTerkena, true, 0);
      return;
    }
    tarung.terkena(this.posisi, G.dorong, false, G.damage);
  }

  protected override perbaruiVisual(dt: number): void {
    let condong = 0;
    let miring = 0;
    let golokX = 0.6;
    let golokY = 0;
    let sinar = 0;
    const sinarWarna = new THREE.Color(0, 0, 0);
    switch (this.status) {
      case 'bersiap': {
        const t = Math.min(1, this.waktu / R.isyarat);
        condong = -0.12 * t;
        golokX = 0.6 - 1.6 * t; // golok diangkat
        sinar = 0.4 + 0.8 * t;
        sinarWarna.copy(WARNA_ISYARAT);
        break;
      }
      case 'menyerang': {
        const T = R.tebasan;
        // Dua ayunan: turun di tebasan pertama, menyamping di tebasan kedua.
        const t1 = Math.min(1, Math.max(0, (this.waktu - T.pertama + 0.1) / 0.2));
        const t2 = Math.min(1, Math.max(0, (this.waktu - T.kedua + 0.1) / 0.2));
        golokX = -1.0 + 2.0 * t1 - 0.6 * t2;
        golokY = -1.2 * t2;
        condong = 0.3 * Math.sin(Math.PI * t1) + 0.25 * Math.sin(Math.PI * t2);
        break;
      }
      case 'terhuyung': {
        const t = Math.max(0, this.waktu) / R.terhuyung;
        condong = -0.35 * (1 - t);
        miring = 0.25 * Math.sin(this.waktu * 9) * (1 - t);
        sinar = 0.8;
        sinarWarna.copy(WARNA_TERHUYUNG);
        break;
      }
      case 'mendekat':
      case 'mengelilingi':
      case 'pergi':
        condong = 0.08;
        break;
    }
    const laju = Math.min(1, 16 * dt);
    this.badan.rotation.y = this.hadap;
    this.badan.rotation.x += (condong - this.badan.rotation.x) * laju;
    this.badan.rotation.z += (miring - this.badan.rotation.z) * laju;
    this.golok.rotation.x += (golokX - this.golok.rotation.x) * laju;
    this.golok.rotation.y += (golokY - this.golok.rotation.y) * laju;
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
