'use client';
import { useState, useMemo } from 'react';
import { generateHarmonies, rgbToHex, rgbToCmyk, useDarkText } from '../colourMath';
import ColourResult from './ColourResult';

// Small hue wheel indicator — shows source + companion positions
function HueWheel({ sourceH, angles, size = 64 }) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 4;
  const toXY = (deg) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  const src = toXY(sourceH);

  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      {/* Hue ring */}
      {Array.from({ length: 36 }).map((_, i) => {
        const a = i * 10;
        const a2 = a + 10;
        const p1 = toXY(a), p2 = toXY(a2);
        const ri = r - 5;
        const p3 = { x: cx + ri * Math.cos(((a2 - 90) * Math.PI) / 180), y: cy + ri * Math.sin(((a2 - 90) * Math.PI) / 180) };
        const p4 = { x: cx + ri * Math.cos(((a - 90) * Math.PI) / 180), y: cy + ri * Math.sin(((a - 90) * Math.PI) / 180) };
        return (
          <path
            key={i}
            d={`M${p1.x},${p1.y} A${r},${r} 0 0,1 ${p2.x},${p2.y} L${p3.x},${p3.y} A${ri},${ri} 0 0,0 ${p4.x},${p4.y} Z`}
            fill={`hsl(${a},70%,55%)`}
            opacity={0.7}
          />
        );
      })}
      {/* Companion dots */}
      {angles.map((ang, i) => {
        const absAngle = ((sourceH + ang) + 360) % 360;
        const p = toXY(absAngle);
        return <circle key={i} cx={p.x} cy={p.y} r={3} fill="#fff" stroke="rgba(0,0,0,0.4)" strokeWidth={1} />;
      })}
      {/* Source dot */}
      <circle cx={src.x} cy={src.y} r={4} fill="#000" stroke="#fff" strokeWidth={1.5} />
    </svg>
  );
}

function HarmonyGroup({ group, sourceEntry, step, spread, onAdd, harmonyAngles }) {
  const { L: _L, C: _C, H: sourceH } = useMemo(() => {
    // Approximate source hue in degrees from OKLCH — just for wheel display
    try {
      const rl = Math.pow(sourceEntry.r / 255, 2.2);
      const gl = Math.pow(sourceEntry.g / 255, 2.2);
      const bl = Math.pow(sourceEntry.b / 255, 2.2);
      const l = Math.cbrt(0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl);
      const m = Math.cbrt(0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl);
      const s = Math.cbrt(0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl);
      const a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
      const bv = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
      const H = ((Math.atan2(bv, a) * 180 / Math.PI) + 360) % 360;
      return { H };
    } catch { return { H: 0 }; }
  }, [sourceEntry.r, sourceEntry.g, sourceEntry.b]);

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Group header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
        paddingBottom: 8, borderBottom: '1px solid var(--color-accent)',
      }}>
        <HueWheel sourceH={sourceH} angles={group.angles} size={52} />
        <div>
          <div style={{
            fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 11,
            fontWeight: 'bold', letterSpacing: '0.04rem', textTransform: 'uppercase',
            color: 'var(--color-fg)',
          }}>
            {group.label}
          </div>
          <div style={{
            fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 9,
            fontWeight: 'bold', letterSpacing: '0.02rem', textTransform: 'uppercase',
            color: 'var(--color-fg)', opacity: 0.4, marginTop: 2,
          }}>
            {group.angles.map(a => `${((a % 360) + 360) % 360}°`).join(' · ')} from source
          </div>
        </div>
        {/* Companion swatches preview */}
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          {group.colours.map((c, i) => {
            const hex = rgbToHex(c.r, c.g, c.b);
            const cmyk = rgbToCmyk(c.r, c.g, c.b);
            return (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 4,
                  background: hex,
                  WebkitPrintColorAdjust: 'exact',
                  outline: '1px solid var(--color-accent)',
                  marginBottom: 3,
                }} />
                <div style={{
                  fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 7,
                  fontWeight: 'bold', letterSpacing: '0.02rem', textTransform: 'uppercase',
                  color: 'var(--color-fg)', opacity: 0.5, lineHeight: 1.3,
                }}>
                  C{cmyk.c}<br />M{cmyk.m}<br />Y{cmyk.y}<br />K{cmyk.k}
                </div>
                <button
                  onClick={() => onAdd(c.r, c.g, c.b, `${group.label}${group.colours.length > 1 ? ` ${i + 1}` : ''}`, sourceEntry.label)}
                  style={{
                    marginTop: 3, padding: '2px 6px',
                    background: 'var(--color-fg)', color: 'var(--color-bg)',
                    border: 'none', borderRadius: 3, cursor: 'pointer',
                    fontFamily: 'Helvetica, Arial, sans-serif',
                    fontSize: 8, fontWeight: 'bold',
                    letterSpacing: '0.02rem', textTransform: 'uppercase',
                  }}
                >
                  + Add
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Full CMYK grids for each companion */}
      {group.colours.map((c, i) => (
        <ColourResult
          key={i}
          entry={{
            r: c.r, g: c.g, b: c.b,
            label: `${group.label}${group.colours.length > 1 ? ` ${i + 1}` : ''} of ${sourceEntry.label || `RGB ${sourceEntry.r} ${sourceEntry.g} ${sourceEntry.b}`}`,
          }}
          step={step}
          spread={spread}
          compact
        />
      ))}
    </div>
  );
}

