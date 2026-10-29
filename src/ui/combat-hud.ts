import * as THREE from 'three';
import type { Pemain } from '../character/player';
import type { Lawan } from '../combat/enemy';
import { antreanAngkaDamage } from '../combat/health';
import type { PertarunganPemain } from '../combat/player-combat';
import { UI, isiPola } from './config';

const JARAK_BILAH_LAWAN = 12; // bilah nyawa lawan hanya tampil dalam jarak ini
const JARAK_PENANDA = 5; // penanda kunci hilang kalau sasaran lebih jauh dari ini
const UMUR_ANGKA = 0.9; // detik angka damage melayang
const LAMA_PEMBERITAHUAN = 2.0; // detik nama jurus tampil di tengah layar

interface AngkaMelayang {
  el: HTMLDivElement;
  posisi: THREE.Vector3;
  umur: number;
}

/**
 * HUD pertarungan: bilah nyawa pemain di kiri bawah, bilah nyawa kecil di atas lawan dekat,
 * penanda lawan yang dikunci, angka damage melayang, dan layar gugur dengan tombol Ulangi.
 */
export class HudPertarungan {
  private readonly nyawaIsi: HTMLDivElement;
  private readonly nyawaTeks: HTMLDivElement;
  private readonly bilahLawan = new Map<Lawan, HTMLDivElement>();
  private readonly penanda: HTMLDivElement;
  private readonly layarMati: HTMLDivElement;
  private readonly pemberitahuan: HTMLDivElement;
  private readonly petunjukSergap: HTMLDivElement;
  /** Teks petunjuk Sergap di dekat sasaran ("Klik kiri: Sergap" atau "X: Sergap"); diatur main. */
  teksSergap = '';
  private sisaPemberitahuan = 0;
  private readonly angka: AngkaMelayang[] = [];
  private readonly proyeksi = new THREE.Vector3();
  private layarMatiTampil = false;

  constructor(private onUlangi: () => void) {
    const nyawa = document.createElement('div');
    nyawa.className = 'hud hud-nyawa';
    const bilah = document.createElement('div');
    bilah.className = 'bilah bilah-pemain';
    this.nyawaIsi = document.createElement('div');
    this.nyawaIsi.className = 'bilah-isi';
    bilah.append(this.nyawaIsi);
    this.nyawaTeks = document.createElement('div');
    this.nyawaTeks.className = 'hud-nyawa-teks';
    nyawa.append(this.nyawaTeks, bilah);

    this.penanda = document.createElement('div');
    this.penanda.className = 'hud hud-penanda';
    this.penanda.textContent = UI.tarung.penanda;

    this.layarMati = document.createElement('div');
    this.layarMati.className = 'layar-mati';
    const judul = document.createElement('div');
    judul.className = 'layar-mati-judul';
    judul.textContent = UI.tarung.gugur;
    const tombol = document.createElement('button');
    tombol.className = 'layar-mati-tombol';
    tombol.textContent = UI.tarung.ulangi;
    tombol.addEventListener('click', () => this.onUlangi());
    this.layarMati.append(judul, tombol);

    this.pemberitahuan = document.createElement('div');
    this.pemberitahuan.className = 'hud hud-jurus';

    this.petunjukSergap = document.createElement('div');
    this.petunjukSergap.className = 'hud hud-sergap';

    document.body.append(nyawa, this.penanda, this.layarMati, this.pemberitahuan, this.petunjukSergap);
  }

  /** Menampilkan nama jurus sebentar di tengah layar, misalnya saat jurus pertama kali berhasil. */
  umumkan(teks: string): void {
    this.pemberitahuan.textContent = teks;
    this.pemberitahuan.classList.add('tampil');
    this.sisaPemberitahuan = LAMA_PEMBERITAHUAN;
  }

