import * as THREE from 'three';
import { tinggiMedan } from '../world/terrain';
import type { DataTabrakan } from '../world/collision';
import type { StatusPermainan } from './state';
import misi from '../data/misi3.json';

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
}

/** Tokoh bukan pemain yang bisa diajak bicara. Tidak bertarung, tidak bergerak. */
export class Npc {
  readonly grup = new THREE.Group();
  readonly posisi = this.grup.position;
  readonly id: string;
  readonly nama: string;
  private readonly percakapan: string[];

  constructor(data: DataNpc) {
    this.id = data.id;
    this.nama = data.nama;
    this.percakapan = data.percakapan;
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

  /** Id percakapan yang dipakai kalau pemain mengajak bicara sekarang. */
  percakapanBerikut(status: StatusPermainan): string {
    for (const id of this.percakapan) if (!status.percakapanSelesai.has(id)) return id;
    return this.percakapan[this.percakapan.length - 1];
  }
}

/** Semua NPC misi dari src/data/misi3.json. */
export class PengelolaNpc {
  readonly daftar: Npc[] = [];

  constructor(scene: THREE.Scene, tabrakan: DataTabrakan) {
    for (const d of misi.npc as DataNpc[]) {
      const npc = new Npc(d);
      scene.add(npc.grup);
      tabrakan.padat.push({ kotak: npc.kotak, bisaDipanjat: false });
      this.daftar.push(npc);
    }
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
