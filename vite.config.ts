import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the built site works from any static host, including a
// GitHub Pages project subpath, with no server-side configuration.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: false },
  test: { environment: 'node', globals: true, include: ['src/**/*.test.ts'] },
});
