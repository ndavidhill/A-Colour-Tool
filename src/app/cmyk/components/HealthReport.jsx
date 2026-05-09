'use client';
import { useState, useEffect } from 'react';
import { rgbToHex, rgbToCmyk, cmykToRgb, isOutOfGamut, nearestPantones } from '../colourMath';
import { nameColour } from '../colourNames';

function relativeLuminance(r, g, b) {
  const s = [r, g, b].map(v => {
    v = v / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
}

function contrastVsWhite(r, g, b) {
  const l = relativeLuminance(r, g, b);
  return (1.05) / (l + 0.05);
}
function contrastVsBlack(r, g, b) {
  const l = relativeLuminance(r, g, b);
  return (l + 0.05) / (0.05);
}

function StatusDot({ status }) {
  const colors = { pass: '#16a34a', warn: '#d97706', fail: '#dc2626' };
  return (
    <div style={{
      width: 8, height: 8, borderRadius: '50%',
      background: colors[status] || colors.warn,
      flexShrink: 0,
    }} />
  );
}

function ColourHealthRow({ entry }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    const id = setTimeout(() => {
      const cmyk      = rgbToCmyk(entry.r, entry.g, entry.b);
      const gamut     = isOutOfGamut(entry.r, entry.g, entry.b);
      const pantones  = nearestPantones(entry.r, entry.g, entry.b, 1);
      const colName   = nameColour(entry.r, entry.g, entry.b);
      const tac       = cmyk.c + cmyk.m + cmyk.y + cmyk.k;
      const cvw       = contrastVsWhite(entry.r, entry.g, entry.b);
      const cvb       = contrastVsBlack(entry.r, entry.g, entry.b);
      const maxContrast = Math.max(cvw, cvb);

      setData({ cmyk, gamut, pantones, colName, tac, cvw, cvb, maxContrast });
    }, 0);
    return () => clearTimeout(id);
  }, [entry.r, entry.g, entry.b]);

  const hex = rgbToHex(entry.r, entry.g, entry.b);

  // Health checks
  const checks = data ? [
    {
      label: 'FOGRA39 Gamut',
      status: data.gamut.outOfGamut ? 'fail' : 'pass',
      detail: data.gamut.outOfGamut
        ? `Out of gamut — press result will differ by dE ${data.gamut.deltaE.toFixed(1)}`
        : `In gamut — reproducible on coated offset (dE ${data.gamut.deltaE.toFixed(1)})`,
    },
    {
      label: 'Ink Coverage (TAC)',
      status: data.tac > 320 ? 'warn' : data.tac > 330 ? 'fail' : 'pass',
      detail: `${data.tac}% total ink · FOGRA39 limit 330%${data.tac > 300 ? ' — approaching limit' : ''}`,
    },
    {
      label: 'WCAG Contrast',
      status: data.maxContrast >= 4.5 ? 'pass' : data.maxContrast >= 3 ? 'warn' : 'fail',
      detail: `vs White: ${data.cvw.toFixed(1)}:1 · vs Black: ${data.cvb.toFixed(1)}:1 · Best: ${data.maxContrast.toFixed(1)}:1`,
    },
    {
      label: 'Pantone Match',
      status: data.pantones[0].deltaE < 5 ? 'pass' : data.pantones[0].deltaE < 12 ? 'warn' : 'fail',
      detail: `${data.pantones[0].name} · dE ${data.pantones[0].deltaE.toFixed(1)}${data.pantones[0].deltaE > 10 ? ' — significant departure' : ''}`,
    },
  ] : [];

  const allPass = checks.length > 0 && checks.every(c => c.status === 'pass');
  const hasFail = checks.some(c => c.status === 'fail');
  const overallStatus = hasFail ? 'fail' : allPass ? 'pass' : 'warn';
  const overallColors = { pass: '#dcfce7', warn: '#fef3c7', fail: '#fee2e2' };
  const overallBorder = { pass: '#16a34a', warn: '#d97706', fail: '#dc2626' };

  return (
    <div style={{
      marginBottom: 12,
      borderRadius: 6,
      border: `1px solid ${data ? overallBorder[overallStatus] : 'var(--color-accent)'}`,
      overflow: 'hidden',
      pageBreakInside: 'avoid', breakInside: 'avoid',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 12px',
        background: data ? overallColors[overallStatus] : 'var(--color-accent)',
        WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 4, flexShrink: 0,
          background: hex,
          WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
          outline: '1px solid rgba(0,0,0,0.1)',
        }} />
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 12,
            fontWeight: 'bold', letterSpacing: '0.02rem', textTransform: 'uppercase',
            color: '#111',
          }}>
            {entry.label || (data?.colName?.name) || `RGB ${entry.r} ${entry.g} ${entry.b}`}
            {data?.colName && entry.label && (
              <span style={{ opacity: 0.45, marginLeft: 8, fontSize: 10 }}>
                {data.colName.name}
              </span>
            )}
          </div>
          <div style={{
            fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 9,
            fontWeight: 'bold', letterSpacing: '0.02rem', textTransform: 'uppercase',
            color: '#444', marginTop: 2,
          }}>
            {hex.toUpperCase()}
            {data && ` · C${data.cmyk.c} M${data.cmyk.m} Y${data.cmyk.y} K${data.cmyk.k}`}
          </div>
        </div>
        {data && (
          <div style={{
            fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 9,
            fontWeight: 'bold', letterSpacing: '0.05rem', textTransform: 'uppercase',
            color: overallBorder[overallStatus],
          }}>
            {overallStatus === 'pass' ? '✓ Pass' : overallStatus === 'fail' ? '✗ Issues' : '⚠ Review'}
          </div>
        )}
      </div>

      {/* Checks */}
      {!data ? (
        <div style={{ padding: '8px 12px', fontSize: 10, opacity: 0.4, fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.02rem' }}>
          Analysing...
        </div>
      ) : (
        <div style={{ padding: '6px 12px 8px' }}>
          {checks.map((check, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              padding: '4px 0',
              borderBottom: i < checks.length - 1 ? '1px solid var(--color-accent)' : 'none',
            }}>
              <StatusDot status={check.status} />
              <div style={{ flex: 1 }}>
                <div style={{
                  fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 9,
                  fontWeight: 'bold', letterSpacing: '0.04rem', textTransform: 'uppercase',
                  color: 'var(--color-fg)', opacity: 0.6,
                }}>
                  {check.label}
                </div>
                <div style={{
                  fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 9,
                  fontWeight: 'bold', letterSpacing: '0.02rem',
                  color: 'var(--color-fg)', opacity: 0.45, marginTop: 1,
                }}>
                  {check.detail}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HealthReport({ colours }) {
  if (colours.length === 0) {
    return (
      <div style={{
        padding: 20, fontFamily: 'Helvetica, Arial, sans-serif',
        fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase',
        letterSpacing: '0.02rem', opacity: 0.3, color: 'var(--color-fg)',
      }}>
        Add colours to the queue to generate a health report.
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{
          fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 12,
          fontWeight: 'bold', letterSpacing: '0.02rem', textTransform: 'uppercase',
          color: 'var(--color-fg)', marginBottom: 4,
        }}>
          Brand Palette Health Report
        </div>
        <div style={{
          fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 9,
          fontWeight: 'bold', letterSpacing: '0.02rem', textTransform: 'uppercase',
          color: 'var(--color-fg)', opacity: 0.4,
        }}>
          {colours.length} colour{colours.length !== 1 ? 's' : ''} · {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} · FOGRA39 / WCAG 2.1
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
          {[
            { color: '#16a34a', label: 'Pass — no action needed' },
            { color: '#d97706', label: 'Review — check before production' },
            { color: '#dc2626', label: 'Issue — requires attention' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
              <span style={{
                fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 8,
                fontWeight: 'bold', letterSpacing: '0.03rem', textTransform: 'uppercase',
                color: 'var(--color-fg)', opacity: 0.5,
              }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {colours.map((entry, i) => (
        <ColourHealthRow key={`${entry.r}-${entry.g}-${entry.b}-${i}`} entry={entry} />
      ))}

      <div style={{
        marginTop: 16, padding: '10px 0',
        borderTop: '1px solid var(--color-accent)',
        fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 8,
        fontWeight: 'bold', letterSpacing: '0.02rem', textTransform: 'uppercase',
        color: 'var(--color-fg)', opacity: 0.3, lineHeight: 1.6,
      }}>
        Gamut check uses FOGRA39 / ISO 12647-2:2004 coated offset constraints (TAC 330%, K max 85%). 
        WCAG contrast uses relative luminance per WCAG 2.1 §1.4.3. 
        Pantone match uses DeltaE2000 in Lab D50.
      </div>
    </div>
  );
}
