import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Vital for GitHub Pages deployment under subpaths
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true
  },
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.js']
  }
});
