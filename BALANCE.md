# Balance

All numbers below come from `npm run balance`: exact badge odds (`odds.json`, from enumerating every possible roll), the XP curve in `src/shared/xp.ts`, and the thresholds in `src/shared/progression.ts`. Each simulated player draws the roll on which they first find each badge. `--verify` cross-checks this against real rolls through the real detector, and the two agree.

## Goals

1. **Rarer always pays more.** XP is a function of a badge's exact odds and never decreases with rarity (a test enforces this).
2. **Every rarity on the ladder means something.** Early ranks come in minutes, the middle takes hours, and INFINITE takes hundreds of hours of rolling.
3. **Jackpots feel like jackpots.** Rolling *exactly* a reference (`000007`) is worth about 3,400× just spotting it.
4. **Grinding beats lottery for the ladder.** Reaching INFINITE takes no impossible luck. The 1-in-a-billion skip badges are bragging rights, not a requirement.

## The constraint that shapes everything

XP only comes from **first discoveries**, so the whole game holds a fixed pool of XP. A normal roll can't be rarer than 1 in 1,000,001 (one exact six-digit number), and 212 badges sit at that floor. Two facts follow:

- To make INFINITE (3,200,000 XP) reachable, those one-in-a-million badges must carry roughly **3.5 million XP** between them, about 17,000 each.
- Early on, every one of them is still unfound, so together they pay about **3.6 XP per roll on average** (212 × 17,000 / 1,000,001). That sets how fast a lucky player can climb. In practice it means one jackpot roughly every 4,700 rolls.

Everything else in the curve is tuned around that: cheap badges are kept cheap so the first ranks are earned by exploring, not by one lucky roll.

### Why `contains 007` isn't 2,000 XP and `000007` isn't 1,000,000

Those were the suggested ballparks. With the thresholds above, both values break the ladder:

- **1,000,000 for an exact match**: there are 212 exact-match badges, and a player finds one about every 4,700 rolls (≈40 minutes). Four of them would reach INFINITE in an afternoon.
- **2,000 for "contains 007"**: it comes up once every 250 rolls, alongside about 45 other three-digit references. Players would pass Celestial (50,000 XP) inside ten minutes.

What carried over is the shape. Contains → ends in → exactly is 5 → 10 → 17,000 XP, so the exact hit is worth about 3,400× spotting the reference, against roughly 500× in the suggested numbers. The one place the game does pay 1,000,000 XP is the skip results of 1000000 rarer than 1 in a billion (Triple Skip and beyond). If you'd rather have the bigger numbers, raise the thresholds in `progression.ts` and the curve points in `xp.ts` by the same factor; pacing stays identical.

## XP curve

Odds "1 in N" → XP, joined on a log-log scale, rounded to friendly numbers (multiples of 5 below 100, two significant figures above):

| 1 in N | XP |
|---:|---:|
| ≤ 200 | 5 |
| 1,000 | 10 |
| 10,000 | 30 |
| 100,000 | 300 |
| 1,000,000 | 16,500 (shows as 17,000) |
| 10,000,000 | 150,000 |
| ≥ 1,000,000,000 | 1,000,000 (cap) |

## Badge tiers

Tier names come from the reward table in the brief, assigned by odds:

| Tier | Odds | Badges | XP each | Total XP |
|---|---|---:|---:|---:|
| Common | commoner than 1 in 50 | 29 | 5 | 145 |
| Uncommon | 1 in 50 – 300 | 91 | 5 | 455 |
| Recognizable | 1 in 300 – 2,000 | 65 | 10–15 | 660 |
| Unusual | 1 in 2,000 – 8,000 | 94 | 15–20 | 1,875 |
| Rare | 1 in 8,000 – 30,000 | 119 | 30–80 | 3,745 |
| Very Rare | 1 in 30,000 – 200,000 | 30 | 100–560 | 6,190 |
| Extremely Rare | 1 in 200,000 – 900,000 | 5 | 1,000–1,500 | 5,500 |
| Legendary | 1 in 900,000 – 5 million | 212 | 14,000–18,000 | 3,602,000 |
| Special Secret | rarer than 1 in 5 million | 7 | 160,000–1,000,000 | 5,560,000 |

3,620,570 XP sits in badges a dedicated player can find. Another 5,560,000 sits in the seven skip results (1 in 11 million and rarer).

## Pacing

Active play at 2 rolls per second (7,200 rolls an hour). "Lucky" and "unlucky" are the 10th and 90th percentiles.

| Rarity | XP | Lucky 10% | Median | Unlucky 90% |
|---|---:|---:|---:|---:|
| Uncommon | 100 | 3s | 5s | 6s |
| Notable | 300 | 15s | 21s | 27s |
| Rare | 750 | 1m | 2m | 2m |
| Epic | 1,500 | 3m | 5m | 7m |
| Legendary | 3,000 | 4m | 16m | 21m |
| Mythic | 6,000 | 4m | 27m | 1.2h |
| Exotic | 12,000 | 4m | 27m | 1.5h |
| Divine | 25,000 | 20m | 1.1h | 2.2h |
| Celestial | 50,000 | 42m | 1.7h | 3.5h |
| Transcendent | 100,000 | 2.0h | 3.7h | 6.1h |
| Cosmic | 200,000 | 5.2h | 7.7h | 10.8h |
| Universal | 400,000 | 11.7h | 15.7h | 20.2h |
| Omniversal | 800,000 | 28h | 34h | 41h |
| Unfathomable | 1,600,000 | 69h | 80h | 92h |
| INFINITE | 3,200,000 | 251h | 292h | 329h |

From Divine up, each rank takes roughly twice as long as the one before. INFINITE needs about 2.1 million rolls and most of the one-in-a-million catalog. The usual case is collecting about 88% of it; nobody needs every last one.

**The first jackpot jumps ranks.** Most players' first one-in-a-million badge lands around roll 3,000 (≈27 minutes), while they're Legendary, and its ~17,000 XP carries them straight to Exotic. That's why Mythic and Exotic share a median. It's deliberate: an exact hit should feel enormous. The rank-up toast shows the whole jump ("Exotic, from Legendary").

## Best Number Rolled

A roll's score is the XP value of every badge it triggered, whether or not you already owned them (`src/shared/scoring.ts`, with weights for the top badge versus the rest). Numeric size doesn't matter. `000007` scores about 18,000 because it stacks Bond. James Bond., Licensed to Kill, Secret Agent, Mersenne Prime, Single Digit and more, while `984271` scores 10.

## Fairness

- Rolls are drawn on the server with `crypto.randomInt`, so the client can't choose its numbers.
- Rate limits cap a player at 4 rolls per second, after a burst of 6. That's above what a person clicking can sustain, so it only slows scripts. A script at the cap would still reach INFINITE in about 6 days. No server-side limit can tell a fast human from a bot, so this is a speed bump, not a guarantee.

## Retuning

- **Thresholds:** `RARITIES` in `src/shared/progression.ts`.
- **Curve:** `XP_CURVE.points` in `src/shared/xp.ts`. Try one without editing: `npm run balance -- --curve "1:5,200:5,1000:10,10000:30,100000:300,1000000:16500,10000000:150000,1000000000:1000000"`.
- **One badge:** set `xp` on its definition.
- **After adding badges:** run `npm run odds`, then `npm run balance`. Every new one-in-a-million badge adds about 17,000 XP to the pool and speeds up the long game slightly; nudge the 1,000,000 point down as that catalog grows. When values change, the server recalculates every player's XP from their discoveries on the next start.
