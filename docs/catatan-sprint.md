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

## Sprint 3: menyelinap dan pengikut (27 Oktober 2026)

Tujuan: Tikaman Keris sebagai jurus pertama, penjaga patroli dengan kerucut pandang, status curiga, mengejar, dan mencari, semak persembunyian, tiga pengikut, dan area uji di utara desa. Syarat lolos: pemain bisa melewati tiga penjaga tanpa bertarung; ketahuan memicu pertarungan yang adil; pengikut mengikuti tanpa mengganggu; fps mendekati 60.

### Yang sudah jalan

- Tikaman Keris (`src/combat/player-combat.ts`, status `tikaman`): kalau ada lawan terhuyung dalam 2,5 m di depan pemain dan serangan ringan dimulai (dari bebas, sambungan kombo, atau klik kiri saat menangkis), pemain melesat 0,15 detik sampai 1 m dari lawan lalu menusuk sekali dengan damage 60. Serangan ini bersasaran tunggal (`Serangan.sasaran`), pemain kebal dan tidak bisa diputus selama 0,3 detik. Umpan balik: waktu permainan 0,3 selama 0,25 detik (dihitung dalam waktu nyata di `main.ts`), kamera mendekat 1 m lewat `KameraOrangKetiga.mendekat`, lawan berkilat putih 0,3 detik dan terdorong 3 m sambil rebah. HUD menulis "Tikaman Keris" di tengah layar saat pertama kali berhasil (`HudPertarungan.umumkan`).
- Lawan yang mati kini tetap terdorong oleh pukulan terakhirnya (sebelumnya dorongan hilang begitu mati).
- Semua angka menyelinap di `src/data/stealth.json`; tata letak area uji (titik awal, tujuan, penjaga, batu, semak) di `src/data/stealth-uji.json`, dimuat lewat `src/stealth/config.ts`.
- Penjaga (`src/stealth/guard.ts`): `Penjaga extends Lawan`, menambah status `patroli`, `curiga`, `mencari`, `kembali` tanpa menyalin kode pertarungan. Patroli bolak-balik atau melingkar antar titik jalan 1,6 m/s, berhenti 1 sampai 2 detik di tiap titik sambil menoleh 45 derajat. Mengejar berarti `masuk('mendekat')` milik Lawan, sehingga antrean satu penyerang dan mengelilingi berlaku sama. Lawan yang ingin masuk `diam` (pemain terlalu jauh) dialihkan ke `mencari`.
- Pandangan (`src/stealth/vision.ts`): kerucut 70 derajat 14 m; garis pandang 2D terhadap kotak padat (rumah, tebing, batu) yang lebih tinggi dari mata 1,5 m, batang pohon, dan semak selain yang ditempati pemain. Kerucut digambar sebagai kipas 18 segmen di lantai yang mengikuti tinggi medan: hijau tenang, kuning saat meteran di atas 0,3, merah saat mengejar.
- Meteran curiga: 0 ke 1 dalam 1,5 detik, dua kali lebih cepat dalam 6 m, 1,5 kali saat pemain berlari, langsung penuh dalam 2,5 m, turun ke 0 dalam 3 detik. Jongkok atau berdiri di semak memotong jarak pandang jadi setengah; jongkok di semak membuat pemain tak terlihat kecuali penjaga dalam 2 m. Saat pemain tersembunyi tapi seorang pengikut di luar semak terlihat, meteran naik setengah laju.
- Alur ketahuan: curiga (berhenti, menghadap titik terakhir, tanda tanya) → mengejar (tanda seru, teriakan menarik penjaga lain dalam 15 m). Saat mengejar, pemain dianggap terlihat lewat kerucut 200 derajat sejauh 25 m atau terdengar dalam 3 m; 4 detik tanpa melihat atau jarak lebih dari 25 m → mencari ke titik terakhir (2,4 m/s), menoleh 3 detik, kembali ke titik jalan terdekat, patroli. Penjaga yang diserang saat lengah langsung mengejar.
- Jongkok (tombol C, toggle): 2 m/s, Shift dan lompat diabaikan, kapsul memendek ke 0,65 lewat skala `pose`.
- Semak (`src/stealth/bush.ts`): balok 2 x 2 x 1,2 m hijau gelap opasitas 0,6, tidak menghalangi gerak dan tidak masuk daftar penghalang kamera. HUD: pinggiran layar gelap di dalam semak, teks "Tersembunyi" atau "Jongkok (C) untuk bersembunyi".
- Pengikut (`src/character/follower.ts`): tiga kapsul cokelat di slot formasi (2,2 m di belakang dengan geseran samping 1,6 m, dan 3,2 m di belakang), kecepatan sebanding jarak sampai 7,5 m/s, berhenti saat pemain berhenti dalam 4 m. Ikut jongkok, ikut ke slot di dalam semak yang sama, mundur sampai 6,5 m dari lawan terdekat saat ada lawan bertarung dalam 12 m dan menunggu (menyusul lagi kalau pemain lebih dari 10 m). Tabrakan memakai `dorongKeluar` dan `pisahkan` (dipindah ke `world/collision.ts`). Tertinggal lebih dari 15 m dan di luar frustum kamera → berpindah ke titik tepat di belakang kamera lalu berjalan masuk. Slot digeser keluar dari garis kamera-pemain 1,6 m dan pengikut memudar kalau lebih dekat dari 3,5 m ke kamera.
- Area uji: jalur 80 m dari (14, -34) ke tiang tujuan bercahaya di (14, -114), di sebelah timur tebing. Penjaga selatan bolak-balik di z = -46, penjaga tengah melingkar di kotak x 6 sampai 22 dan z -60 sampai -72, penjaga utara bolak-balik dari (2, -86) ke (26, -90). Lima batu dan lima semak dari data. Pesan "Sampai di ujung utara" saat pemain dalam 2,5 m dari tiang. Titik awal pemain dan tombol Ulangi memakai titik awal ini; lawan sprint 2 di timur dan barat desa tetap ada.
- HUD siluman (`src/ui/stealth-hud.ts`): tanda ? dan ! di atas kepala penjaga dalam 30 m. Bilah nyawa lawan dan kamera mode bertarung hanya menanggapi lawan yang sedang bertarung, bukan penjaga yang lewat.

### Hasil penyetelan

Diuji dengan bot dari konsol browser (langkah 1/60 detik, tanpa render), tiap skenario 2 sampai 3 kali:

- Bot sabar (menunggu jongkok di semak sampai penjaga terdekat membelakangi dan lebih dari 5 m, lalu berjalan ke semak berikutnya): sampai tujuan 3 dari 3 kali tanpa ketahuan, 70 detik, 43 detik di antaranya menunggu.
- Bot ceroboh (lari lurus ke utara): ketahuan penjaga selatan dalam 2 detik; dari tengah jalur ketahuan penjaga tengah dalam 1 detik. Dua penjaga ikut lewat teriakan.
- 1 lawan 3 dipaksa (ketiga penjaga mengejar), bot tangkis pas dan hindar tanpa tikaman, memakai serangan berat saat lawan terhuyung: menang 2 dari 3 kali dalam 12 sampai 14 detik, nyawa sisa 50 sampai 75; sekali gugur. Setara hasil sprint 2.
- 1 lawan 3 dengan tikaman setelah tiap tangkis pas: menang 2 dari 2 dalam 4 detik tanpa luka. Tikaman sengaja sekuat ini (menamatkan lawan biasa); bot menangkis dengan sempurna, manusia tidak. Kalau terasa terlalu murah: turunkan `tikaman.damage` ke 40 (dua tikaman per lawan) atau persempit `tangkis.jendelaPas`.
- Biaya pembaruan logika (pemain, pengikut, penjaga, lawan, kamera) 0,011 ms per frame di laptop pengembang; fps di HUD 60 saat pane browser terlihat. Belum diukur di laptop sekolah.

Angka akhir Tikaman Keris (combat.json, blok `pemain.tikaman`):

| Bagian | Nilai |
| --- | --- |
| Jarak picu, sudut hadap | 2,5 m; 100 derajat |
| Jarak henti, jangkauan kena | 1,0 m; 2,5 m |
| Damage, dorong, lama dorong | 60; 3,0 m; 0,3 s |
| Lesat, durasi (kebal) | 0,15 s; 0,3 s |
| Kilatan lawan | 0,3 s |
| Skala waktu, lama | 0,3; 0,25 s |
| Kamera mendekat, lama | 1,0 m; 0,4 s |

Angka akhir menyelinap (stealth.json):

