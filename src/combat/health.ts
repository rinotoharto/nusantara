import type * as THREE from 'three';

/** Nyawa sederhana untuk pemain dan lawan. */
export class Nyawa {
  sekarang: number;

  constructor(readonly maks: number) {
    this.sekarang = maks;
  }

  get mati(): boolean {
    return this.sekarang <= 0;
  }

  /** 0 sampai 1. */
  get rasio(): number {
    return Math.max(0, this.sekarang / this.maks);
  }

  /** Mengurangi nyawa; mengembalikan benar kalau baru saja mati karena pengurangan ini. */
  kurangi(jumlah: number): boolean {
    if (this.mati) return false;
    this.sekarang = Math.max(0, this.sekarang - jumlah);
    return this.mati;
  }

  pulihkan(): void {
    this.sekarang = this.maks;
  }
}

/** Angka damage yang menunggu ditampilkan HUD. */
export interface AngkaDamage {
  posisi: THREE.Vector3;
  jumlah: number;
  /** Benar kalau yang terkena lawan; salah kalau pemain. */
  keLawan: boolean;
}

/** Antrean angka damage; diisi modul pertarungan, dikosongkan HUD tiap frame. */
export const antreanAngkaDamage: AngkaDamage[] = [];

export function catatDamage(posisi: THREE.Vector3, jumlah: number, keLawan: boolean): void {
  antreanAngkaDamage.push({ posisi: posisi.clone(), jumlah, keLawan });
}
