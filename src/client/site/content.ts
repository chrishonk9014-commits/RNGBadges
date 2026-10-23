import type { CategoryId } from '../../shared/badges/types';

/** Rolls the hero cycles through. `why` explains the best badge in a few words. */
export const SHOWCASE: Array<{ roll: string; why: string }> = [
  { roll: '551267', why: '55 + 12 = 67' },
  { roll: '000007', why: 'Nothing but 007' },
  { roll: '676767', why: 'Six seven, three times' },
  { roll: '102115', why: 'October 21, 2015' },
  { roll: '372187', why: '3⁷ = 2187' },
  { roll: '314159', why: 'π to six digits' },
  { roll: '000153', why: '1³ + 5³ + 3³ = 153' },
  { roll: '(skip)(skip)00000', why: '1000000 lost two digits' },
];

/** One card per badge family. Counts come from the live catalog; examples are hand-picked. */
export const FAMILIES: Array<{ category: CategoryId; title: string; blurb: string; examples: string[] }> = [
  {
    category: 'funny',
    title: 'Funny Numbers',
    blurb: "The internet's favourite numbers, in the right spot.",
    examples: ['funny.676767', 'funny.69-start', 'funny.2121'],
  },
  {
    category: 'reference',
    title: 'References',
    blurb: 'Movies, games, music, memes and the web.',
    examples: ['ref.bond.only', 'ref.not-found', 'ref.order-66'],
  },
  { category: 'history', title: 'History', blurb: 'Years everyone has heard of.', examples: ['year.moon-landing', 'year.magna-carta', 'year.wall-falls'] },
  {
    category: 'science',
    title: 'Science',
    blurb: 'Constants, measurements and famous digits.',
    examples: ['sci.six-digits-pi', 'sci.speed-of-light', 'sci.avogadro'],
  },
  {
    category: 'calculator',
    title: 'Calculator Words',
    blurb: 'Type the digits, turn the calculator upside down.',
    examples: ['calc.hello', 'calc.boss', 'calc.egg'],
  },
  { category: 'phoneword', title: 'Phone Words', blurb: 'Letters dialled on a phone keypad.', examples: ['dial.rng', 'dial.lucky', 'dial.winner'] },
  { category: 'math', title: 'Math', blurb: 'Equations and number theory.', examples: ['math.equation', 'math.power-play', 'math.narcissistic'] },
  { category: 'poker', title: 'Poker Digits', blurb: 'Your six digits, played as a poker hand.', examples: ['poker.full-house', 'poker.four-kind', 'poker.six-kind'] },
  { category: 'pattern', title: 'Patterns', blurb: 'Shapes the digits make.', examples: ['pattern.palindrome', 'pattern.knights-tour', 'pattern.mountain'] },
  {
    category: 'calendar',
    title: 'Calendar & Clock',
    blurb: 'Rolls that read as dates and times.',
    examples: ['calendar.back-to-the-future-day', 'calendar.leap-day', 'calendar.make-a-wish'],
  },
  { category: 'special', title: 'Special', blurb: 'The 1000000 roll and a few famous extremes.', examples: ['special.the-million', 'special.absolute-zero', 'special.maxed-out'] },
  { category: 'meta', title: 'Secrets', blurb: 'Badges about you as much as the number. Find them to learn their names.', examples: [] },
];

/**
 * Median time to reach each rarity at two rolls a second, from `npm run balance`
 * (see BALANCE.md). Update alongside the balance report.
 */
export const MEDIAN_TIME: Record<string, string> = {
  common: 'start',
  uncommon: '5 sec',
  notable: '21 sec',
  rare: '2 min',
  epic: '5 min',
  legendary: '16 min',
  mythic: '27 min',
  exotic: '27 min',
  divine: '1.1 hr',
  celestial: '1.7 hr',
  transcendent: '3.7 hr',
  cosmic: '7.7 hr',
  universal: '16 hr',
  omniversal: '34 hr',
  unfathomable: '80 hr',
  infinite: '290 hr',
};

export const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'Are the rolls really random?',
    a: 'Yes. In the full game the server draws every roll with a cryptographic random number generator, so nobody can pick their numbers. Each of the 1,000,001 outcomes is equally likely.',
  },
  {
    q: 'Does my progress save?',
    a: 'Your first visit creates a player and a private save code. Progress lives on the server, and the save code lets you continue on another device. Rolls in the demo on this page are not saved.',
  },
  {
    q: 'Do I get XP for finding the same badge twice?',
    a: 'No. Each badge pays XP once, the first time you find it. It still shows up in your Badges Collected list every time you roll it.',
  },
  {
    q: 'What is the rarest badge?',
    a: "A secret one, and its name stays secret until somebody finds it. You need to roll 1000000 and then watch all seven of its digits skip, about 1 in 10 trillion per roll.",
  },
  {
    q: 'How are the odds calculated?',
    a: 'By checking every badge against all 1,000,001 possible rolls, including each way 1000000 can skip. The odds you see on a badge are exact, not estimates.',
  },
  {
    q: 'Can I play on my phone?',
    a: 'Yes. The game and this site work at phone width, and reduced-motion settings are respected.',
  },
];
