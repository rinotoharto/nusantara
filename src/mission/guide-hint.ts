import type * as THREE from 'three';
import type { PengelolaPengikut } from '../character/follower';
import type { Subtitle } from '../ui/subtitle';
import { PEMANDU } from '../world/guide-config';
import { PENGIKUT_TOKOH } from './config';

const N = PEMANDU.nambi;

/**
 * Nambi penunjuk jalan: kalau pemain tidak mendekati penanda tujuan selama `tanpaKemajuan` detik
 * (jarak terdekat yang pernah dicapai tidak berkurang) dan sedang tidak bertarung, berdialog, atau
 * bersembunyi, pengikut Nambi mengucapkan satu baris pendek dan berjalan beberapa meter ke arah
 * tujuan lalu kembali ke formasi. Paling cepat sekali per `jeda` detik. Angka di guide.json.
 */
export class PenunjukJalan {
  private jarakTerbaik = Infinity;
  private penandaX = NaN;
  private penandaZ = NaN;
  private tanpaKemajuan = 0;
  private sisaJeda = 0;
  private indeksBaris = Math.floor(Math.random() * N.baris.length);
  /** Berapa kali petunjuk terpakai (untuk catatan playtest). */
  jumlahDipicu = 0;
  /** Dipanggil tiap kali Nambi menunjuk jalan (untuk catatan playtest). */
  saatTunjuk: (() => void) | null = null;

  constructor(
    private readonly pengikut: PengelolaPengikut,
    private readonly subtitle: Subtitle,
  ) {}

  /** `boleh` salah saat bertarung, bersembunyi, atau pemain gugur: hitungan dijeda. */
  perbarui(dt: number, posisiPemain: THREE.Vector3, penanda: [number, number] | null, boleh: boolean): void {
    this.sisaJeda = Math.max(0, this.sisaJeda - dt);
    if (!penanda) {
      this.jarakTerbaik = Infinity;
      this.tanpaKemajuan = 0;
      return;
    }
    if (penanda[0] !== this.penandaX || penanda[1] !== this.penandaZ) {
      this.penandaX = penanda[0];
      this.penandaZ = penanda[1];
      this.jarakTerbaik = Infinity;
      this.tanpaKemajuan = 0;
    }
    const d = Math.hypot(penanda[0] - posisiPemain.x, penanda[1] - posisiPemain.z);
    if (d < this.jarakTerbaik - N.toleransiKemajuan) {
      this.jarakTerbaik = d;
      this.tanpaKemajuan = 0;
      return;
    }
    if (!boleh) return;
    this.tanpaKemajuan += dt;
    if (this.tanpaKemajuan < N.tanpaKemajuan || this.sisaJeda > 0) return;
    this.tanpaKemajuan = 0;
    const nambi = this.pengikut.daftar[PENGIKUT_TOKOH[N.tokoh] ?? -1];
    if (!nambi || !nambi.aktif) return; // Nambi tidak ada di segmen ini (misalnya di perahu)
    this.sisaJeda = N.jeda;
    this.jumlahDipicu += 1;
    this.saatTunjuk?.();
    this.indeksBaris = (this.indeksBaris + 1) % N.baris.length;
    this.subtitle.tampilkan(N.nama, N.baris[this.indeksBaris], N.lamaSubtitle);
    nambi.tunjukArah(posisiPemain, penanda, N.jarakJalan, N.lamaJalan);
  }
}
