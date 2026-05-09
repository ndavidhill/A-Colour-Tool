import { rgbToCmyk, buildGrid, rgbToHex } from './colourMath';

export function buildExportData(colours, step, spread) {
  const rows = [[
    'colour_group', 'label',
    'source_r', 'source_g', 'source_b', 'source_hex',
    'source_c', 'source_m', 'source_y', 'source_k',
    'swatch_index', 'is_nearest',
    'swatch_c', 'swatch_m', 'swatch_y', 'swatch_k',
    'swatch_hex', 'step_size', 'spread',
  ]];

  colours.forEach((entry, gi) => {
    const baseCmyk = rgbToCmyk(entry.r, entry.g, entry.b);
    const grid = buildGrid(entry, baseCmyk, step, spread);
    const sourceHex = rgbToHex(entry.r, entry.g, entry.b).toUpperCase();
    const groupLabel = (entry.label || `RGB(${entry.r},${entry.g},${entry.b})`).replace(/,/g, ' ');

    grid.forEach((sw, i) => {
      rows.push([
        gi + 1, groupLabel,
        entry.r, entry.g, entry.b, sourceHex,
        baseCmyk.c, baseCmyk.m, baseCmyk.y, baseCmyk.k,
        i + 1, i === 0 ? 'TRUE' : 'FALSE',
        sw.c, sw.m, sw.y, sw.k,
        rgbToHex(sw.r, sw.g, sw.b).toUpperCase(),
        step, spread,
      ]);
    });
  });

  return rows.map(r => r.join(',')).join('\n');
}

