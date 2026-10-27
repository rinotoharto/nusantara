import type { MesinDialog } from '../dialog/engine';
import { pecahHalaman, pecahIstilah } from '../dialog/teks';
import type { Nada } from '../dialog/config';
import { KITAB_PER_ID } from '../codex/config';
import type { StatusPermainan } from '../mission/state';
import { UI, isiPola } from './config';

interface SpanPotongan {
  el: HTMLSpanElement;
  teks: string;
}

/**
 * Panel dialog sinematik di bawah layar: nama tokoh, teks per huruf, halaman,
 * tiga pilihan nada, dan kartu istilah. Masukan: klik, Spasi, Enter, angka 1 sampai 3.
 */
export class UiDialog {
  private readonly lapis: HTMLDivElement;
  private readonly namaEl: HTMLDivElement;
  private readonly teksEl: HTMLDivElement;
  private readonly petunjukEl: HTMLDivElement;
  private readonly pilihanEl: HTMLDivElement;
  private readonly kartu: HTMLDivElement;
  private readonly kartuJudul: HTMLDivElement;
  private readonly kartuIsi: HTMLDivElement;
  private readonly kartuCatatan: HTMLDivElement;

  private spans: SpanPotongan[] = [];
  private halaman: string[] = [];
  private indeksHalaman = 0;
  private totalHuruf = 0;
  private hurufTampil = 0;
  private pilihanTampil = false;
  private tampil = false;

  constructor(
    private readonly mesin: MesinDialog,
    private readonly status: StatusPermainan,
  ) {
    this.lapis = document.createElement('div');
    this.lapis.className = 'dialog-lapis';

    const panel = document.createElement('div');
    panel.className = 'dialog-panel';
    this.namaEl = document.createElement('div');
    this.namaEl.className = 'dialog-nama';
    this.teksEl = document.createElement('div');
    this.teksEl.className = 'dialog-teks';
    this.pilihanEl = document.createElement('div');
    this.pilihanEl.className = 'dialog-pilihan';
    this.petunjukEl = document.createElement('div');
    this.petunjukEl.className = 'dialog-petunjuk';
    panel.append(this.namaEl, this.teksEl, this.pilihanEl, this.petunjukEl);

    this.kartu = document.createElement('div');
    this.kartu.className = 'dialog-kartu';
    this.kartuJudul = document.createElement('div');
    this.kartuJudul.className = 'dialog-kartu-judul';
    this.kartuIsi = document.createElement('div');
    this.kartuIsi.className = 'dialog-kartu-isi';
    this.kartuCatatan = document.createElement('div');
    this.kartuCatatan.className = 'dialog-kartu-catatan';
    const tutup = document.createElement('button');
    tutup.className = 'dialog-kartu-tutup';
    tutup.textContent = UI.dialog.tutup;
    tutup.tabIndex = -1;
    tutup.addEventListener('click', (e) => {
      e.stopPropagation();
      this.tutupKartu();
    });
    this.kartu.append(this.kartuJudul, this.kartuIsi, this.kartuCatatan, tutup);
    this.kartu.addEventListener('click', (e) => e.stopPropagation());

    this.lapis.append(panel, this.kartu);
    document.body.append(this.lapis);

    this.lapis.addEventListener('click', () => {
      if (this.kartuTerbuka) this.tutupKartu();
      else this.maju();
    });
    window.addEventListener('keydown', (e) => this.saatTombol(e));
  }

  get aktif(): boolean {
    return this.tampil;
  }

  private get kartuTerbuka(): boolean {
    return this.kartu.classList.contains('tampil');
  }

  /** Memulai percakapan dan menampilkan panel; salah kalau id tidak ada. */
  mulai(id: string): boolean {
    if (!this.mesin.mulai(id)) return false;
    this.tampil = true;
    this.lapis.classList.add('tampil');
    this.tampilkanSimpul();
    return true;
  }

  /** Mengetik teks per huruf; dipanggil tiap frame dengan dt nyata. */
  perbarui(dt: number): void {
    if (!this.tampil || this.hurufTampil >= this.totalHuruf) return;
    this.hurufTampil = Math.min(this.totalHuruf, this.hurufTampil + UI.dialog.hurufPerDetik * dt);
    this.terapkanHuruf();
    if (this.hurufTampil >= this.totalHuruf) this.saatKetikSelesai();
  }

  private tampilkanSimpul(): void {
    const s = this.mesin.simpul;
    if (!s) {
      this.tutup();
      return;
    }
    this.tutupKartu();
    this.namaEl.textContent = this.mesin.namaTokoh(s.tokoh);
    this.sembunyikanPilihan();
    this.halaman = s.teks !== undefined ? pecahHalaman(s.teks, UI.dialog.maksKarakterHalaman) : [];
    this.indeksHalaman = 0;
    if (this.halaman.length > 0) this.renderHalaman();
    else {
      this.teksEl.replaceChildren();
      this.spans = [];
      this.totalHuruf = 0;
      this.hurufTampil = 0;
      this.saatKetikSelesai();
    }
  }

