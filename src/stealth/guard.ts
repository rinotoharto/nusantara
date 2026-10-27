import * as THREE from 'three';
import type { Pemain } from '../character/player';
import { Lawan, JARI_LAWAN, type PemberiGiliran } from '../combat/enemy';
import type { PertarunganPemain } from '../combat/player-combat';
import { tinggiLantai, dorongKeluar, type DataTabrakan } from '../world/collision';
import { SILUMAN } from './config';
import { KerucutPandang, ujiPandang } from './vision';
import type { KonteksSiluman } from './stealth-manager';

const P = SILUMAN.penjaga;

export interface TitikJalan {
  x: number;
  z: number;
}

export interface RutePatroli {
  nama: string;
  /** `bolak-balik`: maju lalu mundur menyusuri daftar; `melingkar`: kembali ke titik pertama. */
  mode: string;
  titik: TitikJalan[];
}

const WARNA_TENANG = new THREE.Color(0x3fbf5a);
const WARNA_CURIGA = new THREE.Color(0xe6c132);
const WARNA_MENGEJAR = new THREE.Color(0xe03b2f);
const JARAK_SAMPAI = 0.4;

/**
 * Penjaga patroli Kediri: kapsul dan tombak lawan sprint 2, tapi dimulai di status `patroli`.
 * Mengikuti titik jalan, berhenti sebentar sambil menoleh, dan menilai pemain lewat kerucut pandang.
 * Status pertarungan diwarisi utuh dari `Lawan`.
 */
export class Penjaga extends Lawan {
  readonly kerucut = new KerucutPandang(P.sudutPandang, P.jarakPandang);
  /** Meteran curiga 0 sampai 1. */
  curiga = 0;
  /** Benar kalau pemain terlihat pada frame ini. */
  terlihat = false;
  private indeksTitik = 0;
  private arahTitik = 1;
  private sisaJeda = 0;
  private hadapDasar = 0;
  private waktuToleh = 0;

  constructor(
    data: DataTabrakan,
    readonly rute: RutePatroli,
    private konteks: KonteksSiluman,
  ) {
    super(data, rute.titik[0].x, rute.titik[0].z);
    this.hidupkan();
  }

  override hidupkan(): void {
    super.hidupkan();
    // Dipanggil juga dari konstruktor induk, sebelum rute terpasang.
    if (!this.rute) return;
    this.indeksTitik = Math.min(1, this.rute.titik.length - 1);
    this.arahTitik = 1;
    this.sisaJeda = 0;
    this.curiga = 0;
    this.terlihat = false;
    this.masuk('patroli');
    const t = this.rute.titik[this.indeksTitik];
    this.hadap = Math.atan2(t.x - this.posisi.x, t.z - this.posisi.z);
    this.perbaruiKerucut();
  }

  override perbarui(dt: number, pemain: Pemain, tarung: PertarunganPemain, giliran: PemberiGiliran): void {
    if (this.status === 'patroli') {
      this.waktu += dt;
      this.perbaruiPatroli(dt);
      this.perbaruiCuriga(dt);
      this.perbaruiVisual(dt);
    } else {
      super.perbarui(dt, pemain, tarung, giliran);
    }
    this.perbaruiKerucut();
  }

  /** Berjalan antar titik jalan; di tiap titik berhenti 1 sampai 2 detik sambil menoleh kiri-kanan. */
  private perbaruiPatroli(dt: number): void {
    const titik = this.rute.titik;
    if (titik.length < 2) return;
    const tujuan = titik[this.indeksTitik];

    if (this.sisaJeda > 0) {
      this.sisaJeda -= dt;
      this.waktuToleh += dt;
      const toleh = (P.tolehSudut * Math.PI) / 180;
      this.hadap = this.hadapDasar + Math.sin(this.waktuToleh * P.tolehLaju) * toleh;
      if (this.sisaJeda <= 0) this.majukanTitik();
      return;
    }

    const dx = tujuan.x - this.posisi.x;
    const dz = tujuan.z - this.posisi.z;
    const jarak = Math.hypot(dx, dz);
    if (jarak < JARAK_SAMPAI) {
      this.sisaJeda = P.jedaTitikMin + Math.random() * (P.jedaTitikMaks - P.jedaTitikMin);
      this.hadapDasar = this.hadap;
      this.waktuToleh = 0;
      return;
    }
    const tujuanHadap = Math.atan2(dx, dz);
    let selisih = tujuanHadap - this.hadap;
    selisih = Math.atan2(Math.sin(selisih), Math.cos(selisih));
    this.hadap += selisih * Math.min(1, 6 * dt);

    const langkah = Math.min(jarak, P.kecepatanPatroli * dt);
    this.posisi.x += (dx / jarak) * langkah;
    this.posisi.z += (dz / jarak) * langkah;
    dorongKeluar(this.data, this.posisi, JARI_LAWAN);
    this.posisi.y = tinggiLantai(this.data, this.posisi.x, this.posisi.z, this.posisi.y + 0.5);
  }

  private majukanTitik(): void {
    const n = this.rute.titik.length;
    if (this.rute.mode === 'melingkar') {
      this.indeksTitik = (this.indeksTitik + 1) % n;
      return;
    }
    let berikut = this.indeksTitik + this.arahTitik;
    if (berikut < 0 || berikut >= n) {
      this.arahTitik = -this.arahTitik;
      berikut = this.indeksTitik + this.arahTitik;
    }
    this.indeksTitik = berikut;
  }

  /**
   * Meteran curiga: naik saat pemain terlihat (lebih cepat kalau dekat atau berlari),
   * langsung penuh kalau pemain tepat di depan hidung, turun pelan saat tidak terlihat.
   */
  private perbaruiCuriga(dt: number): void {
    const k = this.konteks.pemain;
    const hasil = ujiPandang(
      this.posisi,
      this.hadap,
      P.sudutPandang,
      P.jarakPandang * k.faktorJarak,
      k.posisi,
      this.data,
      P.tinggiMata,
    );
    this.terlihat = hasil.terlihat;
    if (hasil.terlihat) {
      if (hasil.jarak < P.jarakLangsung) {
        this.curiga = 1;
      } else {
        let laju = 1 / P.waktuCuriga;
        if (hasil.jarak < P.jarakDekat) laju *= P.pengaliDekat;
        if (k.lari) laju *= P.pengaliLari;
        this.curiga = Math.min(1, this.curiga + laju * dt);
      }
    } else {
      this.curiga = Math.max(0, this.curiga - dt / P.waktuTurun);
    }
  }

  private perbaruiKerucut(): void {
    this.kerucut.tampil = this.hidup;
    if (!this.hidup) return;
    const warna =
      this.status !== 'patroli' || this.curiga >= 1
        ? WARNA_MENGEJAR
        : this.curiga >= P.ambangCuriga
          ? WARNA_CURIGA
          : WARNA_TENANG;
    this.kerucut.perbarui(this.posisi, this.hadap, warna);
  }
}
