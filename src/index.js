// ============================================================
//  index.js — WhatsApp Bot using whatsapp-web.js
//  No Twilio needed. Just scan the QR code with your phone!
// ============================================================

require('dotenv').config();

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode               = require('qrcode-terminal');
const path                 = require('path');
const fs                   = require('fs');
const crypto               = require('crypto');
const axios                = require('axios');
const { routeMessage }     = require('./router');
const { getSession, updateSession } = require('./stateManager');
const { notifyAdminNewOrder } = require('./utils/adminNotifier');
const { generateItineraryPdf } = require('./utils/itineraryGenerator');
const { handleAccountsCommand } = require('./utils/accountsVerifier');

// ── PDF Voucher Web Server (Allows QR code scanning to open PDF) ──
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
const itinerariesDir = path.resolve(__dirname, '..', 'itineraries');
if (!fs.existsSync(itinerariesDir)) {
  fs.mkdirSync(itinerariesDir, { recursive: true });
}
app.use(express.json());
app.use('/vouchers', express.static(itinerariesDir));

// Serve visual calendar popup HTML (supports clean tokenized URLs e.g. /c/a9f3b2 or /calendar)
app.get(['/calendar', '/c', '/c/:token', '/calendar/:token'], (req, res) => {
  res.sendFile(path.resolve(__dirname, '..', 'assets', 'calendar.html'));
});

