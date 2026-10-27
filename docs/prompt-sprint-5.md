# Prompt sprint 5: misi 3 utuh

Salin seluruh isi di bawah garis ke sesi Claude Code baru di folder ini.

---

Baca CLAUDE.md, docs/prototipe.md (bagian sprint 5), docs/catatan-sprint.md (semua sprint), dan terutama docs/isi/misi3-naskah.md: itu naskah misi yang harus dirangkai. Isi dialog dan Kitab sudah sungguhan di src/data/dialog.json dan codex.json (14 entri, 10 percakapan); jangan mengubah teksnya. Kalau butuh percakapan atau entri yang belum ada, pakai placeholder TODO-SEJARAH dengan id yang jelas dan catat di catatan sprint supaya ditulis di luar sesi.

Mulai dengan commit berkas docs yang belum ter-commit (docs/isi/, docs/prompt-sprint-4.md, docs/prompt-sprint-5.md, perubahan gdd.md dan prototipe.md, serta src/data/dialog.json dan codex.json yang kini berisi isi sungguhan) dengan pesan "Isi sejarah misi 3 dan pembaruan GDD".

Buat rencana singkat dulu (bagaimana misi dibangun dari src/data/misi3.json: urutan segmen, variabel rombongan, pemicu; berkas apa di src/mission/ dan src/ui/; apa yang berubah di tata letak dunia), lalu tunggu persetujuan saya sebelum menulis kode.

Setelah disetujui, kerjakan bertahap. Setiap tahap: pastikan `npm run dev` jalan tanpa error di terminal maupun konsol browser, beri tahu saya apa yang harus dicoba, tunggu konfirmasi saya, lalu commit.

Prinsip: misi dibangun dari data. misi3.json berisi segmen berurutan, tiap segmen punya tujuan, pemicu selesai, NPC, penjaga, semak, dan percakapan yang dipicu. Kode mission hanya menjalankan data; kalau sprint 6 atau produksi mengubah urutan, cukup ubah JSON.

## Tahap A: variabel rombongan dan HUD

1. `src/mission/party.ts`: variabel Pengikut (awal 12), Perbekalan (awal 1), GajahPagon (ikut/ditinggal), KewaspadaanDaha (0), KaliKetahuan (0), disimpan di status permainan. Aturan perubahannya persis tabel "Variabel rombongan" di naskah, dibaca dari src/data/misi3.json bagian `aturan` supaya angkanya bisa disetel.
2. Tanda dari dialog (`pagon-ditinggal`, `pagon-ikut`, `kudadu-menginap`, `kudadu-sebelum-fajar`, `rute-sungai`, `rute-bukit`, `prajurit-lumbung-ikut`, `kudadu-nada-tegas`) mengubah variabel lewat pemetaan di misi3.json, bukan di kode.
3. HUD rombongan di kanan atas: Pengikut (angka), Perbekalan (ikon nasi bungkus sejumlah nilainya), ikon Gajah Pagon kalau ikut. Perubahan ditampilkan dengan animasi singkat dan teks kecil ("Pengikut -1: Gajah Pagon dirawat di Pandakan").
4. Kapsul Gajah Pagon: pengikut keempat yang lebih lambat (maks 4 m/s), berwarna beda, berjalan pincang (goyangan kapsul). Saat ditinggal, ia tetap di Pandakan sebagai NPC diam. Saat ikut, pengikut lain tidak boleh meninggalkannya: kecepatan formasi dibatasi.
5. Commit: "Variabel rombongan dan Gajah Pagon".

## Tahap B: tata letak misi dan segmen 1 sampai 2

1. Ubah tata letak dunia seperlunya (lewat data kalau bisa): titik awal di hutan selatan sungai; tempat dangkal penyeberangan; dukuh Pandakan (3 rumah, NPC Macan Kuping) di utara sungai sebelah timur; dua penjaga patroli di tepi utara sungai; Kudadu tetap di tengah; area uji sprint 3 menjadi jalur Pandakan ke Kudadu (geser kalau perlu); lumbung tua di timur Kudadu dengan satu penjaga tambahan.
2. Sistem segmen (`src/mission/mission.ts`): membaca daftar segmen dari misi3.json, menampilkan tujuan sekarang di HUD kiri atas (teks singkat, tanpa penanda di layar; penanda dunia berupa obor atau cahaya di tujuan, sesuai GDD), memicu percakapan saat masuk area atau saat misi mulai, dan berpindah segmen saat pemicu selesai terpenuhi.
3. Segmen 1: panel pembuka (layar gelap dengan teks naskah, klik untuk lanjut; kutipan Prasasti Kudadu diisi placeholder TODO-SEJARAH), lalu `hutan-pembukaan` otomatis, tujuan "Seberangi sungai menuju Pandakan". Segmen 2: patroli tepi sungai, tiba di Pandakan memicu `pandakan-pagon` saat mendekati Macan Kuping (E: Bicara), selesai setelah percakapan.
4. Ketahuan patroli: KaliKetahuan +1, KewaspadaanDaha +1; kalau Gajah Pagon ikut, Pengikut -1 pada ketahuan pertama dan kedua (maksimal -2) dengan teks "Seorang pengikut gugur menahan pengejar".
5. Commit: "Segmen 1 dan 2: hutan, sungai, Pandakan".

