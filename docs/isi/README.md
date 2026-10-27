# Isi sejarah untuk src/data

Berkas di folder ini ditulis di chat Cowork (Fable) dan menjadi sumber kebenaran untuk isi dialog dan Kitab. Setelah sprint 4 selesai, salin:

- docs/isi/dialog.json → src/data/dialog.json
- docs/isi/codex.json → src/data/codex.json

Jangan minta Claude Code mengubah teks di sini; kalau skema JSON berubah, ubah berkas ini dulu lalu salin lagi.

Penanda TODO-VERIFIKASI di dalam teks berarti kalimat itu ditulis dari ingatan dan harus dicek ke sumber sebelum rilis. Daftar sumber yang dipakai ada di tiap entri.

Catatan desain dialog kudadu-tiba:
- Nada hormat: kepala desa langsung percaya karena kejujuran. Tandai kudadu-nada-hormat.
- Nada tegas: kepala desa patuh tapi memperingatkan bahaya; nama Wijaya terucap keras. Tandai kudadu-nada-tegas (bisa dipakai misi nanti: patroli pagi lebih waspada).
- Nada licik: kebohongan ketahuan, pemain dipaksa jujur lewat simpul tambahan. Tandai kudadu-nada-licik. Pelajaran: siasat tidak berarti berbohong pada rakyat sendiri.
- Baris "bendungan di hulu sungai" merujuk tradisi pembangunan air oleh raja-raja Singasari; TODO-VERIFIKASI apakah ada bukti untuk Kertanagara, kalau tidak ganti dengan "candi" atau "jalan".
