# Prompt sprint 6: rapikan dan uji

Salin seluruh isi di bawah garis ke sesi Claude Code baru di folder ini.

---

Baca CLAUDE.md, docs/prototipe.md (bagian sprint 6 dan playtest), docs/catatan-sprint.md (terutama sprint 5: skema misi3.json dan daftar "Yang belum"), dan docs/gdd.md bagian Mekanik inti: Jelajah.
Kita mulai sprint 6: rapikan dan uji. Masukan pertama dari pemain manusia (pengembang sendiri): bingung harus ke arah mana, karena satu-satunya petunjuk adalah obor di tujuan dan teks tujuan di HUD. GDD melarang ikon dan penanda di layar, jadi jawabannya harus ada di dunia.

Buat rencana singkat dulu, lalu tunggu persetujuan saya sebelum menulis kode. Setiap tahap: `npm run dev` tanpa error di terminal maupun konsol, beri tahu saya apa yang harus dicoba, tunggu konfirmasi, lalu commit. Semua angka baru di src/data/ (misalnya guide.json), bukan di kode.

## Tahap A: pemandu arah

0. Dua perbaikan paling murah dulu. (a) Tujuan bertahap: `tujuan` di segmen boleh berupa daftar langkah `[{ "teks": "...", "penanda": [x, z], "selesai": { "area": ... } }]`; HUD menampilkan langkah sekarang dan berganti saat langkahnya selesai, dengan kedipan singkat. Pecah segmen hutan menjadi "Ke utara menembus hutan sampai sungai" → "Seberangi di tempat dangkal yang ditandai obor" → "Dukuh Pandakan di timur laut, temui kepala dukuh"; lakukan serupa untuk segmen lain yang panjang (kudadu, sungai, bukit). Teks tujuan yang sudah diperbaiki di misi3.json merujuk hal yang terlihat (hutan, sungai, obor, bukit) dan arah mata angin; pertahankan gaya itu. (b) Arahan kamera: saat langkah tujuan baru muncul dan pemain tidak sedang bertarung atau dialog, kamera menoleh halus ke arah penanda langkah itu selama 2 detik (pemain tetap bisa bergerak), lalu kembali. Kalau pemain menggerakkan mouse, arahan dibatalkan.
1. Kunang-kunang pemandu. Tekan Tab (dan tombol gamepad nanti): 60 sampai 100 titik cahaya kecil (points atau instanced sprite, warna hijau kekuningan, berkedip pelan) muncul dalam 3 m di sekitar pemain lalu hanyut ke arah tujuan segmen sekarang dengan kecepatan 6 m/s, sedikit berkelok, memudar setelah 4 detik atau setelah 25 m. Arah dihitung dari posisi pemain ke `penanda` segmen (kalau lebih dari satu penanda, yang terdekat). Bisa dipicu lagi kapan saja; saat dialog, panel, dan Kitab tidak aktif. Sistemnya ditulis umum sebagai `src/world/guide.ts` dengan dua gaya: `kunang` (malam, dipakai sekarang) dan `daun` (siang, cukup kerangka: partikel cokelat kekuningan yang berputar), dipilih dari data misi. Petunjuk tombol di HUD menambah "Tab: Pemandu".
2. Penanda jauh. Obor di tujuan (`src/world/torch.ts`) ditambah pendar besar yang terlihat dari 150 m (sprite bercahaya lembut yang skalanya naik dengan jarak supaya ukurannya di layar stabil) dan tiang asap tipis (beberapa bidang transparan yang naik pelan). Pada tujuan berupa percakapan dengan NPC, penanda ada di dekat NPC itu. Pastikan tidak tertutup kabut: atur jarak kabut atau kecualikan sprite dari kabut.
3. Nambi penunjuk jalan. Kalau pemain tidak mendekati tujuan selama 20 detik (jarak ke penanda tidak berkurang) dan tidak sedang bertarung, dialog, atau bersembunyi: pengikut Nambi berkata satu baris pendek dari src/data/guide.json (misalnya "Ke sana, Raden." dengan dua atau tiga variasi, teks sebagai subtitle kecil di bawah layar 2,5 detik) dan berjalan 4 m ke arah tujuan lalu kembali ke formasi. Tidak lebih dari sekali per 40 detik. Saat Nambi tidak ada di segmen itu (misalnya di perahu), lewati.
4. Peta. Tombol M (dan dari menu jeda): tampilan atas 300 x 300 m digambar sekali ke kanvas 2D dari fungsi tinggi medan (warna tanah menurut tinggi, sungai biru, hutan hijau, rumah sebagai kotak), gaya lontar kecokelatan seperti Kitab. Di atasnya: posisi dan arah hadap pemain (segitiga kecil), penanda tujuan sekarang (lingkaran berpendar), dan area yang sudah dilalui sedikit lebih terang. Tanpa penjaga, tanpa semak, tanpa tujuan pilihan: peta untuk orientasi, bukan untuk menyelinap. Permainan berhenti saat peta terbuka.
5. Commit: "Pemandu arah: tujuan bertahap, arahan kamera, kunang-kunang, penanda jauh, Nambi, peta".

