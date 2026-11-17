# Langkah Mixamo untuk prajurit Kediri

Berkas yang diunggah: `prajurit-untuk-mixamo.fbx` (dibuat `tools/blender/ekspor_mixamo.py` dari
`aset-mentah/prajurit-utuh.glb`; satu mesh, 14.107 segitiga, tinggi 1,68 m, tekstur tersemat).

Yang dikerjakan dengan tangan hanya dua: rig, lalu unduh satu animasi With Skin. Animasi lain tidak perlu
diunduh lagi: berkas Without Skin di `aset-mentah/mixamo/` (milik Wijaya) dipakai ulang, karena kerangka
standar Mixamo memakai nama tulang yang sama.

## 1. Rig

1. mixamo.com, **Upload Character**, pilih `prajurit-untuk-mixamo.fbx`. Kalau model rebah atau sangat kecil,
   putar di layar pratinjau sampai berdiri tegak menghadap kamera.
2. Penanda **Auto-Rigger** (Use Symmetry menyala):
   - dagu: di ujung bawah dagu, bukan di tali leher;
   - pergelangan: di sambungan lengan bawah dan telapak;
   - siku: di lekukan siku (cenderung lebih rendah dari dugaan, sejajar atas sabuk);
   - lutut: di tengah tempurung lutut;
   - selangkangan: di garis tengah, sekitar separuh tinggi badan.
3. **Skeleton LOD**: Standard Skeleton (65).
4. Cek pratinjau gerak sebelum Finish: siku dan lutut menekuk wajar, tali leher ikut leher saat kepala
   bergerak. Kalau ada yang aneh, tulis di "Catatan" di bawah.

## 2. Unduh

Hanya **Breathing Idle**, **With Skin**: Sway 20, Breathing 40, Overdrive 40, Character Arm-Space 55;
FBX Binary, 30 fps, Keyframe Reduction none. Simpan sebagai `aset-mentah/mixamo-prajurit/idle.fbx`.

## 3. Selesai

Beri tahu di sesi Claude Code berikutnya bahwa `idle.fbx` sudah ada. Sesi itu menjalankan
`tools/blender/gabung_animasi.py` (kerangka dan kulit dari `idle.fbx`, animasi dari `aset-mentah/mixamo/`)
dan memasang prajurit ke game.

## Yang harus dicek di tahap animasi

Masalah yang muncul di Wijaya kemungkinan muncul juga di sini (lihat `aset-mentah/README.md`, bagian
"Masalah animasi"):

- Kain: pada pose A tangan menggantung di samping kain, jadi bobot kain bisa ikut tulang tangan (serat
  gelap dari tangan ke kain) dan kain bisa pecah pada kuda-kuda lebar. Kain dan sabuk hanya dari Hips,
  Spine, dan UpLeg, dengan Hips 85 sampai 90 persen.
- Lengan kiri saat serang dan tangkis: klip Sword And Shield menekuk tangan kiri ke dada.
- Tali leher: bobot dari Neck dan Spine2 saja.
- Leher: cek Neck saat idle dan lari; pose istirahatnya sudah tegak (sumbu leher 10 derajat).

## Catatan

(Isi di sini: pengaturan yang berbeda dari di atas, atau masalah saat rig.)
