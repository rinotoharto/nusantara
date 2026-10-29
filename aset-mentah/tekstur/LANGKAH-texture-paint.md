# Rapikan sisa bercak dengan tangan (Texture Paint)

Sisa yang tidak diisi otomatis ada di `topeng-abu-tangan.png` (putih = perlu
tangan): pita abu-abu tipis di sepanjang batas kain pinggang dan gelang emas,
serta serpihan kecil di jari. Hanya base color yang disentuh; mesh dan UV tetap.

## 1. Buka

Dari akar repo, tanpa `-b` supaya jendela Blender terbuka:

```bash
/Applications/Blender.app/Contents/MacOS/Blender -P tools/blender/tekstur_buka.py -- --masuk public/models/wijaya.glb --basecolor aset-mentah/tekstur/wijaya-basecolor-abu.png --topeng aset-mentah/tekstur/topeng-abu-tangan.png
```

Model terbuka dalam mode Texture Paint dengan `wijaya-basecolor-abu.png`
terpasang di material. Kalau viewport masih polos, ubah shading viewport ke
Material Preview (tombol bola ketiga di kanan atas viewport).

Untuk melihat di mana sisa bercak: ubah satu area menjadi Image Editor
(Editor Type di pojok kiri atas area), pilih gambar `topeng-abu-tangan.png`
dari menu gambar. Area putih di situ adalah posisi UV yang perlu dirapikan;
di viewport 3D, carilah batas kain dan gelang.

## 2. Kuas Clone: salin kulit ke bercak

1. Di panel alat (kiri), pilih **Clone**. Di panel N (tekan N) tab Tool, atur
   Radius sekitar 15 sampai 30 px dan Strength 1,0.
2. **Ctrl+klik** pada kulit yang sehat di dekat bercak untuk menetapkan sumber
   (muncul penanda). Lalu kuaskan di atas bercak. Sumber ikut bergeser
   mengikuti kuas, jadi ambil sumber yang sejajar dengan arah bercak.
3. Untuk bercak di tepi kain, ambil sumber dari kulit tepat di sebelahnya
   supaya warna dan arah cahaya sama. Jangan menyeberang ke kain.

## 3. Kuas Smear: haluskan batas

Pilih **Smear**, Radius 10 sampai 20 px, Strength 0,3 sampai 0,5. Sapukan
melintang batas antara isian dan kulit asli sampai peralihannya tidak terlihat.
Jangan sapukan di tepi pulau UV (batas pulau terlihat sebagai garis di Image
Editor) karena warnanya bisa bocor ke pulau lain.

Kalau salah, Ctrl+Z. Kalau bercaknya di dalam lipatan yang sulit dicapai, cat
langsung di Image Editor (mode Paint di Image Editor, kuas yang sama).

## 4. Simpan

Di Image Editor pilih gambar `wijaya-basecolor-abu.png` (gambar yang dicat),
lalu **Image > Save As**, format PNG, simpan ke
`aset-mentah/tekstur/wijaya-basecolor-tangan.png`. Jangan menimpa berkas
sumber supaya langkah otomatis tetap bisa diulang.

## 5. Pasang ke GLB

```bash
/Applications/Blender.app/Contents/MacOS/Blender -b -P tools/blender/tekstur_pasang.py -- --masuk public/models/wijaya.glb --basecolor aset-mentah/tekstur/wijaya-basecolor-tangan.png --keluar public/models/wijaya.glb
```

Lalu cek cepat dengan render:

```bash
/Applications/Blender.app/Contents/MacOS/Blender -b -P tools/blender/wajah_render.py -- --masuk public/models/wijaya.glb --keluar aset-mentah/pratinjau/tangan-badan.png --json tools/blender/wajah.json --sudut badan
```

Setelah itu ekspor ulang FBX Mixamo (`tools/blender/ekspor_mixamo.py`) kalau
rig belum dibuat, atau jalankan ulang `gabung_animasi.py` kalau sudah.
