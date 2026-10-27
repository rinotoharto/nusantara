# Catatan sprint

Catatan ini dibaca Claude Code di awal tiap sesi. Isinya: apa yang sudah jalan, apa yang belum, dan keputusan yang diambil. Tambahkan satu bagian per sprint.

## Sprint 1: bergerak dan melihat (27 Oktober 2026)

Tujuan: medan balok, kapsul pemain, kamera orang ketiga, lari, lompat, satu tebing yang bisa dipanjat. Syarat lolos: berjalan keliling area dua menit terasa enak, kamera tidak menembus tembok, mendekati 60 fps di laptop.

### Yang sudah jalan

- Proyek Vite + TypeScript + Three.js. Empat dependensi: `three`, `@types/three`, `typescript`, `vite`. Tidak ada pustaka fisika.
- Medan 300 x 300 m dari satu fungsi tinggi `tinggiMedan(x, z)` di `src/world/terrain.ts`. Bukit di utara (puncak sekitar 22 m), cekungan sungai timur ke barat di selatan desa, tanah di sekitar desa diratakan. Warna tanah mengikuti lereng, tepi sungai berpasir.
- Sungai berupa bidang air biru agak transparan. Pemain bisa menyeberang; di dalam air kecepatannya setengah.
- Desa Kudadu: 6 rumah panggung dari balok, tiang, dan atap limas. Hutan 160 pohon dari silinder dan kerucut di selatan sungai, memakai instancing.
- Pencahayaan sore: matahari rendah di barat dengan bayangan (peta bayangan 2048, mengikuti pemain), cahaya hemisfer hangat, langit dan kabut jingga.
- Pemain kapsul 1,7 m: WASD jalan 4 m/s, Shift lari 7,5 m/s, Spasi lompat sekitar 1,1 m. Kapsul berputar ke arah gerak dan condong saat lari.
- Kamera orang ketiga 5,5 m di belakang pemain, diputar dengan mouse (pointer lock saat klik kanvas, Esc melepas). Raycast ke rumah dan tebing serta pengecekan tinggi medan sepanjang garis kamera supaya tidak menembus. Mendekat cepat saat terhalang, menjauh pelan saat lepas.
- Tabrakan: kotak sejajar sumbu untuk rumah dan tebing, lingkaran untuk batang pohon. Pemain mengikuti kontur bukit lewat fungsi tinggi.
- Tebing 2 m di kaki bukit utara (`src/world/cliff.ts`). Dipanjat dengan menempel dinding dan menekan Spasi; animasi naik 0,7 detik. Lompat sengaja lebih rendah dari tebing.
- HUD: fps di pojok kiri atas, petunjuk tombol di pojok kiri bawah, pesan "Klik untuk mengendalikan" saat mouse belum terkunci.
- Pegangan `window.nusantara` (pemain dan kamera) untuk pengujian dari konsol, hanya aktif saat `npm run dev`.

### Yang belum

- Belum ada sudut lereng yang menghalangi; pemain bisa menaiki lereng securam apa pun. Bukit sekarang landai jadi belum terasa.
- Tabrakan pohon hanya di batang; tajuk tidak menghalangi kamera.
- Kamera tidak menghindari pohon.
- Belum ada gamepad dan belum ada pengaturan kualitas.
- Belum diuji di laptop sekolah; fps 60 baru diukur di laptop pengembang.

### Keputusan yang diambil

- Tanpa pustaka fisika untuk sprint 1. Tinggi medan dari fungsi analitik dan tabrakan kotak sederhana cukup untuk kapsul dan balok. Rapier dipertimbangkan lagi kalau sprint 2 (pertarungan) atau sprint 3 (pengikut) membutuhkannya.
- Sumbu dunia: +x timur, -z utara, +z selatan. Desa di titik asal, sungai di z = 55, tebing di sekitar (-15, -58).
- Three.js r186 sudah menghapus `PCFSoftShadowMap` dan `THREE.Clock`; dipakai `PCFShadowMap` dan `THREE.Timer`.
- TypeScript 7 menuntut deklarasi tipe untuk impor CSS; ditangani lewat `src/vite-env.d.ts`.
- npm 10.8 sempat gagal memasang (`Cannot read properties of null (reading 'edgesOut')`); pemasangan dilakukan dengan `--legacy-peer-deps`.
- Cabang utama Git bernama `main`.
- Folder `src/combat`, `stealth`, `dialog`, `codex`, `mission`, `data` masih berisi placeholder sampai sprint yang bersangkutan.
