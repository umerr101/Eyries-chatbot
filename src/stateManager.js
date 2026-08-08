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

module.exports = { getSession, resetSession, updateSession };