// Process interactive calendar submission
app.post('/api/calendar-save', async (req, res) => {
  try {
    let { token, phone, city, checkInPretty, checkOutPretty, nights } = req.body;

    const { findSessionByPhone, getCalendarTokenData } = require('./stateManager');
    if (token) {
      const tokenData = getCalendarTokenData(token);
      if (tokenData) {
        phone = tokenData.phone;
        city = tokenData.city;
      }
    }

    if (!phone || !city || !nights || nights < 1) {
      return res.status(400).json({ success: false, error: 'Invalid or expired calendar session.' });
    }

    const matched = findSessionByPhone(phone);
    const cleanPhone = matched ? matched.phone : (phone.includes('@') ? phone : `${phone.replace(/[^0-9]/g, '')}@c.us`);
    const session = getSession(cleanPhone);
    const hotel = session.selectedHotel;
    const rooms = session.selectedRooms || [];

    if (!hotel || rooms.length === 0) {
      return res.status(400).json({ success: false, error: 'No active hotel selection found.' });
    }

    let cityTotal = 0;
    const processedRooms = rooms.map(r => {
      const pax = r.paxCapacity || 1;
      const roomTotal = r.ratePerPax * pax * nights;
      cityTotal += roomTotal;
      return { ...r, nights, roomTotal };
    });

    const roomTypeSummary = processedRooms.map(r => `Room ${r.roomNumber}: ${r.label}`).join(', ');
    const stayRangeText = `${checkInPretty} – ${checkOutPretty} (${nights} Nights)`;

    const cityBooking = {
      city: city.toUpperCase(),
      hotelName: hotel.name,
      roomType: roomTypeSummary,
      stayRange: stayRangeText,
      checkIn: checkInPretty,
      checkOut: checkOutPretty,
      ratePerNight: processedRooms[0]?.ratePerPax || 0,
      rooms: processedRooms,
      nights: nights,
      cityTotal: cityTotal
    };

    if (city.toUpperCase() === 'MAKKAH') {
      updateSession(cleanPhone, { makkahBooking: cityBooking });
    } else {
      updateSession(cleanPhone, { madinahBooking: cityBooking });
    }

    const currentSess = getSession(cleanPhone);
    const hasMakkah = currentSess.currentCity === 'MAKKAH' || !!currentSess.makkahBooking;
    const hasMadinah = currentSess.currentCity === 'MADINAH' || !!currentSess.madinahBooking;

    let syncMsg = '';
    if (!hasMakkah || !hasMadinah) {
      const nextCity = !hasMakkah ? 'MAKKAH' : 'MADINAH';
      updateSession(cleanPhone, { step: 'HOTEL_PROMPT_NEXT_CITY' });
      syncMsg = (
        `✅ *${city.toUpperCase()} Stay Dates Confirmed!*\n\n` +
        `🏨 *${hotel.name}*\n` +
        `📅 Check-in: *${checkInPretty}*\n` +
        `📅 Check-out: *${checkOutPretty}*\n` +
        `🌙 Duration: *${nights} night(s)*\n` +
        `💰 Subtotal: *${cityTotal} SAR*\n\n` +
        `Would you like to select a hotel for *${nextCity}* as well?\n\n` +
        `1️⃣ *Yes, select ${nextCity} Hotel*\n` +
        `2️⃣ *No, view final hotel summary*`
      );
    } else {
      updateSession(cleanPhone, { step: 'HOTEL_ASK_FAMILY_HEAD' });
      syncMsg = (
        `✅ *${city.toUpperCase()} Stay Dates Confirmed!*\n\n` +
        `🏨 *${hotel.name}*\n` +
        `📅 Check-in: *${checkInPretty}*\n` +
        `📅 Check-out: *${checkOutPretty}*\n` +
        `🌙 Duration: *${nights} night(s)*\n` +
        `💰 Subtotal: *${cityTotal} SAR*\n\n` +
        `👤 *Family Head Name Required*\n\n` +
        `Please enter the full name of the Family Head for this hotel booking _(e.g. Waleed Ahmad)_:`
      );
    }

    await client.sendMessage(cleanPhone, syncMsg);
    return res.json({ success: true });
  } catch (err) {
    console.error('[CalendarSaveAPI] Error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

const http = require('http');
const server = http.createServer(app);
const { initServer } = require('./server');

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Operator CRM Dashboard & API Server live at: http://localhost:${PORT}/admin`);
}).on('error', (err) => {
  if (err.code !== 'EADDRINUSE') console.warn('[WebServer] Warning:', err.message);
});

// ── Absolute path for session storage (separate per client) ──
const clientId = process.env.CLIENT_ID || 'default';
const SESSION_PATH = path.resolve(`.wwebjs_auth_${clientId}`);

// ── Clean stale lock files from LocalAuth data folder on startup ──
try {
  const sessionDataDir = path.join(SESSION_PATH, `session-${clientId}`);
  if (fs.existsSync(sessionDataDir)) {
    const lockFile = path.join(sessionDataDir, 'lockfile');
    if (fs.existsSync(lockFile)) {
      fs.unlinkSync(lockFile);
    }
  }
} catch (_) {}

// ── Locate installed Chrome ────────────────────────────────────
const CHROME_PATH = process.env.CHROME_PATH ||
  (require('fs').existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe');

// ── Create WhatsApp client ─────────────────────────────────────
const client = new Client({
  authStrategy: new LocalAuth({ clientId: clientId, dataPath: SESSION_PATH }),
  puppeteer: {
    headless: true,
    executablePath: CHROME_PATH,
    bypassCSP: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
    ],
  },
  webVersionCache: {
    type: 'none',
  }
});

// Initialize CRM WebServer API & Socket.io
initServer(client, app, server);

const QRCodeImage          = require('qrcode');

// ── QR Code ────────────────────────────────────────────────────
client.on('qr', (qr) => {
  console.log('\n============================================================');
  console.log('📱 SCAN THIS QR CODE WITH WHATSAPP ON YOUR PHONE');
  console.log('============================================================\n');
  qrcode.generate(qr, { small: true });
  console.log('\nRaw QR Code Data String:\n' + qr + '\n');

  // Save crisp PNG image to root directory for instant scanning
  const qrImagePath = path.join(__dirname, '..', 'qr.png');
  QRCodeImage.toFile(qrImagePath, qr, { width: 400, margin: 2 }, (err) => {
    if (!err) {
      console.log(`✅ Saved high-res QR image: ${qrImagePath}`);
    }
  });

  console.log('⚠️ Open WhatsApp → ⋮ Menu → Linked Devices → Link a Device → Scan\n');
});

let isLive = false;

// ── Loading Screen Progress ────────────────────────────────────
client.on('loading_screen', (percent, message) => {
  console.log(`⏳ [WhatsApp Web Syncing] ${percent}% - ${message || 'Loading chats'}`);
});

let syncTriggered = false;

// ── Authenticated ──────────────────────────────────────────────
client.on('authenticated', () => {
  console.log('🔐 Session authenticated. WhatsApp Web syncing in progress...');
  
  // Guard for WhatsApp Web session restore race condition:
  // If Socket.hasSynced is already true before listener attached, trigger sync event once
  const syncCheckInterval = setInterval(async () => {
    if (isLive || syncTriggered) {
      clearInterval(syncCheckInterval);
      return;
    }
    if (client.pupPage) {
      try {
        const canSync = await client.pupPage.evaluate(() => {
          try {
            if (typeof window.require === 'function') {
              const socket = window.require('WAWebSocketModel')?.Socket;
              if (socket && socket.hasSynced && typeof window.onAppStateHasSyncedEvent === 'function') {
                return true;
              }
            }
          } catch (_) {}
          return false;
        });

        if (canSync && !syncTriggered && !isLive) {
          syncTriggered = true;
          clearInterval(syncCheckInterval);
          await client.pupPage.evaluate(() => {
            if (typeof window.onAppStateHasSyncedEvent === 'function') {
              window.onAppStateHasSyncedEvent();
            }
          });
        }
      } catch (_) {}
    }
  }, 1000);
});

// ── Auth Failure ───────────────────────────────────────────────
client.on('auth_failure', (msg) => {
  console.error('❌ [Auth Failure] WhatsApp session authentication failed:', msg);
});

// ── Disconnected ───────────────────────────────────────────────
client.on('disconnected', (reason) => {
  console.warn('⚠️ [WhatsApp Web Disconnected]:', reason);
  isLive = false;
  syncTriggered = false;
});

// ── Global Process Error Protection ──────────────────────────
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ [ProcessGuard] Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('⚠️ [ProcessGuard] Uncaught Exception:', err.stack || err.message);
});

