import type { RollCell } from '../../shared/roll';
import { SKIP_MARKER } from '../../shared/roll';

/** Parses "(skip)(skip)00000" into cells without needing the server's cell list. */
export function cellsFromText(text: string): RollCell[] {
  const cells: RollCell[] = [];
  let rest = text;
  while (rest.startsWith(SKIP_MARKER)) {
    cells.push({ kind: 'skip' });
    rest = rest.slice(SKIP_MARKER.length);
  }
  for (const digit of rest) cells.push({ kind: 'digit', digit });
  return cells;
}

/** Compact inline rendering of a roll, skip markers included, for lists and leaderboards. */
export function RollText({ text, className = '' }: { text: string; className?: string }) {
  const cells = cellsFromText(text);
  return (
    <span className={`roll-text ${className}`} aria-label={text}>
      {cells.map((c, i) =>
        c.kind === 'skip' ? (
          <span key={i} className="roll-text-skip" aria-hidden>
            (skip)
          </span>
        ) : (
          <span key={i} aria-hidden>
            {c.digit}
          </span>
        ),
      )}
    </span>
  );
}
