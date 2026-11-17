# Standar pembuatan karakter (sambung kepala)

Ditetapkan 17 November 2026 dari hasil prajurit Kediri (cara "potong di tengah leher"), setelah dua kali gagal di Wijaya dengan cara "potong di bawah dagu". Berlaku untuk semua karakter manusia: Wijaya (diulang), pengikut, kepala desa, tokoh lain. Status: final sejak tahap F prajurit disetujui (17 November 2026); catatan hasil di bawah. Bisa direvisi lagi setelah prajurit diuji beranimasi.

Skrip yang dipakai ada di tools/blender/: optimasi_karakter.py (badan, termasuk --halus-daerah), abu_isi.py, kepala_ringan.py (tahap B), sambung_kepala.py (C dan D), sambung_tekstur.py (E, memakai fungsi kulit_warna.py), data_uv.py, tumpang_konsep.py, pratinjau_karakter.py (F), ekspor_mixamo.py (G), gabung_animasi.py. Angka per karakter di tools/blender/wajah.json, satu blok per karakter.

## 1. Gambar konsep (ChatGPT, oleh pengembang)

Tiga gambar per karakter, dalam satu percakapan atau dengan melampirkan gambar depan:

| Berkas | Isi | Dipakai untuk |
| --- | --- | --- |
| docs/referensi/<nama>-konsep-01.png | Seluruh badan, tampak depan, pose A (lengan sekitar 30 derajat dari badan, jari terpisah), latar putih, tanpa bingkai, tanpa senjata di tangan, kain sampai lutut, tidak ada yang menjuntai di bawah lutut | Tripo badan; acuan proporsi depan |
| docs/referensi/<nama>-kepala-01.png | Kepala dan leher sampai pangkal, tampak depan, latar putih, sanggul utuh tidak terpotong | Tripo kepala |
| docs/referensi/<nama>-samping-01.png | Seluruh badan tampak samping murni, leher hampir tegak, telinga di atas sendi bahu, lekuk dagu ke tenggorokan jelas | Acuan proporsi samping (bukan untuk Tripo) |

Unduh gambar asli, bukan tangkapan layar (tombol Edit, ikon bagikan, sudut membulat, dan bayangan ikut terbaca Tripo). Catat setiap gambar di docs/papan-referensi.md.

Contoh prompt tampak samping (lampirkan gambar depan):

```
Create an image: the exact same character as in the attached image (same face,
same body build, same clothing and accessories, same skin tone and lighting
style), now shown in an exact side view (profile) facing left, full body from
head to feet, standing straight in a neutral relaxed pose, arms hanging slightly
away from the body, plain pure white background, no shadow, no text, no weapon.
Show clearly the chin, the underside of the jaw sloping into the throat, and the
neck rising almost vertically from the shoulders, with the ear directly above
the shoulder joint.
```

## 2. Tripo (oleh pengembang)

- AI Model H2.5 (bisa diekspor di akun gratis), Generate in Parts dan 8K Texture mati.
- Badan dari gambar konsep depan, kepala dari gambar kepala. Cek tampak samping sebelum ekspor: kepala harus punya hidung menonjol dan dahi tidak menjorok.
- Ekspor GLB ke aset-mentah/<nama>-tripo.glb dan aset-mentah/<nama>-kepala-tripo.glb.
- Wajah badan yang meleleh, bercak abu-abu, dan kulit pucat itu wajar; semuanya diperbaiki skrip.

## 3. Olah dan sambung (Claude Code), dengan dua titik cek pengembang

A. Badan: optimasi ke sekitar 11.000 segitiga (tokoh utama sampai 15.000), tinggi sesuai tokoh (Wijaya 1,70 m; prajurit 1,68 m), tekstur 2048, roughness tetap 0,8 metallic 0, cage dan jarak sinar bake kecil (0,003 dan 0,01 tinggi model). Rampingkan 5 sampai 8 persen di X dan Y kalau perlu (prajurit lebih ramping dari Wijaya). Isi bercak dengan abu_isi.py; tentukan kain menurut posisi, bukan warna.

B. Kepala: buang bahu patung dada di pangkal leher, remesh hanya untuk rambut, verteks wajah ditempel kembali ke permukaan asli (simpangan wajah p95 di bawah sekitar 2 mm), decimate ke sekitar 3.500 segitiga, bake ke 1024.

