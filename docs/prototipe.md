# Rencana prototipe bab 1

Oct 27, 2026 · @rino

Prototipe ini membuktikan dalam 8 minggu bahwa misi 3 (pelarian) enak dimainkan di browser, memakai kapsul dan balok tanpa aset jadi.

## Tujuan prototipe

Prototipe menjawab satu pertanyaan: apakah inti gameplay (bergerak, menyelinap, bertarung ringan, dialog, dan membuka entri sejarah) menyenangkan selama 3 sampai 4 menit di browser? Kalau jawabannya ya, produksi aset layak dimulai; kalau tidak, yang diperbaiki adalah desainnya, bukan grafiknya.

Yang dibuat:

- Satu area semi-terbuka 300 x 300 meter dari balok dan bidang: desa Kudadu, tepian sungai, hutan.
- Wijaya sebagai kapsul; pengikut dan prajurit Kediri sebagai kapsul dengan warna berbeda.
- Pergerakan orang ketiga, kamera, lari, memanjat satu jenis tebing, menyeberang sungai.
- Pertarungan dasar: serang, tangkis, hindar, serangan berat, dengan isyarat lawan.
- Menyelinap: zona pandang prajurit, bersembunyi di semak balok.
- Dialog dengan tiga pilihan nada, dibaca dari JSON.
- Ensiklopedia dengan tiga entri sungguhan (Prasasti Kudadu, Jayakatwang, desa Kudadu) agar mekanik edukasinya ikut diuji.
- Menu jeda, titik simpan, layar misi selesai.

Yang sengaja tidak dibuat: model 3D, tekstur, animasi karakter (kapsul cukup miring dan bergerak), musik, efek, misi selain misi 3, dan optimasi di luar yang dibutuhkan untuk 30 fps.

## Persiapan (satu sore)

1. Pasang Node.js versi LTS, Git, dan Claude Code; buat akun GitHub.
2. Buat repo `majapahit-game` di GitHub dan klon ke laptop.
3. Minta Claude Code membuat proyek Vite + TypeScript + Three.js, lalu pastikan `npm run dev` menampilkan kotak berputar di browser. Ini uji pertama bahwa rantai alatnya bekerja.
4. Salin GDD dan rencana ini ke folder `docs/` di repo (ekspor dari sini sebagai Markdown).
5. Buat berkas `CLAUDE.md` di akar repo berisi aturan proyek, karena Claude Code membacanya setiap sesi. Isinya kurang lebih:

```markdown
# Majapahit: game sejarah berbasis web

Game aksi-petualangan orang ketiga, Three.js + TypeScript + Vite.
Tahap sekarang: prototipe tanpa aset (kapsul dan balok). Lihat docs/gdd.md dan docs/prototipe.md.

Aturan:
- Semua data misi, dialog, dan ensiklopedia di src/data/*.json, bukan di kode.
- Model 3D hanya glTF; untuk prototipe pakai geometri primitif.
- Target 30 fps di laptop biasa; jangan tambah pustaka tanpa alasan.
- Jalankan `npm run dev` dan cek di browser sebelum menyatakan selesai.
- Jangan mengubah fakta sejarah di data; kalau ragu, tandai TODO-SEJARAH.
- Bahasa UI dan komentar kode: Indonesia.
```

Struktur folder yang disarankan:

```
src/
  main.ts          titik masuk
  world/           medan, bangunan balok, vegetasi
  character/       pengendali pemain, kapsul, animasi sederhana
  combat/          serangan, tangkisan, nyawa, AI lawan
  stealth/         zona pandang, persembunyian
  dialog/          sistem percakapan dari JSON
  codex/           ensiklopedia
  mission/         pemuat misi, pemicu, titik simpan
  ui/              HUD, menu
  data/            misi3.json, dialog.json, codex.json
docs/              gdd.md, prototipe.md, catatan-sejarah.md
```

## Enam sprint mingguan

