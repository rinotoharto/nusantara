# Aset mentah

Berkas sumber sebelum dioptimasi untuk game. Folder ini tidak ikut dibangun ke
Pages (Vite hanya menyalin `public/`). Hasil optimasinya ada di `public/models/`.

Setiap berkas dicatat di sini: asal, tanggal, lisensi, dan masalah yang diketahui.

## wijaya-tripo.glb

- Tokoh: Raden Wijaya, karakter utama.
- Alat: Tripo (tripo3d.ai), image-to-3D, model H2.5, akun gratis.
- Gambar masukan: `docs/referensi/wijaya-konsep-01.png` (dibuat dengan ChatGPT,
  1024 x 1536). Pose A, tanpa alas kaki, kain batik cokelat, ikat pinggang merah,
  ikat kepala, gelang lengan emas.
- Tanggal unduh: 29 Oktober 2026.
- SHA-256: `8d40249c2be3fb6e66a342a49c9fc060b443ecf94f5f8b376eb5c87541745b20`.
- Isi: 12,7 MB, satu mesh, 226.932 segitiga, 123.306 verteks, tanpa rig dan
  animasi. Tinggi 1,0 m (lebar 0,55 m, tebal 0,19 m), titik pusat di kaki.
  Tiga tekstur 4096 x 4096: base color (JPEG), metallic-roughness (JPEG),
  normal (PNG). Ekstensi `KHR_materials_volume` dan `FB_ngon_encoding`.
- Masalah yang diketahui: tekstur wajah meleleh; bercak abu-abu tanpa warna di
  tepi tangan, jari, kaki, bahu, dan leher. Belum diperbaiki (rencana: proyeksi
  dari gambar konsep di sesi berikutnya).
- Pekerjaan nanti: tekstur metallic-roughness Tripo dibuang saat optimasi
  (roughness tetap 0,8, metallic 0), sehingga gelang lengan dan kalung emas
  ikut tidak metalik. Perlu topeng sederhana (dari warna emas di base color
  atau pulau UV perhiasan) supaya perhiasan tetap berkilau logam.

### Lisensi (dicek 29 Oktober 2026)

- Blog resmi Tripo, "Can You Use AI-Generated 3D Models Commercially?"
  (tripo3d.ai/blog/commercial-use-ai-3d-models): paket gratis memakai lisensi
  Creative Commons Attribution 4.0 (CC BY 4.0). Boleh dipakai komersial,
  dimodifikasi, dan disebarkan, dengan syarat mencantumkan atribusi ke Tripo di
  produk akhir (layar kredit atau dokumentasi) dan menyatakan bahwa aset diubah
  kalau dimodifikasi. Paket berbayar menghapus syarat atribusi.
- Ketentuan Layanan Tripo (tripo3d.ai/terms, diperbarui 11 Juli 2025), bagian
  3.2 Outputs: pengguna boleh memakai hasil "for lawful commercial or
  non-commercial purposes", kecuali untuk membuat model atau layanan yang
  bersaing dengan Tripo. Tidak ada jaminan hasil unik atau bebas klaim pihak
  ketiga.
- Beberapa ulasan pihak ketiga menulis paket gratis tidak boleh komersial;
  sumber resmi di atas lebih kuat. Cek juga label lisensi di halaman model
  pada akun Tripo sebelum rilis.
- Konsekuensi untuk game ini: tulis "Model Raden Wijaya dibuat dengan Tripo
  (CC BY 4.0), diubah" di layar kredit. Gambar konsep dari ChatGPT: syarat
  OpenAI memberikan hak hasil ke pengguna; tidak perlu atribusi.
- FAQ Tripo "Can You Use Tripo AI Models for Commercial Projects?" (dibaca pengguna 1 November 2026): menjamin hak penuh untuk pengguna berbayar, dan menyebut semua model Tripo boleh dipakai komersial asal sumbernya bebas sengketa hak cipta; model "public" boleh ditampilkan Tripo. Tidak bertentangan dengan catatan CC BY 4.0 untuk paket gratis di atas. Kesimpulan kerja: aset dari akun gratis dipakai dengan atribusi ke Tripo di layar kredit. Sebelum rilis: cek label lisensi tiap model di akun Tripo, dan kalau ragu kirim pertanyaan ke dukungan Tripo; alternatif aman adalah berlangganan satu bulan saat produksi akhir dan membuat ulang aset final di akun berbayar.

### Perbaikan wajah dan bercak tekstur (29 Oktober 2026)

Hanya base color yang diubah; mesh, UV, normal map, dan ukuran tetap. Skrip di
`tools/blender/` (wajah_render, wajah_acuan, wajah_proyeksi, wajah_gabung,
abu_isi, tekstur_pasang), angka di `tools/blender/wajah.json`. Cadangan base
color lama: `tekstur/wijaya-basecolor-sebelum.jpg`.

- Wajah: diproyeksikan dari gambar konsep `docs/referensi/wijaya-konsep-01.png`
  lewat kamera ortografis depan (ortho 0.306 m,
  pusat z 1.581 m). Titik acuan mata, hidung, mulut,
  dagu, dahi dari mediapipe; transformasi konsep ke model skala 4.4532,
  putar 0.65 derajat, sisa rata sekitar 5 px pada bingkai
  1024. Topeng: sudut normal ke kamera penuh di bawah 35
  derajat dan nol di 65, tinggi penuh di atas
  1.44 m dan nol di bawah 1.39 m, latar putih konsep
  dibuang, lubang ditutup 25 px, blur 5 px.
  Warna kulit konsep disamakan ke kulit lama di Lab (L 134.4
  ke 125.2, rasio sebaran [0.74, 0.9, 1.03]), detail halus
  lama 0.5, dilate 8 px. Hasil:
  `tekstur/wijaya-basecolor-wajah.png`.
- Bercak abu-abu: deteksi kroma Lab <= 14 atau rona
  biru-kelabu [85, 135] dengan saturasi <= 0.4;
  127106 piksel diisi otomatis (inpainting Telea per pulau
  UV, radius 5, sumber hanya kulit pulau itu, detail
  0.6), 16900 piksel dekat kain atau
  emas dicadangkan di `tekstur/topeng-abu-tangan.png` untuk tangan (panduan
  `tekstur/LANGKAH-texture-paint.md`). Keputusan: bercak di tepi pulau UV ikut
  diisi (`isi_tepi`), karena hampir semua bercak ada di siluet dan sumber
  inpainting sudah dibatasi ke pulau sendiri. Hasil:
  `tekstur/wijaya-basecolor-abu.png`, dipasang ke `public/models/wijaya.glb`.
