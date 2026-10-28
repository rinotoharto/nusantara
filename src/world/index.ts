import * as THREE from 'three';
import { buatMedan, tinggiMedan } from './terrain';
import { buatSungai } from './river';
import { buatDesa, buatDukuh, buatLumbung, type Rumah, type TataLetakRumah } from './village';
import { buatHutan, type Pohon, type Hutan } from './forest';
import { buatTebing, type Tebing } from './cliff';
import { pasangPencahayaan } from './lighting';
import { buatPerahu, type Perahu } from './boat';
import type { DataTabrakan } from './collision';

export interface Dunia {
  medan: THREE.Mesh;
  rumah: Rumah[];
  tebing: Tebing;
  pohon: Pohon[];
  hutan: Hutan;
  matahari: THREE.DirectionalLight;
  ambien: THREE.HemisphereLight;
  perahu: Perahu;
  tabrakan: DataTabrakan;
  /** Mesh yang menghalangi kamera (selain medan, yang dicek lewat fungsi tinggi). */
  penghalangKamera: THREE.Object3D[];
  tinggiMedan: (x: number, z: number) => number;
}

/** Bagian dunia yang ditentukan data misi (misi3.json bagian `dunia`). */
export interface TataLetakDunia {
  /** Rumah dukuh Pandakan di utara sungai. */
  pandakan: TataLetakRumah[];
  /** Lumbung tua di timur Kudadu. */
  lumbung: { x: number; z: number; putar: number };
  /** Perahu nelayan di muara. */
  perahu: { x: number; z: number; putar: number };
}

/** Membangun seluruh dunia balok ke dalam scene. */
export function buatDunia(scene: THREE.Scene, tataLetak: TataLetakDunia): Dunia {
  const medan = buatMedan();
  scene.add(medan);
  scene.add(buatSungai());

  const rumah = [...buatDesa(), ...buatDukuh(tataLetak.pandakan)];
  for (const r of rumah) scene.add(r.grup);

  const hutan = buatHutan();
  scene.add(hutan.grup);

  const tebing = buatTebing();
  scene.add(tebing.mesh);

  const lumbung = buatLumbung(tataLetak.lumbung.x, tataLetak.lumbung.z, tataLetak.lumbung.putar);
  scene.add(lumbung.grup);

  const perahu = buatPerahu(tataLetak.perahu.x, tataLetak.perahu.z, tataLetak.perahu.putar);
  scene.add(perahu.grup);

  const { matahari, ambien } = pasangPencahayaan(scene);

  const tabrakan: DataTabrakan = {
    padat: [
      ...rumah.map((r) => ({ kotak: r.kotak, bisaDipanjat: false })),
      ...lumbung.kotak.map((kotak) => ({ kotak, bisaDipanjat: false })),
      { kotak: tebing.kotak, bisaDipanjat: true },
    ],
    pohon: hutan.pohon,
    indeksPohon: hutan.indeks,
  };

  const penghalangKamera: THREE.Object3D[] = [tebing.mesh];
  for (const r of rumah) {
    r.grup.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) penghalangKamera.push(o);
    });
  }

  return { medan, rumah, tebing, pohon: hutan.pohon, hutan, matahari, ambien, perahu, tabrakan, penghalangKamera, tinggiMedan };
}
