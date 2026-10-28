import * as THREE from 'three';
import type { DataBatuMisi } from '../mission/config';
import type { PengelolaSiluman } from '../stealth/stealth-manager';
import { tinggiMedan } from './terrain';

/** Satu tangga tebing pendek yang bisa dipanjat; dengan Gajah Pagon harus dipikul dulu. */
export interface Tangga {
  data: DataBatuMisi;
  kotak: THREE.Box3;
  /** Pemain sudah memikul Gajah Pagon di tangga ini. */
  dipikul: boolean;
}

/**
 * Longsor (sprint 7): tumpukan tanah dan batu (balok tidak bisa dipanjat) yang menutup jalan,
 * ditambah tangga tebing pendek (balok bisa dipanjat) untuk memutar. Dipasang lewat pengelola
 * siluman supaya ikut tabrakan, pandangan, dan kamera.
 */
export class Longsor {
  readonly tangga: Tangga[] = [];
  private readonly pencabut: (() => void)[] = [];
  private readonly debu: THREE.Mesh[] = [];
  private sisaDebu = 0;

  constructor(
    siluman: PengelolaSiluman,
    private readonly scene: THREE.Scene,
    tumpukan: DataBatuMisi[],
    tangga: DataBatuMisi[],
  ) {
    for (const b of tumpukan) this.pencabut.push(siluman.tambahBatu(b));
    for (const t of tangga) {
      this.pencabut.push(siluman.tambahBatu(t, true));
      const y = tinggiMedan(t.x, t.z);
      const kotak = new THREE.Box3(
        new THREE.Vector3(t.x - t.lebar / 2, y - 1, t.z - t.dalam / 2),
        new THREE.Vector3(t.x + t.lebar / 2, y + t.tinggi, t.z + t.dalam / 2),
      );
      this.tangga.push({ data: t, kotak, dipikul: false });
    }
    // Debu: beberapa bidang kelabu yang mengembang lalu memudar di atas tumpukan.
    for (const b of tumpukan) {
      for (let i = 0; i < 3; i++) {
        const bidang = new THREE.Mesh(
          new THREE.PlaneGeometry(1, 1),
          new THREE.MeshBasicMaterial({ color: 0xa89a80, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
        );
        bidang.position.set(b.x + (Math.random() - 0.5) * b.lebar, tinggiMedan(b.x, b.z) + b.tinggi * 0.6, b.z + (Math.random() - 0.5) * b.dalam);
        bidang.rotation.y = Math.random() * Math.PI;
        this.debu.push(bidang);
        scene.add(bidang);
      }
    }
    this.sisaDebu = 2.5;
  }

  /** Benar kalau titik kaki `pos` berada di tapak salah satu balok tumpukan atau tangga, diperlebar `tambahan`. */
  static dalamZona(daftar: DataBatuMisi[], pos: THREE.Vector3, tambahan: number): boolean {
    return daftar.some(
      (b) => Math.abs(pos.x - b.x) <= b.lebar / 2 + tambahan && Math.abs(pos.z - b.z) <= b.dalam / 2 + tambahan,
    );
  }

  /** Tangga yang sedang berdiri di dekat pemain (dalam 1,2 m dari tapaknya) dan belum dinaiki. */
  tanggaDekat(pos: THREE.Vector3): Tangga | null {
    for (const t of this.tangga) {
      const k = t.kotak;
      const dx = Math.max(k.min.x - pos.x, 0, pos.x - k.max.x);
      const dz = Math.max(k.min.z - pos.z, 0, pos.z - k.max.z);
      const selisih = k.max.y - pos.y;
      if (Math.hypot(dx, dz) <= 1.2 && selisih >= 1.2 && selisih <= 2.8) return t;
    }
    return null;
  }

  perbarui(dt: number): void {
    if (this.sisaDebu <= 0) return;
    this.sisaDebu -= dt;
    for (const d of this.debu) {
      const s = d.scale.x + 2.2 * dt;
      d.scale.set(s, s, 1);
      d.position.y += 0.6 * dt;
      (d.material as THREE.MeshBasicMaterial).opacity = Math.max(0, this.sisaDebu / 2.5) * 0.5;
    }
    if (this.sisaDebu <= 0) this.buangDebu();
  }

  private buangDebu(): void {
    for (const d of this.debu) {
      this.scene.remove(d);
      (d.material as THREE.MeshBasicMaterial).dispose();
    }
    this.debu.length = 0;
  }

  buang(): void {
    for (const cabut of this.pencabut) cabut();
    this.pencabut.length = 0;
    this.buangDebu();
  }
}
