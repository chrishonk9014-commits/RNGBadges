import { referenceBadges, rows } from './references';

/**
 * Calculator words: type the digits, turn the calculator upside down.
 * 0→O 1→I 3→E 4→h 5→S 6→g 7→L 8→B, read right to left.
 */
export const CALCULATOR = referenceBadges(
  'calculator',
  'calc',
  rows([
    ['338', 'bee', 'Spelling Bee', 'Upside down, 338 reads BEE.'],
    ['663', 'egg', 'Easter Egg', 'Upside down, 663 reads EGG.'],
    ['710', 'oil', 'Oil Change', 'Upside down, 710 reads OIL.'],
    ['3045', 'shoe', 'If the Shoe Fits', 'Upside down, 3045 reads SHOE.'],
    ['3507', 'lose', 'Sore Loser', 'Upside down, 3507 reads LOSE.'],
    ['3704', 'hole', 'Hole in One', 'Upside down, 3704 reads hOLE.'],
    ['5508', 'boss', 'Boss Level', 'Upside down, 5508 reads BOSS.'],
    ['5537', 'less', 'Less Is More', 'Upside down, 5537 reads LESS.'],
    ['7105', 'soil', 'Soil Sample', 'Upside down, 7105 reads SOIL.'],
    ['7714', 'hill', 'Over the Hill', 'Upside down, 7714 reads hILL.'],
    ['7718', 'bill', 'Pay the Bill', 'Upside down, 7718 reads BILL.'],
    ['7734', 'hell', 'Highway to hELL', 'Upside down, 7734 reads hELL.'],
    ['7738', 'bell', 'Saved by the Bell', 'Upside down, 7738 reads BELL.'],
    ['07734', 'hello', 'Hello, Calculator', 'Upside down, 07734 reads hELLO.', undefined, ''],
    ['31770', 'ollie', 'Ollie', 'Upside down, 31770 reads OLLIE.'],
    ['58008', 'classic', 'Calculator Classic', 'The oldest joke a calculator ever told. Turn it upside down.'],
    ['77345', 'shell', 'Shell Game', 'Upside down, 77345 reads ShELL.'],
    ['372215', 'sizzle', 'Sizzle', 'Upside down, 372215 reads SIZZLE.'],
  ]),
  {
    ends: (name) => `${name}, Flipped`,
    only: (name) => `${name}, Spelled Out`,
  },
);

/** Phone words: letters dialled on a keypad (ABC=2 … WXYZ=9). Game-themed on purpose. */
export const PHONE_WORDS = referenceBadges(
  'phoneword',
  'dial',
  rows([
    ['565', 'lol', 'Dial L-O-L', 'L-O-L on a phone keypad.'],
    ['664', 'omg', 'Dial O-M-G', 'O-M-G on a phone keypad.'],
    ['764', 'rng', 'Dial R-N-G', 'R-N-G on a phone keypad. You are here.'],
    ['946', 'win', 'Dial W-I-N', 'W-I-N on a phone keypad.'],
    ['969', 'wow', 'Dial W-O-W', 'W-O-W on a phone keypad.'],
    ['3423', 'dice', 'Dial D-I-C-E', 'D-I-C-E on a phone keypad.'],
    ['3742', 'epic', 'Dial E-P-I-C', 'E-P-I-C on a phone keypad.'],
    ['5825', 'luck', 'Dial L-U-C-K', 'L-U-C-K on a phone keypad.'],
    ['7655', 'roll', 'Dial R-O-L-L', 'R-O-L-L on a phone keypad.'],
    ['22343', 'badge', 'Dial B-A-D-G-E', 'B-A-D-G-E on a phone keypad.'],
    ['58259', 'lucky', 'Dial L-U-C-K-Y', 'L-U-C-K-Y on a phone keypad.'],
    ['223437', 'badges', 'Dial B-A-D-G-E-S', 'B-A-D-G-E-S on a phone keypad.'],
    ['242623', 'chance', 'Dial C-H-A-N-C-E', 'C-H-A-N-C-E on a phone keypad.'],
    ['534363', 'legend', 'Dial L-E-G-E-N-D', 'L-E-G-E-N-D on a phone keypad.'],
    ['726366', 'random', 'Dial R-A-N-D-O-M', 'R-A-N-D-O-M on a phone keypad.'],
    ['946637', 'winner', 'Dial W-I-N-N-E-R', 'W-I-N-N-E-R on a phone keypad.'],
  ]),
  {
    ends: (name) => `${name}, Hang Up`,
    only: (name) => `${name} Hotline`,
  },
);
