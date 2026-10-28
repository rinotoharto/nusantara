import * as THREE from 'three';
import { tinggiMedan } from '../world/terrain';
import { DIALOG } from '../dialog/config';
import type { DataKejadian } from './config';
import type { AktorKejadian, KetergantunganKejadian } from './events';
import type { Npc } from './npc';

const bahanDinding = new THREE.MeshStandardMaterial({ color: 0x6b5236, roughness: 0.95 });
const bahanAtap = new THREE.MeshStandardMaterial({ color: 0x8f7a4a, roughness: 1 });

/**
 * Kejadian desertir: seorang prajurit Daha tanpa tombak duduk di gubuk di tepi jalan.
 * Ia NPC biasa (E: Bicara) dengan percakapan `desertir-kediri`; misi mencabut NPC-nya saat
 * percakapan berakhir, gubuknya tetap sampai segmen berganti. Hasilnya lewat tanda dialog
 * (desertir-ikut, desertir-ditolak, sora-menolak); kesetiaannya diundi di layar selesai.
 */
export class KejadianDesertir implements AktorKejadian {
  private readonly npc: Npc;
  private readonly gubuk = new THREE.Group();
  /** Tidak pernah selesai sendiri: dibuang bersama segmennya supaya gubuk tetap ada. */
  readonly selesai = false;

  constructor(
    data: DataKejadian,
    private readonly d: KetergantunganKejadian,
  ) {
    const [x, z] = data.muncul ?? data.pusat;
    const id = data.percakapan ?? '';
    const nama = DIALOG[id]?.tokoh.desertir ?? 'Prajurit Daha';
    // Menghadap pusat kejadian (jalan).
    const hadap = Math.atan2(data.pusat[0] - x, data.pusat[1] - z);
    this.npc = d.npc.tambah({ id: data.id, nama, posisi: [x, z], hadap, percakapan: id ? [id] : [], hapusSetelahPercakapan: true });

    // Gubuk kecil di belakang NPC: lantai, dua dinding, atap miring; tidak menghalangi gerak.
    const bx = x - Math.sin(hadap) * 1.4;
    const bz = z - Math.cos(hadap) * 1.4;
    const y = tinggiMedan(bx, bz);
    const lantai = new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 2.6), bahanDinding);
    lantai.position.y = 0.1;
    const dindingBelakang = new THREE.Mesh(new THREE.BoxGeometry(3, 1.9, 0.15), bahanDinding);
    dindingBelakang.position.set(0, 1.05, -1.2);
    const dindingSamping = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.9, 2.6), bahanDinding);
    dindingSamping.position.set(-1.42, 1.05, 0);
    const atap = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.12, 3.0), bahanAtap);
    atap.position.set(0, 2.1, 0.1);
    atap.rotation.x = 0.18;
    for (const m of [lantai, dindingBelakang, dindingSamping, atap]) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
    this.gubuk.add(lantai, dindingBelakang, dindingSamping, atap);
    this.gubuk.position.set(bx, y, bz);
    this.gubuk.rotation.y = hadap;
    d.scene.add(this.gubuk);
  }

  perbarui(_dt: number): void {}

  petunjuk(): string | null {
    return null;
  }

  aksi(): boolean {
    return false;
  }

  buang(): void {
    if (this.d.npc.daftar.includes(this.npc)) this.d.npc.hapus(this.npc);
    this.d.scene.remove(this.gubuk);
  }
}
