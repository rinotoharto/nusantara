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
import { PemicuMisi } from './mission/triggers';
import { UI } from './ui/config';
import { UiKitab } from './ui/codex-ui';
import { PemberitahuanKitab } from './ui/notify';
import { MenuJeda } from './ui/pause-menu';
import { terapkanUkuranHuruf } from './ui/font-size';
import { Rombongan } from './mission/party';
import { ATURAN, DUNIA_MISI, PENGIKUT_TOKOH } from './mission/config';
import { HudRombongan } from './ui/party-hud';
import { HudTujuan } from './ui/objective-hud';
import { PanelNaskah } from './ui/panel';
import { PelaksanaMisi } from './mission/mission';

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

const dunia = buatDunia(scene, DUNIA_MISI);
const input = new Input(kanvas);

const pemain = new Pemain(dunia.tabrakan);
scene.add(pemain.grup);

const tarung = new PertarunganPemain(pemain);

const lawan = new PengelolaLawan();
const siluman = new PengelolaSiluman(dunia, scene, lawan);
const pengikut = new PengelolaPengikut(dunia.tabrakan, scene, ATURAN.pagonIkut.lajuPagon);
tarung.pencariSasaran = (pos, maks) => lawan.lawanTerdekat(pos, maks);
tarung.pencariTerhuyung = (pos, maks) => lawan.lawanTerhuyungTerdekat(pos, maks);

const kameraOrangKetiga = new KameraOrangKetiga(camera, dunia.penghalangKamera);
const hud = new Hud();
const hudSiluman = new HudSiluman();

// Status permainan, dialog, dan Kitab.
const status = new StatusPermainan();
terapkanUkuranHuruf(status.pengaturan.ukuranHuruf);
for (const pesan of [...validasiKitab(), ...validasiDialog()]) console.warn(`[data] ${pesan}`);
// Rombongan: variabel misi yang berubah lewat tanda dialog (aturan di misi3.json).
const rombongan = new Rombongan();
const hudRombongan = new HudRombongan(rombongan);
rombongan.saatBerubah = (p) => hudRombongan.tampilkanPerubahan(p);
status.saatTanda = (tanda) => rombongan.terapkanTanda(tanda);
siluman.saatKetahuan = () => rombongan.ketahuan();

const mesinDialog = new MesinDialog(status);
const uiDialog = new UiDialog(mesinDialog, status);
const uiKitab = new UiKitab(status);
const pemberitahuan = new PemberitahuanKitab();
status.saatKitabTerbuka = (id) => pemberitahuan.tambah(id);
const menuJeda = new MenuJeda(status);
const hudTujuan = new HudTujuan();
const panel = new PanelNaskah();
/** Mode UI: logika permainan hanya berjalan saat 'main'. */
let modeUi: 'main' | 'dialog' | 'kitab' | 'jeda' | 'panel' = 'main';
/** Mode yang dikembalikan saat Kitab ditutup (dibuka dari permainan atau dari menu jeda). */
let asalKitab: 'main' | 'jeda' = 'main';

function bukaKitab(asal: 'main' | 'jeda'): void {
  asalKitab = asal;
  modeUi = 'kitab';
  if (document.pointerLockElement) document.exitPointerLock();
  menuJeda.tutup();
  hud.tampilkanAksi(null);
  uiKitab.buka();
}
function tutupKitab(): void {
  uiKitab.tutup();
  modeUi = asalKitab;
  if (modeUi === 'jeda') menuJeda.buka();
}
function bukaMenu(): void {
  modeUi = 'jeda';
  hud.tampilkanAksi(null);
  menuJeda.buka();
}
function tutupMenu(): void {
  menuJeda.tutup();
  modeUi = 'main';
}
function bukaPanel(paragraf: string[], lama: number, selesai: () => void): void {
  modeUi = 'panel';
  hud.tampilkanAksi(null);
  if (document.pointerLockElement) document.exitPointerLock();
  panel.buka(
    paragraf,
    () => {
      modeUi = 'main';
      selesai();
    },
    lama,
  );
}
uiKitab.saatTutup = tutupKitab;
menuJeda.saatLanjutkan = tutupMenu;
menuJeda.saatKitab = () => bukaKitab('jeda');

// Esc: menu jeda (saat pointer sudah lepas); K: Kitab. Dialog dan panel mengurus tombolnya sendiri.
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'Escape') {
    if (document.pointerLockElement) return; // peramban sedang melepas pointer lock
    if (modeUi === 'kitab') tutupKitab();
    else if (modeUi === 'jeda') tutupMenu();
    else if (modeUi === 'main' && !tarung.mati) bukaMenu();
  } else if (e.code === 'KeyK') {
    if (modeUi === 'kitab') tutupKitab();
    else if (modeUi === 'main' && !tarung.mati) bukaKitab('main');
    else if (modeUi === 'jeda') bukaKitab('jeda');
  }
});
const npc = new PengelolaNpc(scene, dunia.tabrakan);
const pemicu = new PemicuMisi(status);
for (const pesan of pemicu.validasi()) console.warn(`[data] ${pesan}`);

