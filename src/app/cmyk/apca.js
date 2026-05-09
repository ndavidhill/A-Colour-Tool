// APCA-W3 Lightness Contrast (Lc) — draft WCAG 3 algorithm
// Based on SAPC-7 / APCA 0.0.98G4g by Andrew Somers (Myndex Research)
// https://github.com/Myndex/apca-w3
//
// Returns a signed Lc value:
//   Positive → dark text on light background
//   Negative → light text on dark background
//   Absolute value used for threshold comparisons

const mainTRC = 2.4;
const sRco = 0.2126729, sGco = 0.7151522, sBco = 0.0721750;
const normBG = 0.56, normTXT = 0.57, revTXT = 0.62, revBG = 0.65;
const blkThrs = 0.022, blkClmp = 1.414;
const scaleBoW = 1.14, scaleWoB = 1.14;
const loBoWoffset = 0.027, loWoBoffset = 0.027;
const loClip = 0.1, deltaYmin = 0.0005;

function sRGBtoLin(val) {
  val /= 255;
  return val <= 0.04045 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, mainTRC);
}

function toLum(r, g, b) {
  return sRco * sRGBtoLin(r) + sGco * sRGBtoLin(g) + sBco * sRGBtoLin(b);
}

export function apcaContrast(txtR, txtG, txtB, bgR, bgG, bgB) {
  let Ytxt = toLum(txtR, txtG, txtB);
  let Ybg  = toLum(bgR,  bgG,  bgB);

  // Soft-clamp near-black
  Ytxt = Ytxt > blkThrs ? Ytxt : Ytxt + Math.pow(blkThrs - Ytxt, blkClmp);
  Ybg  = Ybg  > blkThrs ? Ybg  : Ybg  + Math.pow(blkThrs - Ybg,  blkClmp);

  if (Math.abs(Ybg - Ytxt) < deltaYmin) return 0;

  if (Ybg > Ytxt) {
    const Sapc = (Math.pow(Ybg, normBG) - Math.pow(Ytxt, normTXT)) * scaleBoW;
    return Sapc < loClip ? 0 : (Sapc - loBoWoffset) * 100;
  } else {
    const Sapc = (Math.pow(Ybg, revBG) - Math.pow(Ytxt, revTXT)) * scaleWoB;
    return Sapc > -loClip ? 0 : (Sapc + loWoBoffset) * 100;
  }
}

// Readability level from absolute |Lc|
export function apcaLevel(lc) {
  const a = Math.abs(lc);
  if (a >= 75) return { label: 'Lc 75+ · Fluent', ok: true,  short: 'Fluent' };
  if (a >= 60) return { label: 'Lc 60+ · Body',   ok: true,  short: 'Body'   };
  if (a >= 45) return { label: 'Lc 45+ · Large',  ok: true,  short: 'Large'  };
  if (a >= 30) return { label: 'Lc 30+ · UI',     ok: true,  short: 'UI'     };
  return              { label: 'Lc <30 · Fail',   ok: false, short: 'Fail'   };
}
