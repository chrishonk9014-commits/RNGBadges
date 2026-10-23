import { existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest, type FastifyServerOptions } from 'fastify';
import type { ApiError } from '../shared/api';
import { GameError, GameService } from './game';
import { RateLimiter } from './rateLimit';

export interface AppOptions {
  game: GameService;
  /** Directory with the built client to serve, if any. */
  clientDir?: string;
  logger?: FastifyServerOptions['logger'];
  /** Trust X-Forwarded-For for client IPs. Only enable behind a reverse proxy you control. */
  trustProxy?: boolean;
  /** Rolls: burst size and sustained rolls per second per player. */
  rollBurst?: number;
  rollsPerSecond?: number;
  /** New accounts per IP: burst and per-hour refill. */
  registerBurst?: number;
  registersPerHour?: number;
  now?: () => number;
}

const LEADERBOARD_MAX = 100;

export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const { game } = options;
  const app = Fastify({ logger: options.logger ?? false, bodyLimit: 4 * 1024, trustProxy: options.trustProxy ?? false });
  const rollLimiter = new RateLimiter(options.rollBurst ?? 6, options.rollsPerSecond ?? 4, options.now);
  const registerLimiter = new RateLimiter(options.registerBurst ?? 10, (options.registersPerHour ?? 30) / 3600, options.now);

  app.addHook('onSend', async (_req, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('X-Frame-Options', 'DENY');
    reply.header(
      'Content-Security-Policy',
      "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'",
    );
    return payload;
  });

  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof GameError) {
      const body: ApiError = { error: error.code, message: error.message };
      if (error.retryAfterMs !== undefined) {
        body.retryAfterMs = error.retryAfterMs;
        reply.header('Retry-After', Math.ceil(error.retryAfterMs / 1000));
      }
      return reply.status(error.status).send(body);
    }
    const status = (error as { statusCode?: number }).statusCode;
    if (status && status >= 400 && status < 500) {
      return reply.status(status).send({ error: 'bad_request', message: (error as Error).message } satisfies ApiError);
    }
    app.log.error(error);
    return reply.status(500).send({ error: 'server_error', message: 'Something went wrong.' } satisfies ApiError);
  });

  const bearer = (req: FastifyRequest): string | undefined => {
    const header = req.headers.authorization;
    return header?.startsWith('Bearer ') ? header.slice(7).trim() : undefined;
  };
  const optionalPlayer = (req: FastifyRequest): number | null => game.authenticate(bearer(req));
  const requirePlayer = (req: FastifyRequest): number => {
    const id = optionalPlayer(req);
    if (id === null) throw new GameError(401, 'unauthorized', 'Unknown or missing save code.');
    return id;
  };
  const limitParam = (req: FastifyRequest): number => {
    const raw = Number((req.query as { limit?: string }).limit ?? 50);
    return Number.isFinite(raw) ? Math.max(1, Math.min(LEADERBOARD_MAX, Math.floor(raw))) : 50;
  };

  app.get('/api/health', async () => ({ ok: true }));

  let gzippedCatalog: { version: string; body: Buffer; raw: string } | null = null;
  app.get('/api/catalog', async (req: FastifyRequest, reply: FastifyReply) => {
    const catalog = game.catalog();
    if (gzippedCatalog?.version !== catalog.version) {
      const raw = JSON.stringify(catalog);
      gzippedCatalog = { version: catalog.version, raw, body: gzipSync(raw) };
    }
    const etag = `"${catalog.version}"`;
    reply.header('ETag', etag).header('Cache-Control', 'no-cache').header('Vary', 'Accept-Encoding');
    if (req.headers['if-none-match'] === etag) return reply.status(304).send();
    reply.type('application/json; charset=utf-8');
    if (String(req.headers['accept-encoding'] ?? '').includes('gzip')) {
      return reply.header('Content-Encoding', 'gzip').send(gzippedCatalog.body);
    }
    return reply.send(gzippedCatalog.raw);
  });

  app.post('/api/players', async (req, reply) => {
    const wait = registerLimiter.take(req.ip);
    if (wait > 0) throw new GameError(429, 'slow_down', 'Too many new accounts from here. Try again later.', wait);
    const body = (req.body ?? {}) as { username?: unknown };
    const username = typeof body.username === 'string' ? body.username : undefined;
    return reply.status(201).send(game.register(username));
  });

  app.get('/api/me', async (req) => game.profile(requirePlayer(req)));

  app.patch('/api/me', async (req) => {
    const id = requirePlayer(req);
    const body = (req.body ?? {}) as { username?: unknown };
    if (typeof body.username !== 'string') throw new GameError(400, 'bad_username', 'Send a username.');
    return game.rename(id, body.username);
  });

  app.post('/api/roll', async (req) => {
    const id = requirePlayer(req);
    const wait = rollLimiter.take(String(id));
    if (wait > 0) throw new GameError(429, 'slow_down', 'Rolling too fast.', wait);
    const body = (req.body ?? {}) as { tzOffset?: unknown };
    return game.roll(id, typeof body.tzOffset === 'number' ? body.tzOffset : 0);
  });

  app.get('/api/leaderboard/xp', async (req) => game.xpLeaderboard(limitParam(req), optionalPlayer(req)));
  app.get('/api/leaderboard/best', async (req) => game.bestLeaderboard(limitParam(req), optionalPlayer(req)));
  app.get('/api/stats/badges', async () => game.badgeStats());

  app.all('/api/*', async () => {
    throw new GameError(404, 'not_found', 'No such endpoint.');
  });

  if (options.clientDir && existsSync(options.clientDir)) {
    // "/" is the website, "/play/" is the game; "/play" redirects to "/play/".
    await app.register(fastifyStatic, { root: options.clientDir, redirect: true });
    app.setNotFoundHandler((req, reply) => {
      if (req.method === 'GET' && !req.url.startsWith('/api/')) return reply.sendFile('index.html');
      return reply.status(404).send({ error: 'not_found', message: 'Not found.' } satisfies ApiError);
    });
  }

  return app;
}
