import { KITAB, KITAB_PER_ID, URUTAN_JENIS, type EntriKitab } from '../codex/config';
import type { StatusPermainan } from '../mission/state';
import { UI } from './config';
import { buatPilihanUkuran } from './font-size';

/**
 * Kitab (ensiklopedia): daftar entri per jenis di kiri, isi entri di kanan,
 * gaya kertas. Entri yang belum terbuka tampil sebagai "???".
 */
export class UiKitab {
  private readonly lapis: HTMLDivElement;
  private readonly daftarEl: HTMLDivElement;
  private readonly isiEl: HTMLDivElement;
  private idTerpilih: string | null = null;
  private tampil = false;
  /** Dipanggil saat Kitab ditutup lewat tombol Tutup. */
  saatTutup: (() => void) | null = null;

  constructor(private readonly status: StatusPermainan) {
    this.lapis = document.createElement('div');
    this.lapis.className = 'kitab-lapis';
    const kitab = document.createElement('div');
    kitab.className = 'kitab';

    const kepala = document.createElement('div');
    kepala.className = 'kitab-kepala';
    const judul = document.createElement('div');
    judul.className = 'kitab-judul';
    judul.textContent = UI.kitab.judul;
    const tutup = document.createElement('button');
    tutup.className = 'kitab-tutup';
    tutup.tabIndex = -1;
    tutup.textContent = UI.kitab.tutup;
    tutup.addEventListener('click', () => this.saatTutup?.());
    kepala.append(judul, buatPilihanUkuran(status), tutup);

    this.daftarEl = document.createElement('div');
    this.daftarEl.className = 'kitab-daftar';
    this.isiEl = document.createElement('div');
    this.isiEl.className = 'kitab-isi';

    kitab.append(kepala, this.daftarEl, this.isiEl);
    this.lapis.append(kitab);
    document.body.append(this.lapis);
  }

  get aktif(): boolean {
    return this.tampil;
  }

  /** Membuka Kitab; tanpa `id`, entri yang terakhir terbuka dipilih. */
  buka(id?: string): void {
    this.tampil = true;
    this.lapis.classList.add('tampil');
    const pilihan = id ?? this.idTerpilih ?? this.status.kitab[this.status.kitab.length - 1] ?? null;
    this.pilih(pilihan);
  }

  tutup(): void {
    this.tampil = false;
    this.lapis.classList.remove('tampil');
  }

  pilih(id: string | null): void {
    this.idTerpilih = id;
    this.renderDaftar();
    this.renderIsi();
    this.isiEl.scrollTop = 0;
  }

  private renderDaftar(): void {
    this.daftarEl.replaceChildren();
    for (const jenis of URUTAN_JENIS) {
      const entri = KITAB.filter((e) => e.jenis === jenis);
      if (entri.length === 0) continue;
      const kelompok = document.createElement('div');
      kelompok.className = 'kitab-kelompok';
      const judul = document.createElement('div');
      judul.className = 'kitab-jenis';
      judul.textContent = UI.kitab.jenis[jenis];
      kelompok.append(judul);
      for (const e of entri) {
        const terbuka = this.status.kitabTerbuka(e.id);
        const tombol = document.createElement('button');
        tombol.className = 'kitab-butir' + (terbuka ? '' : ' tertutup') + (e.id === this.idTerpilih ? ' aktif' : '');
        tombol.tabIndex = -1;
        tombol.textContent = terbuka ? e.judul : UI.kitab.tertutup;
        tombol.addEventListener('click', () => this.pilih(e.id));
        kelompok.append(tombol);
      }
      this.daftarEl.append(kelompok);
    }
  }

  private renderIsi(): void {
    this.isiEl.replaceChildren();
    const entri = this.idTerpilih ? KITAB_PER_ID.get(this.idTerpilih) : undefined;
    if (!entri) {
      this.isiEl.append(this.paragraf(UI.kitab.kosong, 'kitab-kosong'));
      return;
    }
    if (!this.status.kitabTerbuka(entri.id)) {
      const judul = document.createElement('h2');
      judul.className = 'kitab-entri-judul';
      judul.textContent = UI.kitab.tertutup;
      this.isiEl.append(judul, this.paragraf(UI.kitab.belumTerbuka, 'kitab-kosong'));
      return;
    }
    this.isiEl.append(...this.bagianEntri(entri));
  }

  private bagianEntri(entri: EntriKitab): HTMLElement[] {
    const bagian: HTMLElement[] = [];

    const kepala = document.createElement('div');
    kepala.className = 'kitab-entri-kepala';
    const judul = document.createElement('h2');
    judul.className = 'kitab-entri-judul';
    judul.textContent = entri.judul;
    const label = UI.kitab.label[entri.label];
    const lencana = document.createElement('span');
    lencana.className = `lencana lencana-${entri.label}`;
    lencana.textContent = label.nama;
    lencana.dataset.keterangan = label.keterangan;
    lencana.title = label.keterangan;
    const jenis = document.createElement('span');
    jenis.className = 'kitab-entri-jenis';
    jenis.textContent = UI.kitab.jenis[entri.jenis];
    kepala.append(judul, lencana, jenis);
    bagian.push(kepala);

    for (const p of entri.isi) bagian.push(this.paragraf(p));

    if (entri.kutipan) {
      const kotak = document.createElement('blockquote');
      kotak.className = 'kitab-kutipan';
      const teks = document.createElement('p');
      teks.textContent = entri.kutipan.teks;
      const sumber = document.createElement('cite');
      sumber.textContent = entri.kutipan.sumber;
      kotak.append(teks, sumber);
      bagian.push(kotak);
    }

    if (entri.sumber.length > 0) {
      bagian.push(this.subjudul(UI.kitab.sumber));
      const daftar = document.createElement('ul');
      daftar.className = 'kitab-sumber';
      for (const s of entri.sumber) {
        const li = document.createElement('li');
        li.textContent = s;
        daftar.append(li);
      }
      bagian.push(daftar);
    }

    const terkait = entri.terkait.map((id) => KITAB_PER_ID.get(id)).filter((e): e is EntriKitab => e !== undefined);
    if (terkait.length > 0) {
      bagian.push(this.subjudul(UI.kitab.terkait));
      const baris = document.createElement('div');
      baris.className = 'kitab-terkait';
      for (const e of terkait) {
        if (this.status.kitabTerbuka(e.id)) {
          const tautan = document.createElement('button');
          tautan.className = 'kitab-tautan';
          tautan.tabIndex = -1;
          tautan.textContent = e.judul;
          tautan.addEventListener('click', () => this.pilih(e.id));
          baris.append(tautan);
        } else {
          const mati = document.createElement('span');
          mati.className = 'kitab-tautan tertutup';
          mati.textContent = `${UI.kitab.tertutup} (${UI.kitab.jenis[e.jenis]})`;
          baris.append(mati);
        }
      }
      bagian.push(baris);
    }
    return bagian;
  }

  private paragraf(teks: string, kelas = 'kitab-paragraf'): HTMLParagraphElement {
    const p = document.createElement('p');
    p.className = kelas;
    p.textContent = teks;
    return p;
  }

  private subjudul(teks: string): HTMLHeadingElement {
    const h = document.createElement('h3');
    h.className = 'kitab-subjudul';
    h.textContent = teks;
    return h;
  }
}
