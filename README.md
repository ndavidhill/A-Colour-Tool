# CMYK Grid Tester

A browser-based CMYK colour exploration tool for print design teams.
Input RGB/hex values and generate nearest-match CMYK swatch grids, then
hand off to InDesign for accurate FOGRA39 print output.

## Features

- Single or batch RGB/hex colour input
- 5×5 CMYK neighbour grids sorted by visual proximity to source
- Adjustable step size (±1–10%) and spread
- CSV export for InDesign handoff
- InDesign ExtendScript companion for FOGRA39/PDF X-4 output
- Invert (dark) mode
- Print-ready layout

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy to Vercel

```bash
npm i -g vercel
vercel
```

Or connect this repo in the [Vercel dashboard](https://vercel.com) — zero config required.

## InDesign Workflow

1. Build your colour queue in the browser tool
2. Click **Export CSV → InDesign**
3. In InDesign: **File → Scripts → Browse**
4. Run `CMYK_Fogra39_Swatches.jsx` (download link in the app, or find it in `/public/`)
5. Select the exported CSV when prompted
6. Export the generated swatch sheet as **PDF/X-4** with FOGRA39 output intent

## Project Structure

```
src/app/
├── layout.js               # Root layout + metadata
├── page.js                 # Entry point (renders CMYKTester)
└── cmyk/
    ├── CMYKTester.jsx      # Main app shell
    ├── colourMath.js       # RGB↔CMYK conversion, grid generation
    ├── export.js           # CSV export
    └── components/
        ├── Swatch.jsx      # Individual colour swatch
        ├── ColourResult.jsx # Swatch grid for one colour
        ├── Dropdown.jsx    # Collapsible section
        ├── Controls.jsx    # Sidebar panel
        └── Ui.jsx          # Shared primitives (Btn, RangeRow, etc.)

public/
└── CMYK_Fogra39_Swatches.jsx   # InDesign ExtendScript
```

## Requirements

- Node.js 18+
- For InDesign script: Adobe InDesign CS6 / CC or later with FOGRA39 ICC profile installed
  (ships with Creative Cloud as `ISOcoated_v2_eci.icc`)
