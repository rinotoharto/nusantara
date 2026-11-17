# Prompt sprint visual (dijalankan SETELAH misi 4 disusun ulang dan prajurit masuk game)

Disiapkan 17 November 2026 dari referensi video Instagram (kapal di lorong tebing, Three.js + Blender): kesan realistisnya datang dari cahaya, kabut, air, dan olah warna, bukan dari poligon banyak. Tempelkan blok di bawah ke Claude Code.

```
Sprint visual: tingkatkan tampilan Nusantara tanpa mengubah gameplay.
Baca CLAUDE.md, docs/gdd.md (susunan 8 misi), src/world/lighting.ts, src/main.ts,
src/data/settings.json, src/world/river.ts, src/world/torch.ts, src/world/boat.ts.

Kondisi sekarang: ACES tone mapping sudah ada, kabut linear (45-125 m) warna langit
datar, satu DirectionalLight + HemisphereLight, PCFShadowMap 2048, preset kualitas
rendah/sedang/tinggi hanya mengatur bayangan dan rasio piksel. Belum ada pascaproses,
langit, peta lingkungan, atau shader air.

Tujuan: suasana sinematik yang konsisten per misi, tetap lancar di laptop biasa
(target 60 fps di "sedang" pada laptop integrated GPU, minimal 30 fps di "rendah").

Kerjakan bertahap, satu commit per butir, dan buat tangkapan layar sebelum/sesudah
dari 3 sudut tetap (tambahkan ?kamera=foto1..3 kalau perlu) ke docs/visual/.

1. Suasana data-driven. Buat src/data/suasana.json berisi preset per misi/segmen:
   warna dan arah matahari, intensitas, warna langit atas/horison, kabut (warna,
   kepadatan), exposure, olah warna (saturasi, kontras, suhu, vignette, grain),
   bloom. Minimal preset: "sore-keemasan" (sekarang), "malam-pelarian" (biru kelam,
   bulan, obor jadi sumber utama), "fajar-sawah" (Sawah Miring), "kabut-sungai"
   (Kali Mas, Krembangan), "siang-hutan" (Hutan Tarik). lighting.ts membaca preset;
   misi memilih preset lewat JSON misinya; transisi antar preset halus (2-3 detik).

2. Langit dan cahaya lingkungan. Pakai Sky dari three/examples (atau gradien shader
   ringan) mengikuti arah matahari preset; buat environment map dari langit itu
   dengan PMREMGenerator supaya kulit, logam keris, dan air memantulkan langit.
   Jangan unduh HDRI dari internet tanpa saya setujui (lisensi); kalau perlu HDRI,
   usulkan dulu sumbernya (Poly Haven CC0) dan ukurannya.

3. Kabut berlapis. Ganti Fog linear dengan FogExp2 atau kabut shader yang:
   memudar ke warna horison (bukan satu warna datar), lebih tebal di dekat tanah dan
   air (kabut ketinggian), sehingga tebing dan hutan jauh tampak berlapis seperti
   referensi. Pertahankan aturan desain: tujuan baru terlihat setelah sebagian besar
   jalur ditempuh, dan pendar obor tetap tembus kabut.

4. Pascaproses dengan EffectComposer (three/examples/jsm/postprocessing) urutan:
   RenderPass -> SAO/GTAO ringan (hanya "tinggi") -> UnrealBloomPass (ambang tinggi,
   hanya obor, matahari, kilau air) -> satu pass olah warna buatan sendiri
   (lift/gamma/gain atau LUT kecil, saturasi, suhu, vignette, film grain tipis)
   -> OutputPass. Semua angka dari suasana.json. Grain dan vignette harus halus;
   teks HUD dan subtitle tidak boleh ikut terkena (HUD tetap DOM).

5. Air. Untuk sungai, Kali Mas, dan laut dekat Hujung Galuh: shader air dengan
   gelombang (Gerstner beberapa lapis atau Water dari three/examples), normal map
   bergerak, pantulan langit dari env map, kilau matahari, warna lebih gelap di
   dalam, buih tipis di tepi/haluan perahu. Perahu dan pemain ikut naik-turun
   sedikit di air. Jangan pakai pantulan planar penuh di "rendah"/"sedang".

6. Material dan bayangan. Bayangan lembut (PCFSoftShadowMap atau VSM di "tinggi"),
   kaskade sederhana atau kamera bayangan yang mengikuti pemain supaya resolusi tetap
   tajam di dekat; contact shadow sederhana di kaki karakter. Periksa roughness/
   metalness: kulit dan kain kasar (0.8-0.9, metallic 0), keris dan perhiasan emas
   metallic. Tanah dan tebing beri variasi warna dan normal map ringan supaya tidak
   datar. Obor: cahaya berkedip dan bayangan hanya dari 1-2 obor terdekat.

7. Kamera sinematik. Untuk panel prolog, dialog, dan momen besar (Kali Mas sisa 12,
   perahu ke Hujung Galuh): FOV sedikit lebih sempit (40-50), komposisi terkunci,
   gerak kamera pelan; kedalaman ruang (bokeh) ringan hanya saat dialog di "tinggi".

8. Kualitas. Perluas settings.json: tiap preset mengatur bayangan, rasio piksel,
   bloom, AO, kualitas air, grain, jarak kabut/gambar. "rendah" tanpa pascaproses
   kecuali olah warna. Mode otomatis tetap memilih dari fps. Tambahkan statistik
   (draw call, segitiga, fps) di ?playtest=1.

Aturan: jangan mengubah gameplay, collision, jarak pandang penjaga, atau keterbacaan
jalur (pemain harus tetap tahu arah dalam kabut dan malam). Malam harus gelap tapi
jalur, musuh, dan Tribhuwaneswari tetap terbaca. Semua dependensi dari paket three
yang sudah ada; tanpa pustaka baru kecuali saya setujui. Lapor ukuran bundle dan fps
di tiga preset sebelum dan sesudah. Rencana singkat dulu, tunggu persetujuan saya.
```

## Poin yang diambil dari referensi

| Di referensi | Untuk Nusantara |
| --- | --- |
| Tebing jauh memudar ke putih (udara berlapis) | Kabut warna horison + kabut ketinggian di hutan, lembah, sungai |
| Panel "Grade: Soft glow" | Olah warna per misi lewat suasana.json |
| Panel "Light: Summer shimmer" | Preset cahaya per misi (sore, malam, fajar, kabut) |
| Panel "Water: Nordic slate", kilau matahari di ombak | Shader air Kali Mas dan laut Hujung Galuh, env map langit |
| "Grain" | Film grain tipis, juga menyamarkan tekstur Tripo |
| Lampu kapal berpendar | Bloom untuk obor dan matahari |
| FOV kecil, kamera terkunci | Kamera sinematik untuk prolog, dialog, momen besar |
| Satu adegan, satu objek | Tidak bisa ditiru penuh: game butuh banyak karakter dan AI, maka ada preset kualitas |