// Initialize bot start time 10 mins prior so fresh messages during startup are never dropped
botStartTime = Math.floor(Date.now() / 1000) - 600;

// ── Ready ──────────────────────────────────────────────────────
client.on('ready', async () => {
  if (isLive) return;
  isLive = true;

  // Guarantee message event listeners are always attached to WhatsApp Web
  try {
    if (typeof client.attachEventListeners === 'function') {
      await client.attachEventListeners();
    }
  } catch (_) {}

  const info = client.info || {};
  const pushname = info.pushname || 'Connected User';
  const widUser = info.wid ? info.wid.user : 'WhatsApp User';
  console.log('\n✅ WhatsApp Bot is LIVE and Listening!');
  console.log(`   Linked to: ${pushname} (${widUser})`);
  console.log('   Send a message from ANY phone or Message Yourself to test.\n');
});

// ── Deduplication & Bot-sent message tracker ───────────────────
const _processedMsgIds = new Set();
const _botSentMessageIds = new Set();

function trackBotSentMsg(sentMsg) {
  if (sentMsg?.id?._serialized) {
    _botSentMessageIds.add(sentMsg.id._serialized);
    _processedMsgIds.add(sentMsg.id._serialized);
    if (_botSentMessageIds.size > 1000) {
      _botSentMessageIds.delete(_botSentMessageIds.values().next().value);
    }
  }
}

