import type * as THREE from 'three';
import type { Pemain } from '../character/player';
import type { PengelolaPengikut } from '../character/follower';
import type { PengelolaLawan } from '../combat/enemy-manager';
import type { PengelolaSiluman } from '../stealth/stealth-manager';
import type { DataTabrakan } from '../world/collision';
import { acakBerbenih } from '../world/forest';
import type { HudKejadian } from '../ui/event-hud';
import type { DataKejadian, Segmen } from './config';
import type { StatusPermainan } from './state';
import type { Rombongan } from './party';
import { KejadianHarimau } from './event-tiger';

/** Hal di luar kejadian yang dipakai aktornya: dunia, lawan, rombongan, pemain, UI. */
export interface KetergantunganKejadian {
  scene: THREE.Scene;
  tabrakan: DataTabrakan;
  lawan: PengelolaLawan;
  siluman: PengelolaSiluman;
  status: StatusPermainan;
  rombongan: Rombongan;
  pemain: Pemain;
  pengikut: PengelolaPengikut;
  hud: HudKejadian;
  /** Teks besar sebentar di tengah layar. */
  umumkan: (teks: string) => void;
  mulaiDialog: (id: string, lawanBicara: THREE.Vector3 | null) => void;
  gamepadTerakhir: () => boolean;
}

/** Satu kejadian yang sedang berjalan: harimau, perampok, buaya, dan seterusnya. */
export interface AktorKejadian {
  perbarui(dt: number): void;
  /** Petunjuk tombol untuk HUD bawah (misalnya "E: Lempar bekal"), atau null. */
  petunjuk(): string | null;
  /** Tombol aksi (E) ditekan; benar kalau dipakai. */
  aksi(): boolean;
  readonly selesai: boolean;
  buang(): void;
}

type KeadaanKejadian = 'batal' | 'menunggu' | 'berjalan' | 'selesai';

interface StatusKejadian {
  data: DataKejadian;
  keadaan: KeadaanKejadian;
  aktor: AktorKejadian | null;
}

/** Hash FNV-1a 32 bit untuk mengubah kunci teks menjadi benih. */
function hashTeks(teks: string): number {
  let h = 2166136261;
  for (let i = 0; i < teks.length; i++) {
    h ^= teks.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Angka acak 0-1 yang tetap untuk pasangan benih misi dan kunci. */
export function undi(benih: number, kunci: string): number {
  return acakBerbenih((benih ^ hashTeks(kunci)) >>> 0)();
}

/**
 * Pengelola kejadian di jalur (sprint 7). Saat segmen mulai, tiap `kejadian` diundi (peluang dan
 * undian berkunci) dari benih misi, jadi hasilnya sama setelah gugur dan memuat ulang. Kejadian
 * aktif saat pemain masuk jarinya dan syaratnya ada; aktornya dibuat saat itu dan dibuang saat selesai.
 */
export class PengelolaKejadian {
  private daftar: StatusKejadian[] = [];

  constructor(private readonly d: KetergantunganKejadian) {}

  /** Segmen mulai (atau dimuat ulang): aktor lama dibuang, undian dihitung lagi dari benih yang sama. */
  mulaiSegmen(s: Segmen, benih: number): void {
    this.bersihkan();
    for (const k of s.kejadian ?? []) {
      let aktif = true;
      if (k.undian) aktif = Math.floor(undi(benih, k.undian.kunci) * k.undian.dari) === k.undian.ke;
      if (aktif && k.peluang !== undefined && k.peluang < 1) aktif = undi(benih, k.id) < k.peluang;
      this.daftar.push({ data: k, keadaan: aktif ? 'menunggu' : 'batal', aktor: null });
      if (import.meta.env.DEV) console.log(`[kejadian] ${s.id}: ${k.id} ${aktif ? 'menunggu' : 'tidak terjadi (undian)'}`);
    }
  }

  bersihkan(): void {
    for (const k of this.daftar) k.aktor?.buang();
    this.daftar = [];
  }

  /** Aktor yang sedang berjalan, untuk pengujian. */
  get berjalan(): AktorKejadian[] {
    return this.daftar.filter((k) => k.aktor).map((k) => k.aktor as AktorKejadian);
  }

  perbarui(dt: number): void {
    const pos = this.d.pemain.posisi;
    for (const k of this.daftar) {
      if (k.keadaan === 'menunggu') {
        const data = k.data;
        if (data.syarat && !data.syarat.every((t) => this.d.status.tanda.has(t))) continue;
        if (Math.hypot(pos.x - data.pusat[0], pos.z - data.pusat[1]) > data.jari) continue;
        k.aktor = this.buatAktor(data);
        k.keadaan = 'berjalan';
        if (import.meta.env.DEV) console.log(`[kejadian] mulai: ${data.id}`);
      } else if (k.keadaan === 'berjalan' && k.aktor) {
        k.aktor.perbarui(dt);
        if (k.aktor.selesai) {
          k.aktor.buang();
          k.aktor = null;
          k.keadaan = k.data.sekaliPerMisi === false ? 'menunggu' : 'selesai';
          if (import.meta.env.DEV) console.log(`[kejadian] selesai: ${k.data.id}`);
        }
      }
    }
  }

  /** Petunjuk tombol dari kejadian yang berjalan, atau null. */
  petunjuk(): string | null {
    for (const k of this.daftar) {
      const p = k.aktor?.petunjuk();
      if (p) return p;
    }
    return null;
  }

  /** Tombol aksi ditekan; benar kalau ada kejadian yang memakainya. */
  tekanAksi(): boolean {
    for (const k of this.daftar) if (k.aktor?.aksi()) return true;
    return false;
  }

  private buatAktor(data: DataKejadian): AktorKejadian {
    switch (data.jenis) {
      case 'harimau':
        return new KejadianHarimau(data, this.d);
      default:
        // Jenis lain menyusul di tahap berikutnya: aktor kosong yang langsung selesai.
        console.warn(`[kejadian] jenis "${data.jenis}" belum ada`);
        return { perbarui: () => undefined, petunjuk: () => null, aksi: () => false, selesai: true, buang: () => undefined };
    }
  }
}
