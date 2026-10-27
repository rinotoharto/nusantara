# Prompt sprint 1: persiapan proyek, bergerak, dan melihat

Salin seluruh isi di bawah garis ke sesi Claude Code di folder ini.

---

Baca CLAUDE.md, docs/gdd.md, dan docs/prototipe.md.
Kita mulai sprint 1: persiapan proyek, lalu bergerak dan melihat.

Buat rencana singkat dulu (berkas apa saja yang dibuat dan urutannya), lalu tunggu persetujuan saya sebelum menulis kode.

Setelah disetujui, kerjakan bertahap. Setiap tahap: pastikan `npm run dev` jalan tanpa error di terminal maupun konsol browser, beri tahu saya apa yang harus dicek di browser, tunggu konfirmasi saya, lalu commit.

## Tahap A: persiapan proyek

1. Cek Node.js dan npm terpasang (`node -v`, `npm -v`); kalau belum, beri tahu cara memasangnya dan berhenti.
2. Buat proyek Vite + TypeScript + Three.js di folder ini. Pertahankan CLAUDE.md dan folder docs/ yang sudah ada. Buat .gitignore yang mengabaikan node_modules dan dist.
3. Buat struktur folder src/ sesuai CLAUDE.md (boleh berisi berkas kosong atau placeholder).
4. Pastikan `npm run dev` menampilkan kotak berputar di browser sebagai uji rantai alat.
5. Commit pertama: "Persiapan proyek Vite + Three.js".

## Tahap B: medan dan desa

1. Medan balok 300 x 300 meter: bukit di utara, sungai dari timur ke barat (cekungan dangkal dengan bidang air biru), 6 rumah balok sebagai desa Kudadu di tengah, hutan dari silinder dan kerucut sederhana di selatan.
2. Pencahayaan: satu matahari (directional light dengan bayangan) dan cahaya ambien hangat, suasana sore.
3. Commit: "Medan, sungai, dan desa balok".

## Tahap C: pemain dan kamera

1. Pemain berupa kapsul tinggi 1,7 m: WASD jalan, Shift lari, Spasi lompat. Kapsul sedikit miring ke arah gerak.
2. Kamera orang ketiga di belakang pemain, bisa diputar dengan mouse (pointer lock saat klik di kanvas, Esc untuk lepas), tidak menembus medan atau rumah.
3. Tabrakan pemain dengan medan dan rumah; pemain mengikuti kontur bukit.
4. Satu tebing rendah (sekitar 2 m) di dekat bukit yang bisa dipanjat dengan mendekat dan menekan Spasi.
5. Commit: "Pengendali pemain dan kamera orang ketiga".

## Tahap D: alat bantu

1. Tampilkan fps di pojok layar.
2. Tampilkan petunjuk tombol kecil di pojok bawah.
3. Buat docs/catatan-sprint.md berisi ringkasan sprint 1: apa yang jalan, apa yang belum, keputusan yang diambil.
4. Commit: "Sprint 1 selesai: bergerak dan melihat".

Selesai berarti: saya bisa berjalan keliling desa dua menit dengan nyaman, kamera tidak menembus tembok, dan fps di laptop saya mendekati 60.
