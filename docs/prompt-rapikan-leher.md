# Prompt aset: rapikan leher Wijaya

Salin seluruh isi di bawah garis ke sesi Claude Code baru di folder ini.

---

Baca CLAUDE.md, aset-mentah/README.md (terutama bagian "Masalah kepala", "Sambungan kepala: belum terbukti", "Leher Wijaya: hasil kerja manual di Blender", dan "Prosedur sambung kepala"), tools/blender/README.md, serta skrip tools/blender/ganti_kepala.py, kulit_warna.py, abu_isi.py, optimasi_karakter.py, gabung_animasi.py, dan wajah.json.

Tujuan: menyelesaikan sambungan kepala Wijaya dari berkas yang sudah saya rapikan manual di Blender, lalu memasang kembali kerangka dan animasi Mixamo, sehingga public/models/wijaya.glb (yang dipakai lewat ?model=wijaya) memakai kepala baru dengan leher yang rapi. Ini juga menguji prosedur sambung kepala yang akan dipakai untuk semua karakter berikutnya, jadi skripnya harus umum dan bisa diulang.

Bahan:
- aset-mentah/wijaya-leher-rapi.glb (dan wijaya-leher.blend): satu mesh "rendah", 16.540 segitiga, 12.673 verteks, tinggi 1,694 m, base color dan normal, tanpa kerangka dan animasi, tanpa Draco. Yang sudah saya kerjakan manual: kepala dimundurkan 3,7 cm supaya tegak di atas leher; bawah kepala dipotong rata di z sekitar 1,48 m dan serpihan janggut di bawah dagu dibuang; leher badan dipotong lalu diekstrusi naik sekitar 3 cm masuk ke kepala dan diskalakan 0,92.
- Jangan ubah wajah, rambut, ikat kepala, telinga, dan badan di bawah leher.

Masalah yang harus dibereskan:
1. Pita leher berbentuk tabung lurus dan menonjol ke depan di bawah dagu seperti kerah. Bentuk ulang: cincin atas pita ditarik ke titik terdekat garis tepi bawah kepala, sedikit ke dalam permukaan kepala (sekitar 3 mm) supaya tidak menembus keluar; cincin di bawahnya diinterpolasi sehingga leher menyempit wajar dari pangkal leher badan ke rahang, lalu dihaluskan beberapa iterasi hanya pada verteks pita.
2. Bukaan bawah kepala masih terbuka (lubang gelap terlihat dari bawah dagu). Di Blender, Fill Holes dan Merge by Distance 2 mm gagal dan merusak wajah, jadi JANGAN merge atau fill seluruh kepala. Cari hanya tepi terbuka (boundary) di sekitar z 1,48 m dalam radius leher, gabungkan verteks yang berimpit dengan ambang sangat kecil (0,1 mm) hanya di cincin itu, lalu tutup cincin itu (grid fill atau fan ke titik pusat yang diangkat sedikit ke dalam). Laporkan berapa cincin terbuka yang ditemukan.
3. Tekstur pita leher bergaris tegak karena UV ikut terekstrusi. Buat UV baru untuk verteks pita (proyeksi silinder) dan bake warnanya dari kulit leher badan di bawahnya, lalu samakan warna di ruang Lab (pakai pendekatan kulit_warna.py), dengan peralihan halus ke rahang di atas dan ke leher badan di bawah. Penutup bawah kepala diberi warna kulit leher yang sama.
4. Tepi bawah dagu bergerigi kalau dilihat dari depan: haluskan verteks batas bawah wajah sepanjang dagu tanpa menggeser bibir dan rahang di atasnya.
5. Tambahkan kalung emas tipis sederhana di pangkal leher (seperti gambar konsep docs/referensi/wijaya-konsep-01.png) yang menutup sisa garis sambungan antara pita dan leher badan: torus pipih atau rantai sederhana dengan sedikit liontin, material emas (metallic 1, roughness 0,35), ikut bobot tulang Neck dan Spine2.
6. Kalau memungkinkan dalam sesi ini, perbaiki juga gelang lengan dan kalung yang kini ikut metallic 0: topeng sederhana (rona kuning-oranye dengan saturasi tinggi di area gelang) untuk tekstur metallic-roughness supaya emas tampak logam. Kalau rumit, catat saja dan lewati.

Lalu:
7. Jalankan ulang optimasi (target sekitar 15.000 sampai 16.500 segitiga, tekstur 2048, Draco) dan gabung_animasi.py dengan semua FBX di aset-mentah/mixamo, ke public/models/wijaya.glb. Kerangka Mixamo tetap sama; bobot dipindah ke mesh baru seperti sebelumnya. Pastikan kepala dan kalung ikut tulang Head/Neck dengan benar dan leher tidak robek saat menoleh dan saat animasi serang dan mati.
8. Render pratinjau ke aset-mentah/pratinjau/leher-*.png: depan, samping, tiga perempat, bawah (sudut kamera dialog), dan satu frame animasi lari serta serang-2. Tunggu saya cek sebelum commit.
9. Tulis skripnya sebagai tools/blender/rapikan_leher.py dengan argumen (berkas masuk, tinggi potong kepala, angka di wajah.json blok "leher_rapi"), supaya bisa dipakai untuk prajurit Kediri dan tokoh lain. Dokumentasikan di tools/blender/README.md dan perbarui aset-mentah/README.md (hasil, angka, dan apakah prosedur sambung kepala dinyatakan berhasil).

Aturan: rencana singkat dulu, tunggu persetujuan. Jangan pernah menulis ke dalam /Applications/Blender.app; pustaka tambahan ke folder proyek atau venv tools/. Kerjakan hemat token: pratinjau hanya di langkah 8 atau saat ada yang gagal, laporan singkat. Satu commit setelah saya setujui: "Rapikan leher Wijaya: pita leher, penutup kepala, kalung, animasi dipasang ulang".