C. Penempatan (CEK pengembang):
- Tinggi kepala 1/7,5 tinggi badan, diukur dari dagu ke puncak tengkorak tanpa sanggul. Jangan besarkan kepala untuk mengejar lebar leher.
- Dari samping, telinga di atas sendi bahu; sumbu leher sekitar 15 derajat atau kurang. Jangan memajukan kepala mengikuti gambar konsep kalau itu membuat leher condong.
- Leher badan dirampingkan dan ditegakkan bertahap ke ukuran leher kepala (pria sekitar 11 sampai 12,5 cm lebar dari depan; diukur setelah tengkuk dirapikan), bobot 0 di pangkal leher dan 1 di garis potong.
- Render tumpang depan dan samping, plus tumpang siluet dengan gambar konsep.

D. Potong dan sambung (prinsip inti):
1. Jangan potong kepala di bawah dagu. Pertahankan dagu, bawah rahang, dan setengah atas leher dari kepala Tripo.
2. Potong kedua mesh di tengah leher (sekitar separuh jarak ujung dagu ke tulang selangka), di tempat penampang leher berbentuk tabung sederhana.
3. Samakan jumlah verteks kedua cincin dengan menyisipkan verteks pada sudut yang sama, bridge edge loops, 2 cincin perantara, haluskan hanya di pita sambungan. Selisih penampang di bawah 10 persen.
4. Jangan pernah fill holes atau merge by distance pada seluruh mesh (merusak wajah).
5. Garis sambungan setinggi tali leher atau kalung; tali atau kalung dibuat sebagai mesh tipis yang menutupi sambungan (prajurit: tali gelap; Wijaya: kalung emas tipis).
6. Leher tidak lebih lebar dari rahang di bawah telinga.

E. Tekstur: pita sambungan beralih 3 cm dari warna kepala ke badan; kulit badan disamakan ke warna kepala dan konsep di ruang Lab (kulit_warna.py); hapus tali atau kalung lama yang tercetak di tekstur dada; cek wajah gelap sebelah (selisih L kiri-kanan) dan bidang pucat di bawah dagu.

Pelajaran dari prajurit untuk tahap A dan E:
- Tonjolan tali, kalung, atau simpul lama di badan dihaluskan pada mesh resolusi tinggi SEBELUM decimate (optimasi_karakter.py --halus-daerah). Kalau dihaluskan sesudahnya, segitiga pecah jadi serpihan dan bekasnya ikut ter-bake ke normal map.
- Kantong lipatan (simpul) yang tidak bisa diratakan boleh dibuang dalam jari-jari kecil (sekitar 3 cm) lalu ditambal permukaan baru berwarna kulit. Ini penutupan lubang lokal, tidak melanggar larangan fill holes seluruh mesh.
- Permukaan bawah dagu dari Tripo biasanya mosaik pulau UV pucat dan gelap. Ganti dengan warna kulit rata-rata dari tepi rahang dan tenggorokan.
- Saat merelaksasi verteks, verteks yang berimpit di jahitan UV harus bergerak bersama; kalau tidak, muncul retakan gelap kecil. Tepi terbuka di sekitar sambungan harus 0, dan segitiga berluas nol dibuang sebelum menghitung normal.

Pelajaran dari Wijaya (pengulangan, 17 November 2026):
- Atlas UV badan: setelah decimate, tepi pulau UV bisa keluar dari pulau asli Tripo dan mengambil warna tetangga (zig-zag terang di dada). Tata ulang pulau dengan margin dan bake warna dari mesh tinggi (optimasi_karakter.py --atlas-baru).
- Garis gelap panjang (misal di lengan) bisa berasal dari normal map, bukan warna; render tanpa tekstur tidak menunjukkannya. Ratakan di abu_isi.py.
- Telinga: beri daun telinga jatah segitiga sendiri saat decimate kepala (seperti jendela wajah); tanpa itu tepinya hancur.
- Kain berona kulit (cokelat, merah) ditentukan menurut posisi di tahap A DAN E; kalau tidak, rata-rata warna kulit salah dan badan jadi pucat.
- Rapikan helai rambut tengkuk yang terpotong SEBELUM mengukur cincin kepala; kalau sesudahnya, selisih tebal cincin bisa lebih dari 10 persen.
- Tonjolan kecil (puting, simpul) dikurangi di mesh tinggi sebelum decimate, cukup separuh, jangan rata sepenuhnya.
- Bawah dagu berjanggut: penggantian tekstur bawah dagu dibatasi menurut arah permukaan (menghadap bawah), bukan menurut tinggi.
- Badan berbahu tinggi: leher badan di garis potong bisa jauh lebih lebar dari cincin kepala (Wijaya 18,3 lawan 11,0 cm); kalung yang rebah di kulit dibuat merapat ke pangkal leher supaya tidak melebar ke otot bahu.
- Penutup sambungan: untuk leher pendek pakai pita 6 mm (10 mm membuat leher tampak lebih pendek).
- Perhiasan tambahan (kalung gantung) boleh sebagai mesh terpisah; gabung_animasi.py harus membawa semua mesh, bukan hanya yang terbesar. Laporkan di LANGKAH.md kalau Mixamo bermasalah dengan FBX dua mesh.

