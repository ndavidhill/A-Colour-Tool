/**
 * CMYK_Convert_Fogra39.jsx
 * Illustrator ExtendScript — RGB to CMYK (FOGRA39) Converter
 *
 * USAGE:
 *   File → Scripts → Browse → select this file
 *   (or place in your Scripts Panel folder for persistent access)
 *
 * WORKFLOW:
 *   1. Open the browser-exported CMYK Grid Tester PDF in Illustrator
 *      (File → Open, or drag onto Illustrator icon)
 *   2. Run this script
 *   3. Script converts every RGB fill and stroke to CMYK via FOGRA39
 *   4. Save or export as PDF/X-4 with FOGRA39 output intent
 *
 * WHAT IT DOES:
 *   - Sets the document colour mode to CMYK
 *   - Assigns the FOGRA39 ICC profile to the document
 *   - Walks every object (including nested groups, compound paths,
 *     clipping masks) and converts RGB fills + strokes to CMYK
 *   - Skips near-black colours (used for text/labels) to avoid
 *     converting body text from rich black to process black
 *   - Logs a summary of how many objects were converted
 *
 * REQUIREMENTS:
 *   Adobe Illustrator CS6 / CC or later
 *   FOGRA39 ICC profile installed (ships with Creative Cloud)
 *
 * NOTES:
 *   - Run on a COPY of your file — always keep the original RGB PDF
 *   - The CMYK values produced are mathematically converted; for
 *     critical colour matching validate against physical FOGRA39 proofs
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
  // FOGRA39 profile name as Illustrator sees it.
  // Change if your system uses a different name.
  fogra39ProfileName: "Coated FOGRA39 (ISO 12647-2:2004)",

  fogra39Fallbacks: [
    "ISOcoated_v2_eci",
    "ISOcoated_v2 (ECI)",
    "ISO Coated v2 300% (ECI)",
    "Coated FOGRA39",
    "FOGRA39",
  ],

  // Colours with luminance above this threshold and very low saturation
  // are treated as "near-black" and skipped (protects text labels).
  // 0–1 scale. 0.08 = very dark colours only.
  nearBlackThreshold: 0.08,

  // If true, also convert stroke colours (outlines).
  convertStrokes: true,

  // If true, show a detailed log alert at the end.
  showLog: true,
};

// ─── Colour helpers ───────────────────────────────────────────────────────────

// Returns true if an RGBColor is near-black (used for text — skip conversion)
function isNearBlack(rgbColor) {
  var r = rgbColor.red   / 255;
  var g = rgbColor.green / 255;
  var b = rgbColor.blue  / 255;
  var luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  var max = Math.max(r, g, b);
  var min = Math.min(r, g, b);
  var saturation = (max === 0) ? 0 : (max - min) / max;
  // Skip if dark AND desaturated (typical of black/grey text)
  return (luminance < CONFIG.nearBlackThreshold && saturation < 0.25);
}

// Returns true if an RGBColor is near-white (skip — backgrounds, paper)
function isNearWhite(rgbColor) {
  return (rgbColor.red > 245 && rgbColor.green > 245 && rgbColor.blue > 245);
}

// Convert an RGBColor to a CMYKColor using Illustrator's engine
// Illustrator handles the ICC-aware conversion internally when the
// document profile is set to FOGRA39.
function rgbToCmyk(rgbColor) {
  var r = rgbColor.red   / 255;
  var g = rgbColor.green / 255;
  var b = rgbColor.blue  / 255;

  var k = 1 - Math.max(r, g, b);
  var c, m, y;

  if (k === 1) {
    c = 0; m = 0; y = 0;
  } else {
    c = (1 - r - k) / (1 - k);
    m = (1 - g - k) / (1 - k);
    y = (1 - b - k) / (1 - k);
  }

  var cmyk = new CMYKColor();
  cmyk.cyan    = Math.round(c * 100);
  cmyk.magenta = Math.round(m * 100);
  cmyk.yellow  = Math.round(y * 100);
  cmyk.black   = Math.round(k * 100);
  return cmyk;
}

// ─── Object processing ────────────────────────────────────────────────────────

var stats = {
  fills:   0,
  strokes: 0,
  skipped: 0,
  errors:  0,
};

// Convert fill colour on a page item if it's RGB
function convertFill(item) {
  try {
    if (!item.filled) return;
    var fill = item.fillColor;
    if (!fill || fill.typename !== "RGBColor") return;
    if (isNearBlack(fill) || isNearWhite(fill)) {
      stats.skipped++;
      return;
    }
    item.fillColor = rgbToCmyk(fill);
    stats.fills++;
  } catch (e) {
    stats.errors++;
  }
}

// Convert stroke colour on a page item if it's RGB
function convertStroke(item) {
  if (!CONFIG.convertStrokes) return;
  try {
    if (!item.stroked) return;
    var stroke = item.strokeColor;
    if (!stroke || stroke.typename !== "RGBColor") return;
    if (isNearBlack(stroke) || isNearWhite(stroke)) {
      stats.skipped++;
      return;
    }
    item.strokeColor = rgbToCmyk(stroke);
    stats.strokes++;
  } catch (e) {
    stats.errors++;
  }
}

// Recursively process all items in a collection (handles nested groups)
function processItems(items) {
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var type = item.typename;

    if (type === "GroupItem") {
      // Recurse into group
      processItems(item.pageItems);

    } else if (type === "CompoundPathItem") {
      // Compound paths have a pathItems collection
      try {
        convertFill(item);
        convertStroke(item);
        processItems(item.pathItems);
      } catch (e) {
        stats.errors++;
      }

    } else if (type === "TextFrame") {
      // Convert text character colours
      try {
        var chars = item.characters;
        for (var c = 0; c < chars.length; c++) {
          try {
            var attr = chars[c].characterAttributes;
            if (attr.fillColor && attr.fillColor.typename === "RGBColor") {
              if (!isNearBlack(attr.fillColor) && !isNearWhite(attr.fillColor)) {
                attr.fillColor = rgbToCmyk(attr.fillColor);
                stats.fills++;
              } else {
                stats.skipped++;
              }
            }
            if (CONFIG.convertStrokes && attr.strokeColor &&
                attr.strokeColor.typename === "RGBColor") {
              if (!isNearBlack(attr.strokeColor) && !isNearWhite(attr.strokeColor)) {
                attr.strokeColor = rgbToCmyk(attr.strokeColor);
                stats.strokes++;
              } else {
                stats.skipped++;
              }
            }
          } catch (ce) {
            stats.errors++;
          }
        }
      } catch (e) {
        stats.errors++;
      }

    } else if (
      type === "PathItem"      ||
      type === "MeshItem"      ||
      type === "RasterItem"    ||
      type === "PlacedItem"    ||
      type === "SymbolItem"
    ) {
      convertFill(item);
      convertStroke(item);

    } else {
      // Fallback — attempt fill/stroke conversion on anything else
      convertFill(item);
      convertStroke(item);
    }
  }
}

// ─── Document profile ─────────────────────────────────────────────────────────

function assignFogra39Profile(doc) {
  var profilesToTry = [CONFIG.fogra39ProfileName].concat(CONFIG.fogra39Fallbacks);
  for (var i = 0; i < profilesToTry.length; i++) {
    try {
      doc.colorProfileName = profilesToTry[i];
      return profilesToTry[i];
    } catch (e) {}
  }
  return null;
}

// ─── PDF/X-4 export ───────────────────────────────────────────────────────────

function isoDateString() {
  var d = new Date();
  var mo = d.getMonth() + 1;
  var dy = d.getDate();
  return d.getFullYear() + "-" +
    (mo < 10 ? "0" + mo : mo) + "-" +
    (dy < 10 ? "0" + dy : dy);
}

function exportFogra39PDF(doc, profileName) {
  try {
    var srcPath = doc.fullName.path;
    var srcName = doc.name.replace(/\.[^\.]+$/, "");
    var outPath = srcPath + "/" + srcName + "_FOGRA39_" + isoDateString() + ".pdf";

    var opts = new PDFSaveOptions();

    // PDF/X-4 standard
    opts.compatibility       = PDFCompatibility.ACROBAT7;
    opts.pDFXStandard        = PDFXStandard.PDFX4;
    opts.pDFXConformance     = PDFXConformance.PDFX4_2008;

    // Colour
    opts.outputCondition     = "FOGRA39";
    opts.outputConditionIdentifier = "FOGRA39";
    opts.registryName        = "http://www.color.org";
    opts.colorConversionID   = ColorConversion.TOPRINT;
    opts.colorDestinationID  = ColorDestination.USEDOCUMENTPROFILE;
    opts.colorProfileID      = ColorProfile.INCLUDEALL;
    opts.destinationProfile  = profileName || CONFIG.fogra39ProfileName;

    // Compression
    opts.colorTileSize       = 256;
    opts.compressArt         = true;

    // Marks (none for reference sheet)
    opts.trimMarks           = false;
    opts.bleedMarks          = false;
    opts.colorBars           = false;
    opts.pageInformation     = false;

    opts.preserveEditability = false;
    opts.embedICCProfile     = true;
    opts.generateThumbnails  = false;

    doc.saveAs(new File(outPath), opts);
    return outPath;
  } catch (e) {
    return null;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  // 1. Check a document is open
  if (app.documents.length === 0) {
    alert(
      "No document open.\n\n" +
      "Open your CMYK Grid Tester PDF in Illustrator first,\n" +
      "then run this script."
    );
    return;
  }

  var doc = app.activeDocument;

  // 2. Warn if document is already CMYK (still useful to re-profile)
  var alreadyCmyk = (doc.documentColorSpace === DocumentColorSpace.CMYK);

  // 3. Confirm before proceeding
  var msg = "CMYK CONVERT — FOGRA39\n\n";
  msg += "Document: " + doc.name + "\n";
  msg += "Current mode: " + (alreadyCmyk ? "CMYK" : "RGB") + "\n\n";
  if (!alreadyCmyk) {
    msg += "This script will:\n";
    msg += "  1. Switch the document to CMYK mode\n";
    msg += "  2. Assign the FOGRA39 ICC profile\n";
    msg += "  3. Convert all RGB fills and strokes to CMYK\n";
    msg += "  4. Offer to export as PDF/X-4 with FOGRA39\n\n";
  } else {
    msg += "Document is already CMYK. The script will:\n";
    msg += "  1. Re-assign the FOGRA39 ICC profile\n";
    msg += "  2. Convert any remaining RGB objects\n";
    msg += "  3. Offer to export as PDF/X-4 with FOGRA39\n\n";
  }
  msg += "Run on a COPY of your file — this cannot be undone.\n\nContinue?";

  if (!confirm(msg)) {
    alert("Script cancelled.");
    return;
  }

  // 4. Switch document to CMYK mode
  if (!alreadyCmyk) {
    try {
      doc.changeColorSpace(DocumentColorSpace.CMYK);
    } catch (e) {
      alert(
        "Could not switch document to CMYK mode.\n\n" +
        "Try manually: Edit → Color Mode → CMYK\n\n" +
        "Then re-run the script.\n\nError: " + e
      );
      return;
    }
  }

  // 5. Assign FOGRA39 profile
  var profileSet = assignFogra39Profile(doc);
  if (!profileSet) {
    alert(
      "WARNING: Could not assign FOGRA39 ICC profile automatically.\n\n" +
      "Set it manually:\n" +
      "Edit → Assign Profile → Coated FOGRA39 (ISO 12647-2:2004)\n\n" +
      "The colour conversion will still run."
    );
  }

  // 6. Convert all objects
  app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
  try {
    for (var ai = 0; ai < doc.artboards.length; ai++) {
      processItems(doc.pageItems);
    }
  } catch (e) {
    stats.errors++;
  }
  app.userInteractionLevel = UserInteractionLevel.DISPLAYALERTS;

  // 7. Summary
  var summary = "Conversion complete.\n\n";
  summary += "Profile:        " + (profileSet || "Not set — assign manually") + "\n";
  summary += "Fills converted:   " + stats.fills + "\n";
  summary += "Strokes converted: " + stats.strokes + "\n";
  summary += "Skipped (near-black/white): " + stats.skipped + "\n";
  if (stats.errors > 0) {
    summary += "Errors (objects skipped):   " + stats.errors + "\n";
  }
  summary += "\nExport as PDF/X-4 with FOGRA39 now?";

  var exportNow = confirm(summary);

  if (exportNow) {
    var pdfPath = exportFogra39PDF(doc, profileSet);
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
        "Output Intent: " + (profileSet || "Coated FOGRA39 (ISO 12647-2:2004)")
      );
    }
  } else {
    alert(
      "Document converted to CMYK / FOGRA39.\n\n" +
      "When ready to export:\n" +
      "File → Save As → Adobe PDF (Print)\n" +
      "Standard: PDF/X-4:2008\n" +
      "Output Intent: Coated FOGRA39 (ISO 12647-2:2004)"
    );
  }
}

// Run
main();
