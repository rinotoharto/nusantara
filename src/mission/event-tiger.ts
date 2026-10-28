import * as THREE from 'three';
import { Harimau } from '../combat/tiger';
import { KONFIG } from '../combat/config';
import { UI } from '../ui/config';
import type { DataKejadian } from './config';
import type { AktorKejadian, KetergantunganKejadian } from './events';

const H = KONFIG.harimau;
const KITAB_HARIMAU = 'harimau-jawa';
const TANDA_BEKAL = 'harimau-bekal';
const TANDA_PENGIKUT = 'harimau-gagak';
const TANDA_MATI = 'harimau-mati';

const bahanBekal = new THREE.MeshStandardMaterial({ color: 0xe8d8a0, roughness: 0.9 });

/**
 * Kejadian harimau: memasang `Harimau` ke pengelola lawan, mengurus lempar bekal (E),
 * geraman di HUD, Kitab yang terbuka saat pertama terdengar, pengikut yang diseret
 * (Pengikut -1 lewat tanda) dan percakapan Sora sesudahnya.
 */
export class KejadianHarimau implements AktorKejadian {
  private readonly harimau: Harimau;
  private bekal: THREE.Mesh | null = null;
  private pengikutHilang = false;
  private dialogSudah = false;
  private matiDicatat = false;
  selesai = false;

  constructor(
    private readonly data: DataKejadian,
    private readonly d: KetergantunganKejadian,
  ) {
    const [x, z] = data.muncul ?? data.pusat;
    this.harimau = new Harimau(d.tabrakan, x, z, {
      pengikut: () => d.pengikut.aktif.filter((p) => p !== d.pengikut.pagon),
      oborMenyala: () => d.pemain.oborMenyala,
      semak: d.siluman.semak,
      saatGeram: (pos) => {
        d.hud.geram(pos);
        d.status.bukaKitab(KITAB_HARIMAU);
      },
      saatMenangkapPengikut: () => d.umumkan(UI.kejadian.pengikutDitangkap),
      saatMembawaPengikut: () => {
        this.pengikutHilang = true;
        d.status.tandai(TANDA_PENGIKUT);
      },
    });
    d.scene.add(this.harimau.grup);
    d.lawan.tambah(this.harimau);
  }

  perbarui(_dt: number): void {
    if (!this.harimau.hidup && !this.matiDicatat) {
      this.matiDicatat = true;
      this.d.status.tandai(TANDA_MATI);
    }
    if (!this.harimau.selesai) return;
    if (this.pengikutHilang && !this.dialogSudah && this.data.percakapan) {
      this.dialogSudah = true;
      this.d.mulaiDialog(this.data.percakapan, null);
    }
    this.selesai = true;
  }

  petunjuk(): string | null {
    if (!this.bisaLempar()) return null;
    return this.d.gamepadTerakhir() ? UI.kejadian.lemparBekalPad : UI.kejadian.lemparBekal;
  }

  aksi(): boolean {
    if (!this.bisaLempar()) return false;
    const pemain = this.d.pemain;
    const pos = new THREE.Vector3(
      pemain.posisi.x + Math.sin(pemain.hadap) * H.bekal.jarakLempar,
      0,
      pemain.posisi.z + Math.cos(pemain.hadap) * H.bekal.jarakLempar,
    );
    pos.y = pemain.posisi.y;
    this.bekal = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.22, 0.35), bahanBekal);
    this.bekal.position.set(pos.x, pos.y + 0.11, pos.z);
    this.bekal.castShadow = true;
    this.d.scene.add(this.bekal);
    this.d.status.tandai(TANDA_BEKAL);
    this.harimau.lemparBekal(pos);
    return true;
  }

  private bisaLempar(): boolean {
    if (this.d.rombongan.nilai.perbekalan <= 0 || !this.harimau.bisaDiberiBekal) return false;
    const p = this.d.pemain.posisi;
    return Math.hypot(p.x - this.harimau.posisi.x, p.z - this.harimau.posisi.z) <= H.bekal.jarakMaks;
  }

  buang(): void {
    this.d.lawan.hapus(this.harimau);
    this.d.scene.remove(this.harimau.grup);
    if (this.bekal) this.d.scene.remove(this.bekal);
    this.bekal = null;
    // Pengikut yang masih ditahan dilepas (misalnya segmen dimuat ulang).
    for (const p of this.d.pengikut.daftar) p.tertahan = false;
  }
}