| Bagian | Nilai |
| --- | --- |
| Patroli: kecepatan, jeda titik, toleh | 1,6 m/s; 1 sampai 2 s; 45 derajat |
| Pandang: sudut, jarak, tinggi mata | 70 derajat; 14 m; 1,5 m |
| Curiga: waktu penuh, jarak dekat, pengali dekat, pengali lari | 1,5 s; 6 m; 2,0; 1,5 |
| Curiga: langsung penuh, waktu turun, ambang | 2,5 m; 3 s; 0,3 |
| Mengejar: seru, sudut, dengar, hilang, putus | 15 m; 200 derajat; 3 m; 4 s; 25 m |
| Mencari: kecepatan, waktu, meteran awal | 2,4 m/s; 3 s; 0,6 |
| Pemain: ambang lari, jongkok, skala jongkok | 5 m/s; 2 m/s; 0,65 |
| Faktor jarak pandang: jongkok, semak | 0,5; 0,5 |
| Semak: ukuran, jarak tembus | 2 x 2 x 1,2 m; 2 m |
| Pengikut: jarak belakang, lebar, berhenti, longgar | 2,2 dan 3,2 m; 1,6 m; 0,5 m; 4 m |
| Pengikut: kecepatan maks, pengali, tertinggal | 7,5 m/s; 2,5; 15 m |
| Pengikut: jarak pertarungan, mundur, menyusul, faktor curiga | 12 m; 6 m; 10 m; 0,5 |

### Yang belum

- Belum diuji oleh pemain manusia selain pengembang. Bot sabar menunggu 43 detik; kalau pemain sekolah bosan, pelebar pertama: `jedaTitikMaks` lebih lama atau `jarakPandang` lebih pendek.
- Penjaga tidak menghindari batu dan semak saat mengejar atau mencari; mereka bisa tersangkut sebentar di sisi batu (tidak ada pencarian jalur).
- Kerucut pandang digambar penuh walau terpotong batu; hanya deteksinya yang benar. Kerucut yang menabrak tebing atau rumah tertutup mesh itu.
- Pengikut bergerak lurus ke slot; di balik batu atau pohon mereka mengandalkan dorongan tabrakan dan, kalau tertinggal, penempatan ulang di belakang kamera.
- Pengikut tidak bisa dilukai dan tidak punya kerucut deteksi sendiri; mereka hanya syarat tambahan saat pemain tersembunyi.
- Bagian utara jalur ada di lereng bukit (naik dari z = -45); jalur datar sejajar tebing bisa dibuat hanya dengan mengubah stealth-uji.json.
- Belum ada suara langkah atau isyarat suara saat penjaga curiga; tanda ? dan ! masih elemen DOM.

### Keputusan yang diambil

- Penjaga mewarisi `Lawan` dan hanya menambah status di luar pertarungan; beberapa anggota Lawan diubah menjadi `protected`. Mengejar sama dengan pertarungan sprint 2 supaya tidak ada dua mesin status.
- Garis pandang diuji di bidang datar dengan kotak dan lingkaran, bukan raycast mesh, karena cukup untuk balok dan jauh lebih murah; semak diperlakukan sebagai penghalang pandang kecuali semak yang ditempati pemain.
- Tikaman bersasaran tunggal dan dipicu dari pemulai serangan ringan, bukan tombol baru, sesuai prinsip satu tombol serang.
- Waktu lambat Tikaman dihitung dalam waktu nyata dan kamera menerima dt nyata, supaya efeknya terasa sama di fps mana pun.
- Pengikut tidak menduplikasi tabrakan: memakai `dorongKeluar` dan `pisahkan` yang ada. Penempatan ulang dilakukan ke belakang kamera, bukan ke slot, supaya tidak muncul tiba-tiba di layar.
- Kamera mode bertarung dan bilah nyawa lawan hanya menanggapi lawan yang `bertarung`, supaya penjaga yang lewat tidak membocorkan posisinya lewat HUD.
- Titik awal pemain pindah ke area uji; lawan sprint 2 dibiarkan di tempatnya.

## Sprint 4: dialog dan Kitab (27 Oktober 2026)

Tujuan: sistem percakapan dari JSON dengan tiga pilihan nada, kepala desa Kudadu yang bisa diajak bicara, Kitab (ensiklopedia) dengan label dan kutipan, entri yang terbuka saat dialog dan saat peristiwa, menu jeda. Isi sejarah ditulis di luar sesi (`docs/isi/`); semua teks di `src/data` masih placeholder `TODO-SEJARAH`.

### Yang sudah jalan

- Data: `src/data/dialog.json` (percakapan), `codex.json` (entri Kitab), `misi3.json` (tokoh pemain, NPC, pemicu), `ui.json` (semua teks dan angka UI: petunjuk tombol, label nada, nama jenis dan label Kitab beserta penjelasannya, menu, pengaturan, teks HUD pertarungan dan menyelinap). Tidak ada teks UI yang tersisa di kode.
- Mesin dialog (`src/dialog/`): `engine.ts` memegang simpul sekarang, menjalankan `bukaKitab` dan `tandai` saat simpul tampil, berpindah lewat `lanjut` atau `pilih`. `validator.ts` memeriksa saat mulai: simpul `mulai` dan `lanjut` ada, tokoh terdaftar, nada sah, id Kitab di `bukaKitab` dan di istilah `[[...|id]]` ada di codex; masalah dilaporkan ke konsol sebagai `[data] ...`. `teks.ts` memecah istilah dan memotong halaman per kalimat (maksimum 150 karakter terlihat per halaman, angka di ui.json).
- Status permainan (`src/mission/state.ts`): tanda, entri Kitab terbuka (urut waktu), percakapan selesai, ukuran huruf; disimpan ke localStorage kunci `nusantara.status`. `ulangMisi()` menghapus tanda dan percakapan selesai tetapi mempertahankan entri Kitab; `reset()` menghapus semuanya (dari konsol: `nusantara.status.reset()`).
- UI dialog (`src/ui/dialog-ui.ts`): panel bawah bergaya sinematik, nama tokoh, teks per huruf 45 huruf/detik (klik atau Spasi melewati), halaman, tiga pilihan nada dengan warna tetap (hormat emas, tegas merah, licik ungu) dan ikon, tombol 1 sampai 3. Istilah bergaris bawah; klik membuka kartu berisi `ringkas` tanpa menutup dialog, dengan catatan kalau entri lengkapnya belum terbuka. Selama dialog: pointer lock dilepas, pemain, lawan, pengikut, dan penjaga membeku, HUD disembunyikan.
- Kamera dialog (`src/dialog/sinematik.ts`, `KameraOrangKetiga.sinematik`): pose di belakang bahu kanan pendengar memandang kepala pembicara (2,1 m ke belakang, 0,9 m ke samping, tinggi 1,8 m), berganti bahu saat pembicara berganti, peralihan masuk dan keluar 0,8 detik. Mouse diabaikan selama pose aktif.
- NPC (`src/mission/npc.ts`): kapsul hijau kebiruan dari daftar `npc` di misi3.json, kotak tabrakan, tidak bertarung. Dalam 2,5 m muncul "E: Bicara" (tidak saat ada lawan bertarung di dekat pemain). E memulai percakapan pertama yang belum selesai; kalau semua selesai, percakapan terakhir diulang. Rumah di (4, -28) diperbesar 1,3 kali menjadi rumah kepala desa.
- Kitab (`src/ui/codex-ui.ts`): tombol K atau dari menu jeda. Daftar per jenis di kiri ("???" untuk yang tertutup), isi di kanan: judul, lencana label berwarna dengan penjelasan saat disorot, paragraf, kotak kutipan dengan sumbernya, daftar sumber, tautan entri terkait (yang tertutup tampil "??? (jenis)"). Gaya kertas, huruf serif gelap. Ukuran huruf kecil, sedang, besar tersimpan dan berlaku juga untuk teks dialog.
- Pemberitahuan (`src/ui/notify.ts`): "Kitab: Judul" di pojok kanan atas 3 detik, satu per satu, ditunda sampai dialog selesai.
- Menu jeda (`src/ui/pause-menu.ts`): Esc saat pointer tidak terkunci. Lanjutkan, Kitab, Pengaturan (ukuran huruf, subtitle menyusul), Mulai ulang misi.
- Pemicu (`src/mission/triggers.ts`): `area` (lingkaran pusat dan jari) dan `pertarungan-pertama` (pertama kali ada lawan bertarung dalam jarak deteksi kamera). Masuk desa membuka `desa-kudadu`, pertarungan pertama membuka `jayakatwang`.
- Mode UI di `main.ts`: `main`, `dialog`, `kitab`, `jeda`. Logika permainan hanya berjalan di `main`; kamera tetap diperbarui dengan dt nyata.

### Skema JSON final

Sama persis dengan prompt sprint 4; tidak ada perubahan. Penegasan dari implementasi:

- `tandai` boleh ada di simpul tokoh mana pun, dijalankan saat simpul tampil (sebelum teksnya selesai diketik). `bukaKitab` juga dijalankan saat simpul tampil; pemberitahuannya muncul setelah dialog selesai.
- Simpul pilihan tidak butuh `teks`; kalau ada `teks` dan `pilihan` sekaligus, teksnya diketik dulu lalu pilihan muncul di halaman terakhir.
- Istilah `[[istilah|id-kitab]]` boleh ada di `teks` simpul maupun di `teks` pilihan.
- `dibukaOleh` di codex.json hanya catatan untuk penulis; pemicu sesungguhnya adalah `bukaKitab` di dialog.json dan daftar `pemicu` di misi3.json.
- misi3.json (bukan bagian prompt, dibuat di sprint ini):

