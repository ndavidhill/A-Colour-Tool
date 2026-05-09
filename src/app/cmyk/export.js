import { rgbToCmyk, buildGrid, rgbToHex, generateHarmonies } from './colourMath';
import { generateRadixPalette, STEP_LABELS } from './radixPalette';

// ─── CSV export ───────────────────────────────────────────────────────────────

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
    const baseCmyk  = rgbToCmyk(entry.r, entry.g, entry.b);
    const grid      = buildGrid(entry, baseCmyk, step, spread);
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
  const csv  = buildExportData(colours, step, spread);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `cmyk-grid-export-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── DTCG colour token helpers ────────────────────────────────────────────────

function toHex(r, g, b) {
  return '#' + [r, g, b].map(v =>
    Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  ).join('');
}

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

function sanitise(str) {
  return str.replace(/[^a-zA-Z0-9 _-]/g, '').trim().replace(/\s+/g, ' ') || 'Colour';
}

// ─── Semantic mapping ─────────────────────────────────────────────────────────
// Default Radix-style mapping: step index (0-based) → [group, token, usage]
// Callers can override this by passing a customMapping array.

export const DEFAULT_SEMANTIC_MAPPING = [
  ['Background',  'App',          'Page and canvas background'],
  ['Background',  'Subtle',       'Sidebar, card, and panel background'],
  ['Interactive', 'Default',      'UI element resting state'],
  ['Interactive', 'Hovered',      'UI element hover state'],
  ['Interactive', 'Selected',     'UI element active / selected state'],
  ['Border',      'Subtle',       'Subtle separator and divider'],
  ['Border',      'Default',      'Component border'],
  ['Border',      'Focus',        'Focus ring and input highlight'],
  ['Solid',       'Default',      'Primary solid fill — buttons, badges'],
  ['Solid',       'Hovered',      'Primary solid fill on hover'],
  ['Text',        'Low Contrast', 'Secondary text, placeholders'],
  ['Text',        'High Contrast','Primary text on coloured backgrounds'],
];

const COMPONENT_ALIASES = (groupName) => [
  [`${groupName}/Component/Button/Background`,       `{${groupName}/Solid/Default}`],
  [`${groupName}/Component/Button/Background Hover`, `{${groupName}/Solid/Hovered}`],
  [`${groupName}/Component/Button/Text`,             `{${groupName}/Text/High Contrast}`],
  [`${groupName}/Component/Badge/Background`,        `{${groupName}/Background/Subtle}`],
  [`${groupName}/Component/Badge/Text`,              `{${groupName}/Text/Low Contrast}`],
  [`${groupName}/Component/Input/Border`,            `{${groupName}/Border/Default}`],
  [`${groupName}/Component/Input/Border Focus`,      `{${groupName}/Border/Focus}`],
  [`${groupName}/Component/Card/Background`,         `{${groupName}/Background/App}`],
  [`${groupName}/Component/Card/Border`,             `{${groupName}/Border/Subtle}`],
  [`${groupName}/Component/Link/Default`,            `{${groupName}/Solid/Default}`],
  [`${groupName}/Component/Link/Hovered`,            `{${groupName}/Solid/Hovered}`],
];

function buildSemanticTokens(colours, modeKey, mapping = DEFAULT_SEMANTIC_MAPPING) {
  const root = {};

  colours.forEach(entry => {
    const palette   = generateRadixPalette(entry.r, entry.g, entry.b);
    const scale     = modeKey === 'light' ? palette.light : palette.dark;
    const groupName = sanitise(entry.label || `RGB ${entry.r} ${entry.g} ${entry.b}`);

    mapping.forEach(([group, token, description], i) => {
      const step = scale[i];
      if (!root[groupName]) root[groupName] = {};
      if (!root[groupName][group]) root[groupName][group] = { $type: 'color' };
      root[groupName][group][token] = {
        ...colorToken(step.r, step.g, step.b),
        $description: `Step ${i + 1} · ${description}`,
      };
    });

    // Numbered scale reference
    root[`${groupName} Scale`] = { $type: 'color' };
    STEP_LABELS.forEach((label, i) => {
      const step = scale[i];
      const num  = String(i + 1).padStart(2, '0');
      root[`${groupName} Scale`][`${num} ${label}`] = colorToken(step.r, step.g, step.b);
    });

    root[groupName]['Brand Solid'] = {
      ...colorToken(entry.r, entry.g, entry.b),
      $description: 'Source colour — primary brand fill',
    };
  });

  return root;
}

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

// ─── Harmony token export ─────────────────────────────────────────────────────

function buildHarmonyTokens(colours) {
  const root = {};

  colours.forEach(entry => {
    const groupName = sanitise(entry.label || `RGB ${entry.r} ${entry.g} ${entry.b}`);
    const harmonies = generateHarmonies(entry.r, entry.g, entry.b);

    root[groupName] = {
      $type: 'color',
      'Source': colorToken(entry.r, entry.g, entry.b, 'Source colour'),
    };

    harmonies.forEach(({ label, colours: hCols }) => {
      const groupKey = label.replace(/[^a-zA-Z0-9 ]/g, '').trim();
      hCols.forEach((hc, i) => {
        const key = hCols.length > 1 ? `${groupKey} ${i + 1}` : groupKey;
        root[groupName][key] = colorToken(hc.r, hc.g, hc.b, `${label} harmony of ${groupName}`);
      });
    });
  });

  return root;
}

// ─── JSON download helper ─────────────────────────────────────────────────────

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Download all token files ─────────────────────────────────────────────────
// Options:
//   includeHarmonies: boolean — also export tokens-harmonies.json
//   semanticMapping:  array   — override the 12-step semantic mapping

export function downloadFigmaVariables(colours, options = {}) {
  const { includeHarmonies = false, semanticMapping } = options;
  const date    = new Date().toISOString().slice(0, 10);
  const mapping = semanticMapping || DEFAULT_SEMANTIC_MAPPING;

  downloadJSON(buildSemanticTokens(colours, 'light', mapping), `tokens-light-${date}.json`);
  setTimeout(() => {
    downloadJSON(buildSemanticTokens(colours, 'dark', mapping), `tokens-dark-${date}.json`);
  }, 400);
  setTimeout(() => {
    downloadJSON(buildComponentTokens(colours), `tokens-components-${date}.json`);
  }, 800);
  if (includeHarmonies) {
    setTimeout(() => {
      downloadJSON(buildHarmonyTokens(colours), `tokens-harmonies-${date}.json`);
    }, 1200);
  }
}

// ─── Figma Variables REST API push ───────────────────────────────────────────
// Uses the Figma Variables API (PATCH /v1/files/:fileKey/variables)
// Requires: Personal Access Token with write scope + a Figma file key.
//
// Creates / updates a collection named "CMYK Colour System" with:
//   - Light mode + Dark mode variable modes
//   - All semantic scale tokens as COLOR variables
//   - Harmony tokens in a separate "Harmonies" collection
//
// Note: The Figma Variables API requires a paid Organisation/Enterprise plan.

export async function pushToFigmaAPI(colours, token, fileKey, options = {}) {
  const { semanticMapping } = options;
  const mapping = semanticMapping || DEFAULT_SEMANTIC_MAPPING;

  // Build a flat list of variables with both light and dark values
  const variables   = [];
  const modeValues  = [];
  let varIndex      = 0;

  const colId    = 'VariableCollectionId:temp:cmyk';
  const modeLight = `${colId}:light`;
  const modeDark  = `${colId}:dark`;

  colours.forEach(entry => {
    const palette   = generateRadixPalette(entry.r, entry.g, entry.b);
    const groupName = sanitise(entry.label || `RGB ${entry.r} ${entry.g} ${entry.b}`);

    // Semantic tokens
    mapping.forEach(([group, tokenName, _desc], i) => {
      const id     = `VariableId:temp:${varIndex++}`;
      const name   = `${groupName}/${group}/${tokenName}`;
      const lStep  = palette.light[i];
      const dStep  = palette.dark[i];

      variables.push({
        action: 'CREATE', id, name,
        resolvedType: 'COLOR',
        variableCollectionId: colId,
      });
      modeValues.push(
        { variableId: id, modeId: modeLight, value: { r: lStep.r / 255, g: lStep.g / 255, b: lStep.b / 255, a: 1 } },
        { variableId: id, modeId: modeDark,  value: { r: dStep.r / 255, g: dStep.g / 255, b: dStep.b / 255, a: 1 } },
      );
    });

    // Brand solid
    const solidId = `VariableId:temp:${varIndex++}`;
    variables.push({
      action: 'CREATE', id: solidId,
      name: `${groupName}/Brand Solid`,
      resolvedType: 'COLOR',
      variableCollectionId: colId,
    });
    modeValues.push(
      { variableId: solidId, modeId: modeLight, value: { r: entry.r / 255, g: entry.g / 255, b: entry.b / 255, a: 1 } },
      { variableId: solidId, modeId: modeDark,  value: { r: entry.r / 255, g: entry.g / 255, b: entry.b / 255, a: 1 } },
    );
  });

  const body = {
    variableCollections: [{
      action: 'CREATE', id: colId,
      name: 'CMYK Colour System',
      initialModeId: modeLight,
    }],
    variableModes: [
      { action: 'CREATE', id: modeLight, name: 'Light', variableCollectionId: colId },
      { action: 'CREATE', id: modeDark,  name: 'Dark',  variableCollectionId: colId },
    ],
    variables,
    variableModeValues: modeValues,
  };

  const res = await fetch(`https://api.figma.com/v1/files/${fileKey}/variables`, {
    method: 'POST',
    headers: {
      'X-Figma-Token': token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Figma API error ${res.status}`);
  }

  return res.json();
}
