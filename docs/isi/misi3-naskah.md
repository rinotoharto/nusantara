# Naskah misi 3: Malam pelarian

Versi prototipe (8 sampai 12 menit, kapsul dan balok). Versi produksi memperpanjangnya menjadi 15 sampai 18 menit dengan tujuan pilihan tambahan dan sinematik.

## Dasar sejarah

- Prasasti Kudadu (1294): Wijaya diperintahkan Kertanagara menghadang musuh di utara, menang, lalu mendapati ibu kota jatuh. Dikejar pasukan Jayakatwang, ia dan pengikutnya tiba di Kudadu pada malam hari; kepala desa memberi makan dan perlindungan, lalu mengantar mereka ke arah pantai untuk menyeberang ke Madura. Fakta.
- Pararaton: pengikut Wijaya menyusut selama pelarian; Gajah Pagon terluka di paha dan ditinggalkan di desa Pandakan dalam perawatan kepala desanya (Macan Kuping); Wijaya kemudian ke Kudadu, lalu ke pantai dan menyeberang ke Sumenep. Interpretasi; nama dan urutan dari sumber yang jauh lebih muda.
- Penyederhanaan game: Pandakan dijadikan dukuh kecil di jalur sebelum Kudadu, di area yang sama. Ditandai di Kitab sebagai penyederhanaan. TODO-VERIFIKASI: urutan Pandakan dan Kudadu dalam Pararaton (terjemahan Padmapuspita).
- Waktu: malam, musim hujan, akhir 1292. Cuaca hujan gerimis mengurangi jarak pandang penjaga (bisa dipakai sebagai alasan desain jarak pandang 14 m).

## Variabel rombongan (manajemen rombongan versi kasar)

| Variabel | Awal | Berubah oleh | Dampak |
| --- | --- | --- | --- |
| Pengikut | 12 | Keputusan Gajah Pagon (-1 kalau ditinggal), tertangkap patroli saat membawa Gajah Pagon (-1 per kejadian, maksimal -2), rute bukit tanpa perbekalan (-1) | Teks penutup dan jumlah yang tiba di Madura; disimpan sebagai tanda untuk misi 4 |
| Perbekalan | 1 | Kudadu: menginap semalam (+3) atau pergi sebelum fajar (+1); rute bukit (-2), rute sungai (-1) | Kalau di bawah 0 di rute bukit: satu pengikut tumbang dan tertinggal (Pengikut -1), kecepatan lari rombongan turun |
| Gajah Pagon | ikut | Keputusan di Pandakan | Kalau ikut: kecepatan pengikut maksimum 4 m/s (tidak bisa lari), penjaga mendeteksi rombongan 1,25 kali lebih cepat; kalau ditinggal: normal, tanda `pagon-ditinggal` |
| Kewaspadaan Daha | 0 | Nada tegas di Kudadu (+1), menginap semalam (+1), ketahuan patroli (+1 per kejadian) | Jumlah penjaga di rute sungai: 2 + kewaspadaan (maksimal 5) |

Prinsip: tidak ada keputusan yang salah secara sejarah. Semua jalur sampai ke Madura. Yang berubah adalah berapa orang yang tiba dan bagaimana rasanya.

## Urutan adegan

### 1. Pembukaan: tepi hutan (1 menit)

Panel relief sederhana (teks di layar gelap, versi kasar): "Singasari jatuh. Sang Prabu gugur. Pasukan utara yang menang pulang ke ibu kota yang sudah terbakar. Malam ini, Raden Wijaya dan dua belas pengikutnya melarikan diri ke utara, dikejar pasukan Daha." Lalu kutipan Prasasti Kudadu dibacakan (TODO-VERIFIKASI teks kutipan tentang pengejaran).

Pemain mulai di hutan selatan sungai bersama tiga pengikut terlihat (Nambi, Lembu Sora, Ranggalawe) dan Gajah Pagon yang berjalan pincang di belakang (kapsul keempat, lebih lambat). HUD menampilkan Pengikut 12 dan Perbekalan 1.

Percakapan `hutan-pembukaan` (otomatis saat mulai): Nambi melapor keadaan, Ranggalawe mendesak cepat, Lembu Sora mengingatkan Gajah Pagon. Pemain memilih nada; nada tidak mengubah apa pun di sini selain reaksi, sebagai latihan.

Tujuan: menyeberangi sungai dan mencapai dukuh Pandakan di seberang.

### 2. Patroli pertama dan dukuh Pandakan (2 sampai 3 menit)

Dua penjaga patroli di tepi utara sungai. Pemain menyelinap dengan rombongan. Kalau ketahuan, pertarungan 1 lawan 2 (adil), tapi Kewaspadaan Daha +1.

Dukuh Pandakan: tiga rumah, satu NPC kepala dukuh (Macan Kuping; nama dari Pararaton, ditandai interpretasi). Percakapan `pandakan-pagon`: Gajah Pagon sendiri yang minta ditinggal karena memperlambat semua orang; Lembu Sora menolak; kepala dukuh menawarkan merawat. Pemain memutuskan lewat pilihan nada:

