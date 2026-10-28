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
import { ATURAN, DUNIA_MISI, PENGIKUT_TOKOH, GAYA_PEMANDU } from './mission/config';
import { Pemandu } from './world/guide';
import type { GayaPemandu } from './world/guide-config';
import { Subtitle } from './ui/subtitle';
import { PenunjukJalan } from './mission/guide-hint';
import { Peta } from './ui/map';
import { PENGATURAN, kualitasDariFps } from './ui/settings';
import { INPUT } from './character/gamepad';
import type { Pengaturan, Kualitas } from './mission/state';
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
import { CatatanPlaytest } from './mission/playtest';
import { HudKejadian } from './ui/event-hud';
import { PengelolaKejadian, undi } from './mission/events';
import { PemutarPanel } from './mission/panels';
import { PROLOG, validasiProlog } from './mission/prolog-config';

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
// Pemandu arah (sprint 6): partikel (Tab), Nambi penunjuk jalan dengan subtitle, peta (M).
const pemandu = new Pemandu(scene, GAYA_PEMANDU as GayaPemandu);
const subtitle = new Subtitle();
const peta = new Peta(dunia);

// Status permainan, dialog, dan Kitab.
const status = new StatusPermainan();
/** Menerapkan pengaturan pemain ke huruf, kamera, dan kualitas render. */
function terapkanKualitas(k: Kualitas): void {
  const preset = PENGATURAN.kualitas[k];
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, preset.rasioPiksel));
  renderer.setSize(window.innerWidth, window.innerHeight);
  dunia.matahari.castShadow = preset.bayangan;
}
function terapkanPengaturan(p: Pengaturan): void {
  terapkanUkuranHuruf(p.ukuranHuruf);
  kameraOrangKetiga.kepekaanMouse = p.kepekaanMouse;
  kameraOrangKetiga.kepekaanStik = p.kepekaanStik;
  kameraOrangKetiga.balikY = p.balikY;
  terapkanKualitas(p.kualitas ?? 'sedang');
  document.dispatchEvent(new Event('pengaturan-berubah'));
}
status.saatPengaturan = terapkanPengaturan;
terapkanPengaturan(status.pengaturan);
// Kualitas dipilih otomatis sekali dari fps rata-rata beberapa detik render pertama yang terlihat.
let ukurFrame = 0;
let ukurDetik = 0;
function ukurKualitasOtomatis(dt: number): void {
  if (status.pengaturan.kualitas !== null || document.visibilityState !== 'visible' || dt > 0.1) return;
  ukurFrame += 1;
  ukurDetik += dt;
  if (ukurDetik < PENGATURAN.otomatis.lamaUkur) return;
  const fps = ukurFrame / ukurDetik;
  const k = kualitasDariFps(fps);
  if (import.meta.env.DEV) console.log(`[pengaturan] fps rata-rata ${fps.toFixed(0)}, kualitas otomatis: ${k}`);
  status.aturPengaturan({ kualitas: k });
}
for (const pesan of [...validasiKitab(), ...validasiDialog(), ...validasiProlog()]) console.warn(`[data] ${pesan}`);
// Rombongan: variabel misi yang berubah lewat tanda dialog (aturan di misi3.json).
const rombongan = new Rombongan();
const hudRombongan = new HudRombongan(rombongan);
rombongan.saatBerubah = (p) => hudRombongan.tampilkanPerubahan(p);
status.saatTanda = (tanda) => {
  rombongan.terapkanTanda(tanda);
  // Obor dari kepala desa (sprint 7): diumumkan sekali saat tanda pemberinya muncul.
  if (ATURAN.obor.dariTanda.includes(tanda) && !pemain.punyaObor) hudRombongan.umumkan(ATURAN.obor.teks);
};
siluman.saatKetahuan = () => {
  rombongan.ketahuan();
  catatan.ketahuan(pemain.posisi.x, pemain.posisi.z);
};

