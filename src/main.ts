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
import { PengelolaSiluman } from './stealth/stealth-manager';
import { HudSiluman } from './ui/stealth-hud';
import { PengelolaPengikut } from './character/follower';
import { StatusPermainan } from './mission/state';
import { MesinDialog } from './dialog/engine';
import { TOKOH_PEMAIN } from './dialog/config';
import { validasiDialog } from './dialog/validator';
import { validasiKitab } from './codex/config';
import { poseBahu, type PoseKamera } from './dialog/sinematik';
import { UiDialog } from './ui/dialog-ui';
import { PengelolaNpc } from './mission/npc';
import { UI } from './ui/config';

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
scene.add(pemain.grup);

const tarung = new PertarunganPemain(pemain);

const lawan = new PengelolaLawan(dunia.tabrakan, scene);
const siluman = new PengelolaSiluman(dunia, scene, lawan);
const TITIK_AWAL = siluman.mulai; // ujung selatan area uji menyelinap
pemain.taruhDi(TITIK_AWAL.x, TITIK_AWAL.z);
pemain.hadap = Math.PI; // menghadap utara
const pengikut = new PengelolaPengikut(dunia.tabrakan, scene);
pengikut.taruhDiBelakang(pemain);
tarung.pencariSasaran = (pos, maks) => lawan.lawanTerdekat(pos, maks);
tarung.pencariTerhuyung = (pos, maks) => lawan.lawanTerhuyungTerdekat(pos, maks);

const hudTarung = new HudPertarungan(() => {
  // Ulangi: pemain kembali ke titik awal, semua lawan dihidupkan lagi.
  pemain.taruhDi(TITIK_AWAL.x, TITIK_AWAL.z);
  pemain.hadap = Math.PI;
  pengikut.taruhDiBelakang(pemain);
  tarung.hidupkan();
  lawan.hidupkanSemua();
  sudahSampai = false;
});
tarung.saatTikaman = (pertama) => {
  if (pertama) hudTarung.umumkan('Tikaman Keris');
};

const kameraOrangKetiga = new KameraOrangKetiga(camera, dunia.penghalangKamera);
const hud = new Hud();
const hudSiluman = new HudSiluman();

// Status permainan, dialog, dan Kitab.
const status = new StatusPermainan();
document.body.classList.add(`huruf-${status.pengaturan.ukuranHuruf}`);
for (const pesan of [...validasiKitab(), ...validasiDialog()]) console.warn(`[data] ${pesan}`);
const mesinDialog = new MesinDialog(status);
const uiDialog = new UiDialog(mesinDialog, status);
/** Mode UI: logika permainan hanya berjalan saat 'main'. */
let modeUi: 'main' | 'dialog' = 'main';
const npc = new PengelolaNpc(scene, dunia.tabrakan);
/** Titik kaki lawan bicara selama dialog. */
const posisiLawanBicara = new THREE.Vector3();
const poseSinematik: PoseKamera = { posisi: new THREE.Vector3(), sasaran: new THREE.Vector3() };

function mulaiDialog(id: string, lawanBicara: THREE.Vector3): void {
  if (modeUi !== 'main') return;
  posisiLawanBicara.copy(lawanBicara);
  if (!uiDialog.mulai(id)) return;
  modeUi = 'dialog';
  hud.tampilkanAksi(null);
  if (document.pointerLockElement) document.exitPointerLock();
  pemain.hadapKe(lawanBicara.x, lawanBicara.z);
}
mesinDialog.saatSelesai = () => {
  modeUi = 'main';
  kameraOrangKetiga.sinematik = null;
};
let sisaWaktuTarung = 0;
let sudahSampai = false;
const JARAK_SAMPAI = 2.5; // jarak ke tiang tujuan yang dianggap sampai

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
  let dt = 0;
  if (modeUi === 'dialog') {
    // Dunia membeku; hanya teks dan kamera sinematik yang bergerak.
    uiDialog.perbarui(dtNyata);
    if (mesinDialog.aktif) {
      const pemainBicara = mesinDialog.pembicara === TOKOH_PEMAIN;
      const pembicara = pemainBicara ? pemain.posisi : posisiLawanBicara;
      const pendengar = pemainBicara ? posisiLawanBicara : pemain.posisi;
      poseBahu(pendengar, pembicara, poseSinematik);
      kameraOrangKetiga.sinematik = poseSinematik;
    }
  } else {
    tarung.perbaruiEfek(dtNyata);
    dt = dtNyata * tarung.skalaWaktu; // waktu permainan melambat sesaat setelah Tikaman Keris

    const perintah = tarung.perbarui(dt, input, kameraOrangKetiga.yaw);
    pemain.perbarui(dt, input, kameraOrangKetiga.yaw, perintah);
    siluman.perbarui(pemain, pengikut.daftar);
    pengikut.perbarui(dt, pemain, siluman.konteks.pemain, lawan.daftar, camera);
    lawan.perbarui(dt, pemain, tarung);

    // NPC dekat: tampilkan "E: Bicara" dan mulai percakapan; tidak saat ada lawan bertarung di dekat pemain.
    const tenang = lawan.jarakTerdekat(pemain.posisi) >= KONFIG.kamera.jarakDeteksi;
    const npcDekat = tenang && !tarung.mati && pemain.diTanah ? npc.terdekat(pemain.posisi, UI.npc.jarak) : null;
    hud.tampilkanAksi(npcDekat ? UI.npc.bicara : null);
    if (npcDekat && input.baruDitekan('KeyE')) {
      npcDekat.hadapKe(pemain.posisi.x, pemain.posisi.z);
      mulaiDialog(npcDekat.percakapanBerikut(status), npcDekat.posisi);
    }
  }

  // Kamera bertarung selama ada lawan dekat, bertahan sebentar setelah lawan menjauh.
  const jarakLawan = lawan.jarakTerdekat(pemain.posisi);
  if (jarakLawan < KONFIG.kamera.jarakDeteksi) sisaWaktuTarung = KONFIG.kamera.waktuKembali;
  else sisaWaktuTarung = Math.max(0, sisaWaktuTarung - dt);
  kameraOrangKetiga.modeTarung = sisaWaktuTarung > 0;
  kameraOrangKetiga.mendekat = KONFIG.pemain.tikaman.kameraMendekat * tarung.faktorKameraDekat;

  // Sampai di tiang tujuan area uji.
  if (!sudahSampai && Math.hypot(pemain.posisi.x - siluman.tujuan.x, pemain.posisi.z - siluman.tujuan.z) < JARAK_SAMPAI) {
    sudahSampai = true;
    hudTarung.umumkan('Sampai di ujung utara');
  }

  kameraOrangKetiga.perbarui(dtNyata, input, pemain.posisi);
  ikutkanMatahari();
  hud.perbarui(dtMentah, input.terkunci || tarung.mati || modeUi !== 'main');
  hudTarung.perbarui(dt, pemain, lawan.daftar, tarung, camera);
  hudSiluman.perbarui(siluman.penjaga, siluman.konteks.pemain, camera);
  input.akhirFrame();

  renderer.render(scene, camera);
});

// Pegangan untuk pengujian di konsol browser, hanya saat pengembangan.
if (import.meta.env.DEV) {
  (window as unknown as { nusantara: unknown }).nusantara = { pemain, kamera: kameraOrangKetiga, tarung, lawan, siluman, pengikut, input, status, dialog: mesinDialog, uiDialog, mulaiDialog, npc };
}
