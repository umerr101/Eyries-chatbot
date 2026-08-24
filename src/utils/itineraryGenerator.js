// ============================================================
//  utils/itineraryGenerator.js — Dynamic PDF Itinerary & Scannable QR Voucher Generator
// ============================================================

const fs        = require('fs');
const path      = require('path');
const QRCode    = require('qrcode');
const puppeteer = require('puppeteer');
const { AGENCY, CONTACTS, PAYMENT } = require('../config');

const ITINERARY_DIR = path.resolve(__dirname, '..', '..', 'itineraries');
if (!fs.existsSync(ITINERARY_DIR)) {
  fs.mkdirSync(ITINERARY_DIR, { recursive: true });
}

// Chrome path resolution
const CHROME_PATH = process.env.CHROME_PATH ||
  (fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe');

/**
 * Generates a Unique Voucher ID (e.g. EYR-20260821-5850, SST-20260821-1234, MST-20260821-9876)
 */
function generateVoucherId() {
  const { loadClientConfig } = require('../configLoader');
  const client = loadClientConfig();
  const clientId = (client.clientId || process.env.CLIENT_ID || '').toLowerCase();
  const agencyUpper = (client.agencyName || '').toUpperCase();

  let prefix = 'EYR';
  if (clientId === 'six_sigma' || agencyUpper.includes('SIX SIGMA')) {
    prefix = 'SST';
  } else if (clientId === 'masarat_group' || agencyUpper.includes('MASARAT')) {
    prefix = 'MST';
  } else {
    prefix = 'EYR';
  }

  const now = new Date();
  const dateStr = now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${dateStr}-${rand}`;
}

function getLocalIpAddress() {
  try {
    const interfaces = os.networkInterfaces();
    for (const devName in interfaces) {
      const iface = interfaces[devName];
      for (let i = 0; i < iface.length; i++) {
        const alias = iface[i];
        if (alias.family === 'IPv4' && !alias.internal && alias.address !== '127.0.0.1') {
          return alias.address;
        }
      }
    }
  } catch (_) {}
  return 'localhost';
}

/**
 * Generates a PDF Travel Itinerary Voucher with Embedded QR Code & Agency Logo.
 * @param {object} bookingData - Complete booking details
 * @returns {Promise<{ pdfPath: string, voucherId: string, qrDataUrl: string }>}
 */
async function generateItineraryPdf(bookingData = {}) {
  const { loadClientConfig } = require('../configLoader');
  const activeClient = loadClientConfig();
  const agencyName = activeClient.agencyName || AGENCY.name || 'Eyries Holidays';

  const voucherId = bookingData.voucherId || generateVoucherId();
  const issueDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const isApproved = (bookingData.status || '').toUpperCase().includes('APPROVED') || (bookingData.status || '').toUpperCase().includes('CONFIRMED');
  const statusLabel = isApproved ? 'APPROVED / CONFIRMED' : 'PAYMENT PENDING';

  // 1. Prepare Agency Logo Base64 dynamically for active client
  let logoDataUrl = '';
  try {
    const logoRelPath = activeClient.logoPath || AGENCY.logoPath || 'assets/eyries_logo.png';
    const logoFile = path.resolve(__dirname, '..', '..', logoRelPath);
    if (fs.existsSync(logoFile)) {
      const logoBuf = fs.readFileSync(logoFile);
      const ext = path.extname(logoFile).toLowerCase().replace('.', '') || 'png';
      const mime = (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' : 'image/png';
      logoDataUrl = `data:${mime};base64,${logoBuf.toString('base64')}`;
    }
  } catch (err) {
    console.warn('[ItineraryGenerator] Could not load agency logo:', err.message);
  }

  // 2. Generate Scannable QR Code DataURL (Direct PDF link so scanning opens PDF in browser)
  const hostIp = getLocalIpAddress();
  const defaultBaseUrl = `http://${hostIp}:${process.env.PORT || 3000}/vouchers`;
  const baseUrl = process.env.VOUCHER_BASE_URL || process.env.PUBLIC_URL || defaultBaseUrl;
  const voucherPdfUrl = `${baseUrl.replace(/\/$/, '')}/Voucher_${voucherId}.pdf`;
  const qrDataUrl = await QRCode.toDataURL(voucherPdfUrl, { width: 140, margin: 1 });

  // 3. Build Dynamic HTML Template (Strictly render booked items only)
  const htmlContent = buildVoucherHtml({
    voucherId,
    issueDate,
    agencyName,
    logoDataUrl,
    qrDataUrl,
    statusLabel,
    isApproved,
    bookingData
  });

  // 4. Render PDF using Puppeteer
  const pdfPath = path.join(ITINERARY_DIR, `Voucher_${voucherId}.pdf`);
  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: CHROME_PATH,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' }
    });
    console.log(`[ItineraryGenerator] Successfully generated PDF itinerary (${statusLabel}): ${pdfPath}`);
    return { pdfPath, voucherId, qrDataUrl, statusLabel };
  } finally {
    if (browser) {
      try { await browser.close(); } catch (_) {}
    }
  }
}

