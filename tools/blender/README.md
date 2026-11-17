# Skrip Blender

Semua pekerjaan Blender dijalankan dari skrip Python di folder ini supaya bisa
diulang, bukan dengan tangan di antarmuka Blender.

Blender yang dipakai: 5.2.3 LTS (dicek 29 Oktober 2026) di
`/Applications/Blender.app/Contents/MacOS/Blender`.

Cara menjalankan (dari akar repo):

```bash
/Applications/Blender.app/Contents/MacOS/Blender -b -P tools/blender/<skrip>.py -- <argumen>
```

`-b` berjalan tanpa jendela, `-P` menjalankan skrip, dan semua setelah `--`
diteruskan ke skrip sebagai argumen.

## Skrip

- `optimasi_karakter.py` (Tahap B): dari GLB mentah Tripo ke GLB game.
  Rapikan mesh, Decimate ke target segitiga, bake normal dari mesh tinggi ke
  mesh rendah (Cycles, GPU), skala ke tinggi pemain dengan titik pusat di
  antara kaki, tekstur diperkecil, ekspor GLB Draco, dan render pratinjau
  4 sudut sebelum dan sesudah. Perintah untuk Wijaya:

  ```bash
  /Applications/Blender.app/Contents/MacOS/Blender -b -P tools/blender/optimasi_karakter.py -- --masuk aset-mentah/wijaya-tripo.glb --keluar public/models/wijaya.glb --segitiga 15000 --tekstur 2048 --tinggi 1.7 --pratinjau aset-mentah/pratinjau --nama wijaya
  ```

  Pilihan lain: `--putar <derajat>` memutar model di sumbu tegak kalau wajah
  tidak menghadap +Z; `--normal asal` memakai normal map Tripo tanpa bake;
  `--normal-dari <png>` memakai hasil bake sebelumnya (disimpan di folder
  sementara sistem, jalurnya dicetak skrip); `--ukuran-normal` dan
  `--format-normal png|jpeg` (bawaan jpeg, karena PNG 2048 berukuran 4 MB);
  `--cage` dan `--jarak-sinar` sebagai pecahan tinggi model (bawaan 0,003 dan
  0,01; lebih besar membuat sinar dari paha mengenai ujung kain sehingga
  normal kain terproyeksi ke kulit); `--rm tekstur` mempertahankan tekstur
  metallic-roughness Tripo, bawaan `tetap` dengan `--roughness 0.8
  --metallic 0` karena tekstur Tripo membuat kulit lebih mengkilap daripada
  kain dan emasnya tidak metalik.
  Bake pertama di Mac memakan sekitar 3 menit untuk kompilasi kernel Metal;
  bake berikutnya hanya beberapa detik.
  Pratinjau: 5 sudut, termasuk `paha` dari depan bawah yang diperbesar ke
  ujung kain.
- `ekspor_mixamo.py` (Tahap C): dari GLB hasil optimasi ke FBX tanpa Draco
  dengan tekstur tersemat, untuk diunggah ke Mixamo. Langkah manual Mixamo
  ada di `aset-mentah/mixamo/LANGKAH.md`.

  ```bash
  /Applications/Blender.app/Contents/MacOS/Blender -b -P tools/blender/ekspor_mixamo.py -- --masuk public/models/wijaya.glb --keluar aset-mentah/mixamo/wijaya-untuk-mixamo.fbx
  ```

- `gabung_animasi.py` (Tahap D): gabungkan karakter berkulit Mixamo dan
  animasi FBX menjadi satu GLB beranimasi.

## Perbaikan wajah dan tekstur (docs/prompt-perbaikan-wajah.md)

Hanya base color yang diubah; mesh, UV, dan normal map tetap. Angka penyesuaian
ada di `wajah.json` (kamera render kepala, titik acuan, transformasi,
potongan konsep). Cadangan base color lama:
`aset-mentah/tekstur/wijaya-basecolor-sebelum.jpg`.

Sebagian skrip memakai Python biasa (bukan Blender) dengan OpenCV dan
mediapipe. Venv sekali pasang (tidak masuk git):

