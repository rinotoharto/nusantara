import * as THREE from 'three';
import type { Pemain } from '../character/player';
import { Lawan, JARI_LAWAN, type PemberiGiliran, type StatusLawan } from '../combat/enemy';
import type { PertarunganPemain, Serangan } from '../combat/player-combat';
import { tinggiLantai, dorongKeluar, type DataTabrakan } from '../world/collision';
import { SILUMAN } from './config';
import { KerucutPandang, ujiPandang, garisPandangBebas } from './vision';
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
const JARAK_SAMPAI = 0.5;

/**
 * Penjaga patroli Kediri: kapsul dan tombak lawan sprint 2 dengan status tambahan
 * patroli, curiga, mencari, dan kembali. Mengejar berarti masuk ke status pertarungan
 * `Lawan` (mendekat, mengelilingi, bersiap, ...) sehingga aturan satu penyerang tetap berlaku.
 */
export class Penjaga extends Lawan {
  readonly kerucut = new KerucutPandang(P.sudutPandang, P.jarakPandang);
  /** Pandangan tepi: lebih lebar tapi pendek, menaikkan meteran lebih lambat; digambar lebih tipis. */
  readonly kerucutTepi = new KerucutPandang(P.sudutTepi, P.jarakTepi, 0.1);
  /** Benar kalau pada frame ini penjaga mendengar langkah (tanpa melihat). */
  mendengar = false;
  /** Meteran curiga 0 sampai 1. */
  curiga = 0;
  /** Benar kalau pemain terlihat pada frame ini. */
  terlihat = false;
  /** Tempat pemain terakhir terlihat; tujuan saat mencari. */
  readonly titikTerakhir = new THREE.Vector3();
  private sejakTerlihat = 0;
  private indeksTitik = 0;
  private arahTitik = 1;
  private sisaJeda = 0;
  private hadapDasar = 0;
  private waktuToleh = 0;
  private sedangMenoleh = false;

  constructor(
    data: DataTabrakan,
    readonly rute: RutePatroli,
    private konteks: KonteksSiluman,
  ) {
    super(data, rute.titik[0].x, rute.titik[0].z);
    this.hidupkan();
  }

  /** Benar kalau sedang di salah satu status pertarungan warisan `Lawan`. */
  get mengejar(): boolean {
    return this.hidup && this.bertarung;
  }

  override hidupkan(): void {
    super.hidupkan();
    // Dipanggil juga dari konstruktor induk, sebelum rute terpasang.
    if (!this.rute) return;
    this.indeksTitik = Math.min(1, this.rute.titik.length - 1);
    this.arahTitik = 1;
    this.sisaJeda = 0;
    this.sedangMenoleh = false;
    this.curiga = 0;
    this.terlihat = false;
    this.sejakTerlihat = 0;
    this.masuk('patroli');
    const t = this.rute.titik[this.indeksTitik];
    this.hadap = Math.atan2(t.x - this.posisi.x, t.z - this.posisi.z);
    this.perbaruiKerucut();
  }

  /** `Lawan` masuk `diam` saat pemain terlalu jauh; penjaga malah mencari ke titik terakhir. */
  protected override masuk(status: StatusLawan): void {
    if (status === 'diam' && this.rute) {
      this.mulaiMencari();
      return;
    }
    super.masuk(status);
  }

  /** Diserang saat belum sadar: langsung mengejar. */
  override terkena(serangan: Serangan, dari: THREE.Vector3): void {
    if (this.hidup && !this.bertarung) this.mulaiMengejar(true);
    super.terkena(serangan, dari);
  }

  /** Dipanggil kawan yang berteriak. */
  ikutMengejar(): void {
    if (!this.hidup || this.bertarung) return;
    this.titikTerakhir.copy(this.konteks.pemain.posisi);
    this.mulaiMengejar(false);
  }

  override perbarui(dt: number, pemain: Pemain, tarung: PertarunganPemain, giliran: PemberiGiliran): void {
    if (this.bertarung) {
      this.perbaruiMengejar(dt, pemain, tarung, giliran);
    } else {
      this.waktu += dt;
      this.perbaruiCuriga(dt);
      switch (this.status) {
        case 'patroli':
          this.perbaruiPatroli(dt);
          if (this.curiga >= 1) this.mulaiMengejar(true);
          else if ((this.terlihat || this.mendengar) && this.curiga >= P.ambangCuriga) this.masuk('curiga');
          break;
        case 'curiga':
          // Berhenti dan menghadap ke arah pemain terakhir terlihat.
          this.hadapKe(this.titikTerakhir, dt);
          if (this.curiga >= 1) this.mulaiMengejar(true);
          else if (this.curiga < P.ambangCuriga) this.mulaiKembali();
          break;
        case 'mencari':
          this.perbaruiMencari(dt);
          if (this.curiga >= 1) this.mulaiMengejar(true);
          break;
        case 'kembali':
          this.perbaruiKembali(dt);
          if (this.curiga >= 1) this.mulaiMengejar(true);
          else if ((this.terlihat || this.mendengar) && this.curiga >= P.ambangCuriga) this.masuk('curiga');
          break;
        default:
          break;
      }
      this.perbaruiVisual(dt);
    }
    this.perbaruiKerucut();
  }

