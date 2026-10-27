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
import { LayarJudul } from './ui/title-screen';
import { LayarSelesai } from './ui/mission-end';
import { KITAB_PER_ID } from './codex/config';
import { TEKS_SELESAI } from './mission/config';
import { isiPola } from './ui/config';
import type { HasilMisi } from './mission/state';

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
const layarJudul = new LayarJudul();
const layarSelesai = new LayarSelesai();
/** Mode UI: logika permainan hanya berjalan saat 'main'. */
type ModeUi = 'judul' | 'main' | 'dialog' | 'kitab' | 'jeda' | 'panel' | 'sinematik' | 'selesai';
let modeUi: ModeUi = 'judul';
/** Mode yang dikembalikan saat Kitab ditutup (dibuka dari permainan, menu jeda, layar awal, atau layar selesai). */
let asalKitab: 'main' | 'jeda' | 'judul' | 'selesai' = 'main';
/** Detik permainan sejak misi mulai (berjalan di mode main, dialog, panel, sinematik). */
let waktuMisi = 0;

function bukaKitab(asal: 'main' | 'jeda' | 'judul' | 'selesai'): void {
  asalKitab = asal;
  modeUi = 'kitab';
  if (document.pointerLockElement) document.exitPointerLock();
  menuJeda.tutup();
  layarJudul.tutup();
  layarSelesai.tutup();
  hud.tampilkanAksi(null);
  uiKitab.buka();
}
function tutupKitab(): void {
  uiKitab.tutup();
  modeUi = asalKitab;
  if (modeUi === 'jeda') menuJeda.buka();
  else if (modeUi === 'judul') layarJudul.buka(status.titikSimpan !== null);
  else if (modeUi === 'selesai') layarSelesai.buka(isiSelesaiTerakhir);
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
    else if (modeUi === 'jeda' || modeUi === 'judul' || modeUi === 'selesai') bukaKitab(modeUi);
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
misi.saatSegmenMulai = (titik) => {
  titik.waktu = waktuMisi;
  status.simpanTitik(titik);
};
misi.saatSelesai = () => mulaiSinematikPerahu();

// --- Layar awal, sinematik perahu, layar selesai --------------------------------------------

/** Posisi dan arah perahu saat misi mulai, untuk dikembalikan saat main lagi. */
const asalPerahu = { posisi: dunia.perahu.grup.position.clone(), putar: dunia.perahu.grup.rotation.y };
/** Posisi kapsul di geladak perahu (koordinat lokal perahu): pemain di depan, pengikut di belakang. */
const TEMPAT_DI_PERAHU = [
  [1.6, 0.4],
  [0.2, -0.5],
  [-0.9, 0.5],
  [-2.0, -0.4],
  [-2.6, 0.5],
];
let sisaSinematik = 0;
const LAMA_SINEMATIK = 4;
const LAJU_PERAHU = 1.2; // m/s, bergerak pelan menjauh
const poseSinematikPerahu: PoseKamera = { posisi: new THREE.Vector3(), sasaran: new THREE.Vector3() };
let isiSelesaiTerakhir = { sejarah: '', kutipan: '', ringkasan: [] as string[], catatan: '' };

function mulaiSinematikPerahu(): void {
  modeUi = 'sinematik';
  sisaSinematik = LAMA_SINEMATIK;
  hud.tampilkanAksi(null);
  if (document.pointerLockElement) document.exitPointerLock();
  const perahu = dunia.perahu.grup;
  // Kamera di tepian, agak tinggi, memandang perahu yang menjauh.
  poseSinematikPerahu.posisi.set(perahu.position.x + 9, perahu.position.y + 4, perahu.position.z + 7);
  taruhRombonganDiPerahu();
}

function taruhRombonganDiPerahu(): void {
  const perahu = dunia.perahu;
  const kapsul = [pemain.posisi, ...pengikut.aktif.map((p) => p.posisi)];
  const titik = new THREE.Vector3();
  kapsul.forEach((pos, i) => {
    const t = TEMPAT_DI_PERAHU[Math.min(i, TEMPAT_DI_PERAHU.length - 1)];
    titik.set(t[0], 0, t[1]);
    perahu.grup.localToWorld(titik);
    pos.set(titik.x, perahu.geladak, titik.z);
  });
  pemain.hadapKe(pemain.posisi.x - Math.cos(perahu.grup.rotation.y) * 10, pemain.posisi.z + Math.sin(perahu.grup.rotation.y) * 10);
}

function perbaruiSinematikPerahu(dt: number): void {
  const perahu = dunia.perahu.grup;
  perahu.position.x -= Math.cos(perahu.rotation.y) * LAJU_PERAHU * dt;
  perahu.position.z += Math.sin(perahu.rotation.y) * LAJU_PERAHU * dt;
  perahu.position.y = asalPerahu.posisi.y + Math.sin(waktuMisi * 1.7) * 0.05;
  taruhRombonganDiPerahu();
  poseSinematikPerahu.sasaran.set(perahu.position.x, perahu.position.y + 1.2, perahu.position.z);
  kameraOrangKetiga.sinematik = poseSinematikPerahu;
  sisaSinematik -= dt;
  if (sisaSinematik <= 0) {
    kameraOrangKetiga.sinematik = null;
    bukaPanel([], 1.2, tampilkanSelesai);
  }
}

function tampilkanSelesai(): void {
  const n = rombongan.nilai;
  const rute = status.tanda.has('rute-sungai') ? 'sungai' : status.tanda.has('rute-bukit') ? 'bukit' : null;
  const hasil: HasilMisi = { pengikutTiba: n.pengikut, pagon: n.pagon, rute, kewaspadaanDaha: n.kewaspadaan, kaliKetahuan: n.kaliKetahuan, waktu: waktuMisi };
  status.selesaikanMisi(hasil);
  const teks = TEKS_SELESAI;
  const S = UI.selesai;
  isiSelesaiTerakhir = {
    sejarah: teks.sejarah,
    kutipan: teks.kutipan,
    ringkasan: [
      isiPola(S.pengikut, { n: n.pengikut, awal: ATURAN.awal.pengikut }),
      isiPola(S.pagon, { nilai: n.pagon === 'ikut' ? S.pagonIkut : S.pagonDitinggal }),
      isiPola(S.rute, { nilai: rute === 'sungai' ? S.ruteSungai : S.ruteBukit }),
      isiPola(S.ketahuan, { n: n.kaliKetahuan }),
      isiPola(S.kitab, { n: status.kitab.length, total: KITAB_PER_ID.size }),
      isiPola(S.waktu, { menit: Math.floor(waktuMisi / 60), detik: Math.floor(waktuMisi % 60) }),
    ],
    catatan: n.pagon === 'ikut' ? teks.catatanPagonIkut : teks.catatanPagonDitinggal,
  };
  modeUi = 'selesai';
  layarSelesai.buka(isiSelesaiTerakhir);
}

function kembaliKeJudul(): void {
  layarSelesai.tutup();
  menuJeda.tutup();
  dunia.perahu.grup.position.copy(asalPerahu.posisi);
  dunia.perahu.grup.rotation.y = asalPerahu.putar;
  kameraOrangKetiga.sinematik = null;
  tarung.hidupkan();
  misi.siapkan();
  modeUi = 'judul';
  layarJudul.buka(status.titikSimpan !== null);
}

layarJudul.saatMulaiBaru = () => {
  layarJudul.tutup();
  status.ulangMisi();
  waktuMisi = 0;
  modeUi = 'main';
  misi.mulai();
};
layarJudul.saatLanjutkan = () => {
  const titik = status.titikSimpan;
  if (!titik) return;
  layarJudul.tutup();
  waktuMisi = titik.waktu;
  modeUi = 'main';
  misi.lanjutkan(titik);
};
layarJudul.saatKitab = () => bukaKitab('judul');
layarSelesai.saatKitab = () => bukaKitab('selesai');
layarSelesai.saatMainLagi = kembaliKeJudul;

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
  waktuMisi = 0;
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

// Layar awal: dunia terpasang di belakangnya, misi mulai dari tombol.
misi.siapkan();
layarJudul.buka(status.titikSimpan !== null);

const jam = new THREE.Timer();
renderer.setAnimationLoop(() => {
  jam.update();
  const dtMentah = jam.getDelta();
  const dtNyata = Math.min(dtMentah, 0.05); // dibatasi supaya tidak melompat jauh saat tab tidak aktif
  let dt = 0;
  document.body.classList.toggle('lapisan-aktif', modeUi !== 'main');
  if (modeUi === 'main' || modeUi === 'dialog' || modeUi === 'panel' || modeUi === 'sinematik') waktuMisi += dtNyata;
  if (modeUi === 'kitab' || modeUi === 'jeda' || modeUi === 'judul' || modeUi === 'selesai') {
    // Permainan berhenti; tidak ada yang bergerak.
  } else if (modeUi === 'panel') {
    panel.perbarui(dtNyata);
  } else if (modeUi === 'sinematik') {
    perbaruiSinematikPerahu(dtNyata);
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
    npc, kitab: uiKitab, menu: menuJeda, bukaKitab, bukaMenu, pemicu, rombongan, hudRombongan, misi, panel, dunia, layarJudul, layarSelesai,
    perbaruiSinematikPerahu, tampilkanSelesai,
    get waktuMisi() {
      return waktuMisi;
    },
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
