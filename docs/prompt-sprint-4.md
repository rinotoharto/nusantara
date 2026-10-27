# Prompt sprint 4: dialog dan Kitab (ensiklopedia)

Salin seluruh isi di bawah garis ke sesi Claude Code baru di folder ini.

---

Baca CLAUDE.md, docs/prototipe.md (bagian sprint 4), docs/gdd.md (bagian Mekanik inti: Dialog dan Ensiklopedia, serta bagian Bahasa), dan docs/catatan-sprint.md.
Kita mulai sprint 4: sistem dialog dan Kitab. Sprint 1 sampai 3 sudah di-commit; jangan ubah gerak, pertarungan, dan menyelinap kecuali diperlukan.

Pembagian kerja penting untuk sprint ini: Anda membangun sistemnya; ISI sejarah (teks dialog, teks entri Kitab) ditulis di luar sesi ini dan akan disalin ke berkas JSON. Jangan mengarang isi sejarah. Untuk pengujian, pakai teks placeholder yang jelas (misalnya "TODO-SEJARAH: sapaan kepala desa") dengan struktur JSON yang sudah final, sehingga isi sungguhan tinggal menggantikan placeholder tanpa mengubah kode.

Buat rencana singkat dulu (berkas di src/dialog/, src/codex/, src/ui/, dan skema JSON), lalu tunggu persetujuan saya sebelum menulis kode.

Setelah disetujui, kerjakan bertahap. Setiap tahap: pastikan `npm run dev` jalan tanpa error di terminal maupun konsol browser, beri tahu saya apa yang harus dicoba, tunggu konfirmasi saya, lalu commit.

## Skema JSON (wajib persis seperti ini, karena isinya ditulis terpisah)

src/data/dialog.json: objek dengan kunci id percakapan. Tiap percakapan:

```json
{
  "kudadu-tiba": {
    "judul": "Tiba di Kudadu",
    "tokoh": { "wijaya": "Raden Wijaya", "kepala-desa": "Kepala desa Kudadu" },
    "mulai": "n1",
    "simpul": {
      "n1": { "tokoh": "kepala-desa", "teks": "TODO-SEJARAH", "lanjut": "n2" },
      "n2": {
        "tokoh": "wijaya",
        "pilihan": [
          { "nada": "hormat", "teks": "TODO-SEJARAH", "lanjut": "n3a" },
          { "nada": "tegas",  "teks": "TODO-SEJARAH", "lanjut": "n3b" },
          { "nada": "licik",  "teks": "TODO-SEJARAH", "lanjut": "n3c" }
        ]
      },
      "n3a": { "tokoh": "kepala-desa", "teks": "TODO-SEJARAH", "lanjut": "n4" },
      "n4":  { "tokoh": "kepala-desa", "teks": "TODO-SEJARAH", "bukaKitab": ["prasasti-kudadu"], "selesai": true }
    }
  }
}
```

Aturan simpul: `teks` boleh mengandung istilah bertanda `[[istilah|id-kitab]]` yang ditampilkan bergaris bawah dan bisa diklik untuk melihat ringkasan singkat entri Kitab tanpa meninggalkan percakapan. `nada` hanya tiga nilai: hormat, tegas, licik. Simpul boleh punya `bukaKitab` (daftar id entri yang terbuka saat simpul tampil) dan `tandai` (string bebas yang disimpan ke status permainan, misalnya "kudadu-nada-hormat", untuk dipakai misi nanti). Teks mungkin dua sampai tiga kalimat; UI harus memotong per halaman kalau terlalu panjang.

src/data/codex.json: daftar entri.

```json
{
  "entri": [
    {
      "id": "prasasti-kudadu",
      "judul": "Prasasti Kudadu",
      "jenis": "sumber",
      "label": "fakta",
      "ringkas": "TODO-SEJARAH satu kalimat untuk tooltip",
      "isi": ["TODO-SEJARAH paragraf 1", "TODO-SEJARAH paragraf 2"],
      "kutipan": { "teks": "TODO-SEJARAH", "sumber": "Prasasti Kudadu (1294), terjemahan ..." },
      "sumber": ["Prasasti Kudadu (1294)", "Pararaton"],
      "terkait": ["jayakatwang", "desa-kudadu"],
      "dibukaOleh": "dialog:kudadu-tiba"
    }
  ]
}
```

`jenis`: peristiwa, tokoh, tempat, benda, sumber, istilah. `label`: fakta, interpretasi, legenda; ditampilkan sebagai lencana berwarna dengan penjelasan singkat saat disorot (fakta: didukung sumber sezaman; interpretasi: tafsir dari sumber yang lebih muda atau sejarawan; legenda: cerita tradisi, bukan catatan sejarah). `kutipan` boleh kosong (null). Untuk pengujian, buat tiga entri placeholder dengan id persis: `prasasti-kudadu` (jenis sumber, label fakta), `jayakatwang` (tokoh, interpretasi), `desa-kudadu` (tempat, fakta), ditambah satu entri istilah `rakryan` untuk menguji istilah di dalam teks dialog.

