import { ROLL_OUTCOMES, formatRoll, sevenDigitRoll } from '../../roll';
import type { BadgeDef, RollContext, RollFacts } from '../types';
import { isPalindrome } from '../numberTheory';

const exact = (key: string, name: string, value: string, flavor: string): BadgeDef => ({
  id: `special.${key}`,
  name,
  description: `The roll is exactly ${value}.`,
  flavor,
  category: 'special',
  rule: { kind: 'exact', value },
});

/** The 1000000 roll and every way its skip run can end. */
const SKIP_NAMES = ['The Million', 'Skip!', 'Double Skip', 'Triple Skip', 'Quadruple Skip', 'Quintuple Skip', 'Down to One', 'The Void'];

const SKIP_FLAVOR = [
  'The only seven-digit number in the game.',
  'The 1 skipped. Six zeros remain.',
  'Two skips in a row.',
  'Three skips. The million is melting.',
  'Four skips. Only three zeros left.',
  'Five skips. Two zeros hanging on.',
  'Six skips. A single digit survives.',
  'Every digit skipped. There is nothing left.',
];

export const SPECIAL: BadgeDef[] = [
  ...SKIP_NAMES.map(
    (name, skips): BadgeDef => ({
      id: skips === 0 ? 'special.the-million' : `special.skip-${skips}`,
      name,
      description:
        skips === 0
          ? 'Roll 1000000 with no digits skipped.'
          : `Roll 1000000 and skip exactly ${skips} leading digit${skips > 1 ? 's' : ''}: ${formatRoll(sevenDigitRoll(skips))}.`,
      flavor: SKIP_FLAVOR[skips],
      category: 'special',
      family: 'special.million',
      hidden: skips > 0,
      rule: { kind: 'skips', count: skips },
    }),
  ),
  exact('absolute-zero', 'Absolute Zero', '000000', 'Nothing at all. Literally.'),
  exact('six-figures', 'Six Figures', '100000', 'You made it.'),
  exact('halfway-there', 'Halfway There', '500000', "Woah, we're halfway there."),
  exact('beast-mode', 'Beast Mode', '666666', 'Twice the beast.'),
  exact('seven-heaven', 'Seven Heaven', '777777', 'Every reel. Every seven.'),
  exact('maxed-out', 'Maxed Out', '999999', 'The biggest six-digit roll there is.'),
];

const ONE_IN_ROLLS = 1 / ROLL_OUTCOMES;

const meta = (
  key: string,
  name: string,
  description: string,
  flavor: string,
  probability: number,
  test: (f: RollFacts, ctx: RollContext) => boolean,
  hidden = true,
): BadgeDef => ({
  id: `meta.${key}`,
  name,
  description,
  flavor,
  category: 'meta',
  hidden,
  rule: { kind: 'context', probability, test },
});

const two = (n: number): string => String(n).padStart(2, '0');

/** Badges about a roll in relation to the player: their last roll, their roll count, their clock. */
export const META: BadgeDef[] = [
  meta('deja-vu', 'Déjà Vu', 'Roll exactly the same number twice in a row.', 'Wait… haven’t we been here before?', ONE_IN_ROLLS, (f, c) =>
    c.previous !== null && c.previous.digits === f.digits && c.previous.skips === f.roll.skips,
  ),
  meta('next-in-line', 'Next in Line', 'Roll exactly one more than your previous roll.', 'Counting, the hard way.', ONE_IN_ROLLS, (f, c) =>
    c.previous !== null && c.previous.digits.length > 0 && f.value === Number(c.previous.digits) + 1,
  ),
  meta(
    'mirror-roll',
    'Mirror Roll',
    'Roll the exact reverse of your previous (non-palindrome) roll.',
    'Through the looking glass.',
    ONE_IN_ROLLS * 0.999,
    (f, c) =>
      f.length === 6 &&
      c.previous !== null &&
      c.previous.digits.length === 6 &&
      !isPalindrome(c.previous.digits) &&
      [...c.previous.digits].reverse().join('') === f.digits,
  ),
  meta('odometer', 'Odometer', 'Roll your own lifetime roll count (roll #4,821 lands on 004821).', 'The universe is keeping score.', ONE_IN_ROLLS, (f, c) =>
    f.length === 6 && f.value === c.rollNumber,
  ),
  meta('todays-date', "Today's Date", 'Roll today’s date as MMDDYY, in your own time zone.', 'Happy today!', ONE_IN_ROLLS, (f, c) =>
    f.length === 6 && f.digits === `${two(c.local.month)}${two(c.local.day)}${two(c.local.year % 100)}`,
  ),
  meta(
    'date-stamp',
    'Date Stamp',
    'Roll a number that starts with today’s month and day (MMDD), in your own time zone.',
    'Stamped and dated.',
    ONE_IN_ROLLS * 100,
    (f, c) => f.length === 6 && f.digits.startsWith(`${two(c.local.month)}${two(c.local.day)}`),
    false,
  ),
  meta('clock-watcher', 'Clock Watcher', 'Roll the exact time (HHMMSS) at the moment you roll, in your own time zone.', 'Right on time.', ONE_IN_ROLLS, (f, c) =>
    f.length === 6 && f.digits === `${two(c.local.hour)}${two(c.local.minute)}${two(c.local.second)}`,
  ),
];

