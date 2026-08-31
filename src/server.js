// ============================================================
//  src/server.js — Real-Time Operator CRM WebServer & Express API
// ============================================================

const express = require('express');
const http    = require('http');
const path    = require('path');
const fs      = require('fs');
const { Server } = require('socket.io');
const { loadClientConfig } = require('./configLoader');
const { getSession, updateSession, getAllSessions, getBookingOrders, saveBookingOrder } = require('./stateManager');
const { getEffectiveExchangeRate } = require('./utils/exchangeRate');

let io = null;
let activeClientInstance = null;

/**
 * Initializes Express, WebSockets (Socket.io), and REST API routes for the Operator CRM Dashboard.
 */
function initServer(client, app, server) {
  activeClientInstance = client;
  const activeClientConfig = loadClientConfig();

  if (!io && server) {
    io = new Server(server, {
      cors: { origin: '*' }
    });

    io.on('connection', (socket) => {
      console.log(`🔌 [Socket.io] Admin client connected: ${socket.id}`);
      socket.on('disconnect', () => {
        console.log(`🔌 [Socket.io] Admin client disconnected: ${socket.id}`);
      });
    });
  }

  // ── Serve Static Admin Dashboard & Vouchers Assets ──────────────────────
  const adminPublicDir = path.resolve(__dirname, '..', 'public', 'admin');
  const itinerariesDir = path.resolve(__dirname, '..', 'itineraries');

  app.get(['/vouchers/:filename', '/vouchers/:filename.pdf'], (req, res) => {
    let rawFilename = req.params.filename.replace(/\.pdf$/i, '');
    const candidates = [
      path.join(itinerariesDir, `Voucher_${rawFilename}.pdf`),
      path.join(itinerariesDir, `${rawFilename}.pdf`),
      path.join(itinerariesDir, rawFilename),
      path.join(itinerariesDir, `Voucher_${rawFilename}`)
    ];

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        return res.sendFile(p);
      }
    }

    res.status(404).send(`Voucher ${rawFilename} not found.`);
  });
  app.use('/vouchers', express.static(itinerariesDir));
  app.use('/admin', express.static(adminPublicDir));

  // Serve admin/ index.html for root /admin or /admin/
  app.get(['/admin', '/admin/'], (req, res) => {
    res.sendFile(path.join(adminPublicDir, 'index.html'));
  });

  // ── REST API ROUTES ──────────────────────────────────────────

  // 1. Dashboard Stats
  app.get('/api/dashboard/stats', async (req, res) => {
    try {
      const exchangeInfo = await getEffectiveExchangeRate();
      const sessions = getAllSessions();
      const orders = getBookingOrders();

      const activeChatSessions = Object.keys(sessions).length;
      const pendingVerifications = orders.filter(o => o.status === 'PENDING' || o.status === 'AWAIT_ACCOUNTS_VERIFICATION').length;

      let totalRevenueSAR = 0;
      let cashInKsaSAR = 0;
      let bankInPkr = 0;
      let pendingReceivablesSAR = 0;
      let totalPilgrims = 0;

      orders.forEach(o => {
        const s = o.sessionData || {};
        const pax = s.passengerCount || 1;
        totalPilgrims += pax;

        const sarCost = s.totalSar || s.totalCostSAR || s.customPackageTotalSAR || s.finalVisaRate || 0;
        totalRevenueSAR += sarCost;

        if (o.status === 'APPROVED' || o.status === 'CONFIRMED') {
          if (s.paymentType === 'CASH_KSA') {
            cashInKsaSAR += sarCost;
          } else {
            bankInPkr += Math.round(sarCost * (s.effectiveRate || exchangeInfo.effectiveRate));
          }
        } else {
          pendingReceivablesSAR += sarCost;
        }
      });

      return res.json({
        success: true,
        data: {
          agencyName: activeClientConfig.agencyName,
          forexRate: exchangeInfo.effectiveRate,
          totalRevenueSAR,
          totalRevenuePKR: Math.round(totalRevenueSAR * exchangeInfo.effectiveRate),
          cashInKsaSAR,
          bankInPkr,
          pendingReceivablesSAR,
          totalPilgrims,
          activeChatSessions,
          pendingVerifications
        }
      });
    } catch (err) {
      console.error('[API Stats Error]:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 2. Active Chat Sessions List
  app.get('/api/chats', (req, res) => {
    try {
      const sessions = getAllSessions();
      const chatsList = Object.entries(sessions).map(([phone, s]) => {
        const cleanPhone = phone.replace('@c.us', '').replace('@lid', '');
        return {
          phone,
          cleanPhone,
          familyHead: s.familyHeadName || (s.passportData ? `${s.passportData.firstName} ${s.passportData.lastName}` : null),
          flow: s.flow || 'Umrah Flow',
          step: s.step || 'IDLE',
          humanTakeover: !!s.humanTakeover,
          pax: s.passengerCount || 1,
          messages: s.chatHistory || [],
          sessionData: s
        };
      });

      return res.json({ success: true, data: chatsList });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 3. Send Operator Message to Customer WhatsApp
  app.post('/api/chats/:phone/send', async (req, res) => {
    try {
      const phone = decodeURIComponent(req.params.phone);
      const { message } = req.body;
      if (!message || !message.trim()) {
        return res.status(400).json({ success: false, error: 'Message text required' });
      }

      if (activeClientInstance) {
        await activeClientInstance.sendMessage(phone, message.trim());

        // Update chat history in session
        const session = getSession(phone);
        const history = session.chatHistory || [];
        history.push({
          body: message.trim(),
          isOperator: true,
          timestamp: Date.now()
        });
        updateSession(phone, { chatHistory: history });

        // Broadcast to WebSocket clients
        if (io) {
          io.emit('whatsapp:message_sent', {
            phone,
            message: { body: message.trim(), isOperator: true, timestamp: Date.now() }
          });
        }

        return res.json({ success: true });
      } else {
        return res.status(500).json({ success: false, error: 'WhatsApp client offline' });
      }
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4. Toggle AI Auto-reply / Human Takeover
  app.post('/api/chats/:phone/toggle-ai', (req, res) => {
    try {
      const phone = decodeURIComponent(req.params.phone);
      const { humanTakeover } = req.body;

      updateSession(phone, { humanTakeover: !!humanTakeover });

      if (io) {
        io.emit('whatsapp:ai_toggled', { phone, humanTakeover: !!humanTakeover });
      }

      return res.json({ success: true, humanTakeover: !!humanTakeover });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 5. Orders Pipeline
  app.get('/api/orders', (req, res) => {
    try {
      const { status } = req.query;
      let orders = getBookingOrders();
      if (status && status !== 'ALL') {
        orders = orders.filter(o => o.status === status);
      }
      return res.json({ success: true, data: orders });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 6. Approve Order
  app.post('/api/orders/:voucherId/approve', async (req, res) => {
    try {
      const { voucherId } = req.params;
      const orders = getBookingOrders();
      const order = orders.find(o => o.voucherId === voucherId);
      if (!order) return res.status(404).json({ success: false, error: 'Voucher order not found' });

      order.status = 'APPROVED';
      saveBookingOrder(voucherId, order.customerPhone, order.sessionData, 'APPROVED');

      if (io) {
        io.emit('order:approved', { voucherId, phone: order.customerPhone });
      }

      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 7. Confirm Cash Payment
  app.post('/api/orders/:voucherId/confirm-cash', (req, res) => {
    try {
      const { voucherId } = req.params;
      const orders = getBookingOrders();
      const order = orders.find(o => o.voucherId === voucherId);
      if (!order) return res.status(404).json({ success: false, error: 'Voucher order not found' });

      order.status = 'CASH_CONFIRMED';
      order.sessionData.paymentType = 'CASH_KSA';
      saveBookingOrder(voucherId, order.customerPhone, order.sessionData, 'CASH_CONFIRMED');

      if (io) {
        io.emit('order:cash_confirmed', { voucherId, phone: order.customerPhone });
      }

      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 8. Hotel Inventory & Bed Occupancy Report
  app.get('/api/reports/hotel-occupancy', (req, res) => {
    try {
      const activeClientConfig = loadClientConfig();
      const clientId = activeClientConfig.clientId || process.env.CLIENT_ID || 'default';

      let makkahHotels = activeClientConfig.makkahHotels || activeClientConfig.hotels?.makkah || [];
      let madinahHotels = activeClientConfig.madinahHotels || activeClientConfig.hotels?.madinah || [];

      // In Six Sigma dashboard, show both Six Sigma and Masarat Group hotels
      if (clientId === 'six_sigma' || clientId === 'default') {
        try {
          const masaratConfig = loadClientConfig('masarat_group');
          const masaratMakkah = masaratConfig.makkahHotels || [];
          const masaratMadinah = masaratConfig.madinahHotels || [];

          // Combine Makkah hotels without duplicates
          const makkahMap = new Map();
          makkahHotels.forEach(h => makkahMap.set(h.name.toLowerCase().trim(), h));
          masaratMakkah.forEach(h => {
            if (!makkahMap.has(h.name.toLowerCase().trim())) {
              makkahMap.set(h.name.toLowerCase().trim(), h);
            }
          });
          makkahHotels = Array.from(makkahMap.values());

          // Combine Madinah hotels without duplicates
          const madinahMap = new Map();
          madinahHotels.forEach(h => madinahMap.set(h.name.toLowerCase().trim(), h));
          masaratMadinah.forEach(h => {
            if (!madinahMap.has(h.name.toLowerCase().trim())) {
              madinahMap.set(h.name.toLowerCase().trim(), h);
            }
          });
          madinahHotels = Array.from(madinahMap.values());
        } catch (e) {
          console.warn('[Server] Could not load masarat_group config for merging:', e.message);
        }
      }

      const orders = getBookingOrders();

      const formatHotelList = (list, city) => list.map(h => {
        const matchingBookings = orders.filter(o => {
          const s = o.sessionData || {};
          return (s.makkahBooking?.hotelName === h.name || s.madinahBooking?.hotelName === h.name || s.cityBooking?.hotelName === h.name);
        }).map(o => ({
          voucherId: o.voucherId,
          guestName: o.sessionData.familyHeadName || 'Guest',
          phone: o.customerPhone ? o.customerPhone.replace('@c.us', '') : '',
          checkIn: o.sessionData.checkInPretty || 'TBD',
          checkOut: o.sessionData.checkOutPretty || 'TBD',
          nights: o.sessionData.nights || 1,
          roomType: o.sessionData.roomType || 'Double',
          pax: o.sessionData.passengerCount || 1,
          status: o.status || 'CONFIRMED'
        }));

        const totalRooms = 30;
        const totalBeds = 120;
        const occupiedBeds = matchingBookings.reduce((sum, b) => sum + b.pax, 0);
        const occupancyPercent = Math.min(100, Math.round((occupiedBeds / totalBeds) * 100));
        const availableRooms = Math.max(0, totalRooms - Math.ceil(occupiedBeds / 4));

        return {
          hotelName: h.name,
          city,
          distance: h.distance || 'Central Area',
          location: h.location || 'Saudi Arabia',
          totalRooms,
          totalBeds,
          occupiedBeds,
          occupancyPercent,
          availableRooms,
          statusBadge: occupancyPercent >= 90 ? 'FULL' : 'AVAILABLE',
          bookings: matchingBookings
        };
      });

      const reportData = [
        ...formatHotelList(makkahHotels, 'Makkah'),
        ...formatHotelList(madinahHotels, 'Madinah')
      ];

      return res.json({ success: true, data: reportData });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 9. Daily Movements
  app.get('/api/reports/movements', (req, res) => {
    try {
      const dateStr = req.query.date || new Date().toISOString().split('T')[0];
      const orders = getBookingOrders();
      return res.json({ success: true, date: dateStr, data: orders });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 10. Cashflow
  app.get('/api/reports/cashflow', async (req, res) => {
    try {
      const exchangeInfo = await getEffectiveExchangeRate();
      const orders = getBookingOrders();
      return res.json({ success: true, forexRate: exchangeInfo.effectiveRate, orders });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 11. Flight Seats
  app.get('/api/reports/flight-seats', (req, res) => {
    try {
      return res.json({ success: true, flights: [] });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 12. Tenant Settings
  app.get('/api/settings', (req, res) => {
    try {
      return res.json({ success: true, config: activeClientConfig });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  console.log(`🌐 Operator CRM Dashboard & API Server live at: http://localhost:${process.env.PORT || 3000}/admin`);
}

function getIO() {
  return io;
}

function emitSocketEvent(eventName, payload) {
  if (io) {
    try {
      io.emit(eventName, payload);
    } catch (err) {
      console.warn('[Socket.io] Error emitting event:', err.message);
    }
  }
}

module.exports = { initServer, getIO, emitSocketEvent };
