'use client';
import { hexToRgb, rgbToHex, rgbToCmyk, generateHarmonies } from '../colourMath';
import { downloadCSV, downloadFigmaVariables, pushToFigmaAPI } from '../export';
import { Btn, RangeRow, inputStyle, labelStyle } from './Ui';
import { useState, useMemo, useRef } from 'react';

const CB_LABELS = {
  none:         'None',
  deuteranopia: 'Deuteranopia (Red-Green)',
  protanopia:   'Protanopia (Red-Green)',
  tritanopia:   'Tritanopia (Blue-Yellow)',
};

// ─── Tab bar ──────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'input',    label: 'Input' },
  { key: 'queue',    label: 'Queue' },
  { key: 'harmony',  label: 'Harmony' },
  { key: 'export',   label: 'Export' },
  { key: 'settings', label: 'Settings' },
];

function TabBar({ active, setActive, queueCount, paletteCount }) {
  return (
    <div style={{
      display: 'flex', borderBottom: '1px solid var(--color-accent)',
      marginBottom: 0, flexShrink: 0,
    }}>
      {TABS.map(t => (
        <button
          key={t.key}
          onClick={() => setActive(t.key)}
          style={{
            flex: 1, padding: '8px 0',
            background: 'none', border: 'none',
            borderBottom: active === t.key ? '2px solid var(--color-fg)' : '2px solid transparent',
            marginBottom: -1,
            cursor: 'pointer',
            fontFamily: 'Helvetica, Arial, sans-serif',
            fontSize: 9, fontWeight: 'bold',
            letterSpacing: '0.04rem', textTransform: 'uppercase',
            color: active === t.key ? 'var(--color-fg)' : 'var(--color-fg)',
            opacity: active === t.key ? 1 : 0.35,
            position: 'relative',
          }}
        >
          {t.label}
          {t.key === 'queue' && queueCount > 0 && (
            <span style={{
              position: 'absolute', top: 4, right: 4,
              background: 'var(--color-fg)', color: 'var(--color-bg)',
              borderRadius: 8, fontSize: 7, fontWeight: 'bold',
              padding: '1px 4px', lineHeight: 1.4,
            }}>{queueCount}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Palette match badge ──────────────────────────────────────────────────────
function matchedPaletteName(colours, palettes) {
  if (!colours.length) return null;
  const sig = colours.map(c => `${c.r},${c.g},${c.b}`).join('|');
  for (const [name, p] of Object.entries(palettes)) {
    if (!p.colours?.length) continue;
    const psig = p.colours.map(c => `${c.r},${c.g},${c.b}`).join('|');
    if (sig === psig) return name;
  }
  return null;
}

// ─── Draggable queue item ──────────────────────────────────────────────────────
function QueueItem({ colour, index, total, onRemove, onReorder }) {
  const dragRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      ref={dragRef}
      draggable
      onDragStart={e => {
        e.dataTransfer.setData('text/plain', String(index));
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => {
        e.preventDefault();
        setDragOver(false);
        const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (!isNaN(from) && from !== index) onReorder(from, index);
      }}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        margin: '2px 0', padding: '4px 6px', borderRadius: 4,
        background: dragOver ? 'var(--color-accent)' : 'transparent',
        outline: dragOver ? '1px solid var(--color-fg)' : 'none',
        cursor: 'grab',
        transition: 'background 0.1s',
      }}
    >
      {/* Drag handle */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 2,
        flexShrink: 0, opacity: 0.25, cursor: 'grab',
      }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ width: 10, height: 1.5, background: 'var(--color-fg)', borderRadius: 1 }} />
        ))}
      </div>
      <div style={{
        width: 12, height: 12, borderRadius: 3, flexShrink: 0,
        background: rgbToHex(colour.r, colour.g, colour.b),
        outline: '1px solid var(--color-accent)',
      }} />
      <span style={{
        flex: 1, fontSize: 10,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        fontFamily: 'Helvetica, Arial, sans-serif',
        letterSpacing: '0.02rem', textTransform: 'uppercase',
      }}>
        {colour.label || `RGB ${colour.r} ${colour.g} ${colour.b}`}
      </span>
      <button
        onClick={() => onRemove(index)}
        style={{
          flexShrink: 0, background: 'none', border: 'none',
          cursor: 'pointer', padding: '2px 5px',
          fontFamily: 'Helvetica, Arial, sans-serif',
          fontSize: 12, fontWeight: 'bold',
          color: 'var(--color-fg)', opacity: 0.35,
          lineHeight: 1,
        }}
      >×</button>
    </div>
  );
}