- Masalah yang diketahui: dari samping, mulut dan hidung sedikit meregang
  (proyeksi tunggal sampai 65 derajat); sisa pita abu-abu
  tipis di batas kain dan gelang menunggu rapikan tangan.
- Berkas antara yang tidak masuk git (dibuat ulang oleh skrip): `wajah-data.png`,
  `wajah-proyeksi.png`, `topeng-abu.png`.

## Folder

- `pratinjau/`: render pembanding sebelum dan sesudah optimasi (Tahap B),
  `wajah-*.png` (penyelarasan dan hasil proyeksi wajah), `abu-*.png` (hasil
  isi bercak).
- `tekstur/`: base color cadangan, hasil tiap tahap, topeng, dan panduan
  rapikan tangan.
- `mixamo/`: FBX untuk diunggah ke Mixamo dan hasil unduhannya (Tahap C).
- `mixamo-prajurit/`: FBX prajurit untuk Mixamo dan `LANGKAH.md`; `idle.fbx` With Skin menyusul. Animasi lain
  dipakai ulang dari `mixamo/`.
- `pratinjau/prajurit-*.png`: tumpang penempatan, tumpang siluet dengan konsep, banding wajah, dan pratinjau model
  tersambung.
- `mixamo-wijaya-ulang/`: FBX Wijaya hasil pengulangan untuk Mixamo, `LANGKAH.md`, dan `idle.fbx` (Breathing Idle
  With Skin hasil rig; kerangka dan bobot awal model di game).
- `arsip/`: `wijaya-lama.glb`, model Wijaya yang dipakai game sampai 17 November 2026 (leher revisi 1).
- `pratinjau/wijaya-ulang-anim-*.png`: pratinjau animasi sebelum dipasang (bingkai kontak serang, tangkis, lari,
  jongkok-jalan, pinggang ke kaki dari tiga arah, bahu dari belakang, kalung saat membungkuk, sudut kamera dialog).
- `pratinjau/wijaya-ulang-*.png`: hal yang sama untuk pengulangan Wijaya, ditambah `banding-*` (berdampingan dengan
  prajurit Kediri) dan `pita-10-vs-6` (dua lebar pita emas).

## Masalah kepala (30 Oktober 2026)

Bentuk kepala hasil Tripo salah: profil hampir rata, hidung tidak menonjol, dahi menjorok, proporsi kepala lebih pendek dari gambar konsep. Akibatnya proyeksi wajah meleset (mata ikut tercetak di dahi, mulut jatuh di bawah dagu). Ini masalah mesh, bukan tekstur; jangan utak-atik proyeksi lagi.

Rencana setelah Tahap D terbukti di game: ganti kepala.
1. Gambar kepala dekat (tampak depan, latar putih) dari gambar konsep yang sama → Tripo H2.5 → kepala-tripo.glb.
2. Skrip Blender tools/blender/ganti_kepala.py: potong kepala lama di garis leher, pasang kepala baru dengan skala dan posisi disamakan (jarak mata, tinggi dagu), jahit verteks leher, pindahkan bobot rig ke tulang Head dan Neck, bake tekstur kepala baru ke UV yang sama, decimate kepala ke sekitar 3.000 segitiga.
3. Ekspor ulang dan jalankan gabung animasi tanpa mengubah kerangka.

Catatan urutan (30 Oktober): penggantian kepala dikerjakan sebelum Tahap D, paralel dengan unduhan Mixamo. Tidak perlu rig ulang di Mixamo: kepala baru diikat ke tulang Head dan Neck dari kerangka yang sudah ada; gabung_animasi.py memakai kerangka dari berkas animasi dan mesh dari public/models/wijaya.glb terbaru.

Hasil (30 Oktober 2026): kepala diganti dengan `tools/blender/ganti_kepala.py` dan
`kulit_warna.py` (alur dan angka di `tools/blender/README.md` dan `wajah.json`).
Kepala 3.000 segitiga dari remesh voxel 4 mm, dipotong di leher 1,455 m dan
dijembatani ke badan; atlas UV seluruh model ditata ulang (topeng tangan Tahap 3
tidak berlaku lagi). Kulit badan dihangatkan ke Lab (127, 145, 155), kepala
disamakan. Model 17.320 segitiga, GLB 2,12 MB. Sisa: garis tipis di batas pulau
UV wajah dari dekat, coretan gelap di lubang hidung. Pengikatan kepala ke tulang
Head dan Neck menunggu Tahap D.

Putaran kedua (30 Oktober): kepala diperkecil ke 1/7,5 tinggi badan (22,7 cm),
kulit badan dihangatkan ke Lab (138, 145, 156) lalu kepala disamakan, sambungan
leher mode selip (lingkar kepala dilebur ke lingkar badan dan diteruskan 1,2 cm
ke dalam badan, tanpa jembatan).

Masalah leher yang DITUNDA untuk sesi berikutnya:
- Pita tekstur janggut Tripo terbawa ke bawah dagu sampai jahitan (texel kepala
  z 1,455 sampai 1,470); perlu diganti kulit polos leher, misalnya menimpa
  texel kepala di bawah dagu dengan proyeksi warna leher badan.
- Jahitan masih terlihat: undakan 1,5 mm (`selip_m`) dan perbedaan arah normal
  antara kepala dan badan di z 1,455. Pilihan: selip lebih kecil plus normal
  dihaluskan lintas jahitan, atau jahit sungguhan dengan lingkar yang jumlah
  verteksnya disamakan dulu (bridge polos gagal: kerah bergerigi).
- Dari samping ada garis gelap tipis di bawah rahang.

## Keris (30 Oktober 2026)

- Konsep: docs/referensi/keris-konsep-01.png (ChatGPT; bilah lurus pendek lebar ala keris Buda, pamor, ganja asimetris, hulu sosok jongkok, mendak kuningan). Label interpretasi; tunjukkan ke Yayat S. Soelaeman sebelum final.
- Model: aset-mentah/keris-tripo.glb (Tripo H2.5). Ketebalan bilah bagus. Masalah: bercak putih kebiruan tanpa warna di sisi dan bawah hulu.
- Rencana (bersama tahap "Rapikan Wijaya"): ringankan ke sekitar 2.000 segitiga, isi bercak hulu dengan warna kayu sekitar (pakai skrip bercak yang ada), titik pusat di genggaman, pasang ke tulang RightHand menggantikan keris balok, cek orientasi saat serang-1 sampai 3, tangkis, dan Tikaman Keris. Warangka dibuat terpisah (prompt sudah ada di chat; konsep belum dibuat) dan dipasang di pinggang kiri depan; keris disembunyikan dari warangka saat dicabut.

