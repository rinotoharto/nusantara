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

Tripo dari gambar seluruh badan selalu menghasilkan wajah meleleh, bercak abu-abu di bagian yang tidak terlihat (tangan, pergelangan kaki, leher), dan kulit pucat. Jadi setiap karakter dibuat dari dua gambar:
1. Seluruh badan, pose A, latar putih → Tripo H2.5 → `<nama>-tripo.glb` (dipakai untuk bentuk badan).
2. Kepala dan leher dekat dari karakter yang sama (percakapan ChatGPT yang sama) → Tripo H2.5 → `<nama>-kepala-tripo.glb`.
3. Skrip: optimasi_karakter.py, ganti_kepala.py, perbaikan bercak, kulit_warna.py, lalu Mixamo memakai animasi yang sudah ada.

## Prajurit Kediri (30 Oktober 2026)

- Konsep: docs/referensi/prajurit-kediri-konsep-01.png (ChatGPT; ikat kepala dan kain biru nila, sabuk cokelat pendek, kain bersilang bermotif).
- Badan: aset-mentah/prajurit-tripo.glb (Tripo H2.5). Bentuk dan kain bagus; wajah meleleh, bercak abu-abu, kulit pucat.
- Kepala: aset-mentah/prajurit-kepala-tripo.glb (menyusul).
- Dipakai sebagai tubuh dasar semua prajurit dan pengikut; variasi warna ikat kepala dan kain lewat kode (Kediri biru nila, Singasari merah tua, Madura putih dan hitam). Badan agak berotot; kalau perlu diramping lewat skrip supaya Wijaya tetap menonjol.

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

## Tombak (1 November 2026)

- Konsep: docs/referensi/tombak-konsep-01.png (ChatGPT; gagang kayu gelap sekitar 2 m, mata tombak berbentuk daun dengan rusuk tengah, cincin kuningan, tutup besi). Label interpretasi; tunjukkan ke Yayat S. Soelaeman bersama keris.
- Model: aset-mentah/tombak-tripo.glb (Tripo H2.5). Dari samping bagus, gagang lurus.
- Perbaikan lewat skrip (bersama pemasangan senjata): mata tombak bersirip empat (rusuk tengah ditafsirkan sebagai sirip atas-bawah); pipihkan verteks mata tombak ke ketebalan sekitar 25 persen pada sumbu tegak lurus bilah. Tutup besi bawah terlalu besar dan menggembung; kecilkan sekitar 30 persen. Ringankan ke sekitar 1.500 segitiga, panjang total 2 m, titik pusat di genggaman (sekitar sepertiga dari bawah). Ganti tombak balok prajurit dan penjaga, tempel ke tulang RightHand.

## Keris raja (1 November 2026)

- Konsep: docs/referensi/keris-raja-konsep-01.png (ChatGPT, revisi ketiga; hulu sosok jongkok bersanggul dengan aksen emas, mendak emas berbatu merah, bilah lurus asimetris dengan ganja ke satu sisi, greneng, gandik, pamor rapat). Untuk Kertanagara, Jayakatwang, dan Wijaya sebagai raja (epilog, bab 2 ke atas). Label interpretasi; tunjukkan ke Yayat S. Soelaeman.
- Model: aset-mentah/keris-raja-tripo.glb (Tripo H2.5). Bentuk bagus dari samping.
- Perbaikan tekstur lewat skrip: bercak putih keabu-abuan di sisi tak terlihat hulu; garis jingga (warna emas bocor) di tepi ujung bilah; merah dan emas mendak terlalu jenuh. Usulan: warnai ulang hulu per bagian (kayu cokelat gelap, aksen emas, metallic tinggi untuk emas), bersihkan tepi bilah dengan warna pamor sekitar, turunkan saturasi mendak dan beri metallic. Ringankan ke sekitar 2.500 segitiga.
