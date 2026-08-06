// ============================================================
//  index.js — WhatsApp Bot using whatsapp-web.js
//  No Twilio needed. Just scan the QR code with your phone!
// ============================================================

require('dotenv').config();

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode               = require('qrcode-terminal');
const path                 = require('path');
const { routeMessage }     = require('./router');

// ── Absolute path for session storage ─────────────────────────
const SESSION_PATH = path.resolve('c:\\Users\\khali\\OneDrive\\Desktop\\chatbot\\.wwebjs_auth');

// ── Locate installed Chrome ────────────────────────────────────
const CHROME_PATH = path.join(
  process.env.USERPROFILE || 'C:\\Users\\khali',
  '.cache', 'puppeteer', 'chrome', 'win64-146.0.7680.31',
  'chrome-win64', 'chrome.exe'
);

// ── Create WhatsApp client ─────────────────────────────────────
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: SESSION_PATH }),
  puppeteer: {
    headless: true,
    executablePath: CHROME_PATH,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-software-rasterizer',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
    ],
  },
});

// ── QR Code ────────────────────────────────────────────────────
client.on('qr', (qr) => {
  console.log('\n📱 Scan this QR code with WhatsApp on your phone:\n');
  qrcode.generate(qr, { small: true });
  console.log('\n⚠️  Open WhatsApp → ⋮ Menu → Linked Devices → Link a Device → Scan\n');
});

// ── Authenticated ──────────────────────────────────────────────
client.on('authenticated', () => {
  console.log('🔐 Session authenticated.');
});

// ── Ready ──────────────────────────────────────────────────────
client.on('ready', () => {
  const info = client.info;
  console.log('\n✅ WhatsApp Bot is LIVE!');
  console.log(`   Linked to: ${info.pushname} (${info.wid.user})`);
  console.log('   Send a message from ANOTHER phone to test.\n');
});

// ── Auth failure ───────────────────────────────────────────────
client.on('auth_failure', (msg) => {
  console.error('❌ Auth failed:', msg);
});

// ── Disconnected ───────────────────────────────────────────────
client.on('disconnected', (reason) => {
  console.log('⚠️  Disconnected:', reason);
});

// ── Incoming Message Handler ───────────────────────────────────
client.on('message', async (message) => {
  try {
    // Skip group messages
    if (message.isGroupMsg) return;

    // Skip status broadcasts
    if (message.from === 'status@broadcast') return;

    // Skip messages sent BY the bot itself
    if (message.fromMe) return;

    const from     = message.from;
    const body     = message.body || '';
    const hasMedia = message.hasMedia;
    const msgType  = message.type; // 'chat', 'image', 'document', etc.

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
          if (mediaData && mediaData.data && mediaData.data.length > 5000) {
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
      if (!mediaData) {
        try {
          console.log('   Trying METHOD 2: page-level blob extraction...');
          const result = await client.pupPage.evaluate(async (serializedId) => {
            try {
              const msg = window.Store.Msg.get(serializedId);
              if (!msg) return { error: 'msg not in Store' };

              // If already downloaded, grab from mediaData.mediaBlob
              if (msg.mediaData && msg.mediaData.mediaBlob) {
                const blob = msg.mediaData.mediaBlob;
                const buf  = await blob.arrayBuffer();
                const arr  = new Uint8Array(buf);
                let binary = '';
                for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
                return { data: btoa(binary), mimetype: blob.type || 'image/jpeg' };
              }

              // Try forcing a download via DownloadManager
              const dlResult = await window.Store.DownloadManager.downloadAndMaybeDecrypt({
                directPath: msg.directPath,
                encFilehash: msg.encFilehash,
                filehash: msg.filehash,
                mediaKey: msg.mediaKey,
                mediaKeyTimestamp: msg.mediaKeyTimestamp,
                mimetype: msg.mimetype,
                type: msg.type,
              });
              if (dlResult) {
                const arr = new Uint8Array(dlResult);
                let binary = '';
                for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
                return { data: btoa(binary), mimetype: msg.mimetype || 'image/jpeg' };
              }
              return { error: 'DownloadManager returned null', type: msg.type };
            } catch(e) {
              return { error: e.toString() };
            }
          }, message.id._serialized);

          if (result && result.data && result.data.length > 5000) {
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
          if (b64 && b64.length > 5000) {
            mediaData = new MessageMedia(mime, b64, 'passport.jpg');
            console.log(`   ✓ METHOD 3 (raw body) OK — ${mime}, ${b64.length} chars`);
          } else {
            console.warn(`   ⚠️ All 3 methods failed. _data keys: ${Object.keys(raw).join(', ')}`);
          }
        } catch (e) {
          console.error('   METHOD 3 error:', e.message);
        }
      }
    }

    // Route through conversation engine
    const replies = await routeMessage(from, body, mediaData);
    console.log(`   Sending reply...`);

    // Send reply(ies)
    if (Array.isArray(replies)) {
      for (const reply of replies) {
        if (reply) {
          await client.sendMessage(from, reply);
          await sleep(500); // small delay between multiple messages
        }
      }
    } else if (replies) {
      await client.sendMessage(from, replies);
    }

    console.log('   ✓ Reply sent.');

  } catch (err) {
    console.error('[Bot] Error:', err.message);
    try {
      await client.sendMessage(message.from, '⚠️ Something went wrong. Please type *MENU* to restart.');
    } catch (_) {}
  }
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Start ──────────────────────────────────────────────────────
console.log('\n🕌 Hajj & Umrah WhatsApp Chatbot');
console.log('   Starting up — please wait...\n');
client.initialize();
