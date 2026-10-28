# Prompt: prolog kasar, commit docs, dan GitHub Pages

Salin seluruh isi di bawah garis ke sesi Claude Code baru di folder ini.

---

Baca CLAUDE.md, docs/catatan-sprint.md (sprint 5 untuk mode UI dan panel, sprint 6 untuk layar awal dan GitHub Pages), dan docs/isi/misi1-prolog.md. Sesi ini pendek, tiga pekerjaan, sebelum playtest.

## 1. Commit docs dan isi penulis

Commit semua perubahan yang belum ter-commit (docs/gdd.md, docs/prototipe.md, docs/isi/*, docs/papan-referensi.md, docs/prompt-sprint-6.md, docs/prompt-sprint-7.md, docs/prompt-prolog.md, src/data/codex.json, dialog.json, guide.json, misi3.json, misi1.json) dengan pesan "Isi penulis: prolog, Kitab 26 entri, dialog ditulis ulang, papan referensi". Jangan ubah isinya.

## 2. Prolog sebagai panel teks kasar

Data sudah ada di src/data/misi1.json (enam panel, label, sumber, Kitab yang dibuka, penutup). Isi Kitab untuk sembilan entri baru sudah di codex.json.

1. Buat `src/mission/panels.ts` (atau perluas sistem panel yang ada dari sprint 5): memutar daftar panel dari data. Tiap panel: layar gelap kecokelatan, kotak tempat gambar (kosong untuk sekarang, tampilkan id panel kecil sebagai placeholder, misalnya "[relief: balairung]"), narasi diketik per huruf (laju sama dengan dialog, klik atau Spasi melengkapi, klik lagi lanjut), label sumber di pojok kanan bawah dengan lencana warna yang sama seperti Kitab (fakta, interpretasi, legenda) dan teks sumber kecil di bawahnya. `bukaKitab` dijalankan saat panel tampil; pemberitahuannya ditunda sampai prolog selesai. Tombol "Lewati prolog" muncul mulai panel ke `bolehLewatiSetelah`. Penutup: teks "1292." besar di tengah selama `lamaTeks` detik, lalu lanjut ke `lanjutKe` (misi 3, langsung ke panel pembukanya).
2. Layar awal: "Mulai baru" memutar prolog dulu, lalu misi 3. Tambahkan tombol "Prolog" terpisah untuk memutar ulang. "Lanjutkan" tidak memutar prolog. Status permainan menyimpan `prologSelesai`.
3. Gamepad: A melengkapi atau lanjut, B lewati (setelah diizinkan), seperti dialog.
4. Mode playtest mencatat waktu prolog dan apakah dilewati (dan di panel ke berapa).
5. Uji: Mulai baru → enam panel → "1292." → panel pembuka misi 3 → hutan. Kitab menampilkan sembilan entri baru terbuka setelah prolog. Tidak ada peringatan `[data]`.
6. Commit: "Prolog sebagai panel teks kasar".

## 3. GitHub Pages

1. Pastikan `npm run build` bersih.
2. Beri tahu saya langkah di GitHub yang harus saya lakukan sendiri: membuat repo (nama saran: `nusantara-rise-of-majapahit`, publik), lalu perintah `git remote add origin ...` dan `git push -u origin main`, lalu Settings → Pages → Source: GitHub Actions. Jangan push sebelum saya konfirmasi remote-nya sudah dibuat.
3. Setelah push dan workflow selesai, beri tahu tautan Pages dan cek bahwa game terbuka dari tautan itu dengan `?playtest=1`.
4. Tambahkan catatan singkat "Prolog dan Pages" ke docs/catatan-sprint.md (di bawah sprint 7), lalu commit "Prolog dan pemasangan Pages".

Selesai berarti: Mulai baru memutar prolog enam panel lalu misi 3; game bisa dibuka dari tautan GitHub Pages.
