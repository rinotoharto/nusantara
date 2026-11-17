# Langkah Mixamo untuk Wijaya (pengulangan)

Berkas yang diunggah: `wijaya-untuk-mixamo.fbx` (dibuat `tools/blender/ekspor_mixamo.py` dari
`aset-mentah/wijaya-utuh.glb`; tinggi 1,70 m, tekstur tersemat). Isinya dua mesh:

- `wijaya-ulang`: badan dan kepala tersambung, 14.586 segitiga, dua bahan (`karakter` bertekstur dan
  `emas_kalung` untuk pita emas di leher);
- `kalung_gantung`: kalung emas yang menggantung di dada, 400 segitiga, bahan `emas_kalung`.

Yang dikerjakan dengan tangan hanya dua: rig, lalu unduh satu animasi With Skin. Animasi lain tidak perlu
diunduh lagi: berkas Without Skin di `aset-mentah/mixamo/` dipakai ulang, karena kerangka standar Mixamo
memakai nama tulang yang sama. Rig lama di `aset-mentah/mixamo/` tidak dipakai untuk mesh ini (proporsi leher
dan kepala berubah).

## 1. Rig

1. mixamo.com, **Upload Character**, pilih `wijaya-untuk-mixamo.fbx`. Kalau model rebah atau sangat kecil,
   putar di layar pratinjau sampai berdiri tegak menghadap kamera.
2. Penanda **Auto-Rigger** (Use Symmetry menyala):
   - dagu: di ujung bawah dagu, bukan di pita emas (pita ada sekitar 2 cm di bawah dagu);
   - pergelangan: di sambungan lengan bawah dan telapak;
   - siku: di lekukan siku (cenderung lebih rendah dari dugaan, sejajar atas sabuk);
   - lutut: di tengah tempurung lutut;
   - selangkangan: di garis tengah, sekitar separuh tinggi badan.
3. **Skeleton LOD**: Standard Skeleton (65).
4. Cek pratinjau gerak sebelum Finish: siku dan lutut menekuk wajar, pita emas dan kalung gantung ikut
   leher dan dada. Kalung gantung boleh sedikit menembus kulit di pratinjau Mixamo; bobotnya ditata ulang di
   tahap animasi. Kalau ada yang aneh, tulis di "Catatan" di bawah.

## 2. Unduh

Hanya **Breathing Idle**, **With Skin**: Sway 20, Breathing 40, Overdrive 40, Character Arm-Space 55;
FBX Binary, 30 fps, Keyframe Reduction none. Simpan sebagai `aset-mentah/mixamo-wijaya-ulang/idle.fbx`.

Sesudah mengunduh, tidak perlu membuka berkasnya; sesi berikutnya yang memeriksa apakah kedua mesh dan bahan
`emas_kalung` masih utuh.

## 3. Selesai

Beri tahu di sesi Claude Code berikutnya bahwa `idle.fbx` sudah ada, lalu jalankan Bagian 2 di
`docs/prompt-wijaya-ulang.md` (animasi dan masuk game). `public/models/wijaya.glb` yang lama tetap aktif di
game sampai Bagian 2 disetujui.

## Yang harus dicek di tahap animasi

Rincian masalah lama ada di `aset-mentah/README.md`, bagian "Masalah animasi":

- Kain: pada pose A tangan menggantung di samping kain, jadi bobot kain bisa ikut tulang tangan (serat
  gelap dari tangan ke kain) dan kain bisa pecah pada kuda-kuda lebar. Kain dan sabuk hanya dari Hips,
  Spine, dan UpLeg, dengan Hips 85 sampai 90 persen.
- Lengan kiri saat serang dan tangkis: klip Sword And Shield menekuk tangan kiri ke dada.
- Pita emas dan kalung gantung: bobot dari Neck dan Spine2 saja. Kalung gantung adalah objek terpisah;
  `gabung_animasi.py` selama ini mengambil satu mesh terbesar dan mengenali kalung lewat nama bahan berawalan
  `emas`, jadi perlu disesuaikan supaya objek `kalung_gantung` ikut terbawa.
- Leher: cek Neck saat idle dan lari; pose istirahatnya sudah tegak (sumbu leher 8,5 derajat).
- Bahan `emas_kalung` harus tetap metallic 1 dan roughness 0,35 setelah lewat Mixamo; di game logam penuh
  butuh pantulan lingkungan (`src/character/model-wijaya.ts` sudah memasangnya untuk bahan logam tanpa
  tekstur metallic).

## Catatan

(Isi di sini: pengaturan yang berbeda dari di atas, atau masalah saat rig.)
