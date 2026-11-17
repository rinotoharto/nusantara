# Prompt: gerak lari dan klip serang baru (17 November 2026)

Dijalankan sebelum prajurit masuk game (docs/prompt-prajurit-game.md), supaya prajurit langsung memakai klip baru. Tempel ke sesi Claude Code baru:

```
Baca docs/prompt-gerak-serang.md dan jalankan. Rencana singkat dulu, tunggu persetujuan saya.
```

---

Baca CLAUDE.md, docs/standar-karakter.md (tahap 5), aset-mentah/mixamo/LANGKAH.md (bagian "Klip baru"), tools/blender/README.md (Pengulangan Wijaya bagian 2), src/character/model-wijaya.ts, src/character/player.ts, src/data/stealth.json, src/data/combat.json.

Latar: (1) gerak biasa 2 m/s memutar klip jalan 1,4 kali dan lari 7,5 m/s memutar klip lari hampir 2 kali, sehingga terasa seperti jalan dipercepat; (2) klip serang Sword And Shield membuat lengan kiri terlipat ke dada dan bahu menggelembung (bawaan klip). Klip pengganti sudah diunduh ke aset-mentah/mixamo/baru/.

1. Ukur laju langkah asli lari-santai.fbx, lari-kencang.fbx, dan jalan.fbx (cara sama dengan LAJU_KLIP di model-wijaya.ts). Ukur juga durasi dan bingkai kontak (tangan kanan paling jauh ke depan atau paling cepat) serang-1, serang-2, serang-3, serang-berat.

2. Skema gerak baru (angka di stealth.json, bukan di kode):
   - Gerak biasa (WASD): lari-santai, kecepatan mendekati laju asli klip (sasaran sekitar 4 m/s, timeScale 0,9 sampai 1,15).
   - Lari kencang (Shift): lari-kencang, kecepatan mendekati laju asli klip, timeScale paling banyak 1,3.
   - Jongkok: tetap.
   - Jalan pelan: klip jalan pada laju aslinya (sekitar 1,4 m/s), hanya saat stik gamepad didorong sedikit atau tombol tahan jalan (usulkan tombol, misalnya Alt atau CapsLock; masukkan ke input.json). Juga dipakai di area tanpa bahaya kalau misi menandainya.
   - Suara langkah per gerak di stealth.json (usulan: jalan pelan 5, lari santai 8, lari kencang 12, jongkok 2).
   - Transisi antar klip halus (crossfade, sinkron fase kaki kalau mudah).
   - Cek keseimbangan: pengikut (kecepatanMaks) bisa mengejar pemain, pemain masih bisa kabur dari harimau dan lawan seperti sebelumnya, waktu tempuh jalur misi tidak berubah jauh. Laporkan angka lama dan baru.

3. Klip serang baru menggantikan yang lama untuk Wijaya: serang-1, serang-2, serang-3, serang-berat dari baru/. Potong awalan lambat, buang perpindahan pinggul XZ (maju diatur kode), atur timeScale supaya bingkai kontak jatuh di jendelaKena combat.json (ringan durasi 0,36 s, berat 0,75 s); kalau klip baru butuh durasi lain supaya tidak terlalu cepat, usulkan angka combat.json baru, jangan ubah sendiri. Tangkis, hindar, terkena, mati, siaga tetap klip lama. Cek lengan kiri serang-3 (Arm-Space 20): kalau menempel ke badan, koreksi kecil per klip seperti sebelumnya. Tikaman Keris dan Sergap tetap memakai serang-3.

4. Gabung ulang Wijaya (gabung_animasi.py --blok wijaya_ulang) dengan klip baru. Pratinjau: bingkai kontak tiap serang (depan, samping, belakang), bahu kiri dari belakang, lari santai dan lari kencang (langkah terlebar, depan dan samping), serta ukuran paha dan kain seperti sebelumnya. Berhenti dan tunggu persetujuan saya sebelum mengganti public/models/wijaya.glb.

5. Setelah disetujui: pasang, uji di game ?model=wijaya (jalan pelan, lari santai, lari kencang, kombo, serang berat), perbarui README dan LANGKAH.md, commit "Gerak lari baru dan klip serang keris".

Catatan: keputusan prajurit bertameng ditunda. Prajurit nanti memakai klip baru yang sama kecuali ada perubahan.
