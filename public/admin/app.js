// ============================================================
//  public/admin/app.js — Real-Time Operator CRM Single Page Application
// ============================================================

let socket = null;
let currentChatPhone = null;
let allChatsData = [];
let allOrdersData = [];
let allHotelsData = [];
let currentHotelFilter = 'ALL';
let revenueChart = null;
let paymentChart = null;

document.addEventListener('DOMContentLoaded', () => {
  initSocket();
  initNavigation();
  initThemeToggle();
  initEventHandlers();
  
  // Initial data fetch
  refreshAllData();
});

// ── 1. Socket.io Real-Time Connection ────────────────────────
function initSocket() {
  try {
    socket = io();

    socket.on('connect', () => {
      console.log('✅ Connected to Operator WebSockets Gateway');
      updateBotStatus(true);
    });

    socket.on('disconnect', () => {
      console.warn('⚠️ Disconnected from WebSockets Gateway');
      updateBotStatus(false);
    });

    // Real-time incoming WhatsApp message
    socket.on('whatsapp:message_received', (data) => {
      showToast(`📩 New message from ${data.phone.replace('@c.us', '')}`, 'info');
      loadChats(false);
      loadDashboardStats();

      if (currentChatPhone && (currentChatPhone === data.phone || currentChatPhone === data.phone.replace('@c.us', ''))) {
        appendChatMessage(data.message);
      }
    });

    // Real-time sent WhatsApp message (by Bot or Operator)
    socket.on('whatsapp:message_sent', (data) => {
      if (currentChatPhone && (currentChatPhone === data.phone || currentChatPhone === data.phone.replace('@c.us', ''))) {
        appendChatMessage(data.message);
      }
    });

    // Real-time AI toggle sync
    socket.on('whatsapp:ai_toggled', (data) => {
      if (currentChatPhone && currentChatPhone === data.phone) {
        const toggle = document.getElementById('aiToggleSwitch');
        const label = document.getElementById('aiStatusLabel');
        toggle.checked = !data.humanTakeover;
        label.textContent = !data.humanTakeover ? 'ACTIVE' : 'PAUSED (OPERATOR)';
        label.className = `badge ${!data.humanTakeover ? 'badge-success' : 'badge-danger'}`;
      }
    });

    // Order status changes
    socket.on('order:approved', (data) => {
      showToast(`🎉 Voucher ${data.voucherId} marked APPROVED & Confirmed!`, 'success');
      loadOrders();
      loadDashboardStats();
    });

    socket.on('order:cash_confirmed', (data) => {
      showToast(`💵 Cash payment in KSA confirmed for ${data.voucherId}!`, 'success');
      loadOrders();
      loadDashboardStats();
      loadCashflow();
    });

  } catch (err) {
    console.error('Socket init error:', err);
  }
}

function updateBotStatus(isOnline) {
  const statusState = document.getElementById('botStatusText');
  if (statusState) {
    statusState.textContent = isOnline ? 'Online & Listening' : 'Syncing / Reconnecting';
    statusState.style.color = isOnline ? 'var(--accent-emerald)' : 'var(--accent-amber)';
  }
}

// ── 2. Navigation & Tab Switching ────────────────────────────
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const tabId = item.getAttribute('data-tab');
      switchTab(tabId);
    });
  });

  // Movement date default to today
  const movementDateInput = document.getElementById('movementDateInput');
  if (movementDateInput) {
    movementDateInput.value = new Date().toISOString().split('T')[0];
  }
}

function switchTab(tabId) {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));

  const activeNav = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
  const activePane = document.getElementById(`tab-${tabId}`);
  if (activeNav) activeNav.classList.add('active');
  if (activePane) activePane.classList.add('active');

  const titles = {
    overview: ['Dashboard Overview', 'Real-time operational intelligence and booking management'],
    chats: ['Live Chat Center & Human Takeover', 'Direct omnichannel customer communication & AI co-pilot'],
    orders: ['Bookings Pipeline', 'Track leads, approvals, and verified vouchers across all travel desks'],
    occupancy: ['Hotel Inventory & Bed Matrix', 'Live room allocations and bed counts in Makkah & Madinah'],
    movements: ['Daily Movements Desk', 'Check-ins, check-outs, and airport transfer schedules'],
    cashflow: ['Cashflow & Multi-Currency Finance', 'Reconciliation of Saudi Cash on Ground vs Pakistan Bank Deposits'],
    flights: ['Flight Group Seats & Manifest', 'Pre-purchased flight inventory and airline passenger manifests'],
    settings: ['Tenant & System Settings', 'Active travel agency profile, bank accounts, and contact routing']
  };

  if (titles[tabId]) {
    document.getElementById('pageTitle').textContent = titles[tabId][0];
    document.getElementById('pageSubtitle').textContent = titles[tabId][1];
  }

  // Load specific data per tab
  if (tabId === 'overview') loadDashboardStats();
  if (tabId === 'chats') loadChats();
  if (tabId === 'orders') loadOrders();
  if (tabId === 'occupancy') loadHotelOccupancy();
  if (tabId === 'movements') loadDailyMovements();
  if (tabId === 'cashflow') loadCashflow();
  if (tabId === 'flights') loadFlightSeats();
  if (tabId === 'settings') loadTenantSettings();
}

function refreshAllData() {
  loadDashboardStats();
  loadOrders();
  loadChats();
  loadHotelOccupancy();
  loadDailyMovements();
  loadCashflow();
  loadFlightSeats();
  loadTenantSettings();
}

// ── 3. Event Handlers & Theme Toggle ─────────────────────────
function initEventHandlers() {
  document.getElementById('refreshDataBtn').addEventListener('click', () => {
    refreshAllData();
  });

  document.getElementById('sendOperatorMessageBtn').addEventListener('click', sendOperatorMessage);
  document.getElementById('operatorMessageInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendOperatorMessage();
  });

  document.getElementById('aiToggleSwitch').addEventListener('change', (e) => {
    if (!currentChatPhone) return;
    const isBotActive = e.target.checked;
    toggleAI(!isBotActive); // humanTakeover = !isBotActive
  });

  // Filter pills in Orders Pipeline
  document.querySelectorAll('.filter-pill[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-pill[data-filter]').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      loadOrders(btn.getAttribute('data-filter'));
    });
  });

  // City filter pills in Hotel Inventory
  document.querySelectorAll('.hotel-city-pills .filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.hotel-city-pills .filter-pill').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.getAttribute('data-hotel-city');
      currentHotelFilter = filter;
      renderHotelCards(filter);
    });
  });

  // KPI Metrics Cards Click Handlers (Open Popup Modals in Same Section)
  const kpiCards = document.querySelectorAll('.kpi-grid .kpi-card');
  if (kpiCards.length >= 4) {
    // 1. Total Revenue Card
    kpiCards[0].style.cursor = 'pointer';
    kpiCards[0].title = 'Click to open Total Revenue breakdown popup';
    kpiCards[0].addEventListener('click', () => openKpiModal('revenue'));

    // 2. Cash on Ground (KSA) Card
    kpiCards[1].style.cursor = 'pointer';
    kpiCards[1].title = 'Click to open Cash on Ground (KSA) popup';
    kpiCards[1].addEventListener('click', () => openKpiModal('cash'));

    // 3. Pending Receivables Card
    kpiCards[2].style.cursor = 'pointer';
    kpiCards[2].title = 'Click to open Pending Receivables popup';
    kpiCards[2].addEventListener('click', () => openKpiModal('pending'));

    // 4. Total Pilgrims Card
    kpiCards[3].style.cursor = 'pointer';
    kpiCards[3].title = 'Click to open Verified Pilgrims Roster popup';
    kpiCards[3].addEventListener('click', () => openKpiModal('pilgrims'));
  }

  // Close buttons & background overlay click listeners
  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeActiveModal();
    });
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeActiveModal();
      }
    });
  });

  const dateInput = document.getElementById('movementDateInput');
  if (dateInput) {
    dateInput.addEventListener('change', loadDailyMovements);
    dateInput.addEventListener('input', loadDailyMovements);
  }
}

function closeActiveModal() {
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.classList.remove('active');
    modal.style.display = 'none';
  });
}

