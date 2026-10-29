import * as THREE from 'three';
import type { Input } from '../character/input';
import {
  JARI_PEMAIN,
  PERINTAH_BEBAS,
  arahInputRelatifKamera,
  type Pemain,
  type PerintahGerak,
} from '../character/player';
import { KONFIG } from './config';
import { Nyawa, catatDamage } from './health';
import { menghadap, sudutKe } from './hit';

const K = KONFIG.pemain;

/** Status aksi pemain. Hanya satu aksi berjalan pada satu waktu. */
export type StatusAksi =
  | 'bebas'
  | 'mengisi' // klik kiri ditahan, belum jelas ringan atau berat
  | 'serangRingan'
  | 'serangBerat'
  | 'tangkis'
  | 'hindar'
  | 'terpukul'
  | 'terjatuh' // rebah karena terkaman harimau, serudukan babi, atau longsor; lamanya dari penyerang
  | 'tikaman' // Tikaman Keris: melesat lalu menusuk lawan yang terhuyung
  | 'sergap' // Sergap: dari jongkok di belakang lawan lengah, melesat lalu menamatkannya; tidak kebal
  | 'mati';

/** Satu serangan yang siap diuji kena; dikeluarkan sekali per ayunan. */
export interface Serangan {
  damage: number;
  jangkauan: number;
  sudutKena: number;
  dorong: number;
  berat: boolean;
  /** Kalau diisi, serangan hanya mengenai sasaran ini (Tikaman Keris). */
  sasaran?: Sasaran | null;
  tikaman?: boolean;
}

export type KeadaanTangkis = 'tidak' | 'pas' | 'biasa';

/** Sasaran kunci ringan: cukup posisinya. */
export interface Sasaran {
  posisi: THREE.Vector3;
}

/** Sasaran Sergap: perlu arah hadapnya (pemain menempel di belakangnya) dan cara menamatkannya. */
export interface SasaranSergap extends Sasaran {
  hadap: number;
  disergap(): void;
  sadar(): void;
}

const WARNA_BADAN = new THREE.Color(0xc8402c);
const WARNA_TANGKIS = new THREE.Color(0x4aa3ff);
const WARNA_BERAT = new THREE.Color(0xffa030);
const WARNA_KENA = new THREE.Color(0xffffff);
const WARNA_TERTANGKIS = new THREE.Color(0x9ad0ff);

