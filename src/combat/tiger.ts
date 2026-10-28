import * as THREE from 'three';
import type { Pemain } from '../character/player';
import { JARI_PEMAIN } from '../character/player';
import type { Pengikut } from '../character/follower';
import type { Semak } from '../stealth/bush';
import { tinggiLantai, dorongKeluar, type DataTabrakan } from '../world/collision';
import { KONFIG } from './config';
import { Lawan, JARI_LAWAN, type PemberiGiliran, type StatusLawan } from './enemy';
import { menghadap, sudutKe } from './hit';
import type { PertarunganPemain, Serangan } from './player-combat';

const H = KONFIG.harimau;
const WARNA = new THREE.Color(0xb8641e); // jingga tua
const WARNA_LORENG = 0x2b1a10;
const WARNA_ISYARAT = new THREE.Color(0xffd23a);
const WARNA_TERHUYUNG = new THREE.Color(0x4aa3ff);
const WARNA_KENA = new THREE.Color(0xffffff);
const JARI_BADAN = 0.42;
const JARAK_SAMPAI = 0.6;

/** Tutupan tempat harimau bersembunyi saat mengintai: semak atau pohon. */
interface Tutupan {
  x: number;
  z: number;
  jari: number;
}

/** Sasaran terkaman: pemain, atau seorang pengikut (yang paling belakang saat pemain memegang obor). */
interface Sasaran {
  posisi: THREE.Vector3;
  pengikut: Pengikut | null;
}

/** Hal di luar harimau yang dibutuhkannya: tutupan, pengikut, obor, dan laporan ke kejadian. */
export interface KonteksHarimau {
  /** Pengikut yang boleh diterkam (aktif, bukan Gajah Pagon). */
  pengikut: () => Pengikut[];
  oborMenyala: () => boolean;
  semak: readonly Semak[];
  /** Dipanggil saat menggeram dari balik tutupan. */
  saatGeram: (posisi: THREE.Vector3) => void;
  /** Terkaman mengenai pengikut: harimau menahannya sampai ditolong atau waktunya habis. */
  saatMenangkapPengikut: (p: Pengikut) => void;
  /** Waktu menolong habis: pengikut dibawa lari. */
  saatMembawaPengikut: (p: Pengikut) => void;
}

/**
 * Harimau jawa (sprint 7): kapsul rendah memanjang berloreng. Mengintai dari balik tutupan
 * 10-15 m sambil menggeram, mengelilingi 6 m, bersiap (merunduk, gemetar), menerkam 5 m dalam
 * 0,3 detik. Dua kali kena: mundur 20 m dan kembali 8 detik kemudian. Bekal yang dilempar
 * membuatnya makan lalu pergi selamanya. Obor menyala: menjaga jarak dan mengincar pengikut
 * paling belakang. Tidak memakai antrean giliran: ia satu-satunya penyerang di kejadiannya.
 */
export class Harimau extends Lawan {
  declare private kepala: THREE.Group;
  private readonly sasaran: Sasaran = { posisi: new THREE.Vector3(), pengikut: null };
  private tutupan: Tutupan | null = null;
  private tutupanTerakhir: Tutupan | null = null;
  private sisaDiTutupan = 0;
  private sisaGeram = 0;
  private lamaIntai = H.mengintai.lama;
  private arahPutar = 1;
  private sisaKeliling = 0;
  private readonly arahTerkam = new THREE.Vector3();
  private terkamKena = false;
  private kenaSejakMundur = 0;
  private readonly titikTuju = new THREE.Vector3();
  private makanan: THREE.Vector3 | null = null;
  private sisaMakan = 0;
  private pengikutTertangkap: Pengikut | null = null;
  private sudahPergi = false;
  private readonly sementara = new THREE.Vector3();

  constructor(
    data: DataTabrakan,
    x: number,
    z: number,
    private readonly konteks: KonteksHarimau,
  ) {
    super(data, x, z);
    this.masuk('mengintai');
  }

