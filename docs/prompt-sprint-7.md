# Prompt sprint 7: kejadian di jalur

Salin seluruh isi di bawah garis ke sesi Claude Code baru di folder ini.

---

Baca CLAUDE.md, docs/catatan-sprint.md (sprint 2 untuk mesin lawan, sprint 5 untuk skema misi3.json, sprint 6 untuk dunia 600 m), dan docs/isi/misi3-naskah.md bagian "Kejadian di jalur".
Kita mulai sprint 7: kejadian di jalur. Masukan playtest: perjalanan terasa kosong karena hanya berjalan dan menyelinap. Sprint ini mengisi kedua rute dengan kejadian: lawan jenis baru, bahaya alam, dan keputusan. Isi dialog sudah ada di src/data/dialog.json (`perampok-hadang`, `desertir-kediri`, `harimau-sora`, `longsor-pagon`); entri Kitab `harimau-jawa`, `buaya-muara`, `perampok` sudah ada di codex.json. Jangan ubah teksnya.

Buat rencana singkat dulu (skema `kejadian` di misi3.json, berkas baru di src/combat/ untuk jenis lawan, src/world/ untuk bahaya), lalu tunggu persetujuan saya. Setiap tahap: `npm run dev` tanpa error, beri tahu apa yang dicoba, tunggu konfirmasi, commit. Semua angka di src/data/combat.json (lawan baru) dan misi3.json (penempatan).

## Skema

Di segmen, daftar `kejadian`: `{ "id": "harimau-bukit", "jenis": "harimau" | "perampok" | "buaya" | "longsor" | "desertir" | "babi", "pusat": [x, z], "jari": 18, "syarat": [...tanda], "peluang": 1.0, "percakapan": "...", "sekaliPerMisi": true }`. Kejadian aktif saat pemain masuk jari; `peluang` kurang dari 1 diundi saat segmen mulai (dengan seed dari waktu mulai misi, disimpan ke titik simpan supaya konsisten setelah gugur). Hasil kejadian mengubah variabel rombongan lewat tanda, memakai `aturan.tanda` yang sudah ada.

## Tahap A: harimau jawa

1. Lawan baru `Harimau` (mewarisi Lawan): kapsul rendah memanjang oranye gelap dengan garis, tinggi 0,9 m, panjang 2 m. Status: mengintai (bergerak di balik semak dan pohon pada jarak 10 sampai 15 m, hanya terlihat sekilas, suara geraman sebagai teks kecil "..." di HUD arah suaranya), mengelilingi (6 m, cepat, 3 m/s), bersiap (merunduk 0,6 detik, kapsul bergetar), menerkam (lesat 5 m dalam 0,3 detik, damage 30, menjatuhkan pemain 0,8 detik kalau kena), mundur (setelah terkena 2 pukulan, lari 20 m, kembali 8 detik kemudian), mati (nyawa 70). Terkaman bisa dihindar ke samping; tangkis pas membuatnya terhuyung 1,5 detik dan membuka Tikaman Keris.
2. Pengalih: saat harimau mengintai atau mengelilingi, pemain bisa menekan E dengan Perbekalan lebih dari 0 untuk "lempar bekal" (Perbekalan -1): harimau pergi ke bekal, 10 detik makan, lalu meninggalkan area selamanya. Obor di tangan (tombol T, kalau ada obor di segmen itu, prototipe: pemain dapat obor dari kepala desa Kudadu lewat tanda `obor`) membuat harimau tidak mendekat kurang dari 4 m, tetapi pemain tidak bisa menyelinap saat memegang obor (suara dan cahaya menarik penjaga).
3. Pengikut mundur seperti saat bertarung; kalau harimau menerkam pengikut (ia memilih yang paling belakang kalau pemain memegang obor), percakapan `harimau-sora` setelahnya dan Pengikut -1 hanya kalau pemain tidak menolong dalam 6 detik (lawan harimau atau lempar bekal).
4. Satu harimau di rute bukit (`syarat: rute-bukit`), di lereng hutan sebelum celah turun. Kitab `harimau-jawa` terbuka saat pertama terlihat.
5. Commit: "Harimau jawa".

## Tahap B: perampok dan desertir

