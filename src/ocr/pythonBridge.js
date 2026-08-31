// ============================================================
//  ocr/pythonBridge.js — Bridge to Python passport_ocr_master.py
// ============================================================

const { execFile } = require('child_process');
const path         = require('path');
const fs           = require('fs');
const os           = require('os');

const SCRIPT_PATH  = path.resolve(__dirname, '..', '..', 'passport_ocr_master.py');
const PYTHON_CMD   = process.env.PYTHON_CMD || 'python';

const { AGENCY }    = require('../config');

/**
 * Runs Python script asynchronously with argument array and returns parsed JSON.
 */
function runPython(args) {
  return new Promise((resolve, reject) => {
    const customEnv = { ...process.env };
    if (AGENCY && AGENCY.geminiApiKey) {
      customEnv.CLIENT_GEMINI_KEY = AGENCY.geminiApiKey;
    }
    execFile(PYTHON_CMD, [SCRIPT_PATH, ...args], { maxBuffer: 10 * 1024 * 1024, env: customEnv }, (error, stdout, stderr) => {
      if (stderr) {
        console.warn('[PythonBridge stderr]:', stderr);
      }

      if (error) {
        console.error('[PythonBridge exec error]:', error.message);
        return reject(error);
      }

      try {
        const trimmed = (stdout || '').trim();
        if (!trimmed) {
          return reject(new Error('Empty stdout from Python script'));
        }
        const parsed = JSON.parse(trimmed);
        resolve(parsed);
      } catch (parseErr) {
        console.error('[PythonBridge JSON parse error]:', parseErr.message, 'raw stdout:', stdout);
        reject(parseErr);
      }
    });
  });
}

/**
 * Saves MessageMedia base64 data to a temp file and runs Gemini OCR via Python.
 */
async function processPassportWithGemini(mediaData) {
  if (!mediaData || !mediaData.data) {
    throw new Error('No media data provided for OCR');
  }

  const ext = (mediaData.mimetype || 'image/jpeg').split('/')[1]?.split(';')[0] || 'jpg';
  const tmpPath = path.join(os.tmpdir(), `passport_${Date.now()}.${ext}`);

  try {
    const buffer = Buffer.from(mediaData.data, 'base64');
    fs.writeFileSync(tmpPath, buffer);
    console.log(`[PythonBridge] Temp file saved for OCR: ${tmpPath}`);

    const result = await runPython(['ocr', tmpPath]);
    return result;
  } finally {
    if (fs.existsSync(tmpPath)) {
      try { fs.unlinkSync(tmpPath); } catch (_) {}
    }
  }
}

/**
 * Saves MessageMedia base64 data to a temp file and runs Ticket OCR via Python.
 */
async function processTicketWithGemini(mediaData) {
  if (!mediaData || !mediaData.data) {
    throw new Error('No media data provided for Ticket OCR');
  }

  let ext = (mediaData.mimetype || 'image/jpeg').split('/')[1]?.split(';')[0] || 'jpg';
  if ((mediaData.mimetype && mediaData.mimetype.includes('pdf')) || (mediaData.filename && mediaData.filename.endsWith('.pdf'))) {
    ext = 'pdf';
  }
  const tmpPath = path.join(os.tmpdir(), `ticket_${Date.now()}.${ext}`);

  try {
    const buffer = Buffer.from(mediaData.data, 'base64');
    fs.writeFileSync(tmpPath, buffer);
    console.log(`[PythonBridge] Temp ticket file saved for OCR: ${tmpPath}`);

    const result = await runPython(['ticket_ocr', tmpPath]);
    return result;
  } finally {
    if (fs.existsSync(tmpPath)) {
      try { fs.unlinkSync(tmpPath); } catch (_) {}
    }
  }
}

/**
 * Confirms record, translates to Arabic script, updates passports.db, and exports Master_Passports.xlsx.
 */
async function confirmPassportWithGemini(passportNumber, englishData = null, phone = '', requestId = '') {
  const args = ['confirm', passportNumber];
  if (englishData) {
    args.push(JSON.stringify(englishData));
  } else {
    args.push('{}');
  }
  if (phone) {
    args.push(String(phone));
  } else {
    args.push('');
  }
  if (requestId) {
    args.push(String(requestId));
  } else {
    args.push('');
  }
  return await runPython(args);
}

/**
 * Generates an isolated Master_Passports.xlsx file containing ONLY the passports for the given request ID / order window.
 */
async function exportExcelForWindow(requestIdOrPhone = null, passengersList = null) {
  const args = ['export_excel'];
  if (requestIdOrPhone) {
    args.push(String(requestIdOrPhone));
  } else {
    args.push('ALL');
  }
  if (passengersList && Array.isArray(passengersList) && passengersList.length > 0) {
    args.push(JSON.stringify(passengersList));
  }
  return await runPython(args);
}

module.exports = {
  processPassportWithGemini,
  processTicketWithGemini,
  confirmPassportWithGemini,
  exportExcelForWindow,
};