```json
{
  "tokohPemain": "wijaya",
  "npc": [
    { "id": "kepala-desa", "nama": "Kepala desa Kudadu", "posisi": [4, -33.5], "hadap": 1.57,
      "percakapan": ["kudadu-tiba", "kudadu-ulang"] }
  ],
  "pemicu": [
    { "jenis": "area", "pusat": [0, -5], "jari": 30, "bukaKitab": ["desa-kudadu"] },
    { "jenis": "pertarungan-pertama", "bukaKitab": ["jayakatwang"] }
  ]
}
```

Memasang isi sungguhan: salin `docs/isi/dialog.json` ke `src/data/dialog.json` dan `docs/isi/codex.json` ke `src/data/codex.json`, muat ulang, dan pastikan tidak ada peringatan `[data]` di konsol. Placeholder memakai id simpul dan id entri yang sama dengan berkas di `docs/isi`, jadi tidak ada kode yang perlu disentuh.

### Hasil uji

Diuji dari konsol browser (status direset, muat ulang) dan manual:

- Permainan baru: Kitab menampilkan empat "???". Masuk desa: pemberitahuan "Kitab: Desa Kudadu". Mendekati prajurit di timur desa sampai bertarung: "Kitab: Jayakatwang". Bicara dengan kepala desa, tiap nada: tanda `kudadu-nada-hormat`, `-tegas`, `-licik` tersimpan; jalur licik melewati `n3c2` dan `n3c3`; istilah Rakryan di jalur tegas membuka kartu; tiga pemberitahuan berurutan setelah dialog. Percakapan kedua memakai `kudadu-ulang`.
- Muat ulang halaman: entri terbuka, tanda, percakapan selesai, dan ukuran huruf tetap. Mulai ulang misi dari menu: tanda dan percakapan terhapus, entri Kitab tetap.
- Tidak ada error di konsol maupun terminal; `tsc --noEmit` bersih.

### Yang belum

- Kamera sinematik tidak memeriksa tabrakan; kalau NPC berdiri rapat ke dinding, kamera bisa masuk ke dalam rumah. Posisi NPC sekarang aman.
- Dialog tidak bisa dibatalkan di tengah jalan (sengaja, supaya `tandai` dan `bukaKitab` selalu konsisten).
- Pemicu area dan pertarungan hanya "sekali per sesi" di memori; karena entri yang sudah terbuka tidak dibuka ulang, ini tidak terlihat, tetapi kalau nanti pemicu memberi efek lain (misalnya tanda), statusnya perlu disimpan.
- Belum ada suara, subtitle, atau dukungan gamepad di UI dialog dan Kitab.
- Esc saat pointer terkunci hanya melepas pointer (perilaku peramban); menu jeda butuh Esc kedua.
- Belum ada uji dengan pemain selain pengembang; syarat lolos sprint ini (pemain membaca minimal satu entri tanpa disuruh) baru bisa dinilai saat playtest.

### Keputusan yang diambil

- Semua teks UI dipindah ke `ui.json` sejak tahap A, termasuk teks HUD sprint 2 dan 3, supaya subtitle dan ukuran huruf nanti tinggal membaca satu berkas.
- Satu pendengar tombol di `main.ts` untuk Esc dan K; UI dialog mengurus tombolnya sendiri (Spasi, Enter, 1 sampai 3, Esc hanya menutup kartu istilah). Dengan begitu tidak ada dua pendengar yang bereaksi pada tombol yang sama.
- Kitab dibuka dari menu jeda kembali ke menu, bukan ke permainan.
- Mulai ulang misi mempertahankan entri Kitab karena ensiklopedia adalah kemajuan belajar lintas percobaan, bukan kemajuan misi.
- NPC dan pemicu ditaruh di `misi3.json` meski prompt hanya meminta pemicu, supaya sprint 5 (misi 3 utuh) bisa menambah tokoh dan pemicu tanpa kode.

## Sprint 5: misi 3 utuh (27 Oktober 2026)

Tujuan: merangkai semuanya menjadi misi 3 yang bisa dimainkan dari layar awal sampai layar selesai: pembukaan di hutan, patroli, Pandakan dan keputusan Gajah Pagon, Kudadu dan keputusan menginap, tujuan pilihan lumbung, pilihan rute sungai atau bukit, muara dan penyeberangan, titik simpan, layar selesai. Isi dialog dan Kitab sudah sungguhan sejak awal sprint (`docs/isi/`), tidak diubah.

### Yang sudah jalan

- Misi dibangun seluruhnya dari `src/data/misi3.json` oleh `src/mission/mission.ts` (`PelaksanaMisi`). Kode hanya menjalankan daftar `segmen` berurutan; segmen dengan `syarat` dilewati kalau tandanya tidak ada (begitulah rute sungai dan bukit bercabang). Tujuh segmen: hutan, pandakan, kudadu, rute, sungai, bukit, pantai.
- Variabel rombongan (`src/mission/party.ts`): Pengikut 12, Perbekalan 1, Gajah Pagon ikut, Kewaspadaan Daha 0, KaliKetahuan 0. Tanda dialog mengubahnya lewat `aturan.tanda` di misi3.json; ketahuan patroli lewat `aturan.ketahuan` (satu kejadian per episode, tidak dihitung lagi selama kawan masih mengejar). Status hanya memanggil aturan untuk tanda yang baru, jadi dialog yang diulang tidak mengubah angka dua kali.
- HUD rombongan kanan atas (`src/ui/party-hud.ts`): angka Pengikut, ikon nasi bungkus sejumlah Perbekalan, lencana Gajah Pagon; perubahan berkedip hijau atau merah dengan teks kecil dari JSON. HUD tujuan kiri atas (`src/ui/objective-hud.ts`), tanpa penanda di layar; penanda dunia berupa obor (`src/world/torch.ts`) per segmen.
- Gajah Pagon: pengikut keempat warna zaitun, pincang (goyang dan turun tiap langkah), laju sendiri 4,4 m/s. Selama ia ikut, pemain dan pengikut lain dibatasi 4 m/s (Shift tidak mempercepat) dan meteran curiga penjaga 1,25 kali lebih cepat. Ditinggal berarti ia berdiri diam di tempatnya sebagai NPC.
- Tata letak baru: titik awal di hutan selatan sungai (30, 92); tempat dangkal di x sekitar 32 (dasar sungai terangkat 70 persen, pasir terlihat, pemain tidak melambat); Pandakan tiga rumah dan Macan Kuping di (49, 32); dua patroli tepi utara sungai; tiga penjaga area uji sprint 3 digeser ke jalur Pandakan ke Kudadu; lumbung tua tanpa dinding di (42, -36) dengan satu penjaga tambahan dan prajurit di dalamnya; teluk muara di ujung barat sungai dengan perahu balok dan nelayan. Lawan uji sprint 2 dan `stealth-uji.json` dihapus.
- Alur: panel pembuka (layar gelap, klik untuk lanjut) → `hutan-pembukaan` otomatis (kamera sinematik mengarah ke pengikut yang bicara lewat `pengikutTokoh`) → seberangi sungai → Pandakan, `pandakan-pagon` → Kudadu, `kudadu-tiba` lalu `kudadu-malam` otomatis lewat `rantai` → panel "Beberapa jam kemudian" 2 detik → kalau menginap: penjaga pagi di dalam desa dan cahaya 1,3 kali → `kudadu-rute` di gerbang utara (NPC kedua, dipasang saat segmen mulai dan dicabut setelahnya) → rute sungai (2 + Kewaspadaan penjaga, maksimal 5, dari daftar posisi) atau bukit (panjat tebing, tanpa penjaga; `bukit-tumbang` kalau Perbekalan kurang dari 1) → muara, satu penjaga terakhir hanya di rute sungai → `pantai-perahu` → sinematik perahu 4 detik → layar selesai.
- Tujuan pilihan: warga Kudadu (`kudadu-warga-lumbung`) menunjuk lumbung; prajurit di lumbung (`lumbung-prajurit`) menambah Pengikut +1 dan hilang setelah bergabung (`hapusSetelahPercakapan`). Tidak ada tujuan di HUD.
- Pengikut yang tertinggal di bawah tebing berpindah ke belakang kamera saat pemain selesai memanjat (`susulkanSetelahPanjat`), sesuai aturan tertinggal sprint 3.
- Layar selesai (`src/ui/mission-end.ts`): ringkasan sejarah dan kutipan dari `teks.selesai`, ringkasan pemain (Pengikut tiba dari 12, Gajah Pagon, rute, kali ketahuan, entri Kitab dari 14, waktu), catatan bersumber dua versi menurut pilihan Pagon, tombol Buka Kitab dan Main lagi. Hasil disimpan ke status sebagai `hasilMisi3` (pengikutTiba, pagon, rute, kewaspadaanDaha, kaliKetahuan, waktu) untuk misi 4.
- Titik simpan: di awal tiap segmen, status menyimpan segmen, variabel rombongan, tanda, percakapan selesai, dan waktu ke localStorage. Gugur memulihkan semuanya termasuk tanda. Layar awal (`src/ui/title-screen.ts`) punya Mulai baru, Lanjutkan (kalau ada simpanan), dan Kitab; Lanjutkan memulai segmen tersimpan tanpa panel dan percakapan pembukanya, Gajah Pagon yang ditinggal ditaruh di `aturan.pagonDitinggal.posisi`.
- Mode UI di `main.ts`: `judul`, `main`, `dialog`, `kitab`, `jeda`, `panel`, `sinematik`, `selesai`. Satu fungsi `perbaruiPermainan(dt)` dipakai loop render dan pegangan uji `nusantara.langkah(dt)`.