## Prosedur tetap karakter (dari pengalaman Wijaya dan prajurit Kediri)

Pembaruan 17 November 2026: langkah 3 di bawah (ganti_kepala.py) diganti cara potong di tengah leher; prosedur
yang berlaku sekarang ada di `docs/standar-karakter.md`, skripnya di `tools/blender/README.md` bagian "Sambung
kepala di tengah leher".

Tripo dari gambar seluruh badan selalu menghasilkan wajah meleleh, bercak abu-abu di bagian yang tidak terlihat (tangan, pergelangan kaki, leher), dan kulit pucat. Jadi setiap karakter dibuat dari dua gambar:
1. Seluruh badan, pose A, latar putih → Tripo H2.5 → `<nama>-tripo.glb` (dipakai untuk bentuk badan).
2. Kepala dan leher dekat dari karakter yang sama (percakapan ChatGPT yang sama) → Tripo H2.5 → `<nama>-kepala-tripo.glb`.
3. Skrip: optimasi_karakter.py, ganti_kepala.py, perbaikan bercak, kulit_warna.py, lalu Mixamo memakai animasi yang sudah ada.

## Prajurit Kediri (30 Oktober 2026)

- Konsep: docs/referensi/prajurit-kediri-konsep-01.png (ChatGPT; ikat kepala dan kain biru nila, sabuk cokelat pendek, kain bersilang bermotif).
- Badan: aset-mentah/prajurit-tripo.glb (Tripo H2.5). Bentuk dan kain bagus; wajah meleleh, bercak abu-abu, kulit pucat.
- Kepala: aset-mentah/prajurit-kepala-tripo.glb (Tripo H2.5, dari docs/referensi/prajurit-kediri-kepala-01.png; 501.040 segitiga, patung dada sampai bahu). Wajah bagus; rambut berserabut; permukaan bawah dagu mosaik pucat.
- Tampak samping: docs/referensi/prajurit-kediri-samping-01.png (acuan proporsi, bukan untuk Tripo).
- Dipakai sebagai tubuh dasar semua prajurit dan pengikut; variasi warna ikat kepala dan kain lewat kode (Kediri biru nila, Singasari merah tua, Madura putih dan hitam). Badan agak berotot; kalau perlu diramping lewat skrip supaya Wijaya tetap menonjol.

### Hasil sambung kepala (17 November 2026)

Cara potong di tengah leher (`docs/prompt-prajurit-kepala.md`, lalu dibakukan di `docs/standar-karakter.md`).
Alur, perintah, dan angka di `tools/blender/README.md` dan `wajah.json` blok `prajurit`. CEK C (penempatan) dan
CEK F (model diam) disetujui; kepala tidak dimajukan mengikuti konsep.

- Badan (`prajurit-badan.glb`): 10.999 segitiga, 1,68 m, diramping 6,5 persen di X dan Y, tekstur 2048. Tonjolan
  tali di pangkal leher dan dada dihaluskan pada mesh tinggi sebelum decimate. Bercak kelabu di kulit sekitar
  100.400 texel menjadi sekitar 2.600 (sebagian di batas kain, untuk dirapikan tangan kalau terlihat); kain ditentukan menurut posisi (nila pudar terbaca sebagai
  bercak); jari yang seluruhnya kelabu dan bercak gelap telapak kaki ikut diisi.
- Kepala (`prajurit-kepala.glb`): 3.500 segitiga (wajah 1.712), tekstur 1024, skala 0,3287 m per satuan (dagu ke
  puncak tanpa sanggul 22,4 cm). Remesh untuk rambut, verteks wajah ditempel ke permukaan asli: simpangan p95
  mulut 1,67 mm, mata 0,53 mm, hidung 0,81 mm (remesh polos: 2,36, 0,88, 1,20).
- Penempatan: dagu z 1,455 m, telinga tepat di atas sendi bahu, kepala tidak diskalakan. Leher badan di garis
  potong semula 12,2 x 13,0 cm dengan pusat 4,7 cm di depan; ditipiskan dan ditegakkan bertahap (bobot 0 mulai
  6 cm di bawah potongan). Sumbu leher 10,3 derajat ke depan. Lebar rahang 12,2 cm, leher 11,8 cm.
- Sambungan: bidang potong miring 8 derajat, kepala 1,6 cm di bawah dagu, badan 1,4 cm di bawahnya. Cincin
  badan 54 dan kepala 72 verteks, dirapikan lalu dipasangkan per sudut menjadi 48 kolom; lebar 11,8 dan tebal
  11,2 cm di keduanya (selisih 0,1 persen); pita 2 cincin perantara, tinggi 1,5 cm, 288 segitiga. Tidak ada
  tepi terbuka di sekitar sambungan.
- Dua kantong lipatan sisa tali di mesh badan (simpul di dada, dan di pangkal leher kiri) dibuang dan ditambal
  (jari-jari 2,9 dan 3,5 cm; 13 dan 19 segitiga baru, warna kulit polos).
- Tali leher: mesh pita lonjong 7 x 3,2 mm, 704 segitiga, warna #3A281C, di bidang tengah sambungan (lebih rapat
  dan lebih tinggi dari konsep). Tali lukis lama dihapus dari tekstur.
- Tekstur: satu atlas 2048. Kulit badan Lab (139,7, 143,2, 149,9) digeser ke kepala (136,1, 144,3, 150,7);
  konsep (140,2, 144,0, 150,3). Peralihan 3 cm di sambungan. Pipi kiri-kanan selisih 2,2 L, tidak diratakan.
  Permukaan bawah dagu diganti warna kulit rata (tanpa detail).
- Model diam: `prajurit-utuh.glb`, 14.107 segitiga (badan 9.807, kepala 3.338, pita 288, tali 704), 1,68 m,
  kepala 22,2 cm, 1,8 MB. FBX: `mixamo-prajurit/prajurit-untuk-mixamo.fbx`.
- Sisa yang diketahui: satu tonjolan kecil helai rambut di dekat telinga; dua tambalan di dada berwarna polos;
  dari samping kepala konsep sekitar 3 cm lebih maju (sengaja tidak diikuti).
