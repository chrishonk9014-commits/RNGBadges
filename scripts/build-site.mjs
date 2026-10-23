// Builds the website on its own into dist/site: a static copy with relative
// asset paths and no game-server calls, ready for any static host.
import { writeFileSync } from 'node:fs';
import { build } from 'vite';

await build({ configFile: 'vite.site.config.ts', logLevel: 'warn' });
// GitHub Pages: serve the files as they are, without a Jekyll pass.
writeFileSync('dist/site/.nojekyll', '');
console.log('Static website written to dist/site');