### Skema misi3.json final

Bagian atas: `tokohPemain`, `pengikutTokoh` (id tokoh dialog ke indeks pengikut), `aturan` (lihat di bawah), `teks` (`pembuka` paragraf panel, `jeda`, `selesai` dengan `sejarah`, `kutipan`, `catatanPagonDitinggal`, `catatanPagonIkut`), `dunia` (`pandakan` daftar rumah, `lumbung`, `muara`, `perahu`), `pemicu` (pemicu Kitab lama: `area`, `pertarungan-pertama`), dan `segmen`.

`aturan`: `awal` (nilai awal variabel), `tanda` (tanda → `pengikut`, `perbekalan`, `kewaspadaan`, `pagon`, `lajuLari`, `teks`), `ketahuan` (`kewaspadaan`, `kaliKetahuan`, `pengikutJikaPagon`, `maksPengikutJikaPagon`, `teks`), `pagonIkut` (`lajuMaks` 4, `lajuPagon` 4,4, `pengaliCuriga` 1,25), `pagonDitinggal.posisi`, `penjagaSungai` (`dasar` 2, `maks` 5).

Satu segmen lengkap (segmen Kudadu, sebagaimana di berkas):

```json
{
  "id": "kudadu",
  "tujuan": "Menuju desa Kudadu di barat, temui kepala desa",
  "mulai": { "posisi": [46, 34], "hadap": -1.2 },
  "penanda": [[8, -36]],
  "penjaga": [
    { "nama": "jalur-selatan", "mode": "bolak-balik", "titik": [{ "x": 34, "z": 22 }, { "x": 50, "z": 14 }] },
    { "nama": "jalur-tengah", "mode": "melingkar", "titik": [{ "x": 26, "z": -2 }, { "x": 40, "z": -4 }, { "x": 40, "z": -14 }, { "x": 26, "z": -14 }] },
    { "nama": "jalur-utara", "mode": "bolak-balik", "titik": [{ "x": 14, "z": -24 }, { "x": 32, "z": -30 }] },
    { "nama": "lumbung", "mode": "bolak-balik", "titik": [{ "x": 34, "z": -40 }, { "x": 50, "z": -42 }] }
  ],
  "batu": [{ "x": 42, "z": 16, "lebar": 3.5, "tinggi": 2.6, "dalam": 2.5 }, { "x": 30, "z": 6, "lebar": 2.5, "tinggi": 2.2, "dalam": 3 },
           { "x": 44, "z": -10, "lebar": 3, "tinggi": 2.8, "dalam": 3 }, { "x": 24, "z": -20, "lebar": 4, "tinggi": 2.4, "dalam": 2.5 }],
  "semak": [{ "x": 38, "z": 20 }, { "x": 32, "z": 12 }, { "x": 34, "z": -8 }, { "x": 20, "z": -8 }, { "x": 20, "z": -28 }, { "x": 38, "z": -30 }],
  "npc": [
    { "id": "kepala-desa", "nama": "Kepala desa Kudadu", "posisi": [4, -33.5], "hadap": 1.57, "percakapan": ["kudadu-tiba", "kudadu-ulang"] },
    { "id": "warga", "nama": "Warga Kudadu", "posisi": [-6, -22], "hadap": 0.8, "percakapan": ["kudadu-warga-lumbung"] },
    { "id": "prajurit", "nama": "Prajurit Singasari", "posisi": [42, -36], "hadap": 3.5, "percakapan": ["lumbung-prajurit"], "hapusSetelahPercakapan": true }
  ],
  "rantai": [{ "setelah": "kudadu-tiba", "percakapan": "kudadu-malam" }],
  "selesai": { "percakapan": "kudadu-malam" }
}
```

Anggota segmen lain yang dipakai segmen lain: `syarat` (tanda yang harus ada, kalau tidak segmen dilewati; seluruh isinya menjadi dinamis), `saatMulai` (`panel` kunci teks, `lamaPanel` detik atau 0 menunggu klik, `percakapan` otomatis), `cahaya` (`syarat`, `pengali`), `jumlahPenjagaDariAturan: "penjagaSungai"` (hanya n penjaga pertama dari daftar), `pemicu` (`jenis: "area"`, `pusat`, `jari`, `percakapan`, `bukaKitab`, `jika: { perbekalanKurangDari, tanda }`), `selesai.area` (`pusat`, `jari`) atau `selesai.tanda` (satu tanda atau daftar, salah satu cukup). Pada penjaga dan NPC: `syarat` (dipasang saat segmen mulai kalau tandanya ada) dan `dinamis: true` (dipasang saat segmen mulai; NPC dinamis dicabut saat segmen selesai). Isi tanpa keduanya dipasang sekali saat misi mulai, sehingga penjaga tepi sungai sudah terlihat dari seberang.

### Placeholder TODO-SEJARAH yang perlu ditulis di luar sesi

- `misi3.json` → `teks.pembuka[2]`: kutipan Prasasti Kudadu tentang pengejaran (dibacakan setelah dua paragraf pembuka).
- `misi3.json` → `teks.selesai.kutipan`: kutipan Prasasti Kudadu tentang penyeberangan ke Madura.
- Teks penutup `teks.selesai.sejarah`, `catatanPagonDitinggal`, dan `catatanPagonIkut` disalin dari naskah; `catatanPagonDitinggal` adalah versi turunan yang dibuat di sesi ini untuk pilihan "ditinggal", perlu dibaca ulang penulis.
- Teks HUD di `aturan.tanda[*].teks` dan `aturan.ketahuan.teks` (misalnya "Wirot ditinggal di gubuk") adalah teks permainan yang ditulis di sesi ini, bukan isi sejarah; silakan ubah.
- Yang sudah ada sebelumnya di `codex.json`: beberapa TODO-VERIFIKASI (edisi Brandes, Nagarakretagama pupuh 45, status Ranggalawe 1292) tidak disentuh.

### Durasi tiap jalur

Diukur dengan bot dari konsol (`nusantara.langkah`) yang berjalan lurus antar titik, berlari kalau boleh, tidak menyelinap; tiap kali penjaga mengejar dihitung sebagai pertarungan yang dimenangkan (+12 detik) dan penjaga dikembalikan. Lama dialog diperkirakan dari panjang teks (45 huruf per detik, 1,2 detik per simpul, 4 detik per pilihan). Angka ini batas bawah; pemain yang menyelinap sabar menambah sekitar 40 detik per kelompok penjaga (bot sabar sprint 3), ada tiga kelompok di jalur utama dan sampai lima penjaga di rute sungai.

| Jalur | Jalan dan tarung (bot) | Dialog (perkiraan) | Total bot | Perkiraan pemain menyelinap |
| --- | --- | --- | --- | --- |
| (a) Pagon ditinggal, menginap, sungai, 4 kali ketahuan | 109 s | 125 s | 3,9 menit | 7 sampai 9 menit |
| (b) Pagon ikut, menginap, bukit, tidak ketahuan | 103 s | 126 s | 3,8 menit | 6 sampai 8 menit |
| (c) licik semua, lumbung, sebelum fajar, bukit, tumbang, 3 kali ketahuan | 131 s | 160 s | 4,9 menit | 8 sampai 11 menit |

Catatan: bot jalur (a) memilih menginap karena rantai `kudadu-malam` memakai pilihan yang sama dengan `kudadu-tiba`; jalur sebelum fajar diuji di jalur (c). Target 8 sampai 12 menit belum dipastikan oleh pemain manusia; kalau playtest sprint 6 terlalu cepat, pelebar pertama: tambah semak dan jarak jalur Pandakan ke Kudadu, atau tambah satu tujuan pilihan.

Hasil lain Tahap E:

- Tidak ada jalan buntu: jalur (c) menghabiskan Perbekalan sampai 0, kehilangan dua pengikut, ketahuan tiga kali, dan tetap sampai layar selesai; Pengikut paling rendah yang mungkin sekitar 8 (Pagon ditinggal atau dua gugur, satu tumbang).
- Tidak ada peringatan `[data]` di konsol; semua id dialog dan Kitab yang dipicu ada. Jalur (c) membuka 14 dari 14 entri.
- Biaya logika per frame (pemain, 4 pengikut, 6 penjaga, NPC, pemicu, kamera) 0,016 ms di laptop pengembang; fps di HUD 60 saat pane terlihat. Belum diukur di laptop sekolah.

### Yang belum

