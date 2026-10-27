# Prompt sprint 3: Tikaman Keris, menyelinap, dan pengikut

Salin seluruh isi di bawah garis ke sesi Claude Code baru di folder ini.

---

Baca CLAUDE.md, docs/prototipe.md (bagian sprint 3), dan docs/catatan-sprint.md (terutama sprint 2: mesin status lawan, pengelola lawan, dan keputusan tentang tabrakan).
Kita mulai sprint 3: satu jurus kecil dari sprint 2 (Tikaman Keris, lihat bagian Jurus khas di docs/gdd.md), lalu menyelinap dan pengikut. Sprint 1 dan 2 sudah di-commit; jangan ubah rasa gerak, kamera, atau keseimbangan pertarungan kecuali diperlukan.

Buat rencana singkat dulu (berkas apa saja di src/stealth/ dan src/character/, bagaimana status penjaga nyambung ke mesin status lawan sprint 2 tanpa menduplikasi kode), lalu tunggu persetujuan saya sebelum menulis kode.

Setelah disetujui, kerjakan bertahap. Setiap tahap: pastikan `npm run dev` jalan tanpa error di terminal maupun konsol browser, beri tahu saya apa yang harus dicoba, tunggu konfirmasi saya, lalu commit.

Semua angka (sudut dan jarak pandang, waktu curiga, kecepatan patroli, jarak pengikut) ditaruh di src/data/stealth.json.

Konteks cerita untuk sprint ini (jangan tulis dialog, cukup untuk arah desain): ini malam pelarian Raden Wijaya dari pasukan Jayakatwang. Pemain membawa belasan pengikut, beberapa terluka, dan harus melewati patroli Kediri tanpa ketahuan karena bertarung melawan semua akan kalah. Menyelinap adalah jalan utama; bertarung adalah akibat kalau ketahuan.

## Tahap 0: Tikaman Keris (jurus pertama)

1. Kalau lawan sedang terhuyung (hasil tangkis pas) dan pemain menekan serang ringan sambil menghadap lawan itu dalam 2,5 m, serangan biasa diganti Tikaman Keris: pemain melesat ke lawan dalam 0,15 detik, menusuk sekali dengan damage yang menamatkan lawan biasa (nilai `tikaman.damage` di combat.json, awalnya 60), lawan rebah ke belakang lebih jauh dari biasanya.
2. Umpan balik: waktu permainan melambat ke 0,3 selama 0,25 detik, kamera mendekat 1 m lalu kembali, kilatan putih pada lawan. Semua angkanya di combat.json.
3. Tikaman tidak bisa diputus dan pemain kebal selama 0,3 detik pelaksanaannya, supaya pemain berani memakainya saat dikeroyok. Lawan lain tetap mengantre sesuai aturan satu penyerang.
4. Tulis "Tikaman Keris" sebentar di HUD saat pertama kali berhasil (nanti ini jadi pemberitahuan jurus terbuka di misi 2).
5. Uji 1 lawan 3: tangkis pas lalu tikam harus terasa seperti hadiah, bukan keharusan; pemain yang tidak memakainya tetap bisa menang.
6. Commit: "Jurus Tikaman Keris".

## Tahap A: penjaga dan kerucut pandang

1. Penjaga memakai kapsul dan tombak lawan sprint 2, tapi memulai di status baru: patroli. Patroli mengikuti daftar titik jalan dari data (bolak-balik atau melingkar), berhenti 1 sampai 2 detik di tiap titik sambil menoleh kiri-kanan.
2. Kerucut pandang digambar di lantai sebagai bidang transparan yang mengikuti kontur medan (atau cukup rata kalau medan di area patroli landai): sudut 70 derajat, jarak 14 m, hijau saat tenang, kuning saat curiga, merah saat mengejar.
3. Deteksi: pemain terlihat kalau di dalam kerucut dan tidak terhalang rumah, tebing, pohon, atau semak (raycast ke daftar padat yang sudah ada). Pemain yang berjongkok atau di dalam semak hanya terlihat dari jarak setengah.
4. Meteran curiga: naik saat pemain terlihat (lebih cepat kalau dekat atau berlari), turun saat tidak. Dari 0 ke 1 butuh sekitar 1,5 detik pada jarak sedang; penjaga yang diam melihat pemain tepat di depan hidungnya langsung penuh.
5. Commit: "Penjaga patroli dengan kerucut pandang".

## Tahap B: curiga, mengejar, kembali

