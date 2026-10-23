import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiPort = Number(process.env.API_PORT ?? 8787);

export default defineConfig({
  root: 'src/client',
  plugins: [react()],
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
  },
  server: {
    port: Number(process.env.PORT ?? 5173),
    proxy: {
      '/api': `http://localhost:${apiPort}`,
    },
  },
});
