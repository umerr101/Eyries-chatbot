// ============================================================
//  flows/transportFlow.js — Transport booking query flow
// ============================================================

const { updateSession, resetSession } = require('../stateManager');
const msg = require('../utils/messageBuilder');
const { TRANSPORT_ROUTES, VEHICLES } = require('../config');

/**
 * Handles all incoming messages for a user in the TRANSPORT flow.
 */
async function handleTransportFlow(phone, session, incomingMsg) {
  const text = (incomingMsg || '').trim().toUpperCase();

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
      updateSession(phone, {
        step: 'TRANSPORT_DONE',
        selectedVehicleId: choice,
      });
      return msg.transportRateResult(session.selectedRouteId, choice);
    }
    return msg.vehicleMenu(session.selectedRouteId);
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
