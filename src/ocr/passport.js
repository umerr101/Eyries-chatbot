// ============================================================
//  ocr/passport.js — Tesseract.js OCR + field extraction
//  Accepts whatsapp-web.js MessageMedia object (base64 data)
//  Optimised for Pakistani passport MRZ
// ============================================================

const Tesseract = require('tesseract.js');
const fs        = require('fs');
const path      = require('path');
const os        = require('os');
const sharp     = require('sharp');

/**
 * Saves a whatsapp-web.js MessageMedia object to a temp file.
 */
async function saveMediaToTemp(mediaData) {
  if (!mediaData || !mediaData.data) {
    throw new Error('Invalid media data — no base64 content');
  }
  const ext     = (mediaData.mimetype || 'image/jpeg').split('/')[1]?.split(';')[0] || 'jpg';
  const tmpPath = path.join(os.tmpdir(), `passport_${Date.now()}.${ext}`);
  const buffer  = Buffer.from(mediaData.data, 'base64');
  
  // Pre-process image with sharp for better OCR accuracy
  const processedBuffer = await sharp(buffer)
    .grayscale()
    .normalize() // Stretch contrast
    .linear(1.5, -0.2) // Increase contrast further
    .toBuffer();

  fs.writeFileSync(tmpPath, processedBuffer);
  console.log(`[OCR] Saved pre-processed temp file: ${tmpPath} (${processedBuffer.length} bytes)`);
  return tmpPath;
}

/**
 * Runs Tesseract OCR and extracts passport fields.
 * @param {object} mediaData - whatsapp-web.js MessageMedia object
 */
async function extractPassportData(mediaData) {
  let tmpPath = null;

  try {
    tmpPath = await saveMediaToTemp(mediaData);

    // Run OCR in English — best for MRZ characters
    const { data: { text } } = await Tesseract.recognize(tmpPath, 'eng', {
      logger: () => {},
    });

    console.log('[OCR] Raw extracted text:\n---\n' + text + '\n---');

    const fields = parsePassportText(text);
    console.log('[OCR] Parsed fields:', JSON.stringify(fields));
    return fields;

  } finally {
    if (tmpPath && fs.existsSync(tmpPath)) {
      fs.unlinkSync(tmpPath);
    }
  }
}

/**
 * Parses OCR text to extract all 5 passport fields.
 * Strategy: MRZ first (most reliable), then keyword scan, then date patterns.
 */
