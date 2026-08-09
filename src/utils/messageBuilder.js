// ============================================================
//  utils/messageBuilder.js — WhatsApp message formatting helpers
// ============================================================

const { CONTACTS, PAYMENT, VISA_RATES, TRANSPORT_ROUTES, VEHICLES } = require('../config');

// ── MENU footer appended to every message ────────────────────
const MENU_FOOTER = `\n\n_Type *MENU* at any time to return to the main menu._`;

// ── Main Menu ────────────────────────────────────────────────
function mainMenu() {
  return (
    `🌙 *Welcome to Eyries!*\n\n` +
    `How can we help you today? Please reply with a number:\n\n` +
    `1️⃣  Visa Query\n` +
    `2️⃣  Transport / Ziyarat Booking\n` +
    `3️⃣  Flight Ticket Query\n` +
    `4️⃣  Other Query / Help\n\n` +
    `_(Reply with 1, 2, 3, or 4)_`
  );
}

// ── Visa Type Menu ────────────────────────────────────────────
function visaTypeMenu() {
  return (
    `📋 *Visa Services — Eyries*\n\n` +
    `Please select the type of visa you need:\n\n` +
    `1️⃣  *Long Stay Visa* — up to 80 days | 💰 650 SAR\n` +
    `2️⃣  *Visa WITH Transport* — up to 30 days (rate by passengers)\n` +
    `3️⃣  *Visa WITHOUT Transport* — up to 30 days | 💰 550 SAR\n\n` +
    `_(Reply with 1, 2, or 3)_` +
    MENU_FOOTER
  );
}

// ── Long Stay Visa Details ─────────────────────────────────────
function longStayVisaDetails() {
  return (
    `🛂 *Long Stay Visa — 650 SAR*\n\n` +
    `✅ *Requirements:*\n` +
    `   • Confirmed airline ticket\n` +
    `   • Iqama + Saudi address\n` +
    `   • Clear passport copy\n\n` +
    `📅 Processing time: *1–2 business days*\n\n` +
    `Do you agree to proceed at *650 SAR*?\n` +
    `Reply *YES* to confirm or *NO* to go back.` +
    MENU_FOOTER
  );
}

// ── Visa With Transport — Ask passengers ─────────────────────
function visaWithTransportPassengerMenu() {
  const r = VISA_RATES.withTransport;
  let msg = `🚌 *Visa WITH Transport Package (max 30 days)*\n\n`;
  msg += `📋 *Requirement:* Hotel booking required\n\n`;
  msg += `💰 *Rates by number of passengers:*\n\n`;
  r.passengers.forEach((p, i) => {
    msg += `${i + 1}️⃣  ${p.range} — *${p.rate} SAR*\n`;
  });
  msg += `\nPlease select your passenger group _(reply 1–5)_:`;
  msg += MENU_FOOTER;
  return msg;
}

// ── Visa Without Transport ─────────────────────────────────────
function visaWithoutTransportInfo() {
  return (
    `🪪 *Visa WITHOUT Transport (max 30 days)*\n\n` +
    `💰 Base Rate: *550 SAR*\n\n` +
    `✈️ *Airline Surcharge:*\n` +
    `   • Pakistani airline (PIA, AirBlue, Serene, etc.): *+90 SAR* = 640 SAR\n` +
    `   • All other airlines: No extra charge\n\n` +
    `Which airline are you flying with? _(Please type the airline name)_` +
    MENU_FOOTER
  );
}

// ── First Leg Transport Options ────────────────────────────────
function firstLegTransportMenu(baseRate) {
  // Option 1: Jeddah to Makkah Sedan (Route 2 in config)
  const toMakkahRate = TRANSPORT_ROUTES.find(r => r.id === 2).rates.sedan;
  // Option 2: Jeddah to Jeddah City Sedan (Route 8 in config)
  const toJeddahCityRate = TRANSPORT_ROUTES.find(r => r.id === 8).rates.sedan;
  
  return (
    `🚗 *Would you like to add 1st Leg Transport?*\n\n` +
    `Your current visa rate: *${baseRate} SAR*\n\n` +
    `1️⃣  Jeddah Airport → Makkah Hotel — *${baseRate + toMakkahRate} SAR total*\n` +
    `2️⃣  Jeddah Airport → Jeddah City — *${baseRate + toJeddahCityRate} SAR total*\n` +
    `3️⃣  No, skip 1st leg transport\n\n` +
    `⚠️ _Note: An additional *+90 SAR* applies if you are flying via Jeddah Hajj Terminal._\n\n` +
    `_(Reply 1, 2, or 3)_` +
    MENU_FOOTER
  );
}

