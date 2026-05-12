// Radix-style 12-step palette generator
// Works in OKLCH colour space — perceptually uniform, no hue drift.
// Step 9 is the input colour. Light/dark modes use different lightness curves.
// Algorithm inspired by Radix UI custom palette tool (MIT licence).

// ─── OKLCH conversion ─────────────────────────────────────────────────────────

function linearise(v) {
  v = v / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function delinearise(v) {
  return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

function rgbToOklch(r, g, b) {
  const rl = linearise(r), gl = linearise(g), bl = linearise(b);

  // Linear sRGB → OKLab (Björn Ottosson's matrix)
  const l = 0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl;
  const m = 0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl;
  const s = 0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl;

  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);

  const L  =  0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a  =  1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const bv = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;

  const C = Math.sqrt(a * a + bv * bv);
  const H = (Math.atan2(bv, a) * 180 / Math.PI + 360) % 360;

  return { L, C, H };
}

function oklchToRgb(L, C, H) {
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

  const clamp01 = v => Math.max(0, Math.min(1, v));

  return {
    r: Math.round(delinearise(clamp01(rl)) * 255),
    g: Math.round(delinearise(clamp01(gl)) * 255),
    b: Math.round(delinearise(clamp01(bl)) * 255),
  };
}

// ─── Palette generation ───────────────────────────────────────────────────────
//
// Calibrated against the Radix UI custom palette tool output for several
// reference colours (orange FA7319, blue 0070F3, red E5484D, green 30A46C).
//
// Key insight: steps 1–2 are near-achromatic backgrounds; steps 3–8 ramp
// AGGRESSIVELY toward baseC so the UI component and border steps are visibly
// distinct. Our previous scale (max 0.28 × baseC at step 8) was ~4× too low,
// producing indistinguishable grey-ish steps in light mode for vivid colours.

// Radix lightness targets for light mode (steps 1–12)
const LIGHT_LIGHTNESS = [
  0.988, // 1  — app background        (near-white)
  0.972, // 2  — subtle background
  0.934, // 3  — UI element background
  0.900, // 4  — hovered UI element
  0.864, // 5  — active / selected
  0.824, // 6  — subtle borders
  0.771, // 7  — UI element border
  0.702, // 8  — hovered border        (clearly chromatic by here)
  null,  // 9  — solid (= input colour)
  0.000, // 10 — hovered solid         (computed: baseL − 0.04)
  0.440, // 11 — low-contrast text
  0.230, // 12 — high-contrast text
];

// Dark mode lightness targets — mostly correct per user review, minor tweaks
const DARK_LIGHTNESS = [
  0.130, // 1
  0.162, // 2
  0.212, // 3
  0.252, // 4
  0.288, // 5
  0.334, // 6
  0.404, // 7
  0.484, // 8
  null,  // 9 — solid (= input colour)
  0.000, // 10 — hovered solid
  0.780, // 11 — low-contrast text
  0.920, // 12 — high-contrast text
];

// Light mode chroma — calibrated to match Radix output.
// Steps 1–2: barely perceptible tint (≈0.03–0.07 × baseC).
// Steps 3–8: aggressive ramp from ~0.20 to ~0.97 × baseC so each step is
//            clearly distinct and the border/interactive zones are vivid.
// Steps 9–10: full source chroma.
// Steps 11–12: pulled back for readable text at darker lightness.
const LIGHT_CHROMA_SCALE = [
  0.030, // 1 — barely perceptible tint
  0.070, // 2 — subtle background tint
  0.200, // 3 — jump: clearly tinted UI BG
  0.374, // 4 — noticeably coloured
  0.540, // 5 — clearly coloured
  0.690, // 6 — quite saturated
  0.860, // 7 — very saturated
  0.970, // 8 — near-full, lighter value
  1.000, // 9 — source colour
  1.000, // 10
  0.680, // 11 — text, moderate chroma
  0.420, // 12 — text, constrained chroma
];

const DARK_CHROMA_SCALE = [
  0.020, 0.042, 0.105, 0.135, 0.165,
  0.205, 0.325, 0.510,
  1.000, // 9
  1.000, // 10
  0.650, // 11
  0.340, // 12
];

export function generateRadixPalette(r, g, b) {
  const { L: baseL, C: baseC, H: baseH } = rgbToOklch(r, g, b);

  function makeScale(lightnessTargets, chromaScales) {
    return lightnessTargets.map((lTarget, i) => {
      const chromaScale = chromaScales[i];
      const C = baseC * chromaScale;

      let L;
      if (lTarget === null) {
        // Step 9 — use the input colour directly
        L = baseL;
      } else if (i === 9) {
        // Step 10 — slightly adjusted from step 9 for hover state
        // Go slightly darker in light mode, slightly lighter in dark mode
        L = baseL < 0.5 ? baseL + 0.04 : baseL - 0.04;
      } else {
        L = lTarget;
      }

      const rgb = oklchToRgb(L, C, baseH);
      return { ...rgb, L, C, H: baseH };
    });
  }

  return {
    light: makeScale(LIGHT_LIGHTNESS, LIGHT_CHROMA_SCALE),
    dark:  makeScale(DARK_LIGHTNESS,  DARK_CHROMA_SCALE),
  };
}

// ─── Alpha scale ──────────────────────────────────────────────────────────────
// For each light-mode step, compute the alpha of the source colour that, when
// composited on white, produces an equivalent tint. Used for overlay tokens.
// Formula: R_step = R_src × α + 255 × (1−α)  →  α = (255 − R_step) / (255 − R_src)
export function generateAlphaScale(r, g, b) {
  const palette = generateRadixPalette(r, g, b);
  return palette.light.map(step => {
    const candidates = [];
    if (r !== 255) candidates.push((255 - step.r) / (255 - r));
    if (g !== 255) candidates.push((255 - step.g) / (255 - g));
    if (b !== 255) candidates.push((255 - step.b) / (255 - b));
    const alpha = candidates.length
      ? parseFloat(Math.max(0, Math.min(1, Math.max(...candidates))).toFixed(3))
      : 0;
    return { r, g, b, alpha };
  });
}

// Step semantic labels (Radix convention)
export const STEP_LABELS = [
  'App BG',      // 1
  'Subtle BG',   // 2
  'UI BG',       // 3
  'Hovered UI',  // 4
  'Active UI',   // 5
  'Border',      // 6
  'UI Border',   // 7
  'Focus Ring',  // 8
  'Solid',       // 9 — base colour
  'Hov. Solid',  // 10
  'Text Lo',     // 11
  'Text Hi',     // 12
];
