// ─── Basic conversions ────────────────────────────────────────────────────────

export function clamp(v, min = 0, max = 100) {
  return Math.max(min, Math.min(max, v));
}

export function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if ([r, g, b].some(isNaN)) return null;
  return { r, g, b };
}

export function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

// CMYK → RGB (simple model, used for swatch display)
export function cmykToRgb(c, m, y, k) {
  return {
    r: Math.round(255 * (1 - c / 100) * (1 - k / 100)),
    g: Math.round(255 * (1 - m / 100) * (1 - k / 100)),
    b: Math.round(255 * (1 - y / 100) * (1 - k / 100)),
  };
}

// ─── RGB → Lab (via XYZ, D50 illuminant — print standard) ────────────────────
// Using D50 (rather than D65) because ICC print profiles reference D50.

function linearise(v) {
  v = v / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function rgbToXyz(r, g, b) {
  // sRGB → Linear
  const rl = linearise(r);
  const gl = linearise(g);
  const bl = linearise(b);

  // sRGB D65 matrix, then Bradford adaptation to D50
  // Combined sRGB→XYZ D50 matrix (IEC 61966-2-1 + Bradford)
  const x = rl * 0.4360747 + gl * 0.3850649 + bl * 0.1430804;
  const y = rl * 0.2225045 + gl * 0.7168786 + bl * 0.0606169;
  const z = rl * 0.0139322 + gl * 0.0971045 + bl * 0.7141733;

  return { x, y, z };
}

function xyzToLab(x, y, z) {
  // D50 reference white
  const xn = 0.96429, yn = 1.00000, zn = 0.82513;

  function f(t) {
    return t > 0.008856 ? Math.cbrt(t) : (7.787 * t) + (16 / 116);
  }

  const fx = f(x / xn);
  const fy = f(y / yn);
  const fz = f(z / zn);

  return {
    L: (116 * fy) - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

export function rgbToLab(r, g, b) {
  const xyz = rgbToXyz(r, g, b);
  return xyzToLab(xyz.x, xyz.y, xyz.z);
}

// ─── ΔE2000 ───────────────────────────────────────────────────────────────────
// The industry-standard perceptual colour difference formula (CIE 2000).
// Used by ICC profiles, RIPs, and colour-managed print workflows.

export function deltaE2000(lab1, lab2) {
  const { L: L1, a: a1, b: b1 } = lab1;
  const { L: L2, a: a2, b: b2 } = lab2;

  const kL = 1, kC = 1, kH = 1;

  const C1 = Math.sqrt(a1 ** 2 + b1 ** 2);
  const C2 = Math.sqrt(a2 ** 2 + b2 ** 2);
  const Cab = (C1 + C2) / 2;
  const Cab7 = Cab ** 7;

  const G = 0.5 * (1 - Math.sqrt(Cab7 / (Cab7 + 25 ** 7)));
  const a1p = a1 * (1 + G);
  const a2p = a2 * (1 + G);

  const C1p = Math.sqrt(a1p ** 2 + b1 ** 2);
  const C2p = Math.sqrt(a2p ** 2 + b2 ** 2);

  const h1p = Math.atan2(b1, a1p) * (180 / Math.PI) + (b1 < 0 || (b1 === 0 && a1p < 0) ? 360 : 0);
  const h2p = Math.atan2(b2, a2p) * (180 / Math.PI) + (b2 < 0 || (b2 === 0 && a2p < 0) ? 360 : 0);

  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp;
  if (C1p * C2p === 0) {
    dhp = 0;
  } else if (Math.abs(h2p - h1p) <= 180) {
    dhp = h2p - h1p;
  } else if (h2p - h1p > 180) {
    dhp = h2p - h1p - 360;
  } else {
    dhp = h2p - h1p + 360;
  }

  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * (Math.PI / 180));

  const Lpm = (L1 + L2) / 2;
  const Cpm = (C1p + C2p) / 2;

  let Hpm;
  if (C1p * C2p === 0) {
    Hpm = h1p + h2p;
  } else if (Math.abs(h1p - h2p) <= 180) {
    Hpm = (h1p + h2p) / 2;
  } else if (h1p + h2p < 360) {
    Hpm = (h1p + h2p + 360) / 2;
  } else {
    Hpm = (h1p + h2p - 360) / 2;
  }

  const T = 1
    - 0.17 * Math.cos((Hpm - 30) * (Math.PI / 180))
    + 0.24 * Math.cos(2 * Hpm * (Math.PI / 180))
    + 0.32 * Math.cos((3 * Hpm + 6) * (Math.PI / 180))
    - 0.20 * Math.cos((4 * Hpm - 63) * (Math.PI / 180));

  const SL = 1 + 0.015 * Math.pow(Lpm - 50, 2) / Math.sqrt(20 + Math.pow(Lpm - 50, 2));
  const SC = 1 + 0.045 * Cpm;
  const SH = 1 + 0.015 * Cpm * T;

  const Cpm7 = Cpm ** 7;
  const RC = 2 * Math.sqrt(Cpm7 / (Cpm7 + 25 ** 7));
  const dTheta = 30 * Math.exp(-1 * Math.pow((Hpm - 275) / 25, 2));
  const RT = -Math.sin(2 * dTheta * (Math.PI / 180)) * RC;

  return Math.sqrt(
    (dLp / (kL * SL)) ** 2 +
    (dCp / (kC * SC)) ** 2 +
    (dHp / (kH * SH)) ** 2 +
    RT * (dCp / (kC * SC)) * (dHp / (kH * SH))
  );
}

// ─── FOGRA39-aware RGB → CMYK conversion ──────────────────────────────────────
//
// Instead of the naive formula, we search a candidate grid of CMYK values
// and find the perceptually nearest match using ΔE2000 in Lab colour space.
//
// FOGRA39 constraints applied:
//   - TAC (Total Area Coverage) ≤ 330%
//   - Max K: 85% (GCR — avoid heavy black that muddies colour)
//   - Step: 5% grid (matches our tool's step size)
//
// This produces results much closer to what a RIP or Adobe colour engine
// would choose, because ΔE2000 weights hue, chroma and lightness the same
// way human vision does.

// FOGRA39 print constraints
const FOGRA39_TAC   = 330;
const FOGRA39_MAX_K = 85;

// FOGRA39-aware RGB->CMYK using a two-pass search:
//   Pass 1: 10% coarse grid (~12k entries, no pre-allocation, fast)
//   Pass 2: 1% refinement in a +/-6 neighbourhood around the winner (~28k max)
// Total work per colour: ~40k deltaE2000 calls vs 165k for brute-force 1%.
// No heavy upfront cache build — Lab is computed on-the-fly per search.

export function rgbToCmyk(r, g, b) {
  const targetLab = rgbToLab(r, g, b);

  // Pass 1: coarse 10% grid search
  let bestC = 0, bestM = 0, bestY = 0, bestK = 0;
  let bestDE = Infinity;

  for (let c = 0; c <= 100; c += 10) {
    for (let m = 0; m <= 100; m += 10) {
      for (let y = 0; y <= 100; y += 10) {
        for (let k = 0; k <= FOGRA39_MAX_K; k += 10) {
          if (c + m + y + k > FOGRA39_TAC) continue;
          const rgb = cmykToRgb(c, m, y, k);
          const lab = rgbToLab(rgb.r, rgb.g, rgb.b);
          const dE  = deltaE2000(targetLab, lab);
          if (dE < bestDE) {
            bestDE = dE; bestC = c; bestM = m; bestY = y; bestK = k;
          }
        }
      }
    }
  }

  // Pass 2: 1% refinement in +/-6 neighbourhood around coarse winner
  const RANGE = 6;
  const cMin = Math.max(0,   bestC - RANGE);  const cMax = Math.min(100, bestC + RANGE);
  const mMin = Math.max(0,   bestM - RANGE);  const mMax = Math.min(100, bestM + RANGE);
  const yMin = Math.max(0,   bestY - RANGE);  const yMax = Math.min(100, bestY + RANGE);
  const kMin = Math.max(0,   bestK - RANGE);  const kMax = Math.min(FOGRA39_MAX_K, bestK + RANGE);

  for (let c = cMin; c <= cMax; c++) {
    for (let m = mMin; m <= mMax; m++) {
      for (let y = yMin; y <= yMax; y++) {
        for (let k = kMin; k <= kMax; k++) {
          if (c + m + y + k > FOGRA39_TAC) continue;
          const rgb = cmykToRgb(c, m, y, k);
          const lab = rgbToLab(rgb.r, rgb.g, rgb.b);
          const dE  = deltaE2000(targetLab, lab);
          if (dE < bestDE) {
            bestDE = dE; bestC = c; bestM = m; bestY = y; bestK = k;
          }
        }
      }
    }
  }

  return { c: bestC, m: bestM, y: bestY, k: bestK };
}

// ─── Grid generation ──────────────────────────────────────────────────────────

function generateNeighbours(baseCmyk, step, range) {
  const { c, m, y, k } = baseCmyk;
  const offsets = [];
  for (let dc = -range; dc <= range; dc++)
    for (let dm = -range; dm <= range; dm++)
      for (let dy = -range; dy <= range; dy++)
        for (let dk = -range; dk <= range; dk++)
          offsets.push([dc, dm, dy, dk]);

  return offsets.map(([dc, dm, dy, dk]) => {
    const nc = clamp(c + dc * step);
    const nm = clamp(m + dm * step);
    const ny = clamp(y + dy * step);
    const nk = clamp(k + dk * step);
    const rgb = cmykToRgb(nc, nm, ny, nk);
    return { c: nc, m: nm, y: ny, k: nk, ...rgb };
  });
}

export function buildGrid(sourceRgb, baseCmyk, step, spread) {
  const targetLab = rgbToLab(sourceRgb.r, sourceRgb.g, sourceRgb.b);
  const neighbours = generateNeighbours(baseCmyk, step, spread);

  const seen = new Set();
  const unique = neighbours.filter(sw => {
    const key = `${sw.c}-${sw.m}-${sw.y}-${sw.k}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by ΔE2000 — perceptual proximity, not RGB Euclidean
  unique.sort((a, b) => {
    const labA = rgbToLab(a.r, a.g, a.b);
    const labB = rgbToLab(b.r, b.g, b.b);
    return deltaE2000(targetLab, labA) - deltaE2000(targetLab, labB);
  });

  return unique.slice(0, 25);
}

// ─── Readability ──────────────────────────────────────────────────────────────

export function useDarkText(r, g, b) {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.45;
}

// ─── Pantone nearest match ────────────────────────────────────────────────────

import { PANTONE_C } from './pantoneData';

let _pantoneCache = null;

function buildPantoneCache() {
  if (_pantoneCache) return _pantoneCache;
  _pantoneCache = PANTONE_C.map(([name, lab, cmyk]) => ({
    name,
    lab: { L: lab[0], a: lab[1], b: lab[2] },
    c: cmyk[0], m: cmyk[1], y: cmyk[2], k: cmyk[3],
  }));
  return _pantoneCache;
}

// Returns top N nearest Pantone C swatches sorted by deltaE2000
export function nearestPantones(r, g, b, count = 2) {
  const targetLab = rgbToLab(r, g, b);
  const pantones  = buildPantoneCache();

  const results = [];
  for (let i = 0; i < pantones.length; i++) {
    const p  = pantones[i];
    const dE = deltaE2000(targetLab, p.lab);
    results.push({ ...p, deltaE: dE });
  }
  results.sort((a, b) => a.deltaE - b.deltaE);
  return results.slice(0, count);
}

// Convenience wrapper for single nearest (backwards compat)
export function nearestPantone(r, g, b) {
  return nearestPantones(r, g, b, 1)[0];
}

// Find nearest Pantones for a given CMYK value (used when a swatch is selected)
export function nearestPantonesForCmyk(c, m, y, k, count = 2) {
  const { r, g, b } = cmykToRgb(c, m, y, k);
  return nearestPantones(r, g, b, count);
}

// ─── FOGRA39 gamut warning ────────────────────────────────────────────────────
// A swatch is considered "out of gamut" if its screen RGB colour cannot be
// faithfully reproduced within FOGRA39 constraints (TAC 330, K max 85).
// We detect this by checking whether the nearest CMYK match has a perceptual
// distance (deltaE2000) above a threshold — meaning the press cannot get
// close enough to the intended screen colour.
//
// Threshold guide:
//   < 2  : imperceptible difference — in gamut
//   2–4  : just noticeable — borderline
//   4+   : clearly visible on press — out of gamut (flagged)

const GAMUT_WARNING_THRESHOLD = 4.0;

export function isOutOfGamut(r, g, b) {
  // Get the nearest printable CMYK
  const best = rgbToCmyk(r, g, b);
  // Convert that CMYK back to RGB (what the press actually produces)
  const printed = cmykToRgb(best.c, best.m, best.y, best.k);
  // Compare in Lab
  const targetLab  = rgbToLab(r, g, b);
  const printedLab = rgbToLab(printed.r, printed.g, printed.b);
  const dE = deltaE2000(targetLab, printedLab);
  return { outOfGamut: dE > GAMUT_WARNING_THRESHOLD, deltaE: dE };
}

// ─── Colour harmony ───────────────────────────────────────────────────────────
// Generates complementary, triadic, split-complementary and analogous companions
// all working in OKLCH so hue rotation is perceptually uniform.

function rgbToOklchSimple(r, g, b) {
  // Linear sRGB
  const rl = Math.pow(r / 255, 2.2);
  const gl = Math.pow(g / 255, 2.2);
  const bl = Math.pow(b / 255, 2.2);
  // OKLab
  const l = Math.cbrt(0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl);
  const m = Math.cbrt(0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl);
  const s = Math.cbrt(0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl);
  const L  =  0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
  const a  =  1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const bv = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  const C = Math.sqrt(a * a + bv * bv);
  const H = ((Math.atan2(bv, a) * 180 / Math.PI) + 360) % 360;
  return { L, C, H };
}

function oklchToRgbSimple(L, C, H) {
  const hRad = H * Math.PI / 180;
  const a = C * Math.cos(hRad);
  const bv = C * Math.sin(hRad);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * bv;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * bv;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * bv;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  const rl =  4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const gl = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  const c01 = v => Math.max(0, Math.min(1, v));
  const toSrgb = v => v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1/2.4) - 0.055;
  return {
    r: Math.round(toSrgb(c01(rl)) * 255),
    g: Math.round(toSrgb(c01(gl)) * 255),
    b: Math.round(toSrgb(c01(bl)) * 255),
  };
}

function rotateHue(r, g, b, angle) {
  const { L, C, H } = rgbToOklchSimple(r, g, b);
  return oklchToRgbSimple(L, C, (H + angle + 360) % 360);
}

export function generateHarmonies(r, g, b) {
  const comp  = rotateHue(r, g, b, 180);
  const tri1  = rotateHue(r, g, b, 120);
  const tri2  = rotateHue(r, g, b, 240);
  const split1 = rotateHue(r, g, b, 150);
  const split2 = rotateHue(r, g, b, 210);
  const ana1  = rotateHue(r, g, b, 30);
  const ana2  = rotateHue(r, g, b, -30);

  return [
    { label: 'Complementary',       colours: [comp] },
    { label: 'Triadic',             colours: [tri1, tri2] },
    { label: 'Split-Complementary', colours: [split1, split2] },
    { label: 'Analogous',           colours: [ana1, ana2] },
  ];
}
