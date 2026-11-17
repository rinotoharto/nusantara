# Prompt aset: olah senjata dan perahu dari Tripo

Dijalankan SETELAH prajurit Kediri dan Wijaya selesai (keduanya sudah di-commit dan dirig). Salin seluruh isi di bawah garis ke sesi Claude Code baru di folder ini.

---

Baca CLAUDE.md, aset-mentah/README.md (bagian Keris, Keris raja, Tombak, Warangka, Perahu nelayan), tools/blender/README.md, dan skrip tools/blender/optimasi_karakter.py serta abu_isi.py.

Tujuan: mengolah lima benda mentah dari Tripo menjadi aset game, lalu memasang keris, warangka, dan tombak ke karakter. Satu skrip umum tools/blender/optimasi_benda.py (argumen: berkas masuk, keluar, target segitiga, ukuran tekstur, panjang sebenarnya dalam meter, sumbu panjang, titik pusat), dengan angka per benda di tools/blender/benda.json.

| Benda | Masuk | Keluar | Segitiga | Tekstur | Ukuran | Titik pusat |
| --- | --- | --- | --- | --- | --- | --- |
| Keris | aset-mentah/keris-tripo.glb | public/models/keris.glb | 2.000 | 1024 | panjang total 45 cm | tengah genggaman hulu |
| Keris raja | aset-mentah/keris-raja-tripo.glb | public/models/keris-raja.glb | 2.500 | 1024 | panjang total 48 cm | tengah genggaman hulu |
| Warangka | aset-mentah/warangka-tripo.glb | public/models/warangka.glb | 1.000 | 512 | tinggi 42 cm (bilah 35 cm masuk) | lubang bilah di atas |
| Tombak | aset-mentah/tombak-tripo.glb | public/models/tombak.glb | 1.500 | 1024 | panjang 2,0 m | genggaman sepertiga dari bawah |
| Perahu | aset-mentah/perahu-tripo.glb | public/models/perahu.glb | 6.000 | 2048 | panjang lambung 7 m | tengah lambung di garis air |

Perbaikan per benda (rinciannya di aset-mentah/README.md):
- Semua: isi bercak putih atau abu-abu tanpa warna (sisi yang tidak terlihat di gambar sumber) dengan warna bahan di sekitarnya; roughness masuk akal per bahan (besi 0,45 sampai 0,6 metallic 0,7; kayu 0,75 metallic 0; emas 0,35 metallic 1; kuningan 0,4 metallic 1).
- Keris: bercak di sisi dan bawah hulu.
- Keris raja: warnai ulang hulu per bagian (kayu cokelat gelap, aksen emas metalik), bersihkan garis jingga di tepi ujung bilah dengan warna pamor sekitar, turunkan saturasi merah dan emas mendak dan beri metallic.
- Warangka: bercak putih di bawah bagian atas; turunkan saturasi dan kecerahan ke cokelat jati gelap; pastikan gandar tetap pipih.
- Tombak: mata tombak bersirip empat dipipihkan ke sekitar 25 persen ketebalan pada sumbu tegak lurus bilah; tutup besi bawah dikecilkan sekitar 30 persen.
- Perahu: bercak di bibir lambung, pelampung cadik sisi jauh, dan sisi bawah pelampung; tali tipis boleh dibuang kalau berantakan.

Pemasangan di game (hanya aktif dengan ?model=wijaya dan ?model=prajurit, kapsul tetap bawaan):
1. Keris di tulang RightHand Wijaya saat bertarung; warangka di pinggang kiri depan (ikut Hips atau Spine) dan keris tampil di dalam warangka saat tidak bertarung. Peralihan cabut dan sarung cukup pindah tulang saat masuk dan keluar mode bertarung.
2. Tombak di RightHand prajurit dan penjaga; orientasi sesuai animasi serang dan siaga.
3. Perahu menggantikan perahu balok di segmen pantai dan sinematik penyeberangan (dua perahu berdampingan).
4. Offset posisi dan rotasi genggaman disimpan di src/data/ (misalnya models.json), bukan di kode, supaya bisa disetel tanpa menyentuh kode.

Pratinjau: satu gambar per benda (samping dan tiga perempat) ke aset-mentah/pratinjau/benda-*.png, dan tangkapan layar game Wijaya memegang keris dalam pose siaga dan serang-3, prajurit memegang tombak dalam pose siaga dan serang. Tunggu saya cek sebelum commit. Laporkan ukuran tiap GLB (target total kelima benda di bawah 3 MB).

Aturan: rencana singkat dulu, tunggu persetujuan. Jangan menulis ke dalam /Applications/Blender.app. Hemat token. Commit: "Senjata dan perahu: optimasi Tripo dan pemasangan ke karakter".
