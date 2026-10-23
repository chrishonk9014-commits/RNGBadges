import { fileURLToPath } from 'node:url';
import { buildApp } from './app';
import { openDatabase } from './db';
import { GameService } from './game';

const port = Number(process.env.PORT ?? process.env.API_PORT ?? 8787);
const host = process.env.HOST ?? '0.0.0.0';
const dbPath = process.env.DB_PATH ?? fileURLToPath(new URL('../../data/rngbadges.db', import.meta.url));
const clientDir = process.env.CLIENT_DIR ?? fileURLToPath(new URL('../../dist/client', import.meta.url));

const db = openDatabase(dbPath);
const game = new GameService({ db });
// Warnings and errors only by default; LOG_LEVEL=info adds a line per request.
const app = await buildApp({
  game,
  clientDir,
  logger: { level: process.env.LOG_LEVEL ?? 'warn' },
  trustProxy: process.env.TRUST_PROXY === '1',
});

await app.listen({ port, host });
console.log(`RNG Badges server on http://localhost:${port} (database: ${dbPath}, ${game.registry.badges.length} badges)`);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void app.close().then(() => {
      db.close();
      process.exit(0);
    });
  });
}