  perbarui(dt: number, pemain: Pemain, lawanSemua: Lawan[], tarung: PertarunganPemain, kamera: THREE.Camera): void {
    // Bilah nyawa pemain.
    this.nyawaIsi.style.width = `${tarung.nyawa.rasio * 100}%`;
    this.nyawaTeks.textContent = isiPola(UI.tarung.nyawa, { nama: UI.tarung.namaPemain, sekarang: Math.ceil(tarung.nyawa.sekarang), maks: tarung.nyawa.maks });

    // Bilah nyawa lawan dekat dan penanda kunci.
    let penandaTampil = false;
    for (const lawan of lawanSemua) {
      let el = this.bilahLawan.get(lawan);
      if (!el) {
        el = document.createElement('div');
        el.className = 'hud bilah bilah-lawan';
        const isi = document.createElement('div');
        isi.className = 'bilah-isi';
        el.append(isi);
        document.body.append(el);
        this.bilahLawan.set(lawan, el);
      }
      const jarak = Math.hypot(lawan.posisi.x - pemain.posisi.x, lawan.posisi.z - pemain.posisi.z);
      const titik = lawan.bertarung && jarak < JARAK_BILAH_LAWAN ? this.keLayar(lawan.posisi, 2.1, kamera) : null;
      if (!titik) {
        el.style.display = 'none';
        continue;
      }
      el.style.display = 'block';
      el.style.transform = `translate(${titik.x}px, ${titik.y}px) translate(-50%, -100%)`;
      (el.firstElementChild as HTMLDivElement).style.width = `${lawan.nyawa.rasio * 100}%`;

      if (tarung.sasaranTerkunci === lawan && jarak < JARAK_PENANDA) {
        penandaTampil = true;
        this.penanda.style.transform = `translate(${titik.x}px, ${titik.y - 14}px) translate(-50%, -100%)`;
      }
    }
    this.penanda.style.display = penandaTampil ? 'block' : 'none';

    // Petunjuk Sergap kecil di atas kepala sasaran yang memenuhi syarat.
    const sasaranSergap = tarung.sasaranSergap;
    const titikSergap = sasaranSergap && this.teksSergap ? this.keLayar(sasaranSergap.posisi, 2.3, kamera) : null;
    if (titikSergap) {
      if (this.petunjukSergap.textContent !== this.teksSergap) this.petunjukSergap.textContent = this.teksSergap;
      this.petunjukSergap.style.display = 'block';
      this.petunjukSergap.style.transform = `translate(${titikSergap.x}px, ${titikSergap.y}px) translate(-50%, -100%)`;
    } else {
      this.petunjukSergap.style.display = 'none';
    }

    // Angka damage: ambil yang baru, lalu gerakkan yang ada.
    for (const a of antreanAngkaDamage) {
      const el = document.createElement('div');
      el.className = a.keLawan ? 'hud angka-damage' : 'hud angka-damage angka-pemain';
      el.textContent = isiPola(UI.tarung.damage, { jumlah: a.jumlah });
      document.body.append(el);
      this.angka.push({ el, posisi: a.posisi, umur: 0 });
    }
    antreanAngkaDamage.length = 0;
    for (let i = this.angka.length - 1; i >= 0; i--) {
      const a = this.angka[i];
      a.umur += dt;
      const titik = this.keLayar(a.posisi, 1.9 + a.umur * 0.9, kamera);
      if (a.umur >= UMUR_ANGKA || !titik) {
        a.el.remove();
        this.angka.splice(i, 1);
        continue;
      }
      a.el.style.transform = `translate(${titik.x}px, ${titik.y}px) translate(-50%, -50%)`;
      a.el.style.opacity = `${1 - a.umur / UMUR_ANGKA}`;
    }

    // Pemberitahuan jurus memudar lewat CSS setelah waktunya habis.
    if (this.sisaPemberitahuan > 0) {
      this.sisaPemberitahuan -= dt;
      if (this.sisaPemberitahuan <= 0) this.pemberitahuan.classList.remove('tampil');
    }

    // Layar gugur.
    if (tarung.mati !== this.layarMatiTampil) {
      this.layarMatiTampil = tarung.mati;
      this.layarMati.classList.toggle('tampil', tarung.mati);
      if (tarung.mati && document.pointerLockElement) document.exitPointerLock();
    }
  }

  /** Proyeksi titik dunia (ditambah tinggi `naik`) ke piksel layar; null kalau di belakang kamera. */
  private keLayar(pos: THREE.Vector3, naik: number, kamera: THREE.Camera): { x: number; y: number } | null {
    this.proyeksi.set(pos.x, pos.y + naik, pos.z).project(kamera);
    if (this.proyeksi.z > 1) return null;
    return {
      x: (this.proyeksi.x + 1) / 2 * window.innerWidth,
      y: (1 - this.proyeksi.y) / 2 * window.innerHeight,
    };
  }
}
