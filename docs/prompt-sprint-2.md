# Prompt sprint 2: bertarung

Salin seluruh isi di bawah garis ke sesi Claude Code baru di folder ini.

---

Baca CLAUDE.md, docs/prototipe.md (bagian sprint 2), dan docs/catatan-sprint.md.
Kita mulai sprint 2: bertarung. Sprint 1 sudah selesai dan di-commit; jangan ubah rasa gerak dan kamera yang sudah ada kecuali diperlukan untuk pertarungan.

Buat rencana singkat dulu (berkas apa saja yang dibuat di src/combat/ dan src/ui/, bagaimana nyambung ke Pemain dan Input yang sudah ada), lalu tunggu persetujuan saya sebelum menulis kode.

Setelah disetujui, kerjakan bertahap. Setiap tahap: pastikan `npm run dev` jalan tanpa error di terminal maupun konsol browser, beri tahu saya apa yang harus dicoba, tunggu konfirmasi saya, lalu commit.

Semua angka keseimbangan (kecepatan, jarak, durasi, nyawa, damage) ditaruh di satu berkas src/data/combat.json supaya bisa disetel tanpa menyentuh kode.

## Tahap A: serangan pemain

1. Senjata default keris (jarak dekat, sekitar 1,5 m). Klik kiri: serang ringan, maksimal kombo 3 pukulan dengan jeda kecil di antaranya. Tahan klik kiri sekitar 0,5 detik: serangan berat, lebih lambat, damage dua kali, mendorong lawan mundur.
2. Klik kanan: tangkis. Tangkis yang pas (dalam 0,2 detik sebelum pukulan lawan mendarat) membuat lawan terhuyung 1 detik dan terbuka diserang. Tangkis biasa hanya mengurangi damage jadi nol tapi pemain terdorong sedikit.
3. Tombol Ctrl atau klik tengah: hindar, lompatan pendek ke arah gerak (atau mundur kalau diam), 0,4 detik, kebal selama 0,25 detik pertama.
4. Saat kapsul belum punya animasi, nyatakan tiap aksi lewat gerak kapsul: condong ke depan saat serang, agak mundur dan bersinar saat tangkis, meluncur rendah saat hindar. Tambahkan balok tipis sebagai keris di sisi kanan kapsul yang mengayun saat serang.
5. Kamera saat bertarung: sedikit menjauh (sekitar 1,5 m) dan agak menurun supaya lawan terlihat. Kembali ke jarak jelajah 2 detik setelah tidak ada lawan dekat.
6. Commit: "Serangan, tangkis, dan hindar pemain".

## Tahap B: lawan dan AI

1. Lawan: kapsul 1,7 m warna merah tua (prajurit Kediri) dengan tombak (balok tipis panjang, jangkauan sekitar 2,2 m, lebih jauh dari keris pemain).
2. AI sederhana dengan status: diam, mendekat, bersiap, menyerang, mundur, terhuyung, mati. Mendekat kalau pemain dalam 12 m. Di jarak serang, bersiap dengan isyarat 0,5 detik yang jelas: tombak ditarik ke belakang dan kapsul bersinar kuning, lalu menusuk. Setelah menyerang, mundur 1 sampai 2 detik sebelum menyerang lagi.
3. Beberapa lawan tidak boleh menyerang bersamaan: paling banyak satu lawan menyerang dalam satu waktu, yang lain mengelilingi di jarak 3 sampai 4 m (pola yang sama seperti Batman Arkham dan Ghost of Tsushima). Sediakan antrean serangan sederhana.
4. Lawan menghadap pemain, mengikuti kontur medan, dan saling mendorong supaya tidak menumpuk. Pakai tabrakan yang sudah ada di src/world/collision.ts.
5. Tiga lawan ditempatkan di tanah lapang timur desa untuk pengujian, dan satu lawan sendirian di barat desa untuk belajar.
6. Commit: "Lawan kapsul dengan AI dan isyarat serangan".

## Tahap C: nyawa, kematian, dan HUD

1. Nyawa pemain 100, keris 20 per pukulan ringan, 40 berat. Nyawa lawan 60, tombak 25 per tusukan. Semua di combat.json.
2. Saat terkena: kilatan putih singkat pada kapsul, dorongan kecil, angka damage kecil melayang (boleh sederhana). Lawan mati rebah dan menghilang setelah 3 detik.
3. Pemain mati: layar gelap, teks "Raden Wijaya gugur", tombol "Ulangi" yang mengembalikan pemain ke titik awal dan menghidupkan lagi semua lawan.
4. HUD minimal: bilah nyawa pemain di kiri bawah; bilah nyawa kecil melayang di atas lawan yang sedang dekat; penanda kecil pada lawan yang dikunci.
5. Lock-on ringan: kalau pemain menekan serang tanpa menggerakkan mouse, pemain otomatis menghadap lawan terdekat dalam 3 m. Tidak perlu tombol kunci terpisah.
6. Commit: "Nyawa, kematian, dan HUD pertarungan".

## Tahap D: penyetelan dan catatan

1. Mainkan 1 lawan 3 beberapa kali. Setel angka di combat.json sampai: pemain yang hanya menekan serang terus-menerus kalah atau hampir kalah, tapi pemain yang menangkis dan menghindar menang dengan nyawa tersisa. Catat angka akhirnya.
2. Pastikan fps tetap mendekati 60 dengan 4 lawan aktif.
3. Tambahkan bagian "Sprint 2" ke docs/catatan-sprint.md: apa yang jalan, apa yang belum, keputusan, dan angka keseimbangan akhir.
4. Commit: "Sprint 2 selesai: bertarung".

Selesai berarti: pertarungan 1 lawan 3 bisa dimenangkan dengan tangkis dan hindar, bukan dengan menekan serang terus-menerus; isyarat lawan terbaca jelas; fps mendekati 60.
