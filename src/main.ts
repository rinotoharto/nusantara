import * as THREE from 'three';
import './style.css';
import { buatDunia } from './world';
import { Input } from './character/input';
import { Pemain } from './character/player';
import { KameraOrangKetiga } from './character/camera';
import { Hud } from './ui/hud';
import { HudPertarungan } from './ui/combat-hud';
import { PertarunganPemain } from './combat/player-combat';
import { PengelolaLawan } from './combat/enemy-manager';
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

const TITIK_AWAL = { x: 0, z: 34 }; // di selatan desa
const pemain = new Pemain(dunia.tabrakan);
pemain.taruhDi(TITIK_AWAL.x, TITIK_AWAL.z);
scene.add(pemain.grup);

const tarung = new PertarunganPemain(pemain);

const lawan = new PengelolaLawan(dunia.tabrakan, scene);
tarung.pencariSasaran = (pos, maks) => lawan.lawanTerdekat(pos, maks);
tarung.pencariTerhuyung = (pos, maks) => lawan.lawanTerhuyungTerdekat(pos, maks);

const hudTarung = new HudPertarungan(() => {
  // Ulangi: pemain kembali ke titik awal, semua lawan dihidupkan lagi.
  pemain.taruhDi(TITIK_AWAL.x, TITIK_AWAL.z);
  tarung.hidupkan();
  lawan.hidupkanSemua();
});
tarung.saatTikaman = (pertama) => {
  if (pertama) hudTarung.umumkan('Tikaman Keris');
};

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
  const dtNyata = Math.min(dtMentah, 0.05); // dibatasi supaya tidak melompat jauh saat tab tidak aktif
  tarung.perbaruiEfek(dtNyata);
  const dt = dtNyata * tarung.skalaWaktu; // waktu permainan melambat sesaat setelah Tikaman Keris

  const perintah = tarung.perbarui(dt, input, kameraOrangKetiga.yaw);
  pemain.perbarui(dt, input, kameraOrangKetiga.yaw, perintah);
  lawan.perbarui(dt, pemain, tarung);

  // Kamera bertarung selama ada lawan dekat, bertahan sebentar setelah lawan menjauh.
  const jarakLawan = lawan.jarakTerdekat(pemain.posisi);
  if (jarakLawan < KONFIG.kamera.jarakDeteksi) sisaWaktuTarung = KONFIG.kamera.waktuKembali;
  else sisaWaktuTarung = Math.max(0, sisaWaktuTarung - dt);
  kameraOrangKetiga.modeTarung = sisaWaktuTarung > 0;
  kameraOrangKetiga.mendekat = KONFIG.pemain.tikaman.kameraMendekat * tarung.faktorKameraDekat;

  kameraOrangKetiga.perbarui(dtNyata, input, pemain.posisi);
  ikutkanMatahari();
  hud.perbarui(dtMentah, input.terkunci || tarung.mati);
  hudTarung.perbarui(dt, pemain, lawan.daftar, tarung, camera);
  input.akhirFrame();

  renderer.render(scene, camera);
});

// Pegangan untuk pengujian di konsol browser, hanya saat pengembangan.
if (import.meta.env.DEV) {
  (window as unknown as { nusantara: unknown }).nusantara = { pemain, kamera: kameraOrangKetiga, tarung, lawan, input };
}
