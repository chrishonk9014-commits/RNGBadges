import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import type { BestLeaderboardEntry, LeaderboardResponse, XpLeaderboardEntry } from '../../shared/api';
import { RARITIES } from '../../shared/progression';
import { ROLL_OUTCOMES, SEVEN_DIGIT_NUMBER, formatRoll, sevenDigitRoll, skipCountProbability } from '../../shared/roll';
import { api } from '../api';
import { RollText, cellsFromText } from '../components/RollNumber';
import { CATEGORY_NAMES, formatNumber, formatOdds, rarity, rarityPaint, tier, useSystemReducedMotion } from '../format';
import { FAMILIES, FAQ, MEDIAN_TIME, SHOWCASE } from './content';
import { DemoRoller, NumberChecker } from './Demo';
import { badgesFor, readNumber, registry } from './engine';

/** Built without the game server (a static copy of the site): no Play links, no live data. */
const STANDALONE = import.meta.env.VITE_STANDALONE === '1';
const BADGE_COUNT = registry.badges.length;
const RAREST = [...registry.badges].sort((a, b) => a.probability - b.probability)[0]!;

export function Site() {
  const reducedMotion = useSystemReducedMotion();
  return (
    <div className="site" data-motion={reducedMotion ? 'reduced' : 'full'}>
      <Header />
      <main id="top">
        <Hero reducedMotion={reducedMotion} />
        <Figures />
        <TrySection reducedMotion={reducedMotion} />
        <HowItWorks />
        <Closer />
        <Families />
        <Million />
        <Ladder />
        <Boards />
        <Faq />
        <FinalCall />
      </main>
      <footer className="site-footer">
        <div className="wrap site-footer-inner">
          <span className="site-mark">RNG BADGES</span>
          <span>
            {formatNumber(BADGE_COUNT)} badges · odds checked against all {formatNumber(ROLL_OUTCOMES)} possible rolls
          </span>
        </div>
      </footer>
    </div>
  );
}

function PlayLink({ className, children }: { className: string; children: string }) {
  return STANDALONE ? (
    <a className={className} href="#try">
      Try a roll
    </a>
  ) : (
    <a className={className} href="/play/">
      {children}
    </a>
  );
}

function Header() {
  return (
    <header className="site-header">
      <div className="wrap site-header-inner">
        <a className="site-mark" href="#top">
          RNG BADGES
        </a>
        <nav className="site-nav" aria-label="Sections">
          <a href="#how">How it works</a>
          <a href="#badges">Badges</a>
          <a href="#rarities">Rarities</a>
          <a href="#leaderboards">Leaderboards</a>
        </nav>
        <PlayLink className="site-cta">Play</PlayLink>
      </div>
    </header>
  );
}

function Tiles({ text, highlight, size = 'lg' }: { text: string; highlight?: [number, number]; size?: 'lg' | 'sm' }) {
  const cells = cellsFromText(text);
  return (
    <span className={`tiles tiles-${size}`} aria-hidden>
      {cells.map((c, i) => {
        const lit = highlight && i >= highlight[0] && i < highlight[1];
        return c.kind === 'skip' ? (
          <span key={i} className="tile tile-skip" style={{ '--i': i } as CSSProperties}>
            (skip)
          </span>
        ) : (
          <span key={i} className={`tile${lit ? ' tile-lit' : ''}`} style={{ '--i': i } as CSSProperties}>
            {c.digit}
          </span>
        );
      })}
    </span>
  );
}

