// ============================================================
//  router.js — Main message router (whatsapp-web.js version)
//  Returns reply strings directly (no Twilio client needed)
// ============================================================

const crypto                     = require('crypto');
const { getSession, updateSession, resetSession } = require('./stateManager');
const { handleVisaFlow }       = require('./flows/visaFlow');
const { handleTransportFlow }  = require('./flows/transportFlow');
const { extractPassportData }  = require('./ocr/passport');
const msg                      = require('./utils/messageBuilder');

/**
 * Main router — called for every incoming message.
 * @param {string} phone      - WhatsApp ID e.g. "923001234567@c.us"
 * @param {string} body       - Message text
 * @param {object|null} media - MessageMedia object (for passport images)
 * @returns {string|string[]} - Reply message(s) to send
 */
async function routeMessage(phone, body, media) {
  let session = getSession(phone);
  const text    = (body || '').trim().toUpperCase();

  // ── Global reset commands ─────────────────────────────────
  if (['HI', 'HELLO', 'START', 'MENU', 'RESTART', 'MAIN MENU', 'MARHABA', 'السلام'].includes(text) ||
      text === '') {
    // Only reset on greeting if not mid-flow waiting for passport
    if (text !== '' || session.step !== 'AWAIT_PASSPORT') {
      resetSession(phone);
      return msg.mainMenu();
    }
  }

  // Re-read session after any potential reset above so flow checks are accurate
  session = getSession(phone);

  // ── FLOW: Main Menu ───────────────────────────────────────
  if (session.flow === 'MAIN_MENU') {
    if (text === '1') {
      updateSession(phone, { flow: 'VISA', step: 'VISA_TYPE' });
      return msg.visaTypeMenu();
    }
    if (text === '2') {
      updateSession(phone, { flow: 'TRANSPORT', step: 'TRANSPORT_ROUTE' });
      return msg.transportRouteMenu();
    }
    if (text === '3') {
      return msg.ticketingEscalation();
    }
    if (text === '4') {
      return msg.helplineEscalation();
    }
    return msg.mainMenu();
  }

  // ── FLOW: Visa ────────────────────────────────────────────
  if (session.flow === 'VISA') {
    const result = await handleVisaFlow(phone, session, body, media);

    // OCR_TRIGGER: need to run OCR and send multiple messages
    if (result && typeof result === 'object' && !Array.isArray(result) && result.type === 'OCR_TRIGGER') {
      return ocrAndBuildReplies(phone, result.media);
    }

    return result;
  }

  // ── FLOW: Transport ───────────────────────────────────────
  if (session.flow === 'TRANSPORT') {
    return handleTransportFlow(phone, session, body);
  }

  // ── Fallback ──────────────────────────────────────────────
  resetSession(phone);
  return msg.mainMenu();
}

/**
 * Runs Gemini Vision OCR on the passport media, stages pending record in SQLite,
 * and returns the response message to send.
 */
async function ocrAndBuildReplies(phone, mediaData) {
  const session = getSession(phone);
  const currIndex = session.currentPassengerIndex || 1;
  const totalCount = session.passengerCount || 1;

  // ── Duplicate Image Check ──────────────────────────────────────
  const imageHash = crypto.createHash('md5').update(mediaData?.data || '').digest('hex');
  const uploadedHashes = session.uploadedImageHashes || [];

  if (uploadedHashes.includes(imageHash)) {
    updateSession(phone, { step: 'AWAIT_PASSPORT' });
    return (
      `⚠️ *You have already uploaded this passport picture.*\n\n` +
      `Please send a photo of the next passenger's passport (Passport ${currIndex} of ${totalCount}).` +
      msg.mainMenuFooter()
    );
  }

  try {
    // Run Gemini OCR via pythonBridge
    const data = await extractPassportData(mediaData);

    // If 6-month validity check failed
    if (data && data.isValidityError) {
      updateSession(phone, { step: 'AWAIT_PASSPORT' });
      return data.errorMessage;
    }

    // Check if enough data was extracted
    const detected = [data.firstName, data.lastName, data.passportNumber, data.expiryDate]
      .filter(v => v && v !== 'Not detected').length;

    if (detected < 2) {
      updateSession(phone, { step: 'AWAIT_PASSPORT' });
      return msg.ocrFailedMessage();
    }

    // ── Duplicate Passport Number Check ────────────────────────────
    const scannedPassports = session.scannedPassportNumbers || [];
    const passportNo = (data.passportNumber || '').toUpperCase();

    if (passportNo && scannedPassports.includes(passportNo)) {
      updateSession(phone, { step: 'AWAIT_PASSPORT' });
      return (
        `⚠️ *Passport number (${passportNo}) has already been uploaded for another passenger in this request.*\n\n` +
        `Please send a photo of the next passenger's passport (Passport ${currIndex} of ${totalCount}).` +
        msg.mainMenuFooter()
      );
    }

    // Save imageHash to pending session state
    updateSession(phone, {
      step: 'PASSPORT_CONFIRM',
      passportData: data,
      pendingImageHash: imageHash,
    });

    return msg.passportConfirmationMessage(data, currIndex, totalCount);
  } catch (err) {
    console.error('[OCR] Gemini OCR Error:', err.message);
    updateSession(phone, { step: 'AWAIT_PASSPORT' });
    return msg.ocrFailedMessage();
  }
}

module.exports = { routeMessage };
