'use client';
import { useState, useEffect } from 'react';
import { rgbToCmyk, buildGrid, rgbToHex, nearestPantones, useDarkText, isOutOfGamut } from '../colourMath';
import { nameColour } from '../colourNames';

const MAX_COMPARE = 4;

function MiniSwatch({ sw, isNearest }) {
  const hex  = rgbToHex(sw.r, sw.g, sw.b);
  const dark = useDarkText(sw.r, sw.g, sw.b);
  const tc   = dark ? '#000' : '#fff';
  const gamut = isOutOfGamut(sw.r, sw.g, sw.b);

  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);

  function handleCopy(e) {
    e.stopPropagation();
    navigator.clipboard?.writeText(`C${sw.c} M${sw.m} Y${sw.y} K${sw.k}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleCopy}
      title={`C${sw.c} M${sw.m} Y${sw.y} K${sw.k} — click to copy`}
      style={{
        background: hex,
        WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
        borderRadius: 3,
        padding: '4px 4px 3px',
        position: 'relative',
        outline: isNearest ? '2px solid rgba(0,0,0,0.5)' : 'none',
        outlineOffset: isNearest ? 2 : 0,
        cursor: 'pointer',
        opacity: hovered ? 0.85 : 1,
        transition: 'opacity 0.1s',
        minHeight: 52,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      }}
    >
      {gamut.outOfGamut && (
        <div style={{
          position: 'absolute', top: 3, right: 3,
          width: 5, height: 5, borderRadius: '50%',
          background: '#ef4444', border: '1px solid rgba(255,255,255,0.6)',
        }} />
      )}
      {copied
        ? <div style={{ color: tc, fontSize: 7, fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold', letterSpacing: '0.02rem' }}>✓</div>
        : (<>
            <div style={{ color: tc, fontSize: 7, fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold', letterSpacing: '0.02rem', lineHeight: 1.3 }}>
              C{sw.c} M{sw.m}
            </div>
            <div style={{ color: tc, fontSize: 7, fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold', letterSpacing: '0.02rem', lineHeight: 1.3 }}>
              Y{sw.y} K{sw.k}
            </div>
          </>)
      }
    </div>
  );
}

function ColourColumn({ entry, step, spread, colWidth }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    const id = setTimeout(() => {
      const baseCmyk = rgbToCmyk(entry.r, entry.g, entry.b);
      const grid     = buildGrid(entry, baseCmyk, step, spread);
      const pantones = nearestPantones(entry.r, entry.g, entry.b, 1);
      const name     = nameColour(entry.r, entry.g, entry.b);
      setData({ baseCmyk, grid, pantones, name });
    }, 0);
    return () => clearTimeout(id);
  }, [entry.r, entry.g, entry.b, step, spread]);

  const sourceHex = rgbToHex(entry.r, entry.g, entry.b);
  const dark = useDarkText(entry.r, entry.g, entry.b);

  const headerStyle = {
    fontFamily: 'Helvetica, Arial, sans-serif',
    fontSize: 9, fontWeight: 'bold',
    letterSpacing: '0.02rem', textTransform: 'uppercase',
    color: 'var(--color-fg)',
  };

  return (
    <div style={{ width: colWidth, flexShrink: 0 }}>
      {/* Colour header */}
      <div style={{
        background: sourceHex,
        WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
        borderRadius: '4px 4px 0 0',
        padding: '8px 8px 6px',
        marginBottom: 2,
      }}>
        <div style={{
          fontFamily: 'Helvetica, Arial, sans-serif',
          fontSize: 10, fontWeight: 'bold',
          letterSpacing: '0.02rem', textTransform: 'uppercase',
          color: dark ? '#000' : '#fff',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {entry.label || `RGB ${entry.r} ${entry.g} ${entry.b}`}
        </div>
        <div style={{
          fontFamily: 'Helvetica, Arial, sans-serif',
          fontSize: 8, fontWeight: 'bold',
          letterSpacing: '0.02rem', textTransform: 'uppercase',
          color: dark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.55)',
          marginTop: 2,
        }}>
          {sourceHex.toUpperCase()}
        </div>
      </div>

      {/* CMYK + Pantone metadata */}
      <div style={{
        background: 'var(--color-accent)',
        padding: '5px 6px 6px',
        marginBottom: 4,
        borderRadius: '0 0 4px 4px',
      }}>
        {data ? (<>
          <div style={{ ...headerStyle, opacity: 0.6, fontSize: 8, marginBottom: 2 }}>
            C{data.baseCmyk.c} M{data.baseCmyk.m} Y{data.baseCmyk.y} K{data.baseCmyk.k}
          </div>
          <div style={{ ...headerStyle, opacity: 0.4, fontSize: 8 }}>
            {data.pantones[0]?.name} · dE {data.pantones[0]?.deltaE.toFixed(1)}
          </div>
        </>) : (
          <div style={{ ...headerStyle, opacity: 0.25, fontSize: 8 }}>Computing…</div>
        )}
      </div>

      {/* 5×5 grid */}
      {data ? (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 2,
        }}>
          {data.grid.map((sw, i) => (
            <MiniSwatch key={i} sw={sw} isNearest={i === 0} />
          ))}
        </div>
      ) : (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 2, opacity: 0.1,
        }}>
          {Array.from({ length: 25 }).map((_, i) => (
            <div key={i} style={{ background: sourceHex, borderRadius: 3, minHeight: 52 }} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CompareView({ colours, step, spread }) {
  const visible = colours.slice(0, MAX_COMPARE);

  if (colours.length < 2) {
    return (
      <div style={{
        padding: 20, fontFamily: 'Helvetica, Arial, sans-serif',
        fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase',
        letterSpacing: '0.02rem', opacity: 0.3, color: 'var(--color-fg)',
      }}>
        Add at least 2 colours to compare grids side by side.
      </div>
    );
  }

  // Calculate column width to fill available space (max 4 columns)
  const colWidth = `calc((100% - ${(visible.length - 1) * 8}px) / ${visible.length})`;

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <div style={{
          fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 12,
          fontWeight: 'bold', letterSpacing: '0.02rem', textTransform: 'uppercase',
          color: 'var(--color-fg)', marginBottom: 4,
        }}>
          CMYK Grid Comparison
        </div>
        <div style={{
          fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 9,
          fontWeight: 'bold', letterSpacing: '0.02rem', textTransform: 'uppercase',
          color: 'var(--color-fg)', opacity: 0.4,
        }}>
          {visible.length} of {colours.length} colour{colours.length !== 1 ? 's' : ''} · Step ±{step}% · Click any swatch to copy CMYK
          {colours.length > MAX_COMPARE && ` · Showing first ${MAX_COMPARE}`}
        </div>
      </div>

      {/* Out-of-gamut legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, opacity: 0.4 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
        <div style={{
          fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 8,
          fontWeight: 'bold', letterSpacing: '0.03rem', textTransform: 'uppercase',
          color: 'var(--color-fg)',
        }}>
          Out of FOGRA39 gamut — press result will differ visibly
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        {visible.map((entry, i) => (
          <ColourColumn
            key={`${entry.r}-${entry.g}-${entry.b}-${i}`}
            entry={entry}
            step={step}
            spread={spread}
            colWidth={colWidth}
          />
        ))}
      </div>
    </div>
  );
}