function Hero({ reducedMotion }: { reducedMotion: boolean }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const examples = useMemo(
    () =>
      SHOWCASE.map((s) => {
        const badges = badgesFor(readNumber(s.roll)!);
        return { ...s, best: badges.at(-1)!, others: badges.length - 1 };
      }),
    [],
  );

  useEffect(() => {
    if (reducedMotion || paused) return;
    const t = window.setInterval(() => setIndex((i) => (i + 1) % examples.length), 3600);
    return () => window.clearInterval(t);
  }, [reducedMotion, paused, examples.length]);

  const ex = examples[index]!;
  const t = tier(ex.best.tier);
  return (
    <section className="hero">
      <div className="wrap hero-grid">
        <div className="hero-copy">
          <p className="eyebrow">A number-discovery game</p>
          <h1>Every number is hiding something.</h1>
          <p className="lede">
            Roll one of {formatNumber(ROLL_OUTCOMES)} numbers. RNG Badges checks it against {formatNumber(BADGE_COUNT)} hand-made badges, from movie references to
            math to poker hands, and pays XP for every first find.
          </p>
          <div className="hero-actions">
            <PlayLink className="button-big">Play now</PlayLink>
            <a className="button-quiet" href={STANDALONE ? '#how' : '#try'}>
              {STANDALONE ? 'How it works' : 'Try a demo roll'}
            </a>
          </div>
        </div>

        <figure
          className="scoreboard"
          style={{ '--tier': t.color } as CSSProperties}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          <figcaption className="sb-label">
            <span>Roll</span>
            <span>
              {index + 1} / {examples.length}
            </span>
          </figcaption>
          <div className="sb-number" key={index}>
            <Tiles text={ex.roll} />
          </div>
          <div className="sb-result" key={`r${index}`}>
            <span className="sb-tier">{t.name}</span>
            <strong className="sb-badge">{ex.best.name}</strong>
            <span className="sb-why">{ex.why}</span>
            <span className="sb-meta">
              {formatOdds(ex.best.probability)} · {formatNumber(ex.best.xp)} XP{ex.others > 0 && ` · +${ex.others} more badge${ex.others === 1 ? '' : 's'}`}
            </span>
          </div>
          <button type="button" className="sb-next" onClick={() => setIndex((i) => (i + 1) % examples.length)}>
            Next roll →
          </button>
          <p className="sr-only">
            Example: rolling {ex.roll} earns {ex.best.name}, {ex.why}.
          </p>
        </figure>
      </div>
    </section>
  );
}