- hormat kepada Gajah Pagon ("Kau sudah cukup berkorban, sembuhlah di sini"): ditinggal, Pengikut -1, tanda `pagon-ditinggal`. Ini yang tercatat Pararaton.
- tegas ("Tidak ada yang ditinggal. Kita pikul dia bergantian"): ikut, kecepatan turun, risiko naik.
- licik ("Kepala dukuh, kalau prajurit Daha datang, katakan dia orang desamu yang jatuh dari pohon"): ditinggal dengan perlindungan, Pengikut -1, tanda `pagon-ditinggal` dan `pandakan-disamarkan` (tidak berdampak di prototipe; cadangan untuk misi lain).

Kitab terbuka: `gajah-pagon`, `pararaton`.

### 3. Patroli kedua dan Kudadu (3 menit)

Jalur ke Kudadu melewati area uji sprint 3 (tiga penjaga, semak). Kalau Gajah Pagon ikut, deteksi lebih cepat dan rombongan tidak bisa lari.

Tiba di Kudadu: percakapan `kudadu-tiba` yang sudah ada (tiga nada; tegas menambah Kewaspadaan +1). Setelahnya, percakapan `kudadu-malam` dengan Nambi: menginap semalam (istirahat, Perbekalan +3, Kewaspadaan +1 karena patroli pagi) atau pergi sebelum fajar (Perbekalan +1). Layar gelap singkat "beberapa jam kemudian".

Kitab terbuka: `prasasti-kudadu`, `desa-kudadu`, `rakryan` (sudah ada), `sima`.

### 4. Pilihan rute (30 detik)

Di gerbang utara Kudadu, kepala desa menunjuk dua jalan. Percakapan `kudadu-rute`: Ranggalawe mendesak jalur sungai (cepat, tapi pos penjaga Daha), Nambi menyarankan bukit (aman, tapi jauh dan melelahkan). Pemain memilih; tidak ada nada di sini, dua pilihan langsung.

- Sungai: jalur barat mengikuti tepian, 2 + Kewaspadaan penjaga, Perbekalan -1.
- Bukit: jalur utara lewat tebing panjat, tanpa penjaga, Perbekalan -2; kalau Perbekalan jadi negatif, satu pengikut tumbang (adegan singkat: Lembu Sora menggendongnya, lalu rombongan harus meninggalkannya di gubuk; Pengikut -1).

### 5. Pantai dan penyeberangan (1 sampai 2 menit)

Tepian berpasir di ujung peta (bisa memakai tepi sungai yang sudah ada sebagai "muara"). Perahu nelayan (balok) dan satu NPC nelayan. Kalau rute sungai, ada satu penjaga terakhir di dekat perahu yang harus dilewati atau disergap.

Percakapan `pantai-perahu`: nelayan ragu membawa buronan; Wijaya meyakinkan (tiga nada, hanya reaksi). Rombongan naik perahu; kamera menjauh; layar gelap.

### 6. Layar misi selesai

Ringkasan sejarah (fakta): "Menurut Prasasti Kudadu, Wijaya menyeberang ke Madura dan diterima Arya Wiraraja di Sumenep. Dari sana ia menyusun siasat yang dua tahun kemudian melahirkan Majapahit."

Ringkasan pemain: Pengikut yang tiba (dari 12), Gajah Pagon (ditinggal di Pandakan / ikut sampai Madura), rute yang dipilih, berapa kali ketahuan, entri Kitab terbuka (n dari 8), waktu.

Catatan bersumber di bawahnya: "Pararaton mencatat Gajah Pagon ditinggal di Pandakan karena luka di paha. Kalau Anda membawanya, itu pilihan Anda, bukan sejarah; Kitab menjelaskan bedanya." Teks ini menyesuaikan pilihan pemain.

Tanda yang disimpan untuk misi 4: `pengikut-tiba` (angka), `pagon-ditinggal`, `rute-sungai` atau `rute-bukit`, `kewaspadaan-daha`.

## Tujuan pilihan (satu untuk prototipe)

Di Kudadu, seorang warga (NPC) menyebut ada prajurit Singasari yang tercecer bersembunyi di lumbung tua di timur desa. Kalau pemain mendatanginya (menyelinap melewati satu penjaga tambahan), Pengikut +1 dan Kitab `prajurit-singasari` terbuka. Opsional, tidak ditunjukkan di HUD, hanya lewat dialog.

## Entri Kitab yang dibutuhkan misi 3

Sudah ada: prasasti-kudadu, jayakatwang, desa-kudadu, rakryan.
Ditulis di docs/isi/codex.json pada tahap berikutnya: raden-wijaya, gajah-pagon, nambi, ranggalawe, lembu-sora, pararaton, sima, madura-wiraraja, prajurit-singasari, pandakan.
