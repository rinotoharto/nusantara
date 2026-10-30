# Langkah Mixamo untuk Wijaya

Mixamo (mixamo.com, akun Adobe gratis) tidak bisa dijalankan dari skrip, jadi
bagian ini dikerjakan dengan tangan. Semua hasil disimpan di folder ini.

Berkas yang diunggah: `wijaya-untuk-mixamo.fbx` (dibuat oleh
`tools/blender/ekspor_mixamo.py` dari `public/models/wijaya.glb`, tanpa Draco,
tekstur tersemat).

## 1. Unggah dan rig

1. Masuk ke mixamo.com, klik **Upload Character**, pilih
   `wijaya-untuk-mixamo.fbx`. Tunggu pratinjau muncul; kalau model terlihat
   rebah atau sangat kecil, pakai tombol putar di layar pratinjau sampai
   berdiri tegak menghadap kamera.
2. Di layar **Auto-Rigger**, letakkan penanda (model berpose A, lengan agak
   turun, tidak apa-apa):
   - **Chin** (dagu): tepat di bawah bibir.
   - **Wrists** (pergelangan tangan): di sendi antara lengan bawah dan telapak,
     kiri dan kanan.
   - **Elbows** (siku): di tengah lipatan siku.
   - **Knees** (lutut): di tengah tempurung lutut.
   - **Groin** (selangkangan): di titik pertemuan kedua paha, di bawah ikat
     pinggang.
   - Biarkan **Use Symmetry** menyala.
3. **Skeleton LOD**: pilih **Standard Skeleton (65)**. Jari tidak perlu;
   mesh jari hasil pengurangan poligon memang kasar.
4. Klik Next, tunggu rig selesai (sekitar 1 sampai 2 menit), cek pratinjau
   gerak. Kalau siku atau lutut menekuk aneh, Back dan geser penanda.
   Klik Finish.

## 2. Unduh animasi

Cari tiap nama di kolom pencarian, klik animasinya, lalu **Download**.
Pengaturan unduh:

- **Format**: FBX Binary (.fbx).
- **Skin**: **With Skin** hanya untuk Idle; semua yang lain **Without Skin**.
- **Frames per Second**: 30.
- **Keyframe Reduction**: none.
- Untuk animasi gerak (Walking, Running, Sneak Walk) centang **In Place** di
  panel kanan sebelum mengunduh, karena perpindahan dilakukan kode game.
  Biarkan slider lain di nilai bawaan.

Simpan dengan nama berikut (skrip Tahap D mencari nama ini):

| Cari di Mixamo | Nama berkas | Aksi di game |
| --- | --- | --- |
| Idle | `idle.fbx` (With Skin) | diam |
| Walking | `jalan.fbx` | jalan |
| Running | `lari.fbx` | lari |
| Sneak Walk | `jongkok-jalan.fbx` | jongkok berjalan |
| Crouch Idle | `jongkok-diam.fbx` | jongkok diam |
| Sword And Shield Slash | `serang.fbx` | serang ringan (sementara) |
| Sword And Shield Block | `tangkis.fbx` | tangkis |
| Sword And Shield Dodge atau Standing Dodge Backward | `hindar.fbx` | hindar |
| Sword And Shield Impact atau Hit Reaction | `terkena.fbx` | terpukul |
| Sword And Shield Death atau Dying | `mati.fbx` | mati |

Catatan:
- Kalau nama persis tidak ada, pilih yang paling mirip dan tulis nama aslinya
  di bagian "Catatan unduhan" di bawah supaya tercatat.
- Beberapa animasi punya varian kiri atau kanan; ambil satu saja.
- Untuk Block, ambil yang berupa sikap menahan (bukan reaksi kena saat
  menahan) supaya bisa diputar berulang selama tombol ditahan.
- Hasil: 10 berkas FBX di folder ini plus `wijaya-untuk-mixamo.fbx`.

## 3. Selesai

Beri tahu di sesi Claude Code bahwa unduhan selesai. Tahap D menggabungkan
semuanya dengan `tools/blender/gabung_animasi.py`.

## Catatan unduhan

(Isi di sini kalau ada nama animasi yang berbeda dari tabel atau masalah saat
rig.)

### Pengaturan yang dipakai (29 Oktober 2026)