## Tahap B: penjaga yang lebih hidup (masukan playtest pengembang)

Masukan: pemain bisa berdiri tepat di samping penjaga tanpa ketahuan, dan berjalan tegak di dekat penjaga tidak berisiko selama di luar kerucut. Semua angka di stealth.json.

1. Pandangan dua lapis: kerucut utama 110 derajat 14 m (naik dari 70) dan pandangan tepi 180 derajat 5 m yang menaikkan meteran dengan laju 0,5 kali. Gambar kerucut di lantai menyesuaikan (kipas utama penuh, kipas tepi lebih tipis dan transparan).
2. Jarak dekat tanpa arah: pemain dalam 2,5 m dari penjaga langsung ketahuan dari sisi mana pun, kecuali sedang berjongkok di dalam semak (lalu berlaku aturan tembus 2 m yang sudah ada).
3. Pendengaran: tiap langkah pemain memancarkan suara dengan radius menurut gerak: jongkok 2 m, jalan 6 m, lari 12 m, di dalam air 1,5 kali. Penjaga dalam radius itu, walaupun membelakangi, masuk status curiga dan menoleh ke sumber suara; kalau suara berulang selama 1,5 detik di dalam 60 persen radius, meteran penuh. Pengikut memancarkan suara 0,7 kali pemain (Gajah Pagon 1,0 kali karena pincang). Tampilkan lingkaran suara tipis di sekitar pemain saat berjalan atau berlari di dekat penjaga (dalam 20 m) supaya pemain belajar aturannya.
4. Uji ulang jalur Pandakan ke Kudadu dengan bot sabar dan bot ceroboh seperti sprint 3; pemain sabar yang berjongkok dan memakai semak harus tetap bisa lewat tanpa bertarung, pemain yang berjalan tegak di dekat penjaga harus ketahuan.
5. Commit: "Penjaga: pandangan dua lapis, jarak dekat, pendengaran".

## Tahap C: dunia lebih luas dan rute yang sungguhan (masukan playtest pengembang)

Masukan: peta terasa kecil (desa masih terlihat dari muara), rute bukit bisa dipotong langsung ke tepian sungai sehingga pilihan rute terasa percuma, dan tujuan akhir sudah terlihat sebelum perjalanan dimulai.

1. Perbesar dunia misi 3 menjadi sekitar 600 x 600 m (ukuran di data; fungsi tinggi medan dan hutan instancing menyesuaikan). Desa Kudadu tetap di tengah, hutan dan titik awal di selatan, Pandakan di tenggara, muara dipindah jauh ke barat laut (sekitar 230 m dari gerbang Kudadu dalam garis lurus, lebih jauh lewat jalur).
2. Pisahkan dua rute dengan medan yang tidak bisa dipotong, bukan tembok tak kasat mata: punggung bukit utara dengan tebing curam di sisi selatannya (terapkan batas lereng yang sudah dicatat sejak sprint 1: lereng di atas sekitar 40 derajat tidak bisa didaki), hutan jati rapat di antara kedua rute dengan batang yang menghalangi, dan bagian barat sungai yang dalam dan deras (pemain terseret kembali ke tepi kalau masuk). Rute bukit: panjat tebing di utara desa, menyusuri punggung bukit ke barat, turun lewat celah ke muara dari utara. Rute sungai: tepian selatan menuju barat, beberapa pos penjaga, tiba di muara dari timur. Keduanya baru bertemu di muara.
3. Jalan setapak terlihat sepanjang kedua rute: jalur tanah lebih terang (tekstur atau vertex color di medan) selebar 2 sampai 3 m, berkelok mengikuti kontur; bukan wajib diikuti, tapi jadi petunjuk alami. Pos penjaga rute sungai ditempatkan di titik yang memaksa pemain memilih: lewat semak, lewat air dangkal, atau menyergap.
4. Jarak pandang: kabut jarak sekitar 120 m dan tikungan atau punggung bukit terakhir yang menutupi muara, sehingga tujuan baru terlihat setelah sebagian besar jalur ditempuh. Pendar penanda jauh (tahap A) tetap tembus kabut supaya arah tetap terasa.
5. Sesuaikan posisi semua segmen, penanda, penjaga, semak, dan batu di misi3.json; durasi tiap rute ditargetkan 4 sampai 5 menit dengan menyelinap. Pastikan fps masih mendekati 60 dengan dunia yang lebih luas (hutan lewat instancing dan LOD sederhana: pohon di atas 150 m dari kamera tidak digambar).
6. Commit: "Dunia 600 m, dua rute terpisah, jalan setapak".

