import type { DataProlog, PanelProlog } from './prolog-config';
import { UI, isiPola } from '../ui/config';

/** Hasil pemutaran prolog untuk catatan playtest. */
export interface HasilProlog {
  /** Detik nyata dari panel pertama sampai penutup selesai. */
  lama: number;
  dilewati: boolean;
  /** Nomor panel (dari 1) saat tombol lewati ditekan; null kalau tidak dilewati. */
  diPanel: number | null;
}

type Fase = 'diam' | 'panel' | 'penutup';

/**
 * Pemutar panel prolog (misi 1) dari data: layar gelap kecokelatan, kotak gambar (placeholder
 * selama prototipe), narasi diketik per huruf, lencana sumber, tombol lewati, dan penutup "1292.".
 * Klik, Spasi, atau Enter melengkapi ketikan lalu melanjutkan; Esc melewati kalau sudah boleh.
 * Gamepad diteruskan main.ts lewat `lanjut()` dan `lewati()`.
 */
export class PemutarPanel {
  private readonly lapis: HTMLDivElement;
  private readonly isi: HTMLDivElement;
  private readonly gambar: HTMLDivElement;
  private readonly narasi: HTMLDivElement;
  private readonly lencana: HTMLSpanElement;
  private readonly sumber: HTMLDivElement;
  private readonly petunjuk: HTMLDivElement;
  private readonly tombolLewati: HTMLButtonElement;
  private readonly penutup: HTMLDivElement;

  private data: DataProlog | null = null;
  private fase: Fase = 'diam';
  private indeks = 0;
  private teks = '';
  private hurufTampil = 0;
  private sisaPenutup = 0;
  private lama = 0;
  private dilewatiDi: number | null = null;
  private saatSelesai: ((hasil: HasilProlog) => void) | null = null;
  /** Dipanggil saat sebuah panel mulai tampil (main.ts membuka entri Kitabnya). */
  saatPanel: ((panel: PanelProlog) => void) | null = null;

