import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const dashboardDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    fs: {
      allow: [dashboardDir, path.resolve(dashboardDir, '..')],
    },
  },
});
