// ============================================================
//  flows/visaFlow.js — Complete visa conversation flow handler
// ============================================================

const { updateSession, resetSession }   = require('../stateManager');
const { extractPassportData }           = require('../ocr/passport');
const { confirmPassportWithGemini }     = require('../ocr/pythonBridge');
const msg                               = require('../utils/messageBuilder');
const { PAKISTANI_AIRLINES, VISA_RATES, TRANSPORT_ROUTES } = require('../config');

/**
 * Handles all incoming messages for a user currently in the VISA flow.
 * Returns the reply string or array of strings to send back to the user.
 */
async function handleVisaFlow(phone, session, incomingMsg, mediaUrl) {
  const text = (incomingMsg || '').trim().toUpperCase();

  // ── STEP: Choose visa type ────────────────────────────────
  if (session.step === 'VISA_TYPE') {
    if (text === '1') {
      updateSession(phone, {
        step: 'ASK_PASSENGERS',
        visaType: 'longStay',
        perPersonRate: 650,
        visaLabel: 'Long Stay Visa (up to 80 days)'
      });
      return msg.passengerCountPrompt('Long Stay Visa (up to 80 days) — 650 SAR/person');
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

  // ── STEP: Visa with Transport — Select package/rate ──────
  if (session.step === 'WITH_TRANSPORT_PASSENGERS') {
    const choice = parseInt(text, 10);
    const passengers = VISA_RATES.withTransport.passengers;
    if (choice >= 1 && choice <= passengers.length) {
      const selected = passengers[choice - 1];
      updateSession(phone, {
        step: 'ASK_PASSENGERS',
        perPersonRate: selected.rate,
        visaLabel: `Visa WITH Transport (${selected.range})`
      });
      return msg.passengerCountPrompt(`Visa WITH Transport (${selected.range}) — ${selected.rate} SAR/person`);
    }
    return msg.visaWithTransportPassengerMenu();
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
      perPersonRate: baseRate,
    });

    return msg.firstLegTransportMenu(baseRate) + surchargeMsg;
  }

  // ── STEP: First Leg Transport choice ──────────────────────
  if (session.step === 'WITHOUT_TRANSPORT_FIRST_LEG') {
    if (text === '1') {
      const toMakkahRate = TRANSPORT_ROUTES.find(r => r.id === 2).rates.sedan;
      const rateWithLeg  = session.perPersonRate + toMakkahRate;

      updateSession(phone, {
        step: 'WITHOUT_TRANSPORT_HAJJ_CHECK',
        addFirstLeg: true,
        firstLegChoice: 'jeddahToMakkah',
        perPersonRate: rateWithLeg,
      });
      return msg.hajjTerminalQuestion(rateWithLeg);
    }
    if (text === '2') {
      const toJeddahCityRate = TRANSPORT_ROUTES.find(r => r.id === 8).rates.sedan;
      const rateWithLeg      = session.perPersonRate + toJeddahCityRate;

      updateSession(phone, {
        step: 'WITHOUT_TRANSPORT_HAJJ_CHECK',
        addFirstLeg: true,
        firstLegChoice: 'jeddahToJeddahCity',
        perPersonRate: rateWithLeg,
      });
      return msg.hajjTerminalQuestion(rateWithLeg);
    }
    if (text === '3') {
      updateSession(phone, {
        step: 'WITHOUT_TRANSPORT_HAJJ_CHECK',
        addFirstLeg: false,
      });
      return msg.hajjTerminalQuestion(session.perPersonRate);
    }
    return msg.firstLegTransportMenu(session.perPersonRate);
  }

  // ── STEP: Hajj Terminal Surcharge Check ────────────────────
  if (session.step === 'WITHOUT_TRANSPORT_HAJJ_CHECK') {
    const HAJJ_SURCHARGE = 90;
    let finalPerPerson = session.perPersonRate;
    if (text === 'YES') {
      finalPerPerson += HAJJ_SURCHARGE;
    }
    const details = session.addFirstLeg
      ? `${session.firstLegChoice === 'jeddahToMakkah' ? 'Jeddah Airport → Makkah' : 'Jeddah Airport → Jeddah City'} ${text === 'YES' ? '| Hajj Terminal (+90 SAR)' : ''}`
      : `${session.airline} ${text === 'YES' ? '| Hajj Terminal surcharge (+90 SAR)' : ''}`;

    updateSession(phone, {
      step: 'ASK_PASSENGERS',
      isHajjTerminal: text === 'YES',
      perPersonRate: finalPerPerson,
      visaLabel: `Visa WITHOUT Transport (${details})`
    });

    return msg.passengerCountPrompt(`Visa WITHOUT Transport (${finalPerPerson} SAR/person)`);
  }

  // ── STEP: Ask Passenger Count (Universal) ──────────────────
  if (session.step === 'ASK_PASSENGERS') {
    const count = parseInt(text, 10);
    if (isNaN(count) || count < 1) {
      return `⚠️ Please enter a valid number of passengers (e.g. *1*, *2*, *3*, etc.):`;
    }

    const perPerson = session.perPersonRate || 650;
    const totalRate = perPerson * count;

    updateSession(phone, {
      step: 'CONFIRM_RATE_AND_PASSENGERS',
      passengerCount: count,
      currentPassengerIndex: 1,
      finalVisaRate: totalRate,
    });

    return msg.rateConfirmation(
      totalRate,
      `👥 ${count} passenger(s) @ ${perPerson} SAR each (Total: ${totalRate} SAR)`
    );
  }

  // ── STEP: Confirm Rate & Passenger Count ─────────────────
  if (session.step === 'CONFIRM_RATE_AND_PASSENGERS') {
    if (text === 'YES') {
      updateSession(phone, { step: 'AWAIT_PASSPORT', agreedToRate: true });
      return msg.requestPassportImage(1, session.passengerCount || 1);
    }
    if (text === 'NO') {
      resetSession(phone);
      return msg.mainMenu();
    }
    return `Please reply *YES* to confirm or *NO* to go back.`;
  }

  // ── STEP: Awaiting Passport Image ─────────────────────────
  if (session.step === 'AWAIT_PASSPORT') {
    const currIndex = session.currentPassengerIndex || 1;
    const totalCount = session.passengerCount || 1;

    if (!mediaUrl) {
      return msg.requestPassportImage(currIndex, totalCount);
    }

    // Signal router to run OCR
    updateSession(phone, { step: 'OCR_PROCESSING' });
    return { type: 'OCR_TRIGGER', media: mediaUrl };
  }

  // ── STEP: Passport Confirmation ────────────────────────────
  if (session.step === 'PASSPORT_CONFIRM') {
    const currIndex = session.currentPassengerIndex || 1;
    const totalCount = session.passengerCount || 1;

    if (text === 'YES') {
      let confirmMsg = null;
      try {
        const passportNum = session.passportData?.passportNumber;
        const res = await confirmPassportWithGemini(passportNum);
        if (res && res.whatsapp_message) {
          confirmMsg = res.whatsapp_message;
        }
      } catch (err) {
        console.error('[VisaFlow] Gemini Confirmation error:', err.message);
      }

      if (currIndex < totalCount) {
        const nextIndex = currIndex + 1;
        updateSession(phone, {
          step: 'AWAIT_PASSPORT',
          currentPassengerIndex: nextIndex,
        });

        const progressMsg = `✅ *Passport ${currIndex} of ${totalCount} Confirmed & Recorded!*`;
        const nextPrompt = msg.requestPassportImage(nextIndex, totalCount);
        return [progressMsg, nextPrompt];
      } else {
        // All passengers confirmed!
        updateSession(phone, { step: 'PAYMENT', passportConfirmed: true });
        const allDoneMsg = `✅ *Passport ${currIndex} of ${totalCount} Confirmed & Recorded!*\n\n🎉 *All ${totalCount} passport(s) have been verified and processed!*`;
        const paymentMsg = msg.paymentDetails(session.finalVisaRate);
        return [allDoneMsg, paymentMsg];
      }
    }
    if (text === 'NO') {
      updateSession(phone, { step: 'AWAIT_PASSPORT' });
      return msg.requestPassportImage(currIndex, totalCount);
    }
    return `Please reply *YES* if the details are correct or *NO* to resend your passport image.`;
  }

  // ── STEP: Payment Confirmation ────────────────────────────
  if (session.step === 'PAYMENT') {
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
