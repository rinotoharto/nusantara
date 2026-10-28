import { defineConfig } from 'vite';

// Base './' (jalur relatif) supaya hasil build bisa dipasang di GitHub Pages di bawah nama repo apa pun
// (https://<pengguna>.github.io/<repo>/) maupun di itch.io, tanpa perlu menyebut nama repo di sini.
// Kalau suatu saat ingin jalur mutlak, isi BASE_PATH, misalnya BASE_PATH=/nusantara/ npm run build.
export default defineConfig({
  base: process.env.BASE_PATH ?? './',
  server: { port: 5173 },
  // three.js memang besar (sekitar 700 kB sebelum gzip); batas peringatan dinaikkan supaya build bersih.
  build: { chunkSizeWarningLimit: 900 },
});
