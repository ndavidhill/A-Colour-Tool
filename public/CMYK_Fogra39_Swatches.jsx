/**
 * CMYK_Fogra39_Swatches.jsx
 * InDesign ExtendScript — FOGRA39 Swatch Sheet Generator
 *
 * USAGE:
 *   File → Scripts → Browse → select this file
 *   (or place in your Scripts Panel folder for persistent access)
 *
 * WORKFLOW:
 *   1. Export CSV from the CMYK Grid Tester browser tool
 *   2. Run this script in InDesign
 *   3. Select the exported CSV when prompted
 *   4. A new document is created with all swatch grids
 *   5. Export as PDF/X-4 with FOGRA39 output intent
 *
 * REQUIREMENTS:
 *   Adobe InDesign CS6 / CC or later
 *   FOGRA39 ICC profile must be installed on the system
 *   (comes with Creative Cloud — ISOcoated_v2_eci.icc)
 */

// ─── Configuration ─────────────────────────────────────────────────────────

var CONFIG = {
  // Page setup — A2 landscape
  pageWidth:  594,   // mm
  pageHeight: 420,   // mm
  margin:      20,   // mm

  // Swatch grid
  swatchCols:   5,
  swatchSize:  48,   // mm — swatch square
  swatchGap:    6,   // mm
  labelHeight: 18,   // mm — below each swatch
  groupGap:    22,   // mm — between colour groups

  // Source swatch (large reference, left of each group)
  sourceSwatchSize: 40, // mm

  // Typography
  fontFamily: "Courier New",
  fontSizeLabel:  9,    // pt — swatch CMYK label
  fontSizeHeader: 14,   // pt — group header
  fontSizeMeta:   9,    // pt — page footer

  // FOGRA39 profile name as InDesign sees it
  // Change this if your system uses a different profile name:
  fogra39ProfileName: "Coated FOGRA39 (ISO 12647-2:2004)",

  // Fallback profile names to try if above not found
  fogra39Fallbacks: [
    "ISOcoated_v2_eci",
    "ISOcoated_v2 (ECI)",
    "ISO Coated v2 300% (ECI)",
    "Coated FOGRA39",
  ],
};

// ─── ES3 Polyfills (ExtendScript / InDesign has no trim, toISOString, etc.) ─

if (!String.prototype.trim) {
  String.prototype.trim = function () {
    return this.replace(/^\s+|\s+$/g, "");
  };
}

if (!Array.prototype.indexOf) {
  Array.prototype.indexOf = function (val) {
    for (var i = 0; i < this.length; i++) {
      if (this[i] === val) return i;
    }
    return -1;
  };
}

// Simple date string: "08 May 2026"
function simpleDateString() {
  var months = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];
  var d = new Date();
  return d.getDate() + " " + months[d.getMonth()] + " " + d.getFullYear();
}

// Simple ISO date: "2026-05-08"
function isoDateString() {
  var d = new Date();
  var mm = d.getMonth() + 1;
  var dd = d.getDate();
  return d.getFullYear() + "-" +
    (mm < 10 ? "0" + mm : mm) + "-" +
    (dd < 10 ? "0" + dd : dd);
}

// ─── Unit helpers (all internal work in mm → pts) ──────────────────────────

var MM = 2.834645669; // 1mm in points

function mm(v) { return v * MM; }

// ─── CSV parser ────────────────────────────────────────────────────────────

function parseCSV(text) {
  var lines = text.split(/\r?\n/);
  var headers = lines[0].split(",");
  var rows = [];
  for (var i = 1; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;
    var cols = line.split(",");
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      row[headers[j].trim()] = cols[j] ? cols[j].trim() : "";
    }
    rows.push(row);
  }
  return rows;
}

// Group rows by colour_group number
function groupRows(rows) {
  var groups = {};
  var order  = [];
  for (var i = 0; i < rows.length; i++) {
    var r   = rows[i];
    var gid = r["colour_group"];
    if (!groups[gid]) {
      groups[gid] = { label: r["label"], swatches: [], source: null };
      order.push(gid);
    }
    var sw = {
      c:         parseInt(r["swatch_c"]),
      m:         parseInt(r["swatch_m"]),
      y:         parseInt(r["swatch_y"]),
      k:         parseInt(r["swatch_k"]),
      isNearest: r["is_nearest"] === "TRUE",
      index:     parseInt(r["swatch_index"]),
    };
    if (sw.index === 1) groups[gid].source = {
      c: parseInt(r["source_c"]),
      m: parseInt(r["source_m"]),
      y: parseInt(r["source_y"]),
      k: parseInt(r["source_k"]),
      hex: r["source_hex"],
    };
    groups[gid].swatches.push(sw);
  }
  // Sort swatches within each group by index
  for (var g in groups) {
    groups[g].swatches.sort(function(a, b) { return a.index - b.index; });
  }
  return { groups: groups, order: order };
}

