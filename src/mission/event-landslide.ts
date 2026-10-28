import * as THREE from 'three';
import { KONFIG } from '../combat/config';
import { UI, isiPola } from '../ui/config';
import { Longsor, type Tangga } from '../world/landslide';
import type { DataKejadian } from './config';
import type { AktorKejadian, KetergantunganKejadian } from './events';

const L = KONFIG.longsor;
const TANDA_TERJADI = 'longsor-terjadi';

/**
 * Kejadian longsor: saat pemain masuk jari, getaran dan "Tanah bergeser!", lalu tumpukan
 * menutup jalan beberapa meter di depan. Pemain di zona tumpukan kena damage dan jatuh.
 * Memutar lewat tangga tebing pendek; dengan Gajah Pagon tiap tangga harus didahului memikul
 * (tahan E) dan percakapan `longsor-pagon` sekali. Tidak selesai sendiri: dibuang bersama segmen.
 */
export class KejadianLongsor implements AktorKejadian {
  private longsor: Longsor | null = null;
  private sisaJeda = L.jedaMuncul;
  private sisaGetar = 0;
  private readonly getarAsal = new THREE.Vector3();
  private tanggaMemikul: Tangga | null = null;
  private lamaMemikul = 0;
  private dialogSudah = false;
  readonly selesai = false;

  constructor(
    private readonly data: DataKejadian,
    private readonly d: KetergantunganKejadian,
  ) {
    d.umumkan(UI.kejadian.tanahBergeser);
    this.sisaGetar = L.lamaGetar;
  }

  private get pagonIkut(): boolean {
    return this.d.pengikut.pagonIkut;
  }

  perbarui(dt: number): void {
    const pemain = this.d.pemain;
    // Getaran: kapsul pemain bergoyang kecil lewat badan (dikembalikan tiap frame).
    if (this.sisaGetar > 0) {
      this.sisaGetar -= dt;
      const kuat = Math.min(1, this.sisaGetar / L.lamaGetar) * 0.04;
      pemain.badan.position.x = (Math.random() - 0.5) * kuat;
      pemain.badan.position.z = (Math.random() - 0.5) * kuat;
      if (this.sisaGetar <= 0) pemain.badan.position.set(0, 0, 0);
    }
    if (!this.longsor) {
      this.sisaJeda -= dt;
      if (this.sisaJeda > 0) return;
      const tumpukan = this.data.tumpukan ?? [];
      this.longsor = new Longsor(this.d.siluman, this.d.scene, tumpukan, this.data.tangga ?? []);
      this.d.status.tandai(TANDA_TERJADI);
      if (Longsor.dalamZona(tumpukan, pemain.posisi, L.zonaTambahan)) {
        const b = tumpukan[0];
        this.getarAsal.set(b ? b.x : pemain.posisi.x, pemain.posisi.y, b ? b.z : pemain.posisi.z);
        this.d.tarung.jatuhkan(this.getarAsal, 1.5, L.damage, L.jatuh);
        // Terdorong keluar dari balok oleh tabrakan pada frame berikutnya.
      }
      return;
    }
    this.longsor.perbarui(dt);
    this.perbaruiMemikul(dt);
  }

  /** Dengan Gajah Pagon: di dekat tangga yang belum dipikul, memanjat dilarang sampai E ditahan cukup lama. */
  private perbaruiMemikul(dt: number): void {
    const pemain = this.d.pemain;
    if (!this.longsor || !this.pagonIkut) {
      pemain.bolehPanjat = true;
      this.tanggaMemikul = null;
      return;
    }
    const tangga = this.longsor.tanggaDekat(pemain.posisi);
    if (!tangga || tangga.dipikul) {
      pemain.bolehPanjat = true;
      this.tanggaMemikul = null;
      this.lamaMemikul = 0;
      return;
    }
    pemain.bolehPanjat = false;
    if (this.tanggaMemikul !== tangga) {
      this.tanggaMemikul = tangga;
      this.lamaMemikul = 0;
    }
    if (this.d.aksiDitahan()) this.lamaMemikul += dt;
    else this.lamaMemikul = Math.max(0, this.lamaMemikul - dt * 2);
    if (this.lamaMemikul >= L.lamaMemikul) {
      tangga.dipikul = true;
      pemain.bolehPanjat = true;
      this.tanggaMemikul = null;
      this.lamaMemikul = 0;
      if (!this.dialogSudah && this.data.percakapan) {
        this.dialogSudah = true;
        this.d.mulaiDialog(this.data.percakapan, null);
      }
    }
  }

  petunjuk(): string | null {
    if (!this.tanggaMemikul) return null;
    const sisa = Math.max(0, L.lamaMemikul - this.lamaMemikul);
    const pola = this.d.gamepadTerakhir() ? UI.kejadian.memikulPad : UI.kejadian.memikul;
    return isiPola(pola, { detik: sisa.toFixed(1) });
  }

  aksi(): boolean {
    return false;
  }

  buang(): void {
    this.d.pemain.bolehPanjat = true;
    this.d.pemain.badan.position.set(0, 0, 0);
    this.longsor?.buang();
    this.longsor = null;
  }
}
