# Prompt pengulangan Wijaya dengan standar karakter (17 November 2026)

Dua bagian. Bagian 1 dijalankan sekarang (sampai FBX Mixamo). Bagian 2 dijalankan setelah pengembang merig ulang di Mixamo dan mengunduh idle.

## Bagian 1: sambung kepala (tahap A sampai G)

```
Baca docs/standar-karakter.md dan ikuti seluruh prosedurnya untuk karakter wijaya.
Ini pengulangan: Wijaya sebelumnya gagal dengan cara potong di bawah dagu. Baca juga
bagian "Rencana pengulangan Wijaya" dan "Masalah animasi: lengan kiri" di
aset-mentah/README.md.

Bahan:
- Badan: aset-mentah/wijaya-tripo.glb (mentah Tripo).
- Kepala: aset-mentah/kepala-tripo.glb (nama lama, tanpa awalan wijaya-).
- Acuan: docs/referensi/wijaya-konsep-01.png (depan) dan wijaya-samping-01.png
  (samping). docs/referensi/wijaya-kepala-01-dari-tangkapan.png hanya potongan kecil
  dari tangkapan layar Tripo; pakai sebagai acuan wajah saja, bukan ukuran.
- JANGAN pakai public/models/wijaya.glb, wijaya-leher-rapi.glb,
  wijaya-sebelum-leher.glb, rapikan_leher.py, atau skrip proyeksi wajah_*.py.

Angka:
- Tinggi 1,70 m. Tokoh utama: badan sampai sekitar 15.000 segitiga total model.
- Tidak dirampingkan seramping prajurit; Wijaya harus tampak sedikit lebih tegap
  dari prajurit Kediri (bandingkan lebar bahu dengan prajurit-utuh.glb).
- Penutup sambungan: kalung emas tipis (bukan tali gelap), metallic 1, roughness
  sekitar 0,35, lebar sekitar 1 cm, mengikuti gambar konsep. Hapus kalung lama yang
  tercetak di tekstur dada.
- Pakai angka hasil prajurit di docs/standar-karakter.md (Catatan hasil) sebagai
  acuan: selisih penampang cincin di bawah 10 persen, 2 cincin perantara, sumbu
  leher di bawah 15 derajat, kepala sekitar 1/7,5 tinggi badan.
- Simpan angka di blok baru "wijaya_ulang" di tools/blender/wajah.json; blok lama
  jangan dihapus.

Berkas keluaran: aset-mentah/wijaya-utuh.glb dan
aset-mentah/mixamo-wijaya-ulang/wijaya-untuk-mixamo.fbx + LANGKAH.md.
Jangan menimpa public/models/wijaya.glb di bagian ini (versi lama tetap aktif di
game sampai bagian 2 disetujui).

Rencana singkat dulu. Berhenti di CEK C dan CEK F dengan gambar (termasuk tumpang
siluet konsep depan dan samping, dan perbandingan berdiri berdampingan dengan
prajurit-utuh.glb), lalu tahap G dan commit. Kalau ada pelajaran baru yang belum ada
di standar, tulis di laporan; jangan ubah docs/standar-karakter.md.
```

## Bagian 2: animasi dan masuk game (setelah Mixamo)

Sebelumnya pengembang: unggah wijaya-untuk-mixamo.fbx ke Mixamo, pasang penanda, unduh Breathing Idle With Skin ke aset-mentah/mixamo-wijaya-ulang/idle.fbx.

```
Lanjutkan pengulangan Wijaya tahap 5 di docs/standar-karakter.md.
Kerangka dan mesh dari aset-mentah/mixamo-wijaya-ulang/idle.fbx; animasi lain dari
aset-mentah/mixamo/ (Without Skin).

Perbaiki sekaligus tiga masalah lama (rincian di aset-mentah/README.md):
1. Serat kain ke tangan: transfer bobot dibatasi per bagian (kain dan sabuk hanya
   Hips/Spine/UpLeg, Hips 85-90 persen; lengan hanya rantai lengan; kalung dari Neck
   dan Spine2).
2. Kain pecah pada kuda-kuda lebar: haluskan bobot kain, cek bingkai terlebar
   serang-1 dan tangkis.
3. Lengan kiri menempel ke dada saat serang/tangkis: diagnosis dulu (bandingkan
   pratinjau Mixamo dengan hasil gabung), lalu koreksi rotasi LeftArm/LeftForeArm/
   LeftHand atau lapisan animasi bertopeng, sampai tangan kiri sekitar 15-20 cm di
   depan badan tanpa menembus.
Koreksi Neck kalau leher condong saat animasi.

Pratinjau sebelum memasang: bingkai kontak serang-1/2/3, tangkis, lari, jongkok-jalan,
dari depan dan samping, plus wajah di sudut kamera dialog. Tunggu persetujuan saya,
lalu ganti public/models/wijaya.glb (cadangkan versi lama ke
aset-mentah/arsip/wijaya-lama.glb), uji di game dengan ?model=wijaya, perbarui
README, commit.
```