Satu sprint = satu minggu kerja paruh waktu (sekitar 10 sampai 15 jam). Setiap sprint berakhir dengan sesuatu yang bisa dimainkan dan satu syarat lolos; kalau syaratnya gagal, sprint berikutnya dipakai untuk memperbaikinya, bukan menambah fitur.

1. **Bergerak dan melihat.** Medan balok dengan bukit, sungai, dan desa; kapsul pemain; kamera orang ketiga dengan tabrakan; lari dan lompat; satu tebing yang bisa dipanjat. Syarat lolos: berjalan keliling area dua menit terasa enak, kamera tidak menembus tembok, 60 fps di laptop Anda.
2. **Bertarung.** Lawan kapsul dengan AI sederhana (mendekat, menyerang dengan isyarat 0,5 detik, mundur); serang, tangkis, hindar, serangan berat; nyawa dan kematian; HUD minimal. Syarat lolos: pertarungan 1 lawan 3 bisa dimenangkan dengan tangkis dan hindar, bukan dengan menekan serang terus-menerus.
3. **Menyelinap.** Kerucut pandang prajurit yang terlihat di lantai, status waspada dan mengejar, semak persembunyian, pengikut yang mengikuti pemain. Syarat lolos: pemain bisa melewati tiga penjaga tanpa bertarung, dan ketahuan memicu pertarungan yang adil.
4. **Dialog dan ensiklopedia.** Sistem percakapan dari JSON dengan tiga pilihan nada; adegan dengan kepala desa Kudadu; ensiklopedia dengan tiga entri bersumber dan label fakta, interpretasi, atau legenda; entri terbuka saat peristiwa terjadi. Syarat lolos: pemain yang diuji membaca minimal satu entri tanpa disuruh.
5. **Misi 3 utuh.** Rangkai semuanya: pembukaan di tepi hutan, melewati patroli Kediri, dialog di Kudadu, manajemen rombongan dalam bentuk kasar (jumlah pengikut, perbekalan, keputusan tentang Gajah Pagon), pilihan rute (sungai atau bukit) yang terasa bedanya, satu tujuan pilihan, penyeberangan ke Madura sebagai penutup; titik simpan; layar misi selesai dengan ringkasan sejarah. Syarat lolos: dimainkan dari awal sampai akhir tanpa macet dalam 8 sampai 12 menit, dan pemain menyebut setidaknya satu keputusan yang ia pertimbangkan (bukan hanya refleks). Catatan: GDD kini menargetkan bab 1 sekitar 90 menit dengan satu tantangan berpikir per misi; prototipe menguji contohnya di misi 3.
6. **Rapikan.** Perbaiki umpan balik sprint 5 (pemandu arah tanpa ikon, penjaga yang mendengar, dunia 600 m dengan dua rute terpisah), tambah gamepad, pasang di GitHub Pages, siapkan mode playtest. Syarat lolos: pemain baru menemukan arah tanpa diberi tahu; rute bukit dan sungai tidak bisa saling dipotong.
7. **Kejadian di jalur.** Harimau, perampok, buaya, longsor, desertir, babi hutan: dua sampai tiga kejadian per rute, dua jenis lawan baru. Syarat lolos: tiap rute 4 sampai 6 menit dan pemain menyebut satu kejadian yang berkesan tanpa diminta.
8. **Playtest.** Jalankan playtest dengan tiga sampai lima orang memakai mode playtest dan lembar pengamatan. Syarat lolos: lihat bagian playtest.

Catatan: rencana awal enam sprint; sprint 7 ditambah setelah playtest pengembang menemukan perjalanan terasa kosong. Prototipe menjadi delapan minggu.

Setiap akhir sprint, catat di `docs/catatan-sprint.md` apa yang jalan, apa yang tidak, dan keputusan yang diambil; Claude Code akan memakainya sebagai konteks sesi berikutnya.

## Cara bekerja dengan Claude Code

