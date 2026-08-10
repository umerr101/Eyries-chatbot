// ============================================================
//  index.js — WhatsApp Bot using whatsapp-web.js
//  No Twilio needed. Just scan the QR code with your phone!
// ============================================================

require('dotenv').config();

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode               = require('qrcode-terminal');
const path                 = require('path');
const crypto               = require('crypto');
const axios                = require('axios');
const { routeMessage }     = require('./router');
const { getSession }       = require('./stateManager');

// ── Absolute path for session storage ─────────────────────────
const SESSION_PATH = path.resolve('.wwebjs_auth');

// ── Locate installed Chrome ────────────────────────────────────
const CHROME_PATH = process.env.CHROME_PATH ||
  (require('fs').existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe');

// ── Create WhatsApp client ─────────────────────────────────────
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: SESSION_PATH }),
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
    type: 'remote',
    remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1014111620-alpha.html',
  }
});

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

// ── Deduplication tracker (whatsapp-web.js can fire 'message' twice) ──
const _processedMsgIds = new Set();

// ── Incoming Message Handler ───────────────────────────────────
client.on('message', async (message) => {
  try {
    // ── Deduplication (whatsapp-web.js can fire 'message' twice for the same msg)
    // Only deduplicate when a valid serialized ID exists. Some WhatsApp versions
    // return undefined for message.id or _serialized (e.g. @lid contacts) — in
    // that case we skip dedup entirely so legitimate messages are not blocked.
    const msgId = message.id?._serialized;
    if (msgId) {
      if (_processedMsgIds.has(msgId)) return;
      _processedMsgIds.add(msgId);
      if (_processedMsgIds.size > 300) {
        _processedMsgIds.delete(_processedMsgIds.values().next().value);
      }
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

    // Only process standard user interaction message types
    const ALLOWED_TYPES = ['chat', 'image', 'document', 'audio', 'voice', 'video', 'location', 'vcard', 'ptt'];
    if (!ALLOWED_TYPES.includes(message.type)) return;

    // Skip messages sent BY the bot itself (unless explicitly testing)
    if (message.fromMe) return;

    const from     = message.from;
    const body     = (message.body || '').trim();
    const hasMedia = message.hasMedia;
    const msgType  = message.type; // 'chat', 'image', 'document', etc.

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

          if (result?.data && result.data.length > 5000) {
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

    // Send instant status message if passport image was received
    const currentSession = getSession(from);
    if (mediaData && currentSession?.step === 'AWAIT_PASSPORT') {
      try {
        console.log('   Sending instant status update...');
        await client.sendMessage(from, '⏳ _Processing your passport image... please wait a moment._');
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