Rig: Standard Skeleton (65), Use Symmetry, penanda siku di lekukan sejajar ikat kain, selangkangan sekitar separuh tinggi badan.

Semua animasi: Character Arm-Space **55** (sama untuk semua supaya lengan tidak melompat saat berganti gerakan). Unduh: FBX Binary, 30 fps, Keyframe Reduction none.

| Berkas | Animasi Mixamo | Pengaturan khusus |
| --- | --- | --- |
| idle.fbx | Breathing Idle (bukan Standard Idle, yang terlalu santai) | With Skin; Body Type 0, Sway 20, Breathing 40, Overdrive 40 |
| siaga.fbx (tambahan) | Fighting Idle atau Sword And Shield Idle | Without Skin; diam saat ada musuh dekat |
| jalan.fbx | Walking | Without Skin, In Place |

Masalah rig yang terlihat di pratinjau Mixamo (untuk Tahap D): kain bagian depan terbelah di tengah saat kaki melangkah (garis gelap di antara paha), makin jelas saat lari. Penyebab: bobot kain depan dibagi ke tulang paha kiri dan kanan. Perbaikan di gabung_animasi.py: bobot verteks kain di bawah ikat pinggang dipindah sebagian besar ke tulang Hips (misalnya 70 persen Hips, 30 persen paha terdekat), dihaluskan di batas kain dan kulit, lalu periksa di pose langkah terlebar animasi lari.

Catatan kecepatan (untuk Tahap D): kecepatan jalan pemain sejak sprint 1 adalah 4 m/s, jauh di atas kecepatan langkah animasi Walking Mixamo (sekitar 1,4 m/s). Jangan paksakan timeScale hampir 3 kali; turunkan kecepatan jalan di data ke sekitar 2 m/s (atau tambahkan langkah cepat terpisah) dan sinkronkan timeScale animasi jalan, lari, dan jongkok-jalan dengan kecepatan gerak sebenarnya supaya kaki tidak meluncur. Uji juga keseimbangan menyelinap karena jarak dan waktu patroli disetel dengan kecepatan lama.
| lari.fbx | Running | Without Skin, In Place, Arm-Space 55 |
| jongkok-jalan.fbx | Crouched Walking (dipilih ganti Sneak Walk / Sneaking Forward, yang lengannya terlalu terbuka) | Without Skin, In Place; Posture 50, Speed 45, Overdrive 40, Arm-Space 45 (diunduh ulang supaya serasi dengan jongkok-diam) |
| jongkok-diam.fbx | Crouch Idle (jongkok dalam, kaki lebih lebar dari Crouched Walking) | Without Skin, Overdrive 40, Arm-Space 45. Di gabung_animasi.py: bandingkan tinggi pinggul (tulang Hips) dan jarak kedua kaki dengan pose rata-rata jongkok-jalan. Kalau selisih tinggi lebih dari sekitar 10 cm atau kaki jauh lebih lebar, jangan pakai berkas ini; buat aksi jongkok-diam dari jongkok-jalan (satu pose saat kedua kaki menapak plus napas halus, siklus sekitar 3 detik). Laporkan angka perbandingannya. |

Aturan Arm-Space: idle, jalan, lari wajib sama (55). Pasangan jongkok sama satu sama lain (45). Animasi tempur bebas, pilih yang paling baik dilihat.

Serangan (pengganti `serang.fbx` di tabel awal): satu gerakan per pukulan, karena kombo diatur kode (sprint 2: ringan kombo 3, tahan 0,5 s untuk berat).

| Berkas | Cari | Dipakai untuk |
| --- | --- | --- |
| serang-1.fbx | Sword And Shield Slash (satu tebasan kanan ke kiri) | pukulan kombo 1 |
| serang-2.fbx | tebasan balik kiri ke kanan (varian lain) | pukulan kombo 2 |
| serang-3.fbx | Stab / Sword And Shield Attack (tusukan ke depan) | pukulan kombo 3, dasar Tikaman Keris dan Sergap |
| serang-berat.fbx (opsional) | Great Sword Slash atau tebasan besar dari atas | serangan berat |

Untuk Tahap D: potong awalan lambat tiap klip dan atur timeScale supaya titik kena animasi jatuh di jendelaKena combat.json (ringan 0,10 sampai 0,22 s dari durasi 0,36 s; berat 0,32 sampai 0,46 s dari 0,75 s). Kalau serang-2 atau serang-berat tidak ada, pakai serang-1 dicerminkan atau dipercepat.