/** Titik kaki lawan bicara (NPC) selama dialog; untuk pengikut dipakai posisinya langsung. */
const posisiLawanBicara = new THREE.Vector3();
const poseSinematik: PoseKamera = { posisi: new THREE.Vector3(), sasaran: new THREE.Vector3() };
/** Posisi tokoh dialog: pengikut sesuai pemetaan misi3.json, selain itu NPC lawan bicara. */
function posisiTokoh(id: string): THREE.Vector3 {
  const indeks = PENGIKUT_TOKOH[id];
  if (indeks !== undefined && pengikut.daftar[indeks]) return pengikut.daftar[indeks].posisi;
  return posisiLawanBicara;
}

function mulaiDialog(id: string, lawanBicara: THREE.Vector3 | null): void {
  if (modeUi !== 'main') return;
  posisiLawanBicara.copy(lawanBicara ?? posisiTokoh(mesinDialog.intip(id) ?? ''));
  if (!uiDialog.mulai(id)) return;
  modeUi = 'dialog';
  hud.tampilkanAksi(null);
  if (document.pointerLockElement) document.exitPointerLock();
  pemain.hadapKe(posisiLawanBicara.x, posisiLawanBicara.z);
}
mesinDialog.saatSelesai = (id) => {
  modeUi = 'main';
  kameraOrangKetiga.sinematik = null;
  misi.saatDialogSelesai(id);
};

// Misi: segmen dari misi3.json.
const misi = new PelaksanaMisi({
  scene,
  status,
  rombongan,
  siluman,
  npc,
  pengikut,
  pemain,
  lawan,
  aturTujuan: (t) => hudTujuan.atur(t),
  aturCahaya,
  bukaPanel,
  mulaiDialog,
  segarkanRombongan: () => hudRombongan.segarkan(),
});
for (const pesan of misi.validasi()) console.warn(`[data] ${pesan}`);
misi.saatSelesai = () => hudTarung.umumkan(UI.misi.selesaiSementara);

/** Gugur: kembali ke titik simpan segmen. */
function ulangiDariTitikSimpan(): void {
  tarung.hidupkan();
  misi.muatUlangSegmen();
}
const hudTarung = new HudPertarungan(ulangiDariTitikSimpan);
tarung.saatTikaman = (pertama) => {
  if (pertama) hudTarung.umumkan(UI.tarung.jurusTikaman);
};
menuJeda.saatUlangMisi = () => {
  status.ulangMisi();
  tarung.hidupkan();
  tutupMenu();
  misi.mulai();
};
let sisaWaktuTarung = 0;

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Terang cahaya dunia bisa diubah misi (pagi setelah menginap).
const terangMatahari = dunia.matahari.intensity;
const terangAmbien = dunia.ambien.intensity;
function aturCahaya(pengali: number): void {
  dunia.matahari.intensity = terangMatahari * pengali;
  dunia.ambien.intensity = terangAmbien * pengali;
}

// Bayangan mengikuti pemain supaya resolusinya terpakai di sekitar pemain saja.
const geserMatahari = dunia.matahari.position.clone();
function ikutkanMatahari(): void {
  dunia.matahari.target.position.copy(pemain.posisi);
  dunia.matahari.position.copy(pemain.posisi).add(geserMatahari);
}

/** Satu langkah logika permainan (mode 'main'): pemain, pengikut, penjaga, pemicu, NPC. */
function perbaruiPermainan(dt: number): void {
  // Rombongan membatasi laju (Gajah Pagon ikut, pengikut tumbang) dan mempercepat curiga penjaga.
  pemain.batasLaju = rombongan.lajuMaks;
  pengikut.batasLaju = rombongan.lajuMaks;
  pengikut.pagonIkut = rombongan.pagonIkut;
  siluman.pengaliCuriga = rombongan.pengaliCuriga;

  const perintah = tarung.perbarui(dt, input, kameraOrangKetiga.yaw);
  pemain.perbarui(dt, input, kameraOrangKetiga.yaw, perintah);
  if (pemain.baruSelesaiMemanjat) pengikut.susulkanSetelahPanjat(pemain, camera);
  siluman.perbarui(pemain, pengikut.aktif);
  pengikut.perbarui(dt, pemain, siluman.konteks.pemain, lawan.daftar, camera);
  lawan.perbarui(dt, pemain, tarung);

  // Pemicu Kitab dan pemicu segmen misi.
  const tenang = lawan.jarakTerdekat(pemain.posisi) >= KONFIG.kamera.jarakDeteksi;
  pemicu.perbarui(pemain.posisi, !tenang);
  if (!tarung.mati) misi.perbarui(pemain.posisi);

  // NPC dekat: tampilkan "E: Bicara" dan mulai percakapan; tidak saat ada lawan bertarung di dekat pemain.
  const npcDekat = modeUi === 'main' && tenang && !tarung.mati && pemain.diTanah ? npc.terdekat(pemain.posisi, UI.npc.jarak) : null;
  hud.tampilkanAksi(npcDekat ? UI.npc.bicara : null);
  if (npcDekat && input.baruDitekan('KeyE')) {
    npcDekat.hadapKe(pemain.posisi.x, pemain.posisi.z);
    mulaiDialog(npcDekat.percakapanBerikut(status), npcDekat.posisi);
  }
}