- Belum dikerjakan: rig Mixamo (`mixamo-prajurit/LANGKAH.md`), gabung animasi, pemasangan ke game, variasi warna
  ikat kepala dan kain lewat kode. Untuk tahap animasi: masalah bobot kain dan lengan kiri di bagian "Masalah
  animasi" di bawah kemungkinan muncul juga di prajurit.

## Sambungan kepala: belum terbukti (catatan 30 Oktober 2026)

Prosedur dua gambar baru terbukti separuh: kepala hasil Tripo bagus, sambungan ke badan masih berantakan (rahang dobel karena leher lama dan baru tumpang tindih, tekstur janggut terbawa ke bawah dagu, warna kulit beda, garis potong terlihat).

Percobaan berikutnya (Wijaya dulu, baru prajurit):
1. Potong kepala baru dan badan di ketinggian yang sama, tepat di pangkal leher, di garis tempat kalung (Wijaya) atau tali leher (prajurit) melingkar.
2. Samakan jumlah verteks di kedua tepi potongan, lalu sambung tepi ke tepi (bmesh bridge edge loops), bukan menumpuk dua leher. Haluskan beberapa cincin di sekitar sambungan.
3. Buang tekstur kepala di bawah dagu; pita peralihan warna kulit sekitar 3 cm di leher, warna disamakan di ruang Lab.
4. Kalung atau tali leher menutup garis sambungan; pastikan kalung ikut bobot tulang Neck.
5. Render dekat leher dari depan, samping, tiga perempat, dan bawah (sudut kamera dialog).

Kalau masih gagal: (a) pengguna menyambung manual di Blender dengan panduan langkah demi langkah, atau (b) badan dan kepala utuh dari MakeHuman/MPFB2 (CC0) dengan wajah dari konsep diproyeksikan ke sana.

## Leher Wijaya: hasil kerja manual di Blender (30 Oktober 2026)

Berkas: aset-mentah/wijaya-leher-rapi.glb (ekspor) dan aset-mentah/wijaya-leher.blend (berkas kerja). Diperiksa: satu mesh "rendah", 16.540 segitiga, 12.673 verteks, tinggi 1,694 m, satu material (base color + normal), tanpa kerangka dan animasi, tanpa Draco (2,3 MB).

Yang sudah dikerjakan pengguna: kepala dimundurkan 3,7 cm (tegak di atas leher), bawah kepala dipotong rata di z 1,48 m (serpihan janggut dibuang), leher badan dipotong lalu diekstrusi naik sekitar 3 cm masuk ke kepala dan diskalakan 0,92.

Sisa masalah (untuk skrip rapikan_leher.py, ditunda sampai kuota pulih; pesan lengkap untuk Claude Code ada di chat Cowork 30 Oktober):
1. Pita leher berbentuk tabung lurus, menonjol ke depan di bawah dagu; cincin atas harus mengikuti garis rahang dan dihaluskan.
2. Bukaan bawah kepala masih terbuka (lubang gelap dari bawah). Fill Holes dan Merge by Distance 2 mm gagal dan merusak wajah; tutup hanya cincin batas di z sekitar 1,48 m.
3. Tekstur pita bergaris tegak (UV terekstrusi); bake ulang dari kulit leher.
4. Tepi bawah dagu bergerigi dari depan.
5. Kalung emas tipis di pangkal leher untuk menutup sambungan.
Lalu optimasi dan gabung_animasi dijalankan ulang dari berkas ini.

Hasil `rapikan_leher.py` (17 November 2026, revisi 1; alur dan angka di `tools/blender/README.md` dan `wajah.json` blok `leher_rapi`). Putaran pertama (leher masuk ke dalam kepala dengan penutup bawah kepala) ditolak: kepala tampak seperti topeng di atas tabung. Revisi memakai sambungan sungguhan.
- Cincin terbuka di sekitar leher: 4 (tepi bawah kepala 79 verteks, tepi atas pita lama 65 verteks, dua lubang 4 verteks di belakang kepala). Di pangkal pita lama ada sekat dalam 141 muka (sisa Bisect dengan Fill) yang harus dibuang supaya leher badan bisa disambung.
- Sambungan: bawah kepala dipotong ulang dengan bidang miring 16 derajat lewat bawah dagu (z 1,482 m) naik ke belakang sampai 1,512 m; atas leher badan dipotong miring dari z 1,400 m di depan ke 1,435 m di belakang (membuang sisa bawah dagu kepala Tripo lama yang masih menempel di badan). Cincin kepala 98 verteks dan cincin badan 73 verteks dijahit lewat 4 cincin perantara, 491 segitiga, tinggi 7,7 sampai 9,0 cm, satu permukaan dengan kepala dan badan (normal halus melintasi sambungan).
- Leher condong: sumbu leher z 1,38 ke 1,47 m dari 21,7 menjadi 4,4 derajat maju; pangkal leher badan dari 30,5 menjadi -4,2 derajat; telinga dari 2,5 cm di depan sendi bahu menjadi tepat di atasnya (kepala digeser 2,5 cm, pangkal leher 3,5 cm bertahap dari z 1,375 m). Di kerangka sendi Head ikut digeser 2,5 cm; tulang Neck ke Head dari 14,7 menjadi -2,7 derajat. Idle: Neck ke Head dari 17,1 menjadi -0,2 derajat, kepala menunduk dari 8,2 menjadi 3,2 derajat (koreksi rotasi Head 5 derajat untuk semua aksi; Neck 0 karena sesudah pose istirahat dibetulkan sudah tegak).
- Wajah gelap sebelah: bukan tekstur (selisih pipi kiri-kanan 0,6 L) dan bukan normal map terbalik (arah normal simetris); penyebabnya satu matahari rendah tanpa cahaya pengisi di game. `src/character/model-wijaya.ts` memberi cahaya pengisi lewat peta lingkungan khusus model (kekuatan 0,45 untuk badan, 1 untuk logam), hanya dengan `?model=wijaya`.
- Titik gelap di rahang dan pipi: bercak normal map kepala (tekstur warnanya bersih). Normal map dilemahkan ke 0,45 di kulit kepala dan diratakan 1,5 cm dari sambungan.
- Kalung: tali bulat tebal 5 mm, 440 segitiga, z 1,441 m di tengkuk turun ke 1,394 m di depan (4,7 cm), 2,5 mm di atas kulit, warna #C9A04A, liontin pipih; bobot Neck (maks 0,7 di belakang) dan Spine2. Kalung lama dihapus, bukan diikuti: selain di tekstur (3.861 texel diisi kulit), ia tercetak sebagai tonjolan di mesh dada (92 verteks diratakan).
- Emas gelang lengan: topeng posisi dan warna, 5.506 texel, kadar logam 0,65 lewat tekstur metallic-roughness. Di game berkilau saat menghadap matahari, agak kusam di sisi bayangan.
- Segitiga 16.540 menjadi 17.182, lalu badan di bawah 1,38 m diringankan ke 16.480 (decimate diulang 2 kali karena UV 7 muka terlempar ke pulau lain; 36 muka yang terbalik dibetulkan). GLB beranimasi 2,97 MB, 14 aksi.
- Pratinjau `pratinjau/leher-*.png`: `badan-samping-istirahat` dan `badan-samping-idle` (garis merah lewat sendi bahu), `samping-istirahat`, `samping-idle`, `dialog`, `depan`, `samping`, `tigaperempat`, `bawah`, `lari`, `serang-2`, `toleh`, `mati`, ringkasan `ringkas-samping` dan `ringkas-dekat`, serta tangkapan layar game `leher-game-dialog.jpg`, `leher-game-samping.jpg`, `leher-game-bawah.jpg` (ringkasan `leher-ringkas-game.jpg`).
- Sisa yang diketahui: tepi bawah rambut di belakang telinga terpotong lurus mendatar (z 1,512 m); garis zig-zag jahitan UV di dada setinggi puting sudah ada sebelum tahap ini (di luar daerah yang dirapikan); tekstur pita sambungan polos tanpa detail kulit; di mesh ada 256 muka yang arahnya janggal sejak sebelum decimate (lipatan kain dan ketiak) dan sengaja tidak diubah.
- Penilaian pengguna atas revisi 1 (17 November 2026): belum final, dan tidak direvisi lagi dengan cara ini. Masalah yang tersisa: leher terlalu lebar seperti tiang; dagu tidak terlihat karena bawah rahang rata dengan leher; rambut tengkuk terpotong lurus. Di-commit apa adanya sebagai "Leher Wijaya revisi 1 (belum final)".
- Pelajaran: memotong kepala tepat di bawah dagu dan menyambung di rahang tidak berhasil. Prosedur sambung kepala dengan potongan di bawah rahang belum dinyatakan berhasil.
- Langkah berikutnya: Wijaya diulang nanti dengan cara potong di tengah leher (lihat `docs/prompt-prajurit-kepala.md`, dicoba dulu pada prajurit Kediri), memakai `aset-mentah/kepala-tripo.glb` yang masih utuh.

