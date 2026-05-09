'use client';
import { useState, useEffect } from 'react';
import { rgbToHex, useDarkText, rgbToCmyk } from '../colourMath';
import { nameColour } from '../colourNames';
import { apcaContrast, apcaLevel } from '../apca';

function relativeLuminance(r, g, b) {
  const s = [r, g, b].map(v => {
    v = v / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
}

function contrastRatio(r1, g1, b1, r2, g2, b2) {
  const l1 = relativeLuminance(r1, g1, b1);
  const l2 = relativeLuminance(r2, g2, b2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function WcagBadge({ ratio }) {
  const aaa   = ratio >= 7;
  const aa    = ratio >= 4.5;
  const large = ratio >= 3;
  const bg    = aaa ? '#166534' : aa ? '#14532d' : large ? '#713f12' : '#7f1d1d';
  const label = aaa ? 'AAA' : aa ? 'AA' : large ? 'AA Lg' : 'Fail';
  return (
    <span style={{
      fontSize: 7, fontWeight: 'bold', letterSpacing: '0.04rem',
      fontFamily: 'Helvetica, Arial, sans-serif', textTransform: 'uppercase',
      background: bg, color: '#fff',
      borderRadius: 2, padding: '1px 3px',
    }}>
      {label}
    </span>
  );
}

function ApcaBadge({ lc }) {
  const level = apcaLevel(lc);
  const bg = level.ok ? '#1e3a5f' : '#7f1d1d';
  return (
    <span style={{
      fontSize: 7, fontWeight: 'bold', letterSpacing: '0.04rem',
      fontFamily: 'Helvetica, Arial, sans-serif', textTransform: 'uppercase',
      background: bg, color: '#fff',
      borderRadius: 2, padding: '1px 3px', marginLeft: 2,
    }}>
      {level.short}
    </span>
  );
}

function MatrixCell({ fg, bg, isSelf }) {
  if (isSelf) {
    return (
      <div style={{
        background: `repeating-linear-gradient(45deg, ${rgbToHex(bg.r, bg.g, bg.b)}, ${rgbToHex(bg.r, bg.g, bg.b)} 4px, rgba(0,0,0,0.08) 4px, rgba(0,0,0,0.08) 8px)`,
        borderRadius: 4, minHeight: 74,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ width: 20, height: 2, background: 'rgba(0,0,0,0.2)', borderRadius: 1 }} />
      </div>
    );
  }

  const wcag = contrastRatio(fg.r, fg.g, fg.b, bg.r, bg.g, bg.b);
  const lc   = apcaContrast(fg.r, fg.g, fg.b, bg.r, bg.g, bg.b);
  const hex  = rgbToHex(bg.r, bg.g, bg.b);
  const textDark = useDarkText(bg.r, bg.g, bg.b);

  return (
    <div style={{
      background: hex,
      WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
      borderRadius: 4, padding: '5px 6px', minHeight: 74,
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    }}>
      <div style={{
        color: rgbToHex(fg.r, fg.g, fg.b),
        fontFamily: 'Helvetica, Arial, sans-serif',
        fontSize: 10, fontWeight: 'bold',
        letterSpacing: '0.02rem', textTransform: 'uppercase',
        lineHeight: 1.2,
        WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
      }}>
        Aa
      </div>
      <div>
        {/* WCAG 2.1 row */}
        <div style={{
          fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 7,
          fontWeight: 'bold', letterSpacing: '0.02rem',
          color: textDark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.55)',
          marginBottom: 2, display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap',
        }}>
          {wcag.toFixed(1)}:1 <WcagBadge ratio={wcag} />
        </div>
        {/* APCA row */}
        <div style={{
          fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 7,
          fontWeight: 'bold', letterSpacing: '0.02rem',
          color: textDark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.55)',
          display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap',
        }}>
          Lc {Math.abs(lc).toFixed(0)} <ApcaBadge lc={lc} />
        </div>
      </div>
    </div>
  );
}

export default function ContrastMatrix({ colours }) {
  const [names, setNames] = useState([]);

  useEffect(() => {
    const id = setTimeout(() => {
      setNames(colours.map(c => nameColour(c.r, c.g, c.b).name));
    }, 0);
    return () => clearTimeout(id);
  }, [colours]);

  if (colours.length < 2) {
    return (
      <div style={{
        padding: 20, fontFamily: 'Helvetica, Arial, sans-serif',
        fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase',
        letterSpacing: '0.02rem', opacity: 0.3, color: 'var(--color-fg)',
      }}>
        Add at least 2 colours to see the contrast matrix.
      </div>
    );
  }

  return (
    <div style={{ padding: '0 0 20px' }}>
      <div style={{
        fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 12,
        fontWeight: 'bold', letterSpacing: '0.02rem', textTransform: 'uppercase',
        color: 'var(--color-fg)', marginBottom: 4,
      }}>
        Contrast Matrix
      </div>
      <div style={{
        fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 9,
        fontWeight: 'bold', letterSpacing: '0.02rem', textTransform: 'uppercase',
        color: 'var(--color-fg)', opacity: 0.4, marginBottom: 12,
      }}>
        Row = foreground · Column = background · WCAG 2.1 ratio + APCA Lc
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'AAA ≥7:1', bg: '#166534' },
          { label: 'AA ≥4.5:1', bg: '#14532d' },
          { label: 'AA Lg ≥3:1', bg: '#713f12' },
          { label: 'Fail <3:1', bg: '#7f1d1d' },
          { label: 'APCA Fluent Lc75+', bg: '#1e3a5f' },
        ].map(({ label, bg }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: bg }} />
            <span style={{
              fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 8,
              fontWeight: 'bold', letterSpacing: '0.03rem', textTransform: 'uppercase',
              color: 'var(--color-fg)', opacity: 0.5,
            }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Column headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `120px repeat(${colours.length}, 1fr)`,
        gap: 4, marginBottom: 4,
      }}>
        <div />
        {colours.map((c, ci) => (
          <div key={ci} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <div style={{
              width: '100%', height: 14, borderRadius: 3,
              background: rgbToHex(c.r, c.g, c.b),
              WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
              outline: '1px solid var(--color-accent)',
            }} />
            <div style={{
              fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 8,
              fontWeight: 'bold', letterSpacing: '0.02rem', textTransform: 'uppercase',
              color: 'var(--color-fg)', opacity: 0.5, textAlign: 'center', lineHeight: 1.3,
            }}>
              {c.label || names[ci] || `${ci + 1}`}
            </div>
          </div>
        ))}
      </div>

      {/* Matrix rows */}
      {colours.map((fgColour, ri) => (
        <div key={ri} style={{
          display: 'grid',
          gridTemplateColumns: `120px repeat(${colours.length}, 1fr)`,
          gap: 4, marginBottom: 4,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingRight: 4 }}>
            <div style={{
              width: 12, height: 12, borderRadius: 2, flexShrink: 0,
              background: rgbToHex(fgColour.r, fgColour.g, fgColour.b),
              WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
              outline: '1px solid var(--color-accent)',
            }} />
            <div style={{
              fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 8,
              fontWeight: 'bold', letterSpacing: '0.02rem', textTransform: 'uppercase',
              color: 'var(--color-fg)', opacity: 0.6, lineHeight: 1.3,
            }}>
              {fgColour.label || names[ri] || `Colour ${ri + 1}`}
            </div>
          </div>
          {colours.map((bgColour, ci) => (
            <MatrixCell key={ci} fg={fgColour} bg={bgColour} isSelf={ri === ci} />
          ))}
        </div>
      ))}

      {/* CMYK reference table */}
      <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--color-accent)' }}>
        <div style={{
          fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 9,
          fontWeight: 'bold', letterSpacing: '0.05rem', textTransform: 'uppercase',
          color: 'var(--color-fg)', opacity: 0.4, marginBottom: 10,
        }}>
          Colour Reference
        </div>
        {colours.map((c, i) => {
          const cmyk = rgbToCmyk(c.r, c.g, c.b);
          const hex  = rgbToHex(c.r, c.g, c.b);
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 0', borderBottom: '1px solid var(--color-accent)',
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: 3, flexShrink: 0,
                background: hex,
                WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
                outline: '1px solid var(--color-accent)',
              }} />
              <div style={{ flex: 1 }}>
                <div style={{
                  fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 11,
                  fontWeight: 'bold', letterSpacing: '0.02rem', textTransform: 'uppercase',
                  color: 'var(--color-fg)',
                }}>
                  {c.label || names[i] || hex.toUpperCase()}
                </div>
                <div style={{
                  fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 9,
                  fontWeight: 'bold', letterSpacing: '0.02rem', textTransform: 'uppercase',
                  color: 'var(--color-fg)', opacity: 0.45, marginTop: 1,
                }}>
                  {hex.toUpperCase()} · C{cmyk.c} M{cmyk.m} Y{cmyk.y} K{cmyk.k}
                  {names[i] ? ` · ${names[i]}` : ''}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
