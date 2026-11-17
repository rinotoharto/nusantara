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

## Sambung kepala di tengah leher (17 November 2026, prajurit Kediri)

Cara baku untuk karakter dari dua hasil Tripo (badan seluruh tubuh dan kepala dekat); prosedur dan syaratnya ada di
`docs/standar-karakter.md`. Menggantikan `ganti_kepala.py` dan `rapikan_leher.py` (potong di bawah dagu), yang
tidak dipakai lagi. Angka per karakter di `wajah.json`, satu blok per karakter (`prajurit`: `abu`, `kepala`,
`sambung`, `tempat`, `tekstur`); bawaan ditulis skrip saat pertama jalan, ubah di json lalu jalankan ulang.

Urutan untuk prajurit (dari akar repo; `B` = `/Applications/Blender.app/Contents/MacOS/Blender -b -P`, `V` =
`tools/.venv/bin/python`):

```bash
# A. Badan
B tools/blender/optimasi_karakter.py -- --masuk aset-mentah/prajurit-tripo.glb --keluar aset-mentah/prajurit-badan.glb --segitiga 11000 --tekstur 2048 --tinggi 1.68 --ramping 0.065 --halus-daerah 0.765,0.875,0.105 --nama prajurit
B tools/blender/data_uv.py -- --masuk aset-mentah/prajurit-badan.glb --keluar aset-mentah/tekstur/prajurit-data.png --json tools/blender/wajah.json --blok prajurit --basecolor-keluar aset-mentah/tekstur/prajurit-basecolor-sebelum.jpg
V tools/blender/abu_isi.py --json tools/blender/wajah.json --blok prajurit --awalan prajurit- --masuk aset-mentah/tekstur/prajurit-basecolor-sebelum.jpg --data aset-mentah/tekstur/prajurit-data.png --keluar aset-mentah/tekstur/prajurit-basecolor-abu.png --tekstur aset-mentah/tekstur
B tools/blender/tekstur_pasang.py -- --masuk aset-mentah/prajurit-badan.glb --basecolor aset-mentah/tekstur/prajurit-basecolor-abu.png --keluar aset-mentah/prajurit-badan.glb --nama prajurit
# B. Kepala
B tools/blender/kepala_render.py -- --masuk aset-mentah/prajurit-kepala-tripo.glb --keluar /tmp/prajurit-kepala-depan.png --json tools/blender/wajah.json --blok prajurit
V tools/blender/kepala_acuan.py --json tools/blender/wajah.json --blok prajurit --render /tmp/prajurit-kepala-depan.png
B tools/blender/kepala_ringan.py -- --masuk aset-mentah/prajurit-kepala-tripo.glb --keluar aset-mentah/prajurit-kepala.glb --json tools/blender/wajah.json --blok prajurit --tekstur aset-mentah/tekstur --nama prajurit --banding aset-mentah/pratinjau/prajurit-wajah-banding.png
# C. Penempatan (CEK)
B tools/blender/sambung_kepala.py -- --badan aset-mentah/prajurit-badan.glb --kepala aset-mentah/prajurit-kepala.glb --json tools/blender/wajah.json --blok prajurit --tahap tempat --pratinjau aset-mentah/pratinjau --nama prajurit
# D dan E. Sambung dan tekstur
B tools/blender/sambung_kepala.py -- --badan aset-mentah/prajurit-badan.glb --kepala aset-mentah/prajurit-kepala.glb --json tools/blender/wajah.json --blok prajurit --tahap sambung --tekstur aset-mentah/tekstur --nama prajurit --keluar aset-mentah/prajurit-sambung.glb
V tools/blender/sambung_tekstur.py --json tools/blender/wajah.json --blok prajurit --tekstur aset-mentah/tekstur --nama prajurit --konsep docs/referensi/prajurit-kediri-konsep-01.png
B tools/blender/tekstur_pasang.py -- --masuk aset-mentah/prajurit-sambung.glb --basecolor aset-mentah/tekstur/prajurit-basecolor-sambung.png --normal aset-mentah/tekstur/prajurit-normal-sambung.png --keluar aset-mentah/prajurit-utuh.glb --nama prajurit
# F. Pratinjau (CEK) dan tumpang siluet dengan konsep
B tools/blender/pratinjau_karakter.py -- --masuk aset-mentah/prajurit-utuh.glb --json tools/blender/wajah.json --blok prajurit --keluar aset-mentah/pratinjau --nama prajurit
V tools/blender/tumpang_konsep.py --render <folder sementara>/prajurit-siluet-depan.png --konsep docs/referensi/prajurit-kediri-konsep-01.png --keluar aset-mentah/pratinjau/prajurit-tumpang-konsep-depan.png
# G. FBX untuk Mixamo
B tools/blender/ekspor_mixamo.py -- --masuk aset-mentah/prajurit-utuh.glb --keluar aset-mentah/mixamo-prajurit/prajurit-untuk-mixamo.fbx
```

