import * as THREE from 'three';
import type { Pemain } from '../character/player';
import { JARI_PEMAIN, TINGGI_PEMAIN } from '../character/player';
import { tinggiLantai, dorongKeluar, type DataTabrakan } from '../world/collision';
import { KONFIG } from './config';
import { Nyawa, catatDamage } from './health';
import { dalamJangkauan, menghadap, sudutKe } from './hit';
import type { PertarunganPemain, Serangan } from './player-combat';

const L = KONFIG.lawan;
export const JARI_LAWAN = JARI_PEMAIN;

const WARNA = new THREE.Color(0x7a1f1f); // merah tua, prajurit Kediri
const WARNA_ISYARAT = new THREE.Color(0xffd23a);
const WARNA_TERHUYUNG = new THREE.Color(0x4aa3ff);
const WARNA_KENA = new THREE.Color(0xffffff);

export type StatusLawan =
  | 'diam'
  | 'mendekat'
  | 'mengelilingi'
  | 'bersiap'
  | 'menyerang'
  | 'mundur'
  | 'terhuyung'
  | 'mati';

/** Pemberi giliran serangan: hanya satu lawan yang boleh menyerang pada satu waktu. */
export interface PemberiGiliran {
  mintaGiliran(lawan: Lawan): boolean;
  lepasGiliran(lawan: Lawan): void;
}

/**
 * Prajurit Kediri: kapsul merah tua dengan tombak. AI berstatus: diam, mendekat, mengelilingi,
 * bersiap (isyarat kuning 0,5 detik), menyerang (menusuk), mundur, terhuyung, mati.
 */
export class Lawan {
  readonly grup = new THREE.Group();
  readonly posisi = this.grup.position;
  private readonly badan = new THREE.Group();
  private readonly bahan: THREE.MeshStandardMaterial;
  private readonly tombak = new THREE.Group();
  status: StatusLawan = 'diam';
  readonly nyawa = new Nyawa(L.nyawa);
  /** Detik sejak masuk status sekarang. */
  private waktu = 0;
  hadap = 0;
  private jedaMundur = 1.5;
  private sisaKilat = 0;
  private tusukanSudahKeluar = false;
  /** Arah memutar saat mengelilingi: +1 searah jarum jam, -1 sebaliknya. */
  private arahKeliling = Math.random() < 0.5 ? 1 : -1;
  private sisaGantiArah = 3;
  private readonly asal: THREE.Vector3;
  private readonly doronganKena = new THREE.Vector3();
  private sisaDoronganKena = 0;

