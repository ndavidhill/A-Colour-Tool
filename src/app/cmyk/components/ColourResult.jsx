'use client';
import { useState, useEffect } from 'react';
import { rgbToCmyk, buildGrid, rgbToHex, nearestPantones, nearestPantonesForCmyk, cmykToRgb, useDarkText } from '../colourMath';
import { nameColour } from '../colourNames';
import Swatch from './Swatch';
import RadixPaletteStrip from './RadixPaletteStrip';

function useColourData(r, g, b) {
  const [data, setData] = useState(null);
  useEffect(() => {
    const id = setTimeout(() => {
      const baseCmyk    = rgbToCmyk(r, g, b);
      const pantones    = nearestPantones(r, g, b, 2);
      const colourName  = nameColour(r, g, b);
      setData({ baseCmyk, pantones, colourName });
    }, 0);
    return () => clearTimeout(id);
  }, [r, g, b]);
  return data;
}

function PantoneChip({ pantone, rank }) {
  const rgb  = cmykToRgb(pantone.c, pantone.m, pantone.y, pantone.k);
  const hex  = rgbToHex(rgb.r, rgb.g, rgb.b);
  const dark = useDarkText(rgb.r, rgb.g, rgb.b);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{
        background: hex,
        WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
        borderRadius: 3, padding: '3px 7px',
        fontFamily: 'Helvetica, Arial, sans-serif',
        fontSize: 9, fontWeight: 'bold',
        letterSpacing: '0.05rem', textTransform: 'uppercase',
        color: dark ? '#000' : '#fff',
        flexShrink: 0,
      }}>
        {rank === 1 ? '1st · ' : '2nd · '}{pantone.name}
      </div>
      <div style={{
        fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 9,
        fontWeight: 'bold', letterSpacing: '0.02rem', textTransform: 'uppercase',
        color: 'var(--color-fg)', opacity: 0.45,
      }}>
        C{pantone.c} M{pantone.m} Y{pantone.y} K{pantone.k}
        {' · '}dE {pantone.deltaE.toFixed(1)}
      </div>
    </div>
  );
}

