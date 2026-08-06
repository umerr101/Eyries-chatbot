// ============================================================
//  flows/visaFlow.js — Complete visa conversation flow handler
// ============================================================

const { updateSession, resetSession } = require('../stateManager');
const { extractPassportData }         = require('../ocr/passport');
const { translateNames }              = require('../translation/arabic');
const msg                             = require('../utils/messageBuilder');
const { PAKISTANI_AIRLINES, VISA_RATES, TRANSPORT_ROUTES } = require('../config');

/**
 * Handles all incoming messages for a user currently in the VISA flow.
 * Returns the reply string to send back to the user.
 */
async function handleVisaFlow(phone, session, incomingMsg, mediaUrl) {
  const text = (incomingMsg || '').trim().toUpperCase();

  // ── STEP: Choose visa type ────────────────────────────────
  if (session.step === 'VISA_TYPE') {
    if (text === '1') {
      updateSession(phone, { step: 'LONG_STAY_CONFIRM', visaType: 'longStay' });
      return msg.longStayVisaDetails();
    }
    if (text === '2') {
      updateSession(phone, { step: 'WITH_TRANSPORT_PASSENGERS', visaType: 'withTransport' });
      return msg.visaWithTransportPassengerMenu();
    }
    if (text === '3') {
      updateSession(phone, { step: 'WITHOUT_TRANSPORT_AIRLINE', visaType: 'withoutTransport' });
      return msg.visaWithoutTransportInfo();
    }
    return msg.visaTypeMenu();
  }

  // ── STEP: Long Stay — Confirm rate ────────────────────────
  if (session.step === 'LONG_STAY_CONFIRM') {
    if (text === 'YES') {
      updateSession(phone, { step: 'AWAIT_PASSPORT', finalVisaRate: 650, agreedToRate: true });
      return msg.requestPassportImage();
    }
    if (text === 'NO') {
      resetSession(phone);
      return msg.mainMenu();
    }
    return `Please reply *YES* to confirm or *NO* to go back.`;
  }

  // ── STEP: Visa with Transport — Number of passengers ──────
  if (session.step === 'WITH_TRANSPORT_PASSENGERS') {
    const choice = parseInt(text, 10);
    const passengers = VISA_RATES.withTransport.passengers;
    if (choice >= 1 && choice <= passengers.length) {
      const selected = passengers[choice - 1];
      updateSession(phone, {
        step: 'WITH_TRANSPORT_CONFIRM',
        passengerCount: selected.range,
        finalVisaRate: selected.rate,
      });
      return msg.rateConfirmation(
        selected.rate,
        `${selected.range} | Max 30 days | Hotel booking required`
      );
    }
    return msg.visaWithTransportPassengerMenu();
  }

  // ── STEP: Visa with Transport — Confirm rate ──────────────
  if (session.step === 'WITH_TRANSPORT_CONFIRM') {
    if (text === 'YES') {
      updateSession(phone, { step: 'AWAIT_PASSPORT', agreedToRate: true });
      return msg.requestPassportImage();
    }
    if (text === 'NO') {
      resetSession(phone);
      return msg.mainMenu();
    }
    return `Please reply *YES* to confirm or *NO* to go back.`;
  }

  // ── STEP: Visa without Transport — Collect airline ────────
  if (session.step === 'WITHOUT_TRANSPORT_AIRLINE') {
    const airlineLower = (incomingMsg || '').trim().toLowerCase();
    const isPakistani  = PAKISTANI_AIRLINES.some(pa => airlineLower.includes(pa));
    const baseRate     = isPakistani ? 640 : 550;  // 550 + 90 if Pakistani
    const surchargeMsg = isPakistani
      ? `\n_*Note:* Pakistani airline surcharge of 90 SAR applied (550 + 90 = *640 SAR*)_`
      : ``;

    updateSession(phone, {
      step: 'WITHOUT_TRANSPORT_FIRST_LEG',
      airline: incomingMsg.trim(),
      isPakistaniAirline: isPakistani,
      finalVisaRate: baseRate,
    });

    return msg.firstLegTransportMenu(baseRate) + surchargeMsg;
  }

  // ── STEP: First Leg Transport choice ──────────────────────
  if (session.step === 'WITHOUT_TRANSPORT_FIRST_LEG') {
    if (text === '1') {
      const toMakkahRate = TRANSPORT_ROUTES.find(r => r.id === 2).rates.sedan;
      const totalRate = session.finalVisaRate + toMakkahRate;
      
      updateSession(phone, {
        step: 'WITHOUT_TRANSPORT_CONFIRM',
        addFirstLeg: true,
        firstLegChoice: 'jeddahToMakkah',
        finalVisaRate: totalRate,
      });
      return msg.rateConfirmation(totalRate, 'Includes Jeddah Airport → Makkah Hotel transport');
    }
    if (text === '2') {
      const toJeddahCityRate = TRANSPORT_ROUTES.find(r => r.id === 8).rates.sedan;
      const totalRate = session.finalVisaRate + toJeddahCityRate;
      
      updateSession(phone, {
        step: 'WITHOUT_TRANSPORT_CONFIRM',
        addFirstLeg: true,
        firstLegChoice: 'jeddahToJeddahCity',
        finalVisaRate: totalRate,
      });
      return msg.rateConfirmation(totalRate, 'Includes Jeddah Airport → Jeddah City transport');
    }
    if (text === '3') {
      updateSession(phone, {
        step: 'WITHOUT_TRANSPORT_CONFIRM',
        addFirstLeg: false,
      });
      return msg.rateConfirmation(session.finalVisaRate, `${session.airline} | No first leg transport`);
    }
    return msg.firstLegTransportMenu(session.finalVisaRate);
  }

  // ── STEP: Visa without Transport — Confirm rate ───────────
  if (session.step === 'WITHOUT_TRANSPORT_CONFIRM') {
    if (text === 'YES') {
      updateSession(phone, { step: 'AWAIT_PASSPORT', agreedToRate: true });
      return msg.requestPassportImage();
    }
    if (text === 'NO') {
      resetSession(phone);
      return msg.mainMenu();
    }
    return `Please reply *YES* to confirm or *NO* to go back.`;
  }

  // ── STEP: Awaiting Passport Image ─────────────────────────
  if (session.step === 'AWAIT_PASSPORT') {
    if (!mediaUrl) {
      return (
        `📸 *Please send a photo of your passport.*\n\n` +
        `*How to send:*\n` +
        `1️⃣ Tap the 📎 paperclip icon in this chat\n` +
        `2️⃣ Tap *Gallery* or *Camera* _(NOT Document)_\n` +
        `3️⃣ Select your passport photo and tap Send\n\n` +
        `⚠️ _If you send it as a file/document, the bot cannot read it._`
      );
    }

    // Signal router to run OCR and return multi-step replies
    updateSession(phone, { step: 'OCR_PROCESSING' });
    return { type: 'OCR_TRIGGER', media: mediaUrl };
  }

  // ── STEP: Passport Confirmation ────────────────────────────
  if (session.step === 'PASSPORT_CONFIRM') {
    if (text === 'YES') {
      updateSession(phone, { step: 'PAYMENT', passportConfirmed: true });
      return msg.paymentDetails(session.finalVisaRate);
    }
    if (text === 'NO') {
      updateSession(phone, { step: 'AWAIT_PASSPORT' });
      return msg.requestPassportImage();
    }
    return `Please reply *YES* if the details are correct or *NO* to resend your passport image.`;
  }

  // ── STEP: Payment Confirmation ────────────────────────────
  if (session.step === 'PAYMENT') {
    // After displaying payment, move to done state
    updateSession(phone, { step: 'DONE' });
    return msg.visaSubmittedMessage();
  }

  // ── STEP: Done ────────────────────────────────────────────
  if (session.step === 'DONE') {
    if (text === 'MENU' || text === 'HI' || text === 'HELLO' || text === 'START') {
      resetSession(phone);
      return msg.mainMenu();
    }
    return (
      `Your application is submitted! ✅\n\n` +
      `Reply *MENU* to start a new query or contact our helpline for assistance.`
    );
  }

  return msg.genericError();
}

module.exports = { handleVisaFlow };
