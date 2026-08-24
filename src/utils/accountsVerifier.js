// ============================================================
//  utils/accountsVerifier.js — Accounts Payment Receipt Verification & Confirmation Engine
// ============================================================

const fs = require('fs');
const path = require('path');
const { MessageMedia } = require('whatsapp-web.js');
const { findSessionByVoucherId, updateSession } = require('../stateManager');
const { generateItineraryPdf } = require('./itineraryGenerator');
const { getAdminId } = require('./adminNotifier');

/**
 * Handles incoming verification commands from Accounts Team (+923180978480).
 * Accounts commands: "CONFIRM <VoucherID>", "APPROVE <VoucherID>", "YES <VoucherID>"
 * @param {object} client - whatsapp-web.js client
 * @param {string} from - Sender WhatsApp ID
 * @param {string} body - Text message content
 * @returns {Promise<string|null>} - Response string to send back to Accounts
 */
async function handleAccountsCommand(client, from, body) {
  const text = (body || '').trim().toUpperCase();

  // Match commands: CONFIRM EYR-20260820-8492 or APPROVE MSG-20260820-3104
  const match = text.match(/(?:CONFIRM|APPROVE|YES|OK|VERIFY)\s+([A-Z]{3}-[A-Z0-9-]+)/i);
  if (!match) {
    return null;
  }

  const targetVoucherId = match[1].toUpperCase();
  console.log(`[AccountsVerifier] Accounts team submitted confirmation for Voucher ID: ${targetVoucherId}`);

  // Search SQLite database for matching session
  const matchResult = findSessionByVoucherId(targetVoucherId);
  if (!matchResult) {
    return `❌ *Accounts Verification Error:* Could not find an active booking session matching Voucher ID: *${targetVoucherId}*.`;
  }

  const targetPhone = matchResult.phone;
  const targetSession = matchResult.session;

  try {
    // 1. Update session status to CONFIRMED / APPROVED
    const updatedSession = {
      ...targetSession,
      status: 'APPROVED / CONFIRMED',
      step: 'DONE'
    };
    updateSession(targetPhone, updatedSession);
    const { updateOrderStatus } = require('../stateManager');
    updateOrderStatus(targetVoucherId, 'APPROVED / CONFIRMED', updatedSession);

    // 2. Regenerate PDF Itinerary Voucher with GREEN Approved Stamp
    console.log(`[AccountsVerifier] Regenerating Approved PDF voucher for ${targetVoucherId}...`);
    const pdfRes = await generateItineraryPdf(updatedSession);

    if (pdfRes && pdfRes.pdfPath && fs.existsSync(pdfRes.pdfPath)) {
      updateSession(targetPhone, { itineraryPdfPath: pdfRes.pdfPath, status: 'APPROVED / CONFIRMED' });
      updateOrderStatus(targetVoucherId, 'APPROVED / CONFIRMED', { itineraryPdfPath: pdfRes.pdfPath });

      // 3. Send Approved PDF Voucher directly to Customer on WhatsApp
      const pdfMedia = MessageMedia.fromFilePath(pdfRes.pdfPath);
      const customerMsg = (
        `🎉 *PAYMENT VERIFIED & BOOKING APPROVED!*\n\n` +
        `Dear *${updatedSession.familyHeadName || 'Customer'}*,\n` +
        `Your payment has been verified by our Accounts Department (+923180978480).\n\n` +
        `📄 Your official *CONFIRMED Travel Itinerary Voucher (${targetVoucherId})* is attached below.`
      );

      console.log(`[AccountsVerifier] Sending confirmed PDF voucher to customer (${targetPhone})...`);
      await client.sendMessage(targetPhone, customerMsg);
      await client.sendMessage(targetPhone, pdfMedia, { caption: `📄 *Confirmed Travel Itinerary Voucher (${targetVoucherId})*` });
    }

    // 4. Send passport picture(s), Excel file, and confirmed itinerary to feeding guy (+923180978480)
    try {
      const { notifyAdminNewOrder } = require('./adminNotifier');
      console.log(`[AccountsVerifier] Forwarding passport photos, Excel file, and confirmed voucher to feeding guy for Voucher ${targetVoucherId}...`);
      await notifyAdminNewOrder(client, targetPhone, updatedSession);
    } catch (notifyErr) {
      console.error('[AccountsVerifier] Error notifying feeding guy:', notifyErr.message);
    }

    const cleanCustPhone = targetPhone.replace('@c.us', '');
    return `✅ *Accounts Success:* Voucher *${targetVoucherId}* has been marked *APPROVED / CONFIRMED*. The confirmed PDF voucher has been delivered to customer (+${cleanCustPhone}), and passport pictures + Excel file sent to feeding desk!`;

  } catch (err) {
    console.error('[AccountsVerifier] Error processing payment approval:', err.message);
    return `❌ *Accounts Verification Failed:* ${err.message}`;
  }
}

module.exports = { handleAccountsCommand };
