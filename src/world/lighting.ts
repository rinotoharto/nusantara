import * as THREE from 'three';

/** Suasana sore: matahari rendah keemasan dengan bayangan, langit dan kabut hangat. */
export function pasangPencahayaan(scene: THREE.Scene): { matahari: THREE.DirectionalLight; ambien: THREE.HemisphereLight } {
  const warnaLangit = new THREE.Color(0xe8b47a);
  scene.background = warnaLangit;
  scene.fog = new THREE.Fog(warnaLangit, 120, 320);

  const matahari = new THREE.DirectionalLight(0xffd29a, 2.6);
  matahari.position.set(-80, 45, 30); // sore: matahari rendah di barat
  matahari.castShadow = true;
  matahari.shadow.mapSize.set(2048, 2048);
  matahari.shadow.camera.near = 1;
  matahari.shadow.camera.far = 300;
  matahari.shadow.camera.left = -60;
  matahari.shadow.camera.right = 60;
  matahari.shadow.camera.top = 60;
  matahari.shadow.camera.bottom = -60;
  matahari.shadow.bias = -0.0008;
  matahari.shadow.normalBias = 0.5;
  scene.add(matahari);
  scene.add(matahari.target);

  // Cahaya ambien hangat: langit jingga, pantulan tanah hijau kecokelatan.
  const ambien = new THREE.HemisphereLight(0xffc98a, 0x4a5a30, 0.9);
  scene.add(ambien);

  return { matahari, ambien };
}