function parsePassportText(rawText) {
  // Normalize: remove common OCR noise in MRZ lines
  const text  = rawText.replace(/[|\\]/g, '<').replace(/0/g, 'O');
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

  let firstName      = null;
  let lastName       = null;
  let passportNumber = null;
  let issueDate      = null;
  let expiryDate     = null;

  // ── STRATEGY 1: MRZ Line Parsing ─────────────────────────────────────────
  // Pakistani passport MRZ:
  // Line 1: P<PAKSURNAME<<FIRSTNAME<MIDDLENAME<<<<<<<<<<<<
  // Line 2: AB1234567<8PAK8501011M2601011<<<<<<<<<<<<<<<4
  //
  // Find lines that look like MRZ (long lines with < characters)
  const mrzCandidates = lines.filter(l => {
    const clean = l.replace(/\s/g, '');
    return clean.length >= 30 && (clean.match(/</g) || []).length >= 3;
  });

  // Try to identify MRZ Line 1 and Line 2
  let mrz1 = null;
  let mrz2 = null;

  for (const line of mrzCandidates) {
    const clean = line.replace(/\s/g, '').toUpperCase();
    // MRZ Line 1 starts with P< and has country code
    if (/^P[<A-Z][A-Z]{3}/.test(clean) && clean.length >= 40) {
      mrz1 = clean;
    }
    // MRZ Line 2: starts with alphanumeric, has digits in positions 13-18 (DOB)
    else if (/^[A-Z0-9<]{9}[0-9][A-Z]{3}[0-9]{6}/.test(clean) && clean.length >= 40) {
      mrz2 = clean;
    }
  }

  // Also try the bottom lines of the image (MRZ is always at the bottom)
  if (!mrz1 || !mrz2) {
    const lastLines = lines.slice(-10);
    for (const line of lastLines) {
      const clean = line.replace(/\s/g, '').toUpperCase()
        .replace(/[|l1]/g, 'I')  // fix common OCR confusions in MRZ
        .replace(/[O0]/g, '0');
      if (!mrz1 && /^P.{3}/.test(clean) && clean.length >= 30) {
        mrz1 = clean;
      }
      if (!mrz2 && clean.length >= 30 && /[0-9]{6}/.test(clean)) {
        mrz2 = clean;
      }
    }
  }

  console.log('[OCR] MRZ Line 1:', mrz1);
  console.log('[OCR] MRZ Line 2:', mrz2);

  // Parse MRZ Line 1 for name
  if (mrz1) {
    try {
      // Skip "P<PAK" (5 chars) then get the name section
      const nameSection = mrz1.substring(5);
      const doubleBracket = nameSection.indexOf('<<');
      if (doubleBracket !== -1) {
        lastName  = nameSection.substring(0, doubleBracket).replace(/</g, ' ').trim();
        const givenPart = nameSection.substring(doubleBracket + 2);
        firstName = givenPart.split('<')[0].trim();
      }
    } catch (e) {
      console.error('[OCR] MRZ1 parse error:', e.message);
    }
  }

  // Parse MRZ Line 2 for passport number and expiry
  if (mrz2) {
    try {
      // Clean up for parsing — replace O with 0 in numeric areas
      // Passport number: chars 0–8 (9 digits/letters)
      const pnRaw = mrz2.substring(0, 9).replace(/</g, '').trim();
      if (pnRaw.length >= 5) passportNumber = pnRaw;

      // Expiry date: chars 21–26 (YYMMDD)
      const expiryRaw = mrz2.substring(21, 27).replace(/[OI]/g, match => match === 'O' ? '0' : '1');
      if (/^\d{6}$/.test(expiryRaw)) {
        expiryDate = formatMrzDate(expiryRaw);
      }

      // Birth date: chars 13–18 (not required but useful)
      const birthRaw = mrz2.substring(13, 19).replace(/[OI]/g, match => match === 'O' ? '0' : '1');
      // (Not needed per spec, but we could derive issue date from it)
    } catch (e) {
      console.error('[OCR] MRZ2 parse error:', e.message);
    }
  }

  // ── STRATEGY 2: Keyword-based field scan ──────────────────────────────────
  for (const line of lines) {
    const upper = line.toUpperCase();

    // Name fields
    if (!lastName && upper.match(/SURNAME|LAST.?NAME/)) {
      const val = line.split(/[:\-\/]/)[1];
      if (val) lastName = val.trim();
    }
    if (!firstName && upper.match(/GIVEN.?NAME|FIRST.?NAME|FORENAME/)) {
      const val = line.split(/[:\-\/]/)[1];
      if (val) firstName = val.trim();
    }

    // Passport number
    if (!passportNumber && upper.match(/PASSPORT.?(NO|NUMBER|#)/)) {
      const m = line.match(/([A-Z]{1,2}\d{6,8}|\d{8,9})/);
      if (m) passportNumber = m[1];
    }

    // Dates with keywords
    const dateInLine = line.match(/(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4}|\d{4}[\/\-\.]\d{2}[\/\-\.]\d{2}|\d{2}\s+\w{3}\s+\d{4})/);
    if (dateInLine) {
      if (!issueDate && upper.match(/DATE.OF.ISSUE|ISSUE.DATE|DATE.D.EMISSION/)) {
        issueDate = dateInLine[1];
      }
      if (!expiryDate && upper.match(/DATE.OF.EXPIRY|EXPIRY|EXPIRATION|VALID.UNTIL/)) {
        expiryDate = dateInLine[1];
      }
    }
  }

  // ── STRATEGY 3: Regex passport number fallback ────────────────────────────
  if (!passportNumber) {
    // Pakistani passports: letters + numbers e.g. AB1234567
    const pnMatch = rawText.match(/\b([A-Z]{1,2}\d{6,8})\b/);
    if (pnMatch) passportNumber = pnMatch[1];
  }

  // ── STRATEGY 4: Date fallback (find all date patterns) ───────────────────
  if (!issueDate || !expiryDate) {
    const datePattern = /\b(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})\b/g;
    const allDates    = [...rawText.matchAll(datePattern)].map(m => m[1]);
    if (!issueDate  && allDates[0]) issueDate  = allDates[0];
    if (!expiryDate && allDates[1]) expiryDate = allDates[1];
  }

  return {
    firstName:      capitalize(clean(firstName)  || 'Not detected'),
    lastName:       capitalize(clean(lastName)   || 'Not detected'),
    passportNumber: (passportNumber              || 'Not detected').toUpperCase(),
    issueDate:      issueDate                     || 'Not detected',
    expiryDate:     expiryDate                    || 'Not detected',
  };
}

// ── Helpers ──────────────────────────────────────────────────

function clean(str) {
  if (!str) return null;
  return str.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim() || null;
}

function formatMrzDate(yymmdd) {
  const yy       = parseInt(yymmdd.substring(0, 2), 10);
  const mm       = yymmdd.substring(2, 4);
  const dd       = yymmdd.substring(4, 6);
  const fullYear = yy <= 30 ? `20${String(yy).padStart(2, '0')}` : `19${String(yy).padStart(2, '0')}`;
  return `${dd}/${mm}/${fullYear}`;
}

function capitalize(str) {
  if (!str) return str;
  return str.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

module.exports = { extractPassportData };