/**
 * Builds dynamic HTML markup for the itinerary voucher
 */
function buildVoucherHtml({ voucherId, issueDate, agencyName, logoDataUrl, qrDataUrl, statusLabel, isApproved, bookingData }) {
  const { loadClientConfig } = require('../configLoader');
  const activeClient = loadClientConfig();
  const passengers = bookingData.passengers || [];
  const hasPassports = passengers.length > 0 && (passengers[0].firstName || passengers[0].passportNumber);

  // If passports uploaded, head name is from 1st passport; if no passports, familyHeadName from prompt
  const displayHeadName = hasPassports
    ? `${passengers[0].firstName || ''} ${passengers[0].lastName || ''}`.trim()
    : (bookingData.familyHeadName || 'Valued Customer');

  const headLabel = hasPassports ? 'HEAD PASSENGER' : 'FAMILY HEAD';
  const statusBg = isApproved ? '#276749' : '#dd6b20';

  // ── Determine which sections to render dynamically ───────
  const hasVisa = bookingData.flow === 'VISA' || bookingData.flow?.startsWith('PACKAGE') || hasPassports;
  const hasHotels = !!(bookingData.makkahBooking || bookingData.madinahBooking || bookingData.makkahHotelName || bookingData.selectedCombo);
  const hasTransport = !!(bookingData.transportRoute || bookingData.addFirstLeg || bookingData.flow === 'TRANSPORT' || bookingData.departureDate || bookingData.flightDates || bookingData.selectedFlight);

  // 1. Passengers Section HTML
  let passengersSectionHtml = '';
  if (hasVisa && hasPassports) {
    let passengerRows = '';
    passengers.forEach((p, idx) => {
      passengerRows += `
        <tr>
          <td style="text-align:center; font-weight:bold;">${idx + 1}</td>
          <td style="text-align:center; font-weight:bold;">${p.passportNumber || 'N/A'}</td>
          <td style="font-weight:bold; color:#1a365d;">${p.firstName || ''} ${p.lastName || ''}</td>
          <td style="text-align:center;">${p.nationality || 'Pakistani'}</td>
          <td style="text-align:center;">${p.expiryDate || 'N/A'}</td>
          <td style="text-align:center; font-weight:bold;">${p.passengerType || p.type || 'ADT'}</td>
          <td style="text-align:center; font-weight:bold; color:${statusBg};">${isApproved ? 'Approved' : 'Pending'}</td>
        </tr>
      `;
    });

    passengersSectionHtml = `
      <div class="section-title">Passenger & Visa Details</div>
      <table class="data-table">
        <thead>
          <tr>
            <th style="width:5%; text-align:center;">#</th>
            <th style="width:20%; text-align:center;">Passport No</th>
            <th style="width:35%;">Passenger Full Name</th>
            <th style="width:15%; text-align:center;">Nationality</th>
            <th style="width:15%; text-align:center;">Expiry Date</th>
            <th style="width:5%; text-align:center;">Type</th>
            <th style="width:5%; text-align:center;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${passengerRows}
        </tbody>
      </table>
    `;
  }

  // ── Helper to parse date flexibly ──
  function parseDateFlexible(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return new Date();
    const clean = dateStr.trim();
    const matchDmy = clean.match(/(\d{1,2})[\s/-]?([A-Za-z]{3})[\s/-]?(\d{2,4})/);
    if (matchDmy) {
      const day = parseInt(matchDmy[1], 10);
      const monStr = matchDmy[2].toLowerCase();
      let year = parseInt(matchDmy[3], 10);
      if (year < 100) year += 2000;
      const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
      const month = months[monStr] !== undefined ? months[monStr] : 8;
      return new Date(year, month, day);
    }
    const isoMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return new Date(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10));
    }
    const d = new Date(clean);
    return isNaN(d.getTime()) ? new Date() : d;
  }

  function formatDateDisplay(d) {
    if (!d || isNaN(d.getTime())) return '06-Aug-26';
    const day = String(d.getDate()).padStart(2, '0');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const mon = monthNames[d.getMonth()];
    const yr = String(d.getFullYear()).slice(-2);
    return `${day}-${mon}-${yr}`;
  }

  function addDays(d, days) {
    const result = new Date(d);
    result.setDate(result.getDate() + days);
    return result;
  }

  // 2. Accommodation Section HTML
  let accommodationSectionHtml = '';
  if (hasHotels) {
    let startStr = '';
    const dateField = bookingData.flightDates || bookingData.selectedFlight?.dates || bookingData.departureDate || '';
    if (dateField.includes('–')) {
      startStr = dateField.split('–')[0].trim();
    } else if (dateField.includes('-')) {
      startStr = dateField.split('-')[0].trim();
    } else {
      startStr = dateField || '02 Sep 2026';
    }

    const startDate = parseDateFlexible(startStr);
    const makkahNights = bookingData.makkahNights || (bookingData.durationDays === 21 ? 12 : (bookingData.durationDays === 14 ? 8 : (bookingData.durationDays === 20 ? 12 : 8)));
    const madinahNights = bookingData.madinahNights || (bookingData.durationDays === 21 ? 8 : (bookingData.durationDays === 14 ? 6 : (bookingData.durationDays === 20 ? 8 : 6)));

    const makkahCheckin = new Date(startDate);
    const makkahCheckout = addDays(makkahCheckin, makkahNights);
    const madinahCheckin = new Date(makkahCheckout);
    const madinahCheckout = addDays(madinahCheckin, madinahNights);
    const totalNights = makkahNights + madinahNights;

    const makHotel = bookingData.makkahHotelName || bookingData.selectedCombo?.makkah || bookingData.makkahBooking?.hotelName || 'Makkah Hotel';
    const medHotel = bookingData.madinahHotelName || bookingData.selectedCombo?.madinah || bookingData.madinahBooking?.hotelName || 'Madinah Hotel';
    const makRoom = bookingData.makkahRoomType || bookingData.selectedRoom?.label || bookingData.makkahBooking?.roomType || 'Standard Room';
    const medRoom = bookingData.madinahRoomType || bookingData.selectedRoom?.label || bookingData.madinahBooking?.roomType || 'Standard Room';

    accommodationSectionHtml = `
      <div class="section-title">Accommodation</div>
      <table class="data-table">
        <thead>
          <tr>
            <th style="width:10%; text-align:center;">City</th>
            <th style="width:28%;">Hotel Name</th>
            <th style="width:18%; text-align:center;">Room Type</th>
            <th style="width:12%; text-align:center;">Checkin</th>
            <th style="width:12%; text-align:center;">Checkout</th>
            <th style="width:6%; text-align:center;">Nights</th>
            <th style="width:7%; text-align:center;">View Type</th>
            <th style="width:7%; text-align:center;">Meal Type</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="text-align:center; font-weight:bold;">Makkah</td>
            <td style="font-weight:bold;">${makHotel}</td>
            <td style="text-align:center;">${makRoom}</td>
            <td style="text-align:center; font-weight:bold;">${formatDateDisplay(makkahCheckin)}</td>
            <td style="text-align:center; font-weight:bold;">${formatDateDisplay(makkahCheckout)}</td>
            <td style="text-align:center; font-weight:bold;">${makkahNights}</td>
            <td style="text-align:center; font-size:10px;">Non View - NV</td>
            <td style="text-align:center; font-size:10px;">Room Only - RO</td>
          </tr>
          <tr>
            <td style="text-align:center; font-weight:bold;">Medina</td>
            <td style="font-weight:bold;">${medHotel}</td>
            <td style="text-align:center;">${medRoom}</td>
            <td style="text-align:center; font-weight:bold;">${formatDateDisplay(madinahCheckin)}</td>
            <td style="text-align:center; font-weight:bold;">${formatDateDisplay(madinahCheckout)}</td>
            <td style="text-align:center; font-weight:bold;">${madinahNights}</td>
            <td style="text-align:center; font-size:10px;">Non View - NV</td>
            <td style="text-align:center; font-size:10px;">Room Only - RO</td>
          </tr>
          <tr style="background-color: #f1f5f9; font-weight:bold;">
            <td colspan="5" style="text-align:right; font-weight:bold; padding-right:15px;">Total Nights:</td>
            <td style="text-align:center; font-weight:bold; color:#1a365d;">${totalNights}</td>
            <td colspan="2"></td>
          </tr>
        </tbody>
      </table>
    `;
  }

  // 3. Flight Travel Schedule & Route Section HTML (Arrival & Departure Details)
  let transportSectionHtml = '';
  const routeStr = bookingData.flightRoute || bookingData.selectedFlight?.route || '';
  const datesStr = bookingData.flightDates || bookingData.selectedFlight?.dates || bookingData.departureDate || '02 Sep – 16 Sep 2026';

  let arrFlight = 'SV-723';
  let arrSector = 'ISB-JED';
  let arrDep = '02-Aug 0640';
  let arrArr = '02-Aug 1005';

  let depFlight = 'SV-726';
  let depSector = 'JED-ISB';
  let depDep = '16-Aug 1100';
  let depArr = '16-Aug 1730';

  let outDateObj = new Date();
  let retDateObj = new Date();
  if (datesStr.includes('–')) {
    const parts = datesStr.split('–');
    outDateObj = parseDateFlexible(parts[0]);
    retDateObj = parseDateFlexible(parts[1]);
  } else if (datesStr.includes('-')) {
    const parts = datesStr.split('-');
    outDateObj = parseDateFlexible(parts[0]);
    retDateObj = parseDateFlexible(parts[1]);
  } else {
    outDateObj = parseDateFlexible(datesStr);
    retDateObj = addDays(outDateObj, 14);
  }

  const outDayMon = `${String(outDateObj.getDate()).padStart(2, '0')}-${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][outDateObj.getMonth()]}`;
  const retDayMon = `${String(retDateObj.getDate()).padStart(2, '0')}-${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][retDateObj.getMonth()]}`;

  arrDep = `${outDayMon} 0640`;
  arrArr = `${outDayMon} 1005`;
  depDep = `${retDayMon} 1100`;
  depArr = `${retDayMon} 1730`;

  const cityCode = (bookingData.cityName || bookingData.selectedCityObj?.cityName || '').toUpperCase().includes('LAHORE') ? 'LHE' :
                   (bookingData.cityName || bookingData.selectedCityObj?.cityName || '').toUpperCase().includes('KARACHI') ? 'KHI' :
                   (bookingData.cityName || bookingData.selectedCityObj?.cityName || '').toUpperCase().includes('MULTAN') ? 'MUX' :
                   (bookingData.cityName || bookingData.selectedCityObj?.cityName || '').toUpperCase().includes('PESHAWAR') ? 'PEW' : 'ISB';

  arrSector = `${cityCode}-JED`;
  depSector = `JED-${cityCode}`;

  if (routeStr.includes('/')) {
    const legs = routeStr.split('/');
    const l1 = legs[0].trim();
    const l2 = legs[1].trim();

    const m1 = l1.match(/([A-Z0-9]+)\s+(\d{1,2}[A-Z]{3}\d{0,4})?\s*([A-Z]{3}-[A-Z]{3})/i);
    if (m1) {
      arrFlight = m1[1];
      if (m1[3]) arrSector = m1[3].toUpperCase();
    }
    const m2 = l2.match(/([A-Z0-9]+)\s+(\d{1,2}[A-Z]{3}\d{0,4})?\s*([A-Z]{3}-[A-Z]{3})/i);
    if (m2) {
      depFlight = m2[1];
      if (m2[3]) depSector = m2[3].toUpperCase();
    }
  } else if (bookingData.flight_numbers) {
    arrFlight = bookingData.short_carrier || bookingData.flight_numbers;
    depFlight = bookingData.short_carrier || bookingData.flight_numbers;
  }

  transportSectionHtml = `
    <div class="section-title">Flight Schedule</div>
    <table style="width:100%; border-collapse:collapse; margin-bottom:12px;">
      <tr>
        <td style="width:49%; vertical-align:top; padding-right:1%;">
          <table class="data-table" style="margin-bottom:0;">
            <thead>
              <tr>
                <th colspan="4" style="text-align:center; background-color:#1e3a8a; color:#fff;">Arrival ( PK to SA )</th>
              </tr>
              <tr>
                <th style="width:25%; text-align:center;">Flight</th>
                <th style="width:25%; text-align:center;">Sector</th>
                <th style="width:25%; text-align:center;">Departure</th>
                <th style="width:25%; text-align:center;">Arrival</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="text-align:center; font-weight:bold; color:#1a365d;">${arrFlight}</td>
                <td style="text-align:center; font-weight:bold;">${arrSector}</td>
                <td style="text-align:center;">${arrDep}</td>
                <td style="text-align:center;">${arrArr}</td>
              </tr>
            </tbody>
          </table>
        </td>
        <td style="width:49%; vertical-align:top; padding-left:1%;">
          <table class="data-table" style="margin-bottom:0;">
            <thead>
              <tr>
                <th colspan="4" style="text-align:center; background-color:#1e3a8a; color:#fff;">Departure ( SA to PK )</th>
              </tr>
              <tr>
                <th style="width:25%; text-align:center;">Flight</th>
                <th style="width:25%; text-align:center;">Sector</th>
                <th style="width:25%; text-align:center;">Departure</th>
                <th style="width:25%; text-align:center;">Arrival</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="text-align:center; font-weight:bold; color:#1a365d;">${depFlight}</td>
                <td style="text-align:center; font-weight:bold;">${depSector}</td>
                <td style="text-align:center;">${depDep}</td>
                <td style="text-align:center;">${depArr}</td>
              </tr>
            </tbody>
          </table>
        </td>
      </tr>
    </table>
  `;

  const grandTotalSar = bookingData.totalSar || 0;
  const pkrRate = bookingData.effectiveRate || '75.57';
  const grandTotalPkr = typeof bookingData.totalPkr === 'number' ? bookingData.totalPkr.toLocaleString() : (bookingData.totalPkr || (grandTotalSar * parseFloat(pkrRate)).toLocaleString());
  const bankInfo = activeClient.bankDetails || activeClient.payment || PAYMENT;
  const helpPhone = activeClient.adminPhone?.replace('@c.us', '') || CONTACTS.helpline;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Travel Itinerary Voucher - ${voucherId}</title>
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #222; margin: 0; padding: 0; font-size: 13px; line-height: 1.4; }
    .header-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
    .header-table td { vertical-align: top; }
    .logo-img { height: 75px; max-width: 200px; object-fit: contain; }
    .qr-img { height: 85px; width: 85px; }
    .voucher-title { font-size: 20px; font-weight: bold; color: #1a365d; text-align: right; text-transform: uppercase; margin-bottom: 4px; }
    .voucher-status { display: inline-block; background-color: ${statusBg}; color: white; padding: 4px 12px; font-size: 12px; font-weight: bold; border-radius: 3px; text-transform: uppercase; }
    
    .id-box { background-color: #ebf8ff; border: 1px solid #bee3f8; padding: 10px 14px; font-size: 14px; font-weight: bold; color: #2b6cb0; border-radius: 4px; margin-bottom: 15px; display: flex; justify-content: space-between; }
    
    .section-title { font-size: 14px; font-weight: bold; color: #1a365d; border-bottom: 2px solid #2b6cb0; padding-bottom: 4px; margin-top: 18px; margin-bottom: 8px; text-transform: uppercase; }
    
    table.data-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 12px; }
    table.data-table th { background-color: #2b6cb0; color: white; border: 1px solid #2b6cb0; padding: 6px 8px; text-align: left; font-weight: bold; }
    table.data-table td { border: 1px solid #cbd5e0; padding: 6px 8px; }
    table.data-table tr:nth-child(even) { background-color: #f7fafc; }
    
    .financial-box { background-color: #f0fff4; border: 1px solid #c6f6d5; border-radius: 4px; padding: 12px; margin-top: 15px; }
    .financial-table { width: 100%; border-collapse: collapse; }
    .financial-table td { padding: 4px 0; font-size: 13px; }
    
    .footer { margin-top: 25px; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 11px; color: #718096; text-align: center; }
  </style>
</head>
<body>

  <!-- Header -->
  <table class="header-table">
    <tr>
      <td style="width: 35%;">
        ${logoDataUrl ? `<img src="${logoDataUrl}" class="logo-img" />` : `<h2 style="margin:0; color:#1a365d;">${agencyName}</h2>`}
        <div style="font-weight:bold; margin-top:5px; font-size:14px;">${agencyName}</div>
        <div style="color:#718096; font-size:11px;">Official Travel Itinerary Voucher</div>
      </td>
      <td style="width: 30%; text-align: center;">
        <img src="${qrDataUrl}" class="qr-img" />
        <div style="font-size: 9px; color: #718096; margin-top: 2px;">Scan to Verify Itinerary</div>
      </td>
      <td style="width: 35%; text-align: right;">
        <div class="voucher-title">BOOKING VOUCHER</div>
        <div style="margin-bottom: 8px;"><span class="voucher-status">${statusLabel}</span></div>
        <div style="font-size: 11px; color: #4a5568;">Date: <strong>${issueDate}</strong></div>
        <div style="font-size: 11px; color: #4a5568;">HEAD PASSENGER: <strong>${displayHeadName}</strong></div>
      </td>
    </tr>
  </table>

  <!-- Voucher ID Banner -->
  <div class="id-box">
    <span>VOUCHER BOOKING ID: <strong>${voucherId}</strong></span>
    <span>${headLabel}: <strong>${displayHeadName}</strong></span>
    <span>STATUS: <span style="color:${statusBg};">${statusLabel}</span></span>
  </div>

  <!-- Dynamic Sections (Only show what user booked) -->
  ${passengersSectionHtml}
  ${accommodationSectionHtml}
  ${transportSectionHtml}

  <!-- Financial Summary -->
  <div class="financial-box">
    <table class="financial-table">
      <tr>
        <td><strong>Total Package Price (SAR):</strong></td>
        <td style="text-align:right; font-weight:bold; font-size:15px; color:#1a365d;">${grandTotalSar} SAR</td>
      </tr>
      <tr>
        <td><strong>PKR Converted Total (Rate: ${pkrRate} PKR/SAR):</strong></td>
        <td style="text-align:right; font-weight:bold; font-size:15px; color:#22543d;">approx. ${grandTotalPkr} PKR</td>
      </tr>
    </table>
  </div>

  <!-- Contacts & Footer -->
  <div style="margin-top: 15px; background-color:#edf2f7; padding:10px; border-radius:4px; font-size:11px;">
    <strong>Customer Support & Accounts Department:</strong><br>
    • Accounts / Payment Verification: +${helpPhone}<br>
    • Ticketing & Reservations: +${helpPhone}<br>
    • Payment Details: ${bankInfo.bankName} (${bankInfo.accountTitle} - IBAN: ${bankInfo.iban})
  </div>

  <div class="footer">
    Thank you for choosing <strong>${agencyName}</strong>! This is an official computer-generated travel voucher.<br>
    Generated on ${issueDate} • Voucher Reference: ${voucherId}
  </div>

</body>
</html>
  `;
}

module.exports = { generateItineraryPdf, generateVoucherId };