```bash
/opt/homebrew/bin/python3.12 -m venv tools/.venv && tools/.venv/bin/pip install -r tools/requirements.txt
```

mediapipe dipatok 0.10.21 karena versi 0.10.30 ke atas dan 1.x membuang API
`solutions.face_mesh` yang membawa model face mesh di dalam paket; versi baru
butuh unduhan model terpisah.

- `wajah_render.py` (Tahap 1, Blender): render kepala dari depan dengan kamera
  ortografis dan menyimpan parameter kameranya ke `wajah.json`.

  ```bash
  /Applications/Blender.app/Contents/MacOS/Blender -b -P tools/blender/wajah_render.py -- --masuk public/models/wijaya.glb --keluar aset-mentah/pratinjau/wajah-model-depan.png --json tools/blender/wajah.json
  ```

- `wajah_acuan.py` (Tahap 1, venv): titik acuan wajah (mata, hidung, mulut,
  dagu, dahi) di gambar konsep dan render model lewat mediapipe, transformasi
  kemiripan konsep ke model, gambar tumpang `wajah-tumpang.png`, dan
  `wajah-titik.png` untuk mengecek deteksi. Koreksi titik dengan tangan di blok
  `acuan` lalu jalankan ulang dengan `--tanpa-deteksi`.

  ```bash
  tools/.venv/bin/python tools/blender/wajah_acuan.py --json tools/blender/wajah.json --konsep docs/referensi/wijaya-konsep-01.png --model aset-mentah/pratinjau/wajah-model-depan.png --pratinjau aset-mentah/pratinjau
  ```

- `wajah_proyeksi.py` (Tahap 2, Blender): UV kedua dari modifier UV Project
  dengan kamera wajah.json, lalu dua bake Emit ke UV asli: `wajah-proyeksi.png`
  (warna konsep selaras) dan `wajah-data.png` (R = sudut normal ke kamera,
  G = tinggi ternormalisasi antara `topeng.z_bawah_m` dan `z_atas_m`,
  B = cakupan). Mesh dan UV asli tidak diubah.

  ```bash
  /Applications/Blender.app/Contents/MacOS/Blender -b -P tools/blender/wajah_proyeksi.py -- --masuk public/models/wijaya.glb --json tools/blender/wajah.json --konsep aset-mentah/tekstur/wajah-konsep-selaras.png --keluar aset-mentah/tekstur
  ```

- `wajah_gabung.py` (Tahap 2, venv): topeng = sudut (penuh di bawah 25
  derajat, nol di 70) x tinggi (1,39 sampai 1,44 m; lebih rendah berarti
  menempelkan bayangan dagu dari konsep ke leher) x bukan latar putih konsep
  x bukan rambut gelap yang ditimpa latar terang; diperluas ke luar pulau UV
  sebelum closing dan blur 10 px supaya tidak muncul garis jahitan (itu
  penyebab segitiga tekstur lama di alis pada percobaan pertama); warna kulit
  konsep disamakan ke kulit lama di Lab dengan statistik dari pita batas
  (w 0,1 sampai 0,9), ditambah koreksi lokal frekuensi rendah (blur 40 px)
  yang penuh di pita dan 0,3 di tengah wajah; detail halus lama 0,5; dilate
  8 piksel. Kanal G `wajah-data.png` adalah tinggi absolut pada rentang
  `data_z` (1,2 sampai 1,8 m). Angka di wajah.json blok `topeng` dan `gabung`. Keluaran
  `wijaya-basecolor-wajah.png`, `topeng-wajah.png`, dan pratinjau pulau
  `wajah-tekstur-sebelum-sesudah.png`.

  ```bash
  tools/.venv/bin/python tools/blender/wajah_gabung.py --json tools/blender/wajah.json --lama aset-mentah/tekstur/wijaya-basecolor-sebelum.jpg --proyeksi aset-mentah/tekstur/wajah-proyeksi.png --data aset-mentah/tekstur/wajah-data.png --keluar aset-mentah/tekstur/wijaya-basecolor-wajah.png --pratinjau aset-mentah/pratinjau
  ```

