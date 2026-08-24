// ============================================================
//  router.js — Main message router (whatsapp-web.js version)
//  Returns reply strings directly (no Twilio client needed)
// ============================================================

const fs                         = require('fs');
const path                       = require('path');
const crypto                     = require('crypto');
const { getSession, updateSession, resetSession } = require('./stateManager');
const { handleVisaFlow }       = require('./flows/visaFlow');
const { handleTransportFlow }  = require('./flows/transportFlow');
const { handleHotelFlow }      = require('./flows/hotelFlow');
const { handlePackageFlow }    = require('./flows/packageFlow');
const { extractPassportData, extractTicketData }  = require('./ocr/passport');
const msg                      = require('./utils/messageBuilder');

/**
 * Main router function. Takes phone number, raw message body, and optional media object.
 * Returns reply string OR array of strings to send sequentially.
 */
async function routeMessage(phone, body, media) {
  let session = getSession(phone);
  const text    = (body || '').trim().toUpperCase();
  const isMediaUpload = !!media;

  // ── Global reset commands ─────────────────────────────────
  if (['HI', 'HELLO', 'START', 'MENU', 'RESTART', 'MAIN MENU', 'MARHABA', 'السلام'].includes(text) ||
      (text === '' && !isMediaUpload)) {
    resetSession(phone);
    return msg.mainMenu();
  }

  // Re-read session after any potential reset above so flow checks are accurate
  session = getSession(phone);

  // ── STEP: Payment Receipt Upload Check ────────────────────
  if (session.step === 'AWAIT_PAYMENT_RECEIPT') {
    if (isMediaUpload) {
      updateSession(phone, {
        step: 'AWAIT_ACCOUNTS_VERIFICATION',
        paymentReceiptUploaded: true,
        paymentReceiptMedia: media
      });
      const { saveBookingOrder } = require('./stateManager');
      if (session.voucherId) {
        saveBookingOrder(session.voucherId, phone, getSession(phone), 'AWAIT_ACCOUNTS_VERIFICATION');
      }
      return (
        `📸 *Payment Transfer Receipt Submitted!*\n\n` +
        `Thank you! Your payment receipt has been submitted to our Accounts Department (+923180978480) for verification.\n\n` +
        `Once verified, your official *CONFIRMED* travel itinerary voucher will be delivered to you here automatically.` +
        msg.MENU_FOOTER
      );
    }
    return (
      `📸 *Payment Receipt Required*\n\n` +
      `Please reply by uploading a clear photo or PDF document of your *payment transfer receipt / screenshot* to submit for Accounts verification.` +
      msg.MENU_FOOTER
    );
  }

  // ── DELAYED RECEIPT INTERCEPTOR ───────────────────────────
  // If user uploaded an image/document while in MAIN_MENU or IDLE (i.e. NOT in an active flow like HOTEL, VISA, or PACKAGE),
  // check if they have a pending order in persistent storage!
  if (isMediaUpload && (session.flow === 'MAIN_MENU' || !session.flow || session.step === 'IDLE')) {
    const { getLatestPendingOrder, saveBookingOrder } = require('./stateManager');
    const pendingOrder = getLatestPendingOrder(phone);
    if (pendingOrder) {
      console.log(`[Router] Delayed receipt intercepted for Voucher ID: ${pendingOrder.voucherId}`);
      updateSession(phone, {
        ...pendingOrder.sessionData,
        step: 'AWAIT_ACCOUNTS_VERIFICATION',
        paymentReceiptUploaded: true,
        paymentReceiptMedia: media,
        status: 'AWAIT_ACCOUNTS_VERIFICATION'
      });
      saveBookingOrder(pendingOrder.voucherId, phone, getSession(phone), 'AWAIT_ACCOUNTS_VERIFICATION');

      return (
        `📸 *Payment Transfer Receipt Received! (Voucher: ${pendingOrder.voucherId})*\n\n` +
        `Thank you! We matched your upload with your pending booking order (*${pendingOrder.voucherId}*).\n` +
        `Your payment receipt has been submitted to our Accounts Department (+923180978480) for verification.\n\n` +
        `Once verified, your official *CONFIRMED* travel itinerary voucher will be delivered to you here automatically.` +
        msg.MENU_FOOTER
      );
    }
  }

  // ── FLOW: Main Menu ───────────────────────────────────────
  if (session.flow === 'MAIN_MENU') {
    if (text === '1') {
      updateSession(phone, { flow: 'PACKAGE', step: 'PKG_SELECT_TYPE' });
      return msg.packageTypeMenu();
    }
    if (text === '2') {
      updateSession(phone, { flow: 'VISA', step: 'VISA_TYPE' });
      return msg.visaTypeMenu();
    }
    if (text === '3') {
      updateSession(phone, { flow: 'HOTEL', step: 'HOTEL_CITY_CHOICE' });
      return msg.hotelCityChoiceMenu();
    }
    if (text === '4') {
      updateSession(phone, { flow: 'TRANSPORT', step: 'TRANSPORT_ROUTE' });
      return msg.transportRouteMenu();
    }
    if (text === '5') {
      return msg.ticketingEscalation();
    }
    if (text === '6') {
      return msg.helplineEscalation();
    }
    return msg.mainMenu();
  }

  // ── STEP: Universal Passport Uploads & OCR Confirmation ──
  if (session.step === 'AWAIT_PASSPORT' || session.step === 'PASSPORT_CONFIRM' || session.step === 'OCR_PROCESSING') {
    const result = await handleVisaFlow(phone, session, body, media);

    // OCR_TRIGGER: need to run OCR and send multiple messages
    if (result && typeof result === 'object' && !Array.isArray(result) && result.type === 'OCR_TRIGGER') {
      return ocrAndBuildReplies(phone, result.media);
    }

    return result;
  }

  // ── FLOW: Umrah Packages ──────────────────────────────────
  if (session.flow === 'PACKAGE' || session.flow?.startsWith('PACKAGE_') || session.step?.startsWith('PKG_')) {
    return handlePackageFlow(phone, body, session);
  }

  // ── FLOW: Visa ────────────────────────────────────────────
  if (session.flow === 'VISA') {
    const result = await handleVisaFlow(phone, session, body, media);

    // TICKET_TRIGGER: need to run ticket OCR
    if (result && typeof result === 'object' && !Array.isArray(result) && result.type === 'TICKET_TRIGGER') {
      return ticketOcrAndBuildReplies(phone, result.media);
    }

    // OCR_TRIGGER: need to run OCR and send multiple messages
    if (result && typeof result === 'object' && !Array.isArray(result) && result.type === 'OCR_TRIGGER') {
      return ocrAndBuildReplies(phone, result.media);
    }

    return result;
  }

  // ── FLOW: Hotel ───────────────────────────────────────────
  if (session.flow === 'HOTEL') {
    const result = await handleHotelFlow(phone, session, media || body);
    if (result && typeof result === 'object' && !Array.isArray(result) && result.type === 'HOTEL_TICKET_TRIGGER') {
      return hotelTicketOcrAndBuildReplies(phone, result.media);
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
 * Runs Gemini Vision Ticket OCR on the flight ticket media, validates departure date > today,
 * and returns success message + passport prompt.
 */
async function ticketOcrAndBuildReplies(phone, mediaData) {
  const session = getSession(phone);
  try {
    const res = await extractTicketData(mediaData);
    if (res && res.isValid) {
      updateSession(phone, {
        step: 'AWAIT_PASSPORT',
        ticketValidated: true,
        departureDate: res.departureDate,
        returnDate: res.returnDate,
        travelPeriod: res.travelPeriod || res.formattedDate,
        flightRoute: res.flightRoute,
        arrivalAirport: res.arrivalAirport || 'UNKNOWN',
      });
      const passportPrompt = msg.requestPassportImage(1, session.passengerCount || 1);
      return [res.message, passportPrompt];
    } else {
      updateSession(phone, { step: 'AWAIT_TICKET_IMAGE' });
      return res.errorMessage || '❌ *Invalid ticket booking image.* Please upload a clear photo showing your travel date.';
    }
  } catch (err) {
    console.error('[Ticket Router] Error:', err.message);
    updateSession(phone, { step: 'AWAIT_TICKET_IMAGE' });
    return '❌ *Could not process ticket booking photo.* Please try sending the image again.';
  }
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

    // Save image to local disk under uploads/passports/<phoneClean>/
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const uploadDir = path.resolve(__dirname, '..', 'uploads', 'passports', cleanPhone);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const ext = (mediaData.mimetype || 'image/jpeg').split('/')[1]?.split(';')[0] || 'jpg';
    const filePath = path.join(uploadDir, `passport_${currIndex}_${Date.now()}.${ext}`);
    try {
      const buf = Buffer.from(mediaData.data, 'base64');
      fs.writeFileSync(filePath, buf);
      console.log(`[OCR] Saved passport image to disk: ${filePath}`);
    } catch (saveErr) {
      console.warn('[OCR] Warning saving passport image to disk:', saveErr.message);
    }

    // Save imageHash & mediaData to pending session state
    const detectedName = `${data.firstName || ''} ${data.lastName || ''}`.trim();
    const updatePayload = {
      step: 'PASSPORT_CONFIRM',
      passportData: data,
      pendingImageHash: imageHash,
      pendingMediaData: mediaData,
      pendingImagePath: filePath,
    };
    if (currIndex === 1 && detectedName && detectedName !== 'Not detected') {
      updatePayload.familyHeadName = detectedName;
    }
    updateSession(phone, updatePayload);

    return msg.passportConfirmationMessage(data, currIndex, totalCount);
  } catch (err) {
    console.error('[OCR] Gemini OCR Error:', err.message);
    updateSession(phone, { step: 'AWAIT_PASSPORT' });
    return msg.ocrFailedMessage();
  }
}

/**
 * Runs Gemini Vision Ticket OCR on flight ticket image uploaded during hotel flow.
 */
async function hotelTicketOcrAndBuildReplies(phone, mediaData) {
  const session = getSession(phone);
  try {
    const res = await extractTicketData(mediaData);
    const depDate = (res && res.isValid) ? res.departureDate : 'Confirmed';
    const arrivalAirport = (res && res.isValid) ? (res.arrivalAirport || 'UNKNOWN') : 'UNKNOWN';

    const { getEffectiveExchangeRate } = require('./utils/exchangeRate');
    const exchangeInfo = await getEffectiveExchangeRate();
    const makkah = session.makkahBooking;
    const madinah = session.madinahBooking;
    const grandTotalSAR = (makkah?.cityTotal || 0) + (madinah?.cityTotal || 0) || (session.cityBooking?.cityTotal || 0);

    const travelPeriod = (res && res.isValid) ? (res.travelPeriod || res.formattedDate) : 'Confirmed';
    const flightRoute = (res && res.isValid) ? res.flightRoute : null;

    updateSession(phone, {
      step: 'AWAIT_PAYMENT_RECEIPT',
      status: 'PAYMENT PENDING',
      departureDate: depDate,
      returnDate: res ? res.returnDate : null,
      travelPeriod: travelPeriod,
      flightRoute: flightRoute,
      arrivalAirport: arrivalAirport,
      totalSar: grandTotalSAR,
      effectiveRate: exchangeInfo.effectiveRate,
      totalPkr: exchangeInfo.convertToPkr(grandTotalSAR).toLocaleString()
    });

    const ticketStatusMsg = (res && res.isValid)
      ? res.message
      : `✈️ *Flight Ticket Recorded!* Proceeding with your hotel booking.`;

    const summaryMsg = (makkah && madinah)
      ? msg.hotelCombinedSummaryMessage(makkah, madinah, exchangeInfo)
      : msg.hotelSingleSummaryMessage(makkah || madinah || session.cityBooking || { hotelName: 'Selected Hotel', roomType: 'Standard', city: 'Makkah / Madinah', nights: 1, ratePerNight: 0, cityTotal: grandTotalSAR }, exchangeInfo);

    const payMsg = msg.paymentDetails(grandTotalSAR, exchangeInfo, 'Total Hotel Rate');

    return [ticketStatusMsg, summaryMsg, payMsg];
  } catch (err) {
    console.error('[Hotel Ticket Router] Error:', err.message);
    return `❌ *Error processing ticket image.* Please resend your flight ticket image.`;
  }
}

module.exports = { routeMessage };
