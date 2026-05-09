'use client';
import { rgbToHex, useDarkText, isOutOfGamut } from '../colourMath';

export default function Swatch({ sw, isNearest, isSelected, onClick }) {
  const hex  = rgbToHex(sw.r, sw.g, sw.b);
  const dark = useDarkText(sw.r, sw.g, sw.b);
  const textColor = dark ? '#000000' : '#ffffff';

  // Gamut check — memoised implicitly since sw values are stable per render
  const gamut = isOutOfGamut(sw.r, sw.g, sw.b);

  const outline = isSelected
    ? '2px solid var(--color-fg)'
    : isNearest
    ? '2px solid var(--color-fg)'
    : 'none';

  return (
    <div
      className="swatch-cell"
      onClick={onClick}
      style={{
        background: hex,
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
        borderRadius: 4,
        padding: '7px 6px 6px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        outline,
        outlineOffset: (isSelected || isNearest) ? 2 : 0,
        fontFamily: 'Helvetica, Arial, sans-serif',
        fontSize: 11,
        fontWeight: 'bold',
        lineHeight: 1.35,
        letterSpacing: '0.02rem',
        textTransform: 'uppercase',
        minHeight: 80,
        position: 'relative',
        cursor: 'pointer',
        userSelect: 'none',
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.opacity = '0.85'; }}
      onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
    >
      {/* Nearest / selected label */}
      {isNearest && (
        <div style={{
          position: 'absolute', top: -14, left: 0, right: 0,
          textAlign: 'center', fontSize: 8,
          fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold',
          letterSpacing: '0.02rem', textTransform: 'uppercase',
          color: 'var(--color-fg)',
        }}>
          {isSelected ? '★ Selected' : '★ Nearest'}
        </div>
      )}
      {isSelected && !isNearest && (
        <div style={{
          position: 'absolute', top: -14, left: 0, right: 0,
          textAlign: 'center', fontSize: 8,
          fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold',
          letterSpacing: '0.02rem', textTransform: 'uppercase',
          color: 'var(--color-fg)',
        }}>
          Selected
        </div>
      )}

      {/* Out-of-gamut warning badge */}
      {gamut.outOfGamut && (
        <div
          title={`Out of FOGRA39 gamut — press reproduction will differ by dE ${gamut.deltaE.toFixed(1)}`}
          style={{
            position: 'absolute', top: 4, right: 4,
            width: 8, height: 8, borderRadius: '50%',
            background: '#ef4444',
            border: '1px solid rgba(255,255,255,0.6)',
            flexShrink: 0,
          }}
        />
      )}

      <div style={{ color: textColor, fontSize: 8, opacity: 0.65 }}>CMYK</div>
      <div style={{ color: textColor }}>C{sw.c} M{sw.m}</div>
      <div style={{ color: textColor }}>Y{sw.y} K{sw.k}</div>
      <div style={{ color: textColor, opacity: 0.6, fontSize: 9, marginTop: 3 }}>
        {hex.toUpperCase()}
      </div>
    </div>
  );
}
