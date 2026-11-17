# Prompt aset: sambung kepala prajurit Kediri

Salin seluruh isi di bawah garis ke sesi Claude Code baru di folder ini.

---

Baca CLAUDE.md, aset-mentah/README.md (bagian prajurit Kediri, prosedur sambung kepala, dan catatan leher Wijaya), tools/blender/README.md, dan skrip di tools/blender/ (terutama optimasi_karakter.py, ganti_kepala.py, rapikan_leher.py, kulit_warna.py, abu_isi.py, ekspor_mixamo.py) serta tools/blender/wajah.json.

Langkah 0: working tree masih berisi revisi leher Wijaya yang belum di-commit. Commit apa adanya dengan pesan "Leher Wijaya revisi 1 (belum final): skrip rapikan_leher, kalung, koreksi Neck", tanpa pratinjau tambahan. Lalu tambahkan catatan di aset-mentah/README.md bagian leher Wijaya: hasil revisi 1 dinilai pengguna belum proper; leher terlalu lebar seperti tiang, dagu tidak terlihat karena bawah rahang rata dengan leher, garis rambut tengkuk terpotong lurus. Pelajaran: memotong kepala tepat di bawah dagu dan menyambung di rahang tidak berhasil; Wijaya akan diulang nanti dengan cara di bawah ini memakai aset-mentah/kepala-tripo.glb yang masih utuh.

Tugas: buat model prajurit Kediri utuh dari dua hasil Tripo, dengan cara menyambung yang diperbaiki, sampai siap diunggah ke Mixamo.

Bahan:
- aset-mentah/prajurit-tripo.glb: badan (bentuk dan kain bagus; wajah meleleh, bercak abu-abu di tangan, pergelangan kaki, leher; kulit pucat).
- aset-mentah/prajurit-kepala-tripo.glb: kepala dan leher dekat, sekitar 20 MB (wajah bagus; rambut berserabut).
- Gambar konsep: docs/referensi/prajurit-kediri-konsep-01.png (depan seluruh badan), prajurit-kediri-kepala-01.png (kepala depan), dan prajurit-kediri-samping-01.png (tampak samping; kalau belum ada, minta saya dulu). Pakai sebagai acuan proporsi: dari depan lebar leher terhadap rahang dan bahu, dari samping kemiringan leher dan lekuk bawah dagu ke tenggorokan. Di tahap C dan F, tumpangkan siluet render dengan gambar konsep (diskalakan ke tinggi yang sama) supaya selisih proporsi terlihat.

Prinsip baru menyambung (pelajaran dari Wijaya), wajib diikuti:
1. Jangan potong kepala di bawah dagu. Pertahankan bawah rahang, dagu, dan setengah atas leher dari kepala Tripo, karena di situlah bentuk wajah yang benar (lekuk bawah dagu, tenggorokan, otot dari belakang telinga).
2. Potong keduanya di tengah leher, kira-kira separuh jarak dari ujung dagu ke tulang selangka, di tempat penampang leher berbentuk tabung sederhana pada kedua mesh. Garis potong boleh sedikit miring (lebih rendah di depan) mengikuti leher.
3. Sambung dengan bridge edge loops setelah jumlah verteks kedua cincin disamakan (resample); penampang kedua cincin harus mirip (lebar dan tebal selisih kurang dari 10 persen; kalau berbeda, skalakan kepala, jangan meregangkan leher). Tambahkan 2 cincin perantara dan haluskan hanya di pita sambungan.
4. Garis sambungan diletakkan setinggi tali leher prajurit (lihat konsep), supaya tali menutupi sisa jahitan.
5. Leher tidak boleh lebih lebar dari lebar rahang di bawah telinga; dari samping, sumbu leher hampir tegak (di bawah 15 derajat) dan telinga segaris di atas sendi bahu.

Tahapan (berhenti untuk saya cek di setiap tanda CEK):

A. Badan: optimasi_karakter.py ke sekitar 11.000 segitiga, tinggi 1,68 m (sedikit lebih pendek dari Wijaya), tekstur 2048, roughness tetap 0,8 metallic 0. Isi bercak abu-abu dengan abu_isi.py. Badan sebaiknya sedikit lebih ramping dari Wijaya supaya Wijaya tetap menonjol: kecilkan lebar badan 5 sampai 8 persen pada sumbu X dan Y tanpa mengubah tinggi. Simpan antara ke aset-mentah/prajurit-badan.glb.
B. Kepala: decimate ke sekitar 3.500 segitiga, rambut berserabut dipadatkan (buang helai lepas dan pulau kecil, haluskan permukaan rambut), bake ke tekstur 1024. Simpan ke aset-mentah/prajurit-kepala.glb.
C. Penempatan: hitung skala dan posisi kepala dari titik acuan (tinggi kepala sekitar 1/7,5 tinggi badan; lebar leher cocok di garis potong; telinga di atas sendi bahu dari samping). Render tumpang depan dan samping (kepala baru semi transparan di atas badan, garis potong dan garis vertikal bahu terlihat) ke aset-mentah/pratinjau/prajurit-tumpang-*.png. Angka di wajah.json blok "prajurit". CEK.
D. Potong dan sambung sesuai prinsip di atas. Skrip baru tools/blender/sambung_kepala.py (umum, dipakai ulang untuk Wijaya dan tokoh lain; argumen badan, kepala, blok json). Jangan pakai fill holes atau merge pada seluruh mesh. Laporkan jumlah verteks tiap cincin dan selisih penampang.
E. Tekstur: bake warna pita sambungan dari kepala (atas) dan badan (bawah) dengan peralihan 3 cm; samakan kulit badan ke warna kepala dan konsep (cokelat hangat) di ruang Lab dengan kulit_warna.py; tali leher digambar di tekstur atau dibuat sebagai mesh tipis gelap yang menutupi sambungan. Cek juga apakah setengah wajah lebih gelap (masalah Wijaya); kalau ya, ratakan.
F. Pratinjau model diam: depan, samping, tiga perempat, bawah dagu, dan dekat leher dari kamera setinggi wajah. CEK.
G. Kalau saya setujui: ekspor FBX untuk Mixamo ke aset-mentah/mixamo-prajurit/prajurit-untuk-mixamo.fbx dengan ekspor_mixamo.py, dan tulis aset-mentah/mixamo-prajurit/LANGKAH.md singkat: saya hanya perlu merig di Mixamo dan mengunduh idle With Skin; animasi Without Skin di aset-mentah/mixamo/ (milik Wijaya) dipakai ulang karena nama tulangnya sama. Berhenti di sini; pemasangan ke game dikerjakan sesi berikutnya.

Aturan: rencana singkat dulu dan tunggu persetujuan. Jangan menulis ke dalam /Applications/Blender.app. Hemat token: pratinjau hanya di titik CEK atau saat ada yang gagal. Commit setelah G disetujui: "Prajurit Kediri: badan dan kepala tersambung, siap Mixamo".