// Catatan playtest (sprint 6): aktif hanya dengan ?playtest=1; merekam ke localStorage.
const catatan = new CatatanPlaytest(() => waktuMisi);
if (catatan.aktif) {
  const lencana = document.createElement('div');
  lencana.className = 'playtest-lencana';
  lencana.textContent = UI.playtest.lencana;
  document.body.append(lencana);
}
const mesinDialog = new MesinDialog(status);
mesinDialog.saatPilih = (percakapan, simpul, indeks, nada) => catatan.pilihanDialog(percakapan, simpul, indeks, nada);
const uiDialog = new UiDialog(mesinDialog, status);
const uiKitab = new UiKitab(status);
const pemberitahuan = new PemberitahuanKitab();
status.saatKitabTerbuka = (id) => {
  pemberitahuan.tambah(id);
  catatan.kitabTerbuka(id);
};
uiKitab.saatBaca = (id, detik) => catatan.kitabDibaca(id, detik);
const menuJeda = new MenuJeda(status);
const hudTujuan = new HudTujuan();
const panel = new PanelNaskah();
const layarJudul = new LayarJudul();
const layarSelesai = new LayarSelesai();
// Prolog (misi 1): panel teks dari misi1.json; entri Kitab tiap panel dibuka saat panel tampil,
// pemberitahuannya baru muncul setelah kembali ke mode main.
const prolog = new PemutarPanel();
prolog.saatPanel = (p) => {
  for (const id of p.bukaKitab) status.bukaKitab(id);
};
/** Mode UI: logika permainan hanya berjalan saat 'main'. */
type ModeUi = 'judul' | 'main' | 'dialog' | 'kitab' | 'jeda' | 'panel' | 'sinematik' | 'selesai' | 'peta' | 'prolog';
let modeUi: ModeUi = 'judul';
/** Mode yang dikembalikan saat Kitab ditutup (dibuka dari permainan, menu jeda, layar awal, atau layar selesai). */
let asalKitab: 'main' | 'jeda' | 'judul' | 'selesai' = 'main';
/** Mode yang dikembalikan saat peta ditutup. */
let asalPeta: 'main' | 'jeda' = 'main';
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
function bukaPeta(asal: 'main' | 'jeda'): void {
  asalPeta = asal;
  modeUi = 'peta';
  if (document.pointerLockElement) document.exitPointerLock();
  menuJeda.tutup();
  hud.tampilkanAksi(null);
  peta.buka();
  catatan.petunjuk('peta', pemain.posisi.x, pemain.posisi.z);
}
function tutupPeta(): void {
  peta.tutup();
  modeUi = asalPeta;
  if (modeUi === 'jeda') menuJeda.buka();
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
menuJeda.saatPeta = () => bukaPeta('jeda');
peta.saatTutup = tutupPeta;

// Esc: menu jeda (saat pointer sudah lepas); K: Kitab; M: peta. Dialog dan panel mengurus tombolnya sendiri.
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'Escape') {
    if (document.pointerLockElement) return; // peramban sedang melepas pointer lock
    if (modeUi === 'kitab') tutupKitab();
    else if (modeUi === 'peta') tutupPeta();
    else if (modeUi === 'jeda') tutupMenu();
    else if (modeUi === 'main' && !tarung.mati) bukaMenu();
  } else if (e.code === 'KeyM') {
    if (modeUi === 'peta') tutupPeta();
    else if (modeUi === 'main' && !tarung.mati) bukaPeta('main');
    else if (modeUi === 'jeda') bukaPeta('jeda');
  } else if (e.code === 'KeyK') {
    if (modeUi === 'kitab') tutupKitab();
    else if (modeUi === 'main' && !tarung.mati) bukaKitab('main');
    else if (modeUi === 'jeda' || modeUi === 'judul' || modeUi === 'selesai') bukaKitab(modeUi);
  }
});
// Esc saat pointer terkunci: peramban melepas kunci lebih dulu; begitu lepas, langsung buka menu jeda
// (satu kali Esc), kecuali pelepasan itu dilakukan kode (dialog, Kitab, peta: mode sudah bukan 'main').
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement) return;
  if (modeUi === 'main' && !tarung.mati) bukaMenu();
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

const hudTarung = new HudPertarungan(() => ulangiDariTitikSimpan());