  constructor() {
    this.lapis = document.createElement('div');
    this.lapis.className = 'prolog-lapis';
    this.isi = document.createElement('div');
    this.isi.className = 'prolog-isi';
    this.gambar = document.createElement('div');
    this.gambar.className = 'prolog-gambar';
    this.narasi = document.createElement('div');
    this.narasi.className = 'prolog-narasi';
    const kaki = document.createElement('div');
    kaki.className = 'prolog-kaki';
    this.petunjuk = document.createElement('div');
    this.petunjuk.className = 'prolog-petunjuk';
    this.petunjuk.textContent = UI.prolog.lanjut;
    const kotakSumber = document.createElement('div');
    kotakSumber.className = 'prolog-sumber-kotak';
    this.lencana = document.createElement('span');
    this.lencana.className = 'lencana';
    this.sumber = document.createElement('div');
    this.sumber.className = 'prolog-sumber';
    kotakSumber.append(this.lencana, this.sumber);
    kaki.append(this.petunjuk, kotakSumber);
    this.isi.append(this.gambar, this.narasi, kaki);

    this.tombolLewati = document.createElement('button');
    this.tombolLewati.className = 'prolog-lewati';
    this.tombolLewati.tabIndex = -1;
    this.tombolLewati.textContent = UI.prolog.lewati;
    this.tombolLewati.addEventListener('click', (e) => {
      e.stopPropagation();
      this.lewati();
    });

    this.penutup = document.createElement('div');
    this.penutup.className = 'prolog-penutup';

    this.lapis.append(this.isi, this.tombolLewati, this.penutup);
    document.body.append(this.lapis);

    this.lapis.addEventListener('click', () => this.lanjut());
    window.addEventListener('keydown', (e) => {
      if (this.fase === 'diam' || e.repeat) return;
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        this.lanjut();
      } else if (e.code === 'Escape') {
        this.lewati();
      }
    });
  }

  get aktif(): boolean {
    return this.fase !== 'diam';
  }

  /** Benar kalau tombol lewati sedang tampil. */
  get bolehLewati(): boolean {
    return this.fase === 'panel' && this.data !== null && this.indeks + 1 >= this.data.bolehLewatiSetelah;
  }

  /** Memutar dari panel pertama; `saatSelesai` dipanggil setelah penutup. */
  mulai(data: DataProlog, saatSelesai: (hasil: HasilProlog) => void): void {
    this.data = data;
    this.saatSelesai = saatSelesai;
    this.lama = 0;
    this.dilewatiDi = null;
    this.penutup.classList.remove('tampil');
    this.isi.classList.add('tampil');
    this.lapis.classList.add('tampil');
    this.tampilkanPanel(0);
  }

  /** Mengetik narasi dan menghitung mundur penutup; dipanggil tiap frame dengan dt nyata. */
  perbarui(dt: number): void {
    if (this.fase === 'diam') return;
    this.lama += dt;
    if (this.fase === 'panel') {
      if (this.hurufTampil >= this.teks.length) return;
      this.hurufTampil = Math.min(this.teks.length, this.hurufTampil + UI.dialog.hurufPerDetik * dt);
      this.terapkanHuruf();
    } else if (this.fase === 'penutup') {
      this.sisaPenutup -= dt;
      if (this.sisaPenutup <= 0) this.selesai();
    }
  }

  /** Klik, Spasi, atau A: lengkapi ketikan, atau ke panel berikutnya; setelah panel terakhir, penutup. */
  lanjut(): void {
    if (this.fase !== 'panel' || !this.data) return;
    if (this.hurufTampil < this.teks.length) {
      this.hurufTampil = this.teks.length;
      this.terapkanHuruf();
      return;
    }
    if (this.indeks + 1 < this.data.panel.length) this.tampilkanPanel(this.indeks + 1);
    else this.mulaiPenutup();
  }

  /** Tombol lewati, Esc, atau B: langsung ke penutup kalau sudah boleh. */
  lewati(): void {
    if (!this.bolehLewati) return;
    this.dilewatiDi = this.indeks + 1;
    this.mulaiPenutup();
  }

  private tampilkanPanel(i: number): void {
    if (!this.data) return;
    this.fase = 'panel';
    this.indeks = i;
    const p = this.data.panel[i];
    // Gambar belum ada selama prototipe: tampilkan id panel sebagai placeholder, misalnya "[relief: balairung]".
    this.gambar.textContent = isiPola(UI.prolog.placeholderGambar, { gaya: this.data.gaya[p.gaya] ?? p.gaya, id: p.id });
    this.gambar.dataset.gaya = p.gaya;
    this.teks = p.narasi;
    this.hurufTampil = 0;
    this.terapkanHuruf();
    const label = UI.kitab.label[p.label];
    this.lencana.className = `lencana lencana-${p.label}`;
    this.lencana.textContent = label.nama;
    this.lencana.dataset.keterangan = label.keterangan;
    this.lencana.title = label.keterangan;
    this.sumber.textContent = p.sumber;
    this.tombolLewati.classList.toggle('tampil', this.bolehLewati);
    this.saatPanel?.(p);
  }

  private terapkanHuruf(): void {
    this.narasi.textContent = this.teks.slice(0, Math.floor(this.hurufTampil));
  }

  private mulaiPenutup(): void {
    if (!this.data) return;
    this.fase = 'penutup';
    this.sisaPenutup = this.data.penutup.lamaTeks;
    this.tombolLewati.classList.remove('tampil');
    this.isi.classList.remove('tampil');
    this.penutup.textContent = this.data.penutup.teks;
    this.penutup.classList.add('tampil');
  }

  private selesai(): void {
    this.fase = 'diam';
    this.lapis.classList.remove('tampil');
    this.penutup.classList.remove('tampil');
    const cb = this.saatSelesai;
    this.saatSelesai = null;
    cb?.({ lama: Math.round(this.lama * 10) / 10, dilewati: this.dilewatiDi !== null, diPanel: this.dilewatiDi });
  }
}