export default function HarmonyView({ colours, step, spread, harmonyAngles, onAddColour }) {
  const [sourceIndex, setSourceIndex] = useState(0);

  const sourceEntry = colours[Math.min(sourceIndex, colours.length - 1)] || colours[0];

  const harmonies = useMemo(
    () => sourceEntry
      ? generateHarmonies(sourceEntry.r, sourceEntry.g, sourceEntry.b, harmonyAngles)
      : [],
    [sourceEntry?.r, sourceEntry?.g, sourceEntry?.b, harmonyAngles]
  );

  if (colours.length === 0) {
    return (
      <div style={{
        padding: 20, fontFamily: 'Helvetica, Arial, sans-serif',
        fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase',
        letterSpacing: '0.02rem', opacity: 0.3, color: 'var(--color-fg)',
      }}>
        Add colours to the queue to explore harmony companions.
      </div>
    );
  }

  return (
    <div>
      {/* Header + source selector */}
      <div style={{ marginBottom: 16 }}>
        <div style={{
          fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 12,
          fontWeight: 'bold', letterSpacing: '0.02rem', textTransform: 'uppercase',
          color: 'var(--color-fg)', marginBottom: 4,
        }}>
          Colour Harmonies
        </div>
        <div style={{
          fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 9,
          fontWeight: 'bold', letterSpacing: '0.02rem', textTransform: 'uppercase',
          color: 'var(--color-fg)', opacity: 0.4, marginBottom: 10,
        }}>
          OKLCH hue rotation · full CMYK grid per companion · click + Add to queue
        </div>

        {/* Source colour picker */}
        {colours.length > 1 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
            {colours.map((c, i) => {
              const hex  = rgbToHex(c.r, c.g, c.b);
              const dark = useDarkText(c.r, c.g, c.b);
              const active = i === sourceIndex;
              return (
                <button
                  key={i}
                  onClick={() => setSourceIndex(i)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '4px 8px', borderRadius: 4, border: 'none',
                    cursor: 'pointer',
                    background: active ? hex : 'var(--color-accent)',
                    outline: active ? `2px solid var(--color-fg)` : 'none',
                    outlineOffset: 2,
                    fontFamily: 'Helvetica, Arial, sans-serif',
                    fontSize: 9, fontWeight: 'bold',
                    letterSpacing: '0.02rem', textTransform: 'uppercase',
                    color: active ? (dark ? '#000' : '#fff') : 'var(--color-fg)',
                  }}
                >
                  <div style={{
                    width: 8, height: 8, borderRadius: 2,
                    background: hex, flexShrink: 0,
                    outline: '1px solid rgba(0,0,0,0.15)',
                    display: active ? 'none' : 'block',
                  }} />
                  {c.label || `RGB ${c.r} ${c.g} ${c.b}`}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Harmony groups */}
      {harmonies.map((group, i) => (
        <HarmonyGroup
          key={group.label}
          group={group}
          sourceEntry={sourceEntry}
          step={step}
          spread={spread}
          harmonyAngles={harmonyAngles}
          onAdd={(r, g, b, label, sourceLabel) => onAddColour(r, g, b, label, sourceLabel)}
        />
      ))}
    </div>
  );
}