  // --- Mengejar -------------------------------------------------------------------------

  private mulaiMengejar(berteriak: boolean): void {
    // Melihat pemain sendiri (bukan karena teriakan kawan): lapor ke misi sebagai "ketahuan".
    if (berteriak && !this.bertarung) this.konteks.saatKetahuan?.(this);
    this.curiga = 1;
    this.sejakTerlihat = 0;
    this.sedangMenoleh = false;
    super.masuk('mendekat');
    if (berteriak) {
      for (const kawan of this.konteks.penjaga) {
        if (kawan === this) continue;
        if (kawan.posisi.distanceTo(this.posisi) < P.jarakSeru) kawan.ikutMengejar();
      }
    }
  }

  /**
   * Saat mengejar, pertarungan `Lawan` berjalan selama pemain terlihat (kerucut lebar) atau
   * terdengar dekat. Kalau hilang, penjaga berjalan ke titik terakhir; 4 detik tanpa melihat
   * atau pemain lebih dari 25 m membuatnya mencari.
   */
  private perbaruiMengejar(dt: number, pemain: Pemain, tarung: PertarunganPemain, giliran: PemberiGiliran): void {
    const k = this.konteks.pemain;
    const jarak = Math.hypot(k.posisi.x - this.posisi.x, k.posisi.z - this.posisi.z);
    let terlihat = false;
    if (!k.tersembunyi || jarak < k.jarakTembus) {
      terlihat =
        jarak < P.jarakDengar ||
        ujiPandang(this.posisi, this.hadap, P.sudutKejar, P.jarakPutus, k.posisi, this.data, P.tinggiMata, this.konteks.penghalangSemak).terlihat;
    }
    this.terlihat = terlihat;
    if (terlihat) {
      this.sejakTerlihat = 0;
      this.titikTerakhir.copy(k.posisi);
    } else {
      this.sejakTerlihat += dt;
    }

    if (jarak > P.jarakPutus || this.sejakTerlihat > P.waktuHilang) {
      giliran.lepasGiliran(this);
      this.mulaiMencari();
      return;
    }

    const sedangBeraksi = this.status === 'bersiap' || this.status === 'menyerang' || this.status === 'terhuyung' || this.status === 'mati';
    if (terlihat || sedangBeraksi) {
      super.perbarui(dt, pemain, tarung, giliran);
      return;
    }
    // Pemain hilang dari pandangan: kejar ke titik terakhir tanpa menyerang.
    this.waktu += dt;
    giliran.lepasGiliran(this);
    this.jalanKe(this.titikTerakhir.x, this.titikTerakhir.z, SILUMAN.penjaga.kecepatanMencari * 1.3, dt);
    this.perbaruiVisual(dt);
  }

  // --- Mencari dan kembali ----------------------------------------------------------------

  private mulaiMencari(): void {
    this.curiga = Math.min(this.curiga, P.curigaMencari);
    this.sedangMenoleh = false;
    this.sisaJeda = 0;
    super.masuk('mencari');
  }

  /** Berjalan ke titik terakhir pemain terlihat, menoleh-noleh beberapa detik, lalu kembali. */
  private perbaruiMencari(dt: number): void {
    if (!this.sedangMenoleh) {
      if (this.jalanKe(this.titikTerakhir.x, this.titikTerakhir.z, P.kecepatanMencari, dt)) {
        this.mulaiMenoleh(P.waktuMencari);
      }
      return;
    }
    if (this.perbaruiMenoleh(dt)) this.mulaiKembali();
  }

  private mulaiKembali(): void {
    // Menuju titik jalan terdekat.
    let terdekat = 0;
    let jarakTerdekat = Infinity;
    this.rute.titik.forEach((t, i) => {
      const d = Math.hypot(t.x - this.posisi.x, t.z - this.posisi.z);
      if (d < jarakTerdekat) {
        jarakTerdekat = d;
        terdekat = i;
      }
    });
    this.indeksTitik = terdekat;
    this.sedangMenoleh = false;
    super.masuk('kembali');
  }