F. Pratinjau (CEK pengembang): depan, samping, tiga perempat, bawah dagu (sudut kamera dialog), dekat leher setinggi wajah, tumpang siluet konsep. Simpan model diam ke aset-mentah/<nama>-utuh.glb.

G. FBX untuk Mixamo ke aset-mentah/mixamo-<nama>/<nama>-untuk-mixamo.fbx dengan LANGKAH.md singkat.

## 4. Mixamo (pengembang)

Penanda: dagu di ujung bawah dagu; pergelangan di sambungan lengan bawah dan telapak; siku di lekukan siku (cenderung lebih rendah dari dugaan, sejajar atas sabuk); lutut di tengah tempurung; selangkangan di garis tengah sekitar separuh tinggi badan. Use Symmetry, Standard Skeleton (65). Unduh hanya Breathing Idle With Skin (Sway 20, Breathing 40, Overdrive 40, Arm-Space 55, 30 fps) sebagai aset-mentah/mixamo-<nama>/idle.fbx. Animasi lain dipakai ulang dari aset-mentah/mixamo/.

## 5. Gabung animasi dan masuk game (Claude Code)

Perintah lengkap ada di tools/blender/README.md bagian "Pengulangan Wijaya, bagian 2": gabung_animasi.py --model <nama>-utuh.glb --rig mixamo-<nama>/idle.fbx --mixamo aset-mentah/mixamo --blok <nama>, lalu pratinjau_animasi.py. Angka di blok <nama>.animasi di wajah.json.

Aturan bobot (dari Wijaya, 17 November 2026):
- Bobot kulit asli Mixamo dipakai apa adanya untuk badan, lengan, paha, dan lutut. Menulis ulang bobot kulit membuat paha menyusut di kuda-kuda lebar. Yang ditimpa hanya bagian yang bermasalah.
- Kain dan sabuk (ditentukan menurut posisi): Hips bergradasi sekitar 0,87 di pinggul turun ke 0,10 di tepi bawah (Hips rata membuat kain kaku dan menarik kulit ke lutut); UpLeg kiri dan kanan dicampur sama rata di garis tengah depan dan belakang, makin ke samping makin condong ke paha sisi itu (kalau tidak, kain terbelah seperti celana pendek); tanpa bobot tulang lengan.
- Kulit kaki di dalam zona kain hanya UpLeg dan Leg (Hips 0). Badan Tripo berkain tidak punya paha utuh di dalam kain.
- Kepala dan pita sambungan: gradasi Neck ke Head yang cukup lebar (prajurit: leher_bawah_m 0,045, leher_atas_m 0,02); kalau terlalu sempit, lipatan tengkuk menutupi tali saat kepala mendongak. Pita, tali, kalung rebah, dan kalung gantung mengikuti bobot kulit di bawahnya (tali yang menyatu di mesh utama: bagian.penutup_komponen) (kalau hanya Neck dan Spine2, tenggelam saat membungkuk).
- Lengan kiri pada klip Sword And Shield menempel ke badan (sifat klip): koreksi rotasi LeftArm per klip, paling banyak 25 derajat, sasaran sekitar 12 cm. Jangan menghaluskan bobot bahu (kalung tenggelam).
- Ukuran lolos: lingkar paha dan lutut di kuda-kuda terlebar minimal 0,9 dari pose A, kalung atau tali tidak tenggelam lebih dari 1 mm, tidak ada serat kain ke tangan.
- Pratinjau wajib: pinggang ke kaki (lari, tangkis terlebar, serang-1, serang-berat, jongkok-jalan, siaga; depan, samping, belakang) dan bahu dari belakang saat kontak serang.