  protected override bangunBadan(): THREE.MeshStandardMaterial {
    const bahan = new THREE.MeshStandardMaterial({ color: WARNA, roughness: 0.85 });
    // Tubuh: kapsul rebah sepanjang sumbu z, 0,9 m tinggi, 2 m panjang.
    const tubuh = new THREE.Mesh(new THREE.CapsuleGeometry(JARI_BADAN, 2.0 - 2 * JARI_BADAN, 4, 10), bahan);
    tubuh.rotation.x = Math.PI / 2;
    tubuh.position.y = JARI_BADAN + 0.05;
    tubuh.castShadow = true;
    this.badan.add(tubuh);
    // Loreng: balok gelap tipis melintang punggung.
    const bahanLoreng = new THREE.MeshStandardMaterial({ color: WARNA_LORENG, roughness: 1 });
    for (let i = -2; i <= 2; i++) {
      const loreng = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 0.12), bahanLoreng);
      loreng.position.set(0, 0.84, i * 0.3);
      this.badan.add(loreng);
    }
    // Kepala di depan dengan telinga dan mata berpendar; ekor di belakang.
    this.kepala = new THREE.Group();
    const muka = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.34, 0.4), bahan);
    muka.castShadow = true;
    const bahanMata = new THREE.MeshStandardMaterial({ color: 0xd8ff60, emissive: 0xc8ff40, emissiveIntensity: 1.2 });
    for (const s of [-1, 1]) {
      const telinga = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.08), bahanLoreng);
      telinga.position.set(s * 0.15, 0.22, -0.05);
      const mata = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.03), bahanMata);
      mata.position.set(s * 0.11, 0.05, 0.21);
      this.kepala.add(telinga, mata);
    }
    this.kepala.add(muka);
    this.kepala.position.set(0, 0.7, 1.05);
    this.badan.add(this.kepala);
    const ekor = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.75), bahanLoreng);
    ekor.position.set(0, 0.7, -1.3);
    ekor.rotation.x = -0.35;
    this.badan.add(ekor);
    return bahan;
  }

  override hidupkan(): void {
    super.hidupkan();
    if (this.konteks) this.masuk('mengintai');
  }

  protected override nyawaMaks(): number {
    return H.nyawa;
  }

  /** Harimau tidak dibangunkan kawan: ia mengintai sendiri. */
  override waspada(): void {}

  override get menembus(): boolean {
    return this.status === 'menerkam';
  }

  /** Benar setelah pergi selamanya atau mati dan hilang: pengelola kejadian membuangnya. */
  get selesai(): boolean {
    return this.sudahPergi || (this.status === 'mati' && this.waktu >= H.hilangSetelahMati);
  }

  /** Benar kalau bekal yang dilempar akan dihiraukan (tidak saat menerkam, mati, atau sudah pergi). */
  get bisaDiberiBekal(): boolean {
    return this.hidup && this.status !== 'pergi' && this.status !== 'makan' && this.status !== 'menerkam';
  }

  /** Bekal dilempar ke `posisi`: harimau melepaskan apa pun yang dipegangnya dan pergi makan. */
  lemparBekal(posisi: THREE.Vector3): void {
    if (!this.bisaDiberiBekal) return;
    this.lepaskanPengikut();
    this.makanan = posisi.clone();
    this.sisaMakan = H.bekal.makan;
    this.masuk('makan');
  }

  protected override masuk(status: StatusLawan): void {
    super.masuk(status);
    switch (status) {
      case 'mengintai':
        this.tutupan = null;
        this.sisaDiTutupan = 0;
        this.sisaGeram = acak(H.mengintai.geramMin, H.mengintai.geramMaks) * 0.5;
        break;
      case 'mengelilingi':
        this.arahPutar = Math.random() < 0.5 ? 1 : -1;
        this.sisaKeliling = acak(H.mengelilingi.lamaMin, H.mengelilingi.lamaMaks);
        break;
      case 'menerkam':
        this.terkamKena = false;
        break;
    }
  }

  override terkena(serangan: Serangan, dari: THREE.Vector3): void {
    if (!this.hidup) return;
    const sebelum = this.status;
    super.terkena(serangan, dari);
    if (!this.hidup) {
      this.lepaskanPengikut();
      return;
    }
    if (sebelum === 'menyeret') {
      // Ditolong: pengikut dilepas, harimau mundur.
      this.lepaskanPengikut();
      this.kenaSejakMundur = 0;
      this.masuk('mundur');
      return;
    }
    if (sebelum === 'makan' || sebelum === 'mengintai' || sebelum === 'pergi') {
      this.makanan = null;
      this.kenaSejakMundur = 1;
      if (this.status !== 'terhuyung') this.masuk('mengelilingi');
      return;
    }
    this.kenaSejakMundur += 1;
    if (this.kenaSejakMundur >= H.mundur.setelahKena && this.status !== 'terhuyung') {
      this.kenaSejakMundur = 0;
      this.masuk('mundur');
    }
  }

  override perbarui(dt: number, pemain: Pemain, tarung: PertarunganPemain, _giliran: PemberiGiliran): void {
    this.waktu += dt;
    if (this.status === 'mati') {
      this.perbaruiMati(dt);
      return;
    }
    if (this.sudahPergi) return;
    const posPemain = pemain.posisi;
    const jarakPemain = Math.hypot(posPemain.x - this.posisi.x, posPemain.z - this.posisi.z);
    const obor = this.konteks.oborMenyala();
    this.perbaruiSasaran(pemain, obor);

    switch (this.status) {
      case 'mengintai':
        this.perbaruiMengintai(dt, pemain, jarakPemain);
        break;
      case 'mengelilingi':
        this.perbaruiMengelilingi(dt, pemain, obor);
        break;
      case 'bersiap':
        if (obor && (this.sasaran.pengikut === null || jarakKe(posPemain, this.sasaran.posisi) < H.obor.jarakMin)) {
          this.masuk('mengelilingi');
          break;
        }
        this.hadap = Math.atan2(this.arahTerkam.x, this.arahTerkam.z);
        if (this.waktu >= H.bersiap) this.masuk('menerkam');
        break;
      case 'menerkam':
        this.perbaruiMenerkam(dt, pemain, tarung);
        break;
      case 'jeda':
        this.putarKe(sudutKe(this.posisi, this.sasaran.posisi), dt);
        if (this.waktu >= H.terkam.jeda) this.masuk('mengelilingi');
        break;
      case 'terhuyung':
        if (this.waktu >= H.terhuyung) {
          if (this.kenaSejakMundur >= H.mundur.setelahKena) {
            this.kenaSejakMundur = 0;
            this.masuk('mundur');
          } else this.masuk('mengelilingi');
        }
        break;
      case 'mundur':
        this.perbaruiMundur(dt, pemain, jarakPemain);
        break;
      case 'menyeret':
        this.perbaruiMenyeret(dt, pemain);
        break;
      case 'makan':
        this.perbaruiMakan(dt, pemain);
        break;
      case 'pergi':
        this.perbaruiPergi(dt);
        break;
      default:
        this.masuk('mengintai');
    }

    // Obor menyala: menjauh dari pemain kalau terlalu dekat, kecuali saat melesat atau terhuyung.
    if (obor && jarakPemain < H.obor.jarakMin && this.status !== 'menerkam' && this.status !== 'terhuyung') {
      const d = jarakPemain || 1;
      this.posisi.x += ((this.posisi.x - posPemain.x) / d) * H.obor.kecepatanMenjauh * dt;
      this.posisi.z += ((this.posisi.z - posPemain.z) / d) * H.obor.kecepatanMenjauh * dt;
    }
    if (this.sisaDoronganKena > 0) {
      this.sisaDoronganKena -= dt;
      this.posisi.x += this.doronganKena.x * dt;
      this.posisi.z += this.doronganKena.z * dt;
    }
    dorongKeluar(this.data, this.posisi, JARI_LAWAN);
    this.posisi.y = tinggiLantai(this.data, this.posisi.x, this.posisi.z, this.posisi.y + 0.5);
    this.perbaruiVisual(dt);
  }

  // --- Sasaran ----------------------------------------------------------------------------

  /** Pemain, atau pengikut paling belakang (terjauh dari pemain) saat obor menyala. */
  private perbaruiSasaran(pemain: Pemain, obor: boolean): void {
    const s = this.sasaran;
    if (this.status === 'menyeret' && this.pengikutTertangkap) {
      s.pengikut = this.pengikutTertangkap;
      s.posisi.copy(this.pengikutTertangkap.posisi);
      return;
    }
    // Sasaran dikunci selama bersiap dan menerkam.
    const terkunci = this.status === 'bersiap' || this.status === 'menerkam';
    if (!terkunci) {
      s.pengikut = null;
      if (obor) {
        let terjauh = 0;
        for (const p of this.konteks.pengikut()) {
          const d = jarakKe(p.posisi, pemain.posisi);
          if (d > terjauh) {
            terjauh = d;
            s.pengikut = p;
          }
        }
      }
    }
    if (s.pengikut && !s.pengikut.aktif) s.pengikut = null;
    s.posisi.copy(s.pengikut ? s.pengikut.posisi : pemain.posisi);
  }

  // --- Mengintai --------------------------------------------------------------------------

  private perbaruiMengintai(dt: number, pemain: Pemain, jarakPemain: number): void {
    const M = H.mengintai;
    if (jarakPemain < M.jarakTerpergok || this.waktu >= this.lamaIntai) {
      this.lamaIntai = M.lama;
      this.masuk('mengelilingi');
      return;
    }
    this.sisaGeram -= dt;
    if (this.sisaGeram <= 0) {
      this.sisaGeram = acak(M.geramMin, M.geramMaks);
      this.konteks.saatGeram(this.posisi);
    }
    if (!this.tutupan) this.pilihTutupan(pemain);
    const t = this.tutupan;
    if (!t) return;
    const sampai = this.menujuTitik(t.x, t.z, M.kecepatan, dt);
    if (sampai) {
      // Di balik tutupan: menghadap pemain, diam sebentar, lalu pindah.
      this.putarKe(sudutKe(this.posisi, pemain.posisi), dt);
      this.sisaDiTutupan -= dt;
      if (this.sisaDiTutupan <= 0) this.pilihTutupan(pemain);
    }
  }

  /** Memilih tutupan 10-15 m dari pemain (bukan yang terakhir); tanpa tutupan: titik acak sejauh itu. */
  private pilihTutupan(pemain: Pemain): void {
    const M = H.mengintai;
    const pos = pemain.posisi;
    const calon: Tutupan[] = [];
    for (const s of this.konteks.semak) calon.push({ x: s.pusat.x, z: s.pusat.z, jari: 1.2 });
    const r = M.jarakMaks + 2;
    this.data.indeksPohon.dalamKotak(pos.x - r, pos.z - r, pos.x + r, pos.z + r, (p) => {
      calon.push({ x: p.x, z: p.z, jari: p.jari });
    });
    const cocok = calon.filter((c) => {
      const d = jarakXZ(c.x, c.z, pos.x, pos.z);
      if (d < M.jarakMin || d > M.jarakMaks) return false;
      return !this.tutupanTerakhir || jarakXZ(c.x, c.z, this.tutupanTerakhir.x, this.tutupanTerakhir.z) > 2;
    });
    let pilihan: Tutupan;
    if (cocok.length > 0) {
      pilihan = cocok[Math.floor(Math.random() * cocok.length)];
      this.tutupanTerakhir = pilihan;
      // Berdiri di sisi tutupan yang membelakangi pemain.
      const dx = pilihan.x - pos.x;
      const dz = pilihan.z - pos.z;
      const d = Math.hypot(dx, dz) || 1;
      const jauh = pilihan.jari + JARI_BADAN + 0.6;
      this.tutupan = { x: pilihan.x + (dx / d) * jauh, z: pilihan.z + (dz / d) * jauh, jari: 0 };
    } else {
      const sudut = Math.atan2(this.posisi.x - pos.x, this.posisi.z - pos.z) + (Math.random() < 0.5 ? 0.9 : -0.9);
      const jarak = (M.jarakMin + M.jarakMaks) / 2;
      this.tutupan = { x: pos.x + Math.sin(sudut) * jarak, z: pos.z + Math.cos(sudut) * jarak, jari: 0 };
    }
    this.sisaDiTutupan = acak(M.diamDiTutupanMin, M.diamDiTutupanMaks);
  }

  // --- Mengelilingi dan menerkam ----------------------------------------------------------

  private perbaruiMengelilingi(dt: number, pemain: Pemain, obor: boolean): void {
    const K = H.mengelilingi;
    const s = this.sasaran.posisi;
    const dx = s.x - this.posisi.x;
    const dz = s.z - this.posisi.z;
    const jarak = Math.hypot(dx, dz) || 1e-4;
    const keX = dx / jarak;
    const keZ = dz / jarak;
    this.putarKe(Math.atan2(dx, dz), dt);
    this.sisaKeliling -= dt;
    // Siap menerkam: waktunya habis dan sasaran dalam jangkauan; dengan obor, sasaran harus jauh dari pemain.
    const jauhDariObor = !obor || (this.sasaran.pengikut !== null && jarakKe(pemain.posisi, s) >= H.obor.jarakMin);
    const siap = this.sisaKeliling <= 0 && jauhDariObor;
    if (siap && jarak <= K.jarakSiapTerkam) {
      this.arahTerkam.set(keX, 0, keZ);
      const p = this.sasaran.pengikut;
      if (p) {
        // Mengantisipasi langkah pengikut yang sedang mundur.
        const v = p.kecepatanDatar;
        this.arahTerkam.set(s.x + v.x * H.terkam.antisipasiPengikut - this.posisi.x, 0, s.z + v.z * H.terkam.antisipasiPengikut - this.posisi.z).normalize();
      }
      this.masuk('bersiap');
      return;
    }
    let radial = 0;
    if (siap) radial = K.kecepatanMendekat; // menutup jarak untuk menerkam
    else if (jarak > K.jarak + 1) radial = Math.min(K.kecepatanMendekat, (jarak - K.jarak) * 1.2);
    else if (jarak < K.jarak - 1) radial = -K.kecepatan;
    else radial = (K.jarak - jarak) * 0.8;
    const tangX = -keZ * this.arahPutar;
    const tangZ = keX * this.arahPutar;
    this.posisi.x += (keX * radial + tangX * K.kecepatan) * dt;
    this.posisi.z += (keZ * radial + tangZ * K.kecepatan) * dt;
  }

  private perbaruiMenerkam(dt: number, pemain: Pemain, tarung: PertarunganPemain): void {
    const T = H.terkam;
    const laju = T.jarak / T.durasi;
    this.posisi.x += this.arahTerkam.x * laju * dt;
    this.posisi.z += this.arahTerkam.z * laju * dt;
    if (!this.terkamKena) {
      const p = this.sasaran.pengikut;
      if (p) {
        if (jarakKe(this.posisi, p.posisi) < T.lebarKena + JARI_PEMAIN + 0.3) {
          this.terkamKena = true;
          this.tangkapPengikut(p);
          return;
        }
      } else if (jarakKe(this.posisi, pemain.posisi) < T.lebarKena + JARI_PEMAIN) {
        this.terkamKena = true;
        this.terkamPemain(pemain, tarung);
        if (this.status === 'terhuyung') return;
      }
    }
    if (this.waktu >= T.durasi) this.masuk('jeda');
  }

  /** Terkaman mengenai pemain: kebal (hindar) lolos, tangkis pas membuat harimau terhuyung, tangkis biasa mengurangi. */
  private terkamPemain(pemain: Pemain, tarung: PertarunganPemain): void {
    const T = H.terkam;
    if (tarung.kebal) return;
    const keadaan = tarung.keadaanTangkis();
    const menghadapHarimau = menghadap(pemain.posisi, pemain.hadap, this.posisi, KONFIG.pemain.tangkis.sudutTangkis);
    if (keadaan === 'pas' && menghadapHarimau) {
      this.kenaSejakMundur = Math.max(this.kenaSejakMundur, 1);
      this.masuk('terhuyung');
      return;
    }
    if (keadaan === 'biasa' && menghadapHarimau) {
      tarung.terkena(this.posisi, T.dorong, false, T.damageTertangkis);
      return;
    }
    tarung.jatuhkan(this.posisi, T.dorong, T.damage, T.jatuh);
  }

  private tangkapPengikut(p: Pengikut): void {
    p.tertahan = true;
    this.pengikutTertangkap = p;
    this.konteks.saatMenangkapPengikut(p);
    this.masuk('menyeret');
  }

  private lepaskanPengikut(): void {
    if (this.pengikutTertangkap) this.pengikutTertangkap.tertahan = false;
    this.pengikutTertangkap = null;
  }

  /** Menahan pengikut sambil menggeram; kalau tidak ditolong dalam waktunya, membawanya lari. */
  private perbaruiMenyeret(dt: number, pemain: Pemain): void {
    const p = this.pengikutTertangkap;
    if (!p) {
      this.masuk('mengelilingi');
      return;
    }
    // Tetap menempel di pengikut, menghadap pemain.
    this.menujuTitik(p.posisi.x, p.posisi.z, 2, dt);
    this.putarKe(sudutKe(this.posisi, pemain.posisi), dt);
    if (this.waktu >= H.pengikut.waktuTolong) {
      this.lepaskanPengikut();
      this.konteks.saatMembawaPengikut(p);
      this.mulaiPergi(pemain);
    }
  }

  // --- Mundur, makan, pergi ---------------------------------------------------------------

  private perbaruiMundur(dt: number, pemain: Pemain, jarakPemain: number): void {
    const M = H.mundur;
    if (this.waktu < dt * 1.5) {
      // Baru masuk: titik mundur menjauhi pemain.
      const d = jarakPemain || 1;
      this.titikTuju.set(
        this.posisi.x + ((this.posisi.x - pemain.posisi.x) / d) * M.jarak,
        0,
        this.posisi.z + ((this.posisi.z - pemain.posisi.z) / d) * M.jarak,
      );
    }
    const sampai = this.menujuTitik(this.titikTuju.x, this.titikTuju.z, M.kecepatan, dt);
    if (sampai) this.putarKe(sudutKe(this.posisi, pemain.posisi), dt);
    if (this.waktu >= M.kembaliSetelah) {
      this.lamaIntai = H.mengintai.lamaSetelahMundur;
      this.masuk('mengintai');
    }
  }

  private perbaruiMakan(dt: number, pemain: Pemain): void {
    const m = this.makanan;
    if (!m) {
      this.masuk('mengelilingi');
      return;
    }
    if (!this.menujuTitik(m.x, m.z, H.bekal.kecepatan, dt)) return;
    this.sisaMakan -= dt;
    if (this.sisaMakan <= 0) {
      this.makanan = null;
      this.mulaiPergi(pemain);
    }
  }

  private mulaiPergi(pemain: Pemain): void {
    const d = jarakKe(this.posisi, pemain.posisi) || 1;
    this.titikTuju.set(
      this.posisi.x + ((this.posisi.x - pemain.posisi.x) / d) * H.pergi.jarak,
      0,
      this.posisi.z + ((this.posisi.z - pemain.posisi.z) / d) * H.pergi.jarak,
    );
    this.masuk('pergi');
  }

  private perbaruiPergi(dt: number): void {
    const sampai = this.menujuTitik(this.titikTuju.x, this.titikTuju.z, H.mundur.kecepatan, dt);
    if (sampai || this.waktu >= H.pergi.lamaMaks) {
      this.sudahPergi = true;
      this.grup.visible = false;
    }
  }

  // --- Gerak dasar ------------------------------------------------------------------------

  private putarKe(sudut: number, dt: number, laju = 8): void {
    let selisih = sudut - this.hadap;
    selisih = Math.atan2(Math.sin(selisih), Math.cos(selisih));
    this.hadap += selisih * Math.min(1, laju * dt);
  }

  /** Berjalan datar ke (x, z) sambil berputar ke arahnya; benar kalau sudah sampai. */
  private menujuTitik(x: number, z: number, kecepatan: number, dt: number): boolean {
    const dx = x - this.posisi.x;
    const dz = z - this.posisi.z;
    const jarak = Math.hypot(dx, dz);
    if (jarak < JARAK_SAMPAI) return true;
    this.putarKe(Math.atan2(dx, dz), dt);
    const langkah = Math.min(jarak, kecepatan * dt);
    this.posisi.x += (dx / jarak) * langkah;
    this.posisi.z += (dz / jarak) * langkah;
    return false;
  }

  // --- Visual -----------------------------------------------------------------------------

  protected override perbaruiVisual(dt: number): void {
    let condong = 0;
    let skalaY = 1;
    let skalaZ = 1;
    let goyang = 0;
    let kepalaX = 0;
    let sinar = 0;
    const sinarWarna = this.sementara;
    sinarWarna.set(0, 0, 0);
    switch (this.status) {
      case 'mengintai':
        skalaY = 0.85;
        condong = 0.05;
        break;
      case 'bersiap': {
        const t = Math.min(1, this.waktu / H.bersiap);
        skalaY = 0.7;
        skalaZ = 0.9;
        goyang = Math.sin(this.waktu * 60) * 0.04 * t;
        sinar = 0.3 + 0.7 * t;
        sinarWarna.set(WARNA_ISYARAT.r, WARNA_ISYARAT.g, WARNA_ISYARAT.b);
        break;
      }
      case 'menerkam': {
        const t = Math.min(1, this.waktu / H.terkam.durasi);
        skalaZ = 1.25;
        skalaY = 0.9;
        condong = -0.35 * Math.sin(Math.PI * t);
        break;
      }
      case 'terhuyung': {
        const t = this.waktu / H.terhuyung;
        goyang = 0.3 * Math.sin(this.waktu * 9) * (1 - t);
        sinar = 0.8 * (1 - t);
        sinarWarna.set(WARNA_TERHUYUNG.r, WARNA_TERHUYUNG.g, WARNA_TERHUYUNG.b);
        break;
      }
      case 'menyeret':
        goyang = Math.sin(this.waktu * 30) * 0.06;
        kepalaX = 0.4;
        break;
      case 'makan':
        kepalaX = 0.6 + Math.sin(this.waktu * 5) * 0.15;
        break;
      case 'mundur':
      case 'pergi':
        condong = 0.1;
        break;
    }
    const laju = Math.min(1, 16 * dt);
    this.badan.rotation.y = this.hadap;
    this.badan.rotation.x += (condong - this.badan.rotation.x) * laju;
    this.badan.rotation.z += (goyang - this.badan.rotation.z) * laju;
    this.badan.scale.y += (skalaY - this.badan.scale.y) * laju;
    this.badan.scale.z += (skalaZ - this.badan.scale.z) * laju;
    this.kepala.rotation.x += (kepalaX - this.kepala.rotation.x) * laju;

    if (this.sisaKilat > 0) {
      this.sisaKilat -= dt;
      this.bahan.emissive.copy(WARNA_KENA);
      this.bahan.emissiveIntensity = 1.5;
    } else {
      this.bahan.emissive.setRGB(sinarWarna.x, sinarWarna.y, sinarWarna.z);
      this.bahan.emissiveIntensity = sinar;
    }
  }

  /** Rebah ke samping (bukan ke belakang seperti prajurit), lalu menghilang. */
  protected override perbaruiMati(dt: number): void {
    super.perbaruiMati(dt);
    const laju = Math.min(1, 5 * dt);
    this.badan.rotation.x += (0 - this.badan.rotation.x) * laju;
    this.badan.rotation.z += (1.4 - this.badan.rotation.z) * laju;
  }
}

function acak(min: number, maks: number): number {
  return min + Math.random() * (maks - min);
}

function jarakXZ(x1: number, z1: number, x2: number, z2: number): number {
  return Math.hypot(x1 - x2, z1 - z2);
}

function jarakKe(a: THREE.Vector3, b: THREE.Vector3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