// ─── Colour helpers ────────────────────────────────────────────────────────

// Add or retrieve a CMYK swatch from the document swatches
function getOrCreateSwatch(doc, c, m, y, k) {
  var name = "C=" + c + " M=" + m + " Y=" + y + " K=" + k;

  // itemByName returns a speculative object rather than throwing —
  // must check .isValid before using it
  var existing = doc.colors;
  for (var i = 0; i < existing.length; i++) {
    try {
      if (existing[i].isValid && existing[i].name === name) return existing[i];
    } catch (e) {}
  }

  var swatch = doc.colors.add();
  swatch.model      = ColorModel.PROCESS;
  swatch.space      = ColorSpace.CMYK;
  swatch.colorValue = [c, m, y, k];
  swatch.name       = name;
  return swatch;
}

// Safely get a named swatch/colour, returns null if not found
function getSwatch(doc, name) {
  try {
    var s = doc.swatches.itemByName(name);
    if (s && s.isValid) return s;
  } catch (e) {}
  try {
    var c = doc.colors.itemByName(name);
    if (c && c.isValid) return c;
  } catch (e) {}
  return null;
}

// Luminance check — return true if text should be black
function useDarkText(c, m, y, k) {
  // Approximate RGB from CMYK for readability check
  var r = 255 * (1 - c / 100) * (1 - k / 100);
  var g = 255 * (1 - m / 100) * (1 - k / 100);
  var b = 255 * (1 - y / 100) * (1 - k / 100);
  var lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.45;
}

// ─── Document setup ────────────────────────────────────────────────────────

function createDocument() {
  var doc = app.documents.add();

  // Set units to millimetres FIRST — InDesign interprets pageWidth/Height
  // in the document's current ruler units. Without this, passing mm-converted
  // point values can exceed internal range limits on large formats like A2.
  var savedHUnits = doc.viewPreferences.horizontalMeasurementUnits;
  var savedVUnits = doc.viewPreferences.verticalMeasurementUnits;
  doc.viewPreferences.horizontalMeasurementUnits = MeasurementUnits.MILLIMETERS;
  doc.viewPreferences.verticalMeasurementUnits   = MeasurementUnits.MILLIMETERS;

  // Now set page size directly in mm (no conversion needed)
  doc.documentPreferences.pageWidth   = CONFIG.pageWidth;
  doc.documentPreferences.pageHeight  = CONFIG.pageHeight;
  doc.documentPreferences.facingPages = false;

  // Margins — still in mm while units are mm
  var mp = doc.pages[0].marginPreferences;
  mp.top    = CONFIG.margin;
  mp.bottom = CONFIG.margin;
  mp.left   = CONFIG.margin;
  mp.right  = CONFIG.margin;

  // Restore units to points so all mm() geometry calls work correctly
  doc.viewPreferences.horizontalMeasurementUnits = MeasurementUnits.POINTS;
  doc.viewPreferences.verticalMeasurementUnits   = MeasurementUnits.POINTS;

  // Set document colour profile to FOGRA39
  var profileSet = false;
  var profileName = CONFIG.fogra39ProfileName;

  var profilesToTry = [profileName].concat(CONFIG.fogra39Fallbacks);
  for (var pi = 0; pi < profilesToTry.length; pi++) {
    try {
      doc.cmykProfile = profilesToTry[pi];
      profileSet = true;
      profileName = profilesToTry[pi];
      break;
    } catch (e) {}
  }

  if (!profileSet) {
    alert(
      "WARNING: Could not set FOGRA39 ICC profile automatically.\n\n" +
      "Please set it manually:\n" +
      "Edit → Assign Profiles → CMYK: Coated FOGRA39\n\n" +
      "The swatch sheet will still be created but you must\n" +
      "assign the profile before exporting for print."
    );
  }

  return { doc: doc, profileName: profileName, profileSet: profileSet };
}

// ─── Drawing helpers ───────────────────────────────────────────────────────