// ── Unified Incoming Message Handler ───────────────────────────
async function handleIncomingMessage(message) {
  try {
    if (!message) return;

    // Ignore bot's own automated outbound messages
    const msgId = message.id?._serialized || `${message.from}_${message.timestamp}_${message.body}`;
    if (_botSentMessageIds.has(msgId)) return;

    // Deduplication by message ID
    if (_processedMsgIds.has(msgId)) return;
    _processedMsgIds.add(msgId);
    if (_processedMsgIds.size > 1000) {
      _processedMsgIds.delete(_processedMsgIds.values().next().value);
    }

    // Skip group messages
    if (message.from?.endsWith('@g.us')) return;
    if (message.isGroupMsg) return;

    // Skip status broadcasts
    if (message.from === 'status@broadcast') return;

    // Skip background system notifications (e2e_notification, protocol, ciphertext, etc.)
    const SYSTEM_TYPES = [
      'e2e_notification',
      'notification_template',
      'protocol',
      'gp2',
      'broadcast_notification',
      'ciphertext',
      'revoked',
      'pinned_message',
      'reaction',
    ];
    if (SYSTEM_TYPES.includes(message.type)) return;

    // Determine effective sender and destination chat
    let chatTarget = message.from;

    // Handle outbound messages and self-chat testing (Message Yourself)
    if (message.fromMe) {
      const myWid = client.info?.wid?._serialized;
      const myUser = client.info?.wid?.user;
      const toClean = (message.to || '').replace(/[^0-9]/g, '');
      const fromClean = (message.from || '').replace(/[^0-9]/g, '');
      const myWidClean = (myWid || '').replace(/[^0-9]/g, '') || (myUser || '');

      const isSelfChat = message.to === message.from ||
                         (myWid && message.to === myWid) ||
                         (myWidClean && toClean === myWidClean) ||
                         (toClean && fromClean && toClean === fromClean);

      if (!isSelfChat) {
        return; // Ignore regular outbound messages sent by human agents to external customers
      }
      chatTarget = message.to || message.from;
    }

    const from     = chatTarget;
    const body     = (message.body || '').trim();
    const hasMedia = message.hasMedia;
    const msgType  = message.type; // 'chat', 'image', 'document', etc.

    // Only process standard user interaction message types
    const ALLOWED_TYPES = ['chat', 'image', 'document', 'audio', 'voice', 'video', 'location', 'vcard', 'ptt'];
    if (!ALLOWED_TYPES.includes(msgType)) return;

    // Skip empty body messages with no media attached
    if (!hasMedia && !body) return;

    console.log(`\n📨 [${new Date().toLocaleTimeString()}] From: ${from}`);
    console.log(`   Type: ${msgType} | Body: "${body}"${hasMedia ? ' [+media]' : ''}`);

    // ── Get media (passport image) ─────────────────────────────
    let mediaData = null;
    if (hasMedia || ['image', 'document', 'sticker'].includes(msgType)) {
      console.log('   Media detected — attempting download...');

      // METHOD 1: standard downloadMedia() — wait 3s for WhatsApp Web to cache it
      await sleep(3000);
      for (let attempt = 1; attempt <= 3 && !mediaData; attempt++) {
        try {
          mediaData = await message.downloadMedia();
          const isPdfDoc = (mediaData?.mimetype || '').includes('pdf') || msgType === 'document';
          if (mediaData && mediaData.data && (mediaData.data.length > 20000 || (isPdfDoc && mediaData.data.length > 1000))) {
            console.log(`   ✓ METHOD 1 OK — ${mediaData.mimetype}, ${mediaData.data.length} chars`);
          } else {
            if (mediaData) console.warn(`   ⚠️ METHOD 1 got thumbnail (${mediaData.data?.length} chars) — too small`);
            else console.warn(`   ⚠️ METHOD 1 returned null (attempt ${attempt})`);
            mediaData = null;
            if (attempt < 3) await sleep(1500);
          }
        } catch (e) {
          console.error(`   METHOD 1 error (attempt ${attempt}): ${e.message}`);
          if (attempt < 3) await sleep(1500);
        }
      }

      // METHOD 2: extract decrypted mediaBlob from WhatsApp Web page memory
      // Tries multiple internal Store paths since WhatsApp Web changes them across versions.
      if (!mediaData) {
        try {
          console.log('   Trying METHOD 2: page-level blob extraction...');
          const serializedId = message.id?._serialized;
          const result = await client.pupPage.evaluate(async (serializedId) => {
            try {
              // Try multiple WhatsApp Web internal store paths
              const stores = [
                window.Store?.Msg,
                window.Store?.MsgStore,
                window.WA?.Msg,
              ].filter(s => s && typeof s.get === 'function');

              let msg = null;
              for (const store of stores) {
                if (serializedId) msg = store.get(serializedId);
                if (!msg) {
                  // Try iterating if .get doesn't work
                  if (typeof store.getAll === 'function') {
                    const all = store.getAll();
                    msg = all.find(m => m.id?._serialized === serializedId);
                  }
                }
                if (msg) break;
              }

              if (!msg) return { error: 'msg not found in any Store' };

              // If blob is already cached in memory
              if (msg.mediaData?.mediaBlob) {
                const blob = msg.mediaData.mediaBlob;
                const buf  = await blob.arrayBuffer();
                const arr  = new Uint8Array(buf);
                let bin = '';
                for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
                return { data: btoa(bin), mimetype: blob.type || msg.mimetype || 'image/jpeg' };
              }

              // Try DownloadManager
              const dm = window.Store?.DownloadManager;
              if (dm?.downloadAndMaybeDecrypt) {
                const dlResult = await dm.downloadAndMaybeDecrypt({
                  directPath:        msg.directPath,
                  encFilehash:       msg.encFilehash,
                  filehash:          msg.filehash,
                  mediaKey:          msg.mediaKey,
                  mediaKeyTimestamp: msg.mediaKeyTimestamp,
                  mimetype:          msg.mimetype,
                  type:              msg.type,
                });
                if (dlResult) {
                  const arr = new Uint8Array(dlResult);
                  let bin = '';
                  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
                  return { data: btoa(bin), mimetype: msg.mimetype || 'image/jpeg' };
                }
              }
              return { error: 'no blob cached and DownloadManager unavailable' };
            } catch(e) {
              return { error: e.toString() };
            }
          }, serializedId);

          if (result?.data && result.data.length > 20000) {
            mediaData = new MessageMedia(result.mimetype || 'image/jpeg', result.data, 'passport.jpg');
            console.log(`   ✓ METHOD 2 OK — ${result.mimetype}, ${result.data.length} chars`);
          } else {
            console.warn('   ⚠️ METHOD 2 failed:', result?.error || 'unknown');
          }
        } catch (e) {
          console.error('   METHOD 2 exception:', e.message);
        }
      }

      // METHOD 3: _data.body (last resort — usually just thumbnail)
      if (!mediaData) {
        try {
          const raw = message._data || {};
          const b64  = raw.body || raw.mediaData;
          const mime = raw.mimetype || 'image/jpeg';
          if (b64 && b64.length > 20000) {
            mediaData = new MessageMedia(mime, b64, 'passport.jpg');
            console.log(`   ✓ METHOD 3 (raw body) OK — ${mime}, ${b64.length} chars`);
          } else {
            console.warn(`   ⚠️ METHOD 3 failed (body too small or missing)`);
          }
        } catch (e) {
          console.error('   METHOD 3 error:', e.message);
        }
      }

      // METHOD 4: Node.js-side CDN fetch (bypasses browser CSP) + AES-256-CBC decrypt
      // This bypasses browser Content Security Policy (CSP) by fetching mmg.whatsapp.net directly in Node.js
      if (!mediaData) {
        try {
          console.log('   Trying METHOD 4: Node.js CDN fetch + AES decrypt...');
          const raw    = message._data || {};
          const dp     = raw.directPath;
          const mkB64  = raw.mediaKey;
          const mime   = raw.mimetype || 'image/jpeg';
          const mtype  = raw.type     || 'image';

          if (dp && mkB64) {
            const url = dp.startsWith('http') ? dp : ('https://mmg.whatsapp.net' + (dp.startsWith('/') ? '' : '/') + dp);
            let encBuf = null;

            try {
              // Extract cookies and User-Agent from Puppeteer session
              const cookies = await client.pupPage.cookies('https://web.whatsapp.com');
              const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
              let userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
              try {
                if (client.pupBrowser) userAgent = await client.pupBrowser.userAgent();
              } catch (_) {}

              const res = await axios.get(url, {
                responseType: 'arraybuffer',
                headers: {
                  'User-Agent': userAgent,
                  'Cookie': cookieStr,
                  'Accept': '*/*',
                  'Origin': 'https://web.whatsapp.com',
                  'Referer': 'https://web.whatsapp.com/',
                },
                timeout: 20000,
              });
              encBuf = Buffer.from(res.data);
            } catch (err1) {
              console.warn('   ⚠️ METHOD 4 auth fetch failed, trying fallback GET:', err1.message);
              // Fallback: direct GET without cookies
              const res2 = await axios.get(url, { responseType: 'arraybuffer', timeout: 20000 });
              encBuf = Buffer.from(res2.data);
            }

            if (encBuf && encBuf.length > 0) {
              // Decrypt the WhatsApp-encrypted media in Node.js
              const decBuf  = decryptWhatsAppMedia(encBuf, mkB64, mtype);
              mediaData     = new MessageMedia(mime, decBuf.toString('base64'), 'passport.jpg');
              console.log(`   ✓ METHOD 4 OK — ${mime}, ${decBuf.length} bytes decrypted`);
            } else {
              console.warn('   ⚠️ METHOD 4 CDN fetch returned empty buffer');
              console.warn(`   ⚠️ All 4 methods failed. _data keys: ${Object.keys(raw).join(', ')}`);
            }
          } else {
            console.warn('   ⚠️ METHOD 4 skipped — directPath or mediaKey missing from _data');
          }
        } catch (e) {
          console.error('   METHOD 4 error:', e.message);
        }
      }
    }

    // Check if message is a confirmation command from Accounts Team (+923180978480)
    const accountsReply = await handleAccountsCommand(client, from, body);
    if (accountsReply) {
      const sentAccounts = await client.sendMessage(from, accountsReply);
      trackBotSentMsg(sentAccounts);
      return;
    }

    // Send instant status message if passport image was received
    const currentSession = getSession(from);
    if (mediaData && currentSession?.step === 'AWAIT_PASSPORT') {
      try {
        console.log('   Sending instant status update...');
        const sentStatus = await client.sendMessage(from, '⏳ _Processing your passport image... please wait a moment._');
        trackBotSentMsg(sentStatus);
      } catch (err) {
        console.warn('   Could not send instant status update:', err.message);
      }
    }

    // Route through conversation engine
    const replies = await routeMessage(from, body, mediaData);
    console.log(`   Sending reply...`);

    // Send reply(ies)
    if (Array.isArray(replies)) {
      for (const reply of replies) {
        if (reply) {
          const sent = await client.sendMessage(from, reply);
          trackBotSentMsg(sent);
          await sleep(500); // small delay between multiple messages
        }
      }
    } else if (replies) {
      const sent = await client.sendMessage(from, replies);
      trackBotSentMsg(sent);
    }

    console.log('   ✓ Reply sent.');

    // ── Payment Pending PDF Itinerary Voucher & Payment Method Trigger ────────
    const postSession = getSession(from);
    if (postSession?.step === 'AWAIT_PAYMENT_RECEIPT' && !postSession?.voucherGenerated) {
      updateSession(from, { voucherGenerated: true });

      (async () => {
        try {
          console.log('[ItineraryGenerator] Generating PAYMENT PENDING PDF itinerary voucher...');
          const itineraryRes = await generateItineraryPdf(postSession);
          if (itineraryRes && itineraryRes.pdfPath && fs.existsSync(itineraryRes.pdfPath)) {
            updateSession(from, { itineraryPdfPath: itineraryRes.pdfPath, voucherId: itineraryRes.voucherId });
            const { saveBookingOrder } = require('./stateManager');
            saveBookingOrder(itineraryRes.voucherId, from, getSession(from), 'PAYMENT PENDING');

            const pdfMedia = MessageMedia.fromFilePath(itineraryRes.pdfPath);
            console.log(`[ItineraryGenerator] Sending PAYMENT PENDING PDF voucher (${itineraryRes.voucherId}) to customer...`);
            const sentVoucher = await client.sendMessage(from, pdfMedia, { caption: `📄 *Official Travel Itinerary Voucher (${itineraryRes.voucherId})*\nStatus: PAYMENT PENDING` });
            trackBotSentMsg(sentVoucher);
            await sleep(600);
          }

          // Send payment method / details directly after the itinerary voucher
          const isPackage = postSession.flow?.startsWith('PACKAGE');
          const paymentMsg = isPackage
            ? msg.packagePaymentDetails(postSession.totalPkr, postSession.totalSar)
            : msg.paymentDetails(postSession.totalSar, null, 'Total Visa Package Rate');

          console.log(`[PaymentDetails] Sending payment method to customer...`);
          const sentPayment = await client.sendMessage(from, paymentMsg);
          trackBotSentMsg(sentPayment);

        } catch (pdfErr) {
          console.error('[ItineraryGenerator] Error generating/sending itinerary & payment:', pdfErr.message);
        }
      })();
    }

    // ── Forward Payment Receipt to Accounts Team (+923180978480) ──
    if (postSession?.step === 'AWAIT_ACCOUNTS_VERIFICATION' && !postSession?.receiptForwardedToAccounts) {
      updateSession(from, { receiptForwardedToAccounts: true });

      (async () => {
        try {
          const { loadClientConfig } = require('./configLoader');
          const activeClient = loadClientConfig();
          const rawAccountsPhone = process.env.ACCOUNTS_WHATSAPP || process.env.ADMIN_WHATSAPP || activeClient.accountsPhone || activeClient.adminPhone || '923180978480@c.us';
          const accountsPhone = rawAccountsPhone.replace(/[^0-9]/g, '') + '@c.us';
          const cleanPhone = from.replace('@c.us', '');
          const voucherId = postSession.voucherId || 'Voucher';

          console.log(`[AccountsForwarder] Forwarding payment receipt for Voucher ${voucherId} to Accounts (${accountsPhone})...`);

          const accountsMessage = (
            `🚨 *NEW PAYMENT RECEIPT SUBMITTED FOR VERIFICATION!*\n\n` +
            `👤 *Customer Phone:* +${cleanPhone}\n` +
            `👤 *Family Head:* ${postSession.familyHeadName || 'Customer'}\n` +
            `🎫 *Voucher Booking ID:* *${voucherId}*\n` +
            `💰 *Grand Total:* ${postSession.totalSar || 0} SAR\n` +
            `🇵🇰 *Total in PKR:* approx. ${postSession.totalPkr || 'N/A'} PKR\n\n` +
            `👉 *To Approve & Release Confirmed Voucher, reply:* \`CONFIRM ${voucherId}\``
          );

          await client.sendMessage(accountsPhone, accountsMessage);

          if (mediaData && mediaData.data) {
            const receiptMedia = new MessageMedia(mediaData.mimetype || 'image/jpeg', mediaData.data, `receipt_${voucherId}.jpg`);
            await client.sendMessage(accountsPhone, receiptMedia, { caption: `📸 Payment Receipt Screenshot for Voucher ${voucherId}` });
          }

          // Forward order details & passports/documents to admin as well
          notifyAdminNewOrder(client, from, getSession(from)).catch(err => {
            console.error('[AdminNotifier] Asynchronous notification error:', err.message);
          });

        } catch (fwdErr) {
          console.error('[AccountsForwarder] Error forwarding payment receipt:', fwdErr.message);
        }
      })();
    }

  } catch (err) {
    console.error('[Bot] Error:', err.message);
    try {
      await client.sendMessage(message.from, '⚠️ Something went wrong. Please type *MENU* to restart.');
    } catch (_) {}
  }
}