- Belum ada uji pemain manusia; durasi di atas perkiraan. Syarat lolos "pemain menyebut satu keputusan yang ia pertimbangkan" baru bisa dinilai saat playtest.
- Waktu di layar selesai hanya berjalan saat tab aktif (loop render), seperti semua logika permainan.
- Rute sungai: pos penjaga terakhir berpatroli melintasi nelayan; pemain harus menunggunya menjauh atau menyergap. Bisa terasa menjengkelkan; angka posisinya di segmen `pantai`.
- Gugur mengembalikan ke awal segmen: di rute sungai dan bukit itu berarti kembali ke gerbang utara Kudadu (jalan 150 sampai 200 m). Kalau terlalu keras, pecah rute menjadi dua segmen.
- Sinematik perahu tidak memeriksa tabrakan kamera dan perahu hanya bergeser lurus; pengikut yang sedang ditinggal (Pagon) tidak ikut naik perahu, sesuai cerita.
- Muat ulang halaman di tengah dialog atau panel menyimpan segmen, bukan posisi dialog; Lanjutkan mengulang segmen dari titik mulainya.
- Isi dinamis segmen lama (penjaga pagi) tidak dipasang lagi setelah Lanjutkan; tidak terlihat karena pemain sudah lewat.
- Tepian muara rendah (tanah −0,2 sampai −0,5 m, permukaan air −1 m): nelayan, obor, dan penjaga pantai berdiri di pasir yang hampir sejajar air; kalau terlihat janggal, naikkan tepian lewat `SIGMA_MUARA` di `terrain.ts`.

### Keputusan yang diambil

- Segmen adalah satuan misi, titik simpan, dan muat ulang saat gugur. Semua yang bergantung pilihan (rute, penjaga pagi, penjaga pantai, jumlah penjaga sungai) dinyatakan dengan `syarat` di data, bukan cabang di kode.
- Isi statis dipasang saat misi mulai supaya penjaga segmen berikutnya terlihat lebih awal; isi dinamis dipasang saat segmennya mulai dan dicabut saat misi diulang (`cabutDinamis`), termasuk batu dan semak segmen bersyarat.
- Saat Pagon ikut, pemain ikut dibatasi 4 m/s (bukan hanya pengikut) sesuai naskah "tidak bisa lari"; Pagon sendiri 4,4 m/s supaya bisa menyusul dari slot paling belakang.
- Ambang `bukit-tumbang` dibuat bisa disetel (`jika.perbekalanKurangDari`) dan dipakai 1, karena dengan angka naskah Perbekalan tidak pernah negatif (paling rendah 0 lewat sebelum fajar + bukit).
- Ketahuan dihitung saat penjaga melihat pemain sendiri (`mulaiMengejar(true)`), termasuk saat diserang dari belakang; teriakan kawan tidak menambah hitungan.
- Dialog otomatis tanpa NPC memakai posisi pengikut sebagai lawan bicara; pemetaan tokoh ke pengikut ada di `pengikutTokoh`, bukan di kode.
- Kepala desa di gerbang utara adalah NPC kedua, bukan NPC pertama yang berpindah, supaya `kudadu-ulang` tetap tersedia di rumahnya.
- Titik simpan menyalin tanda dan percakapan selesai, sehingga gugur juga membatalkan tanda yang muncul setelah segmen mulai; Kitab tetap karena kemajuan belajar.
- Memuat halaman menampilkan layar awal dengan dunia di belakangnya (`misi.siapkan()` memasang isi statis tanpa memulai), bukan langsung masuk misi.

## Sprint 6: rapikan dan uji (28 Oktober 2026)

Tujuan: memperbaiki masukan playtest pengembang sprint 5 (pemain tidak tahu harus ke mana, penjaga kaku, dunia terasa kecil dan rute bisa dipotong), menambah gamepad dan pengaturan, memasang di GitHub Pages, dan menyiapkan mode playtest untuk sesi dengan tiga sampai lima pemain. Tujuh commit, satu per tahap.

### Yang sudah jalan

- **Pemandu arah tanpa ikon di layar** (`src/world/guide.ts`, `src/mission/guide-hint.ts`, `src/ui/map.ts`, angka di `src/data/guide.json`). Tujuan segmen kini bertahap: `tujuan` di misi3.json boleh berupa daftar langkah `{teks, penanda, selesai.area}`; obor penanda jauh dipasang di langkah yang sedang aktif saja. Saat langkah baru mulai, kamera menoleh ke penanda 2 detik lalu kembali (batal kalau mouse atau stik digerakkan). Tab memancarkan kunang-kunang dari pemain ke arah penanda (gaya `kunang` atau `daun` dipilih dari `pemandu` di misi3.json). Nambi menunjuk jalan dengan subtitle kalau pemain tidak mendekati penanda selama 20 detik, paling cepat tiap 40 detik. Peta (M) berupa kanvas gaya lontar dari fungsi tinggi medan, memperlihatkan sel 5 m yang sudah dilalui, pemain, dan penanda. Obor (`src/world/torch.ts`) punya pendar sprite yang terlihat sampai 150 m menembus kabut.
- **Penjaga dua lapis dan pendengaran** (`src/stealth/guard.ts`, `vision.ts`, `stealth-manager.ts`, `sound-ring.ts`). Kerucut utama 110° sejauh 14 m; kerucut tepi 180° sejauh 5 m mengisi meteran setengah laju; jarak langsung 2,5 m dari arah mana pun kecuali pemain bersembunyi di semak. Pemain dan pengikut memancarkan radius suara (jongkok 2 m, jalan 6 m, lari 12 m, di air 1,5 kali, pengikut 0,7 kali); penjaga di dalam radius menoleh dan curiga, di dalam 60 persen radius selama 1,5 detik meterannya penuh. Lingkaran suara digambar tipis di tanah sampai 20 m dari penjaga. Bot uji: bot sabar melewati Pandakan ke Kudadu 3 dari 3 kali tanpa ketahuan, bot ceroboh ketahuan 2 kali.
- **Dunia 600 m, dua rute terpisah** (`src/world/terrain.ts`, `river.ts`, `forest.ts`, data `dunia` di misi3.json). Medan adalah fungsi analitik `tinggiMedan(x, z)` dari jarak ke garis sungai dan garis punggung bukit, bukan heightmap. Rute sungai (jalan setapak sisi timur laut sungai) dan rute bukit (punggung bukit di utara) dipisah oleh tebing curam sisi selatan bukit (x −45 sampai −195, lereng maksimal 42° dari `lerengMaksDerajat`), pita hutan jati rapat di kedua tepi sungai, dan arus deras di barat x −75 yang menyeret siapa pun yang masuk lebih dalam dari 0,5 m. Kabut 125 m, hutan dipetak 75 m dengan LOD (petak lebih dari 150 m disembunyikan), indeks pohon kisi 12 m untuk tabrakan dan garis pandang. Rute sungai dan bukit masing-masing dua segmen (titik simpan di tengah). Bot: rute sungai 102 detik dengan 2 pertarungan, rute bukit 87 detik; jalan pintas tebing turun atau naik, menembus pita jati, dan menyeberang arus semuanya gagal.
- **Perbaikan sprint 5**: penjaga rute sungai dibagi dua segmen lewat `bagianPenjaga {ke, dari}` (jumlah dari `penjagaSungai` tetap 2 + Kewaspadaan, maksimal 5; diuji untuk n = 2, 3, 5); Lanjutkan memasang kembali isi dinamis segmen yang sudah lewat (penjaga pagi, penjaga sungai paruh pertama); Esc selalu membuka menu jeda lewat `pointerlockchange`; `bukit-tumbang` dipicu area di (−100, −128).
- **Gamepad dan pengaturan** (`src/character/input.ts`, `gamepad.ts`, `src/data/input.json`, `src/ui/settings.ts`, `src/data/settings.json`). Semua masukan lewat nama aksi yang dipetakan ke kode keyboard dan indeks tombol gamepad di data; stik kiri analog (jalan pelan kalau stik setengah), stik kanan kamera, tombol Xbox: A lompat, B hindar, X serang, Y bicara, LB tangkis, RB jongkok, L3 lari, D-pad atas kunang-kunang, Start jeda, Select peta; menu, dialog, dan layar awal dijelajahi D-pad dan A/B. Petunjuk tombol di HUD berganti keyboard atau gamepad mengikuti masukan terakhir. Pengaturan di menu jeda: ukuran huruf, kepekaan mouse dan stik (0,3 sampai 2,5), balik sumbu Y, kualitas (rendah tanpa bayangan rasio piksel 0,75; sedang 1,5; tinggi 2), dipilih otomatis sekali dari fps rata-rata 5 detik pertama (kurang dari 40 rendah, kurang dari 55 sedang), tersimpan di localStorage.
- **GitHub Pages**: `vite.config.ts` memakai `base: './'` (jalur relatif, berjalan di nama repo apa pun; `BASE_PATH` untuk mengubahnya), workflow `.github/workflows/pages.yml` membangun dengan Node 22 dan memasang `dist` tiap push ke `main`. Layar awal menampilkan peringatan sekali di perangkat tanpa penunjuk halus (ponsel, tablet). Remote GitHub belum dibuat; langkahnya ada di pesan sesi Tahap F (buat repo, `git remote add origin`, push, Settings → Pages → Source "GitHub Actions").
- **Mode playtest** (`src/mission/playtest.ts`, `src/data/playtest.json`). Aktif dengan `?playtest=1`; lencana kecil "Mode playtest" di atas layar. Merekam ke localStorage (`nusantara.playtest`, 10 sesi terakhir): waktu per segmen, ketahuan dan gugur per segmen beserta koordinat, pilihan dialog (percakapan, simpul, indeks, nada), pemakaian kunang-kunang, peta, dan Nambi, entri Kitab yang terbuka dan lama dibaca, hasil misi. Tombol "Unduh catatan playtest" di layar selesai mengunduh JSON. Tanpa parameter, tidak ada yang ditulis. Lembar pengamat: `docs/playtest-lembar.md`.

