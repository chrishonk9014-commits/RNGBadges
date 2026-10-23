# Balance

Every number below comes from `npm run balance`, and none of it is simulated. The script walks all 1,000,001 rolls (plus the 8 skip results of 1000000) through the real detector once, using the exact badge odds (`odds.json`), the XP curve in `src/shared/xp.ts` and the rarity thresholds in `src/shared/progression.ts`. `npm run balance -- --verify` then rolls a million real numbers and compares. The counts agree.

## How a roll is scored

- **Roll XP** is the XP of every badge in the roll, added together. A badge counts every time it appears, whether or not you've found it before.
- **Roll rarity** is the highest rung that XP reaches: 100 XP is Uncommon, 3,000 is Legendary, 200,000 is Cosmic, 3,200,000 is INFINITE.
- **The next roll starts from zero.** XP and rarity belong to the roll, not the player. What carries over is your **collection** (every badge you've ever found) and your **best roll**.

That is why the catalog is big and the numbers are high. One number can trip a dozen badges at once, and each of them adds to the roll's total.

## Goals

1. **Rarer always pays more.** A badge's XP comes from its exact odds and never goes down as odds get longer. A test enforces this across the whole catalog.
2. **Every rung is a real step.** Each rarity "or better" is rarer than the one below it, from every roll (Common) to once in 10 million rolls (INFINITE). A test checks it against the generated odds.
3. **Exact hits are jackpots.** Every exact-number badge is worth 350,000 XP, enough to make a Cosmic roll on its own. A test checks that every badge rarer than one in a million clears Cosmic.
4. **Closer pays more.** `contains 007` < `ends in 007` < exactly `000007`, and all three stack.

## Roll rarity odds

At 2 rolls a second (7,200 an hour). "This or better" is what the game shows after each roll. "Typical wait" is the average number of rolls until one lands, as time.

| Rarity | Roll XP | Exactly this | This or better | Typical wait | Seen in an hour |
|---|---:|---:|---:|---:|---:|
| Common | 0 | 1 in 2 | every roll | 1s | 100% |
| Uncommon | 100 | 1 in 5 | 1 in 2 | 1s | 100% |
| Notable | 300 | 1 in 7 | 1 in 4 | 2s | 100% |
| Rare | 750 | 1 in 19 | 1 in 10 | 5s | 100% |
| Epic | 1,500 | 1 in 32 | 1 in 23 | 11s | 100% |
| Legendary | 3,000 | 1 in 92 | 1 in 78 | 39s | 100% |
| Mythic | 6,000 | 1 in 746 | 1 in 490 | 4m | 100% |
| Exotic | 12,000 | 1 in 9,174 | 1 in 1,425 | 12m | 99.4% |
| Divine | 25,000 | 1 in 3,559 | 1 in 1,686 | 14m | 98.6% |
| Celestial | 50,000 | 1 in 22,222 | 1 in 3,205 | 27m | 89.4% |
| Transcendent | 100,000 | 1 in 17,857 | 1 in 3,745 | 31m | 85.4% |
| Cosmic | 200,000 | 1 in 5,291 | 1 in 4,739 | 39m | 78.1% |
| Universal | 400,000 | 1 in 50,000 | 1 in 45,455 | 6.3h | 14.6% |
| Omniversal | 800,000 | 1 in 1,000,001 | 1 in 500,000 | 69h | 1.4% |
| Unfathomable | 1,600,000 | 1 in 1,111,112 | 1 in 1,000,001 | 139h | 0.72% |
| INFINITE | 3,200,000 | 1 in 10,000,010 | 1 in 10,000,010 | 1,389h | 0.072% |

The average roll is worth 409 XP and the median roll 80 XP. One roll in ten beats 700 XP; one in a hundred beats 5,200.

The top four rungs are pinned to specific numbers: Omniversal is `000000`, Unfathomable is `1000000`, and INFINITE is any skip result. Universal is the best of the exact hits, the ones that stack several big badges (`000007`, `123456`, …).

### Why the middle of the ladder is uneven

The "this or better" column always gets rarer, but the "exactly this" column has lumps between Exotic and Cosmic. That comes from the catalog's shape, not the curve. Only 35 badges sit between 1 in 30,000 and 1 in 900,000, while 209 sit at exactly 1 in 1,000,001 (one per exact number). Every roll that hits one of those 209 lands at Cosmic or above, so Cosmic alone is more common than Celestial or Transcendent alone.

Smoothing it out would mean paying different XP for badges with identical odds, which breaks goal 1. The better fix is more badges in the 1-in-30,000 to 1-in-900,000 range (five-digit references, rarer patterns). As they're added, those middle bands fill in.

## Famous rolls

| Roll | Badges | Best badge | Roll XP | Rarity |
|---|---:|---|---:|---|
| `210074` | 4 | Keeping It 100 | 835 | Rare |
| `551267` | 3 | Math Equation! | 415 | Notable |
| `670007` | 4 | Licensed to Kill | 1,400 | Rare |
| `676767` | 9 | TRIPLE 67! | 356,000 | Cosmic |
| `696969` | 10 | Nice. Nice. Nice. | 356,080 | Cosmic |
| `123456` | 13 | Password | 554,635 | Universal |
| `000007` | 16 | Bond. James Bond. | 610,330 | Universal |
| `000000` | 31 | Absolute Zero | 826,490 | Omniversal |
| `1000000` | 12 | The Million | 1,789,315 | Unfathomable |
| `(skip)000000` | 32 | Skip! | 4,026,490 | INFINITE |
| `(skip)×7` | 1 | The Void | 1,000,000,000 | INFINITE |

## The 007 ladder

| Badge | Condition | Odds | XP |
|---|---|---:|---:|
| Secret Agent | contains `007` (e.g. `210074`) | 1 in 250 | 350 |
| Licensed to Kill | ends in `007` (e.g. `913007`) | 1 in 1,000 | 900 |
| Bond. James Bond. | is exactly `000007` | 1 in 1,000,001 | 350,000 |

The exact badge alone is worth 1,000× the "contains" badge. Rolling `000007` also earns the other two plus 13 more (Mersenne Prime, Single Digit, lots of zeros…), so the roll totals 610,330 XP: Universal.

### Why not 2,000 and 1,000,000

Those were the suggested ballparks. The shape carried over; the exact values would break the ladder:

- **1,000,000 for an exact match.** There are 209 exact-number badges, and together one of them lands about every 4,800 rolls (≈40 minutes). At 1,000,000 XP each, every one of those rolls would be Omniversal: a once-every-40-minutes roll, nearly ten times as common as Universal is today. At 350,000 they're Cosmic on their own and reach Universal or Omniversal only when they stack with other big badges, as `000007` and `000000` do.
- **2,000 for "contains 007".** XP follows odds, so a 1-in-250 badge paying 2,000 would outrank "ends in 007" (1 in 1,000) and every four-digit "contains" (about 1 in 3,300, 1,700 XP). Closer-pays-more needs each step to be rarer *and* worth more.

To make every number bigger without changing the odds, multiply the thresholds in `progression.ts` and the curve's XP values in `xp.ts` by the same factor.

## XP curve

Odds "1 in N" → XP, joined on a log-log scale and rounded to friendly numbers (multiples of 5 below 100, two significant figures above):

| 1 in N | XP | | 1 in N | XP |
|---:|---:|---|---:|---:|
| 1 | 5 | | 30,000 | 13,000 |
| 4 | 10 | | 50,000 | 26,000 |
| 20 | 25 | | 100,000 | 110,000 |
| 100 | 120 | | 250,000 | 190,000 |
| 250 | 350 | | 1,000,000 | 350,000 |
| 1,000 | 900 | | 1,111,112 (`1000000`) | 1,600,000 |
| 3,333 | 1,700 | | 11,111,122 (one skip) | 3,200,000 |
| 10,000 | 3,500 | | 10 trillion (cap) | 1,000,000,000 |

The steep step from 1 in 1,000,000 to 1 in 1,111,112 is deliberate: it separates the exact six-digit hits (Cosmic) from `1000000` itself (Unfathomable), and the first skip from everything else (INFINITE).

## Badge tiers

Tier names come from the reward table in the brief, assigned by odds:

| Tier | Odds | Badges | XP each |
|---|---|---:|---:|
| Common | commoner than 1 in 50 | 29 | 10–45 |
| Uncommon | 1 in 50 – 300 | 91 | 75–380 |
| Recognizable | 1 in 300 – 2,000 | 65 | 710–1,200 |
| Unusual | 1 in 2,000 – 8,000 | 94 | 1,300–2,100 |
| Rare | 1 in 8,000 – 30,000 | 119 | 3,200–11,000 |
| Very Rare | 1 in 30,000 – 200,000 | 30 | 15,000–140,000 |
| Extremely Rare | 1 in 200,000 – 900,000 | 5 | 170,000–190,000 |
| Legendary | 1 in 900,000 – 5 million | 212 | 340,000–1,600,000 |
| Special Secret | rarer than 1 in 5 million | 7 | 3,200,000–1,000,000,000 |

## Leaderboards

- **Best Roll** ranks each player's single best roll by its XP. Numeric size doesn't count: `000153` (a narcissistic number) beats `984271`. Ties go to whoever rolled it first.
- **Most Badges** ranks players by how many different badges they've found. It replaced the old Total XP board, since XP no longer adds up across rolls. Ties go to whoever reached the count first.

## Fairness

- Rolls are drawn on the server with `crypto.randomInt`, so the client can't choose its numbers.
- Rate limits cap a player at 4 rolls per second, after a burst of 6. That's above what a person clicking can sustain, so it only slows scripts. A script at the cap would still wait about 29 days on average for an INFINITE roll. No server-side limit can tell a fast human from a bot, so this is a speed bump, not a guarantee.

## Retuning

- **Thresholds:** `RARITIES` in `src/shared/progression.ts`.
- **Curve:** `XP_CURVE.points` in `src/shared/xp.ts`. Try one without editing: `npm run balance -- --curve "1:5,4:10,20:25,100:120,250:350,1000:900,3333:1700,10000:3500,30000:13000,50000:26000,100000:110000,250000:190000,1000000:350000,1111112:1600000,11111122:3200000,10000000000000:1000000000"`.
- **One badge:** set `xp` on its definition.
- **After any change:** run `npm run odds`, which regenerates `odds.json` and the per-rarity odds in `rarityOdds.json` (the game and the website show those), then `npm run balance`. `npm test` fails if either file is stale. When badge values change, the server rescores every player's best roll on its next start.