// Bind both 'message' and 'message_create' to catch 100% of customer and self-test messages
client.on('message', handleIncomingMessage);
client.on('message_create', (msg) => {
  if (!msg) return;
  const msgId = msg.id?._serialized;
  if (msgId && _botSentMessageIds.has(msgId)) return;
  if (msgId && _processedMsgIds.has(msgId)) return;
  handleIncomingMessage(msg);
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Decrypts WhatsApp encrypted media using the standard HKDF + AES-256-CBC algorithm.
 * WhatsApp encrypts all media before storing on CDN. The mediaKey (from message._data)
 * is expanded via HKDF-SHA256 into IV + cipher key, then used to decrypt with AES-256-CBC.
 * The last 10 bytes of the encrypted file are a MAC (discarded here; integrity already
 * verified by the hash fields in _data).
 *
 * @param {Buffer} encryptedBuffer  - Raw encrypted file bytes from WhatsApp CDN
 * @param {string} mediaKeyBase64   - Base64-encoded mediaKey from message._data.mediaKey
 * @param {string} mediaType        - 'image' | 'video' | 'audio' | 'document' | 'sticker'
 * @returns {Buffer}                - Decrypted file bytes
 */
function decryptWhatsAppMedia(encryptedBuffer, mediaKeyBase64, mediaType) {
  const mediaKey = Buffer.from(mediaKeyBase64, 'base64');

  const typeInfoMap = {
    image:    'WhatsApp Image Keys',
    video:    'WhatsApp Video Keys',
    audio:    'WhatsApp Audio Keys',
    document: 'WhatsApp Document Keys',
    sticker:  'WhatsApp Image Keys',
  };
  const info = Buffer.from(typeInfoMap[mediaType] || 'WhatsApp Image Keys', 'utf8');

  // HKDF-Extract: PRK = HMAC-SHA256(salt = 32 zero bytes, IKM = mediaKey)
  const prk = crypto.createHmac('sha256', Buffer.alloc(32, 0)).update(mediaKey).digest();

  // HKDF-Expand to 112 bytes (ceil(112/32) = 4 iterations)
  let okm = Buffer.alloc(0);
  let t   = Buffer.alloc(0);
  for (let i = 1; i <= 4; i++) {
    const h = crypto.createHmac('sha256', prk);
    h.update(t);
    h.update(info);
    h.update(Buffer.from([i]));
    t   = h.digest();
    okm = Buffer.concat([okm, t]);
  }

  const iv  = okm.slice(0, 16);   // bytes  0–15 : AES-CBC IV
  const key = okm.slice(16, 48);  // bytes 16–47 : AES-256 cipher key
  // bytes 48–79 = MAC key (not needed — we trust the hash in _data)

  // The encrypted file ends with a 10-byte HMAC-SHA256 truncated MAC — strip it
  const payload = encryptedBuffer.slice(0, encryptedBuffer.length - 10);

  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  return Buffer.concat([decipher.update(payload), decipher.final()]);
}

// ── Start ──────────────────────────────────────────────────────
console.log('\n🕌 Hajj & Umrah WhatsApp Chatbot');
console.log('   Starting up — please wait...\n');
client.initialize().catch(err => {
  if (err.message.includes('Execution context was destroyed')) {
    console.log('ℹ️  WhatsApp Web page navigating... connection initializing.');
  } else {
    console.error('❌  Initialization error:', err.message);
  }
});