function openKpiModal(type) {
  const modal = document.getElementById('kpiDetailModal');
  const title = document.getElementById('kpiModalTitle');
  const subtitle = document.getElementById('kpiModalSubtitle');
  const icon = document.getElementById('kpiModalIcon');
  const body = document.getElementById('kpiModalBody');
  if (!modal || !body) return;

  modal.style.display = 'flex';
  modal.classList.add('active');

  const orders = allOrdersData || [];

  if (type === 'revenue') {
    icon.className = 'modal-icon icon-emerald';
    icon.innerHTML = '<i class="fa-solid fa-wallet"></i>';
    title.textContent = 'Total Revenue Breakdown';
    subtitle.textContent = 'Summary of all completed & approved package booking vouchers';

    let totalSAR = 0;
    let totalPKR = 0;
    const rows = orders.map(o => {
      const s = o.sessionData || {};
      const { costSAR, costPKR } = getClientOrderAmount(s);
      totalSAR += costSAR;
      totalPKR += costPKR;
      const guest = s.familyHeadName || (s.passportData ? `${s.passportData.firstName} ${s.passportData.lastName}` : 'Guest');
      return `
        <tr>
          <td>
            <a href="/vouchers/${o.voucherId}.pdf" target="_blank" style="color:var(--accent-cyan); font-weight:700; text-decoration:none;">
              <i class="fa-solid fa-file-pdf" style="color:var(--accent-rose);"></i> ${o.voucherId}
            </a>
          </td>
          <td><strong>${guest}</strong></td>
          <td><strong>${costSAR.toLocaleString()} SAR</strong></td>
          <td>~ ${costPKR.toLocaleString()} PKR</td>
          <td>${s.paymentType === 'CASH_KSA' ? '💵 Cash (KSA)' : '🏦 Bank Deposit'}</td>
          <td><span class="badge-status ${getStatusClass(o.status)}">${o.status || 'APPROVED'}</span></td>
        </tr>
      `;
    }).join('');

    body.innerHTML = `
      <div class="modal-stats-grid">
        <div class="modal-stat-box">
          <div class="modal-stat-label">Total Revenue (SAR)</div>
          <div class="modal-stat-value" style="color:var(--accent-emerald);">${totalSAR.toLocaleString()} SAR</div>
        </div>
        <div class="modal-stat-box">
          <div class="modal-stat-label">Converted Total (PKR)</div>
          <div class="modal-stat-value" style="color:var(--accent-cyan);">~ ${totalPKR.toLocaleString()} PKR</div>
        </div>
        <div class="modal-stat-box">
          <div class="modal-stat-label">Total Booking Vouchers</div>
          <div class="modal-stat-value" style="color:var(--text-primary);">${orders.length} Vouchers</div>
        </div>
      </div>
      <div class="modal-table-wrap mt-4">
        <table class="modal-table">
          <thead>
            <tr>
              <th>Voucher ID</th>
              <th>Guest / Head</th>
              <th>Amount (SAR)</th>
              <th>Amount (PKR)</th>
              <th>Payment Mode</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="6" class="text-center py-4 text-muted">No revenue orders found.</td></tr>'}</tbody>
        </table>
      </div>
    `;
  } else if (type === 'cash') {
    icon.className = 'modal-icon icon-amber';
    icon.innerHTML = '<i class="fa-solid fa-money-bill-wave"></i>';
    title.textContent = 'Cash on Ground (KSA) Ledger';
    subtitle.textContent = 'Saudi Riyal cash hand-delivered in Makkah & Madinah';

    const cashOrders = orders.filter(o => o.sessionData?.paymentType === 'CASH_KSA' || o.status === 'CASH_CONFIRMED');
    let totalCashSAR = 0;
    const rows = cashOrders.map(o => {
      const s = o.sessionData || {};
      const { costSAR } = getClientOrderAmount(s);
      totalCashSAR += costSAR;
      const guest = s.familyHeadName || (s.passportData ? `${s.passportData.firstName} ${s.passportData.lastName}` : 'Guest');
      return `
        <tr>
          <td>
            <a href="/vouchers/${o.voucherId}.pdf" target="_blank" style="color:var(--accent-cyan); font-weight:700; text-decoration:none;">
              <i class="fa-solid fa-file-pdf" style="color:var(--accent-rose);"></i> ${o.voucherId}
            </a>
          </td>
          <td><strong>${guest}</strong></td>
          <td><strong>${costSAR.toLocaleString()} SAR</strong></td>
          <td>💵 Hand-delivered in Saudi</td>
          <td><span class="badge-status status-approved">CASH CONFIRMED</span></td>
        </tr>
      `;
    }).join('');

    body.innerHTML = `
      <div class="modal-stats-grid">
        <div class="modal-stat-box">
          <div class="modal-stat-label">Total Cash Collected (SAR)</div>
          <div class="modal-stat-value" style="color:var(--accent-amber);">${totalCashSAR.toLocaleString()} SAR</div>
        </div>
        <div class="modal-stat-box">
          <div class="modal-stat-label">Cash Bookings Count</div>
          <div class="modal-stat-value" style="color:var(--text-primary);">${cashOrders.length} Bookings</div>
        </div>
      </div>
      <div class="modal-table-wrap mt-4">
        <table class="modal-table">
          <thead>
            <tr>
              <th>Voucher ID</th>
              <th>Guest / Head</th>
              <th>Amount (SAR)</th>
              <th>Delivery Status</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="5" class="text-center py-4 text-muted">No cash-on-ground transactions recorded yet.</td></tr>'}</tbody>
        </table>
      </div>
    `;
  } else if (type === 'pending') {
    icon.className = 'modal-icon icon-rose';
    icon.innerHTML = '<i class="fa-solid fa-clock-rotate-left"></i>';
    title.textContent = 'Pending Payment Receivables';
    subtitle.textContent = 'Bookings awaiting payment deposit or accounts verification';

    const pendingOrders = orders.filter(o => o.status === 'PENDING' || o.status === 'AWAIT_ACCOUNTS_VERIFICATION');
    let totalPendingSAR = 0;
    let totalPendingPKR = 0;
    const rows = pendingOrders.map(o => {
      const s = o.sessionData || {};
      const { costSAR, costPKR } = getClientOrderAmount(s);
      totalPendingSAR += costSAR;
      totalPendingPKR += costPKR;
      const guest = s.familyHeadName || (s.passportData ? `${s.passportData.firstName} ${s.passportData.lastName}` : 'Guest');
      return `
        <tr>
          <td>
            <a href="/vouchers/${o.voucherId}.pdf" target="_blank" style="color:var(--accent-cyan); font-weight:700; text-decoration:none;">
              <i class="fa-solid fa-file-pdf" style="color:var(--accent-rose);"></i> ${o.voucherId}
            </a>
          </td>
          <td><strong>${guest}</strong></td>
          <td>+${(o.customerPhone || '').replace('@c.us', '')}</td>
          <td><strong>${costSAR.toLocaleString()} SAR</strong></td>
          <td>~ ${costPKR.toLocaleString()} PKR</td>
          <td><span class="badge-status status-pending">${o.status || 'PENDING'}</span></td>
          <td>
            <button class="btn-table btn-approve" onclick="approveOrder('${o.voucherId}'); document.getElementById('kpiDetailModal').classList.remove('active');">Approve</button>
          </td>
        </tr>
      `;
    }).join('');

    body.innerHTML = `
      <div class="modal-stats-grid">
        <div class="modal-stat-box">
          <div class="modal-stat-label">Pending Receivables (SAR)</div>
          <div class="modal-stat-value" style="color:var(--accent-rose);">${totalPendingSAR.toLocaleString()} SAR</div>
        </div>
        <div class="modal-stat-box">
          <div class="modal-stat-label">Pending Receivables (PKR)</div>
          <div class="modal-stat-value" style="color:var(--accent-amber);">~ ${totalPendingPKR.toLocaleString()} PKR</div>
        </div>
        <div class="modal-stat-box">
          <div class="modal-stat-label">Pending Orders Count</div>
          <div class="modal-stat-value" style="color:var(--text-primary);">${pendingOrders.length} Orders</div>
        </div>
      </div>
      <div class="modal-table-wrap mt-4">
        <table class="modal-table">
          <thead>
            <tr>
              <th>Voucher ID</th>
              <th>Guest / Head</th>
              <th>WhatsApp Contact</th>
              <th>Amount (SAR)</th>
              <th>Amount (PKR)</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="7" class="text-center py-4 text-muted">No pending payment receivables at this time. All clear!</td></tr>'}</tbody>
        </table>
      </div>
    `;
  } else if (type === 'pilgrims') {
    icon.className = 'modal-icon icon-cyan';
    icon.innerHTML = '<i class="fa-solid fa-users"></i>';
    title.textContent = 'Verified Group Pilgrims Roster';
    subtitle.textContent = 'Verified passenger passports across all confirmed vouchers';

    let totalPax = 0;
    const rows = orders.map(o => {
      const s = o.sessionData || {};
      const p = s.passportData || {};
      const pax = s.passengerCount || 1;
      totalPax += pax;
      return `
        <tr>
          <td><strong style="font-family:monospace; color:var(--accent-cyan);">${p.passportNumber || 'CONFIRMED'}</strong></td>
          <td><strong>${s.familyHeadName || `${p.firstName || 'Group'} ${p.lastName || 'Passenger'}`}</strong></td>
          <td>${p.nationality || 'PAKISTANI'}</td>
          <td>${p.expiryDate || 'Valid'}</td>
          <td>
            <a href="/vouchers/${o.voucherId}.pdf" target="_blank" style="color:var(--accent-cyan); font-weight:700; text-decoration:none;">
              <i class="fa-solid fa-file-pdf" style="color:var(--accent-rose);"></i> ${o.voucherId}
            </a>
          </td>
          <td><span class="badge-status status-approved">VERIFIED</span></td>
        </tr>
      `;
    }).join('');

    body.innerHTML = `
      <div class="modal-stats-grid">
        <div class="modal-stat-box">
          <div class="modal-stat-label">Total Verified Pilgrims</div>
          <div class="modal-stat-value" style="color:var(--accent-cyan);">${totalPax} Pilgrims</div>
        </div>
        <div class="modal-stat-box">
          <div class="modal-stat-label">Confirmed Group Vouchers</div>
          <div class="modal-stat-value" style="color:var(--accent-emerald);">${orders.length} Vouchers</div>
        </div>
      </div>
      <div class="modal-table-wrap mt-4">
        <table class="modal-table">
          <thead>
            <tr>
              <th>Passport No</th>
              <th>Passenger / Head Name</th>
              <th>Nationality</th>
              <th>Passport Expiry</th>
              <th>Voucher ID</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="6" class="text-center py-4 text-muted">No passenger records found.</td></tr>'}</tbody>
        </table>
      </div>
    `;
  }

  modal.classList.add('active');
}

