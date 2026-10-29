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
  Argumen: berkas masuk, berkas keluar, target segitiga, ukuran tekstur.
- `gabung_animasi.py` (Tahap D): gabungkan karakter berkulit Mixamo dan
  animasi FBX menjadi satu GLB beranimasi.