### Angka baru di guide.json

| Kelompok | Angka |
| --- | --- |
| `arahanKamera` | lama 2 s, lamaPutar 0,7 s |
| `partikel` | jumlah 80, jariMuncul 3 m, laju 6 m/s, umur 4 s, jarakMaks 25 m, kelok 1,2, frekuensiKelok 1,5, tinggi 0,6 sampai 2,2 m, ukuran 0,32 |
| `partikel.gaya.kunang` | warna #d8f070, kedip 3, kedipDalam 0,5, putar 0, jatuh 0 |
| `partikel.gaya.daun` | warna #b89040, kedip 0, putar 4, jatuh 0,4 |
| `nambi` | tokoh nambi, tanpaKemajuan 20 s, toleransiKemajuan 1 m, jeda 40 s, jarakJalan 4 m, lamaJalan 3 s, lamaSubtitle 2,5 s, 3 baris ucapan (teks permainan, bukan isi sejarah) |
| `peta` | ukuranSel 5 m, pikselPerMeter 1,5 |

### Angka baru atau berubah di stealth.json

| Kelompok | Angka |
| --- | --- |
| `penjaga` pandangan utama | sudutPandang 110° (sebelumnya 70), jarakPandang 14 m (tetap) |
| `penjaga` pandangan tepi (baru) | sudutTepi 180°, jarakTepi 5 m, lajuTepi 0,5 |
| `penjaga` jarak langsung | jarakLangsung 2,5 m (tetap; kini berlaku dari arah mana pun, kecuali pemain di semak) |
| `suara` (baru) | jongkok 2 m, jalan 6 m, lari 12 m, pengaliAir 1,5, pengaliPengikut 0,7, pengaliPagon 1,0, waktuPenuh 1,5 s, bagianPenuh 0,6, jarakTampilLingkaran 20 m |

Angka lain di `penjaga`, `pemain`, `semak`, dan `pengikut` tidak berubah dari sprint 3.

### Tata letak dunia 600 m (misi3.json → `dunia`)

Sumbu: +x timur, −z utara; desa Kudadu di (0, 0); ukuran 600 × 600 m; lereng maksimal yang bisa didaki 42°.

- **Sungai**: jalur (320, 55) → (−60, 55) → (−120, 10) → (−170, −50) → (−210, −110) → (−240, −150) → (−320, −200); lebar 14 m, dalam 2,6 m, permukaan air −1 m. Tempat dangkal di x 32 (lebar 16 m) untuk penyeberangan awal. Di barat x −75 (peralihan 20 m) sungai melebar 6 m dan mendalam 1,2 m, arus mendorong 5 m/s ke tepi. Teluk muara di (−222, −132), sigma 15 m.
- **Bukit**: punggung (70, −100) → (−30, −105) → (−90, −120) → (−150, −150) → (−200, −180) → (−260, −220); tinggi 24 m, lebar puncak 8 m, lereng utara 70 m, lereng selatan landai 56 m kecuali tebing 12 m di x −45 sampai −195 (peralihan 18 m).
- **Hutan** (petak 75 m, LOD 150 m; pohon menghindari desa 48 m, jalan 3 m, air 0,2 m, lereng lebih dari 0,7): rimba-selatan kotak [−140, 72, 150, 230] jarak 7,5 m; jati-tepi-utara pita 30 sampai 46 m di sisi timur laut sungai, x −215 sampai −72, jarak 1,6 m; jati-dinding-timur kotak [−84, −118, −68, 12]; jati-tepi-selatan pita 9 sampai 25 m sisi barat daya sungai, x −250 sampai −70; rumpun-tepian kotak [−215, −130, −60, 45] jarak 13 m; rumpun-bukit kotak [−230, −230, 40, −90] jarak 16 m.
- **Jalan setapak** (lebar 2,6 m): rute sungai (0, −44) → (−28, −22) → (−46, 6) → (−58, 32) → (−78, 16) → (−98, 2) → (−115, −15) → (−135, −39) → (−155, −63) → (−173, −91) → (−188, −114) → (−198, −127); rute bukit (0, −44) → (−15, −52) → (−15, −66) → (−28, −96) → (−60, −112) → (−100, −128) → (−150, −150) → (−198, −180) → (−216, −190) → (−220, −152) → (−213, −138) → (−198, −127).
- **Tempat**: titik awal (30, 92); Pandakan tiga rumah di sekitar (44 sampai 55, 27 sampai 39); Kudadu (0, 0), gerbang utara dan kepala desa kedua (0, −44); lumbung (42, −36); perahu (−203,2, −123,4) putar 0,64; nelayan (−199, −127); area selesai kedua rute pusat (−198, −127) jari 8.
- **Segmen dan penanda**: hutan (mulai (30, 92); penanda (32, 66), (32, 56)) → pandakan (mulai (32, 44)) → kudadu (mulai (46, 34); penanda (10, −12), (8, −36)) → rute (mulai (4, −37)) → sungai (mulai (0, −46); penanda (−58, 32), (−115, −15); penjaga sungai-1, -3, -5) → sungai-2 (mulai (−115, −15); penanda (−163, −76), (−197, −124); penjaga sungai-2, -4) atau bukit (mulai (0, −46); penanda (−15, −50), (−30, −98), (−150, −148); pemicu tumbang (−100, −128) jari 9) → bukit-2 (mulai (−150, −150); penanda (−216, −188), (−197, −124)) → pantai (mulai (−195, −124); penjaga pantai hanya di rute sungai).

### Yang belum

- Belum ada uji pemain manusia; semua angka durasi dari bot. Rute bukit dengan bot sekitar 1,5 menit dan rute sungai 1,7 menit tanpa menyelinap, di bawah target 4 sampai 5 menit per rute; sprint 7 mengisi perjalanan (lihat `docs/prompt-sprint-7.md`).
- Kualitas otomatis hanya diukur dari 5 detik pertama; kalau tab dibuka di latar belakang, fps rendah palsu bisa memilih "rendah". Pemain bisa mengubahnya di menu jeda.
- Peta tidak menampilkan penjaga atau pengikut, hanya medan, jejak, pemain, dan penanda; disengaja supaya tidak menjadi radar.
- Pita hutan jati rapat di tepi sungai memakai 1,6 m antarpohon; di laptop pelan jumlah instance bisa terasa. Belum diukur di laptop sekolah.
- Catatan playtest hanya merekam waktu misi (berjalan saat tab terlihat), bukan waktu jam dinding; waktu jam ada di `mulaiPada` dan `selesaiPada` per sesi.
- Belum ada remote GitHub; pemasangan Pages belum pernah dijalankan sungguhan, baru `vite preview` lokal.
- Uji gamepad memakai gamepad tiruan di konsol (menimpa `navigator.getGamepads`), belum dengan gamepad sungguhan; pemetaan tombol mengikuti tata letak standar Xbox.

### Keputusan yang diambil

- Pemandu arah tidak memakai ikon atau panah di layar: arahan kamera, kunang-kunang, obor jauh, Nambi, dan peta. Semua bisa diabaikan pemain yang sudah tahu jalan.
- Medan dibuat dari fungsi analitik (garis sungai dan garis bukit di data), bukan heightmap, supaya tata letak diubah dengan mengedit koordinat di misi3.json dan peta bisa digambar dari fungsi yang sama.
- Rute dipisah secara fisik (tebing, pita jati, arus), bukan dengan dinding tak terlihat; batas lereng 42° berlaku untuk pemain dan pengikut, naik maupun turun.
- Semua angka baru (pemandu, suara, dunia, gamepad, pengaturan, playtest) ada di `src/data/*.json`; kode tidak memegang angka penyetelan.
- Masukan dipisah menjadi lapisan aksi supaya keyboard dan gamepad memakai jalur kode yang sama; L3 untuk lari adalah tambahan di luar prompt.
- `base: './'` dipilih daripada `/nama-repo/` supaya build yang sama berjalan di GitHub Pages, `vite preview`, dan dibuka dari berkas.
- Mode playtest aktif lewat parameter URL, bukan tombol di menu, supaya pemain tidak sengaja membukanya dan pengamat yang menyiapkannya.
- Docs selain `catatan-sprint.md` dan `playtest-lembar.md` tidak di-commit dari sesi ini karena milik penulis.

## Sprint 7: kejadian di jalur (28 Oktober 2026)