  constructor(private data: DataTabrakan, x: number, z: number) {
    this.bahan = new THREE.MeshStandardMaterial({ color: WARNA, roughness: 0.8 });
    const kapsul = new THREE.Mesh(
      new THREE.CapsuleGeometry(JARI_LAWAN, TINGGI_PEMAIN - 2 * JARI_LAWAN, 6, 12),
      this.bahan,
    );
    kapsul.position.y = TINGGI_PEMAIN / 2;
    kapsul.castShadow = true;
    this.badan.add(kapsul);

    // Penanda wajah supaya arah hadap terbaca.
    const hidung = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.14, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x3a1a1a }),
    );
    hidung.position.set(0, TINGGI_PEMAIN - 0.35, JARI_LAWAN);
    this.badan.add(hidung);

    // Tombak: balok tipis panjang di sisi kanan, mata tombak di ujung.
    const batang = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.06, L.tombak.jangkauan),
      new THREE.MeshStandardMaterial({ color: 0x7a5a36, roughness: 0.9 }),
    );
    batang.position.z = L.tombak.jangkauan / 2 - 0.4;
    batang.castShadow = true;
    const mata = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.04, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.6, roughness: 0.3 }),
    );
    mata.position.z = L.tombak.jangkauan - 0.4;
    this.tombak.add(batang, mata);
    this.tombak.position.set(JARI_LAWAN + 0.08, 1.0, 0);
    this.badan.add(this.tombak);
    this.badan.rotation.order = 'YXZ';

    this.grup.add(this.badan);
    this.asal = new THREE.Vector3(x, 0, z);
    this.hidupkan();
  }

  get hidup(): boolean {
    return this.status !== 'mati';
  }

  /** Kembalikan ke titik awal dalam keadaan hidup. */
  hidupkan(): void {
    this.posisi.set(this.asal.x, tinggiLantai(this.data, this.asal.x, this.asal.z, 1e9), this.asal.z);
    this.masuk('diam');
    this.nyawa.pulihkan();
    this.grup.visible = true;
    this.badan.rotation.set(0, this.hadap, 0);
    this.sisaKilat = 0;
    this.sisaDoronganKena = 0;
  }

  /** Dibangunkan kawan: mulai mendekat walau pemain belum terlihat sendiri. */
  waspada(): void {
    if (this.status === 'diam') this.masuk('mendekat');
  }

  private masuk(status: StatusLawan): void {
    this.status = status;
    this.waktu = 0;
    this.tusukanSudahKeluar = false;
  }

  perbarui(dt: number, pemain: Pemain, tarung: PertarunganPemain, giliran: PemberiGiliran): void {
    this.waktu += dt;
    if (this.status === 'mati') {
      this.perbaruiMati(dt);
      return;
    }
    const posPemain = pemain.posisi;
    const dx = posPemain.x - this.posisi.x;
    const dz = posPemain.z - this.posisi.z;
    const jarak = Math.hypot(dx, dz);
    const keX = jarak > 1e-4 ? dx / jarak : 0;
    const keZ = jarak > 1e-4 ? dz / jarak : 0;
    const jarakSerang = L.tombak.jangkauan - 0.3;

    // Menghadap pemain, kecuali saat menusuk (arah dikunci) atau terhuyung.
    if (this.status !== 'menyerang' && this.status !== 'terhuyung') {
      const tujuan = sudutKe(this.posisi, posPemain);
      let selisih = tujuan - this.hadap;
      selisih = Math.atan2(Math.sin(selisih), Math.cos(selisih));
      this.hadap += selisih * Math.min(1, 7 * dt);
    }

    let gerakX = 0;
    let gerakZ = 0;

    switch (this.status) {
      case 'diam':
        if (jarak < L.jarakDeteksi) this.masuk('mendekat');
        break;

      case 'mendekat': {
        if (jarak > L.jarakDeteksi * 1.5) {
          giliran.lepasGiliran(this);
          this.masuk('diam');
          break;
        }
        const punyaGiliran = giliran.mintaGiliran(this);
        if (punyaGiliran && jarak <= jarakSerang) {
          this.masuk('bersiap');
        } else if (!punyaGiliran && jarak <= L.jarakMengelilingiMaks) {
          this.masuk('mengelilingi');
        } else {
          gerakX = keX * L.kecepatanMendekat;
          gerakZ = keZ * L.kecepatanMendekat;
        }
        break;
      }

      case 'mengelilingi': {
        if (giliran.mintaGiliran(this)) {
          this.masuk('mendekat');
          break;
        }
        if (jarak > L.jarakDeteksi * 1.5) {
          this.masuk('diam');
          break;
        }
        this.sisaGantiArah -= dt;
        if (this.sisaGantiArah <= 0) {
          this.arahKeliling = -this.arahKeliling;
          this.sisaGantiArah = 3 + Math.random() * 3;
        }
        // Komponen radial menuju jarak lingkar, komponen tangensial memutar.
        const tengah = (L.jarakMengelilingiMin + L.jarakMengelilingiMaks) / 2;
        let radial = 0;
        if (jarak > L.jarakMengelilingiMaks) radial = L.kecepatanMendekat * 0.8;
        else if (jarak < L.jarakMengelilingiMin) radial = -L.kecepatanMengelilingi;
        else radial = (tengah - jarak) * 0.8;
        const tangX = -keZ * this.arahKeliling;
        const tangZ = keX * this.arahKeliling;
        gerakX = keX * radial + tangX * L.kecepatanMengelilingi;
        gerakZ = keZ * radial + tangZ * L.kecepatanMengelilingi;
        break;
      }

      case 'bersiap':
        if (this.waktu >= L.isyarat) this.masuk('menyerang');
        break;

      case 'menyerang':
        if (!this.tusukanSudahKeluar && this.waktu >= 0.08) {
          this.tusukanSudahKeluar = true;
          this.tusuk(pemain, tarung);
        }
        if (this.waktu >= L.durasiTusuk) {
          this.jedaMundur = L.mundurMin + Math.random() * (L.mundurMaks - L.mundurMin);
          giliran.lepasGiliran(this);
          this.masuk('mundur');
        }
        break;

      case 'mundur':
        if (jarak < L.jarakMengelilingiMin) {
          gerakX = -keX * L.kecepatanMengelilingi * 1.3;
          gerakZ = -keZ * L.kecepatanMengelilingi * 1.3;
        }
        if (this.waktu >= this.jedaMundur) this.masuk('mendekat');
        break;

      case 'terhuyung':
        if (this.waktu >= L.terhuyung) this.masuk('mendekat');
        break;
    }

    // Dorongan karena terkena serangan pemain.
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

  /** Tusukan tombak mengenai pemain, kecuali pemain kebal atau menangkis. */
  private tusuk(pemain: Pemain, tarung: PertarunganPemain): void {
    const kena = dalamJangkauan(this.posisi, this.hadap, pemain.posisi, L.tombak.jangkauan, JARI_PEMAIN, L.tombak.sudutKena);
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
    tarung.terkena(this.posisi, L.tombak.dorong, false, L.tombak.damage);
  }

  /** Lawan terkena serangan pemain dari posisi `dari`. */
  terkena(serangan: Serangan, dari: THREE.Vector3): void {
    if (this.status === 'mati') return;
    this.sisaKilat = 0.12;
    catatDamage(this.posisi, serangan.damage, true);
    const dx = this.posisi.x - dari.x;
    const dz = this.posisi.z - dari.z;
    const d = Math.hypot(dx, dz) || 1;
    const lama = 0.15;
    this.doronganKena.set((dx / d) * serangan.dorong / lama, 0, (dz / d) * serangan.dorong / lama);
    this.sisaDoronganKena = lama;
    if (this.nyawa.kurangi(serangan.damage)) this.masuk('mati');
    else if (serangan.berat) this.masuk('terhuyung');
  }

  /** Rebah ke belakang, lalu menghilang setelah beberapa detik. */
  private perbaruiMati(dt: number): void {
    const laju = Math.min(1, 5 * dt);
    this.badan.rotation.x += (-1.5 - this.badan.rotation.x) * laju;
    this.badan.rotation.z += (0 - this.badan.rotation.z) * laju;
    if (this.sisaKilat > 0) {
      this.sisaKilat -= dt;
    } else {
      this.bahan.emissive.setRGB(0, 0, 0);
      this.bahan.emissiveIntensity = 0;
    }
    if (this.waktu >= L.hilangSetelahMati) this.grup.visible = false;
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
      case 'menyerang': {
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
      case 'mendekat':
      case 'mengelilingi':
        condong = 0.08;
        break;
    }

    const laju = Math.min(1, 16 * dt);
    this.badan.rotation.y = this.hadap;
    this.badan.rotation.x += (condong - this.badan.rotation.x) * laju;
    this.badan.rotation.z += (miring - this.badan.rotation.z) * laju;
    this.tombak.position.z += (tombakZ - this.tombak.position.z) * laju;

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