// ─── Palette manager ──────────────────────────────────────────────────────────
function PaletteManager({ palettes, onSave, onLoad, onDelete }) {
  const [name, setName] = useState('');
  const names = Object.keys(palettes).sort((a, b) => (palettes[b].created || 0) - (palettes[a].created || 0));

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <input
          type="text" value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && name.trim()) { onSave(name.trim()); setName(''); } }}
          placeholder="Palette name…"
          style={{ ...inputStyle, marginTop: 0, flex: 1 }}
        />
        <Btn onClick={() => { if (name.trim()) { onSave(name.trim()); setName(''); } }} style={{ margin: 0, flexShrink: 0 }}>Save</Btn>
      </div>

      {names.length > 0 ? (
        <div style={{ marginTop: 10 }}>
          {names.map(n => (
            <div key={n} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 0', borderBottom: '1px solid var(--color-accent)',
            }}>
              <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                {(palettes[n].colours || []).slice(0, 6).map((c, i) => (
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
              }}>{n}</span>
              <Btn onClick={() => onLoad(n)} style={{ margin: 0, padding: '2px 7px', fontSize: 9 }}>Load</Btn>
              <button onClick={() => onDelete(n)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 12, color: 'var(--color-fg)', opacity: 0.3,
                padding: '0 3px', lineHeight: 1, fontWeight: 'bold',
              }}>×</button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 9, opacity: 0.35, marginTop: 8, fontFamily: 'Helvetica, Arial, sans-serif' }}>
          No saved palettes. Save the current queue by name above.
        </div>
      )}
    </div>
  );
}

// ─── Figma API push ───────────────────────────────────────────────────────────
function FigmaAPIPush({ colours }) {
  const [token, setToken]   = useState('');
  const [fileKey, setFileKey] = useState('');
  const [status, setStatus] = useState('idle');
  const [errMsg, setErrMsg] = useState('');

  async function handlePush() {
    if (!token.trim() || !fileKey.trim()) { setErrMsg('Enter token and file key.'); return; }
    setStatus('pushing'); setErrMsg('');
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
    <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--color-accent)' }}>
      <div style={{ fontSize: 9, fontWeight: 'bold', letterSpacing: '0.05rem', opacity: 0.4, marginBottom: 6, fontFamily: 'Helvetica, Arial, sans-serif', textTransform: 'uppercase' }}>
        Push to Figma Variables API
      </div>
      <div style={{ fontSize: 9, opacity: 0.3, lineHeight: 1.5, marginBottom: 6, fontFamily: 'Helvetica, Arial, sans-serif' }}>
        Requires a Figma Personal Access Token (write scope) and file key from the file URL.
      </div>
      <label style={labelStyle}>Token</label>
      <input type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="figd_…" style={inputStyle} />
      <label style={labelStyle}>File key</label>
      <input type="text" value={fileKey} onChange={e => setFileKey(e.target.value)} placeholder="aBcDe…" style={inputStyle} />
      <Btn onClick={handlePush} red={status === 'error'}>
        {status === 'pushing' ? 'Pushing…' : status === 'ok' ? '✓ Pushed' : status === 'error' ? '✗ Failed' : 'Push to Figma'}
      </Btn>
      {errMsg && <div style={{ fontSize: 9, color: '#dc2626', marginTop: 4, fontFamily: 'Helvetica, Arial, sans-serif', lineHeight: 1.4 }}>{errMsg}</div>}
    </div>
  );
}