Catatan serangan yang diunduh:
- serang-1.fbx: Sword And Shield Slash (tebasan kanan ke kiri), Overdrive 40, Arm-Space 55.
- serang-2.fbx: Sword And Shield Slash varian tebasan balik kiri ke kanan, Overdrive 45, Arm-Space 55. Akhir gerakan kedua lengan terbentang; potong bagian ini.
- serang-3.fbx: Upward Thrust (tusukan bawah ke atas, sejalan dengan "tikaman sandang" di GDD), Distance diturunkan (sekitar 30), Arm-Space 55. Tangan kiri membuka, tangan kanan menikam; pastikan keris di tangan kanan saat tikaman.
- serang-berat.fbx: animasi thrust lalu slash (dua gerakan), untuk serangan berat 0,75 s.
Untuk semua klip serangan di Tahap D: buang perpindahan root (Hips XZ) karena majunya pemain diatur kode (majuPerPukulan 0,5 m, berat 1,0 m).

## Status 30 Oktober 2026 (berhenti untuk dilanjutkan besok)

Sudah ada di folder ini: jalan.fbx, lari.fbx, jongkok-jalan.fbx, jongkok-diam.fbx, serang-1.fbx, serang-2.fbx, serang-3.fbx.
Catatan: jalan, lari, jongkok-jalan, jongkok-diam terunduh With Skin (sekitar 2,2 MB). Tidak perlu diunduh ulang; gabung_animasi.py ambil aksinya saja dan abaikan mesh-nya.

Belum ada: idle.fbx (Breathing Idle, With Skin; cek folder Downloads), serang-berat.fbx (thrust lalu slash, opsional), tangkis.fbx (Sword And Shield Block), hindar.fbx (Dodge), terkena.fbx (Hit Reaction), mati.fbx (Dying), siaga.fbx (Fighting Idle).

Setelah semua ada di folder ini, tekan "Mixamo selesai" di sesi Claude Code "Prompt aset Wijaya". Kalau idle.fbx tetap tidak ada, salah satu berkas With Skin (misalnya jalan.fbx) bisa dipakai sebagai sumber karakter berkulit.

Tambahan (opsional): sergap.fbx. Cari: stabbing, sneak attack, assassination, takedown. Mulai dari posisi jongkok/rendah, tangan kanan menikam, tangan kiri boleh meraih bahu lawan. Without Skin, Arm-Space 45. Kalau tidak ada: rangkai di gabung_animasi.py dari jongkok-jalan (mendekat) lalu serang-3 (tusukan) dengan durasi total sekitar 1 s sesuai combat.json pemain.sergap. Tikaman Keris memakai serang-3 (tidak perlu berkas baru). Animasi korban rebah ke depan ditunda sampai lawan punya model 3D.

Tambahan: tarung.fbx = Sword Fight One (sekitar 246 bingkai, 8 detik; siaga, menahan, menghindar, beberapa tebasan). Stance 50, Energy 50, Arm-Space 55, Without Skin. Di Tahap D: render lembar kontak (satu gambar tiap 10 bingkai) dan usulkan potongan untuk (a) tangkis (sikap menahan yang bisa diulang), (b) balasan setelah tangkis pas (menahan lalu menikam, sekitar 1 detik; versi sinematik Tikaman Keris), (c) bahan ulti kalau ulti.fbx tidak ada. Tunggu pengguna memilih bingkai sebelum memotong. Arah desain ulti (meteran dari tangkis pas, Sergap, Tikaman; tanpa efek gaib; terbuka sekitar misi 6) belum masuk GDD, menunggu persetujuan.
- tangkis.fbx: Sword And Shield Block, 18 bingkai, kuda-kuda lebar, lengan kiri menangkis; diputar berulang selama tangkis ditahan, pastikan loop mulus. Arm-Space 55.
- hindar.fbx: Standing Dodge Backward (satu lompatan mundur, sinkron dengan hindar 0,4 s dan 2,6 m di combat.json; buang perpindahan root kalau In Place tidak tersedia). Arm-Space 55.
- siaga.fbx: Dodging (goyang siaga di tempat, bukan Fighting Idle) dipakai sebagai diam saat ada lawan dalam jarak kamera bertarung. Arm-Space 55.
