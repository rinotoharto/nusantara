import { menghadap } from '../combat/hit';
import { Gerombolan, Perampok } from '../combat/bandit';
import { ATURAN, type DataKejadian } from './config';
import type { AktorKejadian, KetergantunganKejadian } from './events';

const TANDA_DIBAYAR = 'perampok-dibayar';
const TANDA_TEGAS = 'perampok-tegas';
const TANDA_LAWAN = 'perampok-lawan';
const TANDA_KABAR = 'kabar-wijaya';
const TANDA_DIKALAHKAN = 'perampok-dikalahkan';

/**
 * Kejadian perampok: tiga perampok menghadang jalan. Dalam `jarakDialog` dari kepalanya
 * percakapan dimulai; hasilnya (tanda dari dialog) menentukan: dibayar atau gentar mereka pergi,
 * licik berarti bertarung dengan kepala yang sudah terhuyung. Menyerang lebih dulu = langsung bertarung.
 */
export class KejadianPerampok implements AktorKejadian {
  private readonly gerombolan = new Gerombolan();
  private readonly kepala: Perampok;
  private dialogDimulai = false;
  private hasilDiterapkan = false;
  private kalahDicatat = false;
  selesai = false;

  constructor(
    private readonly data: DataKejadian,
    private readonly d: KetergantunganKejadian,
  ) {
    const posisi = data.posisi ?? [data.pusat];
    for (const [x, z] of posisi) {
      const p = new Perampok(d.tabrakan, x, z, this.gerombolan);
      d.scene.add(p.grup);
      d.lawan.tambah(p);
    }
    this.kepala = this.gerombolan.anggota[0];
  }

  perbarui(dt: number): void {
    this.gerombolan.waktu += dt;
    const anggota = this.gerombolan.anggota;
    if (anggota.every((a) => a.selesai)) {
      this.selesai = true;
      return;
    }
    // Menghadang (diam) belum berarti bertarung; pergi juga bukan.
    const bertarung = anggota.some((a) => a.hidup && a.status !== 'diam' && a.status !== 'pergi');
    if (!this.gerombolan.adaYangHidup && !this.kalahDicatat) {
      this.kalahDicatat = true;
      this.d.status.tandai(TANDA_DIKALAHKAN);
    }
    const id = this.data.percakapan;
    if (!id) {
      if (!bertarung) this.gerombolan.serang();
      return;
    }
    // Percakapan: sekali, saat pemain mendekati kepala perampok dari depan (setengah lingkaran hadapnya) dan belum
    // ada yang bertarung. Dari belakang tidak ada sapaan, supaya Sergap sebelum dialog mungkin (perbaikan 1).
    if (!this.dialogDimulai && !bertarung && this.kepala.hidup && !this.d.pemainMenyerang()) {
      const p = this.d.pemain.posisi;
      if (Math.hypot(p.x - this.kepala.posisi.x, p.z - this.kepala.posisi.z) <= ATURAN.perampok.jarakDialog && menghadap(this.kepala.posisi, this.kepala.hadap, p, 180)) {
        this.dialogDimulai = true;
        this.kepala.hadap = Math.atan2(p.x - this.kepala.posisi.x, p.z - this.kepala.posisi.z);
        this.d.mulaiDialog(id, this.kepala.posisi);
      }
    }
    if (this.dialogDimulai && !this.hasilDiterapkan && this.d.status.percakapanSelesai.has(id)) {
      this.hasilDiterapkan = true;
      this.terapkanHasil();
    }
  }

  private terapkanHasil(): void {
    const tanda = this.d.status.tanda;
    const pemain = this.d.pemain.posisi;
    if (tanda.has(TANDA_LAWAN)) {
      this.kepala.terhuyungkan();
      this.gerombolan.serang();
      return;
    }
    if (tanda.has(TANDA_TEGAS) && this.d.rombongan.nilai.pengikut <= ATURAN.perampok.pengikutTanpaKabar) {
      this.d.status.tandai(TANDA_KABAR);
    }
    if (tanda.has(TANDA_DIBAYAR) || tanda.has(TANDA_TEGAS)) {
      for (const a of this.gerombolan.anggota) a.pergi(pemain);
      return;
    }
    // Percakapan berakhir tanpa tanda yang dikenal: anggap mereka menyerang.
    this.gerombolan.serang();
  }

  petunjuk(): string | null {
    return null;
  }

  aksi(): boolean {
    return false;
  }

  buang(): void {
    for (const a of this.gerombolan.anggota) {
      this.d.lawan.hapus(a);
      this.d.scene.remove(a.grup);
    }
  }
}