## Tombak (1 November 2026)

- Konsep: docs/referensi/tombak-konsep-01.png (ChatGPT; gagang kayu gelap sekitar 2 m, mata tombak berbentuk daun dengan rusuk tengah, cincin kuningan, tutup besi). Label interpretasi; tunjukkan ke Yayat S. Soelaeman bersama keris.
- Model: aset-mentah/tombak-tripo.glb (Tripo H2.5). Dari samping bagus, gagang lurus.
- Perbaikan lewat skrip (bersama pemasangan senjata): mata tombak bersirip empat (rusuk tengah ditafsirkan sebagai sirip atas-bawah); pipihkan verteks mata tombak ke ketebalan sekitar 25 persen pada sumbu tegak lurus bilah. Tutup besi bawah terlalu besar dan menggembung; kecilkan sekitar 30 persen. Ringankan ke sekitar 1.500 segitiga, panjang total 2 m, titik pusat di genggaman (sekitar sepertiga dari bawah). Ganti tombak balok prajurit dan penjaga, tempel ke tulang RightHand.

## Keris raja (1 November 2026)

- Konsep: docs/referensi/keris-raja-konsep-01.png (ChatGPT, revisi ketiga; hulu sosok jongkok bersanggul dengan aksen emas, mendak emas berbatu merah, bilah lurus asimetris dengan ganja ke satu sisi, greneng, gandik, pamor rapat). Untuk Kertanagara, Jayakatwang, dan Wijaya sebagai raja (epilog, bab 2 ke atas). Label interpretasi; tunjukkan ke Yayat S. Soelaeman.
- Model: aset-mentah/keris-raja-tripo.glb (Tripo H2.5). Bentuk bagus dari samping.
- Perbaikan tekstur lewat skrip: bercak putih keabu-abuan di sisi tak terlihat hulu; garis jingga (warna emas bocor) di tepi ujung bilah; merah dan emas mendak terlalu jenuh. Usulan: warnai ulang hulu per bagian (kayu cokelat gelap, aksen emas, metallic tinggi untuk emas), bersihkan tepi bilah dengan warna pamor sekitar, turunkan saturasi mendak dan beri metallic. Ringankan ke sekitar 2.500 segitiga.

## Warangka (1 November 2026)

- Konsep: docs/referensi/warangka-konsep-01.png (ChatGPT, revisi kedua: gandar pipih menyempit ke bawah).
- Model: aset-mentah/warangka-tripo.glb (Tripo H2.5). Bentuk bagus, lubang bilah di atas terbentuk.
- Perbaikan lewat skrip: bercak putih kecil di bawah bagian atas (kiri-kanan sambungan gandar); warna terlalu oranye, turunkan saturasi dan kecerahan ke cokelat jati gelap. Ringankan ke sekitar 1.000 segitiga. Pasang di pinggang kiri depan Wijaya (ikut tulang Hips/Spine); keris tampil di dalam warangka saat tidak bertarung dan berpindah ke tulang RightHand saat dicabut.

## Perahu nelayan (1 November 2026)

- Konsep: docs/referensi/perahu-konsep-01.png (ChatGPT, revisi kedua dengan tiang utuh): lambung kayu melengkung, cadik bambu di kedua sisi, layar anyaman tergulung, jala, gulungan tali.
- Model: aset-mentah/perahu-tripo.glb (Tripo H2.5). Lambung berongga dengan papan duduk, kedua cadik utuh, tiang dan layar utuh.
- Perbaikan lewat skrip: bercak abu-abu keperakan di bibir lambung sepanjang sisi, pelampung cadik sisi jauh, sisi bawah pelampung, dan sebagian batang penyangga; isi dengan warna kayu (lambung) dan bambu (cadik) sekitar. Tali tipis boleh dibuang kalau berantakan. Skala panjang sekitar 7 m. Ringankan ke sekitar 6.000 segitiga. Ganti perahu balok di segmen pantai misi 3; untuk sinematik penyeberangan pakai dua perahu berdampingan (rombongan sekitar 11 orang).

