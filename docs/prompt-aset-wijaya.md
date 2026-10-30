# Prompt aset: Wijaya dari Tripo ke game

Salin seluruh isi di bawah garis ke sesi Claude Code baru di folder ini.

---

Baca CLAUDE.md, docs/gdd.md (Teknologi: target poligon dan tekstur; Daftar aset), dan docs/catatan-sprint.md (sprint 1 untuk Pemain dan kamera, sprint 2 untuk pose kapsul saat bertarung).

Kita mencoba alur aset pertama sebelum tahap aset resmi: model Wijaya hasil Tripo (image-to-3D H2.5) sudah ada di `public/models/wijaya.glb`. Isinya (sudah diperiksa):

- 12,7 MB, satu mesh, 226.932 segitiga, 123.306 verteks, tanpa rig dan animasi.
- Tinggi dinormalisasi 1,0 m (lebar 0,55 m, tebal 0,19 m), titik pusat di kaki.
- Tiga tekstur 4096 × 4096: base color (JPEG), metallic-roughness (JPEG), normal (PNG).
- Ekstensi `KHR_materials_volume` dan `FB_ngon_encoding`.
- Masalah yang diketahui: tekstur wajah meleleh; bercak abu-abu tanpa warna di tepi tangan, jari, kaki, bahu, dan leher.

Target GDD: karakter utama 10.000 sampai 20.000 segitiga, tekstur maksimal 2048, GLB dengan Draco, total di bawah 3 MB.

Prinsip: prototipe tetap memakai kapsul secara bawaan. Model hanya muncul dengan parameter `?model=wijaya` di URL, supaya playtest tidak terganggu kalau ada yang rusak. Buat rencana singkat dulu, tunggu persetujuan, lalu tiap tahap satu commit setelah saya cek.

## Tahap A: rapikan berkas dan siapkan Blender

1. Pindahkan berkas mentah ke `aset-mentah/wijaya-tripo.glb` (folder baru, berkas mentah tidak ikut dibangun ke Pages). Tambahkan `aset-mentah/README.md` berisi asal setiap berkas: Wijaya, Tripo H2.5, dari gambar konsep `docs/referensi/wijaya-konsep-01.png` (ChatGPT), tanggal, lisensi Tripo akun gratis (cek dan catat).
2. Cek apakah Blender terpasang (`/Applications/Blender.app/Contents/MacOS/Blender --version`). Kalau belum, beri tahu saya cara memasangnya dan berhenti. Semua pekerjaan Blender dijalankan dari skrip Python di `tools/blender/` dengan `blender -b -P`, bukan dengan tangan, supaya bisa diulang.
3. Commit: "Aset mentah Wijaya dan folder skrip Blender".

## Tahap B: optimasi untuk game

Skrip `tools/blender/optimasi_karakter.py` dengan argumen berkas masuk, berkas keluar, target segitiga, ukuran tekstur:

1. Impor GLB, gabungkan verteks berdekatan, hapus verteks lepas, perbaiki normal.
2. Kurangi menjadi sekitar 15.000 segitiga (modifier Decimate, mode Collapse). Sebelum mengurangi, bake detail mesh tinggi ke normal map baru (high-to-low) kalau waktunya wajar di Mac; kalau tidak, pakai normal map Tripo yang ada dan catat bedanya.
3. Skala ke tinggi 1,7 m (sesuai `TINGGI_PEMAIN`), titik pusat di antara kedua kaki di lantai, menghadap +Z atau sesuai arah hadap pemain di `player.ts`.
4. Tekstur: base color dan normal diperkecil ke 2048, metallic-roughness ke 1024 (atau buang dan pakai nilai tetap roughness 0,8 metallic 0 kalau isinya hampir rata; cek dulu). Buang `KHR_materials_volume`.
5. Ekspor `public/models/wijaya.glb` dengan Draco. Cetak ringkasan: segitiga, ukuran berkas, ukuran tekstur.
6. Render pratinjau 4 sudut (depan, samping, belakang, tiga perempat) ke `aset-mentah/pratinjau/wijaya-*.png` supaya saya bisa membandingkan sebelum dan sesudah.
7. Commit: "Optimasi model Wijaya untuk web".

## Tahap C: rig dan animasi (Mixamo, langkah manual saya)

Mixamo tidak bisa dijalankan dari skrip. Siapkan dan pandu:

1. Skrip mengekspor versi FBX tanpa Draco ke `aset-mentah/mixamo/wijaya-untuk-mixamo.fbx` (tekstur tersemat).
2. Tulis langkah untuk saya di `aset-mentah/mixamo/LANGKAH.md`: unggah FBX ke mixamo.com, letakkan penanda dagu, pergelangan, siku, lutut, selangkangan; pilih skeleton standard; lalu unduh animasi berikut sebagai FBX "Without Skin" kecuali yang pertama "With Skin": Idle (dengan kulit), Walking, Running, Sneak Walk (jongkok), Crouch Idle, Sword and Shield Slash (untuk serang ringan sementara), Block, Dodge, Hit Reaction, Death. Simpan semua di `aset-mentah/mixamo/`.
3. Berhenti dan tunggu saya selesai mengunduh.

## Tahap D: gabung animasi dan pasang di game (setelah saya selesai Mixamo)

1. Skrip `tools/blender/gabung_animasi.py`: impor karakter berkulit, tambahkan semua animasi sebagai aksi bernama (idle, jalan, lari, jongkok-jalan, jongkok-diam, serang, tangkis, hindar, terkena, mati), ekspor GLB dengan Draco ke `public/models/wijaya.glb`. Ringkasan ukuran.
2. Di game, dengan `?model=wijaya`: muat GLB (GLTFLoader + DRACOLoader dengan decoder di `public/draco/`), ganti mesh kapsul pemain dengan model, `AnimationMixer` memilih aksi dari status Pemain dan PemainTempur yang sudah ada (bebas diam/jalan/lari, jongkok, serang, tangkis, hindar, terpukul, mati), peralihan crossfade 0,15 detik. Keris balok tetap ditempel ke tulang tangan kanan untuk sementara. Kapsul tabrakan tetap sama.
3. Ukur: fps dengan model aktif, ukuran unduhan, waktu muat. Laporkan.
4. Tambahkan bagian "Aset 1: Wijaya" ke docs/catatan-sprint.md: alur dari Tripo ke game, angka, masalah tekstur yang belum diperbaiki (wajah, bercak abu-abu), dan keputusan.
5. Commit: "Model Wijaya beranimasi di game (opsional lewat ?model=wijaya)".

Yang tidak dikerjakan di sini: perbaikan wajah dan bercak tekstur (sesi berikutnya, dengan proyeksi dari gambar konsep), keris sebagai model sendiri, dan pengikut.

Selesai berarti: dengan `?model=wijaya`, Wijaya 3D berjalan, berlari, berjongkok, dan bertarung dengan animasi Mixamo di misi 3; tanpa parameter itu, game sama persis seperti sebelumnya.
