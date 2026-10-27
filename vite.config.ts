import { defineConfig } from 'vite';

// Base './' supaya hasil build bisa dipasang di GitHub Pages atau itch.io tanpa server.
export default defineConfig({
  base: './',
  server: { port: 5173 },
});
