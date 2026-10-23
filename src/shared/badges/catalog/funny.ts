import type { BadgeDef } from '../types';

/**
 * Funny numbers. These are positional on purpose: "21____" means the roll
 * starts with 21. Only the doubles/triples listed here exist — not every
 * repetition of every funny number.
 */
export const FUNNY: BadgeDef[] = [
  {
    id: 'funny.21-start',
    name: 'Twenty-One',
    description: 'The roll starts with 21 (21____).',
    flavor: "What's 9 + 10?",
    category: 'funny',
    rule: { kind: 'mask', mask: '21____' },
    family: 'funny.21',
  },
  {
    id: 'funny.55-start',
    name: 'Double Nickel',
    description: 'The roll starts with 55 (55____).',
    flavor: 'Trucker slang for the old 55 mph speed limit.',
    category: 'funny',
    rule: { kind: 'mask', mask: '55____' },
  },
  {
    id: 'funny.67-start',
    name: 'Six Seven',
    description: 'The roll starts with 67 (67____).',
    flavor: 'Six… seven…',
    category: 'funny',
    rule: { kind: 'mask', mask: '67____' },
    family: 'funny.67',
  },
  {
    id: 'funny.61-start',
    name: 'Highway 61',
    description: 'The roll starts with 61 (61____).',
    flavor: 'Revisited.',
    category: 'funny',
    rule: { kind: 'mask', mask: '61____' },
  },
  {
    id: 'funny.41-start',
    name: 'Forty-One',
    description: 'The roll starts with 41 (41____).',
    flavor: 'Four-one. Say it with your chest.',
    category: 'funny',
    rule: { kind: 'mask', mask: '41____' },
  },
  {
    id: 'funny.69-start',
    name: 'Nice',
    description: 'The roll starts with 69 (69____).',
    flavor: 'Nice.',
    category: 'funny',
    rule: { kind: 'mask', mask: '69____' },
    family: 'funny.69',
  },
  {
    id: 'funny.21-center',
    name: 'Dead Center 21',
    description: '21 sits in the exact middle of the roll (__21__).',
    flavor: 'Nineteen plus two, perfectly balanced.',
    category: 'funny',
    rule: { kind: 'mask', mask: '__21__' },
    family: 'funny.21',
  },
  {
    id: 'funny.67-offset',
    name: 'Six Seven, Off Center',
    description: '67 in the fourth and fifth digits (___67_).',
    flavor: 'It wandered off. Still counts.',
    category: 'funny',
    rule: { kind: 'mask', mask: '___67_' },
    family: 'funny.67',
  },
  {
    id: 'funny.2121',
    name: 'Double Twenty-One',
    description: 'The roll starts with 2121 (2121__).',
    flavor: 'Twenty-one, twice. Double funny.',
    category: 'funny',
    rule: { kind: 'mask', mask: '2121__' },
    family: 'funny.21',
  },
  {
    id: 'funny.676767',
    name: 'TRIPLE 67!',
    description: 'The roll is exactly 676767.',
    flavor: 'SIX SEVEN SIX SEVEN SIX SEVEN.',
    category: 'funny',
    rule: { kind: 'exact', value: '676767' },
    family: 'funny.67',
  },
  {
    id: 'funny.696969',
    name: 'Nice. Nice. Nice.',
    description: 'The roll is exactly 696969.',
    flavor: 'Three times the nice.',
    category: 'funny',
    rule: { kind: 'exact', value: '696969' },
    family: 'funny.69',
  },
];

/** Math Equation! is one badge for every AB + CD = EF roll, not one badge per equation. */
export const EQUATIONS: BadgeDef[] = [
  {
    id: 'math.equation',
    name: 'Math Equation!',
    description: 'The roll reads as a two-digit sum: AB + CD = EF (551267 → 55 + 12 = 67).',
    flavor: 'Show your work.',
    category: 'math',
    rule: { kind: 'test', test: (f) => f.length === 6 && two(f.digits, 0) + two(f.digits, 2) === two(f.digits, 4) },
  },
  {
    id: 'math.multiplication',
    name: 'Multiplication!',
    description: 'AB × CD = EF, with both factors at least 2 (040832 → 04 × 08 = 32).',
    flavor: 'Times tables, finally useful.',
    category: 'math',
    rule: {
      kind: 'test',
      test: (f) => {
        if (f.length !== 6) return false;
        const a = two(f.digits, 0);
        const b = two(f.digits, 2);
        return a >= 2 && b >= 2 && a * b === two(f.digits, 4);
      },
    },
  },
  {
    id: 'math.double-up',
    name: 'Double Up',
    description: 'The last three digits are exactly double the first three (123246).',
    flavor: 'Twice as nice.',
    category: 'math',
    rule: {
      kind: 'test',
      test: (f) => {
        if (f.length !== 6) return false;
        const a = Number(f.digits.slice(0, 3));
        return a > 0 && Number(f.digits.slice(3)) === 2 * a;
      },
    },
  },
  {
    id: 'math.square-deal',
    name: 'Square Deal',
    description: 'The last four digits are the square of the first two (321024 → 32² = 1024).',
    flavor: 'Fair and square.',
    category: 'math',
    rule: {
      kind: 'test',
      test: (f) => {
        if (f.length !== 6) return false;
        const a = two(f.digits, 0);
        return a * a >= 1000 && a * a === Number(f.digits.slice(2));
      },
    },
  },
  {
    id: 'math.power-play',
    name: 'Power Play',
    description: 'A to the power B equals the last four digits (372187 → 3⁷ = 2187).',
    flavor: 'Exponential energy.',
    category: 'math',
    rule: {
      kind: 'test',
      test: (f) => {
        if (f.length !== 6) return false;
        const a = Number(f.digits[0]);
        const b = Number(f.digits[1]);
        const p = a ** b;
        return a >= 2 && b >= 2 && p >= 1000 && p === Number(f.digits.slice(2));
      },
    },
  },
  {
    id: 'math.pythagorean',
    name: 'Pythagorean',
    description: 'AB² + CD² = EF², all non-zero (030405 → 3² + 4² = 5²).',
    flavor: 'Right-angled and proud of it.',
    category: 'math',
    rule: {
      kind: 'test',
      test: (f) => {
        if (f.length !== 6) return false;
        const a = two(f.digits, 0);
        const b = two(f.digits, 2);
        const c = two(f.digits, 4);
        return a > 0 && b > 0 && a * a + b * b === c * c;
      },
    },
  },
  {
    id: 'math.fibonacci-rule',
    name: 'Fibonacci Rule',
    description: 'From the third digit on, every digit is the sum of the two before it (101123).',
    flavor: 'Each step stands on the last two.',
    category: 'math',
    rule: {
      kind: 'test',
      test: (f) => {
        if (f.length !== 6 || f.value === 0) return false;
        const d = f.digits;
        for (let i = 2; i < 6; i++) if (Number(d[i]) !== Number(d[i - 1]) + Number(d[i - 2])) return false;
        return true;
      },
    },
  },
];

function two(digits: string, at: number): number {
  return (digits.charCodeAt(at) - 48) * 10 + (digits.charCodeAt(at + 1) - 48);
}
