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
