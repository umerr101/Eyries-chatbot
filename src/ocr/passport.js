// ============================================================
//  ocr/passport.js — Gemini 2.0 Vision Passport OCR
//  Delegates extraction to Python passport_ocr_master.py module
// ============================================================

const { processPassportWithGemini, processTicketWithGemini } = require('./pythonBridge');

/**
 * Runs Gemini Vision OCR via passport_ocr_master.py
 * @param {object} mediaData - whatsapp-web.js MessageMedia object ({ data, mimetype })
 */
async function extractPassportData(mediaData) {
  try {
    const result = await processPassportWithGemini(mediaData);
    if (result && result.validity_error) {
      return {
        isValidityError: true,
        errorMessage: result.whatsapp_message
      };
    }
    if (!result || !result.success || !result.record) {
      throw new Error(result?.error || 'OCR processing failed');
    }

    const rec = result.record;
    return {
      firstName: rec.first_name || 'Not detected',
      lastName: rec.last_name || 'Not detected',
      passportNumber: (rec.passport_number || 'Not detected').toUpperCase(),
      nationality: rec.nationality || 'Not detected',
      dob: rec.date_of_birth || 'Not detected',
      issueDate: rec.date_of_issue || 'Not detected',
      expiryDate: rec.date_of_expiry || 'Not detected',
    };
  } catch (err) {
    console.error('[OCR] Gemini OCR Error:', err.message);
    throw err;
  }
}

/**
 * Runs Gemini Vision Ticket OCR via passport_ocr_master.py
 * @param {object} mediaData - whatsapp-web.js MessageMedia object ({ data, mimetype })
 */
async function extractTicketData(mediaData) {
  try {
    const result = await processTicketWithGemini(mediaData);
    if (result && result.success) {
      return {
        isValid: true,
        departureDate: result.departure_date,
        formattedDate: result.formatted_date,
        message: result.whatsapp_message
      };
    }
    return {
      isValid: false,
      errorMessage: result?.error || result?.whatsapp_message || 'Could not read ticket booking details.'
    };
  } catch (err) {
    console.error('[Ticket OCR] Error:', err.message);
    return {
      isValid: false,
      errorMessage: '❌ *Could not process ticket booking image.* Please upload a clear picture of your ticket.'
    };
  }
}

module.exports = { extractPassportData, extractTicketData };