// Kejadian di jalur (sprint 7): harimau, perampok, buaya, longsor, desertir, babi.
const hudKejadian = new HudKejadian();
const kejadian = new PengelolaKejadian({
  scene,
  tabrakan: dunia.tabrakan,
  lawan,
  siluman,
  status,
  rombongan,
  npc,
  pemain,
  pengikut,
  hud: hudKejadian,
  umumkan: (teks) => hudTarung.umumkan(teks),
  mulaiDialog,
  gamepadTerakhir: () => input.gamepadTerakhir,
  pemainMenyerang: () => tarung.sedangMenyerang,
  aksiDitahan: () => input.aksiDitekan('bicara'),
  tarung,
});

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
  kejadian,
});
for (const pesan of misi.validasi()) console.warn(`[data] ${pesan}`);
misi.saatSegmenMulai = (titik) => {
  titik.waktu = waktuMisi;
  status.simpanTitik(titik);
  catatan.masukSegmen(titik.segmen);
};
/** Penanda langkah baru yang menunggu arahan kamera: dijalankan begitu permainan kembali ke mode main tanpa pertarungan. */
let arahanTertunda: [number, number] | null = null;
misi.saatLangkahBaru = (penanda) => {
  arahanTertunda = penanda;
};
const penunjuk = new PenunjukJalan(pengikut, subtitle);
penunjuk.saatTunjuk = () => catatan.petunjuk('nambi', pemain.posisi.x, pemain.posisi.z);
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
  // Desertir yang ikut (sprint 7): kesetiaannya diundi dari benih misi; tidak setia = tanda desertir-khianat.
  let catatanDesertir = '';
  if (status.tanda.has('desertir-ikut')) {
    const setia = undi(status.titikSimpan?.benih ?? 0, 'desertir-setia') < ATURAN.desertir.peluangSetia;
    if (!setia) status.tandai('desertir-khianat');
    catatanDesertir = setia ? TEKS_SELESAI.desertir.setia : TEKS_SELESAI.desertir.khianat;
  }
  const n = rombongan.nilai;
  const rute = status.tanda.has('rute-sungai') ? 'sungai' : status.tanda.has('rute-bukit') ? 'bukit' : null;
  const hasil: HasilMisi = { pengikutTiba: n.pengikut, pagon: n.pagon, rute, kewaspadaanDaha: n.kewaspadaan, kaliKetahuan: n.kaliKetahuan, waktu: waktuMisi };
  status.selesaikanMisi(hasil);
  catatan.selesaiMisi(hasil);
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
      // Kejadian di jalur (sprint 7): satu baris per tanda yang ada, urutan seperti di misi3.json.
      ...Object.entries(teks.kejadian as Record<string, string>)
        .filter(([tanda]) => tanda !== 'keterangan' && status.tanda.has(tanda))
        .map(([, baris]) => baris),
    ],
    catatan: [n.pagon === 'ikut' ? teks.catatanPagonIkut : teks.catatanPagonDitinggal, catatanDesertir].filter(Boolean).join(' '),
  };
  modeUi = 'selesai';
  layarSelesai.tampilkanUnduh(catatan.aktif);
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

/** Memutar prolog; `setelah` dipanggil begitu penutupnya selesai. Waktu prolog tidak dihitung ke waktuMisi. */
function mulaiProlog(setelah: () => void): void {
  modeUi = 'prolog';
  hud.tampilkanAksi(null);
  if (document.pointerLockElement) document.exitPointerLock();
  prolog.mulai(PROLOG, (hasil) => {
    status.selesaikanProlog();
    catatan.prolog(hasil);
    setelah();
  });
}
/** Tujuan setelah prolog menurut `penutup.lanjutKe` (selama prototipe hanya misi 3). */
function lanjutSetelahProlog(): void {
  modeUi = 'main';
  misi.mulai();
}

