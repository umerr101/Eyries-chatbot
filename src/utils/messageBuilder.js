// ============================================================
//  utils/messageBuilder.js — WhatsApp message formatting helpers
// ============================================================

const { CONTACTS, PAYMENT, AGENCY, VISA_RATES, TRANSPORT_ROUTES, VEHICLES } = require('../config');

// ── MENU footer appended to every message ────────────────────
const MENU_FOOTER = `\n\n_Type *MENU* at any time to return to the main menu._`;

function mainMenuFooter() {
  return MENU_FOOTER;
}

// ── Helper to resolve current active client agency name dynamically ──
function getAgencyName() {
  const { loadClientConfig } = require('../configLoader');
  const clientConfig = loadClientConfig();
  return clientConfig.agencyName || AGENCY.name || 'Umrah Services';
}

// ── Main Menu ────────────────────────────────────────────────
function mainMenu() {
  const agencyName = getAgencyName();
  return (
    `🌙 *Welcome to ${agencyName}!*\n\n` +
    `How can we help you today? Please reply with a number:\n\n` +
    `1️⃣  Umrah Packages (Fixed & Customized)\n` +
    `2️⃣  Visa Query & Processing\n` +
    `3️⃣  Hotels (Makkah / Madinah)\n` +
    `4️⃣  Transport / Ziyarat Booking\n` +
    `5️⃣  Flight Ticket Query\n` +
    `6️⃣  Other Query / Help\n\n` +
    `_(Reply with 1, 2, 3, 4, 5, or 6)_`
  );
}

// ── Visa Type Menu ────────────────────────────────────────────
function visaTypeMenu() {
  const agencyName = getAgencyName();
  return (
    `📋 *Visa Services — ${agencyName}*\n\n` +
    `Please select the type of visa you need:\n\n` +
    `1️⃣  *Long Stay Visa* — up to 80 days | 💰 600 SAR\n` +
    `2️⃣  *Visa WITH Transport* — up to 30 days (rate by passengers)\n` +
    `3️⃣  *Visa WITHOUT Transport* — up to 30 days | 💰 550 SAR\n\n` +
    `_(Reply with 1, 2, or 3)_` +
    MENU_FOOTER
  );
}

