import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json' with { type: 'json' };

const repoUrl = process.env.GITHUB_REPOSITORY ? `https://github.com/${process.env.GITHUB_REPOSITORY}` : pkg.repository.url;

/**
 * Standalone build of the website alone, with relative asset paths and no
 * API calls, for hosting it as a static page away from the game server.
 * `npm run build:site` turns the output into dist/site.
 */
export default defineConfig({
  root: 'src/client',
  base: './',
  plugins: [react()],
  define: {
    'import.meta.env.VITE_STANDALONE': JSON.stringify('1'),
    'import.meta.env.VITE_REPO_URL': JSON.stringify(repoUrl),
  },
  build: {
    outDir: '../../dist/site',
    emptyOutDir: true,
    rollupOptions: { input: fileURLToPath(new URL('./src/client/index.html', import.meta.url)) },
  },
});
