// ============================================================
//  config.js — All business data & configurable constants
// ============================================================

require('dotenv').config();

// ─── Contact Numbers ─────────────────────────────────────────
const CONTACTS = {
  helpline: process.env.HELPLINE_WHATSAPP || '+923180978480',
  ticketing: process.env.TICKETING_WHATSAPP || '+923180978480',
};

// ─── Payment Details ─────────────────────────────────────────
const PAYMENT = {
  bankName:      process.env.BANK_NAME       || 'Meezan Bank Ltd',
  accountTitle:  process.env.ACCOUNT_TITLE   || 'Eyries Holidays',
  accountNumber: process.env.ACCOUNT_NUMBER  || '0123456789012345',
  iban:          process.env.IBAN            || 'PK36MEZN0001230123456789',
  branch:        process.env.BANK_BRANCH     || 'Head Office, Islamabad',
};

// ─── Pakistani Airlines (attract +90 SAR surcharge) ──────────
const PAKISTANI_AIRLINES = [
  'pia', 'pakistan international', 'airblue', 'air blue',
  'serene air', 'serene', 'air sial', 'airsial', 'fly jinnah',
];

// ─── Visa Rates ───────────────────────────────────────────────
const VISA_RATES = {
  longStay: {
    label: 'Long Stay Visa (up to 80 days)',
    rate: 650,
    requirements: [
      'Confirmed airline ticket',
      'Iqama + Saudi address',
      'Clear passport copy',
    ],
  },
  withTransport: {
    label: 'Visa WITH Transport Package (max 30 days)',
    requirement: 'Hotel booking required',
    passengers: [
      { range: '5–47 passengers', rate: 600 },
      { range: '4 passengers',    rate: 650 },
      { range: '3 passengers',    rate: 675 },
      { range: '2 passengers',    rate: 700 },
      { range: '1 passenger',     rate: 790 },
    ],
  },
  withoutTransport: {
    label: 'Visa WITHOUT Transport (max 30 days)',
    baseRate: 550,
    pakistaniAirlineSurcharge: 90,  // +90 SAR for Pakistani airlines
    firstLegTransport: {
      jeddahToMakkah:     { label: 'Jeddah Airport → Makkah Hotel',   rate: 900 },
      jeddahToJeddahCity: { label: 'Jeddah Airport → Jeddah City',    rate: 820 },
    },
  },
};

// ─── Transport Rates (SAR) ────────────────────────────────────
const TRANSPORT_ROUTES = [
  {
    id: 1,
    route: 'JED-MAK-MED-MAK-JED (Full Package)',
    rates: { sedan: 1330, gmcYukon: 2320, hyundaiStaria: 1500, toyotaHiace: 1700, toyotaCoaster: 2700, bus47: 3700 },
  },
  {
    id: 2,
    route: 'Jeddah → Makkah',
    rates: { sedan: 250, gmcYukon: 390, hyundaiStaria: 280, toyotaHiace: 330, toyotaCoaster: 550, bus47: 800 },
  },
  {
    id: 3,
    route: 'Makkah ↔ Madinah',
    rates: { sedan: 450, gmcYukon: 800, hyundaiStaria: 500, toyotaHiace: 550, toyotaCoaster: 850, bus47: 1100 },
  },
  {
    id: 4,
    route: 'Jeddah Airport ↔ Madinah',
    rates: { sedan: 480, gmcYukon: 830, hyundaiStaria: 520, toyotaHiace: 580, toyotaCoaster: 900, bus47: 1200 },
  },
  {
    id: 5,
    route: 'Makkah → Jeddah',
    rates: { sedan: 180, gmcYukon: 330, hyundaiStaria: 220, toyotaHiace: 270, toyotaCoaster: 450, bus47: 700 },
  },
  {
    id: 6,
    route: 'Mazarat Makkah / Mazarat Madinah',
    rates: { sedan: 200, gmcYukon: 370, hyundaiStaria: 250, toyotaHiace: 300, toyotaCoaster: 350, bus47: 400 },
  },
  {
    id: 7,
    route: 'Madinah Airport ↔ Madinah Hotel',
    rates: { sedan: 150, gmcYukon: 260, hyundaiStaria: 200, toyotaHiace: 260, toyotaCoaster: 300, bus47: 450 },
  },
  {
    id: 8,
    route: 'Jeddah Airport ↔ Jeddah City',
    rates: { sedan: 180, gmcYukon: 330, hyundaiStaria: 250, toyotaHiace: 280, toyotaCoaster: 300, bus47: 450 },
  },
  {
    id: 9,
    route: 'Makkah – Taif Ziarat',
    rates: { sedan: 550, gmcYukon: 850, hyundaiStaria: 600, toyotaHiace: 700, toyotaCoaster: 800, bus47: 1000 },
  },
];

const VEHICLES = [
  { id: 1, key: 'sedan',         label: 'Sedan' },
  { id: 2, key: 'gmcYukon',      label: 'GMC Yukon XL' },
  { id: 3, key: 'hyundaiStaria', label: 'Hyundai Staria' },
  { id: 4, key: 'toyotaHiace',   label: 'Toyota Hiace' },
  { id: 5, key: 'toyotaCoaster', label: 'Toyota Coaster' },
  { id: 6, key: 'bus47',         label: 'Bus (47 Seats)' },
];

module.exports = { CONTACTS, PAYMENT, PAKISTANI_AIRLINES, VISA_RATES, TRANSPORT_ROUTES, VEHICLES };