1. Status penjaga: patroli, curiga, mencari, mengejar, kembali. Curiga (meteran di atas 0,3): berhenti dan menghadap ke arah pemain terakhir terlihat, kerucut kuning, tanda tanya kecil di atas kepala. Meteran penuh: mengejar, kerucut merah, tanda seru, dan masuk ke pengelola lawan sprint 2 sehingga pertarungan berjalan dengan aturan yang sama (satu penyerang, lainnya mengelilingi).
2. Penjaga yang mengejar berteriak: penjaga lain dalam 15 m ikut mengejar. Penjaga yang kehilangan pemain selama 4 detik masuk status mencari: berjalan ke titik terakhir pemain terlihat, menoleh-noleh 3 detik, lalu kembali ke patroli dengan meteran yang turun pelan.
3. Pemain bisa memutus pengejaran dengan menjauh lebih dari 25 m atau bersembunyi di semak saat tidak terlihat.
4. Pemain berjongkok dengan tombol C: kecepatan 2 m/s, kapsul memendek, tidak bisa berlari.
5. Commit: "Status curiga, mengejar, dan mencari".

## Tahap C: semak persembunyian

1. Semak berupa balok hijau gelap setengah transparan, sekitar 2 x 2 x 1,2 m, ditempatkan dari data di jalur patroli. Pemain yang berjongkok di dalam semak tidak terlihat dari luar kecuali penjaga dalam 2 m.
2. Umpan balik: saat pemain di dalam semak, pinggiran layar sedikit gelap dan ada teks kecil "Tersembunyi" di HUD. Kerucut penjaga yang melewati semak tidak memerah.
3. Kamera: saat pemain di semak, kamera tidak boleh terhalang oleh semak itu sendiri (abaikan semak di raycast kamera).
4. Commit: "Semak persembunyian".

## Tahap D: pengikut

1. Tiga pengikut berupa kapsul warna cokelat (nanti Ranggalawe, Nambi, Lembu Sora; belum perlu nama di layar) mengikuti pemain dalam formasi longgar 2 sampai 3 m di belakang, seperti anjing mengikuti tuannya: tidak menempel, tidak menghalangi kamera, berhenti saat pemain berhenti.
2. Pengikut meniru status pemain: ikut berjongkok, ikut masuk semak yang sama atau semak terdekat (satu semak muat pemain plus tiga pengikut), dan tidak terdeteksi penjaga selama pemain tidak terdeteksi. Untuk prototipe, pengikut tidak punya kerucut deteksi sendiri; mereka hanya menambah syarat: kalau pemain bersembunyi tapi seorang pengikut masih di luar semak dan dalam kerucut penjaga, meteran naik setengah kecepatan.
3. Pengikut tidak bertarung dan tidak bisa mati di sprint ini; saat pertarungan, mereka mundur 6 m dari lawan terdekat dan menunggu.
4. Pengikut menghindari rumah, pohon, dan satu sama lain dengan tabrakan yang sudah ada; kalau tertinggal lebih dari 15 m (misalnya karena pemain memanjat tebing), mereka berpindah langsung ke belakang pemain saat tidak terlihat kamera.
5. Commit: "Pengikut mengikuti pemain".

## Tahap E: area uji dan catatan

1. Buat area uji di utara desa, di antara desa dan tebing: jalur sepanjang sekitar 80 m dengan tiga penjaga patroli, lima semak, dan beberapa rumah atau batu sebagai penghalang pandang. Pemain mulai di ujung selatan dengan tiga pengikut dan harus sampai ke ujung utara. Beri penanda tujuan sederhana (tiang dengan cahaya).
2. Data penjaga, titik jalan, dan semak di src/data/stealth-uji.json agar bisa diubah tanpa kode.
3. Mainkan beberapa kali dan setel: pemain yang sabar dan memperhatikan kerucut bisa lewat tanpa bertarung; pemain yang ceroboh ketahuan dan pertarungan 1 lawan 3 yang terjadi masih bisa dimenangkan dengan tangkis dan hindar. Lawan sprint 2 di timur dan barat desa boleh tetap ada.
4. Pastikan fps mendekati 60 dengan 3 penjaga, 3 pengikut, dan kerucut pandang.
5. Tambahkan bagian "Sprint 3" ke docs/catatan-sprint.md: apa yang jalan, apa yang belum, keputusan, dan angka akhir, termasuk angka Tikaman Keris.
6. Commit: "Sprint 3 selesai: menyelinap dan pengikut".

Selesai berarti: pemain bisa melewati tiga penjaga tanpa bertarung; ketahuan memicu pertarungan yang adil; pengikut mengikuti tanpa mengganggu; fps mendekati 60.
