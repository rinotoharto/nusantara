# Nusantara: Rise of Majapahit (game sejarah berbasis web)

Game aksi-petualangan orang ketiga tentang Raden Wijaya (1292-1293), dibangun dengan Three.js + TypeScript + Vite, dirilis gratis sebagai aplikasi web statis.

Tahap sekarang: prototipe tanpa aset (kapsul dan balok), 6 sprint mingguan, membuktikan misi 3 (pelarian) enak dimainkan di browser.

Baca dulu di awal sesi:
- docs/gdd.md: desain lengkap bab 1 (cerita, tokoh, mekanik, teknologi).
- docs/prototipe.md: rencana prototipe, isi tiap sprint, dan syarat lolosnya.
- docs/catatan-sprint.md: apa yang sudah jalan, apa yang belum, dan keputusan yang diambil (dibuat setelah sprint 1).

## Aturan

- Semua data misi, dialog, dan ensiklopedia disimpan di src/data/*.json, bukan di kode.
- Model 3D hanya glTF (.glb); selama prototipe pakai geometri primitif Three.js.
- Target 30 fps di laptop biasa, 60 fps di laptop menengah. Jangan tambah pustaka tanpa alasan yang jelas; tanyakan dulu kalau ragu.
- Jalankan `npm run dev`, cek di browser, dan pastikan tidak ada error di konsol sebelum menyatakan selesai.
- Jangan mengubah atau mengarang fakta sejarah di data; isi sejarah ditulis di luar sesi ini. Kalau ragu, tandai dengan komentar TODO-SEJARAH.
- Bahasa untuk teks UI, komentar kode, pesan commit, dan catatan: Indonesia. Nama variabel, fungsi, dan berkas boleh Inggris.
- Satu sesi, satu tujuan kecil yang bisa dilihat di browser. Buat rencana singkat dulu dan tunggu persetujuan sebelum menulis kode.
- Commit Git setiap kali satu fitur selesai dan sudah dicek di browser.
- Di akhir sprint, tulis ringkasannya ke docs/catatan-sprint.md.

## Struktur folder

```
src/
  main.ts          titik masuk
  world/           medan, bangunan balok, vegetasi
  character/       pengendali pemain, kapsul, animasi sederhana
  combat/          serangan, tangkisan, nyawa, AI lawan
  stealth/         zona pandang, persembunyian
  dialog/          sistem percakapan dari JSON
  codex/           ensiklopedia
  mission/         pemuat misi, pemicu, titik simpan
  ui/              HUD, menu
  data/            misi3.json, dialog.json, codex.json
docs/              gdd.md, prototipe.md, catatan-sprint.md
```