Pola harian yang cocok untuk pemula: satu sesi, satu tujuan kecil yang bisa dilihat di browser. Minta rencana dulu, setujui, baru minta kode. Setelah selesai, coba sendiri di browser dan laporkan apa yang terasa salah dengan bahasa biasa ("kamera terlalu dekat", "lawan terlalu cepat"), tanpa perlu tahu istilah teknisnya.

Prompt pembuka sprint 1, bisa disalin:

```markdown
Baca CLAUDE.md, docs/gdd.md, dan docs/prototipe.md.
Kita mulai sprint 1: bergerak dan melihat.

Buat rencana singkat dulu (file apa saja yang dibuat dan urutannya), lalu tunggu persetujuan saya.
Setelah disetujui:
1. Medan balok 300x300 m dengan bukit di utara, sungai dari timur ke barat, dan 6 rumah balok sebagai desa di tengah.
2. Pemain berupa kapsul tinggi 1,7 m dengan pengendali orang ketiga: WASD jalan, Shift lari, Spasi lompat.
3. Kamera di belakang pemain, bisa diputar dengan mouse, tidak menembus medan.
4. Tampilkan fps di pojok layar.

Selesai berarti: npm run dev jalan tanpa error dan saya bisa berjalan keliling desa.
```

Aturan yang terbukti menghemat token dan waktu:

- Satu fitur per sesi; sesi panjang yang mencampur banyak hal cepat menghabiskan konteks dan kuota.
- Mulai sesi baru untuk tiap sprint; konteks lama ada di `docs/catatan-sprint.md` dan Git, bukan di percakapan.
- Minta Claude Code menulis commit Git setiap fitur selesai, supaya kesalahan bisa dibatalkan.
- Kalau sesuatu rusak, berikan pesan error apa adanya dari terminal atau konsol browser, bukan tafsiran.
- Pakai model yang lebih hemat untuk perbaikan kecil dan simpan model terkuat untuk perancangan sistem dan masalah sulit.
- Isi data sejarah (dialog, entri ensiklopedia) ditulis di chat ini bersama Fable, disimpan ke JSON, lalu Claude Code hanya memuatnya; jangan minta Claude Code mengarang isi sejarah.

## Playtest misi 3 dan keputusan setelahnya

Uji dengan tiga sampai lima orang, sebagian pelajar, masing-masing sendirian tanpa dibantu. Duduk di belakang mereka, jangan memberi petunjuk, dan catat di mana mereka bingung atau berhenti. Setelah bermain, ajukan empat pertanyaan:

1. Ceritakan apa yang terjadi di misi tadi dengan kata-katamu sendiri.
2. Bagian mana yang paling seru, dan mana yang membosankan?
3. Apa yang kamu pelajari tentang Raden Wijaya yang sebelumnya tidak kamu tahu?
4. Mau main lagi kalau ada misi berikutnya?

Syarat lolos prototipe:

- [ ] Minimal 3 dari 5 pemain menyelesaikan misi tanpa bantuan.
- [ ] Minimal 3 dari 5 bisa menceritakan urutan peristiwa (kalah, kabur, ditolong desa, menyeberang ke Madura).
- [ ] Minimal 3 dari 5 menjawab mau main lagi.
- [ ] Tidak ada pemain yang berhenti karena kamera atau kontrol.

Keputusan setelah playtest:

- Lolos semua: lanjut ke tahap alur aset (lingkungan desa dan karakter Wijaya) sesuai rencana kerja di tab GDD.
- Lolos sebagian, masalah di kontrol atau pertarungan: satu sprint tambahan untuk memperbaiki, uji ulang dengan orang baru.
- Pemain selesai tapi tidak bisa menceritakan peristiwanya: masalah ada di cara sejarah disampaikan; rombak dialog, pemicu ensiklopedia, dan layar misi selesai sebelum menyentuh aset.
- Mayoritas tidak mau main lagi: kembali ke desain misi. Ini hasil yang paling berharga karena ditemukan sebelum berbulan-bulan membuat aset.