// ─── Sidebar harmony mini-preview ─────────────────────────────────────────────
function HarmonyMini({ r, g, b, harmonyAngles, onAdd, onViewHarmony }) {
  const harmonies = useMemo(
    () => generateHarmonies(r, g, b, harmonyAngles),
    [r, g, b, harmonyAngles]
  );
  return (
    <div>
      {harmonies.map((group) => (
        <div key={group.label} style={{ marginBottom: 10 }}>
          <div style={{
            fontSize: 9, fontWeight: 'bold', letterSpacing: '0.04rem',
            textTransform: 'uppercase', color: 'var(--color-fg)',
            opacity: 0.4, marginBottom: 5,
            fontFamily: 'Helvetica, Arial, sans-serif',
          }}>
            {group.label}
            <span style={{ marginLeft: 6, opacity: 0.6 }}>
              {group.angles.map(a => `${((a % 360) + 360) % 360}°`).join(' · ')}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {group.colours.map((c, i) => {
              const hex  = rgbToHex(c.r, c.g, c.b);
              const cmyk = rgbToCmyk(c.r, c.g, c.b);
              return (
                <div key={i} style={{ flex: 1 }}>
                  <div style={{
                    height: 24, borderRadius: 3, background: hex,
                    WebkitPrintColorAdjust: 'exact',
                    outline: '1px solid var(--color-accent)', marginBottom: 3,
                  }} />
                  <div style={{
                    fontSize: 7, fontWeight: 'bold', letterSpacing: '0.02rem',
                    textTransform: 'uppercase', color: 'var(--color-fg)', opacity: 0.5,
                    lineHeight: 1.4, fontFamily: 'Helvetica, Arial, sans-serif',
                  }}>
                    C{cmyk.c} M{cmyk.m}<br />Y{cmyk.y} K{cmyk.k}
                  </div>
                  <Btn
                    onClick={() => onAdd(c.r, c.g, c.b, `${group.label}${group.colours.length > 1 ? ` ${i + 1}` : ''}`)}
                    style={{ margin: '3px 0 0', padding: '2px 5px', fontSize: 8, display: 'block', width: '100%' }}
                  >
                    + Add
                  </Btn>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <Btn onClick={onViewHarmony} style={{ width: '100%', marginTop: 4, fontSize: 9 }}>
        View full grids →
      </Btn>
    </div>
  );
}

// ─── Main Controls ────────────────────────────────────────────────────────────
export default function Controls({
  colours, setColours,
  step, setStep, spread, setSpread,
  inverted, setInverted, cbFilter, setCbFilter,
  palettes, onSavePalette, onLoadPalette, onDeletePalette,
  hasPrev, onSnapshot, onRestorePrev, onReorderQueue,
  tacLimit, setTacLimit, gamutThreshold, setGamutThreshold, contrastMin, setContrastMin,
  compAngle, setCompAngle, splitAngle, setSplitAngle, analogRange, setAnalogRange,
  onHarmonyViewRequest,
}) {
  const [tab, setTab] = useState('input');
  const [inputMode, setInputMode] = useState('single');
  const [batchText, setBatchText] = useState('');
  const [batchResults, setBatchResults] = useState([]);
  const [singleR, setSingleR] = useState(218);
  const [singleG, setSingleG] = useState(41);
  const [singleB, setSingleB] = useState(28);
  const [singleHex, setSingleHex] = useState('#da291c');
  const [singleLabel, setSingleLabel] = useState('');
  const [exportFlash, setExportFlash] = useState(false);

  const harmonyAngles = { compAngle, splitAngle, analogRange };

  function handleRgbChange(ch, val) {
    const v  = Math.max(0, Math.min(255, parseInt(val) || 0));
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

  function parseBatch() {
    const lines = batchText.split('\n').map((l, i) => ({ raw: l, index: i + 1 })).filter(l => l.raw.trim());
    const results = lines.map(({ raw, index }) => {
      const parts   = raw.trim().split(/[,\s]+/).filter(Boolean);
      const hexPart = parts.find(p => /^#[0-9a-fA-F]{6}$/.test(p));
      if (hexPart) {
        const rgb = hexToRgb(hexPart);
        if (rgb) return { ok: true, colour: { ...rgb, label: parts.filter(p => p !== hexPart).join(' ') || hexPart }, raw, index };
        return { ok: false, raw, index, reason: 'Hex malformed' };
      }
      const nums = parts.filter(p => /^\d+$/.test(p)).map(Number);
      if (nums.length >= 3 && nums[0] <= 255 && nums[1] <= 255 && nums[2] <= 255) {
        const [r, g, b] = nums;
        return { ok: true, colour: { r, g, b, label: parts.filter(p => !/^\d+$/.test(p)).join(' ') || `RGB ${r} ${g} ${b}` }, raw, index };
      }
      return { ok: false, raw, index, reason: nums.length >= 3 ? `Values out of range` : 'No hex or RGB found' };
    });
    setBatchResults(results);
    const parsed = results.filter(r => r.ok).map(r => r.colour);
    if (parsed.length) { onSnapshot(); setColours(parsed); }
  }

  const matchedPalette = useMemo(() => matchedPaletteName(colours, palettes), [colours, palettes]);

  const dlLinkStyle = {
    display: 'inline-block', marginTop: 4,
    fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 10,
    fontWeight: 'bold', textTransform: 'uppercase',
    letterSpacing: '0.02rem', color: 'var(--color-fg)', textDecoration: 'underline',
  };

  const panelStyle = {
    padding: '12px 10px',
    overflowY: 'auto',
    flex: 1,
    scrollbarWidth: 'none',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TabBar active={tab} setActive={setTab} queueCount={colours.length} />

      {/* ── INPUT tab ───────────────────────────────────────────────────── */}
      {tab === 'input' && (
        <div style={panelStyle}>
          {/* Mode toggle */}
          <div style={{ display: 'flex', marginBottom: 10 }}>
            {['Single', 'Batch'].map(m => (
              <button key={m} onClick={() => setInputMode(m.toLowerCase())} style={{
                flex: 1, padding: '5px 0',
                background: inputMode === m.toLowerCase() ? 'var(--color-fg)' : 'var(--color-bg)',
                color: inputMode === m.toLowerCase() ? 'var(--color-bg)' : 'var(--color-fg)',
                border: 'none', borderRadius: 5, margin: '0 2px',
                fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 11, fontWeight: 'bold',
                textTransform: 'uppercase', letterSpacing: '0.02rem', cursor: 'pointer',
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
            <div style={{ marginTop: 6 }}>
              <Btn onClick={() => { onSnapshot(); setColours(p => [...p, { r: singleR, g: singleG, b: singleB, label: singleLabel }]); }}>+ Add</Btn>
              <Btn onClick={() => { onSnapshot(); setColours([{ r: singleR, g: singleG, b: singleB, label: singleLabel }]); }}>Replace All</Btn>
            </div>
          </>)}

          {inputMode === 'batch' && (<>
            <label style={labelStyle}>One per line</label>
            <div style={{ fontSize: 10, opacity: 0.45, marginBottom: 6, lineHeight: 1.5, fontFamily: 'Helvetica, Arial, sans-serif' }}>
              #da291c Label · 218 41 28 Label
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
            {batchResults.length > 0 && (
              <div style={{ marginTop: 6 }}>
                {batchResults.map(r => (
                  <div key={r.index} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 5,
                    padding: '2px 0', fontSize: 9,
                    fontFamily: 'Helvetica, Arial, sans-serif',
                    letterSpacing: '0.02rem', textTransform: 'uppercase', fontWeight: 'bold',
                  }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, marginTop: 1, background: r.ok ? '#16a34a' : '#dc2626' }} />
                    <div>
                      <span style={{ opacity: 0.4 }}>L{r.index} </span>
                      {r.ok
                        ? <span style={{ color: '#16a34a' }}>{r.colour.label}</span>
                        : <span style={{ color: '#dc2626' }}>{r.reason}</span>
                      }
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Btn onClick={parseBatch} style={{ marginTop: 8 }}>Generate</Btn>
          </>)}

          {/* Grid settings — kept close to input */}
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--color-accent)' }}>
            <div style={{ fontSize: 9, fontWeight: 'bold', letterSpacing: '0.05rem', opacity: 0.4, marginBottom: 8, fontFamily: 'Helvetica, Arial, sans-serif', textTransform: 'uppercase' }}>
              Grid Settings
            </div>
            <RangeRow label={`Step ±${step}%`} min={1} max={10} value={step} onChange={setStep} />
            <RangeRow label={`Spread ${spread}`} min={1} max={2} value={spread} onChange={setSpread} />
          </div>

          <div style={{ marginTop: 10, fontSize: 10, opacity: 0.3, lineHeight: 1.5, fontFamily: 'Helvetica, Arial, sans-serif', letterSpacing: '0.02rem', textTransform: 'uppercase' }}>
            {new Date().toLocaleDateString('en-GB')}
          </div>
        </div>
      )}

      {/* ── QUEUE tab ───────────────────────────────────────────────────── */}
      {tab === 'queue' && (
        <div style={panelStyle}>
          {/* Palette match badge */}
          {matchedPalette && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--color-accent)', borderRadius: 4,
              padding: '5px 8px', marginBottom: 10,
              fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 9,
              fontWeight: 'bold', letterSpacing: '0.02rem', textTransform: 'uppercase',
              color: 'var(--color-fg)',
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', flexShrink: 0 }} />
              Matches saved palette: {matchedPalette}
            </div>
          )}

          {colours.length === 0 && (
            <div style={{ fontSize: 10, opacity: 0.35, fontFamily: 'Helvetica, Arial, sans-serif' }}>No colours. Add from the Input tab.</div>
          )}

          {colours.map((c, i) => (
            <QueueItem
              key={`${c.r}-${c.g}-${c.b}-${i}`}
              colour={c} index={i} total={colours.length}
              onRemove={idx => setColours(p => p.filter((_, j) => j !== idx))}
              onReorder={onReorderQueue}
            />
          ))}

          <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
            {colours.length > 1 && (
              <Btn onClick={() => { onSnapshot(); setColours([]); try { localStorage.removeItem('cmyk-grid-session'); } catch {} }}
                style={{ fontSize: 9, padding: '3px 8px', opacity: 0.55 }}>
                Clear All
              </Btn>
            )}
            {hasPrev && (
              <Btn onClick={onRestorePrev} style={{ fontSize: 9, padding: '3px 8px', opacity: 0.55 }}>
                ↩ Restore Previous
              </Btn>
            )}
          </div>

          {/* Palette manager */}
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--color-accent)' }}>
            <div style={{ fontSize: 9, fontWeight: 'bold', letterSpacing: '0.05rem', opacity: 0.4, marginBottom: 8, fontFamily: 'Helvetica, Arial, sans-serif', textTransform: 'uppercase' }}>
              Saved Palettes
            </div>
            <PaletteManager palettes={palettes} onSave={onSavePalette} onLoad={onLoadPalette} onDelete={onDeletePalette} />
          </div>
        </div>
      )}

      {/* ── HARMONY tab ─────────────────────────────────────────────────── */}
      {tab === 'harmony' && (
        <div style={panelStyle}>
          {/* Angle controls */}
          <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--color-accent)' }}>
            <RangeRow label={`Complementary ${compAngle}°`} min={120} max={240} value={compAngle} onChange={setCompAngle} />
            <div style={{ fontSize: 8, opacity: 0.35, marginBottom: 6, fontFamily: 'Helvetica, Arial, sans-serif' }}>180° = exact opposite · 150–210° = near-complementary</div>
            <RangeRow label={`Split offset ${splitAngle}°`} min={90} max={170} value={splitAngle} onChange={setSplitAngle} />
            <RangeRow label={`Analogous ±${analogRange}°`} min={10} max={60} value={analogRange} onChange={setAnalogRange} />
            <div style={{ fontSize: 8, opacity: 0.35, marginTop: 4, fontFamily: 'Helvetica, Arial, sans-serif' }}>Tight = 10–20° tonal family · Wide = 40–60° extended palette</div>
          </div>

          {/* Mini preview for current single input */}
          <div style={{ fontSize: 9, fontWeight: 'bold', letterSpacing: '0.04rem', opacity: 0.4, marginBottom: 8, fontFamily: 'Helvetica, Arial, sans-serif', textTransform: 'uppercase' }}>
            {colours.length > 0 ? `From: ${colours[0].label || `RGB ${colours[0].r} ${colours[0].g} ${colours[0].b}`}` : 'Add a colour to see harmonies'}
          </div>

          {colours.length > 0 && (
            <HarmonyMini
              r={colours[0].r} g={colours[0].g} b={colours[0].b}
              harmonyAngles={{ compAngle, splitAngle, analogRange }}
              onAdd={(r, g, b, label) => { onSnapshot(); setColours(p => [...p, { r, g, b, label }]); }}
              onViewHarmony={onHarmonyViewRequest}
            />
          )}
        </div>
      )}

      {/* ── EXPORT tab ──────────────────────────────────────────────────── */}
      {tab === 'export' && (
        <div style={panelStyle}>
          <Btn onClick={() => { downloadCSV(colours, step, spread); setExportFlash(true); setTimeout(() => setExportFlash(false), 1800); }} red={exportFlash}>
            {exportFlash ? '✓ Exported' : 'Export CSV → InDesign'}
          </Btn>
          <Btn onClick={() => downloadFigmaVariables(colours, { includeHarmonies: true })}>
            Export → Figma Tokens + Harmonies
          </Btn>
          <div style={{ fontSize: 9, opacity: 0.35, lineHeight: 1.6, marginBottom: 4, fontFamily: 'Helvetica, Arial, sans-serif' }}>
            2 files: tokens-light.json + tokens-dark.json. Component aliases embedded inside — import light first, then dark.
          </div>
          <Btn onClick={() => window.print()}>Print / PDF</Btn>

          <FigmaAPIPush colours={colours} />

          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--color-accent)' }}>
            <div style={{ fontSize: 9, fontWeight: 'bold', letterSpacing: '0.05rem', opacity: 0.4, marginBottom: 8, fontFamily: 'Helvetica, Arial, sans-serif', textTransform: 'uppercase' }}>Scripts</div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 9, opacity: 0.45, lineHeight: 1.5, marginBottom: 4, fontFamily: 'Helvetica, Arial, sans-serif' }}>InDesign — FOGRA39 swatch sheet from CSV</div>
              <a href="/CMYK_Fogra39_Swatches.jsx" download style={dlLinkStyle}>↓ CMYK_Fogra39_Swatches.jsx</a>
            </div>
            <div>
              <div style={{ fontSize: 9, opacity: 0.45, lineHeight: 1.5, marginBottom: 4, fontFamily: 'Helvetica, Arial, sans-serif' }}>Illustrator — apply CSV CMYK values to rectangles</div>
              <a href="/CMYK_CSV_Recolour.jsx" download style={dlLinkStyle}>↓ CMYK_CSV_Recolour.jsx</a>
            </div>
          </div>
        </div>
      )}

      {/* ── SETTINGS tab ────────────────────────────────────────────────── */}
      {tab === 'settings' && (
        <div style={panelStyle}>
          {/* Print standards */}
          <div style={{ fontSize: 9, fontWeight: 'bold', letterSpacing: '0.05rem', opacity: 0.4, marginBottom: 8, fontFamily: 'Helvetica, Arial, sans-serif', textTransform: 'uppercase' }}>Print Standards</div>
          <RangeRow label={`TAC limit ${tacLimit}%`} min={240} max={400} value={tacLimit} onChange={setTacLimit} />
          <div style={{ fontSize: 8, opacity: 0.3, marginBottom: 6, fontFamily: 'Helvetica, Arial, sans-serif' }}>FOGRA39 = 330 · GRACoL = 300 · FOGRA51 = 330</div>
          <RangeRow label={`Gamut ΔE warn >${gamutThreshold}`} min={1} max={10} value={gamutThreshold} onChange={v => setGamutThreshold(parseFloat(v))} />
          <RangeRow label={`Min contrast ${contrastMin}:1`} min={3} max={7} value={contrastMin} onChange={v => setContrastMin(parseFloat(v))} />
          <div style={{ fontSize: 8, opacity: 0.3, marginBottom: 14, fontFamily: 'Helvetica, Arial, sans-serif' }}>WCAG AA = 4.5 · AA Large = 3 · AAA = 7</div>

          {/* Display */}
          <div style={{ paddingTop: 12, borderTop: '1px solid var(--color-accent)', marginBottom: 8 }}>
            <div style={{ fontSize: 9, fontWeight: 'bold', letterSpacing: '0.05rem', opacity: 0.4, marginBottom: 8, fontFamily: 'Helvetica, Arial, sans-serif', textTransform: 'uppercase' }}>Display</div>
            <Btn onClick={() => setInverted(v => !v)}>{inverted ? 'Light Mode' : 'Invert Colour'}</Btn>
          </div>

          <div style={{ paddingTop: 12, borderTop: '1px solid var(--color-accent)' }}>
            <div style={{ fontSize: 9, fontWeight: 'bold', letterSpacing: '0.05rem', opacity: 0.4, marginBottom: 8, fontFamily: 'Helvetica, Arial, sans-serif', textTransform: 'uppercase' }}>Colour Blindness Simulation</div>
            {Object.keys(CB_LABELS).map(key => (
              <button key={key} onClick={() => setCbFilter(key)} style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '5px 8px', marginBottom: 3, borderRadius: 4, border: 'none', cursor: 'pointer',
                background: cbFilter === key ? 'var(--color-fg)' : 'var(--color-accent)',
                color: cbFilter === key ? 'var(--color-bg)' : 'var(--color-fg)',
                fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 9,
                fontWeight: 'bold', letterSpacing: '0.02rem', textTransform: 'uppercase',
              }}>
                {cbFilter === key ? '✓ ' : ''}{CB_LABELS[key]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
