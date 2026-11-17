# Prompt: prajurit Kediri masuk ke game

Dijalankan setelah prajurit di-rig di Mixamo dan idle-nya diunduh ke aset-mentah/mixamo-prajurit/idle.fbx. Salin seluruh isi di bawah garis ke sesi Claude Code baru.

---

Baca CLAUDE.md, docs/standar-karakter.md (tahap 5), aset-mentah/README.md (bagian prajurit Kediri, "Masalah animasi: lengan kiri saat menyerang" beserta pembaruannya soal bobot kain, dan rencana pengulangan Wijaya), aset-mentah/mixamo/LANGKAH.md, tools/blender/README.md, gabung_animasi.py, dan src/character/model-wijaya.ts.

Tujuan: model prajurit beranimasi dipakai semua penjaga, lawan, dan perampok di misi pelarian lewat ?model=prajurit (boleh digabung dengan ?model=wijaya, misalnya ?model=wijaya,prajurit). Tanpa parameter, game tetap kapsul.

1. Gabung animasi prajurit dengan cara yang sudah terbukti di Wijaya (bagian "Pengulangan Wijaya, bagian 2" di tools/blender/README.md): gabung_animasi.py --model aset-mentah/prajurit-utuh.glb --rig aset-mentah/mixamo-prajurit/idle.fbx --mixamo aset-mentah/mixamo --blok prajurit. Buat blok prajurit.animasi di wajah.json mulai dari angka wijaya_ulang.animasi, lalu sesuaikan zona kain, bidang potong leher, dan tali leher (pengganti pita emas; prajurit tidak punya kalung gantung). Keluaran sementara aset-mentah/prajurit-animasi.glb.
2. Bobot: bobot kulit asli Mixamo dipakai apa adanya (paha, lutut, lengan, badan); yang ditimpa hanya kain dan sabuk (gradasi Hips ke tepi bawah, UpLeg kiri-kanan dicampur di garis tengah), kulit kaki di dalam zona kain (hanya UpLeg dan Leg), kepala dan pita sambungan, dan tali leher (ikut kulit di bawahnya). Koreksi lengan kiri per klip seperti Wijaya. Ukur dengan pratinjau_animasi.py: lingkar paha dan lutut di kuda-kuda terlebar minimal 0,9 dari pose A, tidak ada serat kain ke tangan, tali leher tidak tenggelam. Lembar pratinjau pinggang ke kaki (depan, samping, belakang) dan bahu dari belakang, berdampingan dengan Wijaya baru. Berhenti dan tunggu saya cek sebelum menulis ke public/models/prajurit.glb (Draco).
3. Di game: komponen model karakter yang umum (pecah model-wijaya.ts menjadi model-karakter.ts kalau perlu) dengan AnimationMixer yang sama untuk Wijaya dan prajurit. Penjaga dan lawan memetakan status mesin lawan ke aksi: patroli dan kembali → jalan, mengejar dan mendekat → lari, mengelilingi → siaga atau jalan menyamping, bersiap → siaga ditahan, menyerang → serang-3 (tusukan), terhuyung → terkena, mati → mati, curiga dan mencari → idle dengan kepala menoleh kalau mudah. Kecepatan animasi disinkronkan dengan laju gerak.
4. Variasi warna lewat kode: ikat kepala dan kain diwarnai ulang di shader (topeng dari rona nila di tekstur) untuk tiga pihak: Kediri biru nila (bawaan), Singasari merah tua, Madura putih dan hitam. Perampok memakai warna cokelat lusuh. Data pihak per penjaga dan lawan di misi3.json.
5. Tombak tetap balok sementara, ditempel ke tulang RightHand dengan offset di src/data/models.json.
6. Performa: ukur fps dengan Wijaya plus semua penjaga aktif (sampai sekitar 10 karakter berkerangka). Kalau turun di bawah 50 di laptop pengembang, terapkan: animasi diperbarui setengah laju untuk karakter lebih dari 30 m, karakter di luar kamera tidak dianimasikan, dan bayangan hanya untuk karakter dalam 25 m.
7. Pratinjau game: tangkapan layar game prajurit patroli, mengejar, menusuk, dan mati, serta Wijaya bertarung melawan dua prajurit; cek tidak ada serat kain ke tangan dan kain tidak pecah. Tunggu saya cek sebelum commit.

Aturan: rencana singkat dulu, tunggu persetujuan. Jangan menulis ke dalam /Applications/Blender.app. Hemat token. Commit: "Prajurit Kediri di game: animasi, bobot kain dan lengan, variasi warna".
