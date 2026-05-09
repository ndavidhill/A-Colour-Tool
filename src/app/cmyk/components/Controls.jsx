'use client';
import { hexToRgb, rgbToHex, clamp, rgbToCmyk, generateHarmonies } from '../colourMath';
import { downloadCSV, downloadFigmaVariables, pushToFigmaAPI } from '../export';
import Dropdown from './Dropdown';
import { Btn, RangeRow, inputStyle, labelStyle } from './Ui';
import { useState, useMemo } from 'react';

const CB_FILTERS = {
  none:         null,
  deuteranopia: `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'><filter id='cb'><feColorMatrix type='matrix' values='0.367 0.861 -0.228 0 0  0.280 0.673 0.047 0 0  -0.012 0.043 0.969 0 0  0 0 0 1 0'/></filter></svg>#cb")`,
  protanopia:   `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'><filter id='cb'><feColorMatrix type='matrix' values='0.152 1.053 -0.205 0 0  0.115 0.786 0.099 0 0  -0.004 -0.048 1.052 0 0  0 0 0 1 0'/></filter></svg>#cb")`,
  tritanopia:   `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'><filter id='cb'><feColorMatrix type='matrix' values='1.256 -0.077 -0.179 0 0  -0.078 0.931 0.148 0 0  0.005 0.691 0.304 0 0  0 0 0 1 0'/></filter></svg>#cb")`,
};

const CB_LABELS = {
  none:         'None',
  deuteranopia: 'Deuteranopia (Red-Green)',
  protanopia:   'Protanopia (Red-Green)',
  tritanopia:   'Tritanopia (Blue-Yellow)',
};