function filterOrders(filter = 'ALL') {
  document.querySelectorAll('.filter-pill[data-filter]').forEach(p => {
    if (p.getAttribute('data-filter') === filter) {
      p.classList.add('active');
    } else {
      p.classList.remove('active');
    }
  });
  loadOrders(filter);
}

function initThemeToggle() {
  const toggleBtn = document.getElementById('themeToggleBtn');
  toggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const isLight = document.body.classList.contains('light-theme');
    toggleBtn.innerHTML = isLight ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
  });
}

// ── 4. Dashboard Stats & Charts ──────────────────────────────
async function loadDashboardStats() {
  try {
    const res = await fetch('/api/dashboard/stats');
    const json = await res.json();
    if (!json.success) return;

    const d = json.data;
    document.getElementById('agencyBrandTitle').textContent = d.agencyName;
    document.getElementById('headerForexRate').textContent = `${d.forexRate.toFixed(2)} PKR`;

    document.getElementById('kpiRevenueSAR').textContent = `${d.totalRevenueSAR.toLocaleString()} SAR`;
    document.getElementById('kpiRevenuePKR').textContent = `~ ${d.totalRevenuePKR.toLocaleString()} PKR`;
    document.getElementById('kpiCashKSA').textContent = `${d.cashInKsaSAR.toLocaleString()} SAR`;
    document.getElementById('kpiPendingReceivables').textContent = `${d.pendingReceivablesSAR.toLocaleString()} SAR`;
    document.getElementById('kpiTotalPilgrims').textContent = d.totalPilgrims;

    document.getElementById('activeChatsBadge').textContent = d.activeChatSessions;
    document.getElementById('pendingOrdersBadge').textContent = d.pendingVerifications;

    renderCharts(d);
  } catch (err) {
    console.error('Error loading stats:', err);
  }
}

