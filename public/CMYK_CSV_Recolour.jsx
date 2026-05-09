/**
 * CMYK_CSV_Recolour.jsx
 * Illustrator ExtendScript — CSV-Driven CMYK Recolourer
 *
 * USAGE:
 *   1. Open the CMYK Grid Tester browser-exported PDF in Illustrator
 *   2. File → Scripts → Browse → select this file
 *   3. Select the CSV exported from the browser tool when prompted
 *
 * HOW IT WORKS:
 *   Instead of trying to match rectangles by position (fragile due to
 *   PDF import quirks), this script matches each coloured rectangle to
 *   its CSV entry by comparing the rectangle's current RGB fill colour
 *   to the swatch_hex values in the CSV. Each swatch has a unique hex
 *   value, so this is an exact 1:1 match — no positional sorting needed.
 *
 * REQUIREMENTS:
 *   Adobe Illustrator CS6 / CC or later
 *   FOGRA39 ICC profile installed (ships with Creative Cloud)
 */

// ─── ES3 Polyfills ────────────────────────────────────────────────────────────

if (!String.prototype.trim) {
  String.prototype.trim = function () {
    return this.replace(/^\s+|\s+$/g, "");
  };
}

// ─── Configuration ────────────────────────────────────────────────────────────

var CONFIG = {
  // Colour match tolerance (Euclidean RGB distance, 0-441).
  // 0 = exact match only. 15 = allow slight PDF colour shifting.
  // Increase if swatches aren't being matched.
  colourMatchTolerance: 15,

  // FOGRA39 profile names to try in order
  fogra39Profiles: [
    "Coated FOGRA39 (ISO 12647-2:2004)",
    "ISOcoated_v2_eci",
    "ISOcoated_v2 (ECI)",
    "ISO Coated v2 300% (ECI)",
    "Coated FOGRA39",
    "FOGRA39",
  ],

  // Minimum rectangle size (points) to consider as a swatch
  minSwatchSize: 20,

  // Log unmatched rect colours for debugging
  debugUnmatched: false,
};

// ─── CSV parser ───────────────────────────────────────────────────────────────

function parseCSV(text) {
  var lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
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

// Build lookup: hex string (uppercase, no #) -> {c, m, y, k}
// Includes both grid swatch colours and source swatch colours
function buildHexLookup(rows) {
  var lookup = {};
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];

    // Grid swatch entry
    var swHex = r["swatch_hex"].replace("#", "").toUpperCase();
    if (swHex && !lookup[swHex]) {
      lookup[swHex] = {
        c: parseInt(r["swatch_c"],  10),
        m: parseInt(r["swatch_m"],  10),
        y: parseInt(r["swatch_y"],  10),
        k: parseInt(r["swatch_k"],  10),
      };
    }

    // Source swatch entry (on the nearest/first row of each group)
    if (r["is_nearest"] === "TRUE") {
      var srcHex = r["source_hex"].replace("#", "").toUpperCase();
      if (srcHex && !lookup[srcHex]) {
        lookup[srcHex] = {
          c: parseInt(r["source_c"], 10),
          m: parseInt(r["source_m"], 10),
          y: parseInt(r["source_y"], 10),
          k: parseInt(r["source_k"], 10),
        };
      }
    }
  }
  return lookup;
}

// ─── Colour helpers ───────────────────────────────────────────────────────────

function hexToRgb(hex) {
  if (hex.length !== 6) return null;
  return {
    r: parseInt(hex.substr(0, 2), 16),
    g: parseInt(hex.substr(2, 2), 16),
    b: parseInt(hex.substr(4, 2), 16),
  };
}

function rgbDistance(r1, g1, b1, r2, g2, b2) {
  return Math.sqrt(
    (r1 - r2) * (r1 - r2) +
    (g1 - g2) * (g1 - g2) +
    (b1 - b2) * (b1 - b2)
  );
}

function makeCmyk(c, m, y, k) {
  var col    = new CMYKColor();
  col.cyan    = c;
  col.magenta = m;
  col.yellow  = y;
  col.black   = k;
  return col;
}

// Find the best matching CSV entry for a given RGB value.
// Returns {cmyk, hex, distance} or null if nothing is within tolerance.
function findClosestMatch(r, g, b, lookup, tolerance) {
  var bestDist = 999999;
  var bestKey  = null;

  for (var hex in lookup) {
    var rgb = hexToRgb(hex);
    if (!rgb) continue;
    var dist = rgbDistance(r, g, b, rgb.r, rgb.g, rgb.b);
    if (dist < bestDist) {
      bestDist = dist;
      bestKey  = hex;
    }
  }

  if (bestKey !== null && bestDist <= tolerance) {
    return { cmyk: lookup[bestKey], hex: bestKey, distance: bestDist };
  }
  return null;
}