Render siluet (latar transparan) ditulis `pratinjau_karakter.py` ke folder sementara sistem
(`nusantara-sambung/`, jalurnya dicetak). Untuk tampak samping pakai `...-siluet-samping.png` dan gambar konsep
samping.

### Pilihan baru di skrip lama

- `optimasi_karakter.py --ramping <pecahan>`: lebar dan tebal dikecilkan, tinggi tetap. `--halus-daerah
  z_min,z_maks,x_maks` (pecahan tinggi model) dan `--halus-iterasi`: mesh tinggi dihaluskan (Taubin) di daerah itu
  sebelum decimate dan bake. Dipakai untuk tali leher yang ikut tercetak Tripo di dada: kalau dibiarkan, tonjolan
  tipis itu menjadi kantong lipatan setelah decimate dan ikut ter-bake ke normal map.
- `abu_isi.py --blok <nama> --awalan <nama>-`: angka dari `<blok>.abu`, topeng diberi awalan (topeng Wijaya tidak
  tertimpa). Pilihan di `<blok>.abu` untuk data dari `data_uv.py`: `zona_kain` (kain ditentukan menurut posisi,
  bukan warna: kain nila pudar berkroma rendah terbaca sebagai bercak), `z_maks_m`, `gelap_aktif`,
  `gelap_z_maks_m`, `isi_tanpa_kulit` (jari yang seluruhnya kelabu; pulau tanpa kulit diisi warna kulit median pada
  tinggi yang sama). `ABU_DEBUG=1` mencetak alasan bercak gelap dilewati.
- `kepala_render.py`, `kepala_acuan.py`: `--blok`. `tekstur_pasang.py`: `--nama` (nama gambar di GLB).
- `kulit_warna.py`: `main()` hanya jalan kalau dipanggil langsung, supaya `topeng_kulit`, `statistik`, dan `halus`
  bisa dipakai `sambung_tekstur.py`.

### `data_uv.py` (Blender)

Bake data per texel ke UV model: R = |x| pada `data_x`, G = tinggi pada `data_z`, B = cakupan pulau. Susunan G dan
B sama dengan `wajah-data.png`, jadi bisa dipakai `abu_isi.py`. `--basecolor-keluar` menyimpan base color GLB ke
berkas (cadangan sebelum bercak diisi).

### `kepala_ringan.py` (Blender)

Kepala Tripo (patung dada, tinggi 1 satuan) menjadi kepala ringan dalam meter. Skala: dagu ke puncak kepala tanpa
sanggul = tinggi badan / `rasio_tinggi` (7,5); puncak dicari sebagai irisan tertinggi yang tebalnya masih 60 persen
tebal kepala. Langkah: remesh voxel 4 mm (serabut rambut menyatu), hanya komponen terbesar, bahu dibuang kasar
`leher_sisa_m` di bawah dagu, rambut dihaluskan, lalu cara `tempel`: muka di jendela wajah (depan, di bawah alis,
sampai tenggorokan) dibagi dan verteksnya ditempel kembali ke permukaan asli Tripo, supaya bibir, kelopak mata,
dan lubang hidung tidak dihaluskan remesh. Decimate dua tahap dengan jatah segitiga terpisah (`segitiga_wajah`
dan `segitiga`), Smart UV, bake warna dan normal dari mesh asli ke 1024. Laporan: simpangan wajah terhadap mesh
asli (mm; rata-rata, p95, maks) per daerah, dan gambar banding (atas asli, bawah hasil). `--cara remesh`
menjalankan pembanding tanpa tempel. Prajurit: mulut p95 2,36 mm (remesh) menjadi 1,67 mm (tempel).

