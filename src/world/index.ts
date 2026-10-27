import * as THREE from 'three';
import { buatMedan, tinggiMedan } from './terrain';
import { buatSungai } from './river';
import { buatDesa, type Rumah } from './village';
import { buatHutan, type Pohon } from './forest';
import { pasangPencahayaan } from './lighting';

export interface Dunia {
  medan: THREE.Mesh;
  rumah: Rumah[];
  pohon: Pohon[];
  matahari: THREE.DirectionalLight;
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

  const matahari = pasangPencahayaan(scene);

  return { medan, rumah, pohon: hutan.pohon, matahari, tinggiMedan };
}
