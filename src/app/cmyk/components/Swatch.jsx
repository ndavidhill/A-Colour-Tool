'use client';
import { useState } from 'react';
import { rgbToHex, useDarkText, isOutOfGamut } from '../colourMath';

export default function Swatch({ sw, isNearest, isSelected, onClick }) {
  const hex  = rgbToHex(sw.r, sw.g, sw.b);
  const dark = useDarkText(sw.r, sw.g, sw.b);
  const textColor = dark ? '#000000' : '#ffffff';
  const gamut = isOutOfGamut(sw.r, sw.g, sw.b);

  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);

  function handleCopy(e) {
    e.stopPropagation();
    const text = `C${sw.c} M${sw.m} Y${sw.y} K${sw.k}`;
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  }

  const outline = isSelected
    ? '2px solid var(--color-fg)'
    : isNearest
    ? '2px solid var(--color-fg)'
    : 'none';

  return (
    <div
      className="swatch-cell"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
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
        opacity: hovered && !isSelected ? 0.85 : 1,
        transition: 'opacity 0.1s',
      }}
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
          title={`Out of FOGRA39 gamut — press result will differ by dE ${gamut.deltaE.toFixed(1)}`}
          style={{
            position: 'absolute', top: 4, right: 4,
            width: 8, height: 8, borderRadius: '50%',
            background: '#ef4444',
            border: '1px solid rgba(255,255,255,0.6)',
          }}
        />
      )}

      <div style={{ color: textColor, fontSize: 8, opacity: 0.65 }}>CMYK</div>
      <div style={{ color: textColor }}>C{sw.c} M{sw.m}</div>
      <div style={{ color: textColor }}>Y{sw.y} K{sw.k}</div>
      <div style={{ color: textColor, opacity: 0.6, fontSize: 9, marginTop: 3 }}>
        {hex.toUpperCase()}
      </div>

      {/* Copy icon — always visible at low opacity, solid on hover */}
      <button
        onClick={handleCopy}
        title={`Copy CMYK: C${sw.c} M${sw.m} Y${sw.y} K${sw.k}`}
        style={{
          position: 'absolute', bottom: 5, right: 5,
          background: copied
            ? 'rgba(34,197,94,0.9)'
            : hovered
            ? (dark ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.28)')
            : (dark ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.14)'),
          color: textColor,
          border: 'none', borderRadius: 3,
          fontFamily: 'Helvetica, Arial, sans-serif',
          fontSize: 7, fontWeight: 'bold',
          letterSpacing: '0.03rem', textTransform: 'uppercase',
          padding: '2px 4px', cursor: 'pointer',
          lineHeight: 1.4,
          opacity: copied || hovered ? 1 : 0.45,
          transition: 'opacity 0.15s, background 0.15s',
        }}
      >
        {copied ? '✓' : '⊞'}
      </button>
    </div>
  );
}
