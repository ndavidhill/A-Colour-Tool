'use client';
import React, { useMemo, useState } from 'react';
import { generateRadixPalette, generateAlphaScale, STEP_LABELS } from '../radixPalette';
import { rgbToHex, useDarkText } from '../colourMath';
import { apcaContrast, apcaLevel } from '../apca';
import { downloadFigmaVariables } from '../export';

const MONO = {
  fontFamily: 'Helvetica, Arial, sans-serif',
  fontWeight: 'bold',
  letterSpacing: '0.03rem',
  textTransform: 'uppercase',
};

const STEP_USAGE = [
  'Page / canvas background',
  'Sidebar, card, panel background',
  'UI component resting state',
  'UI component hover state',
  'UI component active / selected',
  'Subtle separator / divider',
  'Component border',
  'Focus ring / input highlight',
  'Primary solid fill — buttons, badges',
  'Primary solid hover state',
  'Secondary text, placeholders',
  'Primary text on tinted backgrounds',
];

// ─── Contrast helpers ─────────────────────────────────────────────────────────

function luminance(r, g, b) {
  return [r, g, b].reduce((acc, v, i) => {
    const c = v / 255;
    return acc + (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
      * [0.2126, 0.7152, 0.0722][i];
  }, 0);
}

function wcagRatio(r1, g1, b1, r2, g2, b2) {
  const l1 = luminance(r1, g1, b1), l2 = luminance(r2, g2, b2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function wcagBadge(ratio) {
  if (ratio >= 7)   return { label: 'AAA',  bg: '#166534' };
  if (ratio >= 4.5) return { label: 'AA',   bg: '#166534' };
  if (ratio >= 3)   return { label: 'AA·L', bg: '#92400e' };
  return               { label: '✗',     bg: '#991b1b' };
}

// ─── CSS var name from colour label ──────────────────────────────────────────

function toCSSVar(label) {
  return '--' + (label || 'colour')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ─── Inner tab bar ────────────────────────────────────────────────────────────

const INNER_TABS = [
  { key: 'scale',         label: 'Scale'         },
  { key: 'components',    label: 'Components'    },
  { key: 'accessibility', label: 'Accessibility' },
  { key: 'export',        label: 'Export'        },
];

function InnerTabBar({ active, setActive }) {
  return (
    <div style={{ display: 'flex', gap: 2, marginBottom: 20 }}>
      {INNER_TABS.map(t => (
        <button key={t.key} onClick={() => setActive(t.key)} style={{
          padding: '5px 14px',
          background: active === t.key ? 'var(--color-fg)' : 'var(--color-accent)',
          color: active === t.key ? 'var(--color-bg)' : 'var(--color-fg)',
          border: 'none', borderRadius: 4, cursor: 'pointer',
          ...MONO, fontSize: 9,
        }}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Scale tab ────────────────────────────────────────────────────────────────

function ScaleRow({ steps, label }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ ...MONO, fontSize: 8, opacity: 0.4, color: 'var(--color-fg)', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ display: 'flex', gap: 3 }}>
        {steps.map((step, i) => {
          const hex   = rgbToHex(step.r, step.g, step.b);
          const dark  = useDarkText(step.r, step.g, step.b);
          const tc    = dark ? '#000' : '#fff';
          const ratio = wcagRatio(step.r, step.g, step.b, steps[0].r, steps[0].g, steps[0].b);
          const badge = (i >= 8) ? wcagBadge(ratio) : null;
          return (
            <div key={i} style={{
              flex: 1, background: hex, borderRadius: 4, padding: 8,
              minHeight: 80, display: 'flex', flexDirection: 'column',
              justifyContent: 'flex-end', position: 'relative',
              WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
              outline: i === 8 ? '2px solid var(--color-fg)' : 'none',
              outlineOffset: i === 8 ? 2 : 0,
            }}>
              {badge && (
                <div style={{
                  position: 'absolute', top: 4, right: 4,
                  background: badge.bg, color: '#fff',
                  borderRadius: 2, padding: '1px 4px',
                  ...MONO, fontSize: 6,
                }}>{badge.label}</div>
              )}
              <div style={{ ...MONO, fontSize: 7, color: tc, opacity: 0.7, lineHeight: 1.4 }}>
                {i + 1}
              </div>
              <div style={{ ...MONO, fontSize: 6, color: tc, opacity: 0.45, marginTop: 1 }}>
                {hex.toUpperCase()}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 3, marginTop: 5 }}>
        {STEP_LABELS.map((lbl, i) => (
          <div key={i} style={{
            flex: 1, textAlign: 'center',
            ...MONO, fontSize: 6, opacity: 0.3, color: 'var(--color-fg)', lineHeight: 1.3,
          }}>{lbl}</div>
        ))}
      </div>
    </div>
  );
}

function AlphaRow({ alphaSteps, r, g, b }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ ...MONO, fontSize: 8, opacity: 0.4, color: 'var(--color-fg)', marginBottom: 6 }}>
        Alpha — source hue on white
      </div>
      <div style={{ display: 'flex', gap: 3 }}>
        {alphaSteps.map((s, i) => (
          <div key={i} style={{ flex: 1 }}>
            <div style={{
              height: 60, borderRadius: 4,
              background: `rgba(${r}, ${g}, ${b}, ${s.alpha})`,
              WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
            }} />
            <div style={{ ...MONO, fontSize: 6, color: 'var(--color-fg)', opacity: 0.3, textAlign: 'center', marginTop: 3 }}>
              {Math.round(s.alpha * 100)}%
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 3, marginTop: 3 }}>
        {STEP_LABELS.map((lbl, i) => (
          <div key={i} style={{
            flex: 1, textAlign: 'center',
            ...MONO, fontSize: 6, opacity: 0.25, color: 'var(--color-fg)',
          }}>{lbl}</div>
        ))}
      </div>
    </div>
  );
}

function SemanticTable({ steps, mode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ ...MONO, fontSize: 8, opacity: 0.4, color: 'var(--color-fg)', marginBottom: 8 }}>
        Semantic detail — {mode} mode
      </div>
      {steps.map((step, i) => {
        const hex   = rgbToHex(step.r, step.g, step.b);
        const ratio = wcagRatio(step.r, step.g, step.b, steps[0].r, steps[0].g, steps[0].b);
        const badge = wcagBadge(ratio);
        const lc    = Math.abs(apcaContrast(step.r, step.g, step.b, steps[0].r, steps[0].g, steps[0].b));
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '5px 0', borderBottom: '1px solid var(--color-accent)',
          }}>
            <div style={{
              width: 26, height: 26, borderRadius: 3, flexShrink: 0,
              background: hex, WebkitPrintColorAdjust: 'exact',
              outline: i === 8 ? '2px solid var(--color-fg)' : '1px solid var(--color-accent)',
              outlineOffset: i === 8 ? 1 : 0,
            }} />
            <div style={{ width: 14, flexShrink: 0, ...MONO, fontSize: 9, color: 'var(--color-fg)', opacity: 0.4 }}>{i + 1}</div>
            <div style={{ width: 72, flexShrink: 0, ...MONO, fontSize: 9, color: 'var(--color-fg)' }}>{STEP_LABELS[i]}</div>
            <div style={{ flex: 1, fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 9, color: 'var(--color-fg)', opacity: 0.4, lineHeight: 1.4, fontWeight: 'normal', textTransform: 'none', letterSpacing: 0 }}>
              {STEP_USAGE[i]}
            </div>
            <div style={{ width: 66, flexShrink: 0, ...MONO, fontSize: 9, color: 'var(--color-fg)', opacity: 0.55 }}>
              {hex.toUpperCase()}
            </div>
            <div style={{ width: 38, flexShrink: 0, ...MONO, fontSize: 8, color: 'var(--color-fg)', opacity: 0.45, textAlign: 'right' }}>
              {ratio.toFixed(1)}:1
            </div>
            <div style={{ width: 30, flexShrink: 0, borderRadius: 2, padding: '1px 4px', background: badge.bg, color: '#fff', ...MONO, fontSize: 7, textAlign: 'center' }}>
              {badge.label}
            </div>
            <div style={{ width: 38, flexShrink: 0, ...MONO, fontSize: 8, color: 'var(--color-fg)', opacity: 0.4, textAlign: 'right' }}>
              Lc {Math.round(lc)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ScalePanel({ palette, alphaSteps, r, g, b }) {
  const [detail, setDetail] = useState(false);
  return (
    <div>
      <ScaleRow steps={palette.light} label="Light mode — 12-step scale" />
      <ScaleRow steps={palette.dark}  label="Dark mode — 12-step scale"  />
      <AlphaRow alphaSteps={alphaSteps} r={r} g={g} b={b} />

      <button onClick={() => setDetail(v => !v)} style={{
        marginTop: 4, padding: '4px 12px',
        background: 'var(--color-accent)', color: 'var(--color-fg)',
        border: 'none', borderRadius: 4, cursor: 'pointer',
        ...MONO, fontSize: 9,
      }}>
        {detail ? 'Hide detail table' : 'Show semantic detail'}
      </button>

      {detail && (
        <>
          <div style={{ marginTop: 16 }} />
          <SemanticTable steps={palette.light} mode="light" />
          <SemanticTable steps={palette.dark}  mode="dark"  />
        </>
      )}
    </div>
  );
}

// ─── Components tab ───────────────────────────────────────────────────────────

function ComponentPreview({ steps, isDark }) {
  const h = i => rgbToHex(steps[i].r, steps[i].g, steps[i].b);
  const solidDark = useDarkText(steps[8].r, steps[8].g, steps[8].b);
  const solidText = solidDark ? '#000' : '#fff';

  return (
    <div style={{
      background: h(0), borderRadius: 6, padding: 16, flex: 1,
      WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
    }}>
      <div style={{ ...MONO, fontSize: 8, color: h(10), opacity: 0.6, marginBottom: 12 }}>
        {isDark ? 'Dark mode' : 'Light mode'}
      </div>

      {/* Card */}
      <div style={{ background: h(1), border: `1px solid ${h(5)}`, borderRadius: 6, padding: 14, marginBottom: 10 }}>
        <div style={{ ...MONO, fontSize: 11, color: h(11), marginBottom: 4 }}>Card title</div>
        <div style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 11, color: h(10), lineHeight: 1.6, marginBottom: 12, fontWeight: 'normal' }}>
          Body text at reading size demonstrates legibility on the card background.
        </div>

        {/* Badges */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ background: h(8), color: solidText, borderRadius: 4, padding: '2px 8px', ...MONO, fontSize: 8 }}>Primary</div>
          <div style={{ background: h(2), color: h(10), borderRadius: 4, padding: '2px 8px', ...MONO, fontSize: 8 }}>Default</div>
          <div style={{ background: h(3), color: h(10), border: `1px solid ${h(6)}`, borderRadius: 4, padding: '2px 8px', ...MONO, fontSize: 8 }}>Outline</div>
        </div>

        {/* Input – resting */}
        <div style={{ background: h(2), border: `1px solid ${h(6)}`, borderRadius: 4, padding: '7px 10px', marginBottom: 6 }}>
          <span style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 11, color: h(10), opacity: 0.55, fontWeight: 'normal' }}>
            Placeholder…
          </span>
        </div>

        {/* Input – focused */}
        <div style={{
          background: h(2), border: `2px solid ${h(7)}`, borderRadius: 4,
          padding: '7px 10px', marginBottom: 12,
          boxShadow: `0 0 0 3px ${`rgba(${steps[7].r},${steps[7].g},${steps[7].b},0.3)`}`,
        }}>
          <span style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 11, color: h(11), fontWeight: 'normal' }}>
            Focused input
          </span>
        </div>

        {/* Button row */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { label: 'Primary',   bg: h(8),  color: solidText,  border: 'none'              },
            { label: 'Hover',     bg: h(9),  color: solidText,  border: 'none'              },
            { label: 'Secondary', bg: h(2),  color: h(10),       border: `1px solid ${h(6)}` },
            { label: 'Disabled',  bg: h(2),  color: h(10),       border: `1px solid ${h(5)}`, opacity: 0.45 },
          ].map(btn => (
            <div key={btn.label} style={{
              background: btn.bg, color: btn.color, border: btn.border,
              borderRadius: 4, padding: '6px 14px', ...MONO, fontSize: 9,
              cursor: 'default', opacity: btn.opacity ?? 1,
            }}>
              {btn.label}
            </div>
          ))}
        </div>
      </div>

      {/* List items — resting / hover / selected */}
      {[
        { label: 'Resting item',  bg: 'transparent', border: 'none'            },
        { label: 'Hovered item',  bg: h(2),           border: 'none'            },
        { label: 'Selected item', bg: h(3),           border: `1px solid ${h(5)}` },
      ].map(item => (
        <div key={item.label} style={{
          background: item.bg, border: item.border,
          borderRadius: 4, padding: '7px 10px',
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: h(8), flexShrink: 0 }} />
          <span style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 11, color: h(11), fontWeight: 'normal' }}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function ComponentsPanel({ palette }) {
  return (
    <div>
      <div style={{ ...MONO, fontSize: 8, opacity: 0.35, color: 'var(--color-fg)', marginBottom: 10 }}>
        Components rendered using scale steps — side-by-side light / dark
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <ComponentPreview steps={palette.light} isDark={false} />
        <ComponentPreview steps={palette.dark}  isDark={true}  />
      </div>
    </div>
  );
}

// ─── Accessibility tab ────────────────────────────────────────────────────────
//
// Full contrast matrix: foreground rows = white, black, + all 12 scale steps.
// Background columns = all 12 scale steps.
// Same-colour pairs are greyed out. Cells are colour-coded by WCAG level.
// This lets designers scan the full system at once — not just text vs bg.

// Cell background colour from WCAG ratio (not a badge, the whole cell)
function cellStyle(ratio) {
  if (ratio < 1.3) return { bg: 'var(--color-accent)', label: null, textOp: 0.2 }; // trivial
  if (ratio >= 7)   return { bg: '#14532d', label: 'AAA',  textOp: 1 };
  if (ratio >= 4.5) return { bg: '#166534', label: 'AA',   textOp: 1 };
  if (ratio >= 3)   return { bg: '#78350f', label: 'AA·L', textOp: 1 };
  return                   { bg: '#450a0a', label: '✗',    textOp: 0.7 };
}

function AccessibilityPanel({ palette }) {
  const [mode, setMode] = useState('light');
  const steps = mode === 'light' ? palette.light : palette.dark;

  // Foreground rows: white, black, then all 12 scale steps
  const fgRows = [
    { label: 'White',  r: 255, g: 255, b: 255, isFixed: true },
    { label: 'Black',  r: 0,   g: 0,   b: 0,   isFixed: true },
    ...steps.map((s, i) => ({ label: `${i + 1} · ${STEP_LABELS[i]}`, r: s.r, g: s.g, b: s.b, stepIndex: i })),
  ];

  // Section dividers — which row indices start a new semantic group
  const ROW_GROUPS = {
    2:  'Scale steps as foreground →',
  };
  const COL_GROUP_LABELS = ['BG', 'BG', 'UI', 'UI', 'UI', 'Border', 'Border', 'Border', 'Solid', 'Solid', 'Text', 'Text'];

  return (
    <div>
      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 16 }}>
        {['light', 'dark'].map(m => (
          <button key={m} onClick={() => setMode(m)} style={{
            padding: '4px 12px',
            background: mode === m ? 'var(--color-fg)' : 'var(--color-accent)',
            color: mode === m ? 'var(--color-bg)' : 'var(--color-fg)',
            border: 'none', borderRadius: 4, cursor: 'pointer',
            ...MONO, fontSize: 9,
          }}>{m} mode</button>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ ...MONO, fontSize: 7, opacity: 0.35, color: 'var(--color-fg)' }}>WCAG 2.1:</span>
        {[
          { label: 'AAA  ≥7:1', bg: '#14532d' },
          { label: 'AA  ≥4.5:1', bg: '#166534' },
          { label: 'AA·L  ≥3:1 large only', bg: '#78350f' },
          { label: '✗  Fail', bg: '#450a0a' },
        ].map(l => (
          <div key={l.label} style={{
            background: l.bg, color: '#fff', borderRadius: 3,
            padding: '2px 7px', ...MONO, fontSize: 7,
          }}>{l.label}</div>
        ))}
        <span style={{ ...MONO, fontSize: 7, opacity: 0.25, color: 'var(--color-fg)', marginLeft: 4 }}>
          · Grey cells = trivially similar colours
        </span>
      </div>

      {/* Matrix */}
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 2, minWidth: 700 }}>
          <thead>
            <tr>
              {/* Row header spacer */}
              <th style={{ width: 100, minWidth: 100 }} />
              {/* Column group labels */}
              {steps.map((s, ci) => (
                <th key={ci} style={{
                  padding: '0 0 4px',
                  textAlign: 'center',
                  ...MONO, fontSize: 6,
                  color: 'var(--color-fg)', opacity: 0.25,
                  fontWeight: 'bold',
                }}>
                  {COL_GROUP_LABELS[ci]}
                </th>
              ))}
            </tr>
            <tr>
              <th style={{
                textAlign: 'left', padding: '4px 6px 8px 0',
                ...MONO, fontSize: 7, color: 'var(--color-fg)', opacity: 0.3,
              }}>
                FG \ BG →
              </th>
              {steps.map((s, ci) => {
                const hex = rgbToHex(s.r, s.g, s.b);
                return (
                  <th key={ci} style={{ padding: '0 0 8px', textAlign: 'center' }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 3, background: hex,
                      margin: '0 auto 3px',
                      WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
                      outline: ci === 8 ? '2px solid var(--color-fg)' : '1px solid var(--color-accent)',
                      outlineOffset: ci === 8 ? 1 : 0,
                    }} />
                    <div style={{ ...MONO, fontSize: 6, color: 'var(--color-fg)', opacity: 0.35 }}>
                      {ci + 1}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {fgRows.map((fg, ri) => {
              const fgHex = rgbToHex(fg.r, fg.g, fg.b);
              return (
                <React.Fragment key={ri}>
                  {ROW_GROUPS[ri] && (
                    <tr>
                      <td colSpan={steps.length + 1} style={{
                        padding: '8px 0 4px',
                        ...MONO, fontSize: 7, color: 'var(--color-fg)', opacity: 0.25,
                      }}>
                        {ROW_GROUPS[ri]}
                      </td>
                    </tr>
                  )}
                  <tr key={ri}>
                    {/* Row label */}
                    <td style={{ padding: '2px 8px 2px 0', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div style={{
                          width: 14, height: 14, borderRadius: 2, flexShrink: 0,
                          background: fg.isFixed
                            ? (fg.r === 255 ? '#ffffff' : '#000000')
                            : fgHex,
                          WebkitPrintColorAdjust: 'exact',
                          outline: fg.stepIndex === 8
                            ? '2px solid var(--color-fg)'
                            : '1px solid var(--color-accent)',
                          outlineOffset: fg.stepIndex === 8 ? 1 : 0,
                        }} />
                        <span style={{ ...MONO, fontSize: 7, color: 'var(--color-fg)', opacity: 0.5, whiteSpace: 'nowrap' }}>
                          {fg.label}
                        </span>
                      </div>
                    </td>
                    {/* Cells */}
                    {steps.map((bg, ci) => {
                      const ratio = wcagRatio(fg.r, fg.g, fg.b, bg.r, bg.g, bg.b);
                      const lc    = Math.abs(apcaContrast(fg.r, fg.g, fg.b, bg.r, bg.g, bg.b));
                      const cell  = cellStyle(ratio);
                      // Highlight the step-9-column for quick scanning
                      const isSolidCol = ci === 8;
                      return (
                        <td
                          key={ci}
                          title={`${fg.label} on Step ${ci + 1}\nWCAG ${ratio.toFixed(1)}:1\nAPCA Lc ${Math.round(lc)}`}
                          style={{
                            background: cell.bg,
                            borderRadius: 3,
                            width: 38, minWidth: 38, height: 34,
                            textAlign: 'center', verticalAlign: 'middle',
                            cursor: 'default',
                            outline: isSolidCol ? '1px solid rgba(128,128,128,0.3)' : 'none',
                          }}
                        >
                          {cell.label && (
                            <div style={{
                              ...MONO, fontSize: 6, color: '#fff',
                              opacity: cell.textOp, lineHeight: 1.3,
                            }}>
                              <div>{cell.label}</div>
                              <div style={{ opacity: 0.75 }}>{ratio.toFixed(1)}</div>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ ...MONO, fontSize: 7, opacity: 0.25, color: 'var(--color-fg)', marginTop: 10 }}>
        Hover any cell for ratio + APCA Lc · Step 9 column highlighted · AA·L = passes at large text size only
      </div>
    </div>
  );
}

// ─── Export tab ───────────────────────────────────────────────────────────────

const SEMANTIC_NAMES = [
  'bg-app', 'bg-subtle',
  'ui-default', 'ui-hover', 'ui-active',
  'border-subtle', 'border-default', 'border-focus',
  'solid', 'solid-hover',
  'text-secondary', 'text-primary',
];

function ExportPanel({ entry, palette, alphaSteps, allColours }) {
  const [copied, setCopied] = useState(false);
  const varBase = toCSSVar(entry.label || `rgb-${entry.r}-${entry.g}-${entry.b}`);

  const css = useMemo(() => {
    const label = entry.label || `RGB ${entry.r} ${entry.g} ${entry.b}`;
    const lines = [`/* ${label} — Radix 12-step UI scale */`, ''];

    lines.push('/* ── Light mode ── */');
    lines.push(':root {');
    palette.light.forEach((s, i) =>
      lines.push(`  ${varBase}-${i + 1}: ${rgbToHex(s.r, s.g, s.b)};`)
    );
    lines.push('');
    alphaSteps.forEach((s, i) =>
      lines.push(`  ${varBase}-a${i + 1}: rgba(${s.r}, ${s.g}, ${s.b}, ${s.alpha});`)
    );
    lines.push(`  ${varBase}-solid: ${rgbToHex(entry.r, entry.g, entry.b)};`);
    lines.push('}', '');

    lines.push('/* ── Dark mode ── */');
    lines.push('.dark {');
    palette.dark.forEach((s, i) =>
      lines.push(`  ${varBase}-${i + 1}: ${rgbToHex(s.r, s.g, s.b)};`)
    );
    lines.push('}', '');

    lines.push('/* ── Semantic aliases ── */');
    lines.push(':root {');
    SEMANTIC_NAMES.forEach((name, i) =>
      lines.push(`  --${name}: var(${varBase}-${i + 1});`)
    );
    lines.push('}');
    return lines.join('\n');
  }, [entry, palette, alphaSteps, varBase]);

  function handleCopy() {
    navigator.clipboard?.writeText(css).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }

  function handleDownloadCSS() {
    const blob = new Blob([css], { type: 'text/css' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `${(entry.label || 'colour').replace(/\s+/g, '-').toLowerCase()}-scale.css`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      {/* CSS variables */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ ...MONO, fontSize: 9, opacity: 0.4, color: 'var(--color-fg)', marginBottom: 8 }}>
          CSS Variables
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          <button onClick={handleCopy} style={{
            padding: '5px 12px',
            background: copied ? '#16a34a' : 'var(--color-fg)',
            color: 'var(--color-bg)',
            border: 'none', borderRadius: 4, cursor: 'pointer',
            ...MONO, fontSize: 9, transition: 'background 0.2s',
          }}>
            {copied ? '✓ Copied' : 'Copy to clipboard'}
          </button>
          <button onClick={handleDownloadCSS} style={{
            padding: '5px 12px', background: 'var(--color-accent)',
            color: 'var(--color-fg)', border: 'none', borderRadius: 4, cursor: 'pointer',
            ...MONO, fontSize: 9,
          }}>
            Download .css
          </button>
        </div>
        <pre style={{
          background: 'var(--color-accent)', borderRadius: 4,
          padding: '12px 14px', fontSize: 10, lineHeight: 1.65,
          overflowX: 'auto', color: 'var(--color-fg)',
          fontFamily: 'ui-monospace, monospace', margin: 0,
          maxHeight: 320, overflowY: 'auto', scrollbarWidth: 'none',
        }}>{css}</pre>
      </div>

      {/* Figma token export */}
      <div style={{ paddingTop: 16, borderTop: '1px solid var(--color-accent)' }}>
        <div style={{ ...MONO, fontSize: 9, opacity: 0.4, color: 'var(--color-fg)', marginBottom: 4 }}>
          Figma tokens — DTCG format
        </div>
        <div style={{
          fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 10,
          opacity: 0.45, color: 'var(--color-fg)', lineHeight: 1.6, marginBottom: 10,
        }}>
          Exports two JSON files (light + dark) with semantic colour tokens and embedded component aliases. Import light.json first, then dark.json to set both modes.
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            onClick={() => downloadFigmaVariables([entry])}
            style={{
              padding: '5px 14px', background: 'var(--color-fg)',
              color: 'var(--color-bg)', border: 'none', borderRadius: 4,
              cursor: 'pointer', ...MONO, fontSize: 9,
            }}
          >
            Export this colour
          </button>
          {allColours.length > 1 && (
            <button
              onClick={() => downloadFigmaVariables(allColours)}
              style={{
                padding: '5px 14px', background: 'var(--color-accent)',
                color: 'var(--color-fg)', border: 'none', borderRadius: 4,
                cursor: 'pointer', ...MONO, fontSize: 9,
              }}
            >
              Export all {allColours.length} colours
            </button>
          )}
          <button
            onClick={() => downloadFigmaVariables(allColours, { includeHarmonies: true })}
            style={{
              padding: '5px 14px', background: 'var(--color-accent)',
              color: 'var(--color-fg)', border: 'none', borderRadius: 4,
              cursor: 'pointer', ...MONO, fontSize: 9,
            }}
          >
            Export with harmonies
          </button>
        </div>
        <div style={{ ...MONO, fontSize: 8, opacity: 0.3, color: 'var(--color-fg)', marginTop: 10 }}>
          To push directly to Figma via API, use the Export tab in the sidebar.
        </div>
      </div>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export default function UIScaleView({ colours }) {
  const [sourceIndex, setSourceIndex] = useState(0);
  const [innerTab, setInnerTab]       = useState('scale');

  const entry = colours[Math.min(sourceIndex, colours.length - 1)] || colours[0];

  const palette    = useMemo(
    () => entry ? generateRadixPalette(entry.r, entry.g, entry.b) : null,
    [entry?.r, entry?.g, entry?.b]
  );
  const alphaSteps = useMemo(
    () => entry ? generateAlphaScale(entry.r, entry.g, entry.b) : null,
    [entry?.r, entry?.g, entry?.b]
  );

  if (!colours.length) {
    return (
      <div style={{ padding: 20, ...MONO, fontSize: 12, opacity: 0.3, color: 'var(--color-fg)' }}>
        Add colours to the queue to explore UI scales.
      </div>
    );
  }

  return (
    <div>
      {/* Source colour picker */}
      {colours.length > 1 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 16 }}>
          {colours.map((c, i) => {
            const hex  = rgbToHex(c.r, c.g, c.b);
            const dark = useDarkText(c.r, c.g, c.b);
            const active = i === sourceIndex;
            return (
              <button key={i} onClick={() => { setSourceIndex(i); setInnerTab('scale'); }} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 8px', borderRadius: 4, border: 'none', cursor: 'pointer',
                background: active ? hex : 'var(--color-accent)',
                outline: active ? '2px solid var(--color-fg)' : 'none',
                outlineOffset: 2,
                ...MONO, fontSize: 9,
                color: active ? (dark ? '#000' : '#fff') : 'var(--color-fg)',
                WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
              }}>
                {!active && (
                  <div style={{
                    width: 8, height: 8, borderRadius: 2, background: hex, flexShrink: 0,
                    outline: '1px solid rgba(0,0,0,0.15)',
                  }} />
                )}
                {c.label || `RGB ${c.r} ${c.g} ${c.b}`}
              </button>
            );
          })}
        </div>
      )}

      <InnerTabBar active={innerTab} setActive={setInnerTab} />

      {palette && innerTab === 'scale'         && <ScalePanel        palette={palette} alphaSteps={alphaSteps} r={entry.r} g={entry.g} b={entry.b} />}
      {palette && innerTab === 'components'    && <ComponentsPanel   palette={palette} />}
      {palette && innerTab === 'accessibility' && <AccessibilityPanel palette={palette} />}
      {palette && innerTab === 'export'        && <ExportPanel       entry={entry} palette={palette} alphaSteps={alphaSteps} allColours={colours} />}
    </div>
  );
}
