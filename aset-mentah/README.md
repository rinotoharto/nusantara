# Aset mentah

Berkas sumber sebelum dioptimasi untuk game. Folder ini tidak ikut dibangun ke
Pages (Vite hanya menyalin `public/`). Hasil optimasinya ada di `public/models/`.

Setiap berkas dicatat di sini: asal, tanggal, lisensi, dan masalah yang diketahui.

## wijaya-tripo.glb

- Tokoh: Raden Wijaya, karakter utama.
- Alat: Tripo (tripo3d.ai), image-to-3D, model H2.5, akun gratis.
- Gambar masukan: `docs/referensi/wijaya-konsep-01.png` (dibuat dengan ChatGPT,
  1024 x 1536). Pose A, tanpa alas kaki, kain batik cokelat, ikat pinggang merah,
  ikat kepala, gelang lengan emas.
- Tanggal unduh: 29 Oktober 2026.
- SHA-256: `8d40249c2be3fb6e66a342a49c9fc060b443ecf94f5f8b376eb5c87541745b20`.
- Isi: 12,7 MB, satu mesh, 226.932 segitiga, 123.306 verteks, tanpa rig dan
  animasi. Tinggi 1,0 m (lebar 0,55 m, tebal 0,19 m), titik pusat di kaki.
  Tiga tekstur 4096 x 4096: base color (JPEG), metallic-roughness (JPEG),
  normal (PNG). Ekstensi `KHR_materials_volume` dan `FB_ngon_encoding`.
- Masalah yang diketahui: tekstur wajah meleleh; bercak abu-abu tanpa warna di
  tepi tangan, jari, kaki, bahu, dan leher. Belum diperbaiki (rencana: proyeksi
  dari gambar konsep di sesi berikutnya).

### Lisensi (dicek 29 Oktober 2026)

- Blog resmi Tripo, "Can You Use AI-Generated 3D Models Commercially?"
  (tripo3d.ai/blog/commercial-use-ai-3d-models): paket gratis memakai lisensi
  Creative Commons Attribution 4.0 (CC BY 4.0). Boleh dipakai komersial,
  dimodifikasi, dan disebarkan, dengan syarat mencantumkan atribusi ke Tripo di
  produk akhir (layar kredit atau dokumentasi) dan menyatakan bahwa aset diubah
  kalau dimodifikasi. Paket berbayar menghapus syarat atribusi.
- Ketentuan Layanan Tripo (tripo3d.ai/terms, diperbarui 11 Juli 2025), bagian
  3.2 Outputs: pengguna boleh memakai hasil "for lawful commercial or
  non-commercial purposes", kecuali untuk membuat model atau layanan yang
  bersaing dengan Tripo. Tidak ada jaminan hasil unik atau bebas klaim pihak
  ketiga.
- Beberapa ulasan pihak ketiga menulis paket gratis tidak boleh komersial;
  sumber resmi di atas lebih kuat. Cek juga label lisensi di halaman model
  pada akun Tripo sebelum rilis.
- Konsekuensi untuk game ini: tulis "Model Raden Wijaya dibuat dengan Tripo
  (CC BY 4.0), diubah" di layar kredit. Gambar konsep dari ChatGPT: syarat
  OpenAI memberikan hak hasil ke pengguna; tidak perlu atribusi.

## Folder

- `pratinjau/`: render pembanding sebelum dan sesudah optimasi (Tahap B).
- `mixamo/`: FBX untuk diunggah ke Mixamo dan hasil unduhannya (Tahap C).
