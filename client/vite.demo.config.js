// Builds the live demo: one self-contained HTML file with the API mocked in the browser.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: 'dist-demo',
    emptyOutDir: true,
    assetsInlineLimit: 100000000,
    rollupOptions: { input: 'demo.html' },
  },
  server: { fs: { allow: ['..'] } },
});