## Prosedur sambung kepala (diputuskan 1 November 2026)

Pembaruan 17 November 2026: prosedur gabungan manual dan skrip di bawah ini tidak dipakai lagi. Yang berlaku:
potong di tengah leher dengan `sambung_kepala.py` (`docs/standar-karakter.md`), sudah berhasil pada prajurit
Kediri.

Gabungan manual dan skrip, karena masing-masing gagal di bagian berbeda (skrip: kepala menjorok; manual: Fill Holes dan Merge by Distance merusak wajah).
1. Manual di Blender (pengguna, sekitar 15 menit): impor badan dan kepala, letakkan kepala (tegak di atas leher, telinga di atas sendi bahu), Bisect kepala sedikit di bawah dagu dan leher badan sedikit di bawahnya, ekstrusi leher badan masuk ke kepala. Simpan sebagai aset-mentah/<nama>-leher.blend.
2. Skrip rapikan_leher.py (dibuat saat merapikan Wijaya, dipakai ulang): bentuk cincin atas pita leher mengikuti garis rahang, tutup cincin batas bawah kepala, bake ulang warna pita dan samakan kulit di ruang Lab, kalung atau tali leher penutup sambungan, lalu optimasi dan gabung_animasi.
Cadangan bila hasil Wijaya tetap kurang rapi: MakeHuman/MPFB2 untuk prajurit dan warga; prosedur dua gambar hanya untuk tokoh utama.

## Masalah animasi: lengan kiri saat menyerang (dicatat 17 November 2026)

Saat Wijaya menyerang, lengan kiri tampak tidak proporsional dan menempel ke badan. Dikerjakan bersama sesi pengulangan Wijaya (sambung kepala cara baru). Langkah:
1. Diagnosis dulu dengan membandingkan pratinjau Mixamo dan render gabung_animasi.py pada bingkai yang sama. Kalau di Mixamo juga menempel: itu sifat klip Sword And Shield (lengan kiri memegang perisai rapat ke badan). Kalau di Mixamo normal: masalah bobot kulit lengan kiri (verteks lengan ikut tulang Spine) atau retarget di gabung_animasi.py.
2. Perbaikan sesuai penyebab: (a) koreksi rotasi tambahan pada LeftArm dan LeftForeArm untuk klip serang-1, serang-2, serang-3, tangkis (menjauhkan lengan dari badan sekitar 15 sampai 25 derajat, angka di wajah.json); atau (b) di game, lapisan animasi bertopeng: lengan kiri memakai pose siaga atau idle sementara badan dan lengan kanan memakai klip serang (AnimationMixer dengan track yang difilter per tulang); atau (c) perbaiki bobot lengan kiri (transfer bobot ulang, normalisasi, batasi pengaruh Spine pada lengan).
3. Pratinjau: frame kontak serang-1, serang-2, serang-3 dari depan dan samping.

Pembaruan dari tangkapan layar game 17 November (pose serang, kuda-kuda lebar): ada tiga masalah terpisah.
- Pose lengan kiri: tangan kiri tertekuk menempel di dada dengan telapak masuk ke otot dada (sifat klip Sword And Shield yang memegang perisai). Perbaiki dengan koreksi rotasi LeftArm/LeftForeArm/LeftHand atau lapisan bertopeng (butir 2a/2b di atas), sampai tangan kiri berada di depan badan sekitar 15 sampai 20 cm, tidak menembus.
- Bobot kulit salah (penyebab utama "aneh"): ada serat gelap memanjang dari tangan kiri ke kain di pinggang, dan di dekat tangan kanan juga. Dugaan: transfer bobot nearest vertex mengambil bobot tangan untuk verteks kain di dekat pergelangan, karena dalam pose A tangan menggantung tepat di samping kain. Perbaikan: batasi transfer bobot per bagian. Verteks kain dan sabuk hanya boleh dari Hips, Spine, dan paha (UpLeg); verteks lengan dan tangan hanya dari rantai lengan; pisahkan bagian lewat pulau mesh, UV, atau warna tekstur, lalu normalisasi. Cek ulang dengan animasi serang-1 sampai 3 dan lari.
- Kain pecah dan terkoyak menjadi serpihan pada kuda-kuda lebar: aturan 70 persen Hips belum cukup atau tidak mengenai semua verteks kain. Naikkan porsi Hips untuk kain bagian depan dan belakang (85 sampai 90 persen), haluskan bobot kain beberapa iterasi, dan pastikan tidak ada verteks kain dengan bobot ke tulang lengan. Cek pada bingkai kuda-kuda terlebar serang-1 dan tangkis.

Catatan untuk prajurit Kediri (17 November 2026): prajurit belum dirig, jadi belum diuji. Pose A dan kainnya
serupa (tangan menggantung di samping kain), sehingga serat kain ke tangan, kain pecah pada kuda-kuda lebar, dan
lengan kiri saat serang dan tangkis harus dicek saat gabung animasi prajurit; daftar ceknya juga ada di
`mixamo-prajurit/LANGKAH.md`.

## Rencana pengulangan Wijaya (diputuskan 17 November 2026)

Dijalankan setelah prajurit Kediri berhasil dengan sambung_kepala.py.
- Badan: mulai dari aset-mentah/wijaya-tripo.glb (mentah Tripo). JANGAN pakai public/models/wijaya.glb, wijaya-leher-rapi.glb, atau wijaya-sebelum-leher.glb: lehernya sudah diubah berkali-kali (ekstrusi, pelebaran, potong, kalung, tekstur dada dihapus).
- Kepala: aset-mentah/kepala-tripo.glb (utuh sampai leher).
- Urutan skrip: optimasi_karakter.py (dengan cage dan jarak sinar kecil, roughness tetap 0,8) → abu_isi.py → sambung_kepala.py (potong di tengah leher, leher sekitar 11,5 cm, kepala tegak dengan telinga di atas sendi bahu) → kulit_warna.py (kulit badan ke warna kepala dan konsep) → kalung emas sebagai mesh menutup sambungan → ekspor_mixamo.py (rig Mixamo yang ada bisa dipakai ulang kalau proporsi tidak berubah jauh; kalau berubah, rig ulang) → gabung_animasi.py dengan perbaikan bobot kain dan lengan, koreksi Neck, dan lengan kiri saat serang.
- Tidak dipakai lagi: proyeksi wajah dari konsep (wajah_*.py), hasil Blender manual, rapikan_leher.py revisi 1.
- Acuan proporsi: docs/referensi/wijaya-konsep-01.png dan wijaya-samping-01.png (buat dulu di ChatGPT dari gambar depan, seperti prajurit).

