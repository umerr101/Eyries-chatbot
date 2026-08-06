// ============================================================
//  router.js — Main message router (whatsapp-web.js version)
//  Returns reply strings directly (no Twilio client needed)
// ============================================================

const { getSession, updateSession, resetSession } = require('./stateManager');
const { handleVisaFlow }       = require('./flows/visaFlow');
const { handleTransportFlow }  = require('./flows/transportFlow');
const { extractPassportData }  = require('./ocr/passport');
const { translateNames }       = require('./translation/arabic');
const msg                      = require('./utils/messageBuilder');

/**
 * Main router — called for every incoming message.
 * @param {string} phone      - WhatsApp ID e.g. "923001234567@c.us"
 * @param {string} body       - Message text
 * @param {object|null} media - MessageMedia object (for passport images)
 * @returns {string|string[]} - Reply message(s) to send
 */
async function routeMessage(phone, body, media) {
  const session = getSession(phone);
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
    if (result && typeof result === 'object' && result.type === 'OCR_TRIGGER') {
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
 * Runs OCR on the passport media, translates names,
 * and returns an array of messages to send sequentially.
 */
async function ocrAndBuildReplies(phone, mediaData) {
  const replies = [msg.processingMessage()];

  try {
    // Save image to temp file and run OCR
    const data = await extractPassportData(mediaData);

    // Check if enough data was extracted
    const detected = [data.firstName, data.lastName, data.passportNumber, data.expiryDate]
      .filter(v => v && v !== 'Not detected').length;

    if (detected < 2) {
      updateSession(phone, { step: 'AWAIT_PASSPORT' });
      replies.push(msg.ocrFailedMessage());
      return replies;
    }

    // Translate names to Arabic
    const { firstNameAr, lastNameAr } = await translateNames(data.firstName, data.lastName);

    // Save to session and move to confirmation step
    updateSession(phone, {
      step: 'PASSPORT_CONFIRM',
      passportData: data,
    });

    replies.push(msg.passportConfirmationMessage(data, firstNameAr, lastNameAr));
  } catch (err) {
    console.error('[OCR] Error:', err.message);
    updateSession(phone, { step: 'AWAIT_PASSPORT' });
    replies.push(msg.ocrFailedMessage());
  }

  return replies;
}

module.exports = { routeMessage };