### `sambung_kepala.py` (Blender)

`--tahap tempat`: ukur dan tempatkan, render tumpang, siluet. `--tahap sambung`: potong, sambung, atlas, bake.

1. Ukur badan: sumbu simetri, puncak bahu, sendi bahu (tengah penampang pangkal lengan). Ukur kepala: telinga
   (verteks terluar antara mulut dan mata), lebar rahang.
2. Tempatkan kepala: `skala_kepala` (bawaan 1), dagu di `dagu_z_m`, telinga di atas sendi bahu
   (`telinga_maju_m` untuk menggeser).
3. Bidang potong: dua bidang sejajar miring `miring_derajat` (lebih rendah di depan). Bidang kepala lewat sumbu
   leher kepala `potong_bawah_dagu_m` di bawah dagu; bidang badan `celah_m` di bawahnya.
4. Leher badan (`bentuk_leher`): digeser dan diskalakan bertahap (bobot 0 di `pangkal_m` di bawah bidang potong
   badan, 1 di bidang potong) sampai penampangnya sama dengan cincin kepala; parameternya dikoreksi beberapa kali
   karena verteks yang digeser memotong bidang miring di tempat lain. Lalu pangkal leher dihaluskan (Taubin pada
   topologi las posisi) dan lipatan dibuka.
5. Kantong lipatan yang tidak bisa dibuka (`tambal_kantong`; sisa simpul tali): dibuang bersama muka di
   sekitarnya, lubangnya ditutup kipas segitiga berbahan `tambal`. Las hanya di sekitar lubang.
6. Potong: badan di bidang badan (kepala lama = muka di atas bidang yang tersambung ke puncak kepala), kepala di
   bidang kepala. Las hanya verteks di kedua bidang potong.
7. Cincin: verteks yang lebih rapat dari `tepi_min_m` digabung; lalu kedua cincin dipasangkan per sudut
   (`pasangkan`): verteks yang sudah ada dalam `cocok_derajat` dipakai, selebihnya disisipkan di tepi cincin lawan
   pada sudut yang sama. Menyamakan jumlah saja membuat pita terpuntir (beda sudut pasangan sampai 45 derajat).
8. Pita: `ruas` - 1 cincin perantara pada kurva Bezier yang menyinggung kedua permukaan; hanya cincin perantara
   yang dihaluskan. Muka di dekat sambungan yang terbalik direlaksasi per kelompok posisi.
9. Tali leher (`tali`): pita lonjong mengikuti permukaan di bidang tengah sambungan.
10. Atlas baru (UV disalin, kepadatan disetarakan, kepala `kepala_skala_uv`, pack tanpa rotasi), bake warna dan
    normal lama ke atlas baru, bake data (`<nama>-sambung-data1.png`, `-data2.png`), skala akhir ke
    `tinggi_akhir_m`, normal halus per posisi las dipasang sebagai normal khusus (tanpa me-merge mesh).

Laporan di `<blok>.sambung.hasil`: jumlah verteks tiap cincin (asal, dirapikan, disamakan), lebar dan tebal,
selisih persen, tinggi pita, tambalan, tepi terbuka di dekat sambungan (harus 0). `SAMBUNG_DEBUG=1` mencetak
rincian muka terbalik dan tepi terbuka tiap langkah.

### `sambung_tekstur.py` (venv)

Tekstur akhir dari bake A dan data. Texel yang diganti diisi dari medan warna kulit 3D (`medan3d`): warna kulit
yang baik dirata-ratakan per voxel di ruang model lalu dihaluskan, karena pulau UV yang bertetangga di atlas belum
tentu bertetangga di badan (isian per pulau tampak sebagai mosaik). Langkah: permukaan bawah dagu yang menghadap
bawah diganti seluruhnya (tekstur Tripo di sana mosaik pucat), bercak kelabu dan pucat di leher kepala; tali lukis
lama, coretan gelap, dan bercak pucat di dada atas dan punggung atas, termasuk tambalan; kulit badan digeser ke
rata-rata kulit kepala (Lab); peralihan `peralihan_m` di pita sambungan per sudut; cek pipi kiri-kanan
(`separuh_wajah`, diratakan kalau selisih L melewati ambang); warna tali; margin pulau; normal map rata di pita,
tali, dan tambalan, dilemahkan di dada atas. Keluaran `<nama>-basecolor-sambung.png`, `<nama>-normal-sambung.png`.