Tujuan: mengisi kedua rute dengan kejadian (lawan baru, bahaya alam, keputusan) supaya perjalanan terasa, dengan dialog dan Kitab yang sudah ada dari penulis. Empat commit: "Harimau jawa", "Perampok dan desertir", "Buaya, longsor, babi hutan", "Sprint 7 selesai: kejadian di jalur".

### Yang sudah jalan

- **Pengelola kejadian** (`src/mission/events.ts`): tiap segmen boleh punya daftar `kejadian`. Saat segmen mulai (atau dimuat ulang karena gugur) semua kejadian diundi dari benih misi (`TitikSimpan.benih`, dibuat dari waktu mulai misi), lalu aktif saat pemain masuk `jari` dari `pusat` dan semua `syarat` ada. Aktor dibuat saat itu dan dibuang saat selesai atau segmen berganti. Undian `peluang` dan `undian` berkunci deterministik per benih (`undi(benih, kunci)` memakai FNV-1a dan `acakBerbenih` dari forest.ts), jadi setelah gugur hasil undiannya sama.
- **Harimau jawa** (`src/combat/tiger.ts`, aktor `event-tiger.ts`): kapsul rebah jingga berloreng. Mengintai di balik semak atau pohon 10 sampai 15 m sambil menggeram ("..." di tepi layar ke arah sumber, `src/ui/event-hud.ts`), mengelilingi 6 m, bersiap merunduk 0,6 detik, menerkam 5 m dalam 0,3 detik (damage 30, pemain rebah 0,8 detik). Hindar ke samping lolos; tangkis pas membuatnya terhuyung 1,5 detik dan membuka Tikaman Keris; tangkis biasa kena 10 tanpa rebah. Dua kali kena: mundur 20 m, kembali 8 detik kemudian. E saat Perbekalan lebih dari 0: lempar bekal (tanda `harimau-bekal`, Perbekalan -1), harimau makan 10 detik lalu pergi selamanya. Obor menyala: menjaga jarak 4 m dan mengincar pengikut paling belakang (bukan Gajah Pagon); pengikut diseret 6 detik, kalau tidak ditolong (serang atau lempar bekal) tanda `harimau-gagak` (Pengikut -1) dan dialog `harimau-sora`. Kitab `harimau-jawa` terbuka pada geraman pertama.
- **Obor di tangan** (`Pemain.oborMenyala`, aksi `obor` = T atau D-pad kanan): diberikan lewat `aturan.obor.dariTanda` (menginap atau sebelum fajar di Kudadu) dan diumumkan di HUD rombongan. Menyala: tidak bisa tersembunyi, penjaga melihat 1,5 kali lebih jauh (`stealth.json` `obor.faktorJarak`).
- **Status pemain `terjatuh`** (`jatuhkan(dari, dorong, damage, lama)` di player-combat.ts): rebah selama waktu yang ditentukan penyerang (harimau 0,8; babi 0,6; buaya 0,6; longsor 0,8), tidak bisa berbuat apa-apa; `dorong` negatif berarti diseret ke penyerang (buaya).
- **Perampok** (`src/combat/bandit.ts`, aktor `event-bandit.ts`): kapsul cokelat tua bergolok; tiga orang menghadang jalan tanpa kerucut pandang. `Gerombolan` menggantikan antrean satu penyerang: paling banyak dua yang menyerang bersamaan dengan jeda 0,4 detik antar awal serangan. Satu isyarat 0,35 detik lalu dua tebasan (0,08 dan 0,38 detik): tebasan kedua tanpa isyarat, jadi tangkis pas lebih sulit, hindar menjauh mudah. Dialog `perampok-hadang` mulai 8 m dari kepala perampok: hormat (tanda `perampok-dibayar`, Perbekalan -2) atau tegas (`perampok-tegas`) membuat mereka pergi; tegas dengan Pengikut 12 atau kurang menambah tanda `kabar-wijaya` (Kewaspadaan +1), dengan prajurit lumbung ikut (13) tidak. Licik: bertarung dengan kepala terhuyung 1,5 detik. Mengayun keris saat mendekat menunda dialog; serangan yang kena memulai pertarungan tanpa dialog. Semua kalah: `perampok-dikalahkan`.
- **Desertir** (`event-desertir.ts`): NPC "Prajurit Daha" di gubuk kecil (lantai, dua dinding, atap) di tepi jalan, bicara dengan E, percakapan `desertir-kediri`. `desertir-ikut` memberi Pengikut +1. Di layar selesai kesetiaannya diundi dari benih (`aturan.desertir.peluangSetia` 0,5): tidak setia menambah tanda `desertir-khianat` (Kewaspadaan +1) dan kalimat `teks.selesai.desertir.khianat`, setia kalimat `setia`.
- **Buaya** (`src/world/crocodile.ts`, aktor `event-crocodile.ts`): bukan lawan, tidak bisa dibunuh. Kapsul pipih hijau tua, saat menyelam hanya riak. Muncul 3 detik, menyelam 6 detik, hanyut pelan di air sekitar pusatnya. Pemain yang kakinya di air (lebih dari 0,1 m di bawah permukaan) dalam 3 m lebih dari 1 detik diterkam: damage 35, diseret 1 m, rebah 0,6 detik, lalu buaya menyelam 8 detik. Tangkis pas saat terkaman membatalkannya.
- **Longsor** (`src/world/landslide.ts`, aktor `event-landslide.ts`): masuk jari memicu "Tanah bergeser!" dan getaran kapsul, 2 detik kemudian balok tumpukan (`tumpukan`, tidak bisa dipanjat) menutup jalan dan dua tangga tebing pendek (`tangga`, bisa dipanjat) muncul; pemain di zona tumpukan kena 20 dan rebah. Dengan Gajah Pagon, memanjat di tiap tangga dikunci (`Pemain.bolehPanjat`) sampai E ditahan 3 detik ("Tahan E: memikul Gajah Pagon"); dialog `longsor-pagon` sekali di tangga pertama. `tambahBatu` di pengelola siluman kini menerima `bisaDipanjat`.
- **Babi hutan** (`src/combat/boar.ts`, aktor `event-boar.ts`): kapsul rendah kelabu di semak, keluar saat pemain dalam 5 m, menyeruduk lurus 8 m/s (damage 15, rebah 0,6 detik), berbalik pelan, menyeruduk lagi setelah 2 detik; lari setelah satu kali kena atau tiga serudukan. Tiap serudukan memanggil penjaga terdekat dalam 20 m ke tempat babi lewat `Penjaga.selidiki(x, z)` (status mencari tanpa mengejar); tanda `babi-mengamuk`.
- **Layar selesai**: baris ringkasan per tanda kejadian dari `teks.selesai.kejadian` (misalnya "Harimau dialihkan dengan bekal", "Perampok dibayar", "Longsor menutup punggung bukit").
- **Lawan**: `Lawan.bangunBadan()` dan `nyawaMaks()` bisa ditimpa turunan; status baru `mengintai`, `menerkam`, `jeda`, `menyeret`, `makan`, `pergi`; status tenang (bukan bertarung) kini patroli, curiga, mencari, kembali, mengintai, makan, pergi. `menembus` membuat kapsul terkaman tidak dipisahkan dari pemain.

### Skema `kejadian` final (misi3.json, per segmen)

```json
{ "id": "harimau-bukit", "jenis": "harimau", "pusat": [-178, -167], "jari": 18, "muncul": [-181, -180],
  "syarat": ["rute-bukit"], "peluang": 1.0, "percakapan": "harimau-sora", "sekaliPerMisi": true }
```

- `jenis`: harimau, perampok, buaya, longsor, desertir, babi. `muncul`: tempat aktor dibuat kalau bukan di `pusat`. `posisi`: daftar anggota untuk perampok. `tumpukan` dan `tangga`: balok longsor (format seperti `batu`). `undian: { kunci, dari, ke }`: satu angka diundi per kunci, kejadian aktif kalau hasilnya `ke`. `sekaliPerMisi` salah berarti bisa aktif lagi setelah selesai (buaya).
- Aturan baru di `aturan`: `obor` (dariTanda, teks), `perampok` (jarakDialog 8, pengikutTanpaKabar 12), `desertir` (peluangSetia 0,5); tanda baru di `aturan.tanda`: harimau-bekal, harimau-gagak, harimau-mati, perampok-dibayar, perampok-tegas, kabar-wijaya, perampok-dikalahkan, desertir-ikut, desertir-khianat, longsor-terjadi, buaya-menerkam, babi-mengamuk. Teks baru: `teks.selesai.desertir` (setia, khianat) dan `teks.selesai.kejadian`, keduanya teks sementara yang perlu dibaca ulang penulis.

### Angka di combat.json