function drawRect(page, x, y, w, h, fillColour, strokeColour, strokeWeight) {
  var rect = page.rectangles.add();
  rect.geometricBounds = [mm(y), mm(x), mm(y + h), mm(x + w)];
  var doc = page.parent;

  try {
    rect.fillColor = (fillColour && fillColour.isValid) ? fillColour : getSwatch(doc, "None");
  } catch (e) {}

  try {
    if (strokeColour && strokeColour.isValid && strokeWeight) {
      rect.strokeColor  = strokeColour;
      rect.strokeWeight = strokeWeight;
    } else {
      rect.strokeColor = getSwatch(doc, "None");
    }
  } catch (e) {}

  return rect;
}

function drawText(page, x, y, w, h, content, fontSize, align, colourName, bold) {
  var tf = page.textFrames.add();
  tf.geometricBounds = [mm(y), mm(x), mm(y + h), mm(x + w)];

  // Zero insets — property name varies by ID version, try both
  try { tf.textFramePreferences.insetSpacing = [0, 0, 0, 0]; } catch (e) {}

  tf.contents = content;

  // Style all paragraphs (\n in content creates multiple)
  for (var pi = 0; pi < tf.paragraphs.length; pi++) {
    var para = tf.paragraphs[pi];
    try { para.pointSize = fontSize; } catch (e) {}
    try { para.leading = fontSize * 1.35; } catch (e) {}
    try { para.justification = align || Justification.LEFT_ALIGN; } catch (e) {}

    if (bold) {
      try { para.appliedFont = app.fonts.itemByName(CONFIG.fontFamily + "\tBold"); } catch (e) {
        try { para.appliedFont = CONFIG.fontFamily; } catch (e2) {}
        try { para.fontStyle = "Bold"; } catch (e3) {}
      }
    } else {
      try { para.appliedFont = CONFIG.fontFamily; } catch (e) {}
    }

    var tcName = colourName || "Black";
    try {
      var tc = getSwatch(page.parent, tcName);
      if (tc) para.fillColor = tc;
    } catch (e) {}
  }

  return tf;
}

// ─── Page renderer ─────────────────────────────────────────────────────────