### Hasil pengulangan Wijaya, bagian 1: sambung kepala (17 November 2026)

Mengikuti `docs/standar-karakter.md` (tahap A sampai G, `docs/prompt-wijaya-ulang.md` bagian 1). Alur, perintah, dan
pilihan baru skrip ada di `tools/blender/README.md` bagian "Pengulangan Wijaya"; angka di `wajah.json` blok
`wijaya_ulang`. CEK C (penempatan, ramping 0) dan CEK F (model diam) disetujui. `public/models/wijaya.glb` belum
diganti: versi lama tetap aktif di game sampai bagian 2 (animasi) disetujui.

- Bahan: `wijaya-tripo.glb` (badan mentah) dan `kepala-tripo.glb` (kepala Tripo dari gambar kepala dekat, 501.316
  segitiga, patung dada sampai bahu). Berkas leher lama, `rapikan_leher.py`, dan `wajah_*.py` tidak dipakai.
- Badan (`wijaya-ulang-badan.glb`): 11.400 segitiga, 1,70 m, tidak dirampingkan, tekstur 2048. Tonjolan kalung konsep
  di dada dihaluskan pada mesh tinggi sebelum decimate; puting yang menonjol seperti kancing diratakan separuh (mundur
  3,7 mm). Pulau UV ditata ulang dengan margin dan warna di-bake dari mesh tinggi (garis zig-zag di dada hilang).
  Bercak kelabu 125.100 texel diisi, termasuk pinggiran gelapnya; garis tajam normal map di batas bercak (tampak
  sebagai garis gelap panjang di lengan) diratakan, 85.985 texel. Kain ditentukan menurut posisi.
- Kepala (`wijaya-ulang-kepala.glb`): 3.598 segitiga (wajah 1.725, kedua telinga 639), tekstur 1024, skala 0,2837 m
  per satuan (dagu ke puncak tanpa sanggul 22,7 cm, sanggul 1,8 cm di atasnya). Simpangan wajah p95: mulut 0,67 mm,
  mata 0,50 mm, hidung 0,96 mm.
- Penempatan: dagu z 1,455 m, telinga tepat di atas sendi bahu, kepala tidak diskalakan dan tidak dimajukan (di
  konsep samping kepala sekitar 4 cm lebih maju). Puncak bahu badan 1,354 m (prajurit 1,32 m), jadi leher di garis
  potong semula 18,3 x 13,6 cm dan dirampingkan bertahap ke cincin kepala. Sumbu leher 8,5 derajat ke depan. Lebar
  rahang 13,2 cm.
- Sambungan: bidang potong miring 8 derajat, kepala 1,6 cm di bawah dagu, badan 1,4 cm di bawahnya. Tengkuk kepala
  dirapikan dulu sebelum cincin diukur (ujung helai rambut ikut terpotong bidang potong). Cincin badan 51 dan kepala
  62 verteks, dipasangkan per sudut menjadi 43 kolom; badan 11,0 x 9,1 cm, kepala 10,9 x 9,0 cm (selisih 0,4 dan
  1,1 persen); pita 2 cincin perantara, tinggi 1,5 cm, 258 segitiga. Tidak ada tepi terbuka, tidak ada tambalan.