- `tekstur_pasang.py` (Blender): pasang base color baru ke GLB dan ekspor ulang
  dengan Draco; dipakai Tahap 2 sampai 4 dan untuk tekstur hasil rapikan tangan.

  ```bash
  /Applications/Blender.app/Contents/MacOS/Blender -b -P tools/blender/tekstur_pasang.py -- --masuk public/models/wijaya.glb --basecolor aset-mentah/tekstur/wijaya-basecolor-wajah.png --keluar public/models/wijaya.glb
  ```

- `abu_isi.py` (Tahap 3, venv): bercak abu-abu. Deteksi per piksel di dalam
  pulau UV: kroma Lab rendah atau rona biru-kelabu bersaturasi rendah, di luar
  wajah Tahap 2 (topeng di atas 0,5 dan z di atas 1,45 m; leher tetap
  dideteksi). Dua kelas gelap diproses per komponen dengan syarat ketat
  (cincin kulit minimal 0,6, luas maksimal 20.000 px, di luar topeng wajah):
  abu-abu gelap (kroma rendah, V di bawah 0,3) dan cokelat gelap (rona
  kulit, V di bawah 0,4, luas minimal 1.500 px supaya puting dan pusar
  dibiarkan), yaitu bayangan rambut yang terproyeksi Tripo di bahu. Warna
  rambut sama dengan kedua kelas itu, jadi tanpa syarat cincin kulit sanggul
  ikut terisi. Komponen yang cincin sekelilingnya nyaris tanpa kulit
  diabaikan (sorotan kain, mata); yang kulitnya sedikit masuk topeng tangan;
  sisanya diisi otomatis kecuali piksel dalam 6 piksel dari kain atau emas
  (ke topeng tangan). Isian: inpainting Telea per pulau dengan sumber hanya
  kulit pulau itu (piksel peralihan, piksel tangan, dan margin ikut di-mask),
  lalu detail halus kulit tetangga dan dilate 8 piksel ke margin. Keputusan:
  komponen yang menyentuh tepi pulau ikut diisi (`isi_tepi` true di
  wajah.json) karena hampir semua bercak Tripo ada di siluet, yaitu tepi pulau,
  dan sumber inpainting sudah dibatasi ke pulau sendiri. Keluaran
  `wijaya-basecolor-abu.png`, `topeng-abu.png` (merah otomatis, kuning
  tangan), `topeng-abu-tangan.png`.

  ```bash
  tools/.venv/bin/python tools/blender/abu_isi.py --json tools/blender/wajah.json --masuk aset-mentah/tekstur/wijaya-basecolor-wajah.png --data aset-mentah/tekstur/wajah-data.png --topeng-wajah aset-mentah/tekstur/topeng-wajah.png --keluar aset-mentah/tekstur/wijaya-basecolor-abu.png --tekstur aset-mentah/tekstur
  ```

- Pratinjau: `wajah_render.py --sudut depan|tigaperempat|samping|badan|
  badan-tigaperempat|badan-samping|badan-belakang|tangan|kaki`; Tahap 2 ke
  `aset-mentah/pratinjau/wajah-<sudut>.png`, Tahap 3 ke `abu-<sudut>.png`.

## Ganti kepala (30 Oktober 2026)

Kepala Tripo lama (profil rata) diganti kepala Tripo baru `aset-mentah/kepala-tripo.glb`.
Angka di `wajah.json` blok `kepala` dan `kulit`.

1. `kepala_render.py` (Blender) lalu `kepala_acuan.py` (venv): render kepala baru dari
   depan, titik mata dan dagu dengan mediapipe, disimpan di `kepala.acuan`.
2. `ganti_kepala.py` (Blender): skala kepala dari jarak mata konsep di model (7,0 cm),
   dagu di z 1,470 m, pusat leher disamakan ke badan. Salinan kepala tinggi jadi sumber
   bake. Kepala kerja: remesh voxel 4 mm (serabut rambut menyatu), potong di
   `z_potong_m` 1,455, bagian lepas kecil dibuang, daerah rambut (di atas mata atau di
   belakang pusat kepala) dihaluskan, decimate ke 3.000 segitiga, Smart UV baru. Badan:
   muka di atas 1,50 m dibuang, leher dipotong hanya di silinder radius 0,13 m (bahu
   tidak teriris), lingkar leher dijembatani (bridge loops), jahitan dihaluskan. UV
   seluruh model disalin, kepadatan disetarakan, kepala diberi bonus 1,8x, lalu pack
   tanpa rotasi. Bake A (badan dari UV lama), bake B (kepala dan jembatan dari mesh
   tinggi, selected to active, cage 8 mm, sinar 6 cm), bake C (data: indeks bahan,
   tinggi).
