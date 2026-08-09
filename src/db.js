// ============================================================
//  db.js — Zero-dependency persistent session store for Node.js
//  Compatible with all Node versions without C++ native build toolchain
// ============================================================

const fs   = require('fs');
const path = require('path');

const FILE_PATH = path.join(__dirname, '..', 'sessions.json');

function loadSessions() {
  try {
    if (fs.existsSync(FILE_PATH)) {
      const data = fs.readFileSync(FILE_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('[DB] Error loading sessions file:', err.message);
  }
  return {};
}

function saveSessions(store) {
  try {
    fs.writeFileSync(FILE_PATH, JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    console.error('[DB] Error saving sessions file:', err.message);
  }
}

let store = loadSessions();

const db = {
  exec: () => {}, // Compatibility stub
  prepare: (sql) => {
    const upper = sql.toUpperCase();
    return {
      get: (...args) => {
        if (upper.includes('SELECT')) {
          const phone = args[0];
          const session = store[phone];
          if (session) {
            return {
              data: session.data,
              last_activity: session.last_activity,
            };
          }
        }
        return undefined;
      },
      run: (...args) => {
        if (upper.includes('INSERT') || upper.includes('UPDATE')) {
          const [phone, data, last_activity] = args;
          store[phone] = { data, last_activity };
          saveSessions(store);
          return { changes: 1 };
        }
        if (upper.includes('DELETE')) {
          const cutoff = args[0];
          let changes = 0;
          for (const key of Object.keys(store)) {
            if (store[key].last_activity < cutoff) {
              delete store[key];
              changes++;
            }
          }
          if (changes > 0) saveSessions(store);
          return { changes };
        }
        return { changes: 0 };
      }
    };
  }
};

module.exports = db;
