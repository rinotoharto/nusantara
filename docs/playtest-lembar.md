# Lembar pengamatan playtest misi 3

Satu lembar per pemain. Pemain bermain sendirian, tanpa dibantu dan tanpa diberi tahu kendali selain yang tertulis di layar. Duduk di belakangnya, jangan memberi petunjuk, dan catat di mana ia bingung atau berhenti. Buka game dengan `?playtest=1` di akhir tautan supaya catatan otomatis direkam; setelah layar selesai, tekan "Unduh catatan playtest" dan simpan berkas JSON-nya dengan nama yang sama dengan lembar ini.

## Pemain

| | |
| --- | --- |
| Nama atau inisial | |
| Umur | |
| Pengalaman game (tidak pernah / kadang / sering; sebutkan game yang biasa dimainkan) | |
| Alat masukan (keyboard dan mouse / gamepad) | |
| Tanggal dan jam mulai | |
| Nama berkas catatan JSON | |

## Pengamatan selama bermain

Isi satu baris tiap kali pemain tampak bingung, berhenti lebih dari sekitar 20 detik, salah arah, mengulang karena gugur, atau mengomentari sesuatu. Kolom "waktu" dari jam atau dari HUD; kolom "tempat" sedekat mungkin (misalnya "gerbang utara Kudadu", "tepi sungai dekat penjaga kedua").

| Waktu | Tempat atau segmen | Apa yang terjadi | Apa yang membantunya keluar (kunang-kunang, obor, Nambi, peta, coba-coba, tidak keluar) |
| --- | --- | --- | --- |
| | | | |
| | | | |
| | | | |
| | | | |
| | | | |
| | | | |
| | | | |
| | | | |

Centang yang terjadi:

- [ ] Menekan Tab (kunang-kunang) tanpa diberi tahu
- [ ] Membuka peta (M) tanpa diberi tahu
- [ ] Mendengar atau menyebut Nambi menunjuk jalan
- [ ] Menyelinap (jongkok, semak) setidaknya sekali
- [ ] Bertarung setidaknya sekali
- [ ] Membuka Kitab sendiri
- [ ] Mengubah pengaturan (kepekaan, kualitas, huruf)
- [ ] Berhenti bermain sebelum layar selesai; alasannya: ______________________

Rute yang dipilih: sungai / bukit. Gajah Pagon: ikut / ditinggal. Menginap di Kudadu: ya / tidak. Waktu di layar selesai: ___ menit ___ detik.

## Pertanyaan setelah bermain

Tanyakan setelah layar selesai, dengan urutan ini. Tulis jawaban sedekat mungkin dengan kata-kata pemain.

1. Ceritakan apa yang terjadi di misi tadi dengan kata-katamu sendiri.

   Jawaban:

   Menyebut urutan: kalah [ ] kabur [ ] ditolong desa [ ] menyeberang ke Madura [ ]

2. Bagian mana yang paling seru, dan mana yang membosankan?

   Jawaban:

3. Apa yang kamu pelajari tentang Raden Wijaya yang sebelumnya tidak kamu tahu?

   Jawaban:

4. Mau main lagi kalau ada misi berikutnya?

   Jawaban: ya / ragu / tidak. Alasan:

5. Apakah kamu tahu harus ke mana? Apa yang membantumu?

   Jawaban:

6. Keputusan mana yang paling kamu pikirkan?

   Jawaban:

## Kesimpulan pengamat

Isi sesudah pemain pulang.

| Syarat lolos (docs/prototipe.md) | Pemain ini |
| --- | --- |
| Menyelesaikan misi tanpa bantuan | ya / tidak |
| Bisa menceritakan urutan peristiwa | ya / sebagian / tidak |
| Mau main lagi | ya / ragu / tidak |
| Berhenti karena kamera atau kontrol | ya / tidak |
| Menyebut satu keputusan yang ia pertimbangkan | ya / tidak |

Tiga hal yang paling perlu diperbaiki menurut sesi ini:

1.
2.
3.

## Isi berkas JSON (untuk dibaca pengamat)

Berkas unduhan memuat sampai 10 sesi terakhir di peramban itu, yang paling baru di akhir daftar `sesi`. Tiap sesi berisi: `segmen` (id, detik mulai dan selesai, lama, jumlah ketahuan dan gugur di segmen itu), `ketahuan` dan `gugur` (detik misi, segmen, koordinat x dan z), `pilihanDialog` (percakapan, simpul, indeks pilihan, nada), `petunjuk` (berapa kali kunang-kunang, peta, dan Nambi terpakai) dengan rinciannya di `petunjukKejadian`, `kitab` (entri yang terbuka pada detik keberapa dan berapa detik dibaca; `terbukaPada` kosong kalau entri sudah terbuka dari sesi sebelumnya), dan `hasil` (ringkasan layar selesai). Sesi dengan `dilanjutkan: true` dimulai dari tombol Lanjutkan, bukan Mulai baru. Koordinat memakai peta dunia: desa Kudadu di (0, 0), +x ke timur, −z ke utara.