3. `kulit_warna.py` (venv): gabung A/B lewat C; texel kosong, pita leher 5 cm di atas
   potongan, dan texel gelap di bawah dagu diisi dari tetangga sejenis (rambut dari
   gelap, kulit dari terang); margin seragam 8 px. Warna: kulit badan digeser ke
   `sasaran_lab_badan` (128, 146, 154), kulit kepala disamakan rata-rata dan sebarannya
   ke badan; hanya piksel kulit.
4. `tekstur_pasang.py --normal` memasang base color dan normal ke GLB.

```bash
/Applications/Blender.app/Contents/MacOS/Blender -b -P tools/blender/kepala_render.py -- --masuk aset-mentah/kepala-tripo.glb --keluar aset-mentah/pratinjau/kepala-baru-depan.png --json tools/blender/wajah.json
tools/.venv/bin/python tools/blender/kepala_acuan.py --json tools/blender/wajah.json --render aset-mentah/pratinjau/kepala-baru-depan.png
/Applications/Blender.app/Contents/MacOS/Blender -b -P tools/blender/ganti_kepala.py -- --badan <GLB badan lama> --kepala aset-mentah/kepala-tripo.glb --json tools/blender/wajah.json --tekstur aset-mentah/tekstur --keluar /tmp/wijaya-kepala.glb
tools/.venv/bin/python tools/blender/kulit_warna.py --json tools/blender/wajah.json --tekstur aset-mentah/tekstur --keluar-basecolor aset-mentah/tekstur/wijaya-basecolor-kepala.png --keluar-normal aset-mentah/tekstur/wijaya-normal-kepala.png
/Applications/Blender.app/Contents/MacOS/Blender -b -P tools/blender/tekstur_pasang.py -- --masuk /tmp/wijaya-kepala.glb --basecolor aset-mentah/tekstur/wijaya-basecolor-kepala.png --normal aset-mentah/tekstur/wijaya-normal-kepala.png --keluar public/models/wijaya.glb
```

Putaran kedua (30 Oktober): skala kepala dari tinggi dagu ke puncak = tinggi badan
/ 7,5 (22,7 cm; `skala_mode` "tinggi"), bukan dari jarak mata. Sambungan leher
mode `selip`: lingkar leher kepala dilebur radial ke lingkar badan dalam pita
3 cm (`leher_blend_m`) dan diteruskan 1,2 cm ke dalam badan dengan jari-jari
1,5 mm lebih kecil, tanpa jembatan (bridge dua lingkar dengan jumlah verteks
berbeda menghasilkan kerah bergerigi; merge menyisakan celah). Warna: sasaran
badan Lab (140, 146, 156); pita leher kepala di bawah dagu disamakan ke leher
badan tepat di bawah jahitan, memudar 2 cm ke atas; texel badan gelap di atas
1,38 m (bayangan kepala lama) dan texel kepala gelap di bawah rahang (normal
menghadap bawah) diisi dari kulit sekitar. Pratinjau tambahan
`wajah_render.py --sudut leher-depan|leher-samping|leher-tigaperempat`.

Catatan: `ganti_kepala.py` membaca badan dari GLB yang masih berkepala lama; GLB
sebelum ganti kepala ada di git (commit 3857c46). Topeng tangan Tahap 3 tidak cocok
lagi dengan atlas baru. Sisa yang diketahui: garis tipis di batas pulau UV wajah
(hanya terlihat dari dekat), coretan gelap di lubang hidung dari tekstur Tripo.

## Rapikan leher (17 November 2026, revisi 1)