### `tumpang_konsep.py` (venv) dan `pratinjau_karakter.py` (Blender)

`tumpang_konsep.py`: siluet render (latar transparan) dan gambar konsep disamakan tingginya, alas dan tengahnya
diimpitkan; tiga panel (seluruh badan dengan garis tepi merah konsep dan biru model, perbesaran kepala sampai
bahu, perbesaran dengan konsep setengah tembus pandang). `pratinjau_karakter.py`: seluruh badan dari depan,
samping, tiga perempat; leher dari depan, samping, dekat setinggi wajah, bawah dagu (satu matahari seperti di
game); siluet. `--hanya a,b` memilih sudut.

### Jebakan yang ditemukan

- Badan Tripo berkepala pendek dan berleher condong ke depan: lebar leher sudah mendekati leher kepala, tetapi
  tebalnya berlebih dan pusatnya 4 cm di depan; yang perlu dibetulkan tebal dan kemiringan.
- GLB terpecah di jahitan UV. Menggerakkan satu verteks tanpa kembarannya membuat retakan (lubang gelap); selalu
  gerakkan per kelompok posisi. Segitiga berluas nol dikeluarkan dari hitungan normal.
- Sesudah menyimpan gambar JPEG, format keluaran render ikut berubah; set PNG lagi sebelum render. Kamera:
  `to_track_quat("-Z", "Y")`.
- Kanal jarak di data1 hanya berlaku 0,1 m dari bidang tengah; batas daerah yang lebih jauh pakai tinggi z.

## Pengulangan Wijaya (17 November 2026)

Alur yang sama dengan prajurit (`docs/standar-karakter.md`), dengan beberapa pilihan baru karena bahan Wijaya
berbeda: kain berona kulit, kalung konsep yang menggantung ke dada, bahu tinggi, dan dua kalung emas dari mesh.
Angka di `wajah.json` blok `wijaya_ulang`; berkas antara berawalan `wijaya-ulang-`. Urutan (dari akar repo; `B`
dan `V` seperti di atas):