function renderGroups(doc, grouped) {
  var pageW  = CONFIG.pageWidth;
  var pageH  = CONFIG.pageHeight;
  var margin = CONFIG.margin;

  var contentW = pageW - margin * 2;
  var curY     = margin + 10; // top offset for page title
  var pageIndex = 0;
  var page = doc.pages[0];

  // Page title
  var dateStr = simpleDateString();
  drawText(page,
    margin, margin, contentW, 12,
    "CMYK COLOUR REFERENCE  —  FOGRA39 / ISO 12647-2  —  " + dateStr,
    12, Justification.LEFT_ALIGN, null, true
  );
  drawText(page,
    margin, margin, contentW, 12,
    "For accurate print output export as PDF/X-4 with FOGRA39 output intent",
    10, Justification.RIGHT_ALIGN
  );
  curY = margin + 16;

  var swatchSize = CONFIG.swatchSize;
  var swatchGap  = CONFIG.swatchGap;
  var labelH     = CONFIG.labelHeight;
  var groupGap   = CONFIG.groupGap;
  var srcSize    = CONFIG.sourceSwatchSize;
  var cols       = CONFIG.swatchCols;

  // Height of one complete group block
  var swatchRows = Math.ceil(25 / cols); // up to 5 rows
  var groupBlockH = srcSize + labelH + groupGap;
  // Actually: we lay swatches in rows next to / below source
  // Full group height = header(6mm) + max(srcSize, rows*(swatchSize+swatchGap)) + labelH + groupGap

  for (var oi = 0; oi < grouped.order.length; oi++) {
    var gid   = grouped.order[oi];
    var group = grouped.groups[gid];
    var src   = group.source;

    // Estimate group height
    var swRows = Math.ceil(group.swatches.length / cols);
    var gridH  = swRows * (swatchSize + swatchGap);
    var blockH = 7 + Math.max(srcSize + labelH, gridH + labelH) + groupGap;

    // Page break if needed
    if (curY + blockH > pageH - margin - 6) {
      // Add new page
      doc.pages.add(LocationOptions.AFTER, page);
      page = doc.pages[pageIndex + 1];
      pageIndex++;
      curY = margin;
    }

    // ── Group header ───────────────────────────────────────────────
    drawText(page,
      margin, curY, contentW, 10,
      group.label.toUpperCase(),
      CONFIG.fontSizeHeader, Justification.LEFT_ALIGN, null, true
    );
    if (src) {
      drawText(page,
        margin, curY, contentW, 10,
        "Source CMYK: C" + src.c + " M" + src.m + " Y" + src.y + " K" + src.k +
        "   HEX: " + src.hex,
        CONFIG.fontSizeLabel, Justification.RIGHT_ALIGN
      );
    }
    curY += 12;

    // ── Source reference swatch ────────────────────────────────────
    var srcX = margin;
    var srcY = curY;
    if (src) {
      var srcColour = getOrCreateSwatch(doc, src.c, src.m, src.y, src.k);
      drawRect(page, srcX, srcY, srcSize, srcSize, srcColour);

      // "SOURCE" label under source swatch
      var srcLabelColour = useDarkText(src.c, src.m, src.y, src.k) ? null : "Paper";
      drawText(page,
        srcX, srcY + srcSize + 1, srcSize, labelH * 0.8,
        "SOURCE\nC" + src.c + " M" + src.m + "\nY" + src.y + " K" + src.k,
        CONFIG.fontSizeLabel, Justification.CENTER_ALIGN
      );
    }

    // ── Swatch grid (to the right of source swatch) ───────────────
    var gridX    = margin + srcSize + swatchGap + 2;
    var gridMaxW = contentW - srcSize - swatchGap - 2;
    var swX      = gridX;
    var swY      = curY;
    var col      = 0;

    for (var si = 0; si < group.swatches.length; si++) {
      var sw = group.swatches[si];
      var swColour = getOrCreateSwatch(doc, sw.c, sw.m, sw.y, sw.k);

      // Draw swatch rectangle
      drawRect(page, swX, swY, swatchSize, swatchSize, swColour);

      // Nearest marker — thin black border
      if (sw.isNearest) {
        var blackColour = getSwatch(doc, "Black");
        var noneColour  = getSwatch(doc, "None");
        var borderRect = page.rectangles.add();
        borderRect.geometricBounds = [
          mm(swY - 1), mm(swX - 1),
          mm(swY + swatchSize + 1), mm(swX + swatchSize + 1)
        ];
        try { if (noneColour)  borderRect.fillColor   = noneColour;  } catch (e) {}
        try { if (blackColour) borderRect.strokeColor = blackColour; } catch (e) {}
        try { borderRect.strokeWeight = 1.5; } catch (e) {}
      }

      // CMYK label inside swatch (top-left)
      var dark    = useDarkText(sw.c, sw.m, sw.y, sw.k);
      var textCol = dark ? "Black" : "Paper";
      var labelText = "C" + sw.c + " M" + sw.m + "\nY" + sw.y + " K" + sw.k;
      if (sw.isNearest) labelText = "\u2605 " + labelText; // ★

      var swTf = page.textFrames.add();
      swTf.geometricBounds = [
        mm(swY + 1.5), mm(swX + 1.5),
        mm(swY + swatchSize - 1), mm(swX + swatchSize - 1)
      ];
      try { swTf.textFramePreferences.insetSpacing = [0, 0, 0, 0]; } catch (e) {}
      swTf.contents = labelText;
      for (var lpi = 0; lpi < swTf.paragraphs.length; lpi++) {
        var lPara = swTf.paragraphs[lpi];
        try { lPara.pointSize = CONFIG.fontSizeLabel; } catch (e) {}
        try { lPara.leading = CONFIG.fontSizeLabel * 1.35; } catch (e) {}
        try { lPara.appliedFont = CONFIG.fontFamily; } catch (e) {}
        try {
          var lc = getSwatch(doc, dark ? "Black" : "Paper");
          if (lc) lPara.fillColor = lc;
        } catch (e) {}
      }

      // Advance grid position
      col++;
      if (col >= cols) {
        col = 0;
        swX = gridX;
        swY += swatchSize + swatchGap;
      } else {
        swX += swatchSize + swatchGap;
      }
    }

    // Move curY past this group
    var gridBottomY = swY + (col > 0 ? swatchSize : 0);
    var groupBottomY = Math.max(srcY + srcSize + labelH, gridBottomY);
    curY = groupBottomY + groupGap;
  }

  // ── Footer on each page ──────────────────────────────────────────
  for (var pi = 0; pi < doc.pages.length; pi++) {
    var pg = doc.pages[pi];
    drawText(pg,
      margin, pageH - margin - 8, contentW, 8,
      "FOGRA39 / ISO 12647-2:2004  ·  Coated offset  ·  Export as PDF/X-4 with FOGRA39 output intent  ·  Page " + (pi + 1) + " of " + doc.pages.length,
      CONFIG.fontSizeMeta, Justification.CENTER_ALIGN
    );
  }
}

