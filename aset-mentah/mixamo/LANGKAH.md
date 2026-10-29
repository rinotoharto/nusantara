# Langkah Mixamo untuk Wijaya

Mixamo (mixamo.com, akun Adobe gratis) tidak bisa dijalankan dari skrip, jadi
bagian ini dikerjakan dengan tangan. Semua hasil disimpan di folder ini.

Berkas yang diunggah: `wijaya-untuk-mixamo.fbx` (dibuat oleh
`tools/blender/ekspor_mixamo.py` dari `public/models/wijaya.glb`, tanpa Draco,
tekstur tersemat).

## 1. Unggah dan rig

1. Masuk ke mixamo.com, klik **Upload Character**, pilih
   `wijaya-untuk-mixamo.fbx`. Tunggu pratinjau muncul; kalau model terlihat
   rebah atau sangat kecil, pakai tombol putar di layar pratinjau sampai
   berdiri tegak menghadap kamera.
2. Di layar **Auto-Rigger**, letakkan penanda (model berpose A, lengan agak
   turun, tidak apa-apa):
   - **Chin** (dagu): tepat di bawah bibir.
   - **Wrists** (pergelangan tangan): di sendi antara lengan bawah dan telapak,
     kiri dan kanan.
   - **Elbows** (siku): di tengah lipatan siku.
   - **Knees** (lutut): di tengah tempurung lutut.
   - **Groin** (selangkangan): di titik pertemuan kedua paha, di bawah ikat
     pinggang.
   - Biarkan **Use Symmetry** menyala.
3. **Skeleton LOD**: pilih **Standard Skeleton (65)**. Jari tidak perlu;
   mesh jari hasil pengurangan poligon memang kasar.
4. Klik Next, tunggu rig selesai (sekitar 1 sampai 2 menit), cek pratinjau
   gerak. Kalau siku atau lutut menekuk aneh, Back dan geser penanda.
   Klik Finish.

## 2. Unduh animasi

Cari tiap nama di kolom pencarian, klik animasinya, lalu **Download**.
Pengaturan unduh:

- **Format**: FBX Binary (.fbx).
- **Skin**: **With Skin** hanya untuk Idle; semua yang lain **Without Skin**.
- **Frames per Second**: 30.
- **Keyframe Reduction**: none.
- Untuk animasi gerak (Walking, Running, Sneak Walk) centang **In Place** di
  panel kanan sebelum mengunduh, karena perpindahan dilakukan kode game.
  Biarkan slider lain di nilai bawaan.

Simpan dengan nama berikut (skrip Tahap D mencari nama ini):

| Cari di Mixamo | Nama berkas | Aksi di game |
| --- | --- | --- |
| Idle | `idle.fbx` (With Skin) | diam |
| Walking | `jalan.fbx` | jalan |
| Running | `lari.fbx` | lari |
| Sneak Walk | `jongkok-jalan.fbx` | jongkok berjalan |
| Crouch Idle | `jongkok-diam.fbx` | jongkok diam |
| Sword And Shield Slash | `serang.fbx` | serang ringan (sementara) |
| Sword And Shield Block | `tangkis.fbx` | tangkis |
| Sword And Shield Dodge atau Standing Dodge Backward | `hindar.fbx` | hindar |
| Sword And Shield Impact atau Hit Reaction | `terkena.fbx` | terpukul |
| Sword And Shield Death atau Dying | `mati.fbx` | mati |

Catatan:
- Kalau nama persis tidak ada, pilih yang paling mirip dan tulis nama aslinya
  di bagian "Catatan unduhan" di bawah supaya tercatat.
- Beberapa animasi punya varian kiri atau kanan; ambil satu saja.
- Untuk Block, ambil yang berupa sikap menahan (bukan reaksi kena saat
  menahan) supaya bisa diputar berulang selama tombol ditahan.
- Hasil: 10 berkas FBX di folder ini plus `wijaya-untuk-mixamo.fbx`.

## 3. Selesai

Beri tahu di sesi Claude Code bahwa unduhan selesai. Tahap D menggabungkan
semuanya dengan `tools/blender/gabung_animasi.py`.

## Catatan unduhan

(Isi di sini kalau ada nama animasi yang berbeda dari tabel atau masalah saat
rig.)