Langkah 2 "Prosedur sambung kepala" (aset-mentah/README.md): dari berkas yang kepalanya sudah
diletakkan dan dipotong manual di Blender ke GLB game. Angka di `wajah.json` blok `leher_rapi`
(bawaan ditulis skrip saat pertama jalan; ubah di sana lalu jalankan ulang; hapus bloknya untuk
kembali ke bawaan).

```bash
/Applications/Blender.app/Contents/MacOS/Blender -b -P tools/blender/rapikan_leher.py -- --masuk aset-mentah/wijaya-leher-rapi.glb --z-potong 1.48 --json tools/blender/wajah.json --tekstur aset-mentah/tekstur --nama wijaya --keluar /tmp/wijaya-leher.glb
/Applications/Blender.app/Contents/MacOS/Blender -b -P tools/blender/gabung_animasi.py -- --model /tmp/wijaya-leher.glb --mixamo aset-mentah/mixamo --json tools/blender/wajah.json --keluar public/models/wijaya.glb
```

`LEHER_DEBUG=1` di depan perintah pertama mencetak profil sambungan, titik cabang cincin, dan
sebaran rona di kotak gelang.

### `rapikan_leher.py` (Blender)

Syarat masukan: satu mesh, kepala tidak tersambung ke badan, bawah kepala dipotong di sekitar
`--z-potong`, leher badan diekstrusi naik (pita lama). Mesh hasil ekspor glTF terpecah di
jahitan UV (Wijaya: 517 keping), jadi tepi terbuka dicari pada topologi yang dilas berdasarkan
posisi (`las_m` 0,1 mm). Yang benar-benar di-merge hanya duplikat persis di badan bawah (untuk
Decimate) dan verteks di kedua cincin sambungan (`las_cincin_m` 0,5 mm).

1. Cincin terbuka di sekitar leher dilaporkan; pita lama dan sekat dalam (muka datar sisa Bisect
   dengan Fill di pangkal pita) dibuang.
2. Kalung lukis, bagian mesh (`kalung_lukis`): texel dada atas yang jelas gelap atau bukan kulit
   memberi posisi 3D garis kalung lama; verteks badan dalam `ratakan_radius_m` dari garis itu
   dihaluskan. Daerahnya `tinggi_m` x `radius_m` dari sumbu leher; jangan dilebarkan sampai
   ketiak, karena lipatan gelap di sana ikut terdeteksi.
3. Leher ditegakkan (`tegak`): kepala digeser `geser_kepala_m` ke belakang; badan digeser
   `geser_leher_m` dengan bobot 0 di `z_pangkal_m` sampai 1 di cincin atas badan, memudar di luar
   `radius_penuh_m`. Sudut sumbu leher terhadap vertikal diukur sebelum dan sesudah
   (`hasil.tegak`).
4. Atas leher badan dipotong ulang dengan bidang miring (`potong_badan`): di belakang tepat di
   bawah cincin lama, di depan `turun_depan_m` lebih rendah. Ini membuang sisa bawah dagu kepala
   Tripo lama yang masih menempel di badan.
5. Bawah kepala dipotong ulang (`rahang`): bidang miring `sudut_derajat` lewat bawah dagu, naik
   ke belakang mengikuti bawah rahang, tidak lebih dari `naik_maks_m` (bidang datar di belakang
   telinga supaya rambut tengkuk tidak terpotong tinggi).
6. Sambungan: cincin tepi kepala dan cincin atas badan (jumlah verteks berbeda) dijahit zig-zag
   menurut sudut lewat `ruas` - 1 cincin perantara berisi `kolom` verteks. Bawah dagu melandai
   `sudut_bawah_dagu_derajat`; tonjolan otot tipis (`otot_m`) dari belakang telinga ke selangka;
   pangkal sambungan dihaluskan (`halus_pangkal_m`). Semua penghalusan memakai posisi las dan
   memulihkan verteks kalau ada muka yang normalnya berbalik.
7. Kalung (`kalung`): tali bulat `jari_m` mengikuti permukaan (sinar ke badan lalu jarak tetap
   `celah_m` dari kulit), `turun_depan_m` lebih rendah di depan, liontin pipih menempel ke dada;
   material kedua `emas` (warna `warna_srgb`, metallic 1, roughness 0,35).
