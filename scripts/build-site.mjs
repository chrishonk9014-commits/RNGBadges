// Builds the website on its own into dist/site: a static copy with relative
// asset paths and no game-server calls, ready for any static host.
import { build } from 'vite';

await build({ configFile: 'vite.site.config.ts', logLevel: 'warn' });
console.log('Static website written to dist/site');