function halus(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Pertarungan pemain: serangan ringan (kombo 3), serangan berat (tahan klik kiri),
 * tangkis (klik kanan), dan hindar (Ctrl atau klik tengah). Menghasilkan perintah gerak
 * untuk `Pemain` dan menggerakkan kapsul serta keris karena belum ada animasi.
 */
export class PertarunganPemain {
  status: StatusAksi = 'bebas';
  readonly nyawa = new Nyawa(K.nyawa);
  /** Pencari lawan terdekat untuk kunci ringan; dipasang oleh main. */
  pencariSasaran: ((pos: THREE.Vector3, maks: number) => Sasaran | null) | null = null;
  /** Lawan yang sedang dikunci (menghadap otomatis), untuk penanda HUD. */
  sasaranTerkunci: Sasaran | null = null;
  /** Pencari lawan terhuyung terdekat untuk Tikaman Keris; dipasang oleh main. */
  pencariTerhuyung: ((pos: THREE.Vector3, maks: number) => Sasaran | null) | null = null;
  /** Dipanggil saat Tikaman Keris keluar; `pertama` benar pada tikaman pertama. */
  saatTikaman: ((pertama: boolean) => void) | null = null;
  /** Pencari lawan lengah yang bisa disergap dari belakang; dipasang oleh main. */
  pencariSergap: ((pos: THREE.Vector3) => SasaranSergap | null) | null = null;
  /** Dipanggil saat Sergap menamatkan sasaran (akhir lesatan). */
  saatSergap: ((sasaran: SasaranSergap) => void) | null = null;
  /** Dipanggil sekali saat pemain gugur. */
  saatMati: (() => void) | null = null;
  /** Sisa efek Tikaman Keris, dihitung dalam waktu nyata: permainan melambat, kamera mendekat. */
  sisaLambat = 0;
  sisaKameraDekat = 0;
  /** Efek kamera jurus yang sedang berjalan: lama, jarak mendekat, dan penurunan (Tikaman atau Sergap). */
  private lamaKameraDekat = 1;
  private jumlahMendekat = 0;
  private jumlahMerendah = 0;
  private sasaranTikaman: Sasaran | null = null;
  private jumlahTikaman = 0;
  /** Sasaran Sergap yang sedang memenuhi syarat (untuk petunjuk HUD), dan yang sedang disergap. */
  sasaranSergap: SasaranSergap | null = null;
  private sasaranSergapAktif: SasaranSergap | null = null;
  /** Sasaran yang syaratnya baru saja batal, dan sudah berapa lama (jendela batal Sergap). */
  private sasaranSergapBatal: SasaranSergap | null = null;
  private sejakSergapBatal = 99;
  /** Detik sejak masuk status sekarang. */
  private waktu = 0;
  /** Pukulan ke berapa dalam kombo (0 sampai maksKombo - 1). */
  private kombo = 0;
  private sejakSeranganTerakhir = 99;
  private komboHabis = false;
  private seranganTertunda = false;
  private seranganSudahKeluar = false;
  private seranganSiap: Serangan | null = null;
  private hadapAksi = 0;
  private lamaJatuh = 1;
  private readonly arahHindar = new THREE.Vector3();
  private readonly dorongan = new THREE.Vector3();
  private readonly doronganLuar = new THREE.Vector3();
  private sisaDoronganLuar = 0;
  private readonly perintah: PerintahGerak = { ...PERINTAH_BEBAS };

  private readonly keris = new THREE.Group();
  private readonly bahan: THREE.MeshStandardMaterial;
  private sisaKilat = 0;
  private readonly warnaKilat = new THREE.Color();

  constructor(private pemain: Pemain) {
    this.bahan = pemain.kapsul.material;

    // Keris: balok tipis di sisi kanan kapsul. Pivot di hulu, bilah menjulur ke +z.
    const bilah = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.05, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x55585e, metalness: 0.6, roughness: 0.35 }),
    );
    bilah.position.z = 0.3;
    bilah.castShadow = true;
    const hulu = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x8a5a2a, roughness: 0.8 }),
    );
    this.keris.add(bilah, hulu);
    this.keris.position.set(JARI_PEMAIN + 0.08, 1.0, 0.05);
    this.keris.rotation.set(0.5, 0, 0);
    pemain.pose.add(this.keris);
  }

  get mati(): boolean {
    return this.status === 'mati';
  }

  /** Hidupkan kembali di tempat pemain berada sekarang. */
  hidupkan(): void {
    this.nyawa.pulihkan();
    this.kombo = 0;
    this.komboHabis = false;
    this.seranganTertunda = false;
    this.seranganSiap = null;
    this.sasaranTerkunci = null;
    this.sasaranTikaman = null;
    this.sasaranSergap = null;
    this.sasaranSergapAktif = null;
    this.sasaranSergapBatal = null;
    this.sisaKilat = 0;
    this.sisaDoronganLuar = 0;
    this.sisaLambat = 0;
    this.sisaKameraDekat = 0;
    this.masuk('bebas');
  }

  /** Benar saat pemain sedang mengayun keris atau baru saja mengayun (satu detik terakhir); percakapan penghadang ditunda. */
  get sedangMenyerang(): boolean {
    const s = this.status;
    return s === 'mengisi' || s === 'serangRingan' || s === 'serangBerat' || s === 'tikaman' || s === 'sergap' || this.sejakSeranganTerakhir < 1.0;
  }

  /** Benar saat pemain tidak bisa dilukai: awal hindar, atau sepanjang Tikaman Keris. Sergap TIDAK kebal. */
  get kebal(): boolean {
    if (this.status === 'tikaman') return true;
    return this.status === 'hindar' && this.waktu < K.hindar.kebal;
  }

  /** Benar selama Sergap berjalan (lesat dan tusukan); penjaga lain yang melihatnya langsung mengejar. */
  get sedangMenyergap(): boolean {
    return this.status === 'sergap';
  }

  /** Benar saat keris Sergap sudah masuk: suaranya (radius kecil) terdengar penjaga lain; sasaran sendiri sudah mati. */
  get kerisSergapBerbunyi(): boolean {
    return this.status === 'sergap' && this.seranganSudahKeluar;
  }

  /** Posisi sasaran yang baru ditamatkan, untuk uji saksi selama sisa Sergap; null sebelum keris masuk atau di luar Sergap. */
  get posisiSasaranSergap(): THREE.Vector3 | null {
    return this.kerisSergapBerbunyi && this.sasaranSergapAktif ? this.sasaranSergapAktif.posisi : null;
  }

  /** Pengali kecepatan waktu permainan; di bawah 1 sesaat setelah Tikaman Keris mengenai. */
  get skalaWaktu(): number {
    return this.sisaLambat > 0 ? K.tikaman.skalaLambat : 1;
  }

  /** 0 sampai 1: kurva efek kamera jurus (naik lalu turun) selama `lamaKameraDekat`. */
  get faktorKameraDekat(): number {
    if (this.sisaKameraDekat <= 0) return 0;
    const t = 1 - this.sisaKameraDekat / this.lamaKameraDekat;
    return Math.sin(Math.PI * t);
  }

  /** Meter kamera mendekat sekarang (Tikaman Keris atau Sergap). */
  get kameraMendekat(): number {
    return this.jumlahMendekat * this.faktorKameraDekat;
  }

  /** Meter kamera merendah sekarang (Sergap). */
  get kameraMerendah(): number {
    return this.jumlahMerendah * this.faktorKameraDekat;
  }

  private mulaiEfekKamera(lama: number, mendekat: number, merendah: number): void {
    this.sisaKameraDekat = lama;
    this.lamaKameraDekat = lama;
    this.jumlahMendekat = mendekat;
    this.jumlahMerendah = merendah;
  }

  /** Dipanggil tiap frame dengan waktu nyata (sebelum diperlambat). */
  perbaruiEfek(dtNyata: number): void {
    this.sisaLambat = Math.max(0, this.sisaLambat - dtNyata);
    this.sisaKameraDekat = Math.max(0, this.sisaKameraDekat - dtNyata);
  }

  /** Keadaan tangkis saat ini: 'pas' pada jendela awal, 'biasa' sesudahnya. */
  keadaanTangkis(): KeadaanTangkis {
    if (this.status !== 'tangkis') return 'tidak';
    return this.waktu < K.tangkis.jendelaPas ? 'pas' : 'biasa';
  }

  /** Serangan yang baru saja mengayun pada frame ini, sekali per ayunan. */
  ambilSerangan(): Serangan | null {
    const s = this.seranganSiap;
    this.seranganSiap = null;
    return s;
  }

  /**
   * Pemain terkena serangan dari arah `dari`. `ditangkis` benar kalau serangan tertahan
   * tangkisan biasa: tanpa damage, hanya dorongan kecil.
   */
  terkena(dari: THREE.Vector3, dorong: number, ditangkis: boolean, damage: number): void {
    if (this.mati || this.kebal) return;
    this.pukul(dari, dorong, ditangkis ? WARNA_TERTANGKIS : WARNA_KENA, K.terpukul.kilatan);
    if (ditangkis) return;
    if (this.lukai(damage)) this.masuk('terpukul');
  }

  /** Pemain dijatuhkan (terkaman, serudukan, longsor): rebah selama `lama` detik, tidak bisa berbuat apa-apa. */
  jatuhkan(dari: THREE.Vector3, dorong: number, damage: number, lama: number): void {
    if (this.mati || this.kebal) return;
    this.pukul(dari, dorong, WARNA_KENA, K.terjatuh.kilatan);
    if (this.lukai(damage)) {
      this.lamaJatuh = lama;
      this.masuk('terjatuh');
    }
  }

  /** Dorongan dan kilatan karena terkena; damage diurus `lukai`. */
  private pukul(dari: THREE.Vector3, dorong: number, warna: THREE.Color, kilatan: number): void {
    const pos = this.pemain.posisi;
    const dx = pos.x - dari.x;
    const dz = pos.z - dari.z;
    const d = Math.hypot(dx, dz) || 1;
    this.doronganLuar.set((dx / d) * dorong, 0, (dz / d) * dorong);
    this.sisaDoronganLuar = 0.15;
    this.sisaKilat = kilatan;
    this.warnaKilat.copy(warna);
  }

  /** Mengurangi nyawa; salah kalau pemain gugur karenanya (status mati sudah dimasuki). */
  private lukai(damage: number): boolean {
    catatDamage(this.pemain.posisi, damage, false);
    if (this.nyawa.kurangi(damage)) {
      this.masuk('mati');
      this.saatMati?.();
      return false;
    }
    return true;
  }

  /**
   * Kunci ringan: kalau mouse tidak digerakkan, menghadap lawan terdekat dalam jarak kunci.
   * Mengembalikan arah hadap ke sasaran, atau null kalau tidak ada.
   */
  private kunciSasaran(input: Input): number | null {
    this.sasaranTerkunci = null;
    if (!this.pencariSasaran || input.sejakKameraDigerakkan() < K.kunci.mouseDiam) return null;
    const sasaran = this.pencariSasaran(this.pemain.posisi, K.kunci.jarak);
    if (!sasaran) return null;
    this.sasaranTerkunci = sasaran;
    return sudutKe(this.pemain.posisi, sasaran.posisi);
  }

  private masuk(status: StatusAksi): void {
    this.status = status;
    this.waktu = 0;
    this.seranganSudahKeluar = false;
  }

  /**
   * Tikaman Keris: kalau ada lawan terhuyung di depan pemain dalam jarak tikaman,
   * serangan ringan diganti tikaman. Mengembalikan benar kalau tikaman dimulai.
   */
  private cobaTikaman(): boolean {
    if (!this.pencariTerhuyung || !this.pemain.diTanah) return false;
    const T = K.tikaman;
    const sasaran = this.pencariTerhuyung(this.pemain.posisi, T.jarak);
    if (!sasaran || !menghadap(this.pemain.posisi, this.pemain.hadap, sasaran.posisi, T.sudut)) return false;
    this.sasaranTikaman = sasaran;
    this.sasaranTerkunci = sasaran;
    this.hadapAksi = sudutKe(this.pemain.posisi, sasaran.posisi);
    this.seranganTertunda = false;
    this.masuk('tikaman');
    return true;
  }

  /**
   * Sasaran Sergap tiap frame: lawan lengah terdekat yang pemain jongkok di belakangnya. Kalau syaratnya
   * baru batal (sasaran berbalik atau waspada), sasaran itu diingat sebentar untuk jendela batal.
   */
  private perbaruiSasaranSergap(dt: number): void {
    this.sejakSergapBatal += dt;
    const sebelumnya = this.sasaranSergap;
    const boleh = (this.status === 'bebas' || this.status === 'mengisi') && this.pemain.jongkok && this.pemain.diTanah;
    this.sasaranSergap = boleh && this.pencariSergap ? this.pencariSergap(this.pemain.posisi) : null;
    if (sebelumnya && this.sasaranSergap !== sebelumnya && boleh) {
      this.sasaranSergapBatal = sebelumnya;
      this.sejakSergapBatal = 0;
    }
  }

  /**
   * Sergap: tombol serang saat ada sasaran yang memenuhi syarat. Mengembalikan benar kalau Sergap dimulai.
   * Kalau syaratnya batal kurang dari `jendelaBatal` detik yang lalu, serangan jadi serang ringan biasa
   * dan sasaran itu langsung sadar (penjaga mengejar).
   */
  private cobaSergap(): boolean {
    const S = K.sergap;
    if (this.sasaranSergap) {
      this.sasaranSergapAktif = this.sasaranSergap;
      this.sasaranSergapBatal = null;
      this.hadapAksi = this.sasaranSergap.hadap;
      this.seranganTertunda = false;
      this.masuk('sergap');
      return true;
    }
    if (this.sasaranSergapBatal && this.sejakSergapBatal < S.jendelaBatal) {
      this.sasaranSergapBatal.sadar();
      this.sasaranSergapBatal = null;
    }
    return false;
  }

  private mulaiSerangan(berat: boolean, input: Input, yawKamera: number): void {
    if (!berat && this.cobaTikaman()) return;
    const kunci = this.kunciSasaran(input);
    const arah = arahInputRelatifKamera(input, yawKamera);
    this.hadapAksi = kunci ?? (arah.ada ? Math.atan2(arah.x, arah.z) : this.pemain.hadap);
    this.seranganTertunda = false;
    this.masuk(berat ? 'serangBerat' : 'serangRingan');
  }

  private mulaiTangkis(input: Input): void {
    const kunci = this.kunciSasaran(input);
    if (kunci !== null) this.pemain.hadap = kunci;
    this.masuk('tangkis');
  }

  private mulaiHindar(input: Input, yawKamera: number): void {
    const arah = arahInputRelatifKamera(input, yawKamera);
    if (arah.ada) {
      this.arahHindar.set(arah.x, 0, arah.z);
    } else {
      // Diam: melompat mundur, tetap menghadap depan.
      this.arahHindar.set(-Math.sin(this.pemain.hadap), 0, -Math.cos(this.pemain.hadap));
    }
    this.hadapAksi = this.pemain.hadap;
    this.masuk('hindar');
  }

  /** Dipanggil tiap frame sebelum `pemain.perbarui`. Mengembalikan perintah gerak untuk frame ini. */
  perbarui(dt: number, input: Input, yawKamera: number): Readonly<PerintahGerak> {
    this.waktu += dt;
    if (this.mati) {
      this.susunPerintah();
      this.perbaruiVisual(dt);
      return this.perintah;
    }
    this.sejakSeranganTerakhir += dt;
    if (this.sejakSeranganTerakhir > K.seranganRingan.jedaKombo) {
      this.kombo = 0;
      this.komboHabis = false;
    }

    const mintaHindar = input.aksiBaru('hindar');
    const mintaSerang = input.aksiBaru('serang');
    const tahanTangkis = input.aksiDitekan('tangkis');
    const bisaSerangLagi = !this.komboHabis || this.sejakSeranganTerakhir > K.seranganRingan.pemulihanSetelahKombo;
    this.perbaruiSasaranSergap(dt);

    switch (this.status) {
      case 'bebas':
        if (mintaHindar && this.pemain.diTanah) this.mulaiHindar(input, yawKamera);
        else if (tahanTangkis && this.pemain.diTanah) this.mulaiTangkis(input);
        else if (mintaSerang && bisaSerangLagi && this.pemain.diTanah && !this.cobaSergap()) this.masuk('mengisi');
        break;

      case 'mengisi':
        if (mintaHindar) this.mulaiHindar(input, yawKamera);
        else if (tahanTangkis) this.mulaiTangkis(input);
        else if (input.aksiLepas('serang')) this.mulaiSerangan(false, input, yawKamera);
        else if (this.waktu >= K.seranganBerat.tahan) this.mulaiSerangan(true, input, yawKamera);
        break;

      case 'serangRingan': {
        const r = K.seranganRingan;
        if (mintaSerang) this.seranganTertunda = true;
        this.keluarkanSerangan(r.jendelaKena, false);
        const lewatJendela = this.waktu >= r.jendelaKena[1];
        if (mintaHindar && lewatJendela) {
          this.selesaiSerangan();
          this.mulaiHindar(input, yawKamera);
        } else if (this.waktu >= r.durasi) {
          this.selesaiSerangan();
          if (this.seranganTertunda && !this.komboHabis) {
            this.kombo += 1;
            this.mulaiSerangan(false, input, yawKamera);
          }
        }
        break;
      }

      case 'serangBerat': {
        const b = K.seranganBerat;
        this.keluarkanSerangan(b.jendelaKena, true);
        if (mintaHindar && this.waktu >= b.jendelaKena[1]) {
          this.selesaiSerangan();
          this.mulaiHindar(input, yawKamera);
        } else if (this.waktu >= b.durasi) {
          this.selesaiSerangan();
        }
        break;
      }

      case 'tangkis':
        if (mintaHindar) this.mulaiHindar(input, yawKamera);
        else if (mintaSerang && this.cobaTikaman()) break; // klik kiri saat menangkis: tikam lawan yang terhuyung
        else if (!tahanTangkis) this.masuk('bebas');
        break;

      case 'tikaman': {
        const T = K.tikaman;
        // Tusukan keluar di akhir lesatan, sekali, hanya ke sasaran tikaman.
        if (!this.seranganSudahKeluar && this.waktu >= T.lesat) {
          this.seranganSudahKeluar = true;
          this.seranganSiap = {
            damage: T.damage,
            jangkauan: T.jangkauanKena,
            sudutKena: 180,
            dorong: T.dorong,
            berat: true,
            sasaran: this.sasaranTikaman,
            tikaman: true,
          };
          this.jumlahTikaman += 1;
          this.sisaLambat = T.lamaLambat;
          this.mulaiEfekKamera(T.lamaKamera, T.kameraMendekat, 0);
          this.saatTikaman?.(this.jumlahTikaman === 1);
        }
        // Tidak bisa diputus: hindar dan tangkis diabaikan sampai selesai.
        if (this.waktu >= T.durasi) {
          this.sejakSeranganTerakhir = 0;
          this.kombo = 0;
          this.komboHabis = false;
          this.sasaranTikaman = null;
          this.masuk('bebas');
        }
        break;
      }

      case 'sergap': {
        const S = K.sergap;
        // Di akhir lesatan keris masuk: sasaran mati seketika. Sesudahnya pemain terkunci (tidak kebal).
        if (!this.seranganSudahKeluar && this.waktu >= S.lesat && this.sasaranSergapAktif) {
          this.seranganSudahKeluar = true;
          this.sasaranSergapAktif.disergap();
          this.mulaiEfekKamera(S.lamaKamera, S.kameraMendekat, S.kameraMerendah);
          this.saatSergap?.(this.sasaranSergapAktif);
        }
        if (this.waktu >= S.lesat + S.durasi) {
          this.sejakSeranganTerakhir = 0;
          this.kombo = 0;
          this.komboHabis = false;
          this.sasaranSergapAktif = null;
          this.masuk('bebas');
        }
        break;
      }

      case 'hindar':
        if (this.waktu >= K.hindar.durasi) this.masuk('bebas');
        break;

      case 'terpukul':
        if (this.waktu >= K.terpukul.durasi) this.masuk('bebas');
        break;

      case 'terjatuh':
        if (this.waktu >= this.lamaJatuh) this.masuk('bebas');
        break;

      case 'mati':
        break;
    }

    this.susunPerintah();
    this.perbaruiVisual(dt);
    return this.perintah;
  }

  /** Mengeluarkan serangan sekali saat ayunan memasuki jendela kena. */
  private keluarkanSerangan(jendela: number[], berat: boolean): void {
    if (this.seranganSudahKeluar || this.waktu < jendela[0]) return;
    this.seranganSudahKeluar = true;
    this.seranganSiap = {
      damage: berat ? K.keris.damageBerat : K.keris.damageRingan,
      jangkauan: K.keris.jangkauan,
      sudutKena: K.keris.sudutKena,
      dorong: berat ? K.keris.dorongBerat : K.keris.dorongRingan,
      berat,
    };
  }

  private selesaiSerangan(): void {
    this.sejakSeranganTerakhir = 0;
    if (this.status === 'serangBerat' || this.kombo >= K.seranganRingan.maksKombo - 1) {
      this.komboHabis = true;
      this.kombo = 0;
    }
    this.masuk('bebas');
  }

  private susunPerintah(): void {
    const p = this.perintah;
    p.kunciGerak = false;
    p.pengaliKecepatan = 1;
    p.dorongan = null;
    p.hadapPaksa = null;
    p.bolehLompat = true;
    const hadapX = Math.sin(this.hadapAksi);
    const hadapZ = Math.cos(this.hadapAksi);

    switch (this.status) {
      case 'mengisi':
        p.pengaliKecepatan = 0.6;
        p.bolehLompat = false;
        break;
      case 'serangRingan': {
        const r = K.seranganRingan;
        p.kunciGerak = true;
        p.bolehLompat = false;
        p.hadapPaksa = this.hadapAksi;
        // Melangkah maju kecil di awal pukulan.
        const lamaMaju = r.jendelaKena[0];
        if (this.waktu < lamaMaju) {
          const laju = r.majuPerPukulan / lamaMaju;
          p.dorongan = this.dorongan.set(hadapX * laju, 0, hadapZ * laju);
        }
        break;
      }
      case 'serangBerat': {
        const b = K.seranganBerat;
        p.kunciGerak = true;
        p.bolehLompat = false;
        p.hadapPaksa = this.hadapAksi;
        const mulai = b.jendelaKena[0] - 0.1;
        const selesai = b.jendelaKena[0] + 0.05;
        if (this.waktu >= mulai && this.waktu < selesai) {
          const laju = b.maju / (selesai - mulai);
          p.dorongan = this.dorongan.set(hadapX * laju, 0, hadapZ * laju);
        } else {
          p.dorongan = this.dorongan.set(0, 0, 0);
        }
        break;
      }
      case 'tangkis':
        p.pengaliKecepatan = K.tangkis.pengaliKecepatan;
        p.bolehLompat = false;
        p.hadapPaksa = this.sasaranTerkunci
          ? sudutKe(this.pemain.posisi, this.sasaranTerkunci.posisi)
          : this.pemain.hadap;
        break;
      case 'hindar': {
        const h = K.hindar;
        p.kunciGerak = true;
        p.bolehLompat = false;
        p.hadapPaksa = this.hadapAksi;
        // Cepat di awal, melambat di akhir; luas di bawah kurva = jarak hindar.
        const t = Math.min(1, this.waktu / h.durasi);
        const laju = (2 * h.jarak / h.durasi) * (1 - t);
        p.dorongan = this.dorongan.copy(this.arahHindar).multiplyScalar(laju);
        break;
      }
      case 'tikaman': {
        const T = K.tikaman;
        p.kunciGerak = true;
        p.bolehLompat = false;
        p.hadapPaksa = this.hadapAksi;
        // Melesat ke sasaran sampai berjarak `jarakHenti`, tepat selesai pada akhir lesatan.
        if (this.waktu < T.lesat && this.sasaranTikaman) {
          const s = this.sasaranTikaman.posisi;
          const pos = this.pemain.posisi;
          const dx = s.x - pos.x;
          const dz = s.z - pos.z;
          const d = Math.hypot(dx, dz) || 1e-6;
          const sisa = Math.max(0, d - T.jarakHenti);
          const laju = sisa / Math.max(T.lesat - this.waktu, 0.016);
          p.dorongan = this.dorongan.set((dx / d) * laju, 0, (dz / d) * laju);
        } else {
          p.dorongan = this.dorongan.set(0, 0, 0);
        }
        break;
      }
      case 'sergap': {
        const S = K.sergap;
        p.kunciGerak = true;
        p.bolehLompat = false;
        p.hadapPaksa = this.hadapAksi;
        // Melesat ke titik `jarakHenti` di belakang sasaran (searah hadapnya), tepat selesai di akhir lesatan.
        const s = this.sasaranSergapAktif;
        if (this.waktu < S.lesat && s) {
          const tx = s.posisi.x - Math.sin(s.hadap) * S.jarakHenti;
          const tz = s.posisi.z - Math.cos(s.hadap) * S.jarakHenti;
          const pos = this.pemain.posisi;
          const dx = tx - pos.x;
          const dz = tz - pos.z;
          const d = Math.hypot(dx, dz);
          const laju = d / Math.max(S.lesat - this.waktu, 0.016);
          p.dorongan = d > 1e-4 ? this.dorongan.set((dx / d) * laju, 0, (dz / d) * laju) : this.dorongan.set(0, 0, 0);
        } else {
          p.dorongan = this.dorongan.set(0, 0, 0);
        }
        break;
      }
      case 'terpukul':
      case 'terjatuh':
      case 'mati':
        p.kunciGerak = true;
        p.bolehLompat = false;
        break;
    }

    // Dorongan dari luar (terkena serangan) menimpa gerak sendiri sebentar.
    if (this.sisaDoronganLuar > 0) {
      p.dorongan = this.dorongan.copy(this.doronganLuar).multiplyScalar(1 / 0.15);
    }
  }

  private perbaruiVisual(dt: number): void {
    const pose = this.pemain.pose;
    const keris = this.keris;
    let condong = 0;
    let miringSamping = 0;
    let turun = 0;
    let skalaY = 1;
    let kerisX = 0.5;
    let kerisY = 0;
    let kerisMaju = 0.05;
    const warna = WARNA_BADAN;
    let sinar = 0;
    const sinarWarna = new THREE.Color(0, 0, 0);
    let langsung = false;

    switch (this.status) {
      case 'mengisi': {
        const t = halus(this.waktu / K.seranganBerat.tahan);
        condong = -0.12 * t;
        kerisX = lerp(0.5, -1.6, t); // keris diangkat ke atas
        sinar = 0.6 * t;
        sinarWarna.copy(WARNA_BERAT);
        break;
      }
      case 'serangRingan': {
        const r = K.seranganRingan;
        const t = this.waktu / r.durasi;
        condong = Math.sin(Math.PI * Math.min(1, t)) * 0.35;
        const ayun = halus((this.waktu - 0.02) / (r.jendelaKena[1] + 0.06));
        if (this.kombo === 0) kerisY = lerp(1.1, -1.0, ayun);
        else if (this.kombo === 1) kerisY = lerp(-1.1, 1.0, ayun);
        else { kerisY = 0; kerisX = 0.1; kerisMaju = lerp(0.05, 0.55, Math.sin(Math.PI * ayun)); }
        langsung = true;
        break;
      }
      case 'serangBerat': {
        const b = K.seranganBerat;
        const tAngkat = halus(this.waktu / (b.jendelaKena[0] - 0.08));
        const tTebas = halus((this.waktu - (b.jendelaKena[0] - 0.08)) / 0.14);
        const tPulih = halus((this.waktu - b.jendelaKena[1]) / (b.durasi - b.jendelaKena[1]));
        condong = lerp(lerp(-0.15, 0.55, tTebas), 0, tPulih);
        kerisX = lerp(lerp(lerp(0.5, -1.7, tAngkat), 1.1, tTebas), 0.5, tPulih);
        sinar = (1 - tTebas) * 0.6;
        sinarWarna.copy(WARNA_BERAT);
        langsung = true;
        break;
      }
      case 'tangkis': {
        condong = -0.12;
        kerisX = -0.6;
        kerisY = -0.9;
        const pas = this.keadaanTangkis() === 'pas';
        sinar = pas ? 1.4 : 0.6;
        sinarWarna.copy(WARNA_TANGKIS);
        break;
      }
      case 'hindar': {
        const t = this.waktu / K.hindar.durasi;
        const lengkung = Math.sin(Math.PI * Math.min(1, t));
        turun = -0.35 * lengkung;
        skalaY = 1 - 0.25 * lengkung;
        // Condong ke arah luncuran relatif terhadap hadap.
        const maju = this.arahHindar.x * Math.sin(this.hadapAksi) + this.arahHindar.z * Math.cos(this.hadapAksi);
        const samping = this.arahHindar.x * Math.cos(this.hadapAksi) - this.arahHindar.z * Math.sin(this.hadapAksi);
        condong = 0.45 * maju * lengkung;
        miringSamping = -0.45 * samping * lengkung;
        langsung = true;
        break;
      }
      case 'tikaman': {
        const T = K.tikaman;
        // Merunduk saat melesat, lalu condong jauh ke depan dengan keris menusuk lurus.
        const tLesat = halus(this.waktu / T.lesat);
        const tTusuk = halus((this.waktu - T.lesat) / 0.08);
        condong = lerp(0.2, 0.6, tTusuk);
        turun = -0.12 * tLesat;
        kerisX = 0.1;
        kerisY = 0;
        kerisMaju = lerp(0.05, 0.75, tTusuk);
        sinar = 0.5 * tTusuk;
        sinarWarna.copy(WARNA_KENA);
        langsung = true;
        break;
      }
      case 'sergap': {
        const S = K.sergap;
        // Merunduk rendah saat melesat, lalu menempel condong ke depan dengan keris masuk dan ditahan.
        const tLesat = halus(this.waktu / S.lesat);
        const tTusuk = halus((this.waktu - S.lesat) / 0.12);
        const tTarik = halus((this.waktu - S.lesat - S.durasi * 0.75) / (S.durasi * 0.25));
        condong = lerp(0.25, 0.45, tTusuk) * (1 - 0.5 * tTarik);
        turun = -0.15 * tLesat;
        kerisX = 0.1;
        kerisY = 0;
        kerisMaju = lerp(0.05, 0.6, tTusuk) * (1 - tTarik) + 0.05 * tTarik;
        sinar = 0.3 * tTusuk * (1 - tTarik);
        sinarWarna.copy(WARNA_KENA);
        langsung = true;
        break;
      }
      case 'terpukul':
        condong = -0.25 * (1 - this.waktu / K.terpukul.durasi);
        break;
      case 'terjatuh': {
        // Rebah ke belakang, lalu bangun di bagian akhir.
        const mulaiBangun = this.lamaJatuh * (1 - K.terjatuh.bagianBangun);
        const bangun = halus((this.waktu - mulaiBangun) / (this.lamaJatuh - mulaiBangun));
        condong = -1.1 * (1 - bangun);
        turun = -0.25 * (1 - bangun);
        break;
      }
      case 'mati':
        // Rebah ke belakang perlahan.
        condong = -1.4;
        turun = -0.15;
        break;
    }

    const laju = langsung ? 1 : this.status === 'mati' ? Math.min(1, 4 * dt) : Math.min(1, 14 * dt);
    skalaY *= this.pemain.skalaBadan; // kapsul memendek saat berjongkok
    pose.rotation.x += (condong - pose.rotation.x) * laju;
    pose.rotation.z += (miringSamping - pose.rotation.z) * laju;
    pose.position.y += (turun - pose.position.y) * laju;
    pose.scale.y += (skalaY - pose.scale.y) * laju;
    keris.rotation.x += (kerisX - keris.rotation.x) * laju;
    keris.rotation.y += (kerisY - keris.rotation.y) * laju;
    keris.position.z += (kerisMaju - keris.position.z) * laju;

    // Warna: kilatan terkena menimpa sinar aksi.
    this.bahan.color.copy(warna);
    if (this.sisaKilat > 0) {
      this.sisaKilat -= dt;
      this.bahan.emissive.copy(this.warnaKilat);
      this.bahan.emissiveIntensity = 1.5;
    } else {
      this.bahan.emissive.copy(sinarWarna);
      this.bahan.emissiveIntensity = sinar;
    }
    if (this.sisaDoronganLuar > 0) this.sisaDoronganLuar -= dt;
  }
}