// Sampai titik simpan ada (tahap D), memuat halaman selalu memulai misi baru; entri Kitab tetap.
status.ulangMisi();
misi.mulai();

const jam = new THREE.Timer();
renderer.setAnimationLoop(() => {
  jam.update();
  const dtMentah = jam.getDelta();
  const dtNyata = Math.min(dtMentah, 0.05); // dibatasi supaya tidak melompat jauh saat tab tidak aktif
  let dt = 0;
  document.body.classList.toggle('lapisan-aktif', modeUi !== 'main');
  if (modeUi === 'kitab' || modeUi === 'jeda') {
    // Permainan berhenti; tidak ada yang bergerak.
  } else if (modeUi === 'panel') {
    panel.perbarui(dtNyata);
  } else if (modeUi === 'dialog') {
    // Dunia membeku; hanya teks dan kamera sinematik yang bergerak.
    uiDialog.perbarui(dtNyata);
    if (mesinDialog.aktif) {
      const pemainBicara = mesinDialog.pembicara === TOKOH_PEMAIN;
      if (!pemainBicara) posisiLawanBicara.copy(posisiTokoh(mesinDialog.pembicara));
      const pembicara = pemainBicara ? pemain.posisi : posisiLawanBicara;
      const pendengar = pemainBicara ? posisiLawanBicara : pemain.posisi;
      poseBahu(pendengar, pembicara, poseSinematik);
      kameraOrangKetiga.sinematik = poseSinematik;
    }
  } else {
    tarung.perbaruiEfek(dtNyata);
    dt = dtNyata * tarung.skalaWaktu; // waktu permainan melambat sesaat setelah Tikaman Keris
    perbaruiPermainan(dt);
  }

  // Kamera bertarung selama ada lawan dekat, bertahan sebentar setelah lawan menjauh.
  const jarakLawan = lawan.jarakTerdekat(pemain.posisi);
  if (jarakLawan < KONFIG.kamera.jarakDeteksi) sisaWaktuTarung = KONFIG.kamera.waktuKembali;
  else sisaWaktuTarung = Math.max(0, sisaWaktuTarung - dt);
  kameraOrangKetiga.modeTarung = sisaWaktuTarung > 0;
  kameraOrangKetiga.mendekat = KONFIG.pemain.tikaman.kameraMendekat * tarung.faktorKameraDekat;

  kameraOrangKetiga.perbarui(dtNyata, input, pemain.posisi);
  ikutkanMatahari();
  hud.perbarui(dtMentah, input.terkunci || tarung.mati || modeUi !== 'main');
  pemberitahuan.perbarui(dtNyata, modeUi !== 'main');
  hudRombongan.perbarui(dtNyata, modeUi !== 'main');
  hudTarung.perbarui(dt, pemain, lawan.daftar, tarung, camera);
  hudSiluman.perbarui(siluman.penjaga, siluman.konteks.pemain, camera);
  input.akhirFrame();

  renderer.render(scene, camera);
});

// Pegangan untuk pengujian di konsol browser, hanya saat pengembangan.
if (import.meta.env.DEV) {
  (window as unknown as { nusantara: unknown }).nusantara = {
    pemain, kamera: kameraOrangKetiga, tarung, lawan, siluman, pengikut, input, status, dialog: mesinDialog, uiDialog, mulaiDialog,
    npc, kitab: uiKitab, menu: menuJeda, bukaKitab, bukaMenu, pemicu, rombongan, hudRombongan, misi, panel, dunia,
    langkah: (dt: number) => {
      // Satu langkah logika permainan tanpa render, untuk bot uji; hanya berarti di mode 'main'.
      if (modeUi !== 'main') return;
      tarung.perbaruiEfek(dt);
      perbaruiPermainan(dt);
      kameraOrangKetiga.perbarui(dt, input, pemain.posisi);
      input.akhirFrame();
    },
    get modeUi() {
      return modeUi;
    },
  };
}