// ── Long Stay Visa Details & Requirements ─────────────────────
function longStayVisaDetails() {
  return (
    `📌 *Long Stay Visa Requirements (up to 80 days)*\n\n` +
    `💰 Rate: *600 SAR/person*\n\n` +
    `📋 *Required Documents & Information:*\n` +
    `   1️⃣ Return Ticket (Photo or PDF document)\n` +
    `   2️⃣ Sponsor Iqama Number + Saudi Address\n` +
    `   3️⃣ Clear Passport Copy\n\n` +
    `Please enter the total number of passengers / visas you require (e.g. *1*, *2*, *3*, etc.):` +
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
function firstLegRouteMenu(baseRate, arrivalAirport = 'UNKNOWN') {
  const isMadinah = (arrivalAirport || '').toUpperCase().includes('MADINAH') || (arrivalAirport || '').toUpperCase().includes('MED');

  if (isMadinah) {
    return (
      `🛬 *1st Leg Transport Selection (Madinah Airport Arrival)*\n\n` +
      `Base Visa Rate: *${baseRate} SAR/person*\n\n` +
      `Since your flight lands at *Madinah Airport*, please select your mandatory 1st leg transport route:\n\n` +
      `1️⃣  Madinah Airport → Madinah Hotel\n` +
      `2️⃣  Madinah Airport → Makkah Hotel\n\n` +
      `_(Reply 1 or 2)_` +
      MENU_FOOTER
    );
  } else {
    return (
      `🛬 *1st Leg Transport Selection (Jeddah Airport Arrival)*\n\n` +
      `Base Visa Rate: *${baseRate} SAR/person*\n\n` +
      `Since your flight lands at *Jeddah Airport*, please select your mandatory 1st leg transport route:\n\n` +
      `1️⃣  Jeddah Airport → Makkah Hotel\n` +
      `2️⃣  Jeddah Airport → Jeddah City\n` +
      `3️⃣  Jeddah Airport → Madinah Hotel\n\n` +
      `_(Reply 1, 2, or 3)_` +
      MENU_FOOTER
    );
  }
}

function vehicleSelectionMenu(routeLabel, rates) {
  return (
    `🚐 *Select Vehicle Type for 1st Leg Transport*\n\n` +
    `Route: *${routeLabel}*\n\n` +
    `1️⃣  Sedan — (Capacity: 3–4) — *+${rates.sedan} SAR*\n` +
    `2️⃣  GMC Yukon XL — (Capacity: 6) — *+${rates.gmcYukon} SAR*\n` +
    `3️⃣  Hyundai Staria — (Capacity: 6) — *+${rates.hyundaiStaria} SAR*\n` +
    `4️⃣  Toyota Hiace — (Capacity: 9) — *+${rates.toyotaHiace} SAR*\n` +
    `5️⃣  Toyota Coaster — (Capacity: 17) — *+${rates.toyotaCoaster} SAR*\n` +
    `6️⃣  Bus (47 Seats) — (Capacity: 47) — *+${rates.bus47} SAR*\n\n` +
    `_(Reply 1, 2, 3, 4, 5, or 6)_` +
    MENU_FOOTER
  );
}

function firstLegTransportMenu(baseRate) {
  return firstLegRouteMenu(baseRate);
}

// ── Hajj Terminal Surcharge Question ──────────────────────────
function hajjTerminalQuestion(currentRate) {
  return (
    `✈️ *Jeddah Hajj Terminal Check*\n\n` +
    `Are you flying via the *Jeddah Hajj Terminal*?\n\n` +
    `If yes, an additional *+90 SAR* fixed car parking fee applies per vehicle.\n\n` +
    `Base visa rate: *${currentRate} SAR/person*\n\n` +
    `Reply *YES* (Hajj Terminal) or *NO* (regular terminal).` +
    MENU_FOOTER
  );
}

// ── Rate Confirmation ──────────────────────────────────────────
function rateConfirmation(rate, details = '', exchangeInfo = null) {
  let pkrText = '';
  if (exchangeInfo && exchangeInfo.convertToPkr) {
    const pkrTotal = exchangeInfo.convertToPkr(rate).toLocaleString();
    pkrText = `\n🇵🇰 *Total in PKR:* approx. *${pkrTotal} PKR* _(Rate: ${exchangeInfo.effectiveRate} PKR/SAR)_\n`;
  }

  return (
    `💰 *Your Final Visa Rate: ${rate} SAR*\n` +
    (details ? `   ${details}\n` : ``) +
    pkrText +
    `\nDo you agree to proceed at this rate?\n` +
    `Reply *YES* to confirm or *NO* to go back.` +
    MENU_FOOTER
  );
}

// ── Request Flight Ticket Image ────────────────────────────────
function requestTicketImage() {
  return (
    `✈️ *Flight Ticket Booking Requirement*\n\n` +
    `Before uploading passport photos, please send a clear photo or **PDF document** of your *ticket booking*.\n\n` +
    `⚠️ *Rule:* Your travel departure date must be a **future date (greater than today)**.` +
    MENU_FOOTER
  );
}

// ── Request Passport Image ─────────────────────────────────────
function requestPassportImage(currentIndex = 1, totalCount = 1) {
  const countText = totalCount > 1 ? ` (Passport ${currentIndex} of ${totalCount})` : '';
  return (
    `📸 *Please send a photo of your passport${countText}*\n\n` +
    `Ensure the data page is clear, flat, and un-cropped.` +
    MENU_FOOTER
  );
}

// ── Passenger Count Prompt ─────────────────────────────────────
function passengerCountPrompt(visaLabel = 'Visa Package') {
  const agencyName = getAgencyName();
  return (
    `👥 *Passenger Quantity — ${agencyName}*\n\n` +
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
  const { getPassengerTypeFromDob } = require('./passengerAge');
  const typeInfo = getPassengerTypeFromDob(data.dob);

  const headerText = totalCount > 1
    ? `📄 *Passport Data Extracted (Passport ${currentIndex} of ${totalCount})*`
    : `📄 *Passport Data Extracted*`;

  return (
    `${headerText}\n\n` +
    `👤 *First Name:*    ${data.firstName}\n` +
    `👤 *Last Name:*     ${data.lastName}\n` +
    `🛂 *Passport No:*   ${data.passportNumber}\n` +
    `🌍 *Nationality:*   ${data.nationality || 'N/A'}\n` +
    `📅 *DOB:*           ${data.dob || 'N/A'}\n` +
    `👶 *Category:*      *${typeInfo.label}* [${typeInfo.type}]\n` +
    `📅 *Issue Date:*    ${data.issueDate || 'N/A'}\n` +
    `📅 *Expiry Date:*   ${data.expiryDate}\n\n` +
    `👉 Reply *YES* to Confirm Details\n` +
    `👉 Reply *NO* to Reject & Retry` +
    MENU_FOOTER
  );
}

// ── Payment Details ────────────────────────────────────────────
function paymentDetails(finalRate, exchangeInfo = null, label = 'Total Booking Rate') {
  const { loadClientConfig } = require('../configLoader');
  const clientConfig = loadClientConfig();
  const agencyName = clientConfig.agencyName || AGENCY.name || 'Umrah Services';
  const payment = clientConfig.payment || PAYMENT;

  let pkrLine = '';
  if (exchangeInfo && exchangeInfo.convertToPkr) {
    const pkrTotal = exchangeInfo.convertToPkr(finalRate).toLocaleString();
    pkrLine = `\n🇵🇰 *Total in PKR:* approx. *${pkrTotal} PKR* _(Rate: ${exchangeInfo.effectiveRate} PKR/SAR)_`;
  }

  return (
    `🏦 *Payment Details — ${agencyName}*\n\n` +
    `💰 *${label}:* *${finalRate} SAR*${pkrLine}\n\n` +
    `*💳 Bank Transfer:*\n` +
    `• Bank:   ${payment.bankName}\n` +
    `• Title:  ${payment.accountTitle}\n` +
    `• Acc No: ${payment.accountNumber}\n` +
    `• IBAN:   ${payment.iban}\n\n` +
    `*📸 Next Step (Status: PAYMENT PENDING):*\n` +
    `Please reply here by uploading a photo or PDF of your *payment receipt* to submit for Accounts verification.` +
    MENU_FOOTER
  );
}

function packagePaymentDetails(totalPkr, totalSar = null) {
  const { loadClientConfig } = require('../configLoader');
  const clientConfig = loadClientConfig();
  const agencyName = clientConfig.agencyName || AGENCY.name || 'Umrah Services';
  const payment = clientConfig.payment || PAYMENT;

  const sarLine = totalSar ? ` _(approx. ${totalSar.toLocaleString()} SAR)_` : '';

  return (
    `🏦 *Payment Details — ${agencyName}*\n\n` +
    `💰 *Total Package Price:* *${totalPkr.toLocaleString()} PKR*${sarLine}\n\n` +
    `*💳 Bank Transfer:*\n` +
    `• Bank:   ${payment.bankName}\n` +
    `• Title:  ${payment.accountTitle}\n` +
    `• Acc No: ${payment.accountNumber}\n` +
    `• IBAN:   ${payment.iban}\n\n` +
    `*📸 Next Step (Status: PAYMENT PENDING):*\n` +
    `Please reply here by uploading a photo or PDF of your *payment receipt* to submit for Accounts verification.` +
    MENU_FOOTER
  );
}

// ── Visa Submitted Confirmation ────────────────────────────────
function visaSubmittedMessage() {
  const agencyName = getAgencyName();
  return (
    `✅ *Application Received — ${agencyName}!*\n\n` +
    `Thank you for choosing ${agencyName}. 🌙\n\n` +
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
  const agencyName = getAgencyName();
  let msg = `🚗 *Transport & Ziyarat Rates — ${agencyName}*\n\n`;
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
  const route = TRANSPORT_ROUTES.find(r => r.id === routeId);
  const vehicle = VEHICLES.find(v => v.id === vehicleId);
  if (!route || !vehicle) return 'Could not find rate.' + MENU_FOOTER;

  const agencyName = getAgencyName();
  const rate = route.rates[vehicle.key];
  return (
    `🚗 *Transport Rate — ${agencyName}*\n\n` +
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
    `✈️ *Flight Ticket Queries*\n\n` +
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
    `📞 *Helpline*\n\n` +
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

// ── Hotel Message Builders ────────────────────────────────────
function hotelCityChoiceMenu() {
  return (
    `🏨 *Umrah Hotel Rates & Accommodation*\n\n` +
    `Please select which city you would like to view/book first:\n\n` +
    `1️⃣  *Makkah Hotels*\n` +
    `2️⃣  *Madinah Hotels*\n\n` +
    `_(Reply 1 or 2)_` +
    MENU_FOOTER
  );
}



function hotelCatalogMenu(city, catalog) {
  let text = `🏨 *${city} Hotel Catalog*\n\n`;
  if (!catalog || catalog.length === 0) {
    text += `No hotel listings available for ${city} at this time.`;
    text += MENU_FOOTER;
    return text;
  }

  catalog.forEach((h, i) => {
    const distText = h.distance ? ` (${h.distance})` : '';
    text += `${i + 1}️⃣  *${h.name}*${distText}\n`;
    if (h.location) text += `    📍 Location: ${h.location}\n`;
    const minRate = h.rates ? (h.rates.double || h.rates.sharing || h.rates.quad || h.rates.triple || h.rates.room) : null;
    text += `    💰 Room Rate: ${minRate ? 'From ' + minRate + ' SAR/night (per pax)' : 'On Booking'}\n\n`;
  });

  text += `Please select your hotel _(reply 1–${catalog.length})_:`;
  text += MENU_FOOTER;
  return text;
}

function hotelRoomTypeMenu(hotel, roomIndex = 1, totalRooms = 1) {
  const r = hotel.rates || {};
  const roomPrefix = totalRooms > 1 ? `Room ${roomIndex} of ${totalRooms} (` : '';
  const roomSuffix = totalRooms > 1 ? `)` : '';
  let text = `🛏️ *Select Room Category for ${roomPrefix}${hotel.name}${roomSuffix}*\n\n`;
  let idx = 1;
  const optionsMap = {};

  if (r.room) {
    text += `${idx}️⃣  Full Room — *${r.room} SAR/night (per pax)*\n`;
    optionsMap[idx++] = { key: 'room', label: 'Full Room', paxCapacity: 1 };
  }
  if (r.double) {
    text += `${idx}️⃣  Double Room (2 Bed) — *${r.double} SAR/night (per pax)*\n`;
    optionsMap[idx++] = { key: 'double', label: 'Double Room (2 Bed)', paxCapacity: 2 };
  }
  if (r.triple) {
    text += `${idx}️⃣  Triple Room (3 Bed) — *${r.triple} SAR/night (per pax)*\n`;
    optionsMap[idx++] = { key: 'triple', label: 'Triple Room (3 Bed)', paxCapacity: 3 };
  }
  if (r.quad) {
    text += `${idx}️⃣  Quad Room (4 Bed) — *${r.quad} SAR/night (per pax)*\n`;
    optionsMap[idx++] = { key: 'quad', label: 'Quad Room (4 Bed)', paxCapacity: 4 };
  }
  if (r.sharing) {
    text += `${idx}️⃣  Sharing (5 Bed) — *${r.sharing} SAR/night (per pax)*\n`;
    optionsMap[idx++] = { key: 'sharing', label: 'Sharing (5 Bed)', paxCapacity: 5 };
  }

  text += `\nPlease select your room option _(reply 1–${idx - 1})_:`;
  text += MENU_FOOTER;
  return { text, optionsMap };
}

function hotelOnBookingEscalation(hotel) {
  const link = `https://wa.me/${CONTACTS.ticketing.replace('+', '')}`;
  return (
    `📞 *${hotel.name}*\n\n` +
    `Rates for this hotel are available *On Booking* only.\n\n` +
    `Please contact our reservation desk directly on WhatsApp to check live room availability and custom rates:\n\n` +
    `📱 *WhatsApp Helpline:* ${CONTACTS.helpline}\n` +
    `📞 *Hotels & Ticketing:* ${CONTACTS.ticketing}\n` +
    `🔗 ${link}` +
    MENU_FOOTER
  );
}

function hotelSingleSummaryMessage(booking, exchangeInfo) {
  const agencyName = getAgencyName();
  let pkrText = '';
  if (exchangeInfo && exchangeInfo.convertToPkr) {
    const pkrTotal = exchangeInfo.convertToPkr(booking.cityTotal).toLocaleString();
    pkrText = `\n🇵🇰 *Total in PKR:* approx. *${pkrTotal} PKR* _(Rate: ${exchangeInfo.effectiveRate} PKR/SAR)_\n`;
  }

  return (
    `📋 *Hotel Accommodation Summary*\n\n` +
    `🏨 *${booking.hotelName}* (${booking.city})\n` +
    `🛏️ Room Category: *${booking.roomType}*\n` +
    `🌙 Stay Duration: *${booking.nights} night(s)* @ ${booking.ratePerNight} SAR/night\n` +
    `💰 *Subtotal:* *${booking.cityTotal} SAR*` +
    pkrText +
    `\nThank you for choosing ${agencyName}! Our representative will contact you shortly to complete your voucher.` +
    MENU_FOOTER
  );
}

function hotelCombinedSummaryMessage(makkah, madinah, exchangeInfo) {
  const agencyName = getAgencyName();
  const grandTotalSAR = (makkah.cityTotal || 0) + (madinah.cityTotal || 0);

  let pkrText = '';
  if (exchangeInfo && exchangeInfo.convertToPkr) {
    const pkrTotal = exchangeInfo.convertToPkr(grandTotalSAR).toLocaleString();
    pkrText = `\n🇵🇰 *Grand Total in PKR:* approx. *${pkrTotal} PKR* _(Rate: ${exchangeInfo.effectiveRate} PKR/SAR)_\n`;
  }

  return (
    `🎉 *Complete Umrah Hotel Package Summary*\n\n` +
    `🕋 *Makkah Hotel:* ${makkah.hotelName}\n` +
    `   • Category: ${makkah.roomType}\n` +
    `   • Duration: ${makkah.nights} night(s) @ ${makkah.ratePerNight} SAR/night\n` +
    `   • Subtotal: *${makkah.cityTotal} SAR*\n\n` +
    `🕌 *Madinah Hotel:* ${madinah.hotelName}\n` +
    `   • Category: ${madinah.roomType}\n` +
    `   • Duration: ${madinah.nights} night(s) @ ${madinah.ratePerNight} SAR/night\n` +
    `   • Subtotal: *${madinah.cityTotal} SAR*\n\n` +
    `💰 *Grand Total (Hotels): ${grandTotalSAR} SAR*` +
    pkrText +
    `\nThank you for choosing ${agencyName}! Our representative will contact you to finalize your booking.` +
    MENU_FOOTER
  );
}

// ── Umrah Packages Message Builders ──────────────────────────
function packageTypeMenu() {
  return (
    `🕋 *Umrah Packages — Complete Solutions*\n\n` +
    `Please select an option:\n\n` +
    `1️⃣  *Fixed Umrah Packages* (Official Flyer Deals)\n` +
    `2️⃣  *Make Your Own Package* (Customized Builder)\n\n` +
    `_(Reply 1 or 2)_` +
    MENU_FOOTER
  );
}

function packageFixedCityMenu() {
  return (
    `✈️ *Select Departure City (Fixed Packages)*\n\n` +
    `Please select your departure city sector:\n\n` +
    `1️⃣  *Islamabad* (Saudia Airlines — 15 & 21 Days)\n` +
    `2️⃣  *Lahore* (Saudia Airlines — 21 Days)\n` +
    `3️⃣  *Karachi* (PIA — 21 Days)\n` +
    `4️⃣  *Multan* (Saudia Airlines — 21 Days)\n` +
    `5️⃣  *Peshawar* (Saudia / Connecting)\n\n` +
    `_(Reply 1, 2, 3, 4, or 5)_` +
    MENU_FOOTER
  );
}

function packageFixedDurationMenu(cityObj) {
  return (
    `🗓️ *Select Duration for ${cityObj.cityName}*\n\n` +
    `1️⃣  *15 Days Package* (14 Nights: 8 Nights Makkah + 6 Nights Madinah)\n` +
    `2️⃣  *20/21 Days Package* (20 Nights: 12 Nights Makkah + 8 Nights Madinah)\n\n` +
    `_(Reply 1 or 2)_` +
    MENU_FOOTER
  );
}

function packageFixedHotelCombosMenu(hotels, durationKey) {
  let text = `🏨 *Select Fixed Hotel Package*\n\n`;
  hotels.forEach((h) => {
    const rates = durationKey === '15_DAYS' ? h.rates15 : h.rates20 || h.rates21;
    const sh = rates.sharing ? `${rates.sharing.toLocaleString()} PKR` : 'N/A';
    const qd = rates.quad ? `${rates.quad.toLocaleString()} PKR` : 'N/A';
    const tr = rates.triple ? `${rates.triple.toLocaleString()} PKR` : 'N/A';
    const db = rates.double ? `${rates.double.toLocaleString()} PKR` : 'N/A';

    text += `*Package #${h.id}:*\n`;
    text += `🕋 Makkah: *${h.makkah}*\n`;
    text += `🕌 Madinah: *${h.madinah}*\n`;
    text += `💰 *Rates (PKR/Pax):*\n`;
    text += `   • Sharing: *${sh}* | Quad: *${qd}*\n`;
    text += `   • Triple: *${tr}* | Double: *${db}*\n\n`;
  });
  text += `Please select package number _(reply 1–${hotels.length})_:`;
  text += MENU_FOOTER;
  return text;
}

function packageFixedRoomTypeMenu(hotelCombo, durationKey) {
  const rates = durationKey === '15_DAYS' ? hotelCombo.rates15 : hotelCombo.rates20 || hotelCombo.rates21;
  let text = `🛏️ *Select Room Sharing Option*\n\n`;
  text += `Package: *${hotelCombo.makkah}* + *${hotelCombo.madinah}*\n\n`;
  const map = {};
  let idx = 1;

  if (rates.sharing) {
    text += `${idx}️⃣  *Sharing Room* — *${rates.sharing.toLocaleString()} PKR/person*\n`;
    map[idx++] = { key: 'sharing', label: 'Sharing Room', rate: rates.sharing, paxPerRoom: 5 };
  }
  if (rates.quad) {
    text += `${idx}️⃣  *Quad Room (4 Bed)* — *${rates.quad.toLocaleString()} PKR/person*\n`;
    map[idx++] = { key: 'quad', label: 'Quad Room (4 Bed)', rate: rates.quad, paxPerRoom: 4 };
  }
  if (rates.triple) {
    text += `${idx}️⃣  *Triple Room (3 Bed)* — *${rates.triple.toLocaleString()} PKR/person*\n`;
    map[idx++] = { key: 'triple', label: 'Triple Room (3 Bed)', rate: rates.triple, paxPerRoom: 3 };
  }
  if (rates.double) {
    text += `${idx}️⃣  *Double Room (2 Bed)* — *${rates.double.toLocaleString()} PKR/person*\n`;
    map[idx++] = { key: 'double', label: 'Double Room (2 Bed)', rate: rates.double, paxPerRoom: 2 };
  }

  text += `\nPlease select room type _(reply 1–${idx - 1})_:`;
  text += MENU_FOOTER;
  return { text, map };
}

function packageCustomDurationMenu() {
  return (
    `🗓️ *Select Package Duration*\n\n` +
    `Choose your preferred stay duration:\n\n` +
    `1️⃣  *14 Days Package* (14 Nights: 8 Nights Makkah + 6 Nights Madinah)\n` +
    `2️⃣  *21 Days Package* (20/21 Nights: 12 Nights Makkah + 8 Nights Madinah)\n\n` +
    `_(Reply 1 or 2)_` +
    MENU_FOOTER
  );
}

function packageCustomCityMenu() {
  return (
    `🛫 *Select City of Travel*\n\n` +
    `Select your departure city to include group flight tickets:\n\n` +
    `1️⃣  *Islamabad* — Ticket: *164,000 PKR*\n` +
    `2️⃣  *Lahore* — Ticket: *164,000 PKR*\n` +
    `3️⃣  *Karachi* — Ticket: *140,000 PKR*\n` +
    `4️⃣  *Multan* — Ticket: *164,000 PKR*\n` +
    `5️⃣  *Peshawar* — Ticket: *164,000 PKR*\n\n` +
    `_(Reply 1, 2, 3, 4, or 5)_` +
    MENU_FOOTER
  );
}

function packageCustomTransportMenu(passengersCount = 1) {
  return (
    `🚐 *Select Vehicle / Transport Type*\n\n` +
    `Visa with full Umrah transport (JED–MAK–MED–MAK–JED) is included.\n` +
    `Please select your vehicle for *${passengersCount} passenger(s)*:\n\n` +
    `1️⃣  *Standard Car / Sedan* (Up to 4 Pax)\n` +
    `2️⃣  *GMC / SUV Luxury* (Up to 7 Pax)\n` +
    `3️⃣  *Toyota HiAce / Commuter* (Up to 10 Pax)\n` +
    `4️⃣  *Toyota Coaster* (Up to 20 Pax)\n` +
    `5️⃣  *Luxury Bus* (Up to 49 Pax)\n\n` +
    `_(Reply 1, 2, 3, 4, or 5)_` +
    MENU_FOOTER
  );
}

function packageCustomFlightDateMenu(flights, cityName, durationText) {
  let text = `✈️ *Available Group Flight Dates (${cityName} — ${durationText})*\n\n`;
  text += `Select your travel dates from available confirmed group seats:\n\n`;
  flights.forEach((f, i) => {
    const seatInfo = f.seats ? ` [💺 ${f.seats} seats available]` : '';
    text += `${i + 1}️⃣  *${f.dates}*\n    🛫 ${f.route}${seatInfo}\n\n`;
  });
  text += `Please select your flight date _(reply 1–${flights.length})_:`;
  text += MENU_FOOTER;
  return text;
}

function packageCustomSummaryMessage(pkg) {
  const totalPkr = (pkg.totalPkr || 0).toLocaleString();
  const ticketPkr = (pkg.ticketTotalPkr || 0).toLocaleString();

  return (
    `🎉 *Complete Umrah Package Summary*\n\n` +
    `👤 *Family Head:* ${pkg.familyHeadName || 'Customer'}\n` +
    `👥 *Total Passengers:* ${pkg.passengersCount} Pax\n` +
    `🗓️ *Duration:* ${pkg.durationDays} Days (${pkg.durationNights} Nights: ${pkg.makkahNights}N Makkah + ${pkg.madinahNights}N Madinah)\n` +
    `🛫 *Departure City:* ${pkg.cityName} (${pkg.airline || 'Saudia / PIA'})\n` +
    `✈️ *Flight Dates:* ${pkg.flightDates || 'Confirmed Group Flight'}\n` +
    `🎟️ *Ticket Total:* ${ticketPkr} PKR (${pkg.ticketRatePerPax.toLocaleString()} PKR/Pax)\n\n` +
    `🪪 *Visa & Transport:* Visa WITH Full Transport Included (${pkg.vehicleType})\n\n` +
    `🕋 *Makkah Accommodation:* ${pkg.makkahHotelName}\n` +
    `   • Duration: ${pkg.makkahNights} Nights\n` +
    `   • Category: ${pkg.makkahRoomType} (${pkg.makkahTotalSar} SAR)\n\n` +
    `🕌 *Madinah Accommodation:* ${pkg.madinahHotelName}\n` +
    `   • Duration: ${pkg.madinahNights} Nights\n` +
    `   • Category: ${pkg.madinahRoomType} (${pkg.madinahTotalSar} SAR)\n\n` +
    `💰 *Grand Total (All-Inclusive):* *${totalPkr} PKR*\n\n` +
    `Do you agree to confirm and proceed with this package?\n` +
    `Reply *YES* to proceed to passport upload or *NO* to go back.` +
    MENU_FOOTER
  );
}

module.exports = {
  MENU_FOOTER,
  mainMenu,
  visaTypeMenu,
  longStayVisaDetails,
  visaWithTransportPassengerMenu,
  visaWithoutTransportInfo,
  firstLegTransportMenu,
  firstLegRouteMenu,
  vehicleSelectionMenu,
  hajjTerminalQuestion,
  rateConfirmation,
  requestTicketImage,
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
  hotelCityChoiceMenu,
  hotelCatalogMenu,
  hotelRoomTypeMenu,
  hotelOnBookingEscalation,
  hotelSingleSummaryMessage,
  hotelCombinedSummaryMessage,
  packageTypeMenu,
  packageFixedCityMenu,
  packageFixedDurationMenu,
  packageFixedHotelCombosMenu,
  packageFixedRoomTypeMenu,
  packageCustomDurationMenu,
  packageCustomCityMenu,
  packageCustomTransportMenu,
  packageCustomFlightDateMenu,
  packageCustomSummaryMessage,
  packagePaymentDetails,
};

