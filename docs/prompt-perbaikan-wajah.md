# Prompt aset: perbaikan wajah dan bercak tekstur Wijaya

Salin seluruh isi di bawah garis ke sesi Claude Code baru di folder ini (atau lanjutkan di sesi aset yang sedang berjalan).

---

Baca docs/prompt-aset-wijaya.md, aset-mentah/README.md, tools/blender/README.md, dan skrip tools/blender/optimasi_karakter.py. Urutan berubah: wajah dan tekstur diperbaiki dulu, baru Tahap C (Mixamo) dan D (game) dari prompt aset.

Kalau dua perbaikan Tahap B (bercak kain di paha, kulit terlalu mengkilap) belum selesai dan di-commit, selesaikan itu dulu.

Masalah tekstur yang tersisa, semuanya di base color model hasil optimasi (`public/models/wijaya.glb`, 2048):

1. Wajah meleleh: mata tidak simetris, hidung dan mulut kabur, ada bercak abu-abu di pipi dan leher.
2. Bercak abu-abu tanpa warna di tepi tangan dan jari, lengan bawah kiri, kaki, bahu, dan leher (bagian yang tidak terlihat di gambar sumber Tripo).

Sumber yang benar: gambar konsep `docs/referensi/wijaya-konsep-01.png` (1024 × 1536, tampak depan pose A, latar putih, wajah jelas).

Prinsip: hanya tekstur base color yang diubah. Mesh, UV, normal map, dan ukuran tidak berubah, sehingga rig dan animasi nanti tidak terpengaruh. Semua lewat skrip di `tools/blender/` yang bisa diulang, dengan angka penyesuaian di `tools/blender/wajah.json`. Simpan base color lama sebagai cadangan di `aset-mentah/tekstur/wijaya-basecolor-sebelum.jpg`. Buat rencana singkat dulu dan tunggu persetujuan; tiap tahap berhenti untuk saya cek gambar pratinjaunya.

## Tahap 1: penyelarasan wajah

1. Render model dari depan dengan kamera ortografis, kepala memenuhi bingkai, ke `aset-mentah/pratinjau/wajah-model-depan.png`.
2. Potong area kepala dari gambar konsep. Tentukan titik acuan di keduanya: pusat kedua mata, ujung hidung, sudut mulut, dagu, garis rambut. Kalau ada pustaka deteksi wajah yang mudah dipasang di Mac (misalnya mediapipe atau dlib lewat pip), pakai untuk mencari titik acuan otomatis; kalau tidak, cari dengan sederhana lalu simpan koordinatnya di wajah.json supaya bisa saya koreksi.
3. Hitung transformasi (geser, skala, sedikit putar) yang menyamakan titik acuan konsep ke titik acuan render model. Buat gambar tumpang (konsep 50 persen transparan di atas render model) ke `aset-mentah/pratinjau/wajah-tumpang.png`.
4. Berhenti dan tunjukkan gambar tumpang itu ke saya.

## Tahap 2: proyeksi wajah ke tekstur

1. Di Blender: kamera ortografis yang sama dengan Tahap 1, gambar konsep yang sudah diselaraskan dipasang sebagai sumber proyeksi dari kamera itu (UV kedua dari proyeksi kamera, atau modifier UV Project), lalu bake warna ke UV asli model, ke gambar baru 2048.
2. Topeng (mask) campuran: hanya permukaan kepala yang menghadap kamera. Bobot dari sudut normal terhadap arah kamera: penuh di bawah 35 derajat, memudar sampai 0 di 65 derajat, sehingga sisi wajah dan telinga memakai tekstur lama dan peralihannya halus. Batasi juga ke area kepala dan leher atas (di atas tulang selangka) supaya badan tidak ikut tertimpa.
3. Penyesuaian warna: samakan rata-rata dan sebaran warna kulit hasil proyeksi dengan kulit di sekitarnya pada tekstur lama (di ruang warna Lab), supaya tidak ada perbedaan warna di batas wajah. Sertakan juga sedikit kotoran dan pori dari tekstur lama di atas proyeksi (campur lembut), supaya wajah tidak terlihat lebih halus dari badan.
4. Gabungkan ke base color, isi celah di batas pulau UV (dilate 8 piksel) supaya tidak muncul garis jahitan.
5. Render pratinjau: depan dekat, tiga perempat dekat, samping dekat, dan seluruh badan, ke `aset-mentah/pratinjau/wajah-*.png`. Berhenti untuk saya cek.

## Tahap 3: bercak abu-abu

1. Deteksi otomatis di ruang UV: piksel abu-abu (saturasi rendah) yang berada di pulau UV kulit dan dikelilingi warna kulit. Simpan topengnya sebagai gambar supaya bisa saya lihat (`aset-mentah/tekstur/topeng-abu.png`).
2. Isi dengan warna kulit di sekitarnya: inpainting (misalnya OpenCV `inpaint` metode Telea) per pulau UV, lalu tambahkan sedikit derau dan pori dari kulit terdekat supaya tidak rata seperti cat.
3. Bagian yang menyentuh kain, gelang, atau tepi pulau UV jangan diisi otomatis; tandai saja di topeng terpisah untuk saya rapikan tangan.
4. Ekspor ulang `public/models/wijaya.glb` dengan base color baru (pakai ulang langkah ekspor dari optimasi_karakter.py), cetak ukuran, render pratinjau empat sudut plus dekat tangan dan kaki. Berhenti untuk saya cek.

## Tahap 4: panduan rapikan tangan dan commit

1. Tulis `aset-mentah/tekstur/LANGKAH-texture-paint.md`: cara membuka model di Blender, masuk mode Texture Paint, memakai kuas Clone untuk menyalin kulit ke sisa bercak, kuas Smear untuk menghaluskan batas, menyimpan gambar tekstur (Image → Save As ke `aset-mentah/tekstur/wijaya-basecolor-tangan.png`), dan satu perintah skrip untuk memasang tekstur hasil tangan itu dan mengekspor ulang GLB.
2. Tambahkan catatan di aset-mentah/README.md: apa yang diubah, dari sumber apa, dan angka di wajah.json.
3. Commit: "Perbaikan wajah dan bercak tekstur Wijaya". Setelah itu kita kembali ke Tahap C prompt aset.

Selesai berarti: wajah Wijaya dari dekat sesuai gambar konsep tanpa batas warna yang terlihat, bercak abu-abu yang jelas sudah hilang, mesh dan UV tidak berubah, dan GLB tetap di bawah 2 MB.
