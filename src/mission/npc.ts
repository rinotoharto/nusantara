import * as THREE from 'three';
import { tinggiMedan } from '../world/terrain';
import type { DataTabrakan, Padat } from '../world/collision';
import type { StatusPermainan } from './state';

const TINGGI_NPC = 1.65;
const JARI_NPC = 0.35;

export interface DataNpc {
  id: string;
  nama: string;
  /** [x, z] titik kaki. */
  posisi: [number, number];
  /** Arah hadap awal (radian; 0 = menghadap +z). */
  hadap: number;
  /** Urutan percakapan: yang belum selesai dipakai dulu; kalau semua selesai, yang terakhir diulang. */
  percakapan: string[];
  /** Tanda yang harus ada supaya NPC ini dipasang (dievaluasi saat segmennya mulai). */
  syarat?: string;
  /** Dicabut begitu salah satu percakapannya selesai. */
  hapusSetelahPercakapan?: boolean;
}

/** Tokoh bukan pemain yang bisa diajak bicara. Tidak bertarung, tidak bergerak. */
export class Npc {
  readonly grup = new THREE.Group();
  readonly posisi = this.grup.position;
  readonly id: string;
  readonly nama: string;
  readonly padat: Padat;
  readonly hapusSetelahPercakapan: boolean;
  private readonly percakapan: string[];

  constructor(data: DataNpc) {
    this.id = data.id;
    this.nama = data.nama;
    this.percakapan = data.percakapan;
    this.hapusSetelahPercakapan = data.hapusSetelahPercakapan ?? false;
    const [x, z] = data.posisi;
    this.posisi.set(x, tinggiMedan(x, z), z);
    this.grup.rotation.y = data.hadap;

    const kapsul = new THREE.Mesh(
      new THREE.CapsuleGeometry(JARI_NPC, TINGGI_NPC - 2 * JARI_NPC, 6, 12),
      new THREE.MeshStandardMaterial({ color: 0x3f8a93, roughness: 0.75 }),
    );
    kapsul.position.y = TINGGI_NPC / 2;
    kapsul.castShadow = true;
    const hidung = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.14, 0.2),
      new THREE.MeshStandardMaterial({ color: 0xf2e2c0 }),
    );
    hidung.position.set(0, TINGGI_NPC - 0.35, JARI_NPC);
    this.grup.add(kapsul, hidung);
    this.padat = { kotak: this.kotak, bisaDipanjat: false };
  }

  /** Kotak tabrakan supaya pemain tidak menembus NPC. */
  get kotak(): THREE.Box3 {
    const r = JARI_NPC;
    return new THREE.Box3(
      new THREE.Vector3(this.posisi.x - r, this.posisi.y - 1, this.posisi.z - r),
      new THREE.Vector3(this.posisi.x + r, this.posisi.y + TINGGI_NPC, this.posisi.z + r),
    );
  }

  hadapKe(x: number, z: number): void {
    this.grup.rotation.y = Math.atan2(x - this.posisi.x, z - this.posisi.z);
  }

  punyaPercakapan(id: string): boolean {
    return this.percakapan.includes(id);
  }

  /** Id percakapan yang dipakai kalau pemain mengajak bicara sekarang. */
  percakapanBerikut(status: StatusPermainan): string {
    for (const id of this.percakapan) if (!status.percakapanSelesai.has(id)) return id;
    return this.percakapan[this.percakapan.length - 1];
  }
}

/** Semua NPC yang sedang terpasang; misi menambah dan mencabutnya per segmen. */
export class PengelolaNpc {
  readonly daftar: Npc[] = [];

  constructor(
    private readonly scene: THREE.Scene,
    private readonly tabrakan: DataTabrakan,
  ) {}

  tambah(d: DataNpc): Npc {
    const npc = new Npc(d);
    this.scene.add(npc.grup);
    this.tabrakan.padat.push(npc.padat);
    this.daftar.push(npc);
    return npc;
  }

  hapus(npc: Npc): void {
    const i = this.daftar.indexOf(npc);
    if (i >= 0) this.daftar.splice(i, 1);
    const j = this.tabrakan.padat.indexOf(npc.padat);
    if (j >= 0) this.tabrakan.padat.splice(j, 1);
    this.scene.remove(npc.grup);
  }

  cari(id: string): Npc | null {
    return this.daftar.find((n) => n.id === id) ?? null;
  }

  /** NPC terdekat dalam jarak datar `maks`, atau null. */
  terdekat(pos: THREE.Vector3, maks: number): Npc | null {
    let hasil: Npc | null = null;
    let jarakMin = maks;
    for (const n of this.daftar) {
      const jarak = Math.hypot(n.posisi.x - pos.x, n.posisi.z - pos.z);
      if (jarak < jarakMin) {
        jarakMin = jarak;
        hasil = n;
      }
    }
    return hasil;
  }
}
