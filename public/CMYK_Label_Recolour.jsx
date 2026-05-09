/**
 * CMYK_Label_Recolour.jsx
 * Illustrator ExtendScript — Label-Accurate CMYK Recolourer
 *
 * USAGE:
 *   1. Open the CMYK Grid Tester browser-exported PDF in Illustrator
 *   2. File → Scripts → Browse → select this file
 *
 * WHAT IT DOES:
 *   Instead of mathematically converting RGB colours (which produces
 *   approximations), this script reads the CMYK values directly from
 *   each swatch's text label and applies them as the exact fill colour.
 *   The result is pixel-perfect — the swatch colour matches the label.
 *
 * HOW IT WORKS:
 *   1. Collects all rectangles and text frames on the page
 *   2. For each rectangle, finds the text frame geometrically overlapping it
 *   3. Parses "C## M## Y## K##" from that text
 *   4. Sets the rectangle fill to exactly those CMYK values
 *   5. Assigns FOGRA39 profile and offers PDF/X-4 export
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

if (!Array.prototype.indexOf) {
  Array.prototype.indexOf = function (val) {
    for (var i = 0; i < this.length; i++) {
      if (this[i] === val) return i;
    }
    return -1;
  };
}

// ─── Configuration ────────────────────────────────────────────────────────────

var CONFIG = {
  // FOGRA39 profile — tries each in order until one works
  fogra39Profiles: [
    "Coated FOGRA39 (ISO 12647-2:2004)",
    "ISOcoated_v2_eci",
    "ISOcoated_v2 (ECI)",
    "ISO Coated v2 300% (ECI)",
    "Coated FOGRA39",
    "FOGRA39",
  ],

  // A rectangle is considered a "swatch" if both dimensions are above
  // this threshold (points). Filters out hairlines, borders, decorations.
  // 14pt ≈ 5mm — adjust down if your swatches are very small.
  minSwatchSize: 14,

  // A text frame is considered "inside" a rectangle if its centre point
  // falls within the rectangle's bounds (with this tolerance in points).
  overlapTolerance: 2,

  // If true, also recolour the source reference swatch (the large one
  // on the left of each group). It has the same label format.
  recolourSourceSwatch: true,

  // Show detailed per-swatch log at the end (useful for debugging)
  showDetailedLog: false,
};

// ─── Geometry helpers ─────────────────────────────────────────────────────────

// Illustrator geometricBounds = [top, left, bottom, right] in points
// (top > bottom because y increases downward in Illustrator's coords)

function rectLeft(item)   { return item.geometricBounds[1]; }
function rectTop(item)    { return item.geometricBounds[0]; }
function rectRight(item)  { return item.geometricBounds[3]; }
function rectBottom(item) { return item.geometricBounds[2]; }
function rectWidth(item)  { return Math.abs(rectRight(item) - rectLeft(item)); }
function rectHeight(item) { return Math.abs(rectTop(item)   - rectBottom(item)); }

function centrX(item) { return (rectLeft(item) + rectRight(item))  / 2; }
function centrY(item) { return (rectTop(item)  + rectBottom(item)) / 2; }

// Returns true if point (px, py) is inside item's bounds (with tolerance)
function pointInBounds(px, py, item, tol) {
  tol = tol || 0;
  var l = Math.min(rectLeft(item),   rectRight(item))  - tol;
  var r = Math.max(rectLeft(item),   rectRight(item))  + tol;
  var t = Math.max(rectTop(item),    rectBottom(item)) + tol;
  var b = Math.min(rectTop(item),    rectBottom(item)) - tol;
  return (px >= l && px <= r && py >= b && py <= t);
}

// Returns true if textFrame centre is inside rect bounds
function textInsideRect(tf, rect, tol) {
  return pointInBounds(centrX(tf), centrY(tf), rect, tol);
}

// ─── Text parsing ─────────────────────────────────────────────────────────────

// Extract all text content from a TextFrame (handles area + point text)
function getTextContent(tf) {
  try {
    return tf.contents;
  } catch (e) {
    return "";
  }
}

// Parse "C## M## Y## K##" from a string.
// Handles multi-line labels like "C0 M81\nY87 K15"
// Returns {c, m, y, k} or null if not found.
function parseCMYK(text) {
  // Normalise whitespace and newlines
  var flat = text.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ");

  // Match C, M, Y, K values — each preceded by their letter, followed by digits
  // Pattern: C<digits> M<digits> Y<digits> K<digits> (any order of whitespace)
  var cMatch = flat.match(/C(\d+)/i);
  var mMatch = flat.match(/M(\d+)/i);
  var yMatch = flat.match(/Y(\d+)/i);
  var kMatch = flat.match(/K(\d+)/i);

  if (!cMatch || !mMatch || !yMatch || !kMatch) return null;

  var c = parseInt(cMatch[1], 10);
  var m = parseInt(mMatch[1], 10);
  var y = parseInt(yMatch[1], 10);
  var k = parseInt(kMatch[1], 10);

  // Sanity check — all values must be 0–100
  if (c > 100 || m > 100 || y > 100 || k > 100) return null;
  if (c < 0   || m < 0   || y < 0   || k < 0)   return null;

  return { c: c, m: m, y: y, k: k };
}

// ─── Colour application ───────────────────────────────────────────────────────

function makeCmykColor(c, m, y, k) {
  var col = new CMYKColor();
  col.cyan    = c;
  col.magenta = m;
  col.yellow  = y;
  col.black   = k;
  return col;
}

// ─── Object collection ────────────────────────────────────────────────────────

// Recursively collect all PathItems (rectangles) and TextFrames
function collectItems(collection, rects, texts) {
  for (var i = 0; i < collection.length; i++) {
    var item = collection[i];
    var type = item.typename;

    if (type === "GroupItem") {
      collectItems(item.pageItems, rects, texts);

    } else if (type === "PathItem") {
      // Only collect items large enough to be swatches
      if (rectWidth(item)  >= CONFIG.minSwatchSize &&
          rectHeight(item) >= CONFIG.minSwatchSize) {
        rects.push(item);
      }

    } else if (type === "TextFrame") {
      texts.push(item);

    } else if (type === "CompoundPathItem") {
      // Compound paths can be swatch-sized shapes
      if (rectWidth(item)  >= CONFIG.minSwatchSize &&
          rectHeight(item) >= CONFIG.minSwatchSize) {
        rects.push(item);
      }
    }
  }
}

// ─── FOGRA39 profile ──────────────────────────────────────────────────────────

function assignFogra39(doc) {
  for (var i = 0; i < CONFIG.fogra39Profiles.length; i++) {
    try {
      doc.colorProfileName = CONFIG.fogra39Profiles[i];
      return CONFIG.fogra39Profiles[i];
    } catch (e) {}
  }
  return null;
}

// ─── PDF/X-4 export ───────────────────────────────────────────────────────────

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
    opts.compatibility              = PDFCompatibility.ACROBAT7;
    opts.pDFXStandard               = PDFXStandard.PDFX4;
    opts.pDFXConformance            = PDFXConformance.PDFX4_2008;
    opts.outputCondition            = "FOGRA39";
    opts.outputConditionIdentifier  = "FOGRA39";
    opts.registryName               = "http://www.color.org";
    opts.colorConversionID          = ColorConversion.TOPRINT;
    opts.colorDestinationID         = ColorDestination.USEDOCUMENTPROFILE;
    opts.colorProfileID             = ColorProfile.INCLUDEALL;
    opts.destinationProfile         = profileName || CONFIG.fogra39Profiles[0];
    opts.embedICCProfile            = true;
    opts.preserveEditability        = false;
    opts.trimMarks                  = false;
    opts.bleedMarks                 = false;
    opts.colorBars                  = false;
    opts.pageInformation            = false;
    opts.generateThumbnails         = false;

    doc.saveAs(new File(outPath), opts);
    return outPath;
  } catch (e) {
    return null;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {

  // 1. Check document is open
  if (app.documents.length === 0) {
    alert(
      "No document open.\n\n" +
      "Open your CMYK Grid Tester PDF in Illustrator first,\n" +
      "then run this script."
    );
    return;
  }

  var doc = app.activeDocument;

  // 2. Confirm
  if (!confirm(
    "CMYK LABEL RECOLOURER — FOGRA39\n\n" +
    "Document: " + doc.name + "\n\n" +
    "This script reads CMYK values from each swatch label\n" +
    "and applies them as exact CMYK fills — no colour conversion.\n\n" +
    "Run on a COPY of your file.\n\nContinue?"
  )) return;

  // 3. Switch to CMYK mode if needed.
  // changeColorSpace() is unreliable via script — we attempt it silently
  // but never block execution if it fails. The CMYKColor fills we apply
  // are valid regardless; Illustrator accepts them in any document mode.
  if (doc.documentColorSpace !== DocumentColorSpace.CMYK) {
    try { doc.changeColorSpace(DocumentColorSpace.CMYK); } catch (e) {}
  }

  // 4. Assign FOGRA39 profile — non-blocking, warn at end if needed
  var profileSet = assignFogra39(doc);

  // 5. Collect all rectangles and text frames
  var rects = [];
  var texts = [];
  collectItems(doc.pageItems, rects, texts);

  if (rects.length === 0) {
    alert(
      "No swatch rectangles found.\n\n" +
      "Make sure the PDF is fully expanded (not locked/clipped at\n" +
      "the top level). Try Object → Flatten Transparency first,\n" +
      "or unlock all layers."
    );
    return;
  }

  // 6. For each rectangle, find overlapping text, parse CMYK, apply
  var stats = {
    matched:   0,
    recoloured: 0,
    noText:    0,
    noCmyk:    0,
    log:       [],
  };

  app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;

  for (var ri = 0; ri < rects.length; ri++) {
    var rect = rects[ri];

    // Find all text frames whose centre falls inside this rectangle
    var candidates = [];
    for (var ti = 0; ti < texts.length; ti++) {
      if (textInsideRect(texts[ti], rect, CONFIG.overlapTolerance)) {
        candidates.push(texts[ti]);
      }
    }

    if (candidates.length === 0) {
      stats.noText++;
      if (CONFIG.showDetailedLog) {
        stats.log.push("No text found for rect at " +
          Math.round(rectLeft(rect)) + "," + Math.round(rectTop(rect)));
      }
      continue;
    }

    // Concatenate all overlapping text and try to parse CMYK
    var combined = "";
    for (var ci = 0; ci < candidates.length; ci++) {
      combined += " " + getTextContent(candidates[ci]);
    }

    var cmyk = parseCMYK(combined);

    if (!cmyk) {
      stats.noCmyk++;
      if (CONFIG.showDetailedLog) {
        stats.log.push("Could not parse CMYK from: \"" + combined.trim() + "\"");
      }
      continue;
    }

    // Apply the exact CMYK fill
    try {
      rect.filled    = true;
      rect.fillColor = makeCmykColor(cmyk.c, cmyk.m, cmyk.y, cmyk.k);
      // Remove any stroke that might be left over from PDF import
      rect.stroked   = false;
      stats.recoloured++;
      if (CONFIG.showDetailedLog) {
        stats.log.push(
          "C" + cmyk.c + " M" + cmyk.m + " Y" + cmyk.y + " K" + cmyk.k +
          " applied to rect at " + Math.round(rectLeft(rect)) + "," + Math.round(rectTop(rect))
        );
      }
    } catch (e) {
      stats.noCmyk++;
    }

    stats.matched++;
  }

  app.userInteractionLevel = UserInteractionLevel.DISPLAYALERTS;

  // 7. Summary
  var colorMode = (doc.documentColorSpace === DocumentColorSpace.CMYK) ? "CMYK" : "RGB (set manually via Edit → Color Mode → CMYK)";
  var summary =
    "Recolouring complete.\n\n" +
    "Colour mode:       " + colorMode + "\n" +
    "Profile:           " + (profileSet || "Not set — assign manually via Edit → Assign Profile") + "\n" +
    "Rectangles found:  " + rects.length + "\n" +
    "Text frames found: " + texts.length + "\n" +
    "Swatches matched:  " + stats.matched + "\n" +
    "Swatches coloured: " + stats.recoloured + "\n" +
    "No text found:     " + stats.noText + "\n" +
    "No CMYK parsed:    " + stats.noCmyk + "\n";

  if (CONFIG.showDetailedLog && stats.log.length > 0) {
    summary += "\nLog:\n" + stats.log.join("\n");
  }

  if (stats.recoloured === 0) {
    alert(
      summary + "\n\nNo swatches were recoloured.\n\n" +
      "TROUBLESHOOTING:\n" +
      "• The PDF may have locked or clipped layers — try\n" +
      "  Object → Flatten Transparency, then re-run.\n" +
      "• Text and rectangles may be in separate sub-groups —\n" +
      "  try ungrouping everything (Cmd+Shift+G repeatedly)\n" +
      "  then re-run.\n" +
      "• Set CONFIG.showDetailedLog = true for a per-object log."
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

// Run
main();
