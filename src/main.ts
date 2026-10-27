import * as THREE from 'three';
import './style.css';
import { buatDunia } from './world';
import { Input } from './character/input';
import { Pemain } from './character/player';
import { KameraOrangKetiga } from './character/camera';
import { Hud } from './ui/hud';
import { PertarunganPemain } from './combat/player-combat';
import { BonekaLatihan } from './combat/dummy';
import { KONFIG } from './combat/config';

const kanvas = document.getElementById('kanvas') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas: kanvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 600);

const dunia = buatDunia(scene);
const input = new Input(kanvas);

const pemain = new Pemain(dunia.tabrakan);
pemain.taruhDi(0, 34); // di selatan desa, menghadap utara
scene.add(pemain.grup);

const tarung = new PertarunganPemain(pemain);

// Boneka latihan sementara (tahap A) di utara titik awal; diganti lawan sungguhan di tahap B.
const boneka = new BonekaLatihan(dunia.tabrakan, 0, 29);
scene.add(boneka.grup);

const kameraOrangKetiga = new KameraOrangKetiga(camera, dunia.penghalangKamera);
const hud = new Hud();
let sisaWaktuTarung = 0;

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Bayangan mengikuti pemain supaya resolusinya terpakai di sekitar pemain saja.
const geserMatahari = dunia.matahari.position.clone();
function ikutkanMatahari(): void {
  dunia.matahari.target.position.copy(pemain.posisi);
  dunia.matahari.position.copy(pemain.posisi).add(geserMatahari);
}

const jam = new THREE.Timer();
renderer.setAnimationLoop(() => {
  jam.update();
  const dtMentah = jam.getDelta();
  const dt = Math.min(dtMentah, 0.05); // dibatasi supaya tidak melompat jauh saat tab tidak aktif

  const perintah = tarung.perbarui(dt, input, kameraOrangKetiga.yaw);
  pemain.perbarui(dt, input, kameraOrangKetiga.yaw, perintah);
  boneka.perbarui(dt, pemain, tarung);

  // Kamera bertarung selama ada lawan dekat, bertahan sebentar setelah lawan menjauh.
  const jarakLawan = boneka.posisi.distanceTo(pemain.posisi);
  if (jarakLawan < KONFIG.kamera.jarakDeteksi) sisaWaktuTarung = KONFIG.kamera.waktuKembali;
  else sisaWaktuTarung = Math.max(0, sisaWaktuTarung - dt);
  kameraOrangKetiga.modeTarung = sisaWaktuTarung > 0;

  kameraOrangKetiga.perbarui(dt, input, pemain.posisi);
  ikutkanMatahari();
  hud.perbarui(dtMentah, input.terkunci);
  input.akhirFrame();

  renderer.render(scene, camera);
});

// Pegangan untuk pengujian di konsol browser, hanya saat pengembangan.
if (import.meta.env.DEV) {
  (window as unknown as { nusantara: unknown }).nusantara = { pemain, kamera: kameraOrangKetiga, tarung, boneka, input };
}
