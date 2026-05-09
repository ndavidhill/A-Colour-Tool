'use client';
import { useState, useEffect } from 'react';
import Controls from './components/Controls';
import ColourResult from './components/ColourResult';
import ContrastMatrix from './components/ContrastMatrix';
import HealthReport from './components/HealthReport';
import CompareView from './components/CompareView';

const STORAGE_KEY    = 'cmyk-grid-session';
const PALETTES_KEY   = 'cmyk-grid-palettes';
const PREV_KEY       = 'cmyk-grid-previous';
const DEFAULT_COLOURS = [{ r: 218, g: 41, b: 28, label: 'Pantone 485' }];

function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.colours) || parsed.colours.length === 0) return null;
    return parsed;
  } catch (e) { return null; }
}

function saveSession(colours, step, spread, inverted) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ colours, step, spread, inverted }));
  } catch (e) {}
}

function loadPalettes() {
  try {
    const raw = localStorage.getItem(PALETTES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}

function savePalettes(palettes) {
  try { localStorage.setItem(PALETTES_KEY, JSON.stringify(palettes)); } catch (e) {}
}

function snapshotToPrev(colours, step, spread) {
  try {
    localStorage.setItem(PREV_KEY, JSON.stringify({ colours, step, spread }));
  } catch (e) {}
}

function loadPrev() {
  try {
    const raw = localStorage.getItem(PREV_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

const VIEWS = [
  { key: 'grid',     label: 'Grid' },
  { key: 'compare',  label: 'Compare' },
  { key: 'contrast', label: 'Contrast' },
  { key: 'health',   label: 'Health' },
];

export default function CMYKTester() {
  const [ready, setReady]       = useState(false);
  const [colours, setColours]   = useState(DEFAULT_COLOURS);
  const [step, setStep]         = useState(5);
  const [spread, setSpread]     = useState(1);
  const [inverted, setInverted] = useState(false);
  const [cbFilter, setCbFilter] = useState('none');
  const [view, setView]         = useState('grid');

  // Saved palettes
  const [palettes, setPalettes] = useState({});

  // Configurable print/accessibility thresholds
  const [tacLimit, setTacLimit]           = useState(330);
  const [gamutThreshold, setGamutThreshold] = useState(4.0);
  const [contrastMin, setContrastMin]     = useState(4.5);

  // Whether a previous session snapshot exists (for undo/restore)
  const [hasPrev, setHasPrev] = useState(false);

  useEffect(() => {
    const saved = loadSession();
    if (saved) {
      setColours(saved.colours);
      if (saved.step)    setStep(saved.step);
      if (saved.spread)  setSpread(saved.spread);
      if (saved.inverted !== undefined) setInverted(saved.inverted);
    }
    setPalettes(loadPalettes());
    setHasPrev(!!loadPrev());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveSession(colours, step, spread, inverted);
  }, [colours, step, spread, inverted, ready]);

  // Palette operations
  function savePalette(name) {
    if (!name.trim()) return;
    const next = { ...palettes, [name.trim()]: { colours, step, spread, created: Date.now() } };
    setPalettes(next);
    savePalettes(next);
  }

  function loadPalette(name) {
    const p = palettes[name];
    if (!p) return;
    snapshot();
    setColours(p.colours);
    if (p.step)   setStep(p.step);
    if (p.spread) setSpread(p.spread);
  }

  function deletePalette(name) {
    const next = { ...palettes };
    delete next[name];
    setPalettes(next);
    savePalettes(next);
  }

  // Snapshot before destructive operations
  function snapshot() {
    snapshotToPrev(colours, step, spread);
    setHasPrev(true);
  }

  function restorePrev() {
    const prev = loadPrev();
    if (!prev) return;
    snapshot(); // save current as new prev before restoring
    setColours(prev.colours);
    if (prev.step)   setStep(prev.step);
    if (prev.spread) setSpread(prev.spread);
  }

  const bg     = inverted ? '#000' : '#fff';
  const fg     = inverted ? '#fff' : '#000';
  const accent = inverted ? '#222' : '#e9e9e9';

  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: bg, color: fg,
      fontFamily: 'Helvetica, Arial, sans-serif',
      fontSize: 12, fontWeight: 'bold',
      textTransform: 'uppercase', letterSpacing: '0.02rem',
      '--color-bg': bg, '--color-fg': fg, '--color-accent': accent,
    }}>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        body, html { margin: 0; padding: 0; overflow: hidden; }
        input[type=range] { accent-color: ${fg}; }
        ::selection { background: ${fg}; color: ${bg}; }
        a { color: ${fg}; }
        a:hover { opacity: 0.25; text-decoration: none; }
        button:hover { opacity: 0.25; }
        @media (max-width: 800px) {
          body, html { overflow: auto; }
          .overlay-panel { position: relative !important; width: 100vw !important; height: auto !important; }
          .main-area { position: relative !important; width: calc(100vw - 20px) !important; height: auto !important; top: auto !important; right: auto !important; margin: 10px auto 0 !important; }
        }
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          @page { size: A3 landscape; margin: 12mm; }
          body, html { overflow: visible !important; background: white !important; }
          .no-print { display: none !important; }
          .print-area { position: static !important; width: 100% !important; height: auto !important; overflow: visible !important; }
          .print-header { display: flex !important; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #000; padding-bottom: 4mm; margin-bottom: 6mm; }
          .colour-group { break-inside: avoid; page-break-inside: avoid; }
          .swatch-cell { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      {/* Sidebar */}
      <div className="overlay-panel no-print" style={{
        position: 'fixed', top: 0, left: 0,
        width: 350, height: '100vh',
        padding: 10, paddingRight: 0,
        zIndex: 1000, overflowY: 'auto',
        scrollbarWidth: 'none', msOverflowStyle: 'none',
        background: bg, color: fg,
      }}>
        <Controls
          colours={colours} setColours={setColours}
          step={step} setStep={setStep}
          spread={spread} setSpread={setSpread}
          inverted={inverted} setInverted={setInverted}
          cbFilter={cbFilter} setCbFilter={setCbFilter}
          view={view} setView={setView}
          palettes={palettes}
          onSavePalette={savePalette}
          onLoadPalette={loadPalette}
          onDeletePalette={deletePalette}
          hasPrev={hasPrev}
          onSnapshot={snapshot}
          onRestorePrev={restorePrev}
          tacLimit={tacLimit} setTacLimit={setTacLimit}
          gamutThreshold={gamutThreshold} setGamutThreshold={setGamutThreshold}
          contrastMin={contrastMin} setContrastMin={setContrastMin}
        />
      </div>

      {/* SVG filters for colour blindness */}
      <svg style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
        <defs>
          <filter id="cb-deuteranopia">
            <feColorMatrix type="matrix" values="0.367 0.861 -0.228 0 0  0.280 0.673 0.047 0 0  -0.012 0.043 0.969 0 0  0 0 0 1 0"/>
          </filter>
          <filter id="cb-protanopia">
            <feColorMatrix type="matrix" values="0.152 1.053 -0.205 0 0  0.115 0.786 0.099 0 0  -0.004 -0.048 1.052 0 0  0 0 0 1 0"/>
          </filter>
          <filter id="cb-tritanopia">
            <feColorMatrix type="matrix" values="1.256 -0.077 -0.179 0 0  -0.078 0.931 0.148 0 0  0.005 0.691 0.304 0 0  0 0 0 1 0"/>
          </filter>
        </defs>
      </svg>

      {/* Main canvas */}
      <div
        className="main-area print-area"
        style={{
          position: 'absolute', top: 10, right: 10,
          width: 'calc(100vw - 370px)', height: 'calc(100vh - 20px)',
          overflowY: 'auto', scrollbarWidth: 'none',
          filter: cbFilter === 'none' ? 'none' : `url(#cb-${cbFilter})`,
        }}
      >
        {/* View switcher */}
        <div className="no-print" style={{ display: 'flex', gap: 2, marginBottom: 12 }}>
          {VIEWS.map(v => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              style={{
                padding: '5px 14px',
                background: view === v.key ? fg : accent,
                color: view === v.key ? bg : fg,
                border: 'none', borderRadius: 4, cursor: 'pointer',
                fontFamily: 'Helvetica, Arial, sans-serif',
                fontSize: 10, fontWeight: 'bold',
                textTransform: 'uppercase', letterSpacing: '0.04rem',
              }}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* Print header */}
        <div className="print-header" style={{ display: 'none' }}>
          <div style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05rem' }}>
            CMYK Colour Reference — FOGRA39
          </div>
          <div style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 9, opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.02rem' }}>
            Step ±{step}% · {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>

        {ready && view === 'grid' && (
          <>
            {colours.length === 0 && (
              <div style={{ padding: 20, fontSize: 12, opacity: 0.3, fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.02rem' }}>
                Add colours to generate grids.
              </div>
            )}
            {colours.map((entry, i) => (
              <ColourResult
                key={`${entry.r}-${entry.g}-${entry.b}-${i}`}
                entry={entry} step={step} spread={spread}
              />
            ))}
          </>
        )}

        {ready && view === 'compare' && (
          <CompareView colours={colours} step={step} spread={spread} />
        )}

        {ready && view === 'contrast' && (
          <ContrastMatrix colours={colours} />
        )}

        {ready && view === 'health' && (
          <HealthReport
            colours={colours}
            tacLimit={tacLimit}
            gamutThreshold={gamutThreshold}
            contrastMin={contrastMin}
          />
        )}
      </div>
    </div>
  );
}