function renderCharts(stats) {
  // Revenue Trend Line/Bar Chart
  const revCtx = document.getElementById('revenueTrendChart')?.getContext('2d');
  if (revCtx) {
    if (revenueChart) revenueChart.destroy();
    revenueChart = new Chart(revCtx, {
      type: 'bar',
      data: {
        labels: ['Bank (PKR Equivalent)', 'Cash on Ground (SAR)', 'Pending Receivables (SAR)'],
        datasets: [{
          label: 'SAR Value',
          data: [
            Math.round(stats.bankInPkr / (stats.forexRate || 74.5)),
            stats.cashInKsaSAR,
            stats.pendingReceivablesSAR
          ],
          backgroundColor: ['#10b981', '#f59e0b', '#f43f5e'],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { grid: { color: 'rgba(255,255,255,0.05)' } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  // Payment Breakdown Doughnut
  const payCtx = document.getElementById('paymentMethodsChart')?.getContext('2d');
  if (payCtx) {
    if (paymentChart) paymentChart.destroy();
    paymentChart = new Chart(payCtx, {
      type: 'doughnut',
      data: {
        labels: ['Cash in KSA', 'Bank (Pakistan)', 'Pending'],
        datasets: [{
          data: [stats.cashInKsaSAR || 1, Math.round((stats.bankInPkr || 1) / (stats.forexRate || 74.5)), stats.pendingReceivablesSAR || 1],
          backgroundColor: ['#f59e0b', '#10b981', '#f43f5e'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
        }
      }
    });
  }
}

// ── 5. Live Chat Center & Human Takeover ─────────────────────
async function loadChats(autoSelectFirst = true) {
  try {
    const res = await fetch('/api/chats');
    const json = await res.json();
    if (!json.success) return;

    allChatsData = json.data;
    renderChatList(allChatsData);

    if (autoSelectFirst && allChatsData.length > 0 && !currentChatPhone) {
      selectChat(allChatsData[0].phone);
    }
  } catch (err) {
    console.error('Error loading chats:', err);
  }
}

function renderChatList(chats) {
  const container = document.getElementById('chatListContainer');
  if (!container) return;

  if (chats.length === 0) {
    container.innerHTML = '<div class="text-center py-4 text-muted">No active conversations found.</div>';
    return;
  }

  container.innerHTML = chats.map(c => {
    const isActive = c.phone === currentChatPhone;
    const initial = (c.familyHead || 'U')[0].toUpperCase();
    const takeoverBadge = c.humanTakeover ? '<span class="badge badge-danger">HUMAN</span>' : '';
    const lastMsgText = typeof c.lastMessage?.body === 'string' ? c.lastMessage.body : (c.flow || 'Inquiry');

    return `
      <div class="chat-list-item ${isActive ? 'active' : ''}" onclick="selectChat('${c.phone}')">
        <div class="avatar-circle">${initial}</div>
        <div class="chat-item-info">
          <div class="chat-item-name">${c.familyHead || c.cleanPhone}</div>
          <div class="chat-item-preview">${lastMsgText}</div>
        </div>
        ${takeoverBadge}
      </div>
    `;
  }).join('');
}

function selectChat(phone) {
  currentChatPhone = phone;
  const chat = allChatsData.find(c => c.phone === phone);
  if (!chat) return;

  renderChatList(allChatsData);

  document.getElementById('currentChatName').textContent = chat.familyHead || `+${chat.cleanPhone}`;
  document.getElementById('currentChatPhone').textContent = `WhatsApp: +${chat.cleanPhone} | ${chat.flow || 'Umrah Flow'}`;
  document.getElementById('currentChatAvatar').textContent = (chat.familyHead || 'U')[0].toUpperCase();

  // Set AI Switch status
  const aiToggle = document.getElementById('aiToggleSwitch');
  const aiLabel = document.getElementById('aiStatusLabel');
  aiToggle.checked = !chat.humanTakeover;
  aiLabel.textContent = !chat.humanTakeover ? 'ACTIVE' : 'PAUSED (OPERATOR)';
  aiLabel.className = `badge ${!chat.humanTakeover ? 'badge-success' : 'badge-danger'}`;

  // Render messages
  const msgContainer = document.getElementById('chatMessagesScroll');
  if (chat.messages && chat.messages.length > 0) {
    msgContainer.innerHTML = chat.messages.map(m => createMessageBubbleHtml(m)).join('');
    msgContainer.scrollTop = msgContainer.scrollHeight;
  } else {
    msgContainer.innerHTML = `
      <div class="empty-chat-prompt">
        <i class="fa-solid fa-comments"></i>
        <p>Active conversation started. Latest Step: <strong>${chat.step}</strong></p>
      </div>
    `;
  }

  // Render Dossier
  renderDossier(chat);
}

function createMessageBubbleHtml(m) {
  const isIncoming = !m.isBot && !m.isOperator;
  const bubbleClass = isIncoming ? 'msg-incoming' : (m.isOperator ? 'msg-operator' : 'msg-bot');
  const senderLabel = isIncoming ? '👤 Customer' : (m.isOperator ? '👨‍💼 Operator' : '🤖 AI Bot');
  const time = new Date(m.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return `
    <div class="msg-bubble ${bubbleClass}">
      <small style="opacity:0.7; font-size:10px; display:block; margin-bottom:2px;">${senderLabel}</small>
      ${escapeHtml(m.body || '')}
      <span class="msg-time">${time}</span>
    </div>
  `;
}

function appendChatMessage(m) {
  const msgContainer = document.getElementById('chatMessagesScroll');
  if (!msgContainer) return;
  const div = document.createElement('div');
  div.innerHTML = createMessageBubbleHtml(m);
  msgContainer.appendChild(div.firstElementChild);
  msgContainer.scrollTop = msgContainer.scrollHeight;
}

function renderDossier(chat) {
  const panel = document.getElementById('dossierContent');
  if (!panel) return;

  const s = chat.sessionData || {};
  const voucherBtn = s.voucherId
    ? `<a href="/vouchers/${s.voucherId}.pdf" target="_blank" class="action-btn export-btn mt-2" style="font-size:11px; text-decoration:none;"><i class="fa-solid fa-file-pdf"></i> View Voucher (${s.voucherId})</a>`
    : '';

  const quickActionsHtml = s.voucherId ? `
    <div class="dossier-card">
      <h4>Quick Actions (Voucher: ${s.voucherId})</h4>
      <button class="btn-table btn-approve mb-2" onclick="approveOrder('${s.voucherId}')" style="width:100%; justify-content:center;"><i class="fa-solid fa-check"></i> Approve & Send Voucher</button>
      <button class="btn-table btn-cash" onclick="confirmCashPayment('${s.voucherId}')" style="width:100%; justify-content:center; margin-top:6px;"><i class="fa-solid fa-money-bill-wave"></i> Confirm Cash in KSA</button>
    </div>
  ` : `
    <div class="dossier-card" style="opacity: 0.85;">
      <h4>Quick Actions</h4>
      <div style="font-size: 11px; color: var(--text-muted); text-align: center; padding: 10px 4px; line-height: 1.4;">
        <i class="fa-solid fa-circle-info" style="color: var(--accent-cyan); margin-bottom: 4px; display: block; font-size: 14px;"></i>
        No booking voucher generated yet.<br>Lead is currently at <strong>${chat.step || 'WELCOME'}</strong> stage.
      </div>
    </div>
  `;

  panel.innerHTML = `
    <div class="dossier-card">
      <h4>Contact & Head</h4>
      <p><strong>Name:</strong> ${chat.familyHead || 'N/A'}</p>
      <p><strong>Phone:</strong> +${chat.cleanPhone}</p>
      <p><strong>Pax:</strong> ${chat.pax} Person(s)</p>
    </div>

    <div class="dossier-card">
      <h4>Active Selection</h4>
      <p><strong>Flow:</strong> ${chat.flow || 'Package'}</p>
      <p><strong>Step:</strong> ${chat.step || 'START'}</p>
      ${s.makkahBooking ? `<p><strong>Makkah:</strong> ${s.makkahBooking.hotelName}</p>` : ''}
      ${s.madinahBooking ? `<p><strong>Madinah:</strong> ${s.madinahBooking.hotelName}</p>` : ''}
      ${voucherBtn}
    </div>

    ${quickActionsHtml}
  `;
}

async function sendOperatorMessage() {
  if (!currentChatPhone) {
    showToast('Please select a conversation first', 'error');
    return;
  }
  const input = document.getElementById('operatorMessageInput');
  const text = input.value.trim();
  if (!text) return;

  try {
    input.value = '';
    const res = await fetch(`/api/chats/${encodeURIComponent(currentChatPhone)}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    });
    const json = await res.json();
    if (json.success) {
      showToast('Message delivered to WhatsApp', 'success');
    } else {
      showToast(json.error || 'Failed to send message', 'error');
    }
  } catch (err) {
    showToast('Failed to send message: ' + err.message, 'error');
  }
}

function sendQuickReply(msgText) {
  const input = document.getElementById('operatorMessageInput');
  if (input) {
    input.value = msgText;
    input.focus();
  }
}

async function toggleAI(humanTakeover) {
  if (!currentChatPhone) return;
  try {
    const res = await fetch(`/api/chats/${encodeURIComponent(currentChatPhone)}/toggle-ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ humanTakeover })
    });
    const json = await res.json();
    if (json.success) {
      showToast(humanTakeover ? '👨‍💼 AI Paused. You are now speaking directly to customer.' : '🤖 AI Auto-reply Resumed.', 'info');
    }
  } catch (err) {
    console.error('Error toggling AI:', err);
  }
}

// ── 6. Bookings Pipeline ─────────────────────────────────────
async function loadOrders(filter = 'ALL') {
  try {
    const res = await fetch(`/api/orders?status=${filter}`);
    const json = await res.json();
    if (!json.success) return;

    allOrdersData = json.data;
    renderOrdersTable(allOrdersData);
    renderRecentOrders(allOrdersData.slice(0, 5));
  } catch (err) {
    console.error('Error loading orders:', err);
  }
}

function getClientOrderAmount(s) {
  if (!s) return { costSAR: 0, costPKR: 0 };
  let costSAR = s.totalSar || s.totalCostSAR || s.totalCost || s.customPackageTotalSAR || s.finalVisaRate || 0;
  if (!costSAR) {
    const makkah = s.makkahBooking?.cityTotal || 0;
    const madinah = s.madinahBooking?.cityTotal || 0;
    const cityBkg = s.cityBooking?.cityTotal || 0;
    costSAR = makkah + madinah || cityBkg || 0;
  }
  let costPKR = 0;
  if (typeof s.totalPkr === 'number') costPKR = s.totalPkr;
  else if (typeof s.totalPkr === 'string') costPKR = parseFloat(s.totalPkr.replace(/,/g, '')) || 0;
  else if (typeof s.totalCostPKR === 'number') costPKR = s.totalCostPKR;
  if (!costPKR && costSAR) {
    costPKR = Math.round(costSAR * (s.effectiveRate || 74.5));
  }
  return { costSAR: Math.round(costSAR), costPKR: Math.round(costPKR) };
}

function renderOrdersTable(orders) {
  const tbody = document.getElementById('allOrdersTbody');
  if (!tbody) return;

  if (orders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="text-center py-4 text-muted">No orders found in pipeline.</td></tr>';
    return;
  }

  tbody.innerHTML = orders.map(o => {
    const s = o.sessionData || {};
    const guest = s.familyHeadName || (s.passportData ? `${s.passportData.firstName} ${s.passportData.lastName}` : 'Guest');
    const cleanPhone = o.customerPhone ? o.customerPhone.replace('@c.us', '') : 'N/A';
    const { costSAR, costPKR } = getClientOrderAmount(s);
    const status = o.status || 'PENDING';
    const statusClass = getStatusClass(status);

    return `
      <tr>
        <td>
          <a href="/vouchers/${o.voucherId}.pdf" target="_blank" style="color:var(--accent-cyan); font-weight:700; text-decoration:none; display:inline-flex; align-items:center; gap:6px;" title="Click to open official PDF Voucher">
            <i class="fa-solid fa-file-pdf" style="color:var(--accent-rose);"></i> ${o.voucherId}
          </a>
        </td>
        <td>${guest}</td>
        <td>+${cleanPhone}</td>
        <td>${s.flow || 'Umrah Package'}</td>
        <td>${s.passengerCount || 1} Pax</td>
        <td><strong>${costSAR.toLocaleString()} SAR</strong></td>
        <td>~ ${costPKR.toLocaleString()} PKR</td>
        <td>${s.paymentType === 'CASH_KSA' ? '💵 Cash (KSA)' : '🏦 Bank Deposit'}</td>
        <td><span class="badge-status ${statusClass}">${status}</span></td>
        <td>
          <div style="display:flex; gap:6px;">
            <button class="btn-table btn-approve" onclick="approveOrder('${o.voucherId}')" title="Approve & Send Voucher"><i class="fa-solid fa-check"></i></button>
            <button class="btn-table btn-cash" onclick="confirmCashPayment('${o.voucherId}')" title="Settle Cash in KSA"><i class="fa-solid fa-money-bill-wave"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderRecentOrders(orders) {
  const tbody = document.getElementById('recentOrdersTbody');
  if (!tbody) return;

  if (orders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted">No recent orders.</td></tr>';
    return;
  }

  tbody.innerHTML = orders.map(o => {
    const s = o.sessionData || {};
    const guest = s.familyHeadName || (s.passportData ? `${s.passportData.firstName} ${s.passportData.lastName}` : 'Guest');
    const cleanPhone = o.customerPhone ? o.customerPhone.replace('@c.us', '') : 'N/A';
    const { costSAR } = getClientOrderAmount(s);
    const status = o.status || 'PENDING';
    const statusClass = getStatusClass(status);

    return `
      <tr>
        <td>
          <a href="/vouchers/${o.voucherId}.pdf" target="_blank" style="color:var(--accent-cyan); font-weight:700; text-decoration:none; display:inline-flex; align-items:center; gap:6px;" title="Click to open official PDF Voucher">
            <i class="fa-solid fa-file-pdf" style="color:var(--accent-rose);"></i> ${o.voucherId}
          </a>
        </td>
        <td>${guest}</td>
        <td>+${cleanPhone}</td>
        <td>${s.flow || 'Umrah Service'}</td>
        <td>${costSAR.toLocaleString()} SAR</td>
        <td>${s.paymentType === 'CASH_KSA' ? '💵 Cash (KSA)' : '🏦 Bank Transfer'}</td>
        <td><span class="badge-status ${statusClass}">${status}</span></td>
        <td>
          <button class="btn-table btn-approve" onclick="approveOrder('${o.voucherId}')">Approve</button>
        </td>
      </tr>
    `;
  }).join('');
}

async function approveOrder(voucherId) {
  if (!voucherId) return;
  try {
    const res = await fetch(`/api/orders/${voucherId}/approve`, { method: 'POST' });
    const json = await res.json();
    if (json.success) {
      showToast(`Voucher ${voucherId} Approved!`, 'success');
      loadOrders();
      loadDashboardStats();
    } else {
      showToast(json.error || 'Approval failed', 'error');
    }
  } catch (err) {
    showToast('Approval error: ' + err.message, 'error');
  }
}

async function confirmCashPayment(voucherId) {
  if (!voucherId) return;
  try {
    const res = await fetch(`/api/orders/${voucherId}/confirm-cash`, { method: 'POST' });
    const json = await res.json();
    if (json.success) {
      showToast(`Cash on ground confirmed for ${voucherId}!`, 'success');
      loadOrders();
      loadDashboardStats();
    } else {
      showToast(json.error || 'Cash confirmation failed', 'error');
    }
  } catch (err) {
    showToast('Cash confirmation error: ' + err.message, 'error');
  }
}

function getStatusClass(status) {
  const upper = (status || '').toUpperCase();
  if (upper.includes('APPROVED') || upper.includes('CONFIRMED')) return 'status-approved';
  if (upper.includes('CASH')) return 'status-cash';
  if (upper.includes('CANCEL')) return 'status-cancelled';
  if (upper.includes('STAGE')) return 'status-staged';
  return 'status-pending';
}

// ── 7. Hotel Inventory & Bed Occupancy ───────────────────────
async function loadHotelOccupancy() {
  try {
    const res = await fetch('/api/reports/hotel-occupancy');
    const json = await res.json();
    if (!json.success) return;

    allHotelsData = json.data || [];
    populateHotelDropdown(allHotelsData);
    renderHotelCards(currentHotelFilter);
  } catch (err) {
    console.error('Error loading occupancy:', err);
  }
}

function populateHotelDropdown(hotels) {
  const select = document.getElementById('hotelFilterSelect');
  if (!select) return;

  const makkahHotels = hotels.filter(h => h.city.toUpperCase() === 'MAKKAH');
  const madinahHotels = hotels.filter(h => h.city.toUpperCase() === 'MADINAH');

  select.innerHTML = `
    <option value="ALL">🏨 All Active Bot Hotels (${hotels.length} Total)</option>
    <optgroup label="🕋 Makkah Hotels (${makkahHotels.length})">
      ${makkahHotels.map(h => `<option value="${escapeHtml(h.hotelName)}">${escapeHtml(h.hotelName)} (${h.distance || 'Shuttle'}) ${h.bookings && h.bookings.length > 0 ? '🟢 ' + h.bookings.length + ' Booked' : ''}</option>`).join('')}
    </optgroup>
    <optgroup label="🕌 Madinah Hotels (${madinahHotels.length})">
      ${madinahHotels.map(h => `<option value="${escapeHtml(h.hotelName)}">${escapeHtml(h.hotelName)} (${h.distance || 'Central Area'}) ${h.bookings && h.bookings.length > 0 ? '🟢 ' + h.bookings.length + ' Booked' : ''}</option>`).join('')}
    </optgroup>
  `;
}

function onHotelSelectChange(val) {
  if (val === 'ALL') {
    currentHotelFilter = 'ALL';
    document.querySelectorAll('.hotel-city-pills .filter-pill').forEach(p => p.classList.remove('active'));
    document.querySelector('.hotel-city-pills .filter-pill[data-hotel-city="ALL"]')?.classList.add('active');
    renderHotelCards('ALL');
  } else {
    openHotelModal(val);
  }
}

function renderHotelCards(filter = 'ALL') {
  const grid = document.getElementById('occupancyCardsGrid');
  if (!grid) return;

  let filtered = allHotelsData;
  if (filter === 'MAKKAH') {
    filtered = allHotelsData.filter(h => h.city.toUpperCase() === 'MAKKAH');
  } else if (filter === 'MADINAH') {
    filtered = allHotelsData.filter(h => h.city.toUpperCase() === 'MADINAH');
  } else if (filter === 'BOOKED') {
    filtered = allHotelsData.filter(h => h.bookings && h.bookings.length > 0);
  }

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="text-center py-5 text-muted" style="grid-column:1/-1;">No hotels found for selected filter.</div>';
    return;
  }

  grid.innerHTML = filtered.map(h => {
    const isMakkah = h.city.toUpperCase() === 'MAKKAH';
    const cityTagClass = isMakkah ? 'tag-makkah' : 'tag-madinah';
    let progressColorClass = 'bg-progress-green';
    if (h.occupancyPercent >= 90) progressColorClass = 'bg-progress-red';
    else if (h.occupancyPercent >= 70) progressColorClass = 'bg-progress-yellow';

    const bookingsCount = h.bookings ? h.bookings.length : 0;
    const hasBookings = bookingsCount > 0;

    return `
      <div class="occupancy-card clickable-hotel-card" onclick="openHotelModal('${escapeHtml(h.hotelName)}')" title="Click to view vouchers and check-in/out roster for ${escapeHtml(h.hotelName)}">
        <div class="occupancy-card-header">
          <div>
            <div class="hotel-card-top-meta">
              <span class="city-tag ${cityTagClass}">${h.city}</span>
              <span class="distance-pill">${h.distance || 'Central Area'}</span>
            </div>
            <h4 style="margin-top:4px;">${h.hotelName}</h4>
          </div>
          <span class="badge-status ${h.occupancyPercent >= 90 ? 'status-cancelled' : 'status-approved'}">${h.statusBadge}</span>
        </div>

        <div class="progress-bar-wrap">
          <div class="progress-bar-fill ${progressColorClass}" style="width: ${h.occupancyPercent}%"></div>
        </div>

        <div class="occupancy-stats-row">
          <span><strong>${h.occupiedBeds}</strong> / ${h.totalBeds} Beds Occupied (${h.occupancyPercent}%)</span>
          <span class="hotel-bookings-pill ${hasBookings ? 'pill-active-guests' : 'pill-no-guests'}">
            ${hasBookings ? `<i class="fa-solid fa-user-check"></i> ${bookingsCount} Bookings` : '0 Active Guests'}
          </span>
        </div>

        <div class="hotel-card-footer">
          <span style="font-size:11.5px; color:var(--text-muted);"><strong>${h.availableRooms}</strong> Rooms Left</span>
          <span class="hotel-action-cue"><i class="fa-solid fa-file-invoice"></i> View ${hasBookings ? bookingsCount + ' Vouchers & Dates' : 'Details'} <i class="fa-solid fa-chevron-right" style="font-size:9px;"></i></span>
        </div>
      </div>
    `;
  }).join('');
}

function openHotelModal(hotelName) {
  const modal = document.getElementById('hotelDetailModal');
  const title = document.getElementById('hotelModalTitle');
  const subtitle = document.getElementById('hotelModalSubtitle');
  const icon = document.getElementById('hotelModalIcon');
  const body = document.getElementById('hotelModalBody');

  if (!modal || !body) return;

  const hotel = allHotelsData.find(h => h.hotelName.toUpperCase() === hotelName.toUpperCase()) ||
                allHotelsData.find(h => h.hotelName.toLowerCase().includes(hotelName.toLowerCase())) ||
                { hotelName, city: 'HOTEL', distance: '', location: '', totalRooms: 30, totalBeds: 120, occupiedRooms: 0, occupiedBeds: 0, availableRooms: 30, bookings: [] };

  const isMakkah = (hotel.city || '').toUpperCase() === 'MAKKAH';
  icon.className = `modal-icon ${isMakkah ? 'icon-emerald' : 'icon-amber'}`;
  icon.innerHTML = isMakkah ? '<i class="fa-solid fa-kaaba"></i>' : '<i class="fa-solid fa-mosque"></i>';

  title.textContent = `${hotel.hotelName} (${hotel.city})`;
  subtitle.textContent = `📍 Location: ${hotel.location || 'Central Area'} • Distance: ${hotel.distance || 'Shuttle / Walk'} • Total Capacity: ${hotel.totalRooms} Rooms (${hotel.totalBeds} Beds)`;

  const bookings = hotel.bookings || [];

  const rows = bookings.map(b => `
    <tr>
      <td>
        <a href="/vouchers/${b.voucherId}.pdf" target="_blank" class="btn-table btn-view" style="font-weight:700; text-decoration:none;" title="Click to view & open official PDF Voucher">
          <i class="fa-solid fa-file-pdf" style="color:var(--accent-rose);"></i> ${b.voucherId}
        </a>
      </td>
      <td><strong>${b.guestName}</strong></td>
      <td>
        <a href="https://wa.me/${b.phone.replace(/[^0-9]/g, '')}" target="_blank" style="color:var(--accent-emerald); text-decoration:none; display:inline-flex; align-items:center; gap:4px; font-family:monospace;">
          <i class="fa-brands fa-whatsapp"></i> +${b.phone}
        </a>
      </td>
      <td><span style="font-weight:600; color:var(--accent-cyan);">${b.checkIn}</span></td>
      <td><span style="font-weight:600; color:var(--accent-amber);">${b.checkOut}</span></td>
      <td><strong>${b.nights}</strong> Nights</td>
      <td>${b.roomType}</td>
      <td>${b.pax} Pax</td>
      <td><span class="badge-status badge-success">${b.status}</span></td>
    </tr>
  `).join('');

  body.innerHTML = `
    <div class="modal-stats-grid">
      <div class="modal-stat-box">
        <div class="modal-stat-label">Total Rooms / Available</div>
        <div class="modal-stat-value" style="color:var(--accent-emerald);">${hotel.availableRooms} <span style="font-size:13px; color:var(--text-muted);">/ ${hotel.totalRooms} Rooms</span></div>
      </div>
      <div class="modal-stat-box">
        <div class="modal-stat-label">Beds Occupied</div>
        <div class="modal-stat-value" style="color:var(--accent-cyan);">${hotel.occupiedBeds} <span style="font-size:13px; color:var(--text-muted);">/ ${hotel.totalBeds} Beds (${hotel.occupancyPercent || 0}%)</span></div>
      </div>
      <div class="modal-stat-box">
        <div class="modal-stat-label">Active Booked Groups</div>
        <div class="modal-stat-value" style="color:${bookings.length > 0 ? 'var(--accent-emerald)' : 'var(--text-muted)'};">${bookings.length} Vouchers</div>
      </div>
      <div class="modal-stat-box">
        <div class="modal-stat-label">Location & Access</div>
        <div class="modal-stat-value" style="font-size:14px; font-weight:700; color:var(--text-primary); margin-top:4px;">${hotel.distance || 'Shuttle'}</div>
      </div>
    </div>

    ${bookings.length === 0 ? `
      <div class="modal-empty-state">
        <div class="modal-empty-icon" style="color:var(--accent-emerald);"><i class="fa-solid fa-bed"></i></div>
        <div class="modal-empty-title">All Rooms Currently Available</div>
        <div class="modal-empty-desc">
          There are currently 0 active guest check-ins registered for <strong>${hotel.hotelName}</strong>. All ${hotel.totalRooms} rooms (${hotel.totalBeds} beds) are open for bookings.
        </div>
      </div>
    ` : `
      <div class="modal-table-wrap">
        <table class="modal-table">
          <thead>
            <tr>
              <th>Voucher ID</th>
              <th>Guest / Head</th>
              <th>WhatsApp Contact</th>
              <th>Check-in Date</th>
              <th>Check-out Date</th>
              <th>Duration</th>
              <th>Room Category</th>
              <th>Pax</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `}
  `;

  modal.style.display = 'flex';
  modal.classList.add('active');
}

function closeHotelModal() {
  closeActiveModal();
}

// ── 8. Daily Movements ───────────────────────────────────────
async function loadDailyMovements() {
  try {
    const dateInput = document.getElementById('movementDateInput');
    let dateVal = dateInput ? dateInput.value : '';
    if (!dateVal) {
      dateVal = '2026-09-01';
      if (dateInput) dateInput.value = dateVal;
    }
    const res = await fetch(`/api/reports/daily-movements?date=${dateVal}`);
    const json = await res.json();
    if (!json.success) return;

    const d = json.data;
    const checkInsTbody = document.getElementById('checkInsTbody');
    const checkOutsTbody = document.getElementById('checkOutsTbody');

    if (checkInsTbody) {
      if (d.checkIns.length === 0) {
        checkInsTbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">No check-ins recorded for this date.</td></tr>';
      } else {
        checkInsTbody.innerHTML = d.checkIns.map(c => `
          <tr>
            <td>
              <a href="/vouchers/${c.voucherId}.pdf" target="_blank" style="color:var(--accent-cyan); font-weight:700; text-decoration:none;" title="View PDF Voucher">
                <i class="fa-solid fa-file-pdf" style="color:var(--accent-rose);"></i> ${c.voucherId}
              </a>
            </td>
            <td><strong>${c.guestName}</strong></td>
            <td>${c.hotelName} (${c.city})</td>
            <td>${c.roomType}</td>
            <td><strong>${c.nights}</strong> Nights</td>
            <td>${c.pax} Pax</td>
            <td><span class="badge-status status-approved">SCHEDULED CHECK-IN</span></td>
          </tr>
        `).join('');
      }
    }

    if (checkOutsTbody) {
      if (d.checkOuts.length === 0) {
        checkOutsTbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">No check-outs recorded for this date.</td></tr>';
      } else {
        checkOutsTbody.innerHTML = d.checkOuts.map(c => `
          <tr>
            <td>
              <a href="/vouchers/${c.voucherId}.pdf" target="_blank" style="color:var(--accent-cyan); font-weight:700; text-decoration:none;" title="View PDF Voucher">
                <i class="fa-solid fa-file-pdf" style="color:var(--accent-rose);"></i> ${c.voucherId}
              </a>
            </td>
            <td><strong>${c.guestName}</strong></td>
            <td>${c.hotelName} (${c.city})</td>
            <td>${c.nextDestination}</td>
            <td>${c.pax} Pax</td>
            <td><span class="badge-status status-pending">CHECK-OUT / DEPARTURE</span></td>
          </tr>
        `).join('');
      }
    }
  } catch (err) {
    console.error('Error loading movements:', err);
  }
}

// ── 9. Cashflow & Finance ────────────────────────────────────
async function loadCashflow() {
  try {
    const res = await fetch('/api/reports/cashflow');
    const json = await res.json();
    if (!json.success) return;

    const d = json.data;
    document.getElementById('cashflowKsaTotal').textContent = `${d.totalKsaCashSAR.toLocaleString()} SAR`;
    document.getElementById('cashflowBankTotal').textContent = `${d.totalBankPkr.toLocaleString()} PKR`;
    document.getElementById('cashflowPendingTotal').textContent = `${d.totalPendingReceivablesSAR.toLocaleString()} SAR`;
    document.getElementById('cashflowPendingPkr').textContent = `~ ${d.totalPendingReceivablesPKR.toLocaleString()} PKR`;

    const tbody = document.getElementById('cashflowTbody');
    if (tbody) {
      if (d.transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted">No financial records found.</td></tr>';
      } else {
        tbody.innerHTML = d.transactions.map(t => `
          <tr>
            <td><strong>${t.voucherId}</strong></td>
            <td>${t.customerName}</td>
            <td>+${t.phone}</td>
            <td><strong>${t.amountSAR.toLocaleString()} SAR</strong></td>
            <td>${t.amountPKR.toLocaleString()} PKR</td>
            <td>${t.paymentMethod}</td>
            <td><span class="badge-status ${getStatusClass(t.status)}">${t.status}</span></td>
            <td>${t.date}</td>
          </tr>
        `).join('');
      }
    }
  } catch (err) {
    console.error('Error loading cashflow:', err);
  }
}

// ── 10. Flight Group Seats ───────────────────────────────────
async function loadFlightSeats() {
  try {
    const res = await fetch('/api/reports/flight-manifest');
    const json = await res.json();
    if (!json.success) return;

    const d = json.data;
    const groupsGrid = document.getElementById('flightGroupsGrid');
    if (groupsGrid) {
      groupsGrid.innerHTML = d.groups.map(g => `
        <div class="flight-group-card">
          <div class="occupancy-card-header">
            <div>
              <span class="city-tag tag-makkah">${g.sector}</span>
              <h4 style="margin-top:6px;">${g.airline}</h4>
            </div>
            <small style="color:var(--text-muted);">${g.departureDate}</small>
          </div>
          <div class="progress-bar-wrap">
            <div class="progress-bar-fill bg-progress-green" style="width: ${g.occupancyPercent}%"></div>
          </div>
          <div class="occupancy-stats-row">
            <span><strong>${g.bookedSeats}</strong> / ${g.totalSeats} Seats Booked</span>
            <span style="color:var(--accent-emerald);"><strong>${g.availableSeats}</strong> Available</span>
          </div>
        </div>
      `).join('');
    }

    const tbody = document.getElementById('flightManifestTbody');
    if (tbody) {
      if (d.manifest.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted">No passengers in flight manifest.</td></tr>';
      } else {
        tbody.innerHTML = d.manifest.map(p => `
          <tr>
            <td><strong>${p.voucherId}</strong></td>
            <td>${p.name}</td>
            <td>${p.passportNumber}</td>
            <td>${p.dob}</td>
            <td>${p.expiryDate}</td>
            <td>${p.gender}</td>
            <td>${p.city}</td>
            <td>${p.flightDate}</td>
          </tr>
        `).join('');
      }
    }
  } catch (err) {
    console.error('Error loading flight manifest:', err);
  }
}

// ── 11. Tenant & System Settings ─────────────────────────────
async function loadTenantSettings() {
  try {
    const res = await fetch('/api/config');
    const json = await res.json();
    if (!json.success) return;

    const c = json.data;
    document.getElementById('settingAgencyName').value = c.agencyName || '';
    document.getElementById('settingClientId').value = c.clientId || 'default';
    document.getElementById('settingAdminPhone').value = c.adminPhone || '';
    if (c.bankDetails) {
      document.getElementById('settingBankName').value = c.bankDetails.bankName || '';
      document.getElementById('settingAccountTitle').value = c.bankDetails.accountTitle || '';
      document.getElementById('settingIban').value = c.bankDetails.iban || c.bankDetails.accountNumber || '';
    }
  } catch (err) {
    console.error('Error loading settings:', err);
  }
}

// ── 12. Helper Utilities ─────────────────────────────────────
function exportReport(type) {
  window.open(`/api/reports/export/${type}`, '_blank');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  
  const iconMap = {
    success: 'fa-circle-check',
    error: 'fa-circle-xmark',
    info: 'fa-circle-info',
    warning: 'fa-triangle-exclamation'
  };

  const icon = iconMap[type] || 'fa-circle-info';
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── 13. Interactive KPI Detail Modals ─────────────────────────
function openKpiModal(type) {
  const modal = document.getElementById('kpiDetailModal');
  const title = document.getElementById('modalTitle');
  const subtitle = document.getElementById('modalSubtitle');
  const icon = document.getElementById('modalHeaderIcon');
  const body = document.getElementById('modalBodyContent');
  const footer = document.getElementById('modalFooterContent');

  if (!modal || !body) return;

  const orders = allOrdersData || [];
  let forex = 75.51;
  const forexEl = document.getElementById('headerForexRate');
  if (forexEl) {
    const parsed = parseFloat(forexEl.textContent);
    if (!isNaN(parsed) && parsed > 0) forex = parsed;
  }

  // 1. Gross Pipeline Volume
  if (type === 'revenue') {
    icon.className = 'modal-icon icon-emerald';
    icon.innerHTML = '<i class="fa-solid fa-sack-dollar"></i>';
    title.textContent = 'Gross Pipeline Volume Breakdown';
    subtitle.textContent = 'Complete sales volume, currency conversions, and booking statuses';

    let totalSAR = 0;
    let totalPKR = 0;
    let confirmedCount = 0;
    let pendingCount = 0;

    const rows = orders.map(o => {
      const s = o.sessionData || {};
      const guest = s.familyHeadName || (s.passportData ? `${s.passportData.firstName} ${s.passportData.lastName}` : 'Guest');
      const phone = o.customerPhone ? o.customerPhone.replace('@c.us', '').replace('@lid', '') : 'N/A';
      const { costSAR, costPKR } = getClientOrderAmount(s);
      const status = (o.status || 'PENDING').toUpperCase();
      const isSettled = status.includes('APPROVED') || status.includes('CONFIRMED');

      totalSAR += costSAR;
      totalPKR += costPKR;
      if (isSettled) confirmedCount++;
      else pendingCount++;

      return `
        <tr>
          <td><strong>${o.voucherId}</strong></td>
          <td>${guest}</td>
          <td><span style="font-family:monospace;">+${phone}</span></td>
          <td>${s.flow || 'Umrah Package'}</td>
          <td>${s.passengerCount || 1} Pax</td>
          <td><strong>${costSAR.toLocaleString()} SAR</strong></td>
          <td>~ ${costPKR.toLocaleString()} PKR</td>
          <td>${s.paymentType === 'CASH_KSA' ? '💵 Cash (KSA)' : '🏦 Bank Deposit'}</td>
          <td><span class="badge-status ${getStatusClass(status)}">${status}</span></td>
          <td>
            <a href="/vouchers/${o.voucherId}.pdf" target="_blank" class="btn-table btn-view" title="View PDF Voucher">
              <i class="fa-solid fa-file-pdf"></i>
            </a>
          </td>
        </tr>
      `;
    }).join('');

    body.innerHTML = `
      <div class="modal-stats-grid">
        <div class="modal-stat-box">
          <div class="modal-stat-label">Total Volume (SAR)</div>
          <div class="modal-stat-value" style="color:var(--accent-emerald);">${totalSAR.toLocaleString()} SAR</div>
        </div>
        <div class="modal-stat-box">
          <div class="modal-stat-label">Total Volume (PKR)</div>
          <div class="modal-stat-value" style="color:var(--accent-cyan);">~ ${totalPKR.toLocaleString()} PKR</div>
        </div>
        <div class="modal-stat-box">
          <div class="modal-stat-label">Confirmed & Paid</div>
          <div class="modal-stat-value">${confirmedCount} Bookings</div>
        </div>
        <div class="modal-stat-box">
          <div class="modal-stat-label">Pending Clearance</div>
          <div class="modal-stat-value" style="color:${pendingCount > 0 ? 'var(--accent-rose)' : 'var(--text-muted)'};">${pendingCount} Bookings</div>
        </div>
      </div>

      <div class="modal-table-wrap">
        <table class="modal-table">
          <thead>
            <tr>
              <th>Voucher ID</th>
              <th>Customer / Head</th>
              <th>WhatsApp Contact</th>
              <th>Service / Package</th>
              <th>Pax</th>
              <th>Amount (SAR)</th>
              <th>Amount (PKR)</th>
              <th>Payment Mode</th>
              <th>Status</th>
              <th>Voucher</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="10" class="text-center py-4 text-muted">No orders found in pipeline.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;

    footer.innerHTML = `
      <button class="action-btn" onclick="switchTab('orders'); closeKpiModal();"><i class="fa-solid fa-file-invoice-dollar"></i> Open Full Pipeline Tab</button>
      <button class="action-btn" onclick="closeKpiModal()">Close</button>
    `;
  }

  // 2. Cash on Ground (Saudi Arabia)
  else if (type === 'cash_ksa') {
    icon.className = 'modal-icon icon-amber';
    icon.innerHTML = '<i class="fa-solid fa-money-bill-wave"></i>';
    title.textContent = 'Saudi Arabia Hard Cash on Ground (SAR)';
    subtitle.textContent = 'Direct physical SAR cash collections settled in Makkah & Madinah';

    const cashOrders = orders.filter(o => {
      const s = o.sessionData || {};
      const status = (o.status || '').toUpperCase();
      return s.paymentType === 'CASH_KSA' || status.includes('CASH') || s.cashReceivedKSA;
    });

    let totalCashSAR = 0;
    const rows = cashOrders.map(o => {
      const s = o.sessionData || {};
      const guest = s.familyHeadName || (s.passportData ? `${s.passportData.firstName} ${s.passportData.lastName}` : 'Guest');
      const phone = o.customerPhone ? o.customerPhone.replace('@c.us', '').replace('@lid', '') : 'N/A';
      const { costSAR } = getClientOrderAmount(s);
      totalCashSAR += costSAR;
      const location = s.makkahBooking?.hotelName || s.madinahBooking?.hotelName || 'KSA Desk / Representative';
      const date = new Date(o.createdAt || Date.now()).toLocaleDateString('en-GB');

      return `
        <tr>
          <td><strong>${o.voucherId}</strong></td>
          <td>${guest}</td>
          <td><span style="font-family:monospace;">+${phone}</span></td>
          <td><strong>${costSAR.toLocaleString()} SAR</strong></td>
          <td>${location}</td>
          <td>${date}</td>
          <td><span class="badge-status badge-success">💵 SETTLED (CASH KSA)</span></td>
          <td>
            <a href="/vouchers/${o.voucherId}.pdf" target="_blank" class="btn-table btn-view" title="View PDF Voucher">
              <i class="fa-solid fa-file-pdf"></i>
            </a>
          </td>
        </tr>
      `;
    }).join('');

    if (cashOrders.length === 0) {
      body.innerHTML = `
        <div class="modal-empty-state">
          <div class="modal-empty-icon" style="color:var(--accent-amber);"><i class="fa-solid fa-hand-holding-dollar"></i></div>
          <div class="modal-empty-title">0 SAR Cash on Ground Settled</div>
          <div class="modal-empty-desc">
            No bookings have been settled in physical SAR cash yet. When a pilgrim pays cash on arrival in Saudi Arabia, click the <strong>"Confirm Cash in KSA"</strong> button in the Bookings Pipeline to record settled cash here.
          </div>
          <button class="action-btn" onclick="switchTab('orders'); closeKpiModal();"><i class="fa-solid fa-arrow-right"></i> Go to Bookings Pipeline</button>
        </div>
      `;
    } else {
      body.innerHTML = `
        <div class="modal-stats-grid">
          <div class="modal-stat-box">
            <div class="modal-stat-label">Total Cash in KSA (SAR)</div>
            <div class="modal-stat-value" style="color:var(--accent-amber);">${totalCashSAR.toLocaleString()} SAR</div>
          </div>
          <div class="modal-stat-box">
            <div class="modal-stat-label">PKR Equivalent</div>
            <div class="modal-stat-value">~ ${Math.round(totalCashSAR * forex).toLocaleString()} PKR</div>
          </div>
          <div class="modal-stat-box">
            <div class="modal-stat-label">Cash Transactions</div>
            <div class="modal-stat-value">${cashOrders.length} Settled</div>
          </div>
        </div>

        <div class="modal-table-wrap">
          <table class="modal-table">
            <thead>
              <tr>
                <th>Voucher ID</th>
                <th>Pilgrim Name</th>
                <th>WhatsApp Contact</th>
                <th>Amount (SAR)</th>
                <th>Collection Location</th>
                <th>Settlement Date</th>
                <th>Status</th>
                <th>Voucher</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      `;
    }

    footer.innerHTML = `
      <button class="action-btn" onclick="switchTab('cashflow'); closeKpiModal();"><i class="fa-solid fa-money-bill-transfer"></i> View Cashflow Reconciliation</button>
      <button class="action-btn" onclick="closeKpiModal()">Close</button>
    `;
  }

  // 3. Pending Receivables
  else if (type === 'pending') {
    icon.className = 'modal-icon icon-rose';
    icon.innerHTML = '<i class="fa-solid fa-hourglass-half"></i>';
    title.textContent = 'Pending Receivables (From Whom Payment is Pending)';
    subtitle.textContent = 'Customers awaiting bank deposit verification or Saudi ground cash settlement';

    const pendingOrders = orders.filter(o => {
      const status = (o.status || 'PENDING').toUpperCase();
      return !status.includes('APPROVED') && !status.includes('CONFIRMED') && !status.includes('CANCELLED');
    });

    let pendingSAR = 0;
    let pendingPKR = 0;

    const rows = pendingOrders.map(o => {
      const s = o.sessionData || {};
      const guest = s.familyHeadName || (s.passportData ? `${s.passportData.firstName} ${s.passportData.lastName}` : 'Customer');
      const cleanPhone = o.customerPhone ? o.customerPhone.replace('@c.us', '').replace('@lid', '') : 'N/A';
      const { costSAR, costPKR } = getClientOrderAmount(s);
      pendingSAR += costSAR;
      pendingPKR += costPKR;
      const status = o.status || 'PAYMENT PENDING';

      return `
        <tr>
          <td><strong>${o.voucherId}</strong></td>
          <td><strong>${guest}</strong></td>
          <td>
            <a href="https://wa.me/${cleanPhone.replace(/[^0-9]/g, '')}" target="_blank" style="color:var(--accent-emerald); text-decoration:none; display:inline-flex; align-items:center; gap:4px;">
              <i class="fa-brands fa-whatsapp"></i> +${cleanPhone}
            </a>
          </td>
          <td>${s.flow || 'Umrah Package'}</td>
          <td><strong style="color:var(--accent-rose);">${costSAR.toLocaleString()} SAR</strong></td>
          <td>~ ${costPKR.toLocaleString()} PKR</td>
          <td>${s.paymentType === 'CASH_KSA' ? '💵 Cash in KSA' : '🏦 Bank Transfer (Pakistan)'}</td>
          <td><span class="badge-status badge-warning">${status}</span></td>
          <td>
            <div style="display:flex; gap:6px;">
              <button class="btn-table btn-approve" onclick="approveOrder('${o.voucherId}'); closeKpiModal();" title="Approve & Send Voucher"><i class="fa-solid fa-check"></i> Approve</button>
              <button class="btn-table btn-cash" onclick="confirmCashPayment('${o.voucherId}'); closeKpiModal();" title="Settle Cash in KSA"><i class="fa-solid fa-money-bill-wave"></i> Cash</button>
              <a href="/vouchers/${o.voucherId}.pdf" target="_blank" class="btn-table btn-view" title="View PDF"><i class="fa-solid fa-file-pdf"></i></a>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (pendingOrders.length === 0) {
      body.innerHTML = `
        <div class="modal-empty-state">
          <div class="modal-empty-icon" style="color:var(--accent-emerald);"><i class="fa-solid fa-circle-check"></i></div>
          <div class="modal-empty-title">0 SAR Outstanding — All Payments Cleared!</div>
          <div class="modal-empty-desc">
            All generated vouchers and customer bookings in your pipeline are currently 100% verified and confirmed. There are zero pending receivables.
          </div>
          <button class="action-btn" onclick="switchTab('orders'); closeKpiModal();"><i class="fa-solid fa-file-invoice-dollar"></i> View Confirmed Pipeline</button>
        </div>
      `;
    } else {
      body.innerHTML = `
        <div class="modal-stats-grid">
          <div class="modal-stat-box">
            <div class="modal-stat-label">Pending Receivables (SAR)</div>
            <div class="modal-stat-value" style="color:var(--accent-rose);">${pendingSAR.toLocaleString()} SAR</div>
          </div>
          <div class="modal-stat-box">
            <div class="modal-stat-label">Pending Receivables (PKR)</div>
            <div class="modal-stat-value" style="color:var(--accent-amber);">~ ${pendingPKR.toLocaleString()} PKR</div>
          </div>
          <div class="modal-stat-box">
            <div class="modal-stat-label">Awaiting Customers</div>
            <div class="modal-stat-value">${pendingOrders.length} Unpaid</div>
          </div>
        </div>

        <div class="modal-table-wrap">
          <table class="modal-table">
            <thead>
              <tr>
                <th>Voucher ID</th>
                <th>Pending Customer / Head</th>
                <th>WhatsApp Direct Link</th>
                <th>Package / Service</th>
                <th>Pending (SAR)</th>
                <th>Pending (PKR)</th>
                <th>Expected Mode</th>
                <th>Status</th>
                <th>Quick Settle Actions</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      `;
    }

    footer.innerHTML = `
      <button class="action-btn" onclick="switchTab('orders'); closeKpiModal();"><i class="fa-solid fa-list-check"></i> Open Bookings Pipeline</button>
      <button class="action-btn" onclick="closeKpiModal()">Close</button>
    `;
  }

  // 4. Total Pilgrims Catered
  else if (type === 'pilgrims') {
    icon.className = 'modal-icon icon-cyan';
    icon.innerHTML = '<i class="fa-solid fa-users"></i>';
    title.textContent = 'Pilgrim Roster & Passenger Manifest';
    subtitle.textContent = 'Individual passenger details extracted from passports and verified vouchers';

    const pilgrimsList = [];

    orders.forEach(o => {
      const s = o.sessionData || {};
      const cleanPhone = o.customerPhone ? o.customerPhone.replace('@c.us', '').replace('@lid', '') : 'N/A';
      const flow = s.flow || 'Umrah';

      if (s.passengers && Array.isArray(s.passengers) && s.passengers.length > 0) {
        s.passengers.forEach(p => {
          pilgrimsList.push({
            voucherId: o.voucherId,
            fullName: `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Passenger',
            fullNameAr: p.firstNameAr ? `${p.firstNameAr} ${p.lastNameAr || ''}` : '',
            passportNumber: p.passportNumber || 'N/A',
            dob: p.dob || 'N/A',
            expiryDate: p.expiryDate || 'N/A',
            nationality: p.nationality || 'PAKISTANI',
            phone: cleanPhone,
            service: flow,
            status: o.status || 'CONFIRMED'
          });
        });
      } else if (s.passportData) {
        const pd = s.passportData;
        pilgrimsList.push({
          voucherId: o.voucherId,
          fullName: `${pd.firstName || ''} ${pd.lastName || ''}`.trim() || s.familyHeadName || 'Pilgrim',
          fullNameAr: pd.firstNameAr ? `${pd.firstNameAr} ${pd.lastNameAr || ''}` : '',
          passportNumber: pd.passportNumber || 'N/A',
          dob: pd.dob || 'N/A',
          expiryDate: pd.expiryDate || 'N/A',
          nationality: pd.nationality || 'PAKISTANI',
          phone: cleanPhone,
          service: flow,
          status: o.status || 'CONFIRMED'
        });
      } else {
        pilgrimsList.push({
          voucherId: o.voucherId,
          fullName: s.familyHeadName || 'Pilgrim (Primary)',
          fullNameAr: '',
          passportNumber: 'In Booking File',
          dob: 'N/A',
          expiryDate: 'N/A',
          nationality: 'PAKISTANI',
          phone: cleanPhone,
          service: flow,
          status: o.status || 'CONFIRMED'
        });
      }
    });

    const rows = pilgrimsList.map(p => `
      <tr>
        <td><strong>${p.voucherId}</strong></td>
        <td>
          <strong>${p.fullName}</strong>
          ${p.fullNameAr ? `<br><small style="color:var(--accent-cyan); direction:rtl; font-family:'Segoe UI', Tahoma;">${p.fullNameAr}</small>` : ''}
        </td>
        <td><span style="font-family:monospace; font-weight:700; color:var(--accent-cyan);">${p.passportNumber}</span></td>
        <td>${p.dob}</td>
        <td>${p.nationality}</td>
        <td>${p.expiryDate}</td>
        <td><span style="font-family:monospace;">+${p.phone}</span></td>
        <td>${p.service}</td>
        <td>
          <a href="/vouchers/${p.voucherId}.pdf" target="_blank" class="btn-table btn-view" title="View PDF Voucher">
            <i class="fa-solid fa-file-pdf"></i>
          </a>
        </td>
      </tr>
    `).join('');

    body.innerHTML = `
      <div class="modal-stats-grid">
        <div class="modal-stat-box">
          <div class="modal-stat-label">Total Pilgrims Catered</div>
          <div class="modal-stat-value" style="color:var(--accent-cyan);">${pilgrimsList.length} Pilgrims</div>
        </div>
        <div class="modal-stat-box">
          <div class="modal-stat-label">Family Groups / Bookings</div>
          <div class="modal-stat-value">${orders.length} Groups</div>
        </div>
        <div class="modal-stat-box">
          <div class="modal-stat-label">Verified Passports</div>
          <div class="modal-stat-value" style="color:var(--accent-emerald);">${pilgrimsList.filter(p => p.passportNumber !== 'N/A' && p.passportNumber !== 'In Booking File').length} Verified</div>
        </div>
      </div>

      <div class="modal-table-wrap">
        <table class="modal-table">
          <thead>
            <tr>
              <th>Voucher ID</th>
              <th>Pilgrim Full Name</th>
              <th>Passport Number</th>
              <th>Date of Birth</th>
              <th>Nationality</th>
              <th>Passport Expiry</th>
              <th>WhatsApp Contact</th>
              <th>Service</th>
              <th>Voucher</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="9" class="text-center py-4 text-muted">No pilgrims registered yet.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;

    footer.innerHTML = `
      <button class="action-btn" onclick="exportReport('flight-manifest');"><i class="fa-solid fa-file-excel"></i> Export Pilgrim Manifest (CSV)</button>
      <button class="action-btn" onclick="closeKpiModal()">Close</button>
    `;
  }

  modal.style.display = 'flex';
}

function closeKpiModal() {
  const modal = document.getElementById('kpiDetailModal');
  if (modal) modal.style.display = 'none';
}

// Close modals on escape key or backdrop click
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeKpiModal();
    closeHotelModal();
  }
});

document.addEventListener('click', (e) => {
  const kpiModal = document.getElementById('kpiDetailModal');
  const hotelModal = document.getElementById('hotelDetailModal');
  if (kpiModal && e.target === kpiModal) closeKpiModal();
  if (hotelModal && e.target === hotelModal) closeHotelModal();
});