Senjata dan klip serang (dari Wijaya, 17 November 2026):
- Klip Sword And Shield tidak dipakai untuk tokoh berkeris (lengan kiri terlipat ke dada, bahu menggelembung). Wijaya memakai aset-mentah/mixamo/baru/ (Stable Sword Outward Slash, tebasan balik, Upward Thrust Arm-Space 20, serangan berat berputar).
- Jari: klip Mixamo hanya mengunci jempol dan telunjuk (kerangka prajurit bahkan hanya punya dua jari itu; pose_genggam menghitung telapak tanpa kelingking); tangan kanan ditimpa pose menggenggam, tangan kiri setengah menggenggam.
- Sudut pasang keris satu untuk semua klip, dikalibrasi dari kontak tusukan serang-3 (bilah lurus ke sasaran); setelah pose istirahat disesuaikan, arah bilah semua serangan Wijaya sudah tepat tanpa koreksi; kalau masih meleset, betulkan dengan koreksi rotasi pergelangan RightHand per klip (paling banyak sekitar 45 derajat, bertahap) atau dengan menggeser bingkai kontak 1 sampai 3 bingkai, bukan dengan sudut keris berbeda.
- Kepala dikoreksi (Neck dan Head per klip) supaya pandangan ke arah serangan.
- Pratinjau animasi: setel fps sebelum mengimpor GLB; kalau sesudahnya, bingkai yang dirender meleset 2 sampai 3 bingkai dari kontak.
- Keris disarungkan saat lari kencang dan saat tidak ada lawan dalam jarak siaga.
- Pose istirahat: berkas Mixamo Without Skin selalu berpose istirahat T, sedangkan kerangka di game (dari idle With Skin) berpose seperti model yang diunggah (lengan menurun, selisih sekitar 50 derajat di lengan atas). gabung_animasi.py menyesuaikan setiap klip Without Skin ke satu pose T acuan per karakter. Karakter aktif saat mengunduh tidak berpengaruh, jadi klip tidak perlu diunduh ulang per karakter. Tanpa penyesuaian ini lengan menembus dada, tangan kiri ke belakang punggung, bahu menggelembung, dan arah keris meleset.
- Koreksi buka lengan per klip dan per sisi (paling banyak 12 derajat, jarak lengan ke badan minimal 2 cm), angka di blok karakter.
- Gerak pemain: jalan pelan klip jalan 1,4 m/s, lari santai lari-santai 2,7 m/s, lari kencang lari-kencang 5,8 m/s; timeScale klip gerak dijaga dekat 1 (paling banyak sekitar 1,3). Serang ringan 0,50 s, berat 0,95 s.
- Telapak kaki: buang sumbu pinggul yang benar (maju di bidang datar, naik-turun dipertahankan), lalu geser tiap klip supaya sendi kaki terendah tepat di tanah.

Sisa yang diketahui (belum diselesaikan): bahu menggelembung pada klip serang Sword And Shield di badan berotot (bawaan klip; jalan keluarnya klip serang lain yang lebih cocok untuk keris), lutut menyusut saat ditekuk dalam (0,85 lari, 0,78 mati).

Model aktif di game lewat ?model=<nama>; versi lama dicadangkan ke aset-mentah/arsip/.

## Templat prompt untuk karakter baru

```
Baca docs/standar-karakter.md dan ikuti seluruh prosedurnya untuk karakter <nama>.
Bahan: aset-mentah/<nama>-tripo.glb, aset-mentah/<nama>-kepala-tripo.glb,
docs/referensi/<nama>-konsep-01.png, <nama>-kepala-01.png, <nama>-samping-01.png.
Tinggi badan <x> m, target segitiga badan <n>, penutup sambungan: <tali/kalung, warna>.
Catatan khusus: <misal lebih ramping, berjanggut, luka di paha>.
Rencana singkat dulu, berhenti di CEK C dan CEK F, lalu tahap G.
```

## Catatan hasil

- Prajurit Kediri (17 November 2026): CEK C disetujui tanpa memajukan kepala; sambungan tertutup tali, dagu dan rahang utuh, leher proporsional. 
  Hasil F: 14.107 segitiga (badan 9.807, kepala 3.338, pita 288, tali 704), tinggi 1,68 m, kepala 22,2 cm (1/7,6), cincin 54 dan 72 verteks disamakan jadi 48 kolom dengan selisih penampang 0,1 persen, pita 2 cincin setinggi 1,5 cm, sumbu leher 10,3 derajat, telinga tepat di atas sendi bahu, selisih L pipi kiri-kanan 2,2. Angka ini acuan untuk karakter berikutnya.
- Raden Wijaya, pengulangan (17 November 2026): terpasang di game (commit 3d263ee, 14 aksi, 2,98 MB). CEK C dan F disetujui, ramping 0 (bahu +8 persen dari prajurit). 14.986 segitiga (badan 10.579, kepala 3.424, pita 258, pita emas 6 mm 352, kalung gantung terpisah 400), 1,70 m, kepala 22,7 cm (1/7,5), cincin 51 dan 62 verteks jadi 43 kolom, selisih penampang 0,4 dan 1,1 persen, sumbu leher 8,5 derajat, leher 11,0 x 9,1 cm. Commit d3dc9d7. Sisa: bercak samar pergelangan kiri dan tumit kanan, serpihan kecil puncak telinga, garis tipis tulang dada, gelang lengan non-logam.
  Sisa yang diterima: satu tonjolan kecil di garis rambut dekat telinga, garis tipis samar di kulit leher dan dada (tidak terlihat dari jarak kamera game), detail kulit bawah dagu hilang karena diganti warna rata.