```bash
# A. Badan
B tools/blender/optimasi_karakter.py -- --masuk aset-mentah/wijaya-tripo.glb --keluar aset-mentah/wijaya-ulang-badan.glb --segitiga 11400 --tekstur 2048 --tinggi 1.70 --ramping 0 --halus-daerah 0.765,0.875,0.105 --halus-titik 0.055,0.7285,0.016,14 --atlas-baru --nama wijaya-ulang
B tools/blender/data_uv.py -- --masuk aset-mentah/wijaya-ulang-badan.glb --keluar aset-mentah/tekstur/wijaya-ulang-data.png --json tools/blender/wajah.json --blok wijaya_ulang --basecolor-keluar aset-mentah/tekstur/wijaya-ulang-basecolor-sebelum.jpg --normal-keluar aset-mentah/tekstur/wijaya-ulang-normal-sebelum.png
V tools/blender/abu_isi.py --json tools/blender/wajah.json --blok wijaya_ulang --awalan wijaya-ulang- --masuk aset-mentah/tekstur/wijaya-ulang-basecolor-sebelum.jpg --data aset-mentah/tekstur/wijaya-ulang-data.png --keluar aset-mentah/tekstur/wijaya-ulang-basecolor-abu.png --tekstur aset-mentah/tekstur --normal-masuk aset-mentah/tekstur/wijaya-ulang-normal-sebelum.png --normal-keluar aset-mentah/tekstur/wijaya-ulang-normal-abu.png
B tools/blender/tekstur_pasang.py -- --masuk aset-mentah/wijaya-ulang-badan.glb --basecolor aset-mentah/tekstur/wijaya-ulang-basecolor-abu.png --normal aset-mentah/tekstur/wijaya-ulang-normal-abu.png --keluar aset-mentah/wijaya-ulang-badan.glb --nama wijaya-ulang
# B. Kepala
B tools/blender/kepala_render.py -- --masuk aset-mentah/kepala-tripo.glb --keluar <folder sementara>/wijaya-ulang-kepala-depan.png --json tools/blender/wajah.json --blok wijaya_ulang
V tools/blender/kepala_acuan.py --json tools/blender/wajah.json --blok wijaya_ulang --render <folder sementara>/wijaya-ulang-kepala-depan.png
B tools/blender/kepala_ringan.py -- --masuk aset-mentah/kepala-tripo.glb --keluar aset-mentah/wijaya-ulang-kepala.glb --json tools/blender/wajah.json --blok wijaya_ulang --tekstur aset-mentah/tekstur --nama wijaya-ulang --banding aset-mentah/pratinjau/wijaya-ulang-wajah-banding.png
# C. Penempatan (CEK), dengan model sementara untuk gambar berdampingan
B tools/blender/sambung_kepala.py -- --badan aset-mentah/wijaya-ulang-badan.glb --kepala aset-mentah/wijaya-ulang-kepala.glb --json tools/blender/wajah.json --blok wijaya_ulang --tahap tempat --pratinjau aset-mentah/pratinjau --nama wijaya-ulang --keluar <folder sementara>/wijaya-ulang-tempat.glb
B tools/blender/banding_karakter.py -- --kiri <folder sementara>/wijaya-ulang-tempat.glb --kanan aset-mentah/prajurit-utuh.glb --keluar aset-mentah/pratinjau --nama wijaya-ulang
# D dan E. Sambung (pita emas, kalung gantung) dan tekstur
B tools/blender/sambung_kepala.py -- --badan aset-mentah/wijaya-ulang-badan.glb --kepala aset-mentah/wijaya-ulang-kepala.glb --json tools/blender/wajah.json --blok wijaya_ulang --tahap sambung --tekstur aset-mentah/tekstur --nama wijaya-ulang --keluar aset-mentah/wijaya-ulang-sambung.glb
V tools/blender/sambung_tekstur.py --json tools/blender/wajah.json --blok wijaya_ulang --tekstur aset-mentah/tekstur --nama wijaya-ulang --konsep docs/referensi/wijaya-konsep-01.png
B tools/blender/tekstur_pasang.py -- --masuk aset-mentah/wijaya-ulang-sambung.glb --basecolor aset-mentah/tekstur/wijaya-ulang-basecolor-sambung.png --normal aset-mentah/tekstur/wijaya-ulang-normal-sambung.png --keluar aset-mentah/wijaya-utuh.glb --nama wijaya
# F. Pratinjau (CEK), tumpang siluet konsep, berdampingan dengan prajurit
B tools/blender/pratinjau_karakter.py -- --masuk aset-mentah/wijaya-utuh.glb --json tools/blender/wajah.json --blok wijaya_ulang --keluar aset-mentah/pratinjau --nama wijaya-ulang
V tools/blender/tumpang_konsep.py --render <folder sementara>/wijaya-ulang-siluet-depan.png --konsep docs/referensi/wijaya-konsep-01.png --keluar aset-mentah/pratinjau/wijaya-ulang-tumpang-konsep-depan.png
V tools/blender/tumpang_konsep.py --render <folder sementara>/wijaya-ulang-siluet-samping.png --konsep docs/referensi/wijaya-samping-01.png --keluar aset-mentah/pratinjau/wijaya-ulang-tumpang-konsep-samping.png
B tools/blender/banding_karakter.py -- --kiri aset-mentah/wijaya-utuh.glb --kanan aset-mentah/prajurit-utuh.glb --keluar aset-mentah/pratinjau --nama wijaya-ulang
# G. FBX untuk Mixamo
B tools/blender/ekspor_mixamo.py -- --masuk aset-mentah/wijaya-utuh.glb --keluar aset-mentah/mixamo-wijaya-ulang/wijaya-untuk-mixamo.fbx
```

Kalau tekstur badan atau kepala diubah, tahap C, D, E, dan F harus dijalankan ulang (tahap C menulis ulang blok
`tempat` yang dipakai D).

### Pilihan baru

- `optimasi_karakter.py --atlas-baru` (`--atlas-margin`): pulau UV mesh rendah ditata ulang dengan margin (bentuk
  pulau tetap), lalu base color ikut di-bake dari mesh tinggi (dua kali: jarak sinar kecil, lalu 5 kali lebih jauh
  untuk texel yang meleset). Tanpa ini tepi pulau hasil decimate memotong keluar dari pulau asli di atlas Tripo
  dan mengambil warna pulau tetangga: tambalan terang berbentuk zig-zag di dada, bercak di tepi pulau.
