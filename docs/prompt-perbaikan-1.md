# Prompt perbaikan 1: air di penyeberangan buaya, dan jurus Sergap

Salin seluruh isi di bawah garis ke sesi Claude Code baru di folder ini.

---

Baca CLAUDE.md, docs/catatan-sprint.md (sprint 3 untuk penjaga dan Tikaman Keris, sprint 6 untuk dunia dan suara, sprint 7 untuk tempat dangkal baru dan jalan setapak lewat air), dan docs/gdd.md bagian Jurus khas. Dua pekerjaan dari playtest pengembang. Rencana singkat dulu, tunggu persetujuan, lalu tiap pekerjaan satu commit setelah saya cek di browser.

## 1. Bug: air hilang di penyeberangan buaya rute sungai

Gejala: di tempat dangkal kedua (sekitar x −110, tempat buaya), sungai terlihat seperti daratan tanpa air; pemain seolah berjalan di tanah.

Periksa tiga dugaan ini berurutan dan laporkan mana yang benar sebelum memperbaiki:

1. Jalan setapak rute sungai yang dibelokkan lewat air ((−100, 10), (−108, 18), (−114, 12)) memengaruhi medan: kalau pewarnaan atau peninggian jalan setapak diterapkan di dasar sungai, tanahnya bisa naik di atas permukaan air (−1 m) atau diwarnai cokelat terang sehingga tampak seperti tanah walau air ada. Cek `tinggiMedan` dan pewarnaan vertex di `terrain.ts` di sepanjang jalur itu: cetak tinggi tanah pada 10 titik sepanjang jalan di dalam sungai dan bandingkan dengan `PERMUKAAN_AIR`.
2. Pita air di `river.ts` hanya punya dua titik per simpul jalur dan arah rata-rata di tikungan; di tikungan tajam (−60, 55) → (−120, 10) → (−170, −50) pita bisa menyempit atau terpelintir sehingga sebagian lebar sungai tidak tertutup air. Cek dengan menggambar pita air dari atas (peta M atau tangkapan layar kamera atas) dan bandingkan dengan `diJalurAir`.
3. Tempat dangkal `{ x: −110, lebar: 36, sisa: 0.42 }` digabung dengan faktor deras (yang di x −110 sudah penuh: dalam 3,8 m, lebar 20 m): pastikan hasil `parit` di tengah penyeberangan masih di bawah −1 m sepanjang lebar yang dilalui jalan, termasuk dengan `gelombang` medan (sampai ±1,1 m) yang mungkin mengangkat dasar di beberapa titik.

Perbaikan yang diinginkan: air terlihat jelas di seluruh penyeberangan, kedalaman di jalur 0,5 sampai 0,8 m (pemain melambat dan buaya bisa menerkam), warna dasar sungai tetap pasir, bukan jalan. Kalau perlu, pita air dibuat dengan menyisipkan titik tambahan setiap 10 m sepanjang jalur dan lebar yang mengikuti `diJalurAir`, supaya masalah serupa tidak muncul di tikungan lain. Cek juga penyeberangan pertama (x 32) dan muara setelah perubahan. Commit: "Perbaikan air di penyeberangan dan pita sungai".

## 2. Jurus Sergap (jurus kedua; lihat tabel Jurus khas di docs/gdd.md, kini dibuka di misi 3)

Semua angka di combat.json blok `pemain.sergap`, dan yang menyangkut penjaga di stealth.json.

1. Syarat: pemain berjongkok, berada di belakang sasaran (dalam kerucut 120 derajat di belakang arah hadap sasaran) dalam 1,6 m, dan sasaran sedang tidak bertarung atau mengejar (penjaga: patroli, curiga, mencari, kembali; perampok sebelum dialog atau saat tidak bertarung; babi dan harimau tidak bisa disergap). Saat syarat terpenuhi, HUD menampilkan petunjuk kecil di dekat sasaran: "Serang: Sergap" (keyboard klik kiri, gamepad X, sama dengan tombol serang, bukan tombol baru, sesuai prinsip satu tombol serang).
2. Pelaksanaan: pemain melesat ke punggung sasaran 0,15 detik, lalu animasi 1,0 detik: kapsul pemain menempel di belakang sasaran, keris masuk, sasaran rebah pelan ke depan (tidak terlempar). Selama 1,0 detik pemain tidak bisa bergerak dan **tidak kebal** (berbeda dari Tikaman): kalau penjaga lain menyerang di saat itu, pemain kena. Sasaran mati seketika, apa pun nyawanya. Tanpa perlambatan waktu; kamera sedikit merendah dan mendekat 0,6 m. Suara: radius 3 m saja.
3. Konsekuensi: penjaga lain yang **melihat** pelaksanaan sergap (pemain atau sasaran di dalam kerucut utamanya) langsung mengejar, bukan sekadar curiga; penjaga yang hanya mendengar (dalam 3 m) curiga biasa. Mayat tetap di tempat sampai menghilang (3 detik, seperti lawan mati sekarang); tidak perlu sistem menyembunyikan mayat di prototipe.
4. Kalau sasaran berbalik atau menjadi waspada tepat sebelum tombol ditekan (syarat batal dalam jendela 0,1 detik), serangan menjadi serang ringan biasa dan sasaran langsung mengejar.
5. HUD menulis "Sergap" di tengah layar saat pertama kali berhasil (seperti Tikaman Keris); tanda `sergap-pertama` disimpan. Mode playtest mencatat jumlah sergap dan jumlah yang ketahuan penjaga lain.
6. Keseimbangan: uji jalur Pandakan ke Kudadu dan rute sungai dengan bot. Pemain yang sabar bisa menyergap satu per satu penjaga yang terpisah, tetapi dua penjaga yang saling melihat tidak bisa disergap keduanya tanpa ketahuan; pemain yang menyergap dalam pandangan penjaga lain harus menghadapi pengejaran penuh. Kalau terlalu mudah, perkecil kerucut belakang ke 90 derajat atau perpanjang durasi ke 1,3 detik; catat angka akhirnya.
7. Tambahkan catatan "Perbaikan 1" ke docs/catatan-sprint.md: penyebab bug air, angka Sergap, hasil bot. Commit: "Jurus Sergap".

Selesai berarti: air terlihat di penyeberangan buaya dan tikungan lain; pemain berjongkok di belakang penjaga yang lengah bisa menamatkannya dengan tombol serang, dengan risiko yang terasa kalau penjaga lain melihat.