## Tahap C: segmen 3 sampai 4, Kudadu dan pilihan rute

1. Segmen 3: jalur patroli ke Kudadu (penjaga area uji sprint 3). Tiba di Kudadu: `kudadu-tiba` lewat kepala desa seperti sekarang, lalu `kudadu-malam` otomatis setelahnya (Nambi mendekat). Layar gelap "Beberapa jam kemudian" 2 detik; kalau menginap, satu penjaga tambahan berpatroli di dalam desa saat pagi (pencahayaan sedikit lebih terang).
2. Tujuan pilihan: NPC warga di Kudadu memicu `kudadu-warga-lumbung`; lumbung tua di timur dengan satu penjaga dan NPC prajurit di dalamnya memicu `lumbung-prajurit`; Pengikut +1. Tidak ada tujuan di HUD untuk ini.
3. Segmen 4: di gerbang utara Kudadu, kepala desa (NPC kedua atau NPC yang sama berpindah) memicu `kudadu-rute` saat didekati. Pilihan menandai rute. Rute sungai: jalur barat sepanjang tepian dengan 2 + KewaspadaanDaha penjaga (maksimal 5) dari daftar posisi di JSON, Perbekalan -1. Rute bukit: jalur utara lewat tebing panjat, tanpa penjaga, Perbekalan -2; kalau Perbekalan negatif, saat pemain melewati titik tertentu di bukit, `bukit-tumbang` dipicu dan Pengikut -1, lalu kecepatan lari rombongan 5 m/s sampai akhir misi.
4. Pengikut harus bisa mengikuti pemain memanjat tebing: untuk prototipe, saat pemain selesai memanjat, pengikut yang tertinggal berpindah ke belakang kamera seperti aturan sprint 3.
5. Commit: "Segmen 3 dan 4: Kudadu, tujuan pilihan, pilihan rute".

## Tahap D: segmen 5, penutup, titik simpan

1. Segmen 5: "pantai" di ujung peta (tepi berpasir, air, perahu balok, NPC nelayan). Rute sungai: satu penjaga terakhir dekat perahu. Mendekati nelayan memicu `pantai-perahu`; setelah selesai, kamera menjauh 4 detik melihat rombongan di perahu (kapsul dipindah ke perahu, perahu bergerak pelan), layar gelap.
2. Layar misi selesai (`src/ui/mission-end.ts`): ringkasan sejarah (teks dari naskah, TODO-SEJARAH untuk kutipan), ringkasan pemain (Pengikut tiba dari 12, Gajah Pagon, rute, KaliKetahuan, entri Kitab terbuka dari 14, waktu), catatan bersumber yang menyesuaikan pilihan Gajah Pagon (dua versi teks di JSON), tombol "Buka Kitab" dan "Main lagi".
3. Tanda untuk misi 4 disimpan: `pengikut-tiba`, `pagon-ditinggal` atau `pagon-ikut`, `rute-*`, `kewaspadaan-daha`.
4. Titik simpan: di awal tiap segmen, status permainan (segmen, variabel rombongan, posisi, tanda) disimpan ke localStorage; "Lanjutkan" di layar awal memuat segmen terakhir dengan pemain di titik awal segmen itu. Gugur dalam pertarungan mengembalikan ke titik simpan segmen, bukan ke awal misi; variabel rombongan kembali ke nilai saat segmen dimulai.
5. Layar awal sederhana: judul "Nusantara: Rise of Majapahit", "Misi 3: Malam pelarian", tombol Mulai baru dan Lanjutkan (kalau ada simpanan), Kitab.
6. Commit: "Segmen 5, layar misi selesai, titik simpan".

## Tahap E: uji utuh dan catatan

1. Mainkan dari awal sampai akhir tiga kali dengan pilihan berbeda: (a) Pagon ditinggal, pergi sebelum fajar, rute sungai; (b) Pagon ikut, menginap, rute bukit; (c) jalur licik di semua dialog plus tujuan pilihan lumbung. Catat durasi tiap jalur; target 8 sampai 12 menit tanpa macet.
2. Pastikan tidak ada jalan buntu: pemain yang kehabisan perbekalan, kehilangan pengikut, atau ketahuan berkali-kali tetap bisa menyelesaikan misi.
3. Periksa konsol untuk peringatan `[data]`; semua id dialog dan Kitab yang dipicu harus ada.
4. fps mendekati 60 sepanjang misi di laptop pengembang.
5. Tambahkan bagian "Sprint 5" ke docs/catatan-sprint.md: skema misi3.json final (dengan contoh satu segmen lengkap), daftar placeholder TODO-SEJARAH yang perlu ditulis, durasi tiap jalur, dan keputusan.
6. Commit: "Sprint 5 selesai: misi 3 utuh".

Selesai berarti: misi 3 bisa dimainkan dari layar awal sampai layar selesai tanpa macet dalam 8 sampai 12 menit; tiga keputusan rombongan (Gajah Pagon, menginap, rute) terasa bedanya; titik simpan bekerja; semua isi dari JSON.