1. Lawan `Perampok`: kapsul cokelat tua dengan golok (balok pendek, jangkauan 1,3 m, damage 15, serangan dua kali berturut cepat dengan isyarat 0,35 detik, lebih sulit ditangkis pas tetapi mudah dihindar), nyawa 45, tidak memakai antrean satu penyerang sepenuhnya: dua boleh menyerang hampir bersamaan (jeda 0,4 detik). Mereka tidak waspada seperti penjaga: tidak punya kerucut, menghadang di jalan.
2. Kejadian `perampok`: tiga perampok berdiri di jalan setapak rute sungai; saat pemain dalam 8 m, percakapan `perampok-hadang` (tiga nada: bayar → Perbekalan -2 dan mereka pergi; tegas menyebut nama Wijaya → mereka pergi, tanda `kabar-wijaya` → Kewaspadaan +1; licik → pertarungan dimulai dengan satu perampok sudah terhuyung karena tertipu). Kalau pemain menyerang sebelum dialog, pertarungan langsung. Kalau Pengikut lebih dari 12 (prajurit lumbung ikut), pilihan tegas selalu berhasil tanpa kabar (mereka takut jumlah).
3. Kejadian `desertir`: NPC prajurit Daha sendirian tanpa tombak duduk di gubuk, `peluang` 1,0 tetapi posisinya diundi di salah satu dari dua rute. Percakapan `desertir-kediri`: terima (Pengikut +1, tanda `desertir-ikut`; di layar selesai teks tambahan dari `teks.selesai.desertir` tentang apakah ia setia, diundi 50 persen, kalau tidak setia Kewaspadaan +1 di akhir), tolak (tidak ada efek), atau serahkan ke Lembu Sora untuk dibunuh (pilihan licik; Sora menolak lewat dialog, Pengikut tidak berubah, tanda `sora-menolak` untuk bab 2).
4. Commit: "Perampok dan desertir".

## Tahap C: bahaya alam

1. `buaya`: di penyeberangan dangkal rute sungai (dan tempat dangkal pertama di segmen hutan dengan `peluang` 0,5). Kapsul hijau gelap pipih yang kebanyakan waktu menyelam (hanya riak kecil terlihat), muncul dan menerkam (damage 35, menyeret pemain 1 m) kalau pemain berada dalam 3 m di air selama lebih dari 1 detik; setelah menerkam ia menyelam 8 detik. Pola: muncul 3 detik, menyelam 6 detik, posisi bergeser pelan. Pemain bisa menyeberang saat ia menyelam jauh (lebih dari 8 m) atau lewat titik lain yang lebih dalam (kecepatan 0,5 kali, suara 1,5 kali). Tidak bisa dibunuh di prototipe; tangkis pas saat ia menerkam membatalkan terkaman.
2. `longsor`: di rute bukit, saat pemain mendekati titik tertentu, suara gemuruh (teks HUD "Tanah bergeser!") dan 2 detik kemudian tumpukan batu dan tanah (balok) menutup jalan setapak 6 m di depan; kalau pemain berada di zona itu, damage 20 dan terjatuh. Jalur alternatif: panjat dua tebing pendek memutar (memakai sistem panjat yang ada). Kalau Gajah Pagon ikut: di setiap tebing pendek, pemain harus berhenti 3 detik "memikul" (tahan E), percakapan `longsor-pagon` sekali.
3. `babi`: di jalur Pandakan ke Kudadu dekat semak: kapsul abu-abu rendah yang keluar dari semak saat pemain dalam 5 m, menyeruduk lurus 8 m/s (damage 15, menjatuhkan 0,6 detik), berbelok lambat, menyeruduk lagi setelah 2 detik, lari pergi setelah terkena 1 pukulan atau setelah 3 serudukan. Berisik: suara radius 15 m menarik penjaga terdekat ke lokasi (status mencari).
4. Commit: "Buaya, longsor, babi hutan".

## Tahap D: penempatan, keseimbangan, catatan

1. Tempatkan: babi di jalur bersama; buaya di penyeberangan sungai; rute sungai: perampok lalu desertir (atau desertir di bukit); rute bukit: longsor lalu harimau. Jarak antar kejadian minimal 60 m supaya tidak menumpuk, dan tidak dalam 25 m dari penjaga.
2. Mainkan kedua rute beberapa kali. Target: tiap rute 4 sampai 6 menit, dua kejadian yang terasa, tidak ada kejadian yang membuat Pengikut turun lebih dari 1. Pemain yang hanya menekan serang harus kesulitan melawan harimau (terkaman menghukum) dan perampok (serangan ganda), tetapi tangkis atau hindar tetap cukup.
3. Layar selesai menambah baris ringkasan kejadian ("Harimau dialihkan dengan bekal", "Perampok dibayar") dari tanda.
4. Tambahkan "Sprint 7" ke docs/catatan-sprint.md: skema kejadian final, angka combat.json untuk harimau, perampok, buaya, babi, dan keputusan.
5. Commit: "Sprint 7 selesai: kejadian di jalur".

Selesai berarti: kedua rute punya kejadian yang berbeda dan terasa; harimau dan perampok memaksa pola bertarung yang berbeda dari prajurit; buaya dan longsor memberi ketegangan tanpa bertarung; keputusan desertir dan perampok terhubung ke variabel rombongan.
