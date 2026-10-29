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
  `--format-normal png|jpeg` (bawaan jpeg, karena PNG 2048 berukuran 4 MB).
  Bake pertama di Mac memakan sekitar 3 menit untuk kompilasi kernel Metal;
  bake berikutnya hanya beberapa detik.
- `gabung_animasi.py` (Tahap D): gabungkan karakter berkulit Mixamo dan
  animasi FBX menjadi satu GLB beranimasi.
