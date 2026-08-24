// ============================================================
//  flows/transportFlow.js — Transport booking query flow
// ============================================================

const { updateSession, resetSession } = require('../stateManager');
const { getEffectiveExchangeRate }    = require('../utils/exchangeRate');
const msg = require('../utils/messageBuilder');
const { TRANSPORT_ROUTES, VEHICLES } = require('../config');

/**
 * Handles all incoming messages for a user in the TRANSPORT flow.
 */
async function handleTransportFlow(phone, session, incomingMsg) {
  const text = (typeof incomingMsg === 'string' ? incomingMsg : (incomingMsg && incomingMsg.body) || '').trim().toUpperCase();

  // ── STEP: Route Selection ─────────────────────────────────
  if (session.step === 'TRANSPORT_ROUTE') {
    const choice = parseInt(text, 10);
    if (choice >= 1 && choice <= TRANSPORT_ROUTES.length) {
      updateSession(phone, {
        step: 'TRANSPORT_VEHICLE',
        selectedRouteId: choice,
      });
      return msg.vehicleMenu(choice);
    }
    return msg.transportRouteMenu();
  }

  // ── STEP: Vehicle Selection ───────────────────────────────
  if (session.step === 'TRANSPORT_VEHICLE') {
    const choice = parseInt(text, 10);
    if (choice >= 1 && choice <= VEHICLES.length) {
      const route = TRANSPORT_ROUTES.find(r => r.id === session.selectedRouteId);
      const vehicle = VEHICLES.find(v => v.id === choice);
      const rate = route ? route.rates[vehicle.key] : 0;

      updateSession(phone, {
        step: 'TRANSPORT_ASK_FAMILY_HEAD',
        selectedVehicleId: choice,
        transportRoute: route ? route.route : 'Transport Route',
        vehicleType: vehicle ? vehicle.label : 'Vehicle',
        totalSar: rate
      });

      return (
        `👤 *Family Head Name Required*\n\n` +
        `Please enter the full name of the Family Head for this transport booking _(e.g. Waleed Ahmad)_:` +
        msg.MENU_FOOTER
      );
    }
    return msg.vehicleMenu(session.selectedRouteId);
  }

  // ── STEP: Collect Family Head Name ─────────────────────────
  if (session.step === 'TRANSPORT_ASK_FAMILY_HEAD') {
    const familyHead = (typeof incomingMsg === 'string' ? incomingMsg : (incomingMsg && incomingMsg.body) || '').trim();
    if (!familyHead || familyHead.length < 2) {
      return `⚠️ Please enter a valid Family Head Name _(e.g. Waleed Ahmad)_:`;
    }

    const exchangeInfo = await getEffectiveExchangeRate();
    const grandTotalSAR = session.totalSar || 0;

    updateSession(phone, {
      step: 'AWAIT_PAYMENT_RECEIPT',
      familyHeadName: familyHead,
      status: 'PAYMENT PENDING',
      effectiveRate: exchangeInfo.effectiveRate,
      totalPkr: exchangeInfo.convertToPkr(grandTotalSAR).toLocaleString()
    });

    const rateResult = msg.transportRateResult(session.selectedRouteId, session.selectedVehicleId);
    const payMsg = msg.paymentDetails(grandTotalSAR, exchangeInfo, 'Total Transport Rate');

    return [rateResult, payMsg];
  }

  // ── STEP: Done — offer to check another ──────────────────
  if (session.step === 'TRANSPORT_DONE') {
    if (text === '1') {
      updateSession(phone, { step: 'TRANSPORT_ROUTE', selectedRouteId: null, selectedVehicleId: null });
      return msg.transportRouteMenu();
    }
    if (text === 'MENU') {
      resetSession(phone);
      return msg.mainMenu();
    }
    return (
      `Reply *1* to check another route or *MENU* to return to the main menu.`
    );
  }

  return msg.genericError();
}

module.exports = { handleTransportFlow };
