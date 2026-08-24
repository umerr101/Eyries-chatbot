// ============================================================
//  stateManager.js — Persistent conversation state per user (SQLite)
// ============================================================

const db = require('./db');

// Session expires after 30 minutes of inactivity
const SESSION_TTL_MS = 30 * 60 * 1000;

/**
 * Returns the current session for a user, or creates a fresh one.
 */
function getSession(phone) {
  const stmt = db.prepare('SELECT data, last_activity FROM sessions WHERE phone = ?');
  const row = stmt.get(phone);

  let session;
  if (row) {
    session = JSON.parse(row.data);
    // If the session has expired, reset it
    if (Date.now() - row.last_activity > SESSION_TTL_MS) {
      session = createSession();
    }
  } else {
    session = createSession();
  }

  // Save the updated activity timestamp and data
  saveSession(phone, session);
  return session;
}

/**
 * Resets (clears) a user's session to the initial state.
 */
function resetSession(phone) {
  const session = createSession();
  saveSession(phone, session);
  return session;
}

/**
 * Updates specific keys in a user's session.
 */
function updateSession(phone, updates) {
  const session = getSession(phone);
  Object.assign(session, updates);
  saveSession(phone, session);
  return session;
}

/**
 * Internal helper to save session back to SQLite
 */
function saveSession(phone, session) {
  session.lastActivity = Date.now();
  const stmt = db.prepare(`
    INSERT INTO sessions (phone, data, last_activity)
    VALUES (?, ?, ?)
    ON CONFLICT(phone) DO UPDATE SET
      data = excluded.data,
      last_activity = excluded.last_activity
  `);
  stmt.run(phone, JSON.stringify(session), session.lastActivity);
}

/**
 * Creates a blank session object.
 */
function createSession() {
  return {
    flow: 'MAIN_MENU',      // Current flow: MAIN_MENU | VISA | TRANSPORT | DONE
    step: 'WELCOME',        // Current step within the flow
    lastActivity: Date.now(),

    // ── Visa flow data ──
    visaType: null,         // 'longStay' | 'withTransport' | 'withoutTransport'
    passengerCount: null,
    airline: null,
    isPakistaniAirline: false,
    addFirstLeg: false,
    firstLegChoice: null,   // 'jeddahToMakkah' | 'jeddahToJeddahCity'
    isHajjTerminal: false,  // true if flying via Jeddah Hajj Terminal (+90 SAR)
    agreedToRate: false,
    finalVisaRate: null,

    // ── Passport / OCR data ──
    passportData: null,     // { firstName, lastName, passportNumber, issueDate, expiryDate }
    passportConfirmed: false,

    // ── Transport flow data ──
    selectedRouteId: null,
    selectedVehicleId: null,
  };
}

// Periodically clean up expired sessions (every 10 minutes)
setInterval(() => {
  const cutoff = Date.now() - SESSION_TTL_MS;
  const stmt = db.prepare('DELETE FROM sessions WHERE last_activity < ?');
  const info = stmt.run(cutoff);
  if (info.changes > 0) {
    console.log(`[DB] Cleaned up ${info.changes} expired session(s).`);
  }
}, 10 * 60 * 1000);

/**
 * Searches persistent store & transient sessions for any session matching a given voucherId (case-insensitive).
 * Returns { phone, session } or null.
 */
function findSessionByVoucherId(voucherId) {
  if (!voucherId) return null;
  const targetId = voucherId.trim().toUpperCase();

  // First check persistent orders store
  const order = db.getOrder(targetId);
  if (order) {
    return { phone: order.customerPhone, session: order.sessionData, status: order.status };
  }

  // Fallback to transient sessions
  const stmt = db.prepare('SELECT phone, data FROM sessions');
  const rows = stmt.all();

  for (const row of rows) {
    try {
      const sess = JSON.parse(row.data);
      if (sess && sess.voucherId && sess.voucherId.toUpperCase() === targetId) {
        return { phone: row.phone, session: sess };
      }
    } catch (_) {}
  }
  return null;
}

function saveBookingOrder(voucherId, customerPhone, sessionData, status = 'PAYMENT PENDING') {
  return db.saveOrder(voucherId, customerPhone, sessionData, status);
}

function getLatestPendingOrder(customerPhone) {
  return db.getLatestPendingOrder(customerPhone);
}

function updateOrderStatus(voucherId, status, extraData = {}) {
  return db.updateOrderStatus(voucherId, status, extraData);
}

/**
 * Searches transient sessions for any session matching a given phone string or phone digits.
 * Returns { phone, session } or null.
 */
function findSessionByPhone(inputPhone) {
  if (!inputPhone) return null;
  const raw = String(inputPhone).trim();

  // Try direct match first
  let stmt = db.prepare('SELECT phone, data FROM sessions WHERE phone = ?');
  let row = stmt.get(raw);
  if (row) return { phone: row.phone, session: JSON.parse(row.data) };

  // Try numeric digits match (e.g. 24181320233095 matches 24181320233095@lid or 24181320233095@c.us)
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits && digits.length >= 6) {
    const allRows = db.prepare('SELECT phone, data FROM sessions').all();
    for (const r of allRows) {
      const rowDigits = r.phone.replace(/[^0-9]/g, '');
      if (rowDigits === digits || r.phone.includes(digits) || rowDigits.includes(digits)) {
        return { phone: r.phone, session: JSON.parse(r.data) };
      }
    }
  }
  return null;
}

/**
 * Tokenized Calendar URL Storage (Hides phone numbers & personal data from URL)
 */
const crypto = require('crypto');
const _calendarTokens = new Map();

function createCalendarToken(phone, city) {
  const token = crypto.randomBytes(4).toString('hex');
  _calendarTokens.set(token, {
    phone,
    city: (city || 'MAKKAH').toUpperCase(),
    createdAt: Date.now()
  });
  return token;
}

function getCalendarTokenData(token) {
  if (!token) return null;
  const data = _calendarTokens.get(String(token).trim());
  if (!data) return null;
  if (Date.now() - data.createdAt > 2 * 60 * 60 * 1000) {
    _calendarTokens.delete(token);
    return null;
  }
  return data;
}

module.exports = {
  getSession,
  resetSession,
  updateSession,
  findSessionByVoucherId,
  findSessionByPhone,
  createCalendarToken,
  getCalendarTokenData,
  saveBookingOrder,
  getLatestPendingOrder,
  updateOrderStatus
};