function HarmonyRow({ group, onAdd }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{
        fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 9,
        fontWeight: 'bold', letterSpacing: '0.04rem', textTransform: 'uppercase',
        color: 'var(--color-fg)', opacity: 0.4, marginBottom: 4,
      }}>
        {group.label}
      </div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {group.colours.map((c, i) => {
          const hex  = rgbToHex(c.r, c.g, c.b);
          const cmyk = rgbToCmyk(c.r, c.g, c.b);
          return (
            <div key={i} style={{ flex: 1 }}>
              <div style={{
                height: 28, borderRadius: 4,
                background: hex,
                WebkitPrintColorAdjust: 'exact',
                marginBottom: 3,
                outline: '1px solid var(--color-accent)',
              }} />
              <div style={{
                fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 8,
                fontWeight: 'bold', letterSpacing: '0.02rem', textTransform: 'uppercase',
                color: 'var(--color-fg)', opacity: 0.5, lineHeight: 1.4,
              }}>
                C{cmyk.c} M{cmyk.m}<br />Y{cmyk.y} K{cmyk.k}
              </div>
              <Btn
                onClick={() => onAdd(c.r, c.g, c.b, group.label + ' ' + (i + 1))}
                style={{ margin: '3px 0 0', padding: '2px 6px', fontSize: 9, display: 'block', width: '100%' }}
              >
                + Add
              </Btn>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Palette Manager ──────────────────────────────────────────────────────────
function PaletteManager({ palettes, onSave, onLoad, onDelete }) {
  const [name, setName] = useState('');
  const paletteNames = Object.keys(palettes).sort((a, b) =>
    (palettes[b].created || 0) - (palettes[a].created || 0)
  );

  function handleSave() {
    if (!name.trim()) return;
    onSave(name.trim());
    setName('');
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          placeholder="Palette name"
          style={{ ...inputStyle, marginTop: 0, flex: 1 }}
        />
        <Btn onClick={handleSave} style={{ margin: 0, flexShrink: 0 }}>Save</Btn>
      </div>

      {paletteNames.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {paletteNames.map(n => (
            <div key={n} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              margin: '3px 0', padding: '3px 0',
              borderBottom: '1px solid var(--color-accent)',
            }}>
              <div style={{
                display: 'flex', gap: 2, flexShrink: 0,
              }}>
                {(palettes[n].colours || []).slice(0, 5).map((c, i) => (
                  <div key={i} style={{
                    width: 8, height: 8, borderRadius: 2,
                    background: rgbToHex(c.r, c.g, c.b),
                    outline: '1px solid var(--color-accent)',
                  }} />
                ))}
              </div>
              <span style={{
                flex: 1, fontSize: 10, overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                fontFamily: 'Helvetica, Arial, sans-serif',
                letterSpacing: '0.02rem', textTransform: 'uppercase',
              }}>
                {n}
              </span>
              <Btn onClick={() => onLoad(n)} style={{ margin: 0, padding: '2px 6px', fontSize: 9 }}>Load</Btn>
              <Btn onClick={() => onDelete(n)} style={{ margin: 0, padding: '2px 6px', fontSize: 9, opacity: 0.5 }}>×</Btn>
            </div>
          ))}
        </div>
      )}

      {paletteNames.length === 0 && (
        <div style={{ fontSize: 9, opacity: 0.35, marginTop: 6, fontFamily: 'Helvetica, Arial, sans-serif' }}>
          No saved palettes yet. Save the current queue by name.
        </div>
      )}
    </div>
  );
}

// ─── Figma API Push panel ─────────────────────────────────────────────────────
function FigmaAPIPush({ colours }) {
  const [token, setToken]     = useState('');
  const [fileKey, setFileKey] = useState('');
  const [status, setStatus]   = useState('idle'); // idle | pushing | ok | error
  const [errMsg, setErrMsg]   = useState('');

  async function handlePush() {
    if (!token.trim() || !fileKey.trim()) {
      setErrMsg('Enter both a Figma access token and file key.');
      return;
    }
    setStatus('pushing');
    setErrMsg('');
    try {
      await pushToFigmaAPI(colours, token.trim(), fileKey.trim());
      setStatus('ok');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (e) {
      setErrMsg(e.message || 'Push failed');
      setStatus('error');
    }
  }

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--color-accent)' }}>
      <div style={{ fontSize: 9, fontWeight: 'bold', letterSpacing: '0.05rem', opacity: 0.4, marginBottom: 6, fontFamily: 'Helvetica, Arial, sans-serif', textTransform: 'uppercase' }}>
        Push to Figma Variables API
      </div>
      <div style={{ fontSize: 9, opacity: 0.35, lineHeight: 1.5, marginBottom: 6, fontFamily: 'Helvetica, Arial, sans-serif' }}>
        Requires a Figma Personal Access Token with Write scope and a file key (from the file URL).
      </div>
      <label style={labelStyle}>Figma Token</label>
      <input
        type="password"
        value={token}
        onChange={e => setToken(e.target.value)}
        placeholder="figd_…"
        style={inputStyle}
      />
      <label style={labelStyle}>File Key</label>
      <input
        type="text"
        value={fileKey}
        onChange={e => setFileKey(e.target.value)}
        placeholder="e.g. aBcDeFgHiJ…"
        style={inputStyle}
      />
      <Btn onClick={handlePush} red={status === 'error'}>
        {status === 'pushing' ? 'Pushing…' : status === 'ok' ? '✓ Pushed' : status === 'error' ? '✗ Failed' : 'Push to Figma'}
      </Btn>
      {errMsg && (
        <div style={{ fontSize: 9, color: '#dc2626', marginTop: 4, lineHeight: 1.4, fontFamily: 'Helvetica, Arial, sans-serif' }}>
          {errMsg}
        </div>
      )}
    </div>
  );
}