## Tahap A: sistem dialog

1. `src/dialog/`: pemuat dialog.json dengan validasi ringan (simpul yang dirujuk harus ada; id Kitab yang dirujuk harus ada di codex.json; laporkan ke konsol kalau tidak), mesin percakapan (simpul sekarang, pilihan, lanjut, selesai), dan status permainan sederhana (`src/mission/state.ts`): tanda yang disimpan, entri Kitab yang terbuka, disimpan ke localStorage.
2. UI dialog (`src/ui/dialog-ui.ts`): panel di bawah layar gaya sinematik, nama tokoh, teks muncul per huruf (bisa dilewati dengan klik atau Spasi), tiga pilihan nada dengan ikon kecil atau warna yang konsisten (hormat, tegas, licik), navigasi dengan mouse atau angka 1 sampai 3. Saat dialog aktif: pointer lock dilepas, pemain dan lawan dibekukan, kamera pelan-pelan bergerak ke sudut dua tokoh (over-the-shoulder sederhana).
3. Istilah `[[...]]` tampil bergaris bawah; klik membuka kartu kecil berisi `ringkas` entri Kitab tanpa menutup dialog.
4. Commit: "Sistem dialog dari JSON".

## Tahap B: tokoh bicara di dunia

1. Kapsul NPC kepala desa Kudadu (warna berbeda, tidak bertarung) di depan rumah terbesar di desa. Saat pemain dalam 2,5 m, tampil petunjuk "E: Bicara"; tekan E memulai percakapan `kudadu-tiba`.
2. Setelah percakapan selesai, NPC tidak mengulang percakapan yang sama; percakapan kedua (`kudadu-ulang`, placeholder satu simpul) dipakai untuk interaksi berikutnya.
3. Tanda dari `tandai` tersimpan; tampilkan di konsol dev untuk pengujian.
4. Commit: "NPC bicara dan pemicu percakapan".

## Tahap C: Kitab

1. `src/codex/`: pemuat codex.json dan daftar entri terbuka dari status permainan.
2. UI Kitab (`src/ui/codex-ui.ts`): dibuka dengan tombol K atau dari menu jeda (Esc). Tampilan dua kolom: daftar entri di kiri dikelompokkan per jenis (entri yang belum terbuka tampil sebagai "???" dengan jenisnya saja), isi di kanan: judul, lencana label, paragraf isi, kotak kutipan dengan sumbernya, daftar sumber, dan tautan ke entri terkait (yang terbuka). Gaya visual: latar seperti kertas atau lontar, teks gelap, sederhana, bisa dibaca di laptop sekolah; ukuran huruf bisa diubah (kecil, sedang, besar) dan tersimpan.
3. Pemberitahuan saat entri terbuka: kartu kecil di pojok kanan atas "Kitab: Prasasti Kudadu" selama 3 detik, tidak menghentikan permainan. Kalau dibuka saat dialog, pemberitahuan ditunda sampai dialog selesai.
4. Menu jeda sederhana (Esc saat pointer lock dilepas): Lanjutkan, Kitab, Pengaturan (ukuran huruf, subtitle nanti), Mulai ulang misi.
5. Commit: "Kitab ensiklopedia dan menu jeda".

## Tahap D: pemicu dari peristiwa dan catatan

1. Entri Kitab juga bisa dibuka oleh peristiwa, bukan hanya dialog: tambahkan pemicu sederhana di `src/mission/` yang membuka entri saat pemain masuk area (misalnya `desa-kudadu` saat pertama masuk desa) atau saat pertama kali bertarung dengan prajurit Kediri (`jayakatwang`). Datanya di src/data/misi3.json dalam bentuk daftar pemicu `{ "jenis": "area", "pusat": [x, z], "jari": 10, "bukaKitab": ["desa-kudadu"] }` dan `{ "jenis": "pertarungan-pertama", "bukaKitab": ["jayakatwang"] }`.
2. Pastikan semua teks UI di src/data/ui.json atau konstanta terpusat, bukan tersebar di kode, karena nanti ada subtitle dan ukuran huruf.
3. Uji: mulai permainan baru (hapus localStorage), masuk desa, bicara dengan kepala desa, pilih tiap nada, buka Kitab, ganti ukuran huruf, muat ulang halaman dan pastikan entri terbuka tetap tersimpan.
4. Tambahkan bagian "Sprint 4" ke docs/catatan-sprint.md, termasuk skema JSON final (kalau ada perubahan dari yang di atas, tulis alasannya) supaya penulis isi tahu persis formatnya.
5. Commit: "Sprint 4 selesai: dialog dan Kitab".

Selesai berarti: percakapan dengan kepala desa berjalan dengan tiga pilihan nada dari JSON; istilah dalam teks bisa diklik; Kitab menampilkan entri dengan label dan kutipan; entri terbuka saat dialog dan saat masuk area; semua isi masih placeholder TODO-SEJARAH dan siap diganti tanpa menyentuh kode.