export function downloadCSV(colours, step, spread) {
  const csv = buildExportData(colours, step, spread);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cmyk-grid-export-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Figma Variables Export ───────────────────────────────────────────────────
// Exports the Radix 12-step scale as Figma Variables with Light + Dark modes.
//
// OUTPUT: Two DTCG-format JSON files — figma-light.json and figma-dark.json
//
// HOW TO IMPORT (native Figma — no plugin needed):
//   1. Open Figma → Variables panel (left sidebar or Edit menu)
//   2. Create a new collection named "CMYK Colour System"
//   3. Add a "Light" mode and a "Dark" mode
//   4. Right-click "Light" mode → Import mode → select figma-light.json
//   5. Right-click "Dark" mode → Import mode → select figma-dark.json
//   6. You now have the Light/Dark mode switcher on every variable
//
// ALTERNATIVELY — drag both files at once into the Variables modal.
// Figma creates one mode per file automatically.

import { generateRadixPalette, STEP_LABELS } from './radixPalette';

function toHex(r, g, b) {
  return '#' + [r, g, b].map(v =>
    Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  ).join('');
}

// DTCG color token — Figma native import format (2024)
function colorToken(r, g, b, description) {
  return {
    $type: 'color',
    $value: {
      colorSpace: 'srgb',
      components: [
        parseFloat((r / 255).toFixed(8)),
        parseFloat((g / 255).toFixed(8)),
        parseFloat((b / 255).toFixed(8)),
      ],
      alpha: 1,
      hex: toHex(r, g, b),
    },
    ...(description ? { $description: description } : {}),
  };
}

// Sanitise group name for Figma variable naming
function sanitise(str) {
  return str.replace(/[^a-zA-Z0-9 _-]/g, '').trim().replace(/\s+/g, ' ') || 'Colour';
}

// Build one DTCG token file for a given mode
function buildModeTokens(colours, modeKey) {
  const root = {};

  colours.forEach(entry => {
    const palette   = generateRadixPalette(entry.r, entry.g, entry.b);
    const scale     = modeKey === 'light' ? palette.light : palette.dark;
    const groupName = sanitise(entry.label || `RGB ${entry.r} ${entry.g} ${entry.b}`);

    root[groupName] = { $type: 'color' };

    scale.forEach((step, i) => {
      // e.g. "Pantone 485/01 App BG"
      const stepNum = String(i + 1).padStart(2, '0');
      const key = `${stepNum} ${STEP_LABELS[i]}`;
      root[groupName][key] = colorToken(
        step.r, step.g, step.b,
        `Step ${i + 1} of 12 · ${STEP_LABELS[i]}`
      );
    });

    // Convenience alias — the raw source colour
    root[groupName]['00 Brand Solid'] = colorToken(
      entry.r, entry.g, entry.b,
      'Source colour — use as primary brand fill'
    );
  });

  return root;
}

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Semantic token layer ─────────────────────────────────────────────────────
// Maps the 12 Radix scale steps to opinionated semantic token names.
// These are the tokens that actually get used in component libraries —
// not raw scale steps but named intentions.
//
// Structure: collection/group/token
// e.g. "Pantone 485/Background/App" → step 1 light
//      "Pantone 485/Solid/Default"  → step 9
//      "Pantone 485/Text/High Contrast" → step 12

const SEMANTIC_MAPPING = [
  // Step → [group, token, usage note]
  ['Background',  'App',          'Page and canvas background'],          // 1
  ['Background',  'Subtle',       'Sidebar, card, and panel background'], // 2
  ['Interactive', 'Default',      'UI element resting state'],            // 3
  ['Interactive', 'Hovered',      'UI element hover state'],              // 4
  ['Interactive', 'Selected',     'UI element active / selected state'],  // 5
  ['Border',      'Subtle',       'Subtle separator and divider'],        // 6
  ['Border',      'Default',      'Component border'],                    // 7
  ['Border',      'Focus',        'Focus ring and input highlight'],      // 8
  ['Solid',       'Default',      'Primary solid fill — buttons, badges'],// 9
  ['Solid',       'Hovered',      'Primary solid fill on hover'],         // 10
  ['Text',        'Low Contrast', 'Secondary text, placeholders'],        // 11
  ['Text',        'High Contrast','Primary text on coloured backgrounds'],// 12
];

// Component-level alias tokens — reference scale tokens by name
// These show designers how to wire semantic → component tokens
const COMPONENT_ALIASES = (groupName) => [
  // [component token name, references semantic token]
  [`${groupName}/Component/Button/Background`,      `{${groupName}/Solid/Default}`],
  [`${groupName}/Component/Button/Background Hover`,`{${groupName}/Solid/Hovered}`],
  [`${groupName}/Component/Button/Text`,            `{${groupName}/Text/High Contrast}`],
  [`${groupName}/Component/Badge/Background`,       `{${groupName}/Background/Subtle}`],
  [`${groupName}/Component/Badge/Text`,             `{${groupName}/Text/Low Contrast}`],
  [`${groupName}/Component/Input/Border`,           `{${groupName}/Border/Default}`],
  [`${groupName}/Component/Input/Border Focus`,     `{${groupName}/Border/Focus}`],
  [`${groupName}/Component/Card/Background`,        `{${groupName}/Background/App}`],
  [`${groupName}/Component/Card/Border`,            `{${groupName}/Border/Subtle}`],
  [`${groupName}/Component/Link/Default`,           `{${groupName}/Solid/Default}`],
  [`${groupName}/Component/Link/Hovered`,           `{${groupName}/Solid/Hovered}`],
];

function buildSemanticTokens(colours, modeKey) {
  const root = {};

  colours.forEach(entry => {
    const palette   = generateRadixPalette(entry.r, entry.g, entry.b);
    const scale     = modeKey === 'light' ? palette.light : palette.dark;
    const groupName = sanitise(entry.label || `RGB ${entry.r} ${entry.g} ${entry.b}`);

    // Scale tokens with semantic names
    SEMANTIC_MAPPING.forEach(([group, token, description], i) => {
      const step = scale[i];
      if (!root[groupName]) root[groupName] = {};
      if (!root[groupName][group]) root[groupName][group] = { $type: 'color' };
      root[groupName][group][token] = {
        ...colorToken(step.r, step.g, step.b),
        $description: `Step ${i + 1} · ${description}`,
      };
    });

    // Raw scale reference (numbered, for design system engineers)
    root[`${groupName} Scale`] = { $type: 'color' };
    STEP_LABELS.forEach((label, i) => {
      const step = scale[i];
      const num = String(i + 1).padStart(2, '0');
      root[`${groupName} Scale`][`${num} ${label}`] = colorToken(step.r, step.g, step.b);
    });

    // Brand solid
    root[groupName]['Brand Solid'] = {
      ...colorToken(entry.r, entry.g, entry.b),
      $description: 'Source colour — primary brand fill',
    };
  });

  return root;
}

// Component aliases — separate file, references the semantic tokens
function buildComponentTokens(colours) {
  const root = {};
  colours.forEach(entry => {
    const groupName = sanitise(entry.label || `RGB ${entry.r} ${entry.g} ${entry.b}`);
    COMPONENT_ALIASES(groupName).forEach(([tokenPath, ref]) => {
      const parts = tokenPath.split('/');
      let node = root;
      parts.forEach((part, i) => {
        if (i === parts.length - 1) {
          node[part] = { $type: 'color', $value: ref, $description: 'Component alias' };
        } else {
          node[part] = node[part] || {};
          node = node[part];
        }
      });
    });
  });
  return root;
}

export function downloadFigmaVariables(colours) {
  const date = new Date().toISOString().slice(0, 10);

  // Semantic scale — light
  downloadJSON(buildSemanticTokens(colours, 'light'), `tokens-light-${date}.json`);
  setTimeout(() => {
    // Semantic scale — dark
    downloadJSON(buildSemanticTokens(colours, 'dark'), `tokens-dark-${date}.json`);
  }, 400);
  setTimeout(() => {
    // Component aliases — mode-agnostic
    downloadJSON(buildComponentTokens(colours), `tokens-components-${date}.json`);
  }, 800);
}
