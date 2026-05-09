'use client';
import { useMemo } from 'react';
import { generateRadixPalette, STEP_LABELS } from '../radixPalette';
import { rgbToHex, useDarkText } from '../colourMath';

// WCAG relative luminance
function luminance(r, g, b) {
  const s = [r, g, b].map(v => {
    v = v / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
}

function contrastRatio(r1, g1, b1, r2, g2, b2) {
  const l1 = luminance(r1, g1, b1);
  const l2 = luminance(r2, g2, b2);
  const lighter = Math.max(l1, l2);
  const darker  = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function wcagBadge(ratio) {
  if (ratio >= 7)   return { label: 'AAA', color: '#166534' };
  if (ratio >= 4.5) return { label: 'AA',  color: '#166534' };
  if (ratio >= 3)   return { label: 'AA+', color: '#92400e' }; // large text only
  return               { label: 'Fail', color: '#991b1b' };
}

function PaletteStep({ step, index, mode, bgStep }) {
  const hex  = rgbToHex(step.r, step.g, step.b);
  const dark = useDarkText(step.r, step.g, step.b);
  const textCol = dark ? '#000' : '#fff';
  const isSolid = index === 8;
  const isText  = index === 10 || index === 11;

  // Contrast vs the mode background (step 1)
  const contrast = bgStep
    ? contrastRatio(step.r, step.g, step.b, bgStep.r, bgStep.g, bgStep.b)
    : null;
  const badge = (isText || isSolid) && contrast ? wcagBadge(contrast) : null;

  return (
    <div
      title={`Step ${index + 1} · ${STEP_LABELS[index]}\n${hex.toUpperCase()}\nR${step.r} G${step.g} B${step.b}${contrast ? `\nContrast vs BG: ${contrast.toFixed(1)}:1` : ''}`}
      style={{
        flex: 1, background: hex,
        WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        padding: '4px 3px 3px',
        outline: isSolid ? '2px solid rgba(0,0,0,0.4)' : 'none',
        outlineOffset: -2,
        position: 'relative', cursor: 'default',
        minHeight: 52,
      }}
    >
      {badge && (
        <div style={{
          position: 'absolute', top: 3, right: 3,
          background: badge.color,
          color: '#fff',
          borderRadius: 2,
          padding: '1px 3px',
          fontFamily: 'Helvetica, Arial, sans-serif',
          fontSize: 6, fontWeight: 'bold', letterSpacing: '0.03rem',
          lineHeight: 1.4,
        }}>
          {badge.label}
        </div>
      )}
      <div style={{
        fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 7,
        fontWeight: 'bold', letterSpacing: '0.03rem', textTransform: 'uppercase',
        color: textCol, opacity: 0.7, lineHeight: 1.3,
      }}>
        {index + 1}
        {contrast && (isText || isSolid) && (
          <span style={{ display: 'block', fontSize: 6, opacity: 0.8 }}>
            {contrast.toFixed(1)}:1
          </span>
        )}
      </div>
    </div>
  );
}

export default function RadixPaletteStrip({ r, g, b }) {
  const palette = useMemo(() => generateRadixPalette(r, g, b), [r, g, b]);

  const labelStyle = {
    fontFamily: 'Helvetica, Arial, sans-serif',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: '0.05rem',
    textTransform: 'uppercase',
    color: 'var(--color-fg)',
    opacity: 0.4,
    marginBottom: 4,
    marginTop: 10,
  };

  return (
    <div style={{ padding: '0 0 4px' }}>
      {/* Step labels row */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 2 }}>
        <div style={{ width: 48, flexShrink: 0 }} />
        {STEP_LABELS.map((label, i) => (
          <div key={i} style={{
            flex: 1,
            fontFamily: 'Helvetica, Arial, sans-serif',
            fontSize: 6.5,
            fontWeight: 'bold',
            letterSpacing: '0.02rem',
            textTransform: 'uppercase',
            color: 'var(--color-fg)',
            opacity: 0.35,
            textAlign: 'center',
            lineHeight: 1.2,
          }}>
            {label}
          </div>
        ))}
      </div>

      {/* Light mode row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 2 }}>
        <div style={{
          width: 48,
          flexShrink: 0,
          fontFamily: 'Helvetica, Arial, sans-serif',
          fontSize: 8,
          fontWeight: 'bold',
          letterSpacing: '0.04rem',
          textTransform: 'uppercase',
          color: 'var(--color-fg)',
          opacity: 0.4,
        }}>
          Light
        </div>
        {palette.light.map((step, i) => (
          <PaletteStep key={i} step={step} index={i} mode="light" bgStep={palette.light[0]} />
        ))}
      </div>

      {/* Dark mode row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <div style={{
          width: 48,
          flexShrink: 0,
          fontFamily: 'Helvetica, Arial, sans-serif',
          fontSize: 8,
          fontWeight: 'bold',
          letterSpacing: '0.04rem',
          textTransform: 'uppercase',
          color: 'var(--color-fg)',
          opacity: 0.4,
        }}>
          Dark
        </div>
        {palette.dark.map((step, i) => (
          <PaletteStep key={i} step={step} index={i} mode="dark" bgStep={palette.dark[0]} />
        ))}
      </div>
    </div>
  );
}