function Figures() {
  const figures = [
    [formatNumber(BADGE_COUNT), 'badges to discover'],
    [formatNumber(ROLL_OUTCOMES), 'equally likely rolls'],
    ['16', 'rarities, Common to INFINITE'],
    [formatOdds(RAREST.probability), 'odds of the rarest badge'],
  ];
  return (
    <section className="figures" aria-label="The game in numbers">
      <dl className="wrap figures-grid">
        {figures.map(([value, label]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function TrySection({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <section className="band band-try" id="try" aria-labelledby="try-title">
      <div className="wrap">
        <header className="section-head">
          <p className="eyebrow">Demo</p>
          <h2 id="try-title">Roll one right here.</h2>
          <p>
            This is the real roll screen and the real badge engine, running in your browser. Demo rolls aren't saved
            {STANDALONE ? ' and never reach the leaderboards.' : '. Play the full game to keep your XP and climb the leaderboards.'}
          </p>
        </header>
        <div className="try-grid">
          <DemoRoller reducedMotion={reducedMotion} />
          <NumberChecker />
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  ['Roll', 'Press Roll or Space. You get one number from 000000 to 999999, or the seven-digit 1000000.'],
  ['Reveal', 'Every badge hiding in the number appears under the Roll button, worst first. The best one lands last.'],
  ['Collect', 'A badge pays XP the first time you find it: 5 for the everyday ones, about 17,000 for a one-in-a-million hit.'],
  ['Climb', 'XP moves you up sixteen rarities, from Common to INFINITE, and onto the global leaderboards.'],
];

function HowItWorks() {
  return (
    <section className="band" id="how" aria-labelledby="how-title">
      <div className="wrap">
        <header className="section-head">
          <p className="eyebrow">How it works</p>
          <h2 id="how-title">One button. Six digits. Hundreds of secrets.</h2>
        </header>
        <ol className="steps">
          {STEPS.map(([title, text], i) => (
            <li key={title}>
              <span className="step-n">{i + 1}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Closer() {
  const rows: Array<{ id: string; roll: string; lit: [number, number]; how: string }> = [
    { id: 'ref.bond', roll: '210074', lit: [2, 5], how: 'contains 007' },
    { id: 'ref.bond.ends', roll: '913007', lit: [3, 6], how: 'ends in 007' },
    { id: 'ref.bond.only', roll: '000007', lit: [0, 6], how: 'is exactly 000007' },
  ];
  const top = Math.log10(registry.get('ref.bond.only')!.xp);
  return (
    <section className="band" id="closer" aria-labelledby="closer-title">
      <div className="wrap closer-grid">
        <header className="section-head">
          <p className="eyebrow">References</p>
          <h2 id="closer-title">The closer you get, the bigger it pays.</h2>
          <p>
            Famous numbers pay out in tiers. Spot one anywhere in your roll, finish on it, or roll nothing else. An exact hit earns all three badges at once.
          </p>
        </header>
        <ol className="closer-list">
          {rows.map((r) => {
            const b = registry.get(r.id)!;
            const t = tier(b.tier);
            return (
              <li key={r.id} style={{ '--tier': t.color, '--fill': `${(Math.log10(b.xp) / top) * 100}%` } as CSSProperties}>
                <Tiles text={r.roll} highlight={r.lit} size="sm" />
                <div className="closer-text">
                  <strong>{b.name}</strong>
                  <span>
                    The roll {r.how} · {formatOdds(b.probability)}
                  </span>
                </div>
                <div className="closer-xp">
                  <span className="closer-bar" aria-hidden />
                  <span>{formatNumber(b.xp)} XP</span>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function Families() {
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const b of registry.badges) c[b.category] = (c[b.category] ?? 0) + 1;
    return c;
  }, []);
  return (
    <section className="band" id="badges" aria-labelledby="badges-title">
      <div className="wrap">
        <header className="section-head">
          <p className="eyebrow">Badges</p>
          <h2 id="badges-title">{formatNumber(BADGE_COUNT)} badges, each one made by hand.</h2>
          <p>No badge exists to pad the list. Each has its own name, its own condition and odds worked out exactly.</p>
        </header>
        <ul className="families">
          {FAMILIES.map((f) => (
            <li key={f.category}>
              <div className="family-head">
                <h3>{f.title}</h3>
                <span className="family-count">{counts[f.category] ?? 0}</span>
              </div>
              <p>{f.blurb}</p>
              <ul className="family-examples" aria-label={`Examples from ${CATEGORY_NAMES[f.category]}`}>
                {f.examples.length === 0
                  ? [0, 1, 2].map((i) => (
                      <li key={i} className="family-secret">
                        <span>???</span>
                        <span>secret</span>
                      </li>
                    ))
                  : f.examples.map((id) => {
                      const b = registry.get(id)!;
                      return (
                        <li key={id} style={{ '--tier': tier(b.tier).color } as CSSProperties}>
                          <span>{b.name}</span>
                          <span>{formatOdds(b.probability)}</span>
                        </li>
                      );
                    })}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Million() {
  const rows = Array.from({ length: SEVEN_DIGIT_NUMBER.length + 1 }, (_, skips) => {
    const p = skipCountProbability(skips);
    const badge = registry.get(skips === 0 ? 'special.the-million' : `special.skip-${skips}`)!;
    return { skips, text: formatRoll(sevenDigitRoll(skips)), given: p, perRoll: p / ROLL_OUTCOMES, badge };
  });
  return (
    <section className="band band-million" id="million" aria-labelledby="million-title">
      <div className="wrap million-grid">
        <header className="section-head">
          <p className="eyebrow">The skip</p>
          <h2 id="million-title">One number has seven digits.</h2>
          <p>
            Once in every {formatNumber(ROLL_OUTCOMES)} rolls you land on 1000000. Then its digits get a chance to vanish. Starting from the left, each one has a 1 in
            10 chance to skip. The first digit that stays ends the run, so skips only ever stack up at the front.
          </p>
          <p className="million-example">
            <RollText text="(skip)(skip)00000" /> can happen. <RollText text="1(skip)00000" /> never can.
          </p>
        </header>
        <div className="table-scroll">
          <table className="million-table">
            <caption className="sr-only">Every way the 1000000 roll can end</caption>
            <thead>
              <tr>
                <th scope="col">Result</th>
                <th scope="col" className="num">
                  Once 1000000 hits
                </th>
                <th scope="col" className="num">
                  Per roll
                </th>
                <th scope="col">Badge</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.skips} style={{ '--tier': tier(r.badge.tier).color } as CSSProperties}>
                  <td>{r.text === '(skip)'.repeat(7) ? <span className="roll-text roll-text-skip">(skip)×7</span> : <RollText text={r.text} />}</td>
                  <td className="num">{r.given >= 0.01 ? `${Math.round(r.given * 100)}%` : `1 in ${formatNumber(1 / r.given)}`}</td>
                  <td className="num">{formatOdds(r.perRoll)}</td>
                  <td className="million-badge">{r.badge.hidden ? 'Secret badge' : r.badge.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Ladder() {
  const top = Math.log10(RARITIES.at(-1)!.minXp);
  return (
    <section className="band" id="rarities" aria-labelledby="rarities-title">
      <div className="wrap">
        <header className="section-head">
          <p className="eyebrow">Rarities</p>
          <h2 id="rarities-title">Sixteen rarities, Common to INFINITE.</h2>
          <p>Your rarity comes from your total XP. Times are the median for a player rolling about twice a second.</p>
        </header>
        <ol className="ladder">
          {RARITIES.map((r, i) => (
            <li
              key={r.id}
              style={{ '--rarity': r.color, '--rarity-paint': rarityPaint(r), '--fill': `${r.minXp === 0 ? 2 : (Math.log10(r.minXp) / top) * 100}%` } as CSSProperties}
            >
              <span className="ladder-n">{i + 1}</span>
              <span className={`ladder-name${r.accent ? ' ladder-name-paint' : ''}`}>{r.name}</span>
              <span className="ladder-bar" aria-hidden />
              <span className="ladder-xp">{r.minXp === 0 ? '0 XP' : `${formatNumber(r.minXp)} XP`}</span>
              <span className="ladder-time">{MEDIAN_TIME[r.id] === 'start' ? 'where you start' : `≈ ${MEDIAN_TIME[r.id]}`}</span>
            </li>
          ))}
        </ol>
        <p className="footnote">
          Mythic and Exotic share a time because most players' first one-in-a-million badge, worth about 17,000 XP, lifts them straight past Mythic.
        </p>
      </div>
    </section>
  );
}

function Boards() {
  return (
    <section className="band" id="leaderboards" aria-labelledby="boards-title">
      <div className="wrap">
        <header className="section-head">
          <p className="eyebrow">Leaderboards</p>
          <h2 id="boards-title">Two ways to the top.</h2>
        </header>
        <div className="boards">
          <article className="board-card">
            <h3>Total XP</h3>
            <p>Everyone ranked by the XP from every badge they have discovered. Rarity shown beside each name.</p>
            {!STANDALONE && <LiveXp />}
          </article>
          <article className="board-card">
            <h3>Best Number Rolled</h3>
            <p>
              Each player's single most remarkable roll, scored by the value of every badge it triggered. Size doesn't count:{' '}
              <RollText text="000153" /> beats <RollText text="984271" />.
            </p>
            {!STANDALONE && <LiveBest />}
          </article>
        </div>
      </div>
    </section>
  );
}

function useBoard<T>(path: string): LeaderboardResponse<T> | null | 'error' {
  const [data, setData] = useState<LeaderboardResponse<T> | null | 'error'>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      api<LeaderboardResponse<T>>(path).then(
        (d) => alive && setData(d),
        () => alive && setData('error'),
      );
    void load();
    const t = window.setInterval(load, 30_000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [path]);
  return data;
}

function BoardState({ data, children }: { data: unknown; children: ReactNode }) {
  if (data === null) return <p className="board-status">Loading the live board…</p>;
  if (data === 'error') return <p className="board-status">The live board isn't reachable right now.</p>;
  return <>{children}</>;
}

function LiveXp() {
  const data = useBoard<XpLeaderboardEntry>('/api/leaderboard/xp?limit=5');
  return (
    <BoardState data={data}>
      {data && data !== 'error' && (
        <>
          <p className="board-status">Live · {formatNumber(data.totalPlayers)} players</p>
          {data.entries.length === 0 ? (
            <p className="board-status">Nobody has rolled yet. The top spot is open.</p>
          ) : (
            <ol className="live-list">
              {data.entries.map((e) => {
                const r = rarity(e.rarity);
                return (
                  <li key={e.playerId}>
                    <span className="live-rank">{e.rank}</span>
                    <span className="live-name">{e.username}</span>
                    <span className="live-pill" style={{ '--rarity-paint': rarityPaint(r) } as CSSProperties}>
                      {r.name}
                    </span>
                    <span className="live-value">{formatNumber(e.xp)}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}
    </BoardState>
  );
}

function LiveBest() {
  const data = useBoard<BestLeaderboardEntry>('/api/leaderboard/best?limit=5');
  return (
    <BoardState data={data}>
      {data && data !== 'error' && (
        <>
          <p className="board-status">Live · best roll per player</p>
          {data.entries.length === 0 ? (
            <p className="board-status">No rolls yet.</p>
          ) : (
            <ol className="live-list">
              {data.entries.map((e) => (
                <li key={e.playerId}>
                  <span className="live-rank">{e.rank}</span>
                  <span className="live-name">
                    <RollText text={e.roll} /> <small>{e.username}</small>
                  </span>
                  <span className="live-badge" style={{ '--tier': tier(e.badges[0]?.tier ?? 'common').color } as CSSProperties}>
                    {e.badges[0]?.name ?? ''}
                  </span>
                  <span className="live-value">{formatNumber(e.score)}</span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </BoardState>
  );
}

function Faq() {
  return (
    <section className="band" id="faq" aria-labelledby="faq-title">
      <div className="wrap faq-grid">
        <header className="section-head">
          <p className="eyebrow">Questions</p>
          <h2 id="faq-title">Before you roll.</h2>
        </header>
        <div className="faq">
          {FAQ.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCall() {
  return (
    <section className="final" aria-labelledby="final-title">
      <div className="wrap final-inner">
        <Tiles text="000000" size="sm" />
        <h2 id="final-title">Your first roll is one click away.</h2>
        <PlayLink className="button-big">Play RNG Badges</PlayLink>
      </div>
    </section>
  );
}