// ─── Object collection ────────────────────────────────────────────────────────

// Collect all page items that have an RGB fill and are large enough to be swatches
function collectRgbRects(collection, rects) {
  for (var i = 0; i < collection.length; i++) {
    var item = collection[i];
    var type = item.typename;

    if (type === "GroupItem") {
      collectRgbRects(item.pageItems, rects);
    } else if (type === "PathItem" || type === "CompoundPathItem") {
      try {
        var w = Math.abs(item.geometricBounds[3] - item.geometricBounds[1]);
        var h = Math.abs(item.geometricBounds[0] - item.geometricBounds[2]);
        if (w < CONFIG.minSwatchSize || h < CONFIG.minSwatchSize) continue;
        if (!item.filled) continue;
        var fill = item.fillColor;
        if (!fill || fill.typename !== "RGBColor") continue;
        rects.push(item);
      } catch (e) {}
    }
  }
}

// ─── Profile ─────────────────────────────────────────────────────────────────

function assignFogra39(doc) {
  for (var i = 0; i < CONFIG.fogra39Profiles.length; i++) {
    try {
      doc.colorProfileName = CONFIG.fogra39Profiles[i];
      return CONFIG.fogra39Profiles[i];
    } catch (e) {}
  }
  return null;
}

// ─── PDF export ───────────────────────────────────────────────────────────────

function isoDate() {
  var d  = new Date();
  var mo = d.getMonth() + 1;
  var dy = d.getDate();
  return d.getFullYear() + "-" +
    (mo < 10 ? "0" + mo : "" + mo) + "-" +
    (dy < 10 ? "0" + dy : "" + dy);
}