// ── Hajj Terminal Surcharge Question ──────────────────────────
function hajjTerminalQuestion(currentRate) {
  return (
    `✈️ *Jeddah Hajj Terminal Check*\n\n` +
    `Are you flying via the *Jeddah Hajj Terminal*?\n\n` +
    `If yes, an additional *+90 SAR* surcharge applies.\n\n` +
    `Current rate so far: *${currentRate} SAR*\n\n` +
    `Reply *YES* (Hajj Terminal) or *NO* (regular terminal).` +
    MENU_FOOTER
  );
}

// ── Rate Confirmation ──────────────────────────────────────────
function rateConfirmation(rate, details = '') {
  return (
    `💰 *Your Final Visa Rate: ${rate} SAR*\n` +
    (details ? `   ${details}\n` : ``) +
    `\nDo you agree to proceed at this rate?\n` +
    `Reply *YES* to confirm or *NO* to go back.` +
    MENU_FOOTER
  );
}

// ── Request Passport Image ─────────────────────────────────────
function requestPassportImage(currentIndex = 1, totalCount = 1) {
  const headerText = totalCount > 1
    ? `📸 *Please send a photo for Passport ${currentIndex} of ${totalCount}.*`
    : `📸 *Please send a photo of your passport.*`;

  return (
    `${headerText}\n\n` +
    `*How to send:*\n` +
    `1️⃣ Open this chat\n` +
    `2️⃣ Tap the 📎 *paperclip* icon\n` +
    `3️⃣ Tap *Gallery* or *Camera*\n` +
    `4️⃣ Select or take a photo of the passport data page\n` +
    `5️⃣ Tap Send ✅\n\n` +
    `⚠️ *Do NOT send it as a Document — use Gallery or Camera only.*\n\n` +
    `Make sure the photo shows:\n` +
    `   • Full name\n` +
    `   • Passport number\n` +
    `   • Issue & expiry dates\n` +
    `   • The two lines of small text at the bottom (MRZ)` +
    MENU_FOOTER
  );
}

// ── Passenger Count Prompt ─────────────────────────────────────
function passengerCountPrompt(visaLabel = 'Visa Package') {
  return (
    `👥 *Passenger Quantity — Eyries*\n\n` +
    `You have selected: *${visaLabel}*\n\n` +
    `Please enter the total number of passengers / visas you require (e.g. *1*, *2*, *3*, etc.):` +
    MENU_FOOTER
  );
}

// ── OCR Processing Message ─────────────────────────────────────
function processingMessage() {
  return `⏳ _Processing your passport image... please wait a moment._`;
}

// ── Passport Details Confirmation ──────────────────────────────
function passportConfirmationMessage(data, currentIndex = 1, totalCount = 1) {
  const headerText = totalCount > 1
    ? `📄 *Passport Data Extracted (Passport ${currentIndex} of ${totalCount}) — Eyries*`
    : `📄 *Passport Data Extracted — Eyries*`;

  return (
    `${headerText}\n\n` +
    `👤 *First Name:*    ${data.firstName}\n` +
    `👤 *Last Name:*     ${data.lastName}\n` +
    `🛂 *Passport No:*   ${data.passportNumber}\n` +
    `🌍 *Nationality:*   ${data.nationality || 'N/A'}\n` +
    `📅 *DOB:*           ${data.dob || 'N/A'}\n` +
    `📅 *Issue Date:*    ${data.issueDate || 'N/A'}\n` +
    `📅 *Expiry Date:*   ${data.expiryDate}\n\n` +
    `👉 Reply *YES* to Confirm Details\n` +
    `👉 Reply *NO* to Reject & Retry` +
    MENU_FOOTER
  );
}

// ── Payment Details ────────────────────────────────────────────
function paymentDetails(finalRate) {
  return (
    `🏦 *Payment Information — Eyries*\n\n` +
    `Your visa rate: *${finalRate} SAR*\n\n` +
    `Please make payment via one of these methods:\n\n` +
    `*💳 Bank Transfer:*\n` +
    `   Bank:      ${PAYMENT.bankName}\n` +
    `   Account:   ${PAYMENT.accountTitle}\n` +
    `   Acc. No:   ${PAYMENT.accountNumber}\n` +
    `   IBAN:      ${PAYMENT.iban}\n` +
    `   Branch:    ${PAYMENT.branch}\n\n` +
    `*💵 Cash:*\n` +
    `   Cash payment can be arranged at our office.\n\n` +
    `_Your visa will be processed once payment is confirmed._` +
    MENU_FOOTER
  );
}

// ── Visa Submitted Confirmation ────────────────────────────────
function visaSubmittedMessage() {
  return (
    `✅ *Application Received — Eyries!*\n\n` +
    `Thank you for choosing Eyries. 🌙\n\n` +
    `📋 Your visa application has been submitted.\n` +
    `⏱️  Processing time: *1–2 business days*\n\n` +
    `You will receive your visa within *1–2 days* of payment confirmation.\n\n` +
    `JazakAllah Khair! For any questions, contact our helpline:\n` +
    `📞 *${CONTACTS.helpline}*` +
    MENU_FOOTER
  );
}

