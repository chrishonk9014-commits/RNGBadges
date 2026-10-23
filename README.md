# RNG Badges

Roll a number. Find out what's hiding in it.

Every roll is one draw from **000000–999999**, or **1000000**, the only seven-digit number in the game. The game checks it against every badge in the catalog at once: funny numbers, references, math, poker hands, calendar dates and more. One roll can earn many badges. They're revealed worst to best, and every badge in the roll adds its XP to that roll's total. The total decides how rare the roll is, on a sixteen-step ladder from **Common** to **INFINITE**, and the next roll starts again from zero. Badges you find are kept in your collection forever. Two global leaderboards track the best single roll anyone has made and who has found the most badges.

There are 652 badges today, every one with its own name, condition and exact odds. The engine is built to take 2,500+ without slowing down or getting harder to maintain (see [Adding badges](#adding-badges)).

## Quick start

Requires **Node 22.13+** (it uses the built-in `node:sqlite`).

```bash
npm install
npm run dev        # API on :8787 + Vite on http://localhost:5173
```

The website is at `/` and the game at `/play/`.

Production:

```bash
npm run build      # client → dist/client, server → dist/server
npm start          # one process serves the website, the game and the API on http://localhost:8787
```

| Env var | Default | |
|---|---|---|
| `PORT` | `8787` | HTTP port |
| `HOST` | `0.0.0.0` | Bind address |
| `DB_PATH` | `data/rngbadges.db` | SQLite file (created on first run) |
| `LOG_LEVEL` | `warn` | `info` logs every request |
| `TRUST_PROXY` | off | Set to `1` behind a reverse proxy so per-IP limits see real client IPs |

Other scripts: `npm test`, `npm run typecheck`, `npm run odds` (regenerate exact badge and rarity odds), `npm run balance` (exact roll-rarity report).

## Website

`/` is the game's website: what RNG Badges is, a playable demo, a number checker, the badge families, the closer-pays-more reference tiers, the 1000000 skip odds, the rarity ladder, both leaderboards and an FAQ. Its Play buttons go to the full game at `play/`, and the game's logo links back.

The demo and the checker run the real badge engine in the browser (`src/client/site/engine.ts`), using the game's own roll and reveal components. Demo rolls are never saved. After five demo rolls, a **Try the full game to save!** button appears under the Roll button and takes you to the game. When the site is served by the game server, the leaderboard section shows the live top five on each board.

**Repo website:** https://chrishonk9014-commits.github.io/RNGBadges/ is the website, and https://chrishonk9014-commits.github.io/RNGBadges/play/ is the full game. Both are served by GitHub Pages from the `gh-pages` branch. The `Website` workflow (`.github/workflows/website.yml`) runs the tests, rebuilds the site and republishes `gh-pages` on every push to `main`; it can also be run by hand from the Actions tab.

`npm run build:site` builds the website and the game into `dist/site`: a static copy with relative paths and no server calls, for any static host. There's no server behind it, so the game runs entirely in the browser (`src/client/local/`):

- `localGame.ts` follows the server's rules and returns the same responses, and `localApi.ts` answers the game's API requests with it. The UI is the same code in both versions.
- Rolls use the browser's cryptographic random number generator (`crypto.getRandomValues`).
- Progress (collection, roll count, ten best rolls) is saved in `localStorage`. Profile → **Download save** / **Load a save file** backs it up or moves it to another browser. Two open tabs share one save without undoing each other's finds.
- With no shared server there are no global leaderboards: **Top Rolls** ranks the player's own ten best rolls instead, and the website's leaderboard section explains the boards without live data.
- Because the save is in the player's browser, it can be edited. That's why this version has no global boards. Host the server (`npm start`) for real leaderboards. Badge counts, odds, XP and the rarity ladder's odds on the site come from the catalog at build time, so they stay current; the hand-picked examples live in `src/client/site/content.ts`, and a test fails if an example badge is renamed or removed.

## How it plays

- **Roll.** Click **Roll** or press Space. Digits spin while the server rolls, then lock in left to right.
- **Badges Collected.** Directly under the Roll button. Badges from the roll are sorted worst to best and revealed one at a time in a spotlight. The best one lands last after a short pause, and the rest stack below it. Every badge shows its name, tier, odds and XP. A **NEW** tag means it just joined your collection; **Found before** means you already had it, and it still counts. Rolling again mid-reveal finishes the current reveal at once and moves it to **Recent Rolls**, so nothing is lost. With reduced motion (OS setting or Profile → Motion), digits don't spin and badges appear all at once.
- **XP and rarity, per roll.** A roll's XP is every badge in it added together, found before or not. The rarity panel climbs the ladder as each badge is revealed and settles on the roll's rarity, with its odds ("Cosmic or better: 1 in 4,739 rolls"). The next roll resets it to zero. Beating your best roll pops a toast.
- **Collection.** Every badge, with found/locked state, completion %, search (name, number, description), category/tier filters and sorting. Each found badge records the roll and roll number it came from. Secret badges stay `???` until found.
- **Leaderboards.** *Best Roll* ranks each player's single best roll by its XP and shows its rarity and standout badges. Numeric size doesn't count, so `000153` beats `984271`. *Most Badges* ranks players by how many different badges they've found. Both boards show where you stand even outside the top 50.
- **Profile.** Rename yourself and see your **save code**. Your progress lives on the server, and the code is the key to it on any device.

## The 1000000 skip mechanic

Normal rolls are six digits with leading zeros kept (`000007` stays `000007`). The 1,000,001st outcome is `1000000`, and it runs the skip mechanic:

1. Start at the first of its seven digits.
2. That position has a 1-in-10 chance to skip. If it skips, move to the next position and check again.
3. The first position that does **not** skip ends the process. No later position can skip.

So skips only ever form an unbroken run at the front: `(skip)(skip)00000` is possible, `1(skip)00000` is not. Results and their exact odds per roll:

| Result | Chance once 1000000 is rolled | Per roll |
|---|---:|---:|
| `1000000` | 9/10 | 1 in 1.1 million |
| `(skip)000000` | 9/100 | 1 in 11 million |
| `(skip)(skip)00000` | 9/1,000 | 1 in 111 million |
| … | … | … |
| `(skip)×6` + `0` | 9/10⁷ | 1 in 1.1 trillion |
| `(skip)×7` (nothing left) | 1/10⁷ | 1 in 10 trillion |

Because the digits after the `1` are all zeros, what survives the skips is always zeros. The game displays and parses any `(skip)…` text, but only these eight results can happen. Each one has its own badge (The Million, Skip!, Double Skip, … The Void). The digits that survive are also checked against every normal badge, so `(skip)000000` still reads as six zeros.

## Badges

Badges are data. Each definition has a stable id, a unique name, a plain-English condition, a rule, and optionally an XP override, a hidden flag and a family:

```ts
{
  id: 'funny.2121',
  name: 'Double Twenty-One',
  description: 'The roll starts with 2121 (2121__).',
  flavor: 'Twenty-one, twice. Double funny.',
  category: 'funny',
  rule: { kind: 'mask', mask: '2121__' },
}
```

Rule kinds: `contains`, `startsWith`, `endsWith`, `exact`, `mask` (`_` = any digit), `values` (numeric set), `skips`, `test` (any predicate over the roll's precomputed facts) and `context` (compares with your previous roll, roll count or local clock; these declare their odds). The detector indexes every keyed rule (substrings, prefixes, suffixes, exact strings, masks grouped by fixed positions, value sets), so a roll does a handful of map lookups no matter how many such badges exist. Only free-form predicates run one by one. A test checks the indexed detector against a naive rule-by-rule evaluation on thousands of rolls, and another runs a 5,000-badge catalog at well under a millisecond per roll.

**Reference closeness.** Number references (007, 1337, 1969, 404, …) pay more the closer the roll gets to being *just* that number. Each tier is its own badge, so an exact hit also reveals the lesser tiers on the way up:

| Badge | Condition | Odds | XP |
|---|---|---:|---:|
| Secret Agent | contains `007` (e.g. `210074`) | 1 in 250 | 350 |
| Licensed to Kill | ends in `007` (e.g. `913007`) | 1 in 1,000 | 900 |
| Bond. James Bond. | is exactly `000007` | 1 in 1,000,001 | 350,000 |

The tiers stack: `000007` earns all three and 13 more badges, 610,330 XP in one roll (Universal).

Two- to four-digit references get all three tiers. Five-digit ones skip "ends in" because it would be barely rarer than "contains". Six-digit ones are a single exact badge.

**Catalog (652):** funny numbers from the brief (`21____`, `55____`, `67____`, `61____`, `41____`, `69____`, `__21__`, `___67_`, `2121__`, TRIPLE 67!, `696969`), Math Equation! (one badge for every AB + CD = EF) and a few distinct operations, 163 pop-culture, tech, science and history references with closeness tiers, 34 calculator and phone-keypad words, number theory (primes, perfect numbers, taxicab numbers, narcissistic numbers…), poker hands made of digits, structural patterns, calendar and clock badges, the 1000000/skip family, and a few hidden "meta" badges (roll the same number twice, roll your own roll count, roll today's date). The validator rejects duplicate ids, names and rules, so two badges can't share a condition.

### Adding badges

1. Add a definition in `src/shared/badges/catalog/` (a reference is one row in `culture.ts`, `scienceHistory.ts` or `words.ts`).
2. `npm run odds` recomputes exact odds for every badge by enumerating all 1,000,001 outcomes (about 5 s), fails if a badge can never be earned, and regenerates the odds of each roll rarity.
3. `npm run balance` shows how the change moves the rarity ladder.
4. `npm test`, which also checks that `odds.json` and `rarityOdds.json` are current.

XP comes from odds, so a new badge prices itself. If badge values change, the server rescores every player's best roll and recounts their collection on the next start, which keeps the leaderboards consistent.

## Balance

Full write-up and exact numbers: **[BALANCE.md](BALANCE.md)**. Short version: badge XP follows a tuned rarity curve, from 10 XP for the commonest badges to 350,000 for an exact six-digit hit and millions for 1000000 and its skips. Half of all rolls are Common, 1 in 78 is Legendary or better, 1 in 4,739 is Cosmic or better (any exact-number hit), and the top rungs are pinned: `000000` is Omniversal, `1000000` Unfathomable, any skip INFINITE (1 in 10 million).

## Architecture

```
src/shared/            engine shared by server, client and scripts
  roll.ts              number generation, skip mechanic, roll text/parse
  badges/types.ts      badge definition + rule types
  badges/catalog/      the badge data (one file per family)
  badges/detector.ts   indexed detection
  badges/odds.ts       exact odds by enumeration → odds.json, rarityOdds.json
  badges/registry.ts   definitions + odds → XP, tier, quality order
  xp.ts                XP curve and badge tiers
  progression.ts       rarity thresholds (the only place they live)
  scoring.ts           roll XP and rarity
src/server/            Fastify API + SQLite (node:sqlite)
  game.ts              accounts, rolling, awards, leaderboards, rebalancing
  app.ts               routes, auth, rate limits, static client
src/client/            React UI (Vite): the game (play/, App.tsx), the website (site/)
  local/               the game's rules in the browser, for static hosting
scripts/               odds generator, balance report, build helpers
tests/                 vitest: roll/skip, badges/odds, progression/reveal, API
```

**Rolls happen on the server.** The client asks for a roll; the server draws it with `crypto.randomInt`, detects badges, scores the roll, records first discoveries and the player's best roll in a transaction, and returns the result. Leaderboards therefore only contain numbers the server actually rolled.

**Accounts** are anonymous: the first visit creates a player with a generated name and a random 256-bit save code (the server stores only its SHA-256 hash). The browser keeps the code in `localStorage`. Pasting it into Profile on another device continues the same save.

**Limits:** rolling is rate-limited per player (burst 6, then 4 per second), and new accounts per IP (burst 10, then 30 per hour). Rate limits live in memory, so the server is designed to run as a single process with one SQLite file. Running several instances would need a shared database and shared rate limiting. There are no email or password logins, and a lost save code can't be recovered.