// ─── Controls ─────────────────────────────────────────────────────────────────
export default function Controls({
  colours, setColours,
  step, setStep,
  spread, setSpread,
  inverted, setInverted,
  cbFilter, setCbFilter,
  palettes, onSavePalette, onLoadPalette, onDeletePalette,
  hasPrev, onSnapshot, onRestorePrev,
  tacLimit, setTacLimit,
  gamutThreshold, setGamutThreshold,
  contrastMin, setContrastMin,
}) {
  const [inputMode, setInputMode] = useState('single');
  const [batchText, setBatchText] = useState('');
  const [batchResults, setBatchResults] = useState([]);
  const [singleR, setSingleR] = useState(218);
  const [singleG, setSingleG] = useState(41);
  const [singleB, setSingleB] = useState(28);
  const [singleHex, setSingleHex] = useState('#da291c');
  const [singleLabel, setSingleLabel] = useState('');
  const [exportFlash, setExportFlash] = useState(false);

  function handleRgbChange(ch, val) {
    const v = Math.max(0, Math.min(255, parseInt(val) || 0));
    const nr = ch === 'r' ? v : singleR;
    const ng = ch === 'g' ? v : singleG;
    const nb = ch === 'b' ? v : singleB;
    if (ch === 'r') setSingleR(v);
    if (ch === 'g') setSingleG(v);
    if (ch === 'b') setSingleB(v);
    setSingleHex(rgbToHex(nr, ng, nb));
  }

  function handleHexChange(val) {
    setSingleHex(val);
    const rgb = hexToRgb(val);
    if (rgb) { setSingleR(rgb.r); setSingleG(rgb.g); setSingleB(rgb.b); }
  }

  // Improved batch parser — reports per-line success/fail with reason
  function parseBatch() {
    const lines = batchText.split('\n').map((l, i) => ({ raw: l, index: i + 1 })).filter(l => l.raw.trim());
    const results = lines.map(({ raw, index }) => {
      const parts = raw.trim().split(/[,\s]+/).filter(Boolean);
      const hexPart = parts.find(p => /^#[0-9a-fA-F]{6}$/.test(p));
      if (hexPart) {
        const rgb = hexToRgb(hexPart);
        if (rgb) {
          const label = parts.filter(p => p !== hexPart).join(' ') || hexPart;
          return { ok: true, colour: { ...rgb, label }, raw, index };
        }
        return { ok: false, raw, index, reason: 'Hex value malformed' };
      }
      const nums = parts.filter(p => /^\d+$/.test(p)).map(Number);
      if (nums.length >= 3) {
        const [r, g, b] = nums;
        if (r <= 255 && g <= 255 && b <= 255) {
          const label = parts.filter(p => !/^\d+$/.test(p)).join(' ') || `RGB ${r} ${g} ${b}`;
          return { ok: true, colour: { r, g, b, label }, raw, index };
        }
        return { ok: false, raw, index, reason: `RGB values out of range (${nums.slice(0,3).join(', ')})` };
      }
      return { ok: false, raw, index, reason: 'No valid hex (#rrggbb) or RGB values found' };
    });

    setBatchResults(results);
    const parsed = results.filter(r => r.ok).map(r => r.colour);
    if (parsed.length) {
      onSnapshot();
      setColours(parsed);
    }
  }

  function handleExportCSV() {
    downloadCSV(colours, step, spread);
    setExportFlash(true);
    setTimeout(() => setExportFlash(false), 1800);
  }

  const harmonies = useMemo(
    () => generateHarmonies(singleR, singleG, singleB),
    [singleR, singleG, singleB]
  );

  const dlLinkStyle = {
    display: 'inline-block', marginTop: 2,
    fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 11,
    fontWeight: 'bold', textTransform: 'uppercase',
    letterSpacing: '0.02rem', color: 'var(--color-fg)', textDecoration: 'underline',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>

      {/* Input */}
      <Dropdown title="Input" defaultOpen>
        <div style={{ display: 'flex', marginBottom: 8 }}>
          {['Single', 'Batch'].map(m => (
            <button key={m} onClick={() => setInputMode(m.toLowerCase())} style={{
              flex: 1, padding: '5px 0',
              background: inputMode === m.toLowerCase() ? 'var(--color-fg)' : 'var(--color-bg)',
              color: inputMode === m.toLowerCase() ? 'var(--color-bg)' : 'var(--color-fg)',
              border: 'none', borderRadius: 5,
              fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 11, fontWeight: 'bold',
              textTransform: 'uppercase', letterSpacing: '0.02rem', cursor: 'pointer', margin: '0 2px',
            }}>{m}</button>
          ))}
        </div>

        {inputMode === 'single' && (<>
          <label style={labelStyle}>Hex</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="color" value={singleHex} onChange={e => handleHexChange(e.target.value)}
              style={{ width: 28, height: 24, padding: 1, border: 'none', borderRadius: 5, cursor: 'pointer', background: 'var(--color-bg)', flexShrink: 0 }}
            />
            <input type="text" value={singleHex} onChange={e => handleHexChange(e.target.value)}
              style={{ ...inputStyle, marginTop: 0, flex: 1 }}
            />
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
            {[['R', singleR, v => handleRgbChange('r', v)],
              ['G', singleG, v => handleRgbChange('g', v)],
              ['B', singleB, v => handleRgbChange('b', v)]].map(([ch, val, fn]) => (
              <div key={ch} style={{ flex: 1 }}>
                <label style={{ ...labelStyle, margin: '0 0 2px' }}>{ch}</label>
                <input type="number" min={0} max={255} value={val} onChange={e => fn(e.target.value)}
                  style={{ ...inputStyle, textAlign: 'center', padding: '3px 2px', marginTop: 0 }}
                />
              </div>
            ))}
          </div>
          <label style={labelStyle}>Label</label>
          <input type="text" placeholder="Optional label" value={singleLabel}
            onChange={e => setSingleLabel(e.target.value)} style={inputStyle}
          />
          <div>
            <Btn onClick={() => {
              onSnapshot();
              setColours(p => [...p, { r: singleR, g: singleG, b: singleB, label: singleLabel }]);
            }}>
              + Add
            </Btn>
            <Btn onClick={() => {
              onSnapshot();
              setColours([{ r: singleR, g: singleG, b: singleB, label: singleLabel }]);
            }}>
              Replace All
            </Btn>
          </div>
        </>)}

        {inputMode === 'batch' && (<>
          <label style={labelStyle}>One per line</label>
          <div style={{ fontSize: 10, opacity: 0.5, marginBottom: 6, lineHeight: 1.5 }}>
            #da291c Label<br />218 41 28 Label
          </div>
          <textarea value={batchText} onChange={e => { setBatchText(e.target.value); setBatchResults([]); }}
            placeholder={'#da291c Pantone 485\n#0085ca Process Blue'}
            rows={6}
            style={{
              width: '100%', padding: 6,
              background: 'var(--color-bg)', color: 'var(--color-fg)',
              borderRadius: 5, border: 'none', marginTop: 4, resize: 'vertical',
              fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 12, lineHeight: 1.4,
              letterSpacing: '0.02rem', textTransform: 'uppercase', fontWeight: 'bold',
            }}
          />
          {/* Per-line parse results */}
          {batchResults.length > 0 && (
            <div style={{ marginTop: 6 }}>
              {batchResults.map(r => (
                <div key={r.index} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 5,
                  padding: '2px 0', fontSize: 9,
                  fontFamily: 'Helvetica, Arial, sans-serif',
                  letterSpacing: '0.02rem', textTransform: 'uppercase', fontWeight: 'bold',
                }}>
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                    background: r.ok ? '#16a34a' : '#dc2626',
                  }} />
                  <div>
                    <span style={{ opacity: 0.5 }}>L{r.index} </span>
                    {r.ok
                      ? <span style={{ color: '#16a34a' }}>{r.colour.label}</span>
                      : <span style={{ color: '#dc2626' }}>{r.reason}</span>
                    }
                  </div>
                </div>
              ))}
            </div>
          )}
          <Btn onClick={parseBatch}>Generate</Btn>
        </>)}
      </Dropdown>

      {/* Harmony */}
      {inputMode === 'single' && (
        <Dropdown title="Harmony">
          <div style={{ fontSize: 9, opacity: 0.4, lineHeight: 1.5, marginBottom: 8, fontFamily: 'Helvetica, Arial, sans-serif' }}>
            Companions derived from current input colour via OKLCH hue rotation.
          </div>
          {harmonies.map((group, i) => (
            <HarmonyRow
              key={i}
              group={group}
              onAdd={(r, g, b, label) => {
                onSnapshot();
                setColours(p => [...p, { r, g, b, label }]);
              }}
            />
          ))}
        </Dropdown>
      )}

      {/* Brand Palettes */}
      <Dropdown title={`Palettes (${Object.keys(palettes).length})`}>
        <PaletteManager
          palettes={palettes}
          onSave={onSavePalette}
          onLoad={onLoadPalette}
          onDelete={onDeletePalette}
        />
      </Dropdown>

      {/* Grid settings */}
      <Dropdown title="Grid Settings" defaultOpen>
        <RangeRow label={`Step ±${step}%`} min={1} max={10} value={step} onChange={setStep} />
        <RangeRow
          label={`Spread ${spread} neighbour${spread > 1 ? 's' : ''}`}
          min={1} max={2} value={spread} onChange={setSpread}
        />
      </Dropdown>

      {/* Print & Accessibility Standards */}
      <Dropdown title="Standards">
        <div style={{ fontSize: 9, opacity: 0.4, lineHeight: 1.5, marginBottom: 8, fontFamily: 'Helvetica, Arial, sans-serif' }}>
          Thresholds used in the Health report. Defaults match FOGRA39 / WCAG 2.1.
        </div>
        <RangeRow
          label={`TAC limit ${tacLimit}%`}
          min={240} max={400} value={tacLimit} onChange={setTacLimit}
        />
        <div style={{ fontSize: 8, opacity: 0.35, marginBottom: 4, fontFamily: 'Helvetica, Arial, sans-serif' }}>
          FOGRA39 = 330 · GRACoL = 300 · FOGRA51 = 330
        </div>
        <RangeRow
          label={`Gamut ΔE warn >${gamutThreshold}`}
          min={1} max={10} value={gamutThreshold} onChange={v => setGamutThreshold(parseFloat(v))}
        />
        <div style={{ fontSize: 8, opacity: 0.35, marginBottom: 4, fontFamily: 'Helvetica, Arial, sans-serif' }}>
          Below this dE the press result matches screen well
        </div>
        <RangeRow
          label={`Min contrast ${contrastMin}:1`}
          min={3} max={7} value={contrastMin} onChange={v => setContrastMin(parseFloat(v))}
        />
        <div style={{ fontSize: 8, opacity: 0.35, marginBottom: 4, fontFamily: 'Helvetica, Arial, sans-serif' }}>
          WCAG AA = 4.5 · AA Large = 3 · AAA = 7
        </div>
      </Dropdown>

      {/* Export */}
      <Dropdown title="Export" defaultOpen>
        <Btn onClick={handleExportCSV} red={exportFlash}>
          {exportFlash ? '✓ Exported' : 'Export CSV → InDesign'}
        </Btn>
        <Btn onClick={() => downloadFigmaVariables(colours, { includeHarmonies: true })}>
          Export → Figma Tokens + Harmonies
        </Btn>
        <div style={{ fontSize: 9, opacity: 0.4, lineHeight: 1.6, marginBottom: 4, fontFamily: 'Helvetica, Arial, sans-serif' }}>
          Exports tokens-light.json, tokens-dark.json, tokens-components.json, tokens-harmonies.json.
        </div>
        <Btn onClick={() => window.print()}>Print / PDF</Btn>

        <FigmaAPIPush colours={colours} />

        <div style={{ marginTop: 10, borderTop: '1px solid var(--color-accent)', paddingTop: 8 }}>
          <div style={{ fontSize: 9, fontWeight: 'bold', letterSpacing: '0.05rem', opacity: 0.4, marginBottom: 6, fontFamily: 'Helvetica, Arial, sans-serif', textTransform: 'uppercase' }}>
            Scripts
          </div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, opacity: 0.5, lineHeight: 1.5, marginBottom: 4, fontFamily: 'Helvetica, Arial, sans-serif' }}>
              InDesign — build a FOGRA39 swatch sheet from your exported CSV.
            </div>
            <a href="/CMYK_Fogra39_Swatches.jsx" download style={dlLinkStyle}>
              ↓ CMYK_Fogra39_Swatches.jsx
            </a>
          </div>
          <div>
            <div style={{ fontSize: 10, opacity: 0.5, lineHeight: 1.5, marginBottom: 4, fontFamily: 'Helvetica, Arial, sans-serif' }}>
              Illustrator — matches CSV swatch values to rectangles by position and applies exact CMYK fills.
            </div>
            <a href="/CMYK_CSV_Recolour.jsx" download style={dlLinkStyle}>
              ↓ CMYK_CSV_Recolour.jsx
            </a>
          </div>
        </div>
      </Dropdown>

      {/* Display */}
      <Dropdown title="Display">
        <Btn onClick={() => setInverted(v => !v)}>
          {inverted ? 'Light Mode' : 'Invert Colour'}
        </Btn>
        <div style={{ ...labelStyle, marginTop: 10 }}>Colour Blindness Sim</div>
        {Object.keys(CB_LABELS).map(key => (
          <button
            key={key}
            onClick={() => setCbFilter(key)}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '5px 8px', marginBottom: 3, borderRadius: 4,
              border: 'none', cursor: 'pointer',
              background: cbFilter === key ? 'var(--color-fg)' : 'var(--color-accent)',
              color: cbFilter === key ? 'var(--color-bg)' : 'var(--color-fg)',
              fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 10,
              fontWeight: 'bold', letterSpacing: '0.02rem', textTransform: 'uppercase',
            }}
          >
            {cbFilter === key ? '✓ ' : ''}{CB_LABELS[key]}
          </button>
        ))}
      </Dropdown>

      {/* Queue */}
      <Dropdown title={`Queue (${colours.length})`} defaultOpen>
        {colours.length === 0 && (
          <div style={{ fontSize: 10, opacity: 0.4 }}>No colours added.</div>
        )}
        {colours.map((c, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, margin: '3px 0' }}>
            <div style={{
              width: 14, height: 14, borderRadius: 3, flexShrink: 0,
              background: rgbToHex(c.r, c.g, c.b),
              outline: '1px solid var(--color-accent)',
            }} />
            <span style={{
              flex: 1, fontSize: 10,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              fontFamily: 'Helvetica, Arial, sans-serif',
              letterSpacing: '0.02rem', textTransform: 'uppercase',
            }}>
              {c.label || `RGB ${c.r} ${c.g} ${c.b}`}
            </span>
            <Btn onClick={() => setColours(p => p.filter((_, j) => j !== i))}
              style={{ margin: 0, padding: '3px 7px', fontSize: 10 }}>
              ×
            </Btn>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
          {colours.length > 1 && (
            <Btn
              onClick={() => {
                onSnapshot();
                setColours([]);
                try { localStorage.removeItem('cmyk-grid-session'); } catch(e) {}
              }}
              style={{ fontSize: 9, padding: '3px 7px', opacity: 0.6 }}
            >
              Clear All
            </Btn>
          )}
          {hasPrev && (
            <Btn
              onClick={onRestorePrev}
              style={{ fontSize: 9, padding: '3px 7px', opacity: 0.6 }}
            >
              ↩ Restore Previous
            </Btn>
          )}
        </div>
      </Dropdown>

      {/* Footer */}
      <div style={{
        marginTop: 'auto', paddingTop: 10, fontSize: 10, opacity: 0.4, lineHeight: 1.5,
        fontFamily: 'Helvetica, Arial, sans-serif', letterSpacing: '0.02rem', textTransform: 'uppercase',
      }}>
        CMYK Grid Tester · Step ±{step}% · {new Date().toLocaleDateString('en-GB')}
      </div>
    </div>
  );
}