- Pita emas (penutup sambungan): pita pipih 6 x 2 mm, 352 segitiga, di bidang tengah sambungan, bagian dari mesh
  badan dengan bahan kedua `emas_kalung` (warna #C9A04A, metallic 1, roughness 0,35). Semula 10 mm; ditipiskan
  karena leher tampak pendek (`pratinjau/wijaya-ulang-pita-10-vs-6.png`).
- Kalung gantung: objek mesh terpisah `kalung_gantung`, tabung 3,6 mm, 400 segitiga, bahan `emas_kalung` yang sama.
  Bentuk dari gambar konsep depan: parabola dengan titik terendah 11,3 cm di bawah dagu (konsep 11,9 cm), lebar
  12,8 cm, lalu melingkar di pangkal leher dan lewat tepat di bawah pita emas di tengkuk. Kalung lukis lama dihapus
  dari tekstur.
- Tekstur: satu atlas 2048. Kulit badan Lab (131,9, 145,2, 152,1) digeser ke kepala (135,8, 145,7, 149,1); konsep
  (126,2, 144,9, 150,0). Peralihan 3 cm di sambungan. Pipi kiri-kanan selisih 1,1 L. Coretan gelap (bayangan rambut)
  di bahu dan punggung atas dihapus. Permukaan bawah dagu diganti warna kulit rata; janggut di dagu utuh.
- Model diam: `wijaya-utuh.glb`, 14.986 segitiga (badan 10.579, kepala 3.424, pita sambungan 258, pita emas 352,
  kalung gantung 400), 1,70 m, kepala 22,7 cm, 2,0 MB, dua bahan (`karakter`, `emas_kalung`). Bahu terluar 49,7 cm,
  8 persen lebih lebar dari prajurit (46,0 cm). FBX: `mixamo-wijaya-ulang/wijaya-untuk-mixamo.fbx` (dua mesh).
- Sisa yang diketahui: bercak samar keabuan di pergelangan tangan kiri dan tumit kanan; beberapa serpihan gelap kecil
  di puncak telinga; garis tipis tegak di tulang dada dari sudut bawah; kulit bawah dagu tanpa detail; gelang lengan
  belum metalik (masih tekstur); goresan gelap pendek di lengan bawah dan tulang kering dibiarkan (luka dan kotoran
  dari gambar konsep). Lebar leher di sambungan 11,0 cm, sedikit di bawah kisaran standar 11,5 sampai 12,5 cm.
- Belum dikerjakan (bagian 2): rig Mixamo (`mixamo-wijaya-ulang/LANGKAH.md`), gabung animasi dengan perbaikan bobot
  kain, lengan kiri, dan bobot kalung (Neck dan Spine2), lalu mengganti `public/models/wijaya.glb`.

### Hasil pengulangan Wijaya, bagian 2: animasi dan masuk game (17 November 2026)

`docs/prompt-wijaya-ulang.md` bagian 2. Perintah dan pilihan skrip ada di `tools/blender/README.md` bagian
"Pengulangan Wijaya, bagian 2"; angka di `wajah.json` blok `wijaya_ulang.animasi`. Pratinjau disetujui setelah satu
putaran koreksi kaki. `public/models/wijaya.glb` sudah diganti (2,98 MB, 14.986 segitiga, 14 aksi); versi lama
disimpan di `arsip/wijaya-lama.glb`. Model diam `wijaya-utuh.glb` ikut berubah sedikit: teksturnya saja (lihat
"Tekstur tangan"), geometrinya sama dengan yang dirig.

- Kerangka dan mesh dari `mixamo-wijaya-ulang/idle.fbx` (rig lancar; idle Sway 20, Breathing 40, Overdrive 40,
  Arm-Space 55). Animasi lain dipakai ulang dari `mixamo/`. Mesh di FBX berimpit dengan `wijaya-utuh.glb` (selisih
  0,00 mm), jadi geometri, UV, dan bahan diambil dari GLB dan hanya kerangka serta bobot dari FBX.
- Serat kain ke tangan: hilang. Bobot dibatasi per bagian. Kain dan sabuk (zona posisi) hanya Hips, Spine, dan
  UpLeg; lengan bawah dan tangan hanya rantai lengan sisinya; kaki hanya rantai kaki. Sebelumnya telapak kaki
  sempat ikut aturan lengan atas (sama jauhnya dari sumbu badan) dan kaki rusak; aturan lengan sekarang hanya
  berlaku di atas tepi bawah kain.
- Kain: Hips tidak rata. Dengan Hips rata 0,87 kain kaku seperti rok kayu dan kulit tertarik dari tepi kain ke
  lutut. Dipakai gradasi Hips 0,87 di sendi paha ke 0,10 di tepi bawah; sisanya UpLeg kiri dan kanan dicampur
  menurut posisi samping (sama rata di garis tengah, penuh ke satu sisi mulai 14 cm dari tengah), supaya kain tetap
  berbentuk sarung. Ini menyimpang dari angka prompt (Hips 85 sampai 90 persen) dan disetujui lewat pratinjau.
- Kaki: mesh ini tidak punya paha di dalam kain. Kaki berupa lingkar utuh sampai sekitar 56 cm dari tanah, lalu
  menyatu dengan lapisan dalam kain yang berbentuk dua terowongan. Kulit kaki di bawah tepi kain dipisah dari kain
  menurut jarak ke sumbu paha dan keterhubungan dengan kaki (warna saja tidak cukup: cincin teratasnya gelap), dan
  hanya memakai UpLeg dan Leg; lapisan dalam kain memudar dari UpLeg sisinya ke aturan kain. Lutut bergradasi
  UpLeg ke Leg selebar 7 cm. Lingkar lutut (0,371 m) dan lingkar kulit utuh tertinggi di atasnya (0,378 m) pada
  bingkai kuda-kuda terlebar tangkis, serang-1, dan serang-berat: 0,95 sampai 0,99 dari pose A. Saat lutut ditekuk
  dalam masih menyusut lebih dari 10 persen: lutut kiri 0,85 (lari, jongkok-jalan) dan 0,78 (mati).
- Lengan kiri: diagnosis menunjukkan sifat klip Sword And Shield (model lama dan baru sama, tangan 0 sampai 7 cm
  dari badan), bukan bobot. Koreksi dicari otomatis per klip dan dibagi ke LeftArm (paling banyak 25 derajat per
  sumbu) dan pelurusan siku, dengan sasaran 12 cm pada bingkai kontak: serang-2 13 cm, serang-3 13 cm, serang-berat
  14 cm, tangkis 14 cm. Serang-1 tidak tercapai penuh: 8 sampai 12 cm pada kontak (dua cara ukur), dan di awal klip
  tangan kiri masih menempel di kain pinggul. `siaga` tidak dikoreksi (tangan bertumpu di pinggul).
- Bahu: pada tampak belakang serang, bahu masih menggelembung. Bentuknya sama tanpa koreksi lengan dan dengan
  bobot lengan atas asli Mixamo, jadi asalnya klip pada badan berotot ini. Penghalusan bobot di sekitar sendi bahu
  dicoba (12 sampai 40 iterasi) dan dimatikan: bahu hampir tidak berubah, kalung gantung tenggelam sampai 14 mm.
  Yang belum dicoba: koreksi rotasi LeftShoulder dan RightShoulder per klip, atau klip serang lain.
- Kalung gantung: bobotnya mengikuti kulit tepat di bawahnya (interpolasi bobot di segitiga kulit terdekat), bukan
  hanya Neck dan Spine2; dengan Neck dan Spine2 saja kalung tenggelam 6 mm saat badan membungkuk. Paling dalam
  0,8 mm di semua klip, termasuk serang-3 dan jongkok-jalan. Pita emas menyalin bobot kulit di bawahnya.
- Leher: Neck ke Head 5,1 derajat maju terhadap tegak saat idle, tidak perlu koreksi rotasi.
- Tekstur tangan: tangan kiri tampak gelap saat lari karena sisa bercak kelabu. Isian bercak diganti rata-rata
  halus warna kulit pulau yang sama (`abu.isi_halus`), dan kulit pucat di tangan dan telapak kaki ikut dianggap
  bercak (`abu.pucat`); tahap A (tekstur), D, dan E diulang, geometri tidak berubah.
- Di game (`?model=wijaya`): 14 aksi termuat, konsol tanpa error; idle, lari, jongkok-jalan, tangkis, tiga serang
  beruntun, serang berat, dan hindar berjalan. `src/character/model-wijaya.ts` tidak diubah.
- Sisa yang diketahui: gelembung bahu (di atas); lekuk kecil di tengah tepi bawah kain pada kuda-kuda terlebar dari
  belakang, dan lipatan pantat dari mesh aslinya; gumpalan gelap kecil di ujung lipatan depan kain saat siaga;
  sisi dalam kain terlihat dari bawah saat tepinya terangkat; lutut menyusut saat ditekuk dalam; tangan kiri di
  kain pinggul pada awal serang-1; gelang lengan belum metalik.
- Prajurit: `gabung_animasi.py --blok prajurit` belum dicoba. Blok `prajurit.animasi` belum diisi; mulai dari angka
  `wijaya_ulang.animasi.bagian`.
