// ============================================================
//  ocr/pythonBridge.js — Bridge to Python passport_ocr_master.py
// ============================================================

const { execFile } = require('child_process');
const path         = require('path');
const fs           = require('fs');
const os           = require('os');

const SCRIPT_PATH  = path.resolve(__dirname, '..', '..', 'passport_ocr_master.py');
const PYTHON_CMD   = process.env.PYTHON_CMD || 'python';

/**
 * Runs Python script asynchronously with argument array and returns parsed JSON.
 */
function runPython(args) {
  return new Promise((resolve, reject) => {
    execFile(PYTHON_CMD, [SCRIPT_PATH, ...args], { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
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

  const ext = (mediaData.mimetype || 'image/jpeg').split('/')[1]?.split(';')[0] || 'jpg';
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
async function confirmPassportWithGemini(passportNumber, englishData = null) {
  const args = ['confirm', passportNumber];
  if (englishData) {
    args.push(JSON.stringify(englishData));
  }
  return await runPython(args);
}

module.exports = {
  processPassportWithGemini,
  processTicketWithGemini,
  confirmPassportWithGemini,
};
