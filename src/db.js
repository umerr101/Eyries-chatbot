// ============================================================
//  db.js — Zero-dependency persistent session store for Node.js
//  Compatible with all Node versions without C++ native build toolchain
// ============================================================

const fs   = require('fs');
const path = require('path');

const clientId = process.env.CLIENT_ID || 'default';
const FILE_PATH = path.join(__dirname, '..', clientId === 'default' ? 'sessions.json' : `sessions_${clientId}.json`);

function syncPassportsDbOrders(ordersObj) {
  try {
    const pyPath = path.join(__dirname, 'dbPassportsSync.py');
    if (!fs.existsSync(pyPath)) return ordersObj;

    const { execSync } = require('child_process');
    const out = execSync(`python "${pyPath}"`, { timeout: 4000 }).toString();
    const records = JSON.parse(out || '[]');

    for (const rec of records) {
      const vId = rec.requestId;
      if (vId) {
        const isSixSigmaOrder = vId.startsWith('SST-');
        const isCurrentClientSixSigma = clientId === 'six_sigma';

        // Filter orders by client prefix if applicable
        if (isSixSigmaOrder && !isCurrentClientSixSigma && clientId !== 'default') continue;

        if (!ordersObj[vId]) {
          ordersObj[vId] = {
            voucherId: vId,
            customerPhone: rec.customerPhone || '923180978480@c.us',
            status: (rec.status || '').toUpperCase() === 'CONFIRMED' ? 'APPROVED' : ((rec.status || '').toUpperCase() || 'APPROVED'),
            sessionData: {
              flow: 'VISA',
              step: 'PAYMENT',
              familyHeadName: `${rec.firstName || ''} ${rec.lastName || ''}`.trim() || 'Guest Head',
              passengerCount: 1,
              finalVisaRate: 790,
              totalSar: 790,
              totalPkr: 58855,
              paymentType: 'BANK_DEPOSIT',
              passportData: {
                firstName: rec.firstName,
                lastName: rec.lastName,
                passportNumber: rec.passportNumber,
                nationality: rec.nationality,
                dob: rec.dob,
                issueDate: rec.issueDate,
                expiryDate: rec.expiryDate
              }
            },
            createdAt: new Date(rec.createdAt || Date.now()).getTime() || Date.now(),
            lastUpdated: Date.now()
          };
        }
      }
    }
  } catch (_) {}
  return ordersObj;
}

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

// Ensure orders sub-store exists
if (!store._orders) {
  store._orders = {};
}

syncPassportsDbOrders(store._orders);

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
      all: (...args) => {
        if (upper.includes('SELECT')) {
          const rows = [];
          for (const [phone, sess] of Object.entries(store)) {
            if (phone.startsWith('_')) continue;
            rows.push({
              phone,
              data: sess.data,
              last_activity: sess.last_activity
            });
          }
          return rows;
        }
        return [];
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
            if (key.startsWith('_')) continue;
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
  },

  // ── Persistent Booking Orders API ──────────────────────────
  saveOrder: (voucherId, customerPhone, sessionData, status = 'PAYMENT PENDING') => {
    if (!voucherId) return;
    store._orders[voucherId] = {
      voucherId,
      customerPhone,
      status,
      sessionData: JSON.parse(JSON.stringify(sessionData || {})),
      createdAt: store._orders[voucherId]?.createdAt || Date.now(),
      lastUpdated: Date.now()
    };
    saveSessions(store);
  },

  getOrder: (voucherId) => {
    if (!voucherId) return null;
    syncPassportsDbOrders(store._orders);
    const vIdUpper = voucherId.toUpperCase().trim();
    for (const [id, order] of Object.entries(store._orders || {})) {
      if (id.toUpperCase().trim() === vIdUpper) {
        return order;
      }
    }
    return null;
  },

  getLatestPendingOrder: (customerPhone) => {
    if (!customerPhone) return null;
    syncPassportsDbOrders(store._orders);
    const cleanPhone = customerPhone.replace(/[^0-9]/g, '');
    let latest = null;

    for (const order of Object.values(store._orders || {})) {
      const orderPhone = (order.customerPhone || '').replace(/[^0-9]/g, '');
      const isPhoneMatch = (cleanPhone && orderPhone && (cleanPhone.endsWith(orderPhone) || orderPhone.endsWith(cleanPhone)));
      const isPending = (order.status || '').toUpperCase().includes('PENDING');

      if (isPhoneMatch && isPending) {
        if (!latest || order.lastUpdated > latest.lastUpdated) {
          latest = order;
        }
      }
    }
    return latest;
  },

  updateOrderStatus: (voucherId, newStatus, extraData = {}) => {
    const order = db.getOrder(voucherId);
    if (!order) return false;
    order.status = newStatus;
    order.lastUpdated = Date.now();
    Object.assign(order.sessionData, extraData);
    saveSessions(store);
    return true;
  },

  getBookingOrders: () => {
    syncPassportsDbOrders(store._orders);
    return Object.values(store._orders || {});
  }
};

module.exports = db;
