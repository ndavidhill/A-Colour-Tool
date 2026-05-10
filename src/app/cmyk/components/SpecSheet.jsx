'use client';
import { useMemo, useState } from 'react';
import {
  rgbToCmyk, cmykToRgb, rgbToHex, rgbToLab,
  nearestPantones, isOutOfGamut, useDarkText,
} from '../colourMath';
import { nameColour } from '../colourNames';

const MONO = {
  fontFamily: 'Helvetica, Arial, sans-serif',
  fontWeight: 'bold',
  letterSpacing: '0.03rem',
  textTransform: 'uppercase',
};

function relativeLuminance(r, g, b) {
  return [r, g, b].reduce((acc, v, i) => {
    const c = v / 255;
    return acc + (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
      * [0.2126, 0.7152, 0.0722][i];
  }, 0);
}

function generateTints(c, m, y, k) {
  return [100, 90, 80, 70, 60, 50, 40, 30, 20, 10].map(pct => {
    const f = pct / 100;
    return {
      pct,
      c: Math.round(c * f),
      m: Math.round(m * f),
      y: Math.round(y * f),
      k: Math.round(k * f),
    };
  });
}

function SpecCard({ entry }) {
  const [notes, setNotes] = useState('');

  const cmyk     = useMemo(() => rgbToCmyk(entry.r, entry.g, entry.b), [entry.r, entry.g, entry.b]);
  const lab      = useMemo(() => rgbToLab(entry.r, entry.g, entry.b), [entry.r, entry.g, entry.b]);
  const hex      = rgbToHex(entry.r, entry.g, entry.b);
  const dark     = useDarkText(entry.r, entry.g, entry.b);
  const textColor = dark ? '#000' : '#fff';
  const pantones = useMemo(() => nearestPantones(entry.r, entry.g, entry.b, 2), [entry.r, entry.g, entry.b]);
  const gamut    = useMemo(() => isOutOfGamut(entry.r, entry.g, entry.b), [entry.r, entry.g, entry.b]);
  const name     = useMemo(() => nameColour(entry.r, entry.g, entry.b), [entry.r, entry.g, entry.b]);
  const tints    = useMemo(() => generateTints(cmyk.c, cmyk.m, cmyk.y, cmyk.k), [cmyk.c, cmyk.m, cmyk.y, cmyk.k]);
  const tac      = cmyk.c + cmyk.m + cmyk.y + cmyk.k;

  const lum = relativeLuminance(entry.r, entry.g, entry.b);
  const maxContrast = Math.max(1.05 / (lum + 0.05), (lum + 0.05) / 0.05);

  const healthChecks = [
    {
      label: 'Gamut',
      status: gamut.outOfGamut ? 'fail' : 'pass',
      detail: gamut.outOfGamut
        ? `Out of FOGRA39 — dE ${gamut.deltaE.toFixed(1)}`
        : `In FOGRA39 — dE ${gamut.deltaE.toFixed(1)}`,
    },
    {
      label: 'TAC',
      status: tac > 330 ? 'fail' : tac > 310 ? 'warn' : 'pass',
      detail: `${tac}% — limit 330%`,
    },
    {
      label: 'Contrast',
      status: maxContrast >= 4.5 ? 'pass' : maxContrast >= 3 ? 'warn' : 'fail',
      detail: `${maxContrast.toFixed(1)}:1 — WCAG AA 4.5`,
    },
  ];
  const statusColors = { pass: '#16a34a', warn: '#d97706', fail: '#ef4444' };

  return (
    <div className="spec-card colour-group" style={{
      marginBottom: 28,
      borderRadius: 6,
      background: 'var(--color-accent)',
      overflow: 'hidden',
      breakAfter: 'page',
      pageBreakAfter: 'always',
    }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        padding: '10px 16px 9px',
        borderBottom: '1px solid var(--color-bg)',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <div style={{ ...MONO, fontSize: 13, color: 'var(--color-fg)' }}>
            {entry.label || `RGB ${entry.r} ${entry.g} ${entry.b}`}
          </div>
          {name && (
            <div style={{ ...MONO, fontSize: 9, opacity: 0.35, color: 'var(--color-fg)' }}>
              {name.name}
            </div>
          )}
        </div>
        <div style={{ ...MONO, fontSize: 8, opacity: 0.3, color: 'var(--color-fg)' }}>
          FOGRA39 · {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* ── Main body ──────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr' }}>

        {/* Left: large swatch */}
        <div style={{
          background: hex,
          WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          padding: 14, minHeight: 190,
        }}>
          <div style={{ ...MONO, color: textColor, fontSize: 16, lineHeight: 1.2 }}>
            {hex.toUpperCase()}
          </div>
        </div>

        {/* Right: values + pantone + tints */}
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Colour values */}
          <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr', rowGap: 5, columnGap: 12 }}>
            {[
              ['CMYK', `C${cmyk.c}  M${cmyk.m}  Y${cmyk.y}  K${cmyk.k}`],
              ['RGB',  `${entry.r}  ${entry.g}  ${entry.b}`],
              ['HEX',  hex.toUpperCase()],
              ['LAB',  `L${Math.round(lab.L)}  a${Math.round(lab.a)}  b${Math.round(lab.b)}`],
            ].map(([label, value]) => [
              <div key={label + '-l'} style={{ ...MONO, fontSize: 8, opacity: 0.35, color: 'var(--color-fg)', paddingTop: 2 }}>{label}</div>,
              <div key={label + '-v'} style={{ ...MONO, fontSize: 11, color: 'var(--color-fg)' }}>{value}</div>,
            ])}
          </div>

          {/* Pantone nearest */}
          {pantones.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ ...MONO, fontSize: 8, opacity: 0.35, color: 'var(--color-fg)' }}>Pantone</div>
              {pantones.map((p, i) => {
                const prgb = cmykToRgb(p.c, p.m, p.y, p.k);
                const phex = rgbToHex(prgb.r, prgb.g, prgb.b);
                const pdark = useDarkText(prgb.r, prgb.g, prgb.b);
                return (
                  <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      background: phex, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
                      borderRadius: 3, padding: '2px 8px',
                      ...MONO, fontSize: 8,
                      color: pdark ? '#000' : '#fff', flexShrink: 0,
                    }}>
                      {i === 0 ? '1st · ' : '2nd · '}{p.name}
                    </div>
                    <div style={{ ...MONO, fontSize: 8, opacity: 0.4, color: 'var(--color-fg)' }}>
                      C{p.c} M{p.m} Y{p.y} K{p.k} · dE {p.deltaE.toFixed(1)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Tint strip */}
          <div>
            <div style={{ ...MONO, fontSize: 8, opacity: 0.35, color: 'var(--color-fg)', marginBottom: 6 }}>Tints</div>
            <div style={{ display: 'flex', gap: 3 }}>
              {tints.map(t => {
                const trgb = cmykToRgb(t.c, t.m, t.y, t.k);
                const thex = rgbToHex(trgb.r, trgb.g, trgb.b);
                return (
                  <div key={t.pct} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{
                      height: 30, borderRadius: 3,
                      background: thex,
                      WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
                      marginBottom: 3,
                    }} />
                    <div style={{ ...MONO, fontSize: 6, opacity: 0.45, color: 'var(--color-fg)' }}>{t.pct}</div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {/* ── Health row ─────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        borderTop: '1px solid var(--color-bg)',
      }}>
        {healthChecks.map((c, i) => (
          <div key={c.label} style={{
            padding: '8px 14px',
            borderRight: i < 2 ? '1px solid var(--color-bg)' : 'none',
            display: 'flex', alignItems: 'center', gap: 7,
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: statusColors[c.status], flexShrink: 0,
            }} />
            <div>
              <div style={{ ...MONO, fontSize: 8, color: 'var(--color-fg)' }}>{c.label}</div>
              <div style={{ ...MONO, fontSize: 7, opacity: 0.4, color: 'var(--color-fg)', marginTop: 1 }}>{c.detail}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Notes ──────────────────────────────────────────────────────── */}
      <div style={{ borderTop: '1px solid var(--color-bg)', padding: '8px 16px 12px' }}>
        <div style={{ ...MONO, fontSize: 8, opacity: 0.35, color: 'var(--color-fg)', marginBottom: 5 }}>Notes</div>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Usage guidelines, restrictions, sign-off…"
          rows={2}
          style={{
            width: '100%', background: 'transparent',
            border: 'none', borderBottom: '1px solid var(--color-bg)',
            color: 'var(--color-fg)', resize: 'none', outline: 'none',
            ...MONO, fontSize: 10, padding: '3px 0', lineHeight: 1.6,
          }}
        />
      </div>
    </div>
  );
}

export default function SpecSheet({ colours }) {
  if (colours.length === 0) {
    return (
      <div style={{
        padding: 20, ...MONO, fontSize: 12,
        opacity: 0.3, color: 'var(--color-fg)',
      }}>
        Add colours to the queue to generate spec sheets.
      </div>
    );
  }

  return (
    <div>
      {colours.map((entry, i) => (
        <SpecCard key={`${entry.r}-${entry.g}-${entry.b}-${i}`} entry={entry} />
      ))}
    </div>
  );
}
