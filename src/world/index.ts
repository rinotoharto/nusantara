import * as THREE from 'three';
import { buatMedan, tinggiMedan } from './terrain';
import { buatSungai } from './river';
import { buatDesa, type Rumah } from './village';
import { buatHutan, type Pohon } from './forest';
import { buatTebing, type Tebing } from './cliff';
import { pasangPencahayaan } from './lighting';
import type { DataTabrakan } from './collision';

export interface Dunia {
  medan: THREE.Mesh;
  rumah: Rumah[];
  tebing: Tebing;
  pohon: Pohon[];
  matahari: THREE.DirectionalLight;
  tabrakan: DataTabrakan;
  /** Mesh yang menghalangi kamera (selain medan, yang dicek lewat fungsi tinggi). */
  penghalangKamera: THREE.Object3D[];
  tinggiMedan: (x: number, z: number) => number;
}

/** Membangun seluruh dunia balok ke dalam scene. */
export function buatDunia(scene: THREE.Scene): Dunia {
  const medan = buatMedan();
  scene.add(medan);
  scene.add(buatSungai());

  const rumah = buatDesa();
  for (const r of rumah) scene.add(r.grup);

  const hutan = buatHutan();
  scene.add(hutan.grup);

  const tebing = buatTebing();
  scene.add(tebing.mesh);

  const matahari = pasangPencahayaan(scene);

  const tabrakan: DataTabrakan = {
    padat: [
      ...rumah.map((r) => ({ kotak: r.kotak, bisaDipanjat: false })),
      { kotak: tebing.kotak, bisaDipanjat: true },
    ],
    pohon: hutan.pohon,
  };

  const penghalangKamera: THREE.Object3D[] = [tebing.mesh];
  for (const r of rumah) {
    r.grup.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) penghalangKamera.push(o);
    });
  }

  return { medan, rumah, tebing, pohon: hutan.pohon, matahari, tabrakan, penghalangKamera, tinggiMedan };
}
