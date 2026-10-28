import { Buaya } from '../world/crocodile';
import type { DataKejadian } from './config';
import type { AktorKejadian, KetergantunganKejadian } from './events';

const TANDA_MENERKAM = 'buaya-menerkam';

/**
 * Kejadian buaya: satu buaya di tempat dangkal. Tidak pernah selesai sendiri (buaya tetap ada
 * selama segmen berjalan); dibuang bersama segmennya.
 */
export class KejadianBuaya implements AktorKejadian {
  private readonly buaya: Buaya;
  readonly selesai = false;

  constructor(data: DataKejadian, private readonly d: KetergantunganKejadian) {
    const [x, z] = data.muncul ?? data.pusat;
    this.buaya = new Buaya(x, z);
    this.buaya.saatMenerkam = () => d.status.tandai(TANDA_MENERKAM);
    d.scene.add(this.buaya.grup);
  }

  perbarui(dt: number): void {
    this.buaya.perbarui(dt, this.d.pemain, this.d.tarung);
  }

  petunjuk(): string | null {
    return null;
  }

  aksi(): boolean {
    return false;
  }

  buang(): void {
    this.d.scene.remove(this.buaya.grup);
  }
}
