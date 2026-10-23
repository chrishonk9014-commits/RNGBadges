import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiPort = Number(process.env.API_PORT ?? 8787);
const page = (path: string) => fileURLToPath(new URL(`./src/client/${path}`, import.meta.url));

/** Two pages: the website at "/" and the game at "/play/". */
export default defineConfig({
  root: 'src/client',
  appType: 'mpa',
  plugins: [react()],
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
    rollupOptions: {
      input: { site: page('index.html'), play: page('play/index.html') },
    },
  },
  server: {
    port: Number(process.env.PORT ?? 5173),
    proxy: {
      '/api': `http://localhost:${apiPort}`,
    },
  },
});
