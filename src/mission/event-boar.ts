import { Babi } from '../combat/boar';
import { KONFIG } from '../combat/config';
import type { DataKejadian } from './config';
import type { AktorKejadian, KetergantunganKejadian } from './events';

const BB = KONFIG.babi;
const TANDA_MENGAMUK = 'babi-mengamuk';

/**
 * Kejadian babi hutan: babi di semak dekat jalan menyeruduk pemain yang lewat. Tiap serudukan
 * berisik: penjaga terdekat dalam radius suara datang memeriksa (status mencari). Selesai saat
 * babi lari atau mati dan hilang.
 */
export class KejadianBabi implements AktorKejadian {
  private readonly babi: Babi;
  private tandaSudah = false;
  selesai = false;

  constructor(data: DataKejadian, private readonly d: KetergantunganKejadian) {
    const [x, z] = data.muncul ?? data.pusat;
    this.babi = new Babi(d.tabrakan, x, z);
    this.babi.saatMenyeruduk = () => this.beritahuPenjaga();
    d.scene.add(this.babi.grup);
    d.lawan.tambah(this.babi);
  }

  /** Penjaga terdekat dalam radius suara pergi memeriksa tempat babi. */
  private beritahuPenjaga(): void {
    const p = this.babi.posisi;
    let terdekat = null as (typeof this.d.siluman.penjaga)[number] | null;
    let jarakMin = BB.radiusSuara;
    for (const g of this.d.siluman.penjaga) {
      if (!g.hidup || g.mengejar) continue;
      const jarak = Math.hypot(g.posisi.x - p.x, g.posisi.z - p.z);
      if (jarak < jarakMin) {
        jarakMin = jarak;
        terdekat = g;
      }
    }
    if (terdekat) {
      terdekat.selidiki(p.x, p.z);
      if (!this.tandaSudah) {
        this.tandaSudah = true;
        this.d.status.tandai(TANDA_MENGAMUK);
      }
    }
  }

  perbarui(_dt: number): void {
    if (this.babi.selesai) this.selesai = true;
  }

  petunjuk(): string | null {
    return null;
  }

  aksi(): boolean {
    return false;
  }

  buang(): void {
    this.d.lawan.hapus(this.babi);
    this.d.scene.remove(this.babi.grup);
  }
}