// ─── PDF/X-4 export helper ─────────────────────────────────────────────────

function exportPDF(doc, csvFile, profileName) {
  var pdfPath = csvFile.path + "/" +
    csvFile.name.replace(/\.csv$/i, "") +
    "_FOGRA39_" + isoDateString() + ".pdf";

  var pdfPreset;
  // Try to use PDF/X-4 preset
  try {
    pdfPreset = app.pdfExportPresets.itemByName("[PDF/X-4:2008]");
  } catch (e) {}

  var pdfOptions = app.pdfExportPreferences;

  // PDF/X-4 settings
  pdfOptions.pDFXStandard           = PDFXStandards.PDFX4_2008;
  pdfOptions.pDFXOutputCondition    = "FOGRA39";
  pdfOptions.pDFXOutputConditionIdentifier = "FOGRA39";
  pdfOptions.pDFXRegistryName       = "http://www.color.org";
  pdfOptions.colorSpace             = PDFColorSpace.CMYK;
  pdfOptions.includeICCProfiles     = ICCProfiles.INCLUDE_ALL;
  pdfOptions.outputProfile          = profileName || CONFIG.fogra39ProfileName;

  // Image quality
  pdfOptions.colorBitmapCompression     = BitmapCompression.ZIP;
  pdfOptions.colorBitmapQuality         = CompressionQuality.MAXIMUM;
  pdfOptions.grayscaleBitmapCompression = BitmapCompression.ZIP;

  // Marks & bleeds (none for reference sheet)
  pdfOptions.cropMarks      = false;
  pdfOptions.bleedMarks     = false;
  pdfOptions.colorBars      = false;
  pdfOptions.pageInformationMarks = false;

  pdfOptions.pageRange = PageRange.ALL_PAGES;
  pdfOptions.spreads   = false;

  try {
    doc.exportFile(ExportFormat.PDF_TYPE, new File(pdfPath), false);
    return pdfPath;
  } catch (e) {
    return null;
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────

function main() {
  // 1. Pick CSV
  var csvFile = File.openDialog(
    "Select CMYK Grid Export CSV",
    "CSV files:*.csv",
    false
  );
  if (!csvFile) { alert("No file selected. Script cancelled."); return; }

  csvFile.open("r");
  var text = csvFile.read();
  csvFile.close();

  if (!text || text.length < 10) {
    alert("Could not read CSV file or file is empty."); return;
  }

  // 2. Parse
  var rows = parseCSV(text);
  if (rows.length === 0) {
    alert("No colour data found in CSV."); return;
  }
  var grouped = groupRows(rows);

  // 3. Create document + set FOGRA39
  var result = createDocument();
  var doc = result.doc;

  // 4. Render swatch grids
  renderGroups(doc, grouped);

  // 5. Ask about PDF export
  var exportNow = confirm(
    "Swatch sheet created with " + grouped.order.length + " colour group(s).\n\n" +
    (result.profileSet
      ? "FOGRA39 profile set: " + result.profileName
      : "⚠ FOGRA39 profile not set — please assign manually.") +
    "\n\nExport PDF/X-4 now?\n" +
    "(You can also export later via File → Export → PDF/X-4)"
  );

  if (exportNow) {
    var pdfPath = exportPDF(doc, csvFile, result.profileName);
    if (pdfPath) {
      alert(
        "PDF exported successfully:\n" + pdfPath + "\n\n" +
        "Verify output intent in Acrobat:\n" +
        "File → Properties → Description → Output Condition"
      );
    } else {
      alert(
        "PDF export failed — please export manually:\n" +
        "File → Export → Adobe PDF (Print)\n" +
        "Use PDF/X-4:2008 standard\n" +
        "Set Output Intent to FOGRA39"
      );
    }
  } else {
    alert(
      "Document ready.\n\n" +
      "To export for print:\n" +
      "File → Export → Adobe PDF (Print)\n" +
      "Standard: PDF/X-4:2008\n" +
      "Output Intent: Coated FOGRA39 (ISO 12647-2:2004)"
    );
  }
}

// Run
main();