function exportPDF(doc, profileName) {
  try {
    var base    = doc.fullName.path;
    var name    = doc.name.replace(/\.[^\.]+$/, "");
    var outPath = base + "/" + name + "_FOGRA39_" + isoDate() + ".pdf";

    var opts = new PDFSaveOptions();
    opts.compatibility             = PDFCompatibility.ACROBAT7;
    opts.pDFXStandard              = PDFXStandard.PDFX4;
    opts.pDFXConformance           = PDFXConformance.PDFX4_2008;
    opts.outputCondition           = "FOGRA39";
    opts.outputConditionIdentifier = "FOGRA39";
    opts.registryName              = "http://www.color.org";
    opts.colorConversionID         = ColorConversion.TOPRINT;
    opts.colorDestinationID        = ColorDestination.USEDOCUMENTPROFILE;
    opts.colorProfileID            = ColorProfile.INCLUDEALL;
    opts.destinationProfile        = profileName || CONFIG.fogra39Profiles[0];
    opts.embedICCProfile           = true;
    opts.preserveEditability       = false;
    opts.trimMarks                 = false;
    opts.bleedMarks                = false;
    opts.colorBars                 = false;
    opts.pageInformation           = false;
    opts.generateThumbnails        = false;

    doc.saveAs(new File(outPath), opts);
    return outPath;
  } catch (e) {
    return null;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {

  if (app.documents.length === 0) {
    alert(
      "No document open.\n\n" +
      "Open your CMYK Grid Tester PDF in Illustrator first,\n" +
      "then run this script."
    );
    return;
  }

  var doc = app.activeDocument;

  if (!confirm(
    "CMYK CSV RECOLOURER — FOGRA39\n\n" +
    "Document: " + doc.name + "\n\n" +
    "This script matches each swatch rectangle to its CSV entry\n" +
    "by colour value, then applies exact CMYK fills.\n\n" +
    "You will be asked to select the CSV next.\n\n" +
    "Run on a COPY of your file.\n\nContinue?"
  )) return;

  // Pick CSV
  var csvFile = File.openDialog(
    "Select the CMYK Grid Tester CSV export",
    "CSV files:*.csv",
    false
  );
  if (!csvFile) { alert("No CSV selected. Script cancelled."); return; }

  csvFile.open("r");
  var csvText = csvFile.read();
  csvFile.close();

  if (!csvText || csvText.length < 20) {
    alert("Could not read CSV, or file is empty."); return;
  }

  // Build colour lookup from CSV
  var rows   = parseCSV(csvText);
  var lookup = buildHexLookup(rows);

  var lookupCount = 0;
  for (var k in lookup) lookupCount++;

  if (lookupCount === 0) {
    alert("No colour entries found in CSV."); return;
  }

  // Collect all RGB-filled rectangles BEFORE switching colour space.
  // We must read RGB fills and apply CMYK fills while the document is
  // still in its original state — if we switch to CMYK first, Illustrator
  // runs our fill values through the profile and changes them.
  var rects = [];
  collectRgbRects(doc.pageItems, rects);

  if (rects.length === 0) {
    alert(
      "No RGB-filled rectangles found.\n\n" +
      "The PDF may already be fully converted to CMYK, or all\n" +
      "objects are inside locked groups.\n\n" +
      "Try: Select All → Object → Unlock All, then re-run."
    );
    return;
  }

  // Match and recolour — DO THIS BEFORE changeColorSpace/assignFogra39.
  // Applying CMYKColor fills to an RGB document bypasses profile conversion
  // so our exact values (C87 M0 Y45 K15) are stored literally, not remapped.
  var matched      = 0;
  var unmatched    = 0;
  var unmatchedLog = [];

  app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;

  for (var i = 0; i < rects.length; i++) {
    var rect = rects[i];
    try {
      var fill   = rect.fillColor;
      var result = findClosestMatch(
        fill.red, fill.green, fill.blue,
        lookup, CONFIG.colourMatchTolerance
      );

      if (result) {
        rect.fillColor = makeCmyk(
          result.cmyk.c, result.cmyk.m,
          result.cmyk.y, result.cmyk.k
        );
        rect.stroked = false;
        matched++;
      } else {
        unmatched++;
        if (CONFIG.debugUnmatched && unmatchedLog.length < 15) {
          unmatchedLog.push(
            "RGB(" + Math.round(fill.red) + "," +
            Math.round(fill.green) + "," +
            Math.round(fill.blue) + ")"
          );
        }
      }
    } catch (e) {
      unmatched++;
    }
  }

  app.userInteractionLevel = UserInteractionLevel.DISPLAYALERTS;

  // NOW switch to CMYK and assign FOGRA39 — after fills are applied.
  // This sets the document colour space and output intent for export
  // without retroactively converting our already-set CMYK values.
  if (doc.documentColorSpace !== DocumentColorSpace.CMYK) {
    try { doc.changeColorSpace(DocumentColorSpace.CMYK); } catch (e) {}
  }
  var profileSet = assignFogra39(doc);

  // Summary
  var colorMode = (doc.documentColorSpace === DocumentColorSpace.CMYK)
    ? "CMYK" : "RGB (set manually: Edit → Color Mode → CMYK)";

  var summary =
    "Recolouring complete.\n\n" +
    "Colour mode:      " + colorMode + "\n" +
    "Profile:          " + (profileSet || "Not set — assign manually") + "\n" +
    "CSV colours:      " + lookupCount + "\n" +
    "RGB rects found:  " + rects.length + "\n" +
    "Matched + filled: " + matched + "\n" +
    "Unmatched:        " + unmatched + "\n";

  if (unmatched > 0) {
    summary +=
      "\nUnmatched rects have colours not in the CSV —\n" +
      "normal for backgrounds, borders, and UI elements.\n";
    if (CONFIG.debugUnmatched && unmatchedLog.length > 0) {
      summary += "\nUnmatched colours:\n" + unmatchedLog.join("\n") + "\n";
    } else {
      summary += "Set CONFIG.debugUnmatched = true to log them.\n";
    }
  }

  if (matched === 0) {
    alert(
      summary +
      "\nNo swatches matched.\n\n" +
      "Make sure you're using the CSV exported from the same\n" +
      "session as this PDF. If colours still don't match,\n" +
      "try increasing CONFIG.colourMatchTolerance (currently " +
      CONFIG.colourMatchTolerance + ")."
    );
    return;
  }

  summary += "\nExport as PDF/X-4 with FOGRA39 now?";

  if (confirm(summary)) {
    var pdfPath = exportPDF(doc, profileSet);
    if (pdfPath) {
      alert(
        "PDF exported:\n" + pdfPath + "\n\n" +
        "Verify in Acrobat:\n" +
        "File → Properties → Description → Output Condition"
      );
    } else {
      alert(
        "PDF export failed — export manually:\n\n" +
        "File → Save As → Adobe PDF (Print)\n" +
        "Standard: PDF/X-4:2008\n" +
        "Output intent: " + (profileSet || "Coated FOGRA39 (ISO 12647-2:2004)")
      );
    }
  }
}

main();