export default function ColourResult({ entry, step, spread }) {
  const colourData  = useColourData(entry.r, entry.g, entry.b);
  const sourceHex   = rgbToHex(entry.r, entry.g, entry.b);

  // selectedSwatch: null = nothing selected, or { c, m, y, k, index }
  const [selectedSwatch, setSelectedSwatch] = useState(null);
  // Pantones for the selected swatch (computed on click)
  const [selectedPantones, setSelectedPantones] = useState(null);

  function handleSwatchClick(sw, index) {
    if (selectedSwatch && selectedSwatch.index === index) {
      // Deselect on second click
      setSelectedSwatch(null);
      setSelectedPantones(null);
    } else {
      setSelectedSwatch({ ...sw, index });
      // Compute nearest Pantones for this swatch's CMYK
      const pans = nearestPantonesForCmyk(sw.c, sw.m, sw.y, sw.k, 2);
      setSelectedPantones(pans);
    }
  }

  // Reset selection when entry changes
  useEffect(() => {
    setSelectedSwatch(null);
    setSelectedPantones(null);
  }, [entry.r, entry.g, entry.b]);

  const displayPantones = selectedPantones || (colourData ? colourData.pantones : null);

  if (!colourData) {
    return (
      <div className="colour-group" style={{
        marginBottom: 10, borderRadius: 5,
        background: 'var(--color-accent)',
        WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
        padding: 5,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 5px 8px' }}>
          <div style={{
            width: 28, height: 28, borderRadius: 4, flexShrink: 0,
            background: sourceHex, outline: '1px solid rgba(0,0,0,0.15)',
            WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
          }} />
          <div style={{
            fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 12,
            fontWeight: 'bold', letterSpacing: '0.02rem', textTransform: 'uppercase',
            color: 'var(--color-fg)',
          }}>
            {entry.label || `RGB ${entry.r} ${entry.g} ${entry.b}`}
            <span style={{ opacity: 0.35, marginLeft: 8, fontSize: 10 }}>Computing...</span>
          </div>
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 4, padding: '0 0 4px', opacity: 0.12,
        }}>
          {Array.from({ length: 25 }).map((_, i) => (
            <div key={i} style={{ borderRadius: 4, background: sourceHex, minHeight: 80 }} />
          ))}
        </div>
      </div>
    );
  }

  const { baseCmyk } = colourData;
  const grid = buildGrid(entry, baseCmyk, step, spread);

  return (
    <div className="colour-group" style={{
      marginBottom: 10, borderRadius: 5,
      background: 'var(--color-accent)',
      WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
      padding: 5,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'flex-start',
        gap: 8, marginBottom: 6, padding: '5px 5px 0',
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 4, flexShrink: 0,
          background: sourceHex,
          WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
          outline: '1px solid rgba(0,0,0,0.15)',
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <div style={{
              fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 12,
              fontWeight: 'bold', letterSpacing: '0.02rem', textTransform: 'uppercase',
              color: 'var(--color-fg)',
            }}>
              {entry.label || `RGB ${entry.r} ${entry.g} ${entry.b}`}
            </div>
            {colourData?.colourName && (
              <div style={{
                fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 10,
                fontWeight: 'bold', letterSpacing: '0.02rem', textTransform: 'uppercase',
                color: 'var(--color-fg)', opacity: 0.35,
              }}>
                {colourData.colourName.name}
              </div>
            )}
          </div>
          <div style={{
            fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 10,
            fontWeight: 'bold', letterSpacing: '0.02rem', textTransform: 'uppercase',
            color: 'var(--color-fg)', opacity: 0.5, marginTop: 1,
          }}>
            {sourceHex.toUpperCase()}
            {' · '}
            {selectedSwatch
              ? `Selected C${selectedSwatch.c} M${selectedSwatch.m} Y${selectedSwatch.y} K${selectedSwatch.k}`
              : `Nearest C${baseCmyk.c} M${baseCmyk.m} Y${baseCmyk.y} K${baseCmyk.k}`
            }
          </div>

          {/* Pantone references */}
          {displayPantones && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
              {selectedSwatch && (
                <div style={{
                  fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 8,
                  fontWeight: 'bold', letterSpacing: '0.05rem', textTransform: 'uppercase',
                  color: 'var(--color-fg)', opacity: 0.35, marginBottom: 1,
                }}>
                  Pantones for selected swatch
                </div>
              )}
              {displayPantones.map((p, i) => (
                <PantoneChip key={p.name} pantone={p} rank={i + 1} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Swatch grid */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        margin: '10px 0 4px', opacity: 0.4,
      }}>
        <div style={{
          width: 7, height: 7, borderRadius: '50%',
          background: '#ef4444', flexShrink: 0,
        }} />
        <div style={{
          fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 8,
          fontWeight: 'bold', letterSpacing: '0.03rem', textTransform: 'uppercase',
          color: 'var(--color-fg)',
        }}>
          Out of FOGRA39 gamut — press result will differ visibly
        </div>
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
        gap: 4, padding: '0 0 4px',
      }}>
        {grid.map((sw, i) => (
          <Swatch
            key={i}
            sw={sw}
            isNearest={i === 0}
            isSelected={selectedSwatch && selectedSwatch.index === i}
            onClick={() => handleSwatchClick(sw, i)}
          />
        ))}
      </div>

      {/* Radix palette strip — shows for selected swatch or base colour */}
      <div style={{
        marginTop: 12,
        paddingTop: 10,
        borderTop: '1px solid var(--color-bg)',
      }}>
        <div style={{
          fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 9,
          fontWeight: 'bold', letterSpacing: '0.05rem', textTransform: 'uppercase',
          color: 'var(--color-fg)', opacity: 0.35, marginBottom: 6,
        }}>
          {selectedSwatch
            ? `UI Scale — C${selectedSwatch.c} M${selectedSwatch.m} Y${selectedSwatch.y} K${selectedSwatch.k}`
            : 'UI Scale — Source colour'
          }
        </div>
        <RadixPaletteStrip
          r={selectedSwatch ? selectedSwatch.r : entry.r}
          g={selectedSwatch ? selectedSwatch.g : entry.g}
          b={selectedSwatch ? selectedSwatch.b : entry.b}
        />
      </div>

      {selectedSwatch && (
        <div style={{
          fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 9,
          opacity: 0.35, padding: '4px 2px 2px',
          letterSpacing: '0.02rem', textTransform: 'uppercase',
        }}>
          Click selected swatch again to deselect
        </div>
      )}
    </div>
  );
}