layarJudul.saatMulaiBaru = () => {
  layarJudul.tutup();
  status.ulangMisi();
  catatan.mulaiSesi();
  peta.reset();
  waktuMisi = 0;
  mulaiProlog(lanjutSetelahProlog);
};
// Putar ulang prolog dari layar awal: kembali ke layar awal, simpanan tidak disentuh.
layarJudul.saatProlog = () => {
  layarJudul.tutup();
  mulaiProlog(() => {
    modeUi = 'judul';
    layarJudul.buka(status.titikSimpan !== null);
  });
};
layarJudul.saatLanjutkan = () => {
  const titik = status.titikSimpan;
  if (!titik) return;
  layarJudul.tutup();
  waktuMisi = titik.waktu;
  catatan.mulaiSesi(true);
  modeUi = 'main';
  misi.lanjutkan(titik);
};
layarJudul.saatKitab = () => bukaKitab('judul');
layarSelesai.saatKitab = () => bukaKitab('selesai');
layarSelesai.saatMainLagi = kembaliKeJudul;
layarSelesai.saatUnduh = () => catatan.unduh();
tarung.saatMati = () => catatan.gugur(pemain.posisi.x, pemain.posisi.z);

/** Gugur: kembali ke titik simpan segmen. */
function ulangiDariTitikSimpan(): void {
  tarung.hidupkan();
  misi.muatUlangSegmen();
}
tarung.saatTikaman = (pertama) => {
  if (pertama) hudTarung.umumkan(UI.tarung.jurusTikaman);
};
menuJeda.saatUlangMisi = () => {
  status.ulangMisi();
  catatan.mulaiSesi();
  tarung.hidupkan();
  tutupMenu();
  peta.reset();
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

// --- Gamepad di luar permainan: menu, dialog, panel ------------------------------------------

/** Tombol yang terlihat di lapisan UI yang sedang aktif, untuk dijelajahi D-pad. */
function tombolLapisanAktif(): HTMLButtonElement[] {
  const pemilih =
    modeUi === 'jeda' ? '.menu-lapis.tampil button'
    : modeUi === 'judul' ? '.judul-lapis.tampil button'
    : modeUi === 'selesai' ? '.selesai-lapis.tampil button'
    : modeUi === 'peta' ? '.peta-lapis.tampil button'
    : modeUi === 'main' && tarung.mati ? '.layar-mati.tampil button'
    : null;
  if (!pemilih) return [];
  return [...document.querySelectorAll<HTMLButtonElement>(pemilih)].filter((b) => b.offsetParent !== null);
}
function geserFokusPad(arah: number): void {
  const daftar = tombolLapisanAktif();
  if (daftar.length === 0) return;
  const sekarang = daftar.findIndex((b) => b.classList.contains('pad-fokus'));
  const berikut = sekarang < 0 ? (arah > 0 ? 0 : daftar.length - 1) : (sekarang + arah + daftar.length) % daftar.length;
  document.querySelectorAll('.pad-fokus').forEach((b) => b.classList.remove('pad-fokus'));
  daftar[berikut].classList.add('pad-fokus');
}
function tekanTombolTerfokus(): void {
  const daftar = tombolLapisanAktif();
  const fokus = daftar.find((b) => b.classList.contains('pad-fokus')) ?? daftar[0];
  if (fokus) fokus.click();
  document.querySelectorAll('.pad-fokus').forEach((b) => b.classList.remove('pad-fokus'));
}
const kirimTombol = (code: string): void => {
  window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
};
/** Dipanggil tiap frame: Start, Select, A, B, D-pad di menu, dialog, dan panel. */
function perbaruiGamepadUi(): void {
  if (!input.gamepadTersambung) return;
  if (input.padBaru('jeda')) {
    if (modeUi === 'main' && !tarung.mati) bukaMenu();
    else if (modeUi === 'jeda') tutupMenu();
    else if (modeUi === 'peta') tutupPeta();
    else if (modeUi === 'kitab') tutupKitab();
    return;
  }
  if (input.padBaru('peta')) {
    if (modeUi === 'peta') tutupPeta();
    else if (modeUi === 'main' && !tarung.mati) bukaPeta('main');
    else if (modeUi === 'jeda') bukaPeta('jeda');
    return;
  }
  if (modeUi === 'prolog') {
    // A melengkapi ketikan atau lanjut; B melewati prolog kalau sudah boleh.
    if (input.padBaru('dialogLanjut')) prolog.lanjut();
    else if (input.padBaru('menuKembali')) prolog.lewati();
    return;
  }
  if (modeUi === 'dialog' || modeUi === 'panel') {
    if (input.padBaru('dialogLanjut')) kirimTombol('Space');
    const pilihan = input.padPilihanDialog();
    if (pilihan >= 0 && document.querySelector('.dialog-pilihan.tampil')) kirimTombol(`Digit${pilihan + 1}`);
    return;
  }
  if (input.padBaru('menuKembali')) {
    if (modeUi === 'jeda') {
      if (menuJeda.diPengaturan) menuJeda.kembaliKeUtama();
      else tutupMenu();
    } else if (modeUi === 'peta') tutupPeta();
    else if (modeUi === 'kitab') tutupKitab();
    return;
  }
  if (input.padBaru('menuAtas')) geserFokusPad(-1);
  else if (input.padBaru('menuBawah')) geserFokusPad(1);
  else if (input.padBaru('menuPilih')) tekanTombolTerfokus();
}

/** Petunjuk tombol HUD mengikuti alat masukan yang terakhir dipakai. */
let petunjukGamepad = false;
function perbaruiPetunjuk(): void {
  if (input.gamepadTerakhir === petunjukGamepad) return;
  petunjukGamepad = input.gamepadTerakhir;
  hud.aturPetunjuk(petunjukGamepad ? INPUT.gamepad.petunjuk : UI.hud.petunjuk);
}

/** Kamera (termasuk arahan ke penanda langkah baru) dan efek pemandu: partikel, subtitle, pendar obor. */
function perbaruiKameraDanPemandu(dt: number): void {
  // Arahan kamera hanya saat bermain bebas: tidak bertarung, tidak dalam sinematik, tidak gugur.
  if (arahanTertunda && modeUi === 'main' && sisaWaktuTarung <= 0 && !kameraOrangKetiga.sinematik && !tarung.mati) {
    kameraOrangKetiga.arahkanKe(arahanTertunda[0], arahanTertunda[1]);
    arahanTertunda = null;
  }
  kameraOrangKetiga.perbarui(dt, input, pemain.posisi);
  dunia.hutan.perbaruiLod(camera.position);
  if (modeUi === 'main' || modeUi === 'dialog' || modeUi === 'panel' || modeUi === 'sinematik') {
    pemandu.perbarui(dt);
    subtitle.perbarui(dt);
  }
  misi.perbaruiPenanda(dt, camera.position);
}

/** Satu langkah logika permainan (mode 'main'): pemain, pengikut, penjaga, pemicu, NPC. */
function perbaruiPermainan(dt: number): void {
  // Rombongan membatasi laju (Gajah Pagon ikut, pengikut tumbang) dan mempercepat curiga penjaga.
  pemain.batasLaju = rombongan.lajuMaks;
  pengikut.batasLaju = rombongan.lajuMaks;
  pengikut.pagonIkut = rombongan.pagonIkut;
  siluman.pengaliCuriga = rombongan.pengaliCuriga;
  pemain.punyaObor = ATURAN.obor.dariTanda.some((t) => status.tanda.has(t));

  const perintah = tarung.perbarui(dt, input, kameraOrangKetiga.yaw);
  pemain.perbarui(dt, input, kameraOrangKetiga.yaw, perintah);
  if (pemain.baruSelesaiMemanjat) pengikut.susulkanSetelahPanjat(pemain, camera);
  siluman.perbarui(pemain, pengikut.aktif, dt);
  pengikut.perbarui(dt, pemain, siluman.konteks.pemain, lawan.daftar, camera);
  lawan.perbarui(dt, pemain, tarung);
  if (!tarung.mati) kejadian.perbarui(dt);

  // Pemicu Kitab dan pemicu segmen misi.
  const tenang = lawan.jarakTerdekat(pemain.posisi) >= KONFIG.kamera.jarakDeteksi;
  pemicu.perbarui(pemain.posisi, !tenang);
  if (!tarung.mati) misi.perbarui(pemain.posisi);

  // Pemandu arah: Tab memancarkan partikel ke penanda terdekat; Nambi menunjuk jalan kalau pemain lama tidak mendekat.
  const penanda = misi.penandaTerdekat(pemain.posisi.x, pemain.posisi.z);
  if (input.aksiBaru('pemandu') && penanda && !tarung.mati) {
    pemandu.pancarkan(pemain.posisi, penanda);
    catatan.petunjuk('kunang', pemain.posisi.x, pemain.posisi.z);
  }
  penunjuk.perbarui(dt, pemain.posisi, penanda, tenang && !tarung.mati && !siluman.konteks.pemain.tersembunyi);
  peta.catatKunjungan(pemain.posisi.x, pemain.posisi.z);

  // NPC dekat: tampilkan "E: Bicara" dan mulai percakapan; tidak saat ada lawan bertarung di dekat pemain.
  // Kalau tidak ada NPC, tombol yang sama dipakai kejadian di jalur (misalnya "E: Lempar bekal").
  const npcDekat = modeUi === 'main' && tenang && !tarung.mati && pemain.diTanah ? npc.terdekat(pemain.posisi, UI.npc.jarak) : null;
  const petunjukKejadian = !tarung.mati ? kejadian.petunjuk() : null;
  hud.tampilkanAksi(npcDekat ? (input.gamepadTerakhir ? UI.npc.bicaraPad : UI.npc.bicara) : petunjukKejadian);
  if (npcDekat && input.aksiBaru('bicara')) {
    npcDekat.hadapKe(pemain.posisi.x, pemain.posisi.z);
    mulaiDialog(npcDekat.percakapanBerikut(status), npcDekat.posisi);
  } else if (petunjukKejadian && input.aksiBaru('bicara')) {
    kejadian.tekanAksi();
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
  input.perbaruiGamepad();
  perbaruiGamepadUi();
  perbaruiPetunjuk();
  ukurKualitasOtomatis(dtMentah);
  document.body.classList.toggle('lapisan-aktif', modeUi !== 'main');
  if (modeUi === 'main' || modeUi === 'dialog' || modeUi === 'panel' || modeUi === 'sinematik') waktuMisi += dtNyata;
  if (modeUi === 'kitab' || modeUi === 'jeda' || modeUi === 'judul' || modeUi === 'selesai' || modeUi === 'peta') {
    // Permainan berhenti; tidak ada yang bergerak.
    if (modeUi === 'peta') peta.perbarui(dtNyata, pemain.posisi, pemain.hadap, misi.penandaSekarang);
  } else if (modeUi === 'panel') {
    panel.perbarui(dtNyata);
  } else if (modeUi === 'prolog') {
    prolog.perbarui(dtNyata);
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

  perbaruiKameraDanPemandu(dtNyata);
  ikutkanMatahari();
  hud.perbarui(dtMentah, input.terkunci || tarung.mati || modeUi !== 'main');
  pemberitahuan.perbarui(dtNyata, modeUi !== 'main');
  hudRombongan.perbarui(dtNyata, modeUi !== 'main');
  hudTarung.perbarui(dt, pemain, lawan.daftar, tarung, camera);
  hudSiluman.perbarui(siluman.penjaga, siluman.konteks.pemain, camera);
  hudKejadian.perbarui(dtNyata, camera, modeUi !== 'main');
  input.akhirFrame();

  renderer.render(scene, camera);
});

// Pegangan untuk pengujian di konsol browser, hanya saat pengembangan.
if (import.meta.env.DEV) {
  (window as unknown as { nusantara: unknown }).nusantara = {
    pemain, kamera: kameraOrangKetiga, tarung, lawan, siluman, pengikut, input, status, dialog: mesinDialog, uiDialog, mulaiDialog,
    npc, kitab: uiKitab, menu: menuJeda, bukaKitab, bukaMenu, pemicu, rombongan, hudRombongan, misi, panel, dunia, layarJudul, layarSelesai,
    perbaruiSinematikPerahu, tampilkanSelesai, pemandu, penunjuk, subtitle, peta, terapkanKualitas, catatan, kejadian, hudKejadian, prolog,
    get waktuMisi() {
      return waktuMisi;
    },
    langkah: (dt: number) => {
      // Satu langkah logika permainan tanpa render, untuk bot uji; hanya berarti di mode 'main'.
      if (modeUi !== 'main') return;
      tarung.perbaruiEfek(dt);
      perbaruiPermainan(dt);
      perbaruiKameraDanPemandu(dt);
      input.akhirFrame();
    },
    get modeUi() {
      return modeUi;
    },
  };
}