- `harimau`: nyawa 70; mengintai jarak 10 sampai 15, kecepatan 2,5, lama 8 (3 setelah mundur), geram tiap 2 sampai 4 detik, terpergok 7 m; mengelilingi jarak 6, kecepatan 3, mendekat 3,5, lama 2 sampai 4, siap terkam 5,5 m; bersiap 0,6; terkam jarak 5, durasi 0,3, damage 30, tertangkis 10, jatuh 0,8, lebar kena 0,9, jeda 0,8; mundur setelah 2 kena, 20 m, 6,5 m/s, kembali 8 detik; terhuyung 1,5; bekal makan 10 detik, lempar 3 m, jarak maks 25; obor jarak min 4, menjauh 6 m/s; waktu tolong pengikut 6; pergi 30 m.
- `perampok`: nyawa 45; golok jangkauan 1,3, sudut 60, damage 15, dorong 0,6; deteksi 12; mendekat 3,4, mengelilingi 1,8 pada 2,5 sampai 3,5 m; isyarat 0,35; tebasan 0,08 dan 0,38, durasi 0,55; mundur 0,8 sampai 1,6; terhuyung 1 (awal 1,5); jeda antar penyerang 0,4, penyerang maks 2; pergi 25 m pada 4,5 m/s.
- `buaya`: panjang 2,6; muncul 3, menyelam 6, hanyut 0,4 m/s dalam 6 m; kedalaman min 0,1; jarak terkam 3, waktu 1; terkam 9 m/s 0,45 detik, damage 35, seret 1, jatuh 0,6, lebar kena 1; menyelam setelah terkam 8.
- `babi`: nyawa 30; keluar 5 m; bersiap 0,35; seruduk 8 m/s sejauh 9, damage 15, dorong 1,2, jatuh 0,6, lebar kena 0,8; jeda 2; putar 1,6 rad/s; maks 3 serudukan; radius suara 20; pergi 30 m pada 7 m/s.
- `longsor`: jeda muncul 2, damage 20, jatuh 0,8, zona tambahan 1,5, getar 2,5, memikul 3.
- `pemain.terjatuh`: kilatan 0,15, bagian bangun 0,3.

### Penempatan dan dunia

- Jalur bersama: babi di semak (11, 1) dekat jalan Kudadu, pusat (12, 0) jari 5, sekitar 14 m dari ring penjaga jalur-tengah (sengaja, supaya penjaga terpancing). Buaya di penyeberangan x 32 (pusat (32, 58), peluang 0,5, bisa aktif lagi).
- Rute sungai: perampok di (−40, −3) (tiga orang melintang jalan; 34 m dari patroli pagi, 40 m dari sungai-1), buaya di tempat dangkal baru (pusat (−108, 16), muncul (−112, 20)), desertir di muara (gubuk (−189, −128), undian `desertir` ke 0; 29 m dari penjaga pantai).
- Rute bukit: desertir di (−44, −104) (gubuk (−42, −108), undian ke 1), longsor pemicu (−112, −133) jari 8 dengan tumpukan tiga balok dari (−124, −139) menuruni lereng utara sampai (−112, −168) dan tangga di (−116,4, −138) tinggi 1,6 dan (−118,8, −138) tinggi 3,2, harimau pusat (−178, −167) jari 18 muncul (−181, −180) dengan tiga semak tutupan. Jarak antar kejadian 68 sampai 74 m.
- Dunia: `dunia.sungai.dangkal` menjadi daftar `{ x, lebar, sisa }`: (32, 16, 0,3) dan tempat dangkal baru (−110, 36, 0,42). Jalan setapak rute sungai dibelokkan lewat air: (−100, 10), (−108, 18), (−114, 12); kedalaman di jalur paling dalam 0,7 m, jadi `deras.batasDalam` dinaikkan dari 0,5 ke 0,8. Penjaga sungai-3 digeser ke (−108, −10) sampai (−119, −23) supaya 26 m dari buaya.

### Hasil bot (frame 1/60, lari terus, tangkis saat lawan bersiap)

- Rute sungai dari gerbang Kudadu sampai layar selesai 96 detik: perampok dibayar, buaya aktif di penyeberangan tanpa menerkam (bot menunggu saat buaya muncul), desertir muara aktif tapi bot bicara dengan nelayan lebih dulu. Ketahuan 4 kali (bot tidak menyelinap), Pengikut 12 menjadi 10 karena aturan Pagon, nyawa tidak pernah turun.
- Rute bukit 101 detik: longsor, memikul Pagon dua kali dengan dialog sekali, harimau dialihkan dengan bekal, layar selesai memuat dua baris kejadian, tanpa ketahuan.
- Tanpa menangkis: bot mati melawan tiga perampok dalam 7 detik dan kena 30 per terkaman harimau; dengan tangkis saja tidak pernah kena. Tidak ada kejadian yang memotong Pengikut lebih dari 1.

### Yang belum

- Belum ada uji pemain manusia; target 4 sampai 6 menit per rute belum terukur (bot 1,6 sampai 1,7 menit karena lari terus dan tahu jalan).
- Jalan memutar lewat lereng utara di luar tumpukan longsor masih mungkin tanpa memanjat, hanya lebih jauh.
- Pengikut tidak memanjat tangga longsor; mereka berpindah ke belakang kamera lewat aturan tertinggal yang sudah ada, jadi "memikul" baru terasa lewat jeda dan dialog.
- Desertir hanya muncul di satu rute per benih; separuh permainan tidak bertemu dia. Di muara ia berdiri dekat nelayan.
- Buaya dan prajurit lumbung belum punya baris ringkasan sendiri selain tanda; babi di dalam 25 m dari penjaga dengan sengaja.
- Teks sementara: `teks.selesai.desertir`, `teks.selesai.kejadian`, teks HUD rombongan untuk tanda baru, nama "Jaran" dan "Gagak" ikut dari dialog penulis.

### Keputusan yang diambil

- Dialog `harimau-sora` hanya tampil kalau pengikut benar-benar diseret, karena teksnya menyebut Gagak diambil.
- Gajah Pagon tidak pernah jadi sasaran harimau.
- Dialog perampok ditunda selama pemain mengayun keris atau satu detik sesudahnya, supaya "menyerang sebelum dialog" bisa terjadi walau jangkauan keris hanya 1,5 m.
- Buaya tidak masuk pengelola lawan: serangan pemain tidak mengenainya, kamera dan pengikut tidak menganggapnya pertarungan.
- Tempat dangkal kedua dan belokan jalan lewat air ditambahkan karena tata letak sprint 6 tidak pernah menyeberangi air di rute sungai.
- Obor diberikan lewat tanda Kudadu yang sudah ada karena dialog tidak boleh diubah.

## Prolog dan Pages (29 Oktober 2026)

Sesi pendek sebelum playtest: isi penulis dimasukkan, prolog dijadikan panel teks kasar, dan game dipasang ke GitHub Pages.

### Yang jalan

- Isi penulis masuk ke src/data: prolog (misi1.json), Kitab 26 entri, dialog ditulis ulang. Semua id Kitab yang dibuka dari prolog ada di codex.json; tidak ada peringatan `[data]`.
- Prolog (src/mission/panels.ts): enam panel dari misi1.json di layar cokelat gelap, kotak gambar masih placeholder teks seperti `[relief: jawa-1289]` atau `[tinta: khan-agung]`, narasi diketik per huruf dengan kecepatan dialog (klik atau Spasi menyelesaikan, klik lagi lanjut), label sumber di kanan bawah memakai lencana fakta/interpretasi/legenda yang sama dengan Kitab. Entri Kitab dibuka saat panel tampil, pemberitahuannya baru muncul setelah prolog selesai. Tombol "Lewati prolog" muncul mulai panel ke-2 (Esc atau tombol B). Penutup "1292." tiga detik lalu langsung ke panel pembuka misi 3.
- Layar judul: "Mulai baru" memutar prolog lalu misi 3; tombol "Prolog" memutar ulang lalu kembali ke judul tanpa menyentuh titik simpan; "Lanjutkan" tidak memutar prolog. `prologSelesai` tersimpan di status, tidak dihapus oleh ulang misi.
- Playtest mencatat prolog: lama (detik nyata), dilewati atau tidak, dan di panel ke berapa.
- GitHub Pages: repo publik `rinotoharto/nusantara`, workflow "Pasang ke GitHub Pages" (Node 22, `npm ci`, `npm run build`, unggah dist). Game terbuka dari https://rinotoharto.github.io/nusantara/?playtest=1 : layar judul, prolog, dan catatan playtest jalan tanpa error konsol.

### Yang belum

- Gambar relief dan tinta belum ada; kotak gambar hanya placeholder. Belum ada suara.
- Gamepad di prolog baru diuji dengan tiruan `navigator.getGamepads`, belum dengan stik asli.
- Percobaan pertama workflow gagal di `deploy-pages` karena Pages belum diaktifkan; setelah Source diatur ke "GitHub Actions" dan run dijalankan ulang, berhasil.

### Keputusan yang diambil

- Waktu prolog tidak dihitung ke `waktuMisi`, supaya target 4 sampai 6 menit per rute tetap mengukur misi saja.
- Melewati prolog tetap menampilkan "1292." sebelum misi 3, supaya lompatan tahunnya tetap terbaca.
- Memutar ulang prolog dari judul tidak mengubah status permainan selain membuka entri Kitab yang belum terbuka.
- Pegangan dev `window.nusantara` hanya ada di mode dev, jadi di Pages pengujian lewat DOM dan localStorage.
