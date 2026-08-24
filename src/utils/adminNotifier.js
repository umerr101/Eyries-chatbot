// ============================================================
//  utils/adminNotifier.js — Admin & Feeding Desk Forwarding Service
// ============================================================

const fs = require('fs');
const path = require('path');
const { MessageMedia } = require('whatsapp-web.js');
const { loadClientConfig } = require('../configLoader');

/**
 * Formats WhatsApp ID for sending messages to Feeding Desk / Admin
 */
function getAdminId() {
  const activeClient = loadClientConfig();
  const rawPhone = process.env.FEEDING_WHATSAPP || process.env.ADMIN_WHATSAPP || activeClient.feedingPhone || activeClient.adminPhone || '923180978480@c.us';
  const clean = rawPhone.replace(/[^0-9]/g, '');
  return `${clean}@c.us`;
}

/**
 * Sends order summary, passport images, and Master_Passports.xlsx to admin WhatsApp number (+923180978480).
 * @param {object} client  - whatsapp-web.js Client instance
 * @param {string} phone   - Customer WhatsApp ID
 * @param {object} session - Session object containing order details
 */
async function notifyAdminNewOrder(client, phone, session) {
  if (!client || typeof client.sendMessage !== 'function') {
    console.warn('[AdminNotifier] Client instance not available for admin notification.');
    return;
  }

  const adminId = getAdminId();
  const cleanPhone = (phone || '').replace('@c.us', '');

  const isHotel = session.flow === 'HOTEL' || !!session.makkahBooking || !!session.madinahBooking;
  let summaryMessage = '';

  if (isHotel) {
    const makkah = session.makkahBooking;
    const madinah = session.madinahBooking;
    const grandTotal = session.totalSar || (makkah?.cityTotal || 0) + (madinah?.cityTotal || 0);

    summaryMessage =
      `🚨 *NEW HOTEL BOOKING CONFIRMED!*\n\n` +
      `👤 *Customer Phone:* +${cleanPhone}\n` +
      (makkah ? `🕋 *Makkah Hotel:* ${makkah.hotelName} (${makkah.roomType}, ${makkah.nights} nights @ ${makkah.ratePerNight} SAR = ${makkah.cityTotal} SAR)\n` : '') +
      (madinah ? `🕌 *Madinah Hotel:* ${madinah.hotelName} (${madinah.roomType}, ${madinah.nights} nights @ ${madinah.ratePerNight} SAR = ${madinah.cityTotal} SAR)\n` : '') +
      `💰 *Grand Total (Hotels):* ${grandTotal} SAR\n` +
      `🇵🇰 *Total in PKR:* approx. ${session.totalPkr || 'N/A'} PKR\n\n` +
      `📎 _Forwarding PDF Travel Itinerary & Voucher below..._`;
  } else {
    const passengerCount = session.passengerCount || 1;
    const totalRate = session.finalVisaRate || session.totalSar || 0;
    const visaLabel = session.visaLabel || 'Visa Package';
    const depDate = session.departureDate || 'N/A';

    summaryMessage =
      `🚨 *NEW VISA ORDER CONFIRMED!*\n\n` +
      `👤 *Customer Phone:* +${cleanPhone}\n` +
      `📋 *Visa Package:* ${visaLabel}\n` +
      `👥 *Passenger Count:* ${passengerCount}\n` +
      `💰 *Grand Total:* ${totalRate} SAR\n` +
      `✈️ *Flight Departure Date:* ${depDate}\n\n` +
      `📎 _Forwarding ${passengerCount} passport photo(s) and Master_Passports.xlsx below..._`;
  }

  try {
    console.log(`[AdminNotifier] Sending order summary to Admin (${adminId})...`);
    await client.sendMessage(adminId, summaryMessage);
    await new Promise(res => setTimeout(res, 600));

    // Resolve passport image paths on disk (with fallback to uploads directory or in-memory list)
    let savedPaths = session.savedPassportPaths || [];
    if (savedPaths.length === 0) {
      const uploadDir = path.resolve(__dirname, '..', '..', 'uploads', 'passports', cleanPhone);
      if (fs.existsSync(uploadDir)) {
        const files = fs.readdirSync(uploadDir).filter(f => f.match(/\.(jpg|jpeg|png)$/i));
        savedPaths = files.map(f => path.join(uploadDir, f));
      }
    }

    const mediaList = session.passportMediaList || [];

    if (savedPaths.length > 0) {
      for (let i = 0; i < savedPaths.length; i++) {
        const filePath = savedPaths[i];
        if (filePath && fs.existsSync(filePath)) {
          try {
            const media = MessageMedia.fromFilePath(filePath);
            console.log(`[AdminNotifier] Forwarding passport image ${i + 1}/${savedPaths.length} to admin...`);
            await client.sendMessage(adminId, media, { caption: `📄 Passport Photo ${i + 1} of ${passengerCount} (Customer: +${cleanPhone})` });
            await new Promise(res => setTimeout(res, 800));
          } catch (mediaErr) {
            console.error(`[AdminNotifier] Error sending passport photo ${filePath}:`, mediaErr.message);
          }
        }
      }
    } else if (mediaList.length > 0) {
      for (let i = 0; i < mediaList.length; i++) {
        const m = mediaList[i];
        if (m && m.data) {
          try {
            const media = new MessageMedia(m.mimetype || 'image/jpeg', m.data, `passport_${i + 1}.jpg`);
            console.log(`[AdminNotifier] Forwarding in-memory passport image ${i + 1}/${mediaList.length} to admin...`);
            await client.sendMessage(adminId, media, { caption: `📄 Passport Photo ${i + 1} of ${passengerCount} (Customer: +${cleanPhone})` });
            await new Promise(res => setTimeout(res, 800));
          } catch (mediaErr) {
            console.error(`[AdminNotifier] Error sending passport photo ${i + 1}:`, mediaErr.message);
          }
        }
      }
    }

    // Forward Master_Passports.xlsx if this is a Visa or Package order with uploaded passport images
    const isVisaWithPassports = (session.flow === 'VISA' || session.flow?.startsWith('PACKAGE') || (session.passengers && session.passengers.length > 0)) && session.passportConfirmed;

    if (isVisaWithPassports) {
      const { exportExcelForWindow } = require('../ocr/pythonBridge');
      const orderId = session.voucherId || cleanPhone;
      try {
        console.log(`[AdminNotifier] Generating fresh Master_Passports.xlsx for visa window (${orderId}) with ${session.passengers?.length || 0} passengers...`);
        await exportExcelForWindow(orderId, session.passengers);
      } catch (e) {
        console.warn('[AdminNotifier] exportExcelForWindow warning:', e.message);
      }

      const excelPath = path.resolve(__dirname, '..', '..', 'Master_Passports.xlsx');
      if (fs.existsSync(excelPath)) {
        try {
          console.log(`[AdminNotifier] Forwarding Master_Passports.xlsx to admin (${adminId})...`);
          const excelMedia = MessageMedia.fromFilePath(excelPath);
          await client.sendMessage(adminId, excelMedia, { caption: `📊 Master_Passports.xlsx (Visa Order for +${cleanPhone})` });
          await new Promise(res => setTimeout(res, 800));
        } catch (excelErr) {
          console.error('[AdminNotifier] Error sending Master_Passports.xlsx:', excelErr.message);
        }
      }
    }

    // Forward PDF Itinerary Voucher if available
    if (session.itineraryPdfPath && fs.existsSync(session.itineraryPdfPath)) {
      try {
        console.log(`[AdminNotifier] Forwarding PDF Itinerary Voucher to admin (${adminId})...`);
        const pdfMedia = MessageMedia.fromFilePath(session.itineraryPdfPath);
        await client.sendMessage(adminId, pdfMedia, { caption: `📄 Travel Itinerary & Voucher (${session.voucherId || 'Approved'})` });
        await new Promise(res => setTimeout(res, 600));
      } catch (pdfErr) {
        console.error('[AdminNotifier] Error sending PDF Itinerary Voucher to admin:', pdfErr.message);
      }
    }

    console.log(`[AdminNotifier] Successfully sent all admin notifications to ${adminId}!`);
  } catch (err) {
    console.error('[AdminNotifier] Error sending admin notification:', err.message);
  }
}

module.exports = { notifyAdminNewOrder, getAdminId };