- `optimasi_karakter.py --halus-titik x,z,jari[,iterasi]` (boleh diulang): Laplace pada cakram kecil di permukaan
  depan, kiri dan kanan, di mesh tinggi sebelum decimate. Untuk puting Tripo yang menonjol seperti kancing: 14
  iterasi mengurangi tonjolan separuh, 60 meratakannya.
- `data_uv.py --normal-keluar`: normal map GLB disimpan ke berkas.
- `abu_isi.py` (blok `<blok>.abu`): `tepi_gelap` (pinggiran hitam bercak ikut diisi, supaya tidak menjadi sumber
  isian yang gelap); `zona_kain.hanya_posisi` (kelas kain menurut warna dimatikan: bintik cokelat gelap di kulit
  bukan kain); `normal_garis` dengan `--normal-masuk` dan `--normal-keluar` (garis tajam tipis di normal map kulit
  diisi ulang dari sekitarnya).
- `kepala_ringan.py` (blok `<blok>.kepala.ringan`): `segitiga_telinga` (jatah segitiga daun telinga pada decimate,
  tahap sendiri di antara wajah dan sisanya) dan `telinga.aktif` (texel di kotak telinga yang hasil bake-nya jauh
  lebih gelap dari warna titik terdekat mesh asli diganti warna itu).
- `sambung_kepala.py` (blok `<blok>.sambung`): `tengkuk_dulu` (tengkuk kepala dirapikan sebelum cincin kepala
  diukur); `gabung_cincin: "luar"` (verteks cincin yang rapat digabung di verteks terluar); `tali.bentuk: "pita"`
  (penampang pipih yang mengikuti kemiringan kulit) dan `tali.bahan` (penutup sambungan menjadi bahan kedua dengan
  nama itu, `metallic` dan `roughness` tetap, bukan warna di atlas); `kalung_gantung` (objek mesh terpisah: tabung
  yang rebah di kulit, bagian depan diparametrikan menurut x dari bentuk di gambar konsep, bagian samping dan
  belakang melingkar di pangkal leher); `--keluar` pada tahap `tempat` (GLB sementara yang belum disambung).
- `sambung_tekstur.py` (blok `<blok>.tekstur`): `zona_kain` (kain menurut posisi tidak dihitung sebagai kulit badan
  dan tidak ikut digeser warnanya).
- `tekstur_pasang.py`: memakai mesh terbesar dan mengekspor semua mesh (kalung gantung ikut terbawa).
- `banding_karakter.py` (baru): dua GLB berdiri berdampingan pada skala yang sama dari depan, samping, dan badan
  atas; mencetak tinggi, puncak bahu, jarak antarsendi bahu, dan lebar bahu terluar.

### Jebakan yang ditemukan

- Garis gelap panjang di lengan bukan dari base color tetapi dari normal map: mesh Tripo bertekuk di batas bercak
  kelabu dan tekukan itu ikut ter-bake. Render tanpa tekstur tidak menunjukkannya; periksa normal map.
- Tepi telinga gelap bergerigi bukan soal warna bake: daun telinga ikut diruntuhkan bersama rambut pada decimate
  sampai compang-camping, dan rambut di belakangnya tampak di sela-selanya.
- Kain cokelat dan sabuk merah berona sama dengan kulit. Tanpa zona kain, rata-rata kulit badan terhitung terlalu
  gelap (L 109, seharusnya 132) dan seluruh badan digeser menjadi pucat.
- Ujung helai rambut di tengkuk ikut terpotong bidang potong kepala. Kalau tengkuk dirapikan sesudah cincin diukur,
  leher badan dibentuk ke penampang yang salah (selisih tebal 11 persen).
- Badan berbahu tinggi (otot bahu naik sampai pangkal leher): sinar mendatar dari sumbu leher pada tinggi beberapa
  cm di bawah sambungan mendarat jauh di atas otot bahu. Kalung yang jalurnya dicari dengan sinar seperti itu
  melebar sampai 25 cm; bagian samping dan belakang harus dinaikkan cepat ke tepat di bawah pita.