  private perbaruiKembali(dt: number): void {
    const t = this.rute.titik[this.indeksTitik];
    if (this.jalanKe(t.x, t.z, P.kecepatanPatroli, dt)) {
      this.majukanTitik();
      super.masuk('patroli');
    }
  }

  // --- Patroli --------------------------------------------------------------------------

  /** Berjalan antar titik jalan; di tiap titik berhenti 1 sampai 2 detik sambil menoleh kiri-kanan. */
  private perbaruiPatroli(dt: number): void {
    const titik = this.rute.titik;
    if (titik.length < 2) return;
    if (this.sedangMenoleh) {
      if (this.perbaruiMenoleh(dt)) this.majukanTitik();
      return;
    }
    const tujuan = titik[this.indeksTitik];
    if (this.jalanKe(tujuan.x, tujuan.z, P.kecepatanPatroli, dt)) {
      this.mulaiMenoleh(P.jedaTitikMin + Math.random() * (P.jedaTitikMaks - P.jedaTitikMin));
    }
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

  // --- Gerak dasar ----------------------------------------------------------------------

  private mulaiMenoleh(lama: number): void {
    this.sedangMenoleh = true;
    this.sisaJeda = lama;
    this.hadapDasar = this.hadap;
    this.waktuToleh = 0;
  }

  /** Menoleh kiri-kanan di tempat; mengembalikan benar saat waktunya habis. */
  private perbaruiMenoleh(dt: number): boolean {
    this.sisaJeda -= dt;
    this.waktuToleh += dt;
    const toleh = (P.tolehSudut * Math.PI) / 180;
    this.hadap = this.hadapDasar + Math.sin(this.waktuToleh * P.tolehLaju) * toleh;
    if (this.sisaJeda <= 0) {
      this.sedangMenoleh = false;
      return true;
    }
    return false;
  }

  private hadapKe(sasaran: THREE.Vector3, dt: number): void {
    const tujuanHadap = Math.atan2(sasaran.x - this.posisi.x, sasaran.z - this.posisi.z);
    let selisih = tujuanHadap - this.hadap;
    selisih = Math.atan2(Math.sin(selisih), Math.cos(selisih));
    this.hadap += selisih * Math.min(1, 6 * dt);
  }

  /** Berjalan datar ke (x, z) sambil berputar ke arahnya; mengembalikan benar kalau sudah sampai. */
  private jalanKe(x: number, z: number, kecepatan: number, dt: number): boolean {
    const dx = x - this.posisi.x;
    const dz = z - this.posisi.z;
    const jarak = Math.hypot(dx, dz);
    if (jarak < JARAK_SAMPAI) return true;
    const tujuanHadap = Math.atan2(dx, dz);
    let selisih = tujuanHadap - this.hadap;
    selisih = Math.atan2(Math.sin(selisih), Math.cos(selisih));
    this.hadap += selisih * Math.min(1, 6 * dt);

    const langkah = Math.min(jarak, kecepatan * dt);
    this.posisi.x += (dx / jarak) * langkah;
    this.posisi.z += (dz / jarak) * langkah;
    dorongKeluar(this.data, this.posisi, JARI_LAWAN);
    this.posisi.y = tinggiLantai(this.data, this.posisi.x, this.posisi.z, this.posisi.y + 0.5);
    return false;
  }

  // --- Curiga ---------------------------------------------------------------------------

  /**
   * Meteran curiga di luar pertarungan. Tiga cara pemain ketahuan:
   * - Terlihat: kerucut utama (jauh, sempit) menaikkan meteran penuh laju; pandangan tepi (pendek,
   *   180 derajat) menaikkannya `lajuTepi` kali. Lebih cepat kalau dekat atau berlari.
   * - Terlalu dekat: dalam `jarakLangsung` dari sisi mana pun langsung penuh, kecuali bersembunyi
   *   di semak (lalu berlaku `jarakTembus`).
   * - Terdengar: di dalam radius suara langkah penjaga menoleh ke sumbernya dan curiga; di dalam
   *   `bagianPenuh` kali radius selama `waktuPenuh` detik meteran penuh.
   * Tidak ada yang terlihat atau terdengar: turun pelan, kecuali saat mencari.
   */
  private perbaruiCuriga(dt: number): void {
    const k = this.konteks.pemain;
    const jarak = Math.hypot(k.posisi.x - this.posisi.x, k.posisi.z - this.posisi.z);
    const jarakPandang = P.jarakPandang * k.faktorJarak;
    let hasil = ujiPandang(this.posisi, this.hadap, P.sudutPandang, jarakPandang, k.posisi, this.data, P.tinggiMata, this.konteks.penghalangSemak);
    let lajuPandang = 1;
    if (!hasil.terlihat) {
      // Pandangan tepi: pendek, hampir setengah lingkaran, laju lebih rendah.
      hasil = ujiPandang(this.posisi, this.hadap, P.sudutTepi, P.jarakTepi * k.faktorJarak, k.posisi, this.data, P.tinggiMata, this.konteks.penghalangSemak);
      lajuPandang = P.lajuTepi;
    }
    if (k.tersembunyi && hasil.jarak >= k.jarakTembus) hasil = { terlihat: false, jarak: hasil.jarak };
    // Terlalu dekat dari sisi mana pun (garis pandang tetap harus bebas dari batu dan rumah).
    const terlaluDekat =
      jarak < P.jarakLangsung &&
      (!k.tersembunyi || jarak < k.jarakTembus) &&
      garisPandangBebas(this.data, this.posisi, k.posisi, P.tinggiMata, this.konteks.penghalangSemak);
    this.terlihat = hasil.terlihat || terlaluDekat;
    this.mendengar = false;
    if (this.terlihat) {
      this.titikTerakhir.copy(k.posisi);
      if (terlaluDekat || hasil.jarak < P.jarakLangsung) {
        this.curiga = 1;
      } else {
        let laju = (k.pengaliCuriga * lajuPandang) / P.waktuCuriga;
        if (hasil.jarak < P.jarakDekat) laju *= P.pengaliDekat;
        if (k.lari) laju *= P.pengaliLari;
        this.curiga = Math.min(1, this.curiga + laju * dt);
      }
      return;
    }
    if (this.perbaruiPendengaran(dt)) return;
    if (k.tersembunyi && this.pengikutTerlihat(jarakPandang)) {
      // Pemain bersembunyi tapi seorang pengikut masih di luar semak: meteran naik setengah laju.
      this.curiga = Math.min(1, this.curiga + (k.pengaliCuriga * SILUMAN.pengikut.faktorCuriga / P.waktuCuriga) * dt);
    } else if (this.status !== 'mencari') {
      this.curiga = Math.max(0, this.curiga - dt / P.waktuTurun);
    }
  }

  /** Mendengar langkah: benar kalau ada sumber suara di dalam radiusnya; meteran dan titik terakhir disesuaikan. */
  private perbaruiPendengaran(dt: number): boolean {
    const S = SILUMAN.suara;
    let terdekat: { x: number; z: number; bagian: number } | null = null;
    for (const s of this.konteks.suara) {
      const d = Math.hypot(s.x - this.posisi.x, s.z - this.posisi.z);
      if (d >= s.radius) continue;
      const bagian = d / s.radius;
      if (!terdekat || bagian < terdekat.bagian) terdekat = { x: s.x, z: s.z, bagian };
    }
    if (!terdekat) return false;
    this.mendengar = true;
    this.titikTerakhir.set(terdekat.x, this.posisi.y, terdekat.z);
    // Cukup curiga untuk berhenti dan menoleh; di bagian dalam radius meteran terus naik sampai penuh.
    this.curiga = Math.max(this.curiga, P.ambangCuriga + 0.01);
    if (terdekat.bagian < S.bagianPenuh) this.curiga = Math.min(1, this.curiga + (this.konteks.pemain.pengaliCuriga / S.waktuPenuh) * dt);
    return true;
  }

  private pengikutTerlihat(jarakPandang: number): boolean {
    for (const pos of this.konteks.pengikutTerbuka) {
      if (ujiPandang(this.posisi, this.hadap, P.sudutPandang, jarakPandang, pos, this.data, P.tinggiMata, this.konteks.penghalangSemak).terlihat) {
        this.titikTerakhir.copy(pos);
        return true;
      }
    }
    return false;
  }

  private perbaruiKerucut(): void {
    this.kerucut.tampil = this.hidup;
    this.kerucutTepi.tampil = this.hidup;
    if (!this.hidup) return;
    const warna = this.bertarung
      ? WARNA_MENGEJAR
      : this.curiga >= P.ambangCuriga
        ? WARNA_CURIGA
        : WARNA_TENANG;
    this.kerucut.perbarui(this.posisi, this.hadap, warna);
    this.kerucutTepi.perbarui(this.posisi, this.hadap, warna);
  }
}