## Tahap D: perbaikan dari daftar "Yang belum" sprint 5

1. Pecah rute sungai dan rute bukit masing-masing menjadi dua segmen (titik simpan di tengah) supaya gugur tidak mengembalikan pemain 200 m.
2. Pos penjaga terakhir di muara: ubah titik patrolinya agar tidak melintasi nelayan; beri satu semak di dekat perahu.
3. Naikkan tepian muara kalau terlihat janggal (`SIGMA_MUARA`), cek secara visual.
4. Lanjutkan: isi dinamis segmen lama dipasang kembali sesuai tanda (penjaga pagi kalau menginap), supaya konsisten.
5. Esc: saat pointer terkunci, Esc pertama melepas pointer dan langsung membuka menu jeda (tangkap event `pointerlockchange`), bukan butuh Esc kedua.
6. Commit: "Perbaikan sprint 5".

## Tahap E: gamepad dan pengaturan

1. Gamepad lewat Gamepad API: stik kiri gerak, stik kanan kamera, A lompat/panjat, X serang (tahan untuk berat), LB atau L1 tangkis, B hindar, RB jongkok, Y bicara, D-pad atas pemandu, Start jeda, Select peta. Petunjuk tombol di HUD berganti otomatis saat gamepad dipakai terakhir. Pemetaan di src/data/input.json.
2. Pengaturan di menu jeda: ukuran huruf (sudah ada), kepekaan mouse dan stik, balik sumbu Y, kualitas (rendah: bayangan mati dan resolusi 0,75; sedang; tinggi), dipilih otomatis pertama kali dari fps 5 detik pertama. Tersimpan di localStorage.
3. Commit: "Gamepad dan pengaturan".

## Tahap F: pasang di GitHub Pages

1. Pastikan `npm run build` bersih dan `vite preview` jalan. Atur `base` di vite.config untuk GitHub Pages (nama repo), buat workflow GitHub Actions yang membangun dan memasang ke Pages saat push ke main.
2. Beri tahu saya langkah yang harus saya lakukan di GitHub (membuat repo kalau belum, mengaktifkan Pages dari Actions). Jangan push tanpa konfirmasi saya.
3. Tambahkan layar peringatan kecil saat pertama kali dibuka di ponsel atau layar sentuh: "Versi ini untuk laptop dengan keyboard dan mouse atau gamepad".
4. Commit: "Pemasangan GitHub Pages".

## Tahap G: persiapan playtest dan catatan

1. Mode playtest (`?playtest=1` di URL): mencatat ke localStorage dan bisa diunduh sebagai JSON: waktu per segmen, kali ketahuan per segmen, pilihan dialog, berapa kali Tab, M, dan petunjuk Nambi terpakai, entri Kitab yang dibuka dan berapa lama dibaca, gugur dan di mana. Tombol "Unduh catatan playtest" di layar selesai dalam mode ini.
2. Buat docs/playtest-lembar.md: lembar pengamatan untuk saya isi per pemain (nama atau inisial, umur, pengalaman game), kolom waktu dan tempat bingung, dan empat pertanyaan dari docs/prototipe.md, ditambah dua: "Apakah kamu tahu harus ke mana? Apa yang membantumu?" dan "Keputusan mana yang paling kamu pikirkan?"
3. Tambahkan bagian "Sprint 6" ke docs/catatan-sprint.md: apa yang jalan, apa yang belum, keputusan, daftar angka guide.json dan stealth.json yang baru, serta tata letak dunia 600 m (koordinat utama).
4. Commit: "Sprint 6 selesai: rapikan dan uji".

Selesai berarti: pemain baru yang tidak diberi tahu apa pun bisa menemukan arah lewat kunang-kunang, penanda jauh, Nambi, atau peta tanpa ikon di layar; gamepad bekerja; game bisa dibuka dari tautan GitHub Pages; mode playtest mencatat data untuk sesi dengan tiga sampai lima pemain.
