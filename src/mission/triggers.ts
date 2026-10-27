import type * as THREE from 'three';
import misi from '../data/misi3.json';
import { KITAB_PER_ID } from '../codex/config';
import type { StatusPermainan } from './state';

interface PemicuArea {
  jenis: 'area';
  /** [x, z] pusat lingkaran. */
  pusat: [number, number];
  jari: number;
  bukaKitab: string[];
}

interface PemicuPertarunganPertama {
  jenis: 'pertarungan-pertama';
  bukaKitab: string[];
}

export type Pemicu = PemicuArea | PemicuPertarunganPertama;

/**
 * Pemicu misi dari src/data/misi3.json: membuka entri Kitab saat pemain masuk area
 * atau saat pertama kali bertarung. Tiap pemicu hanya menyala sekali per sesi;
 * entri yang sudah terbuka tidak dibuka ulang oleh status.
 */
export class PemicuMisi {
  private readonly daftar: Pemicu[];
  private readonly sudah = new Set<Pemicu>();

  constructor(private readonly status: StatusPermainan) {
    this.daftar = misi.pemicu as Pemicu[];
  }

  /** Memeriksa misi3.json; mengembalikan daftar pesan masalah. */
  validasi(): string[] {
    const pesan: string[] = [];
    this.daftar.forEach((p, i) => {
      if (p.jenis !== 'area' && p.jenis !== 'pertarungan-pertama') pesan.push(`misi3 pemicu ${i + 1}: jenis "${(p as { jenis: string }).jenis}" tidak dikenal`);
      for (const k of p.bukaKitab ?? []) {
        if (!KITAB_PER_ID.has(k)) pesan.push(`misi3 pemicu ${i + 1}: bukaKitab "${k}" tidak ada di codex`);
      }
    });
    return pesan;
  }

  /** Dipanggil tiap frame permainan. `bertarung` benar saat ada lawan yang sedang bertarung di dekat pemain. */
  perbarui(posisiPemain: THREE.Vector3, bertarung: boolean): void {
    for (const p of this.daftar) {
      if (this.sudah.has(p)) continue;
      let nyala = false;
      if (p.jenis === 'area') {
        nyala = Math.hypot(posisiPemain.x - p.pusat[0], posisiPemain.z - p.pusat[1]) <= p.jari;
      } else if (p.jenis === 'pertarungan-pertama') {
        nyala = bertarung;
      }
      if (!nyala) continue;
      this.sudah.add(p);
      for (const k of p.bukaKitab) this.status.bukaKitab(k);
    }
  }
}
