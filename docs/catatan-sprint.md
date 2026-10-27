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

## Sprint 2: bertarung (27 Oktober 2026)

Tujuan: lawan kapsul dengan AI sederhana, serang, tangkis, hindar, serangan berat, nyawa dan kematian, HUD minimal. Syarat lolos: pertarungan 1 lawan 3 bisa dimenangkan dengan tangkis dan hindar, bukan dengan menekan serang terus-menerus; isyarat lawan terbaca; fps mendekati 60.

### Yang sudah jalan

- Semua angka keseimbangan di `src/data/combat.json`, dimuat lewat `src/combat/config.ts` dengan tipe TypeScript.
- Pemain (`src/combat/player-combat.ts`): mesin status aksi bebas, mengisi, serang ringan, serang berat, tangkis, hindar, terpukul, mati. Klik kiri lepas sebelum 0,5 detik = ringan (kombo 3, pukulan ketiga menusuk); tahan 0,5 detik = berat otomatis. Klik kanan tangkis: 0,2 detik pertama "pas" (lawan terhuyung 1 detik), sesudahnya "biasa" (damage nol, pemain terdorong 0,6 m). Ctrl atau klik tengah hindar 0,4 detik, kebal 0,25 detik pertama, mundur kalau diam. Hindar boleh memotong serangan setelah jendela kena.
- Tanpa animasi, aksi dinyatakan lewat grup `pose` di dalam badan kapsul: condong saat serang, mundur dan bersinar biru saat tangkis, meluncur rendah saat hindar, bersinar jingga saat mengisi berat. Keris balok tipis di sisi kanan mengayun kanan, kiri, lalu menusuk.
- Uji kena tanpa raycast (`src/combat/hit.ts`): jarak datar dikurangi jari sasaran tidak lebih dari jangkauan, dan sasaran di dalam kerucut hadap; jarak tempel selalu kena.
- Lawan (`src/combat/enemy.ts`): kapsul merah tua dengan tombak 2,2 m. Status diam, mendekat, mengelilingi, bersiap, menyerang, mundur, terhuyung, mati. Isyarat 0,5 detik: tombak ditarik ke belakang dan kapsul bersinar kuning. Arah tusukan dikunci saat mulai menusuk sehingga bisa dihindari ke samping.
- Pengelola lawan (`src/combat/enemy-manager.ts`): antrean giliran, hanya satu penyerang, yang lain mengelilingi di 3 sampai 4 m dengan arah putar yang sesekali berbalik. Kapsul saling mendorong (lawan dengan lawan separuh-separuh, lawan dengan pemain 75:25). Lawan yang waspada membangunkan kawan dalam 10 m. Saat pemain gugur, AI dibekukan.
- Nyawa (`src/combat/health.ts`): pemain 100, lawan 60. Lawan mati rebah ke belakang dan hilang setelah 3 detik. Pemain gugur: layar meredup, teks "Raden Wijaya gugur", tombol "Ulangi" mengembalikan pemain ke titik awal dan menghidupkan semua lawan.
- HUD pertarungan (`src/ui/combat-hud.ts`): bilah nyawa pemain kiri bawah, bilah kuning kecil di atas lawan hidup dalam 12 m, penanda segitiga di atas lawan yang dikunci, angka damage melayang 0,9 detik.
- Kunci ringan: serang atau tangkis saat mouse diam 0,15 detik membuat pemain menghadap lawan terdekat dalam 3 m; saat menangkis, pemain terus mengikuti lawan itu.
- Kamera mode bertarung: menjauh 1,5 m dan pitch naik 0,12 rad saat ada lawan hidup dalam 10 m, kembali 2 detik setelah tidak ada.
- Input membaca tombol mouse (`Mouse0`, `Mouse1`, `Mouse2`) hanya saat pointer terkunci, menyediakan `baruDilepas` dan `lamaDitekan`. Menu klik kanan dicegah.
- Penempatan uji: tiga lawan di tanah lapang timur desa (42,2), (46,-2), (45,6); satu lawan sendirian di barat (-46,0).

### Hasil penyetelan

Diuji dengan dua bot dari konsol browser melawan kelompok tiga, masing-masing 2 sampai 3 kali:

- Bot "serang terus" (hanya maju dan klik kiri tiap 0,3 detik): kalah dalam 7 detik, mati setelah 4 tusukan, sempat membunuh 2 dari 3 lawan.
- Bot "tangkis dan hindar" (tangkis pas saat isyarat lawan mencapai 0,4 detik, hindar kalau terlanjur mengayun, serangan berat saat lawan terhuyung): menang 3 dari 3 kali dalam 11 sampai 12 detik, nyawa sisa 75 sampai 100.
- fps 60 dengan 4 lawan aktif (diukur di laptop pengembang, pane browser aplikasi).

Angka akhir (semua di combat.json):

| Bagian | Nilai |
| --- | --- |
| Nyawa pemain / lawan | 100 / 60 |
| Keris: jangkauan, damage ringan, berat | 1,5 m; 20; 40 |
| Keris: dorong ringan, berat | 0,3 m; 2,0 m |
| Serang ringan: durasi, jendela kena, maju | 0,36 s; 0,10 sampai 0,22 s; 0,5 m |
| Kombo: maks, jeda, pemulihan | 3; 0,6 s; 0,45 s |
| Serang berat: tahan, durasi, jendela kena, maju | 0,5 s; 0,75 s; 0,32 sampai 0,46 s; 1,0 m |
| Tangkis: jendela pas, sudut, dorong, kecepatan | 0,2 s; 100 derajat; 0,6 m; 40 persen |
| Hindar: durasi, kebal, jarak | 0,4 s; 0,25 s; 2,6 m |
| Kunci ringan: jarak, mouse diam | 3 m; 0,15 s |
| Tombak: jangkauan, damage, dorong | 2,2 m; 25; 0,8 m |
| Lawan: deteksi, kecepatan mendekat, mengelilingi | 12 m; 3,2 m/s; 1,6 m/s |
| Lawan: lingkar, isyarat, tusuk, mundur, terhuyung | 3 sampai 4 m; 0,5 s; 0,3 s; 1 sampai 2 s; 1 s |
| Kamera: jarak tambahan, pitch tambahan, deteksi, kembali | 1,5 m; 0,12 rad; 10 m; 2 s |

### Yang belum

- Belum diuji oleh pemain manusia selain pengembang; bot pintar menangkis lebih tepat daripada orang. Kalau pemain sekolah terlalu sering kena, pelebar pertama yang disarankan: `tangkis.jendelaPas` 0,2 ke 0,3 atau `lawan.isyarat` 0,5 ke 0,6.
- Lawan tidak menghindari sungai dan tidak memanjat tebing; mereka mengikuti tinggi medan saja.
- Lawan menembus satu sama lain hanya dicegah lewat dorongan, belum ada pencarian jalur; di sekitar rumah mereka bisa tersangkut sebentar.
- Tidak ada suara dan tidak ada getaran kamera saat kena.
- Angka damage dan bilah lawan adalah elemen DOM; dengan puluhan lawan perlu diganti sprite atau instancing.
- Kunci ringan tidak punya tombol khusus; kalau pemain ingin memilih lawan tertentu, satu-satunya cara adalah menggerakkan mouse ke arahnya.

### Keputusan yang diambil

- Ringan atau berat ditentukan saat lepas atau saat tahan mencapai 0,5 detik, bukan dua tombol, sesuai prinsip GDD satu tombol serang.
- Uji kena memakai jarak dan sudut, bukan raycast atau fisika, karena cukup untuk kapsul dan jauh lebih murah.
- Hanya satu lawan menyerang pada satu waktu (pola Arkham); sisanya mengelilingi. Giliran diberikan ke antrean paling depan yang masih siap, dilepas saat penyerang masuk mundur, terhuyung, atau mati.
- Tusukan lawan yang tertahan tangkisan biasa tidak melukai sama sekali, bukan dikurangi sebagian, supaya pemain pemula merasa tangkisan selalu berguna; pembeda tangkis pas adalah hukuman terhuyung pada lawan.
- Saat pemain gugur, AI dibekukan (bukan dihentikan) dan pointer lock dilepas agar tombol Ulangi bisa diklik.
- Boneka latihan dari tahap A dihapus setelah lawan sungguhan ada; kalau butuh sasaran diam lagi, set status lawan ke `mundur` dengan jeda panjang dari konsol.
- Belum ada pustaka fisika; Rapier tetap tidak diperlukan.