// ── Transport Route Menu ───────────────────────────────────────
function transportRouteMenu() {
  let msg = `🚗 *Transport & Ziyarat Rates — Eyries*\n\n`;
  msg += `Please select a route:\n\n`;
  TRANSPORT_ROUTES.forEach(r => {
    msg += `${r.id}️⃣  ${r.route}\n`;
  });
  msg += `\n_(Reply with route number 1–${TRANSPORT_ROUTES.length})_`;
  msg += MENU_FOOTER;
  return msg;
}

// ── Vehicle Selection Menu ─────────────────────────────────────
function vehicleMenu(routeId) {
  const route = TRANSPORT_ROUTES.find(r => r.id === routeId);
  if (!route) return 'Invalid route selected.' + MENU_FOOTER;

  let msg = `🚌 *${route.route}*\n\n`;
  msg += `Select vehicle type:\n\n`;
  VEHICLES.forEach(v => {
    const rate = route.rates[v.key];
    msg += `${v.id}️⃣  ${v.label} — *${rate} SAR*\n`;
  });
  msg += `\n_(Reply with vehicle number 1–${VEHICLES.length})_`;
  msg += MENU_FOOTER;
  return msg;
}

function transportRateResult(routeId, vehicleId) {
  const route   = TRANSPORT_ROUTES.find(r => r.id === routeId);
  const vehicle = VEHICLES.find(v => v.id === vehicleId);
  if (!route || !vehicle) return 'Could not find rate.' + MENU_FOOTER;

  const rate = route.rates[vehicle.key];
  return (
    `🚗 *Transport Rate — Eyries*\n\n` +
    `📍 Route:   ${route.route}\n` +
    `🚌 Vehicle: ${vehicle.label}\n` +
    `💰 Rate:    *${rate} SAR*\n\n` +
    `⚠️ *Important Notes:*\n` +
    `• Additional SR 90 will be charged for Jeddah Hajj Terminal Flights.\n` +
    `• Arrival Intimation must be sent before 24 Hours.\n` +
    `• 30% will be charged in case of No Show.\n` +
    `• Rates valid upto 15 Shaban 1448.\n\n` +
    `To book or for assistance, contact us:\n` +
    `📞 *${CONTACTS.helpline}*\n\n` +
    `Reply *1* to check another route.` +
    MENU_FOOTER
  );
}

// ── Ticketing Escalation ───────────────────────────────────────
function ticketingEscalation() {
  const link = `https://wa.me/${CONTACTS.ticketing.replace('+', '')}`;
  return (
    `✈️ *Flight Ticket Queries — Eyries*\n\n` +
    `For ticket pricing and availability, our ticketing team handles this manually.\n\n` +
    `Please contact our ticketing team on WhatsApp:\n` +
    `📞 *${CONTACTS.ticketing}*\n` +
    `🔗 ${link}\n\n` +
    `They will check the current price and reply shortly.` +
    MENU_FOOTER
  );
}

// ── General Helpline Escalation ────────────────────────────────
function helplineEscalation() {
  const link = `https://wa.me/${CONTACTS.helpline.replace('+', '')}`;
  return (
    `📞 *Helpline — Eyries*\n\n` +
    `For queries not covered by our automated service, please contact our team:\n\n` +
    `📱 *${CONTACTS.helpline}*\n` +
    `🔗 ${link}` +
    MENU_FOOTER
  );
}

// ── OCR Failed ────────────────────────────────────────────────
function ocrFailedMessage() {
  return (
    `❌ *Could not read passport clearly.*\n\n` +
    `Please make sure:\n` +
    `   • The image is clear and well-lit\n` +
    `   • The entire passport data page is visible\n` +
    `   • No glare or shadow\n` +
    `   • Image is not rotated — hold passport flat\n\n` +
    `Please send the passport image again.` +
    MENU_FOOTER
  );
}

// ── Generic Error ──────────────────────────────────────────────
function genericError() {
  return (
    `⚠️ Sorry, I didn't understand that. Please reply with a valid option.` +
    MENU_FOOTER
  );
}

module.exports = {
  mainMenu,
  visaTypeMenu,
  longStayVisaDetails,
  visaWithTransportPassengerMenu,
  visaWithoutTransportInfo,
  firstLegTransportMenu,
  hajjTerminalQuestion,
  rateConfirmation,
  requestPassportImage,
  passengerCountPrompt,
  processingMessage,
  passportConfirmationMessage,
  paymentDetails,
  visaSubmittedMessage,
  transportRouteMenu,
  vehicleMenu,
  transportRateResult,
  ticketingEscalation,
  helplineEscalation,
  ocrFailedMessage,
  genericError,
};