  private renderHalaman(): void {
    const potongan = pecahIstilah(this.halaman[this.indeksHalaman]);
    this.teksEl.replaceChildren();
    this.spans = [];
    this.totalHuruf = 0;
    for (const p of potongan) {
      const el = document.createElement('span');
      if (p.kitab) {
        el.className = 'istilah';
        const id = p.kitab;
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          this.bukaKartu(id);
        });
      }
      this.teksEl.append(el);
      this.spans.push({ el, teks: p.teks });
      this.totalHuruf += p.teks.length;
    }
    this.hurufTampil = 0;
    this.terapkanHuruf();
    this.petunjukEl.textContent = this.teksHalaman();
  }

  private terapkanHuruf(): void {
    let sisa = Math.floor(this.hurufTampil);
    for (const s of this.spans) {
      const n = Math.max(0, Math.min(s.teks.length, sisa));
      s.el.textContent = s.teks.slice(0, n);
      sisa -= s.teks.length;
    }
  }

  private teksHalaman(): string {
    const nomor = this.halaman.length > 1
      ? isiPola(UI.dialog.halaman, { a: this.indeksHalaman + 1, b: this.halaman.length }) + '   '
      : '';
    return nomor + UI.dialog.lanjut;
  }

  /** Teks halaman ini sudah tampil penuh: tampilkan pilihan kalau ini halaman terakhir. */
  private saatKetikSelesai(): void {
    const s = this.mesin.simpul;
    const halamanTerakhir = this.indeksHalaman >= this.halaman.length - 1;
    if (s?.pilihan && s.pilihan.length > 0 && halamanTerakhir) this.tampilkanPilihan();
  }

  private tampilkanPilihan(): void {
    const s = this.mesin.simpul;
    if (!s?.pilihan) return;
    this.pilihanEl.replaceChildren();
    s.pilihan.forEach((pil, i) => {
      const tombol = document.createElement('button');
      tombol.className = `dialog-pilihan-tombol nada-${pil.nada}`;
      tombol.tabIndex = -1;
      const info = UI.nada[pil.nada as Nada];
      const nomor = document.createElement('span');
      nomor.className = 'nomor';
      nomor.textContent = String(i + 1);
      const ikon = document.createElement('span');
      ikon.className = 'ikon';
      ikon.textContent = info.ikon;
      const nama = document.createElement('span');
      nama.className = 'nada-nama';
      nama.textContent = info.nama;
      const teks = document.createElement('span');
      teks.className = 'teks';
      for (const p of pecahIstilah(pil.teks)) {
        const span = document.createElement('span');
        span.textContent = p.teks;
        if (p.kitab) {
          span.className = 'istilah';
          const id = p.kitab;
          span.addEventListener('click', (e) => {
            e.stopPropagation();
            this.bukaKartu(id);
          });
        }
        teks.append(span);
      }
      tombol.append(nomor, ikon, nama, teks);
      tombol.addEventListener('click', (e) => {
        e.stopPropagation();
        this.pilih(i);
      });
      this.pilihanEl.append(tombol);
    });
    this.pilihanEl.classList.add('tampil');
    this.pilihanTampil = true;
    this.petunjukEl.textContent = UI.dialog.pilih;
  }

  private sembunyikanPilihan(): void {
    this.pilihanEl.classList.remove('tampil');
    this.pilihanEl.replaceChildren();
    this.pilihanTampil = false;
  }

  /** Klik atau Spasi: selesaikan ketikan, halaman berikutnya, atau simpul berikutnya. */
  private maju(): void {
    if (!this.tampil) return;
    if (this.hurufTampil < this.totalHuruf) {
      this.hurufTampil = this.totalHuruf;
      this.terapkanHuruf();
      this.saatKetikSelesai();
      return;
    }
    if (this.indeksHalaman < this.halaman.length - 1) {
      this.indeksHalaman += 1;
      this.renderHalaman();
      return;
    }
    if (this.pilihanTampil) return;
    this.mesin.lanjut();
    if (this.mesin.aktif) this.tampilkanSimpul();
    else this.tutup();
  }

  private pilih(indeks: number): void {
    if (!this.pilihanTampil) return;
    this.mesin.pilih(indeks);
    if (this.mesin.aktif) this.tampilkanSimpul();
    else this.tutup();
  }

  private bukaKartu(id: string): void {
    const entri = KITAB_PER_ID.get(id);
    this.kartuJudul.textContent = entri?.judul ?? id;
    this.kartuIsi.textContent = entri ? entri.ringkas : UI.dialog.entriTakAda;
    this.kartuCatatan.textContent = entri && !this.status.kitabTerbuka(id) ? UI.dialog.entriTertutup : '';
    this.kartu.classList.add('tampil');
  }

  private tutupKartu(): void {
    this.kartu.classList.remove('tampil');
  }

  private tutup(): void {
    this.tampil = false;
    this.lapis.classList.remove('tampil');
    this.tutupKartu();
    this.sembunyikanPilihan();
  }

  private saatTombol(e: KeyboardEvent): void {
    if (!this.tampil || e.repeat) return;
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      if (this.kartuTerbuka) this.tutupKartu();
      else this.maju();
      return;
    }
    if (e.code === 'Escape') {
      this.tutupKartu();
      return;
    }
    const angka = /^(?:Digit|Numpad)([1-3])$/.exec(e.code);
    if (angka) this.pilih(Number(angka[1]) - 1);
  }
}