- Penggantian tekstur bawah dagu memotong janggut kalau batas arah normalnya longgar; perketat `bawah_dagu.nz_*`,
  jangan menurunkan batas tinggi (menyisakan blok gelap di bawah dagu).
- Nilai negatif untuk argumen di belakang `--` Blender ditulis dengan tanda sama dengan (`--arah=-1,0,0`).

## Pengulangan Wijaya, bagian 2: animasi (17 November 2026)

```bash
# gabung: kerangka dan bobot awal dari idle.fbx (With Skin), geometri dan bahan dari model diam, animasi lain dari mixamo/
B tools/blender/gabung_animasi.py -- --model aset-mentah/wijaya-utuh.glb --rig aset-mentah/mixamo-wijaya-ulang/idle.fbx --mixamo aset-mentah/mixamo --json tools/blender/wajah.json --blok wijaya_ulang --keluar aset-mentah/wijaya-ulang-animasi.glb
# pratinjau dan ukuran (lembar ke aset-mentah/pratinjau/wijaya-ulang-anim-*.png, angka ke <blok>.animasi.ukur)
B tools/blender/pratinjau_animasi.py -- --masuk aset-mentah/wijaya-ulang-animasi.glb --json tools/blender/wajah.json --blok wijaya_ulang --keluar aset-mentah/pratinjau --nama wijaya-ulang
# setelah pratinjau disetujui
cp public/models/wijaya.glb aset-mentah/arsip/wijaya-lama.glb && cp aset-mentah/wijaya-ulang-animasi.glb public/models/wijaya.glb
```

### `gabung_animasi.py` dengan `--blok`

Dengan `--blok <nama>` (dan `--rig`), skrip memakai cara baru dan membaca angkanya dari `<nama>.animasi` di
wajah.json, sehingga karakter lain (prajurit) cukup punya bloknya sendiri. Tanpa `--blok`, cara lama untuk model
Wijaya lama tetap jalan. Yang dibaca dari blok: `tempat` (bidang potong leher), `abu.zona_kain` (zona kain menurut
posisi), dan `animasi`:

- `bagian`: bobot per bagian. Bobot awal disalin dari verteks terdekat mesh di `--rig`, lalu dibatasi:
  - kepala dan leher: gradasi Neck ke Head di antara kedua bidang potong (`leher_bawah_m`, `leher_atas_m`);
  - kain dan sabuk: Hips `kain_hips` di sendi paha, turun ke `kain_hips_tepi` di tepi bawah; sisanya Spine di
    pinggang dan UpLeg kiri-kanan dicampur menurut posisi samping (`kain_tengah_m` = setengah lebar campuran);
    dihaluskan `kain_halus_iterasi` kali;
  - kulit kaki di dalam zona kain: dicari menurut jarak ke sumbu paha (`kaki_jari_longgar` kali jari-jari kaki
    tepat di bawah zona, paling tinggi `kaki_naik_maks_m` di atas tepi bawah zona) dan keterhubungan lewat tepi
    mesh dengan kaki di bawah zona; hanya UpLeg dan Leg, gradasi di lutut selebar `lutut_gradasi_m`;
  - `kain_dalam`: verteks kain di dekat sumbu paha (dalam `jarak_m`) dan di dekat tepi kulit (dalam `naik_m`)
    memudar ke UpLeg sisinya;
  - lengan bawah dan tangan hanya rantai lengan sisinya; lengan atas boleh ditambah Spine1 dan Spine2; aturan
    lengan hanya berlaku di atas tepi bawah zona kain;
  - bahan berawalan `penutup_awalan` (pita emas) menyalin bobot kulit terdekat; `mesh_tambahan` (objek lain,
    misalnya kalung gantung) mendapat bobot terinterpolasi dari segitiga kulit terdekat, dibatasi daftar `tulang`;
  - `bahu_halus`: penghalusan bobot di sekitar sendi bahu, bawaan mati (`iterasi` 0);
  - paling banyak `pengaruh_maks` (4) tulang per verteks.
