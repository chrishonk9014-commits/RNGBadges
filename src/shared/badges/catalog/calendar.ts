import type { BadgeDef, RollFacts } from '../types';

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Two-digit years are read as 20YY, so Feb 29 is valid when YY is divisible by 4. */
export function isValidDate(mm: number, dd: number, yy: number): boolean {
  if (mm < 1 || mm > 12 || dd < 1) return false;
  if (mm === 2 && dd === 29) return yy % 4 === 0;
  return dd <= DAYS_IN_MONTH[mm - 1]!;
}

const part = (f: RollFacts, at: number): number => Number(f.digits.slice(at, at + 2));

const holiday = (key: string, name: string, mmdd: string, flavor: string): BadgeDef => ({
  id: `calendar.${key}`,
  name,
  description: `The roll starts with ${mmdd}, read as a date (${mmdd.slice(0, 2)}/${mmdd.slice(2)}).`,
  flavor,
  category: 'calendar',
  family: 'calendar.holidays',
  rule: { kind: 'mask', mask: `${mmdd}__` },
});

export const CALENDAR: BadgeDef[] = [
  {
    id: 'calendar.clock-time',
    name: 'Clock Time',
    description: 'The roll is a valid 24-hour time, HH:MM:SS.',
    flavor: 'It’s always some o’clock.',
    category: 'calendar',
    rule: { kind: 'test', test: (f) => f.length === 6 && part(f, 0) <= 23 && part(f, 2) <= 59 && part(f, 4) <= 59 },
  },
  {
    id: 'calendar.calendar-day',
    name: 'Calendar Day',
    description: 'The roll is a valid date, MM/DD/YY.',
    flavor: 'Mark it down.',
    category: 'calendar',
    rule: { kind: 'test', test: (f) => f.length === 6 && isValidDate(part(f, 0), part(f, 2), part(f, 4)) },
  },
  {
    id: 'calendar.make-a-wish',
    name: 'Make a Wish',
    description: 'The roll reads 11:11 on the clock (1111SS, with valid seconds).',
    flavor: 'Close your eyes.',
    category: 'calendar',
    rule: { kind: 'test', test: (f) => f.length === 6 && f.digits.startsWith('1111') && part(f, 4) <= 59 },
  },
  {
    id: 'calendar.high-noon',
    name: 'High Noon',
    description: 'The roll is exactly 120000 — 12:00:00.',
    flavor: 'It’s high noon.',
    category: 'calendar',
    rule: { kind: 'exact', value: '120000' },
  },
  {
    id: 'calendar.leap-day',
    name: 'Leap Day',
    description: 'The roll is February 29 of a real leap year (0229YY, YY divisible by 4).',
    flavor: 'Comes around once every four years.',
    category: 'calendar',
    family: 'calendar.holidays',
    rule: { kind: 'test', test: (f) => f.length === 6 && f.digits.startsWith('0229') && part(f, 4) % 4 === 0 },
  },
  {
    id: 'calendar.back-to-the-future-day',
    name: 'Back to the Future Day',
    description: 'The roll is exactly 102115 — October 21, 2015.',
    flavor: 'The day Marty McFly arrives in the future.',
    category: 'calendar',
    rule: { kind: 'exact', value: '102115' },
  },
  holiday('new-year', "New Year's Day", '0101', 'A fresh start.'),
  holiday('groundhog-day', 'Groundhog Day', '0202', 'Again. And again. And again.'),
  holiday('valentines', "Valentine's Day", '0214', 'Roses are red, rolls are random.'),
  holiday('pi-day', 'Pi Day', '0314', 'March 14 — 3.14.'),
  holiday('st-patricks', "St. Patrick's Day", '0317', 'Lucky you.'),
  holiday('april-fools', "April Fools'", '0401', 'This badge is real. Probably.'),
  holiday('earth-day', 'Earth Day', '0422', 'Roll responsibly.'),
  holiday('may-the-fourth', 'May the Fourth', '0504', 'Be with you.'),
  holiday('fourth-of-july', 'Fourth of July', '0704', 'Fireworks optional.'),
  holiday('pirate-day', 'Talk Like a Pirate Day', '0919', 'Arrr.'),
  holiday('halloween', 'Halloween', '1031', 'Trick or treat.'),
  holiday('christmas', 'Christmas', '1225', 'A badge under the tree.'),
  holiday('new-years-eve', "New Year's Eve", '1231', 'Countdown to midnight.'),
];
