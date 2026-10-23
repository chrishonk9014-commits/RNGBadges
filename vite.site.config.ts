import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json' with { type: 'json' };

const repoUrl = process.env.GITHUB_REPOSITORY ? `https://github.com/${process.env.GITHUB_REPOSITORY}` : pkg.repository.url;

/**
 * Standalone build of the website and the game, with relative asset paths,
 * for static hosts with no game server (GitHub Pages). The game then runs in
 * the browser and saves there (src/client/local). `npm run build:site`
 * turns the output into dist/site.
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
    rollupOptions: {
      input: {
        site: fileURLToPath(new URL('./src/client/index.html', import.meta.url)),
        play: fileURLToPath(new URL('./src/client/play/index.html', import.meta.url)),
      },
    },
  },
});
