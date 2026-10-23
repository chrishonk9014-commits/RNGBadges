import type { RandomSource } from './rng';

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

const ALLOWED = /^[A-Za-z0-9_-]+$/;

/** Substrings that keep a name off a public leaderboard. Deliberately short; extend as needed. */
const BLOCKED = ['fuck', 'shit', 'cunt', 'nigg', 'faggot', 'rapist', 'nazi', 'hitler', 'whore', 'slut', 'retard', 'kike', 'chink'];

const normalise = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[_-]/g, '')
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't');

/** Returns a problem description, or null when the name is acceptable. */
export function usernameProblem(name: string): string | null {
  if (name.length < USERNAME_MIN || name.length > USERNAME_MAX) {
    return `Usernames are ${USERNAME_MIN}–${USERNAME_MAX} characters.`;
  }
  if (!ALLOWED.test(name)) return 'Use letters, numbers, _ and - only.';
  const plain = normalise(name);
  if (BLOCKED.some((word) => plain.includes(word))) return 'Please pick a different name.';
  return null;
}

const ADJECTIVES = [
  'Lucky', 'Rolling', 'Cosmic', 'Golden', 'Swift', 'Quiet', 'Bold', 'Clever', 'Wild', 'Mystic',
  'Prime', 'Odd', 'Even', 'Hidden', 'Shiny', 'Brave', 'Sly', 'Neon', 'Stellar', 'Random',
];
const NOUNS = [
  'Otter', 'Comet', 'Falcon', 'Badger', 'Dice', 'Fox', 'Panda', 'Raven', 'Tiger', 'Koala',
  'Nova', 'Quasar', 'Lynx', 'Gecko', 'Owl', 'Mantis', 'Whale', 'Yeti', 'Golem', 'Sprite',
];

export function generateUsername(rng: RandomSource): string {
  const adjective = ADJECTIVES[rng.int(ADJECTIVES.length)]!;
  const noun = NOUNS[rng.int(NOUNS.length)]!;
  return `${adjective}${noun}${10 + rng.int(9_990)}`;
}