8. Anggaran segitiga: Decimate hanya pada verteks badan di bawah `decimate_z_maks_m`. Sesudahnya
   diperiksa: (a) muka kulit yang teksturnya menjadi bukan kulit (UV terlempar ke pulau lain),
   lalu decimate diulang dengan daerah itu dilindungi; (b) muka yang arahnya berbalik dibanding
   sebelum decimate dibalik lagi; (c) skrip berhenti kalau verteks di luar daerah itu berubah.
9. Normal: normal asli tiap sudut dibawa lewat atribut dan dipasang kembali; sudut baru, cincin
   sambungan, dan normal yang menyimpang lebih dari sekitar 72 derajat dari arah mukanya dihitung
   halus per posisi las (badan, kepala, dan sambungan sebagai satu permukaan).
10. Tekstur: pulau UV sambungan di kotak kosong atlas; warna beralih dari kulit leher badan ke
    kulit rahang di ruang Lab (`kuat_rahang`, `batas_rahang_L`), peralihan diteruskan
    `peralihan_m` ke kepala dan ke leher badan. Kalung lukis dihapus dari tekstur: texel gelap
    diisi dari medan warna kulit per (sudut, kedalaman), bukan dari tetangga di atlas, karena
    atlas terpecah ratusan pulau. Normal map: rata dalam `normal_rata_m` dari sambungan dan di
    texel yang dihapus, dilemahkan di kulit kepala (`normal_kulit_kepala`) dan dada atas
    (`normal_dada`). Margin pulau dibangun ulang. Keluaran `<nama>-basecolor-leher.png`,
    `<nama>-normal-leher.png`, `<nama>-mr-leher.png`.
11. Emas lukis gelang lengan (`emas`): topeng posisi (kotak `x_abs_m`, `z_m`) dan warna (rona
    27,5 sampai 45 derajat, saturasi di atas 0,55) ke tekstur metallic-roughness, kadar logam
    `metallic_emas` 0,65 supaya warna lukisnya masih terlihat.

Ini menggantikan "optimasi ulang": `optimasi_karakter.py` berangkat dari GLB mentah Tripo dan
tidak cocok untuk mesh yang sudah bertekstur atlas baru.

### `gabung_animasi.py`

Kalau `leher_rapi.hasil` ada di wajah.json:
- kepala = verteks di atas permukaan potong bawah rahang; pita sambungan (di antara kedua
  permukaan potong) bergradasi dari bobot hasil transfer di pangkal ke Head penuh di tepi kepala;
- kalung (material `emas`) hanya Neck dan Spine2: bagian belakang yang tinggi sampai
  `animasi.kalung_neck_maks` Neck, bagian depan yang rendah Spine2;
- sendi Head dan anak-anaknya digeser sejauh geser kepala, Neck sejauh geser leher di tingginya
  (hanya posisi istirahat, arah tulang tetap);
- `animasi.koreksi_rotasi_derajat` (bawaan Neck 0, Head 5, derajat ke belakang) diterapkan ke
  semua aksi di kerangka acuan istirahat tulang.

### `wajah_render.py`

Sudut baru `leher-bawah` (dari bawah dagu) dan `leher-dialog` (depan agak samping); `--aksi <nama>
--bingkai <n>` merender bingkai animasi (kamera leher mengikuti tulang Head); `--toleh <derajat>`
uji menoleh; `--garis-bahu` garis vertikal merah lewat sendi bahu; `--matahari az,el` satu
matahari seperti di game; `--tanpa-normal` dan `--normal-warna` untuk membedakan pengaruh normal
map. GLB berkerangka tanpa `--aksi` dirender pada pose istirahat.

```bash
/Applications/Blender.app/Contents/MacOS/Blender -b -P tools/blender/wajah_render.py -- --masuk public/models/wijaya.glb --json tools/blender/wajah.json --sudut badan-samping --netral --garis-bahu --aksi idle --bingkai 60 --keluar aset-mentah/pratinjau/leher-badan-samping-idle.png
```

Catatan: `--sudut depan` menulis ulang blok `kamera` di json; untuk render uji pakai salinan json.
