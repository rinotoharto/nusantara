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
