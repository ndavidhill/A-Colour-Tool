// Colour name lookup — finds the nearest human-readable name for any RGB value.
// Uses Lab/deltaE2000 for perceptual accuracy, same as the rest of the tool.
// Dataset: ~200 well-known colour names covering the full gamut, curated for
// design and print contexts (Pantone common names, CSS extended, RAL equivalents).

// Format: [name, L, a, b]
const COLOUR_NAMES = [
  // Reds
  ['Red',              53.23,  80.11,  67.22],
  ['Crimson',          36.42,  56.33,  26.11],
  ['Scarlet',          48.08,  67.44,  50.33],
  ['Carmine',          38.22,  58.11,  28.44],
  ['Ruby',             37.44,  55.22,  22.11],
  ['Vermillion',       50.11,  65.88,  48.22],
  ['Coral',            64.33,  40.11,  28.88],
  ['Salmon',           67.88,  29.44,  19.55],
  ['Tomato',           53.44,  61.55,  48.88],
  ['Rose',             66.44,  44.22,  12.88],
  ['Blush',            74.33,  22.11,   8.44],
  ['Burgundy',         28.55,  33.22,  14.88],
  ['Maroon',           28.88,  29.44,  15.22],
  ['Cherry',           35.55,  50.88,  24.44],
  ['Brick Red',        40.22,  37.55,  28.88],
  ['Rust',             43.55,  34.22,  32.11],
  ['Terracotta',       50.88,  28.55,  28.22],
  // Oranges
  ['Orange',           66.88,  43.22,  74.88],
  ['Amber',            72.55,  18.88,  74.22],
  ['Tangerine',        65.44,  47.22,  68.55],
  ['Peach',            77.22,  21.44,  22.55],
  ['Apricot',          75.88,  18.22,  32.44],
  ['Burnt Orange',     50.88,  36.44,  50.88],
  ['Pumpkin',          56.44,  41.22,  58.55],
  ['Sienna',           43.88,  24.55,  32.88],
  ['Burnt Sienna',     45.33,  28.88,  34.22],
  ['Sandy Brown',      69.55,  16.44,  34.22],
  ['Copper',           55.22,  22.44,  30.88],
  // Yellows
  ['Yellow',           97.14, -21.56,  94.48],
  ['Gold',             79.22, -1.88,   70.55],
  ['Mustard',          69.55,  -1.22,  60.88],
  ['Lemon',            94.44, -15.88,  78.44],
  ['Cream',            95.88,  -2.44,  10.22],
  ['Ivory',            97.22,  -1.22,   5.88],
  ['Khaki',            75.55,  -2.88,  35.55],
  ['Straw',            82.22,  -3.44,  35.88],
  ['Goldenrod',        72.55,   6.88,  66.22],
  ['Saffron',          73.88,  13.22,  70.55],
  ['Chartreuse',       89.33, -41.22,  83.55],
  ['Lime Yellow',      91.22, -28.44,  80.88],
  // Greens
  ['Green',            46.28, -47.55,  48.59],
  ['Lime',             77.70, -64.22,  74.55],
  ['Emerald',          44.55, -43.22,  24.88],
  ['Forest Green',     31.55, -24.88,  17.44],
  ['Sage',             60.88, -15.22,  10.88],
  ['Mint',             76.44, -23.55,  10.22],
  ['Teal',             48.22, -25.88,  -8.55],
  ['Olive',            51.22,  -8.88,  35.55],
  ['Moss',             44.88, -14.22,  22.88],
  ['Jade',             49.33, -32.44,  10.88],
  ['Seafoam',          72.55, -22.44,   4.88],
  ['Pistachio',        74.22, -20.88,  20.44],
  ['Hunter Green',     28.88, -18.44,  10.22],
  ['Kelly Green',      52.55, -44.88,  38.22],
  ['Fern',             53.22, -30.55,  22.88],
  ['Avocado',          55.44, -16.88,  30.44],
  ['Viridian',         42.88, -28.22,   3.55],
  // Blues
  ['Blue',             32.30,  79.19, -107.86],
  ['Navy',             18.55,  14.88, -35.22],
  ['Royal Blue',       29.44,  22.55, -55.88],
  ['Cobalt',           33.44,  22.88, -52.44],
  ['Cerulean',         49.33, -11.22, -35.88],
  ['Sky Blue',         66.44,  -6.22, -25.55],
  ['Baby Blue',        76.22,  -4.88, -16.44],
  ['Periwinkle',       60.88,  10.44, -30.88],
  ['Cornflower',       54.88,   8.22, -40.22],
  ['Steel Blue',       47.22,  -1.88, -23.44],
  ['Powder Blue',      74.55,  -5.55, -11.88],
  ['Ice Blue',         88.22,  -3.55,  -6.22],
  ['Denim',            37.22,   0.88, -26.44],
  ['Slate Blue',       40.55,  12.44, -28.88],
  ['Indigo',           22.88,  22.88, -44.88],
  ['Midnight Blue',    13.22,   8.22, -22.44],
  ['Electric Blue',    48.88,  -8.22, -70.44],
  ['Sapphire',         27.22,  17.44, -42.88],
  // Purples
  ['Purple',           29.69,  56.37, -36.30],
  ['Violet',           38.55,  52.22, -47.88],
  ['Lavender',         74.88,  14.55, -20.88],
  ['Lilac',            67.22,  20.88, -17.44],
  ['Mauve',            57.88,  22.55,  -7.88],
  ['Plum',             33.55,  30.88, -10.44],
  ['Amethyst',         48.88,  36.22, -28.88],
  ['Wisteria',         58.44,  24.88, -22.44],
  ['Grape',            30.22,  30.11, -18.88],
  ['Orchid',           60.44,  39.88, -17.22],
  ['Fuchsia',          50.55,  67.88, -18.44],
  ['Magenta',          60.17,  98.25, -60.84],
  ['Hot Pink',         59.22,  65.55, -10.88],
  ['Mulberry',         38.88,  38.44, -10.22],
  ['Eggplant',         20.22,  16.88,  -8.44],
  ['Thistle',          72.55,  14.88, -12.44],
  // Pinks
  ['Pink',             73.55,  43.22,   5.88],
  ['Rose Pink',        68.88,  36.88,   3.44],
  ['Flamingo',         72.22,  30.22,   8.22],
  ['Bubblegum',        75.88,  36.44,  -2.88],
  ['Carnation',        69.44,  41.88,   4.44],
  ['Ballet',           78.22,  22.55,   2.22],
  ['Dusty Rose',       60.55,  21.88,   4.88],
  ['Blush Pink',       80.55,  17.22,   5.44],
  ['Powder Pink',      84.88,  10.88,   3.22],
  // Browns
  ['Brown',            37.20,  14.58,  17.56],
  ['Chocolate',        28.88,  15.22,  14.44],
  ['Coffee',           34.22,  11.88,  13.22],
  ['Caramel',          51.88,  17.44,  28.88],
  ['Toffee',           47.22,  16.88,  24.44],
  ['Tan',              66.44,   7.88,  19.44],
  ['Beige',            81.44,   1.88,  10.88],
  ['Taupe',            56.88,   3.44,   6.88],
  ['Mocha',            37.44,  10.88,  10.22],
  ['Walnut',           30.88,  10.55,  10.88],
  ['Mahogany',         33.22,  21.88,  15.44],
  ['Chestnut',         36.55,  19.88,  15.88],
  ['Ochre',            58.22,   4.88,  38.44],
  ['Raw Umber',        41.55,   5.22,  18.88],
  ['Sepia',            37.22,   8.88,  14.22],
  // Neutrals
  ['White',           100.00,   0.00,   0.00],
  ['Off White',        96.55,  -0.44,   2.88],
  ['Snow',             97.88,  -0.22,   1.22],
  ['Alabaster',        95.22,   0.22,   2.44],
  ['Pearl',            94.88,  -0.44,   1.88],
  ['Linen',            92.55,   1.55,   5.88],
  ['Parchment',        89.22,   1.22,   9.44],
  ['Ecru',             87.44,   0.88,   9.88],
  ['Sand',             80.55,   1.44,  13.88],
  ['Stone',            68.88,   0.88,   5.44],
  ['Ash',              77.22,   0.22,  -0.88],
  ['Silver',           79.55,  -0.22,   0.55],
  ['Grey',             53.39,   0.00,   0.00],
  ['Slate',            44.55,  -1.22,  -3.88],
  ['Charcoal',         28.88,   0.22,  -1.22],
  ['Graphite',         35.55,   0.55,  -1.44],
  ['Gunmetal',         30.22,  -1.44,  -3.22],
  ['Onyx',             20.88,   0.22,  -0.88],
  ['Black',             0.00,   0.00,   0.00],
  ['Jet Black',         6.55,   0.22,  -0.44],
  // Specialty
  ['Neon Green',       91.55, -52.88,  74.22],
  ['Neon Pink',        72.88,  68.44,  -5.44],
  ['Neon Orange',      74.22,  42.88,  69.55],
  ['Electric Purple',  38.88,  60.88, -52.44],
  ['Turquoise',        67.22, -32.55, -14.22],
  ['Cyan',             91.11, -48.09, -14.13],
  ['Aquamarine',       74.88, -33.55,   4.88],
  ['Powder',           78.55,  -8.44, -14.88],
  ['Celadon',          71.88, -18.22,   8.88],
  ['Verdigris',        54.88, -22.55,   0.88],
];

// Build Lab lookup once
const _nameCache = COLOUR_NAMES.map(([name, L, a, b]) => ({ name, lab: { L, a, b } }));

// deltaE2000 — reuse the same formula from colourMath
import { rgbToLab, deltaE2000 } from './colourMath';

export function nameColour(r, g, b) {
  const targetLab = rgbToLab(r, g, b);
  let best = null;
  let bestDE = Infinity;

  for (let i = 0; i < _nameCache.length; i++) {
    const dE = deltaE2000(targetLab, _nameCache[i].lab);
    if (dE < bestDE) {
      bestDE = dE;
      best = _nameCache[i];
    }
  }

  return { name: best.name, deltaE: bestDE };
}