- `koreksi_lengan`: untuk tiap klip di `klip`, rotasi tetap LeftArm (ke depan dan membuka, paling banyak
  `lengan_maks_derajat` per sumbu) dan pelurusan siku (paling banyak `siku_maks_derajat`) dicari di kisi, dari
  yang terkecil, sampai sendi tangan berjarak `sasaran_m` dari permukaan badan pada bingkai kontak dan
  `terkecil_m` sepanjang klip. Kalau tidak ada yang memenuhi, dipakai yang paling mendekati dengan denda untuk
  rotasi besar (`cadangan_denda_per_derajat`) dan hasilnya ditandai `sasaran_tercapai: false`.
- `koreksi_rotasi_derajat` dan `koreksi_klip`: koreksi rotasi tetap untuk semua aksi atau per klip (manual).
- Hasil (potongan klip, bingkai kontak, koreksi lengan, sudut leher, jumlah verteks per bagian, ukuran berkas)
  ditulis ke `<blok>.animasi.hasil`.

### `pratinjau_animasi.py` (Blender, baru)

Merender GLB beranimasi dan mengukurnya, untuk dinilai sebelum dipasang ke game. Lembar (`--lembar`, bawaan semua):
`serang` (kontak serang-1 sampai 3, depan dan samping), `gerak` (tangkis, lari, jongkok-jalan), `lebar`
(kuda-kuda terlebar), `kaki` (dua lembar pinggang ke kaki: depan, samping, belakang), `bahu` (dari belakang pada
kontak serang), `lain`, `kalung` (bingkai kalung paling dalam saat membungkuk), `dialog` (sudut kamera dialog dan
perbesaran wajah). Ukuran per klip (`--klip-ukur` membatasi; `--hanya-ukur` tanpa render; `--tanpa-json` tidak
menulis ke wajah.json): jarak sendi tangan kiri ke badan, tembus tangan ke kain, jarak kalung ke kulit, regangan
tepi kain, lebar kuda-kuda, dan lingkar lutut serta paha terhadap pose istirahat (cincin bahan yang sama: irisan
mendatar pose istirahat lewat kulit kaki, diukur ulang tiap bingkai; nilai terkecil dan pada kuda-kuda terlebar).
Bingkai di GLB mulai dari 0, jadi kontak = awal aksi + `kontak_baru` - 1.

### Pilihan baru `abu_isi.py`

- `abu.isi_halus`: isian bercak diganti rata-rata Gauss beberapa skala (`sigma_px`: skala besar sebagai dasar,
  skala kecil di dekat tepi) dari warna kulit baik di pulau UV yang sama, bukan hasil rambatan yang ikut membawa
  bintik gelap dari tepi isian; sumber yang lebih gelap dari median dikurangi `selisih_L_maks` tidak dipakai.
- `abu.pucat`: kulit pucat keabuan (kroma di bawah `rasio` kali kroma kulit median) di tangan (di luar
  `x_abs_min_m`) dan kaki (di bawah `z_maks_m`) ikut dianggap bercak.

### Jebakan yang ditemukan

- Aturan bobot menurut jarak dari sumbu badan (lengan atas) menangkap telapak kaki, yang sama jauhnya; beri
  syarat tinggi.
- Hips rata untuk seluruh kain membuat kain kaku dan menarik kulit dari tepi kain ke lutut; pakai gradasi ke
  tepi bawah.
- Badan Tripo berkain tidak punya paha di dalam kain: kaki menyatu dengan lapisan dalam kain. "Lingkar paha
  tengah" tidak bisa diukur; yang ada hanya lingkar kulit tepat di bawah tepi kain.
- Cincin kaki teratas (di bawah bayangan kain) bertekstur gelap, jadi pemisahan kulit dan kain dengan warna saja
  meninggalkan sebagian cincin di aturan kain.
- Menghaluskan bobot kulit di sekitar bahu membuat kalung gantung tenggelam (0,8 mm tanpa penghalusan, 5 mm pada
  24 iterasi, 14 mm pada 40). Dugaan, belum dibuktikan: kulit dan kalung terpotong ke empat tulang yang berbeda.
- Gelembung bahu pada klip serang tidak berasal dari koreksi lengan maupun pembatasan bobot; uji dengan mematikan
  keduanya sebelum mengubah sudut.
- Jarak bertanda ke permukaan badan tidak andal untuk mesh terbuka; tanda hanya dipercaya bila titiknya dekat
  (di bawah 6 cm) dan jelas di balik muka.
