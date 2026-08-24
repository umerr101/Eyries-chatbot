// ============================================================
//  src/flows/packageFlow.js — Umrah Packages (Fixed & Custom)
// ============================================================

const msg = require('../utils/messageBuilder');
const { updateSession, resetSession } = require('../stateManager');
const { loadClientConfig } = require('../configLoader');
const { TICKET_RATES_BY_CITY, FIXED_PACKAGES } = require('../data/packageCatalog');
const { getEffectiveExchangeRate } = require('../utils/exchangeRate');

const CITY_KEY_MAP = {
  '1': 'ISLAMABAD',
  '2': 'LAHORE',
  '3': 'KARACHI',
  '4': 'MULTAN',
  '5': 'PESHAWAR',
};

const VEHICLE_TYPES = {
  '1': 'Standard Car / Sedan',
  '2': 'GMC / SUV Luxury',
  '3': 'Toyota HiAce / Commuter',
  '4': 'Toyota Coaster',
  '5': 'Luxury Bus',
};

async function handlePackageFlow(phone, text, session) {
  const activeClient = loadClientConfig();
  const exchangeInfo = await getEffectiveExchangeRate();
  const makkahCatalog = activeClient.makkahHotels || [];
  const madinahCatalog = activeClient.madinahHotels || [];

  // ── STEP: Select Package Mode (1. Fixed vs 2. Make Your Own) ─
  if (session.step === 'PKG_SELECT_TYPE') {
    if (text === '1') {
      updateSession(phone, { step: 'PKG_FIXED_CITY', packageMode: 'FIXED' });
      return msg.packageFixedCityMenu();
    }
    if (text === '2') {
      updateSession(phone, { step: 'PKG_CUSTOM_DURATION', packageMode: 'CUSTOM' });
      return msg.packageCustomDurationMenu();
    }
    return msg.packageTypeMenu();
  }

  // ============================================================
  //  SUB-FLOW A: FIXED UMRAH PACKAGES
  // ============================================================

  if (session.step === 'PKG_FIXED_CITY') {
    const cityKey = CITY_KEY_MAP[text];
    if (!cityKey || !FIXED_PACKAGES[cityKey]) {
      return `⚠️ Please select a valid departure city _(reply 1, 2, 3, 4, or 5)_:\n\n` + msg.packageFixedCityMenu();
    }

    const cityObj = FIXED_PACKAGES[cityKey];
    updateSession(phone, {
      selectedCityKey: cityKey,
      selectedCityObj: cityObj
    });

    if (cityObj.durations && cityObj.durations.length > 1) {
      updateSession(phone, { step: 'PKG_FIXED_DURATION' });
      return msg.packageFixedDurationMenu(cityObj);
    } else {
      const durationKey = cityObj.durations[0] || '21_DAYS';
      const durationText = '21 Days (20 Nights)';
      const flights = cityObj.flights21 || [];
      const hotels = cityObj.hotels || [];

      updateSession(phone, {
        step: 'PKG_FIXED_HOTEL_COMBO',
        durationKey,
        durationText,
        availableFlights: flights,
        availableHotels: hotels
      });

      return msg.packageFixedHotelCombosMenu(hotels, durationKey);
    }
  }

  if (session.step === 'PKG_FIXED_DURATION') {
    const cityObj = session.selectedCityObj || FIXED_PACKAGES[session.selectedCityKey || 'ISLAMABAD'];
    let durationKey = '15_DAYS';
    let durationText = '15 Days (14 Nights)';
    let flights = cityObj.flights15 || [];

    if (text === '2') {
      durationKey = '20_DAYS';
      durationText = '20/21 Days (20 Nights)';
      flights = cityObj.flights20 || cityObj.flights21 || [];
    } else if (text !== '1') {
      return `⚠️ Please reply *1* for 15 Days or *2* for 20/21 Days:\n\n` + msg.packageFixedDurationMenu(cityObj);
    }

    updateSession(phone, {
      step: 'PKG_FIXED_HOTEL_COMBO',
      durationKey,
      durationText,
      availableFlights: flights,
      availableHotels: cityObj.hotels || []
    });

    return msg.packageFixedHotelCombosMenu(cityObj.hotels || [], durationKey);
  }

  if (session.step === 'PKG_FIXED_HOTEL_COMBO') {
    const hotels = session.availableHotels || [];
    const choice = parseInt(text, 10);
    if (isNaN(choice) || choice < 1 || choice > hotels.length) {
      return `⚠️ Please select a valid package number (1–${hotels.length}):\n\n` + msg.packageFixedHotelCombosMenu(hotels, session.durationKey);
    }

    const selectedCombo = hotels[choice - 1];
    const roomMenuObj = msg.packageFixedRoomTypeMenu(selectedCombo, session.durationKey);

    updateSession(phone, {
      step: 'PKG_FIXED_ROOM_TYPE',
      selectedCombo,
      roomTypeMap: roomMenuObj.map
    });

    return roomMenuObj.text;
  }

  if (session.step === 'PKG_FIXED_ROOM_TYPE') {
    const roomMap = session.roomTypeMap || {};
    if (!roomMap[text]) {
      return `⚠️ Please select a valid room option:\n\n` + msg.packageFixedRoomTypeMenu(session.selectedCombo, session.durationKey).text;
    }

    const selectedRoom = roomMap[text];
    const flights = session.availableFlights || [];
    const cityObj = session.selectedCityObj || {};

    updateSession(phone, {
      step: 'PKG_FIXED_FLIGHT_DATE',
      selectedRoom
    });

    return msg.packageCustomFlightDateMenu(flights, cityObj.cityName || 'Pakistan', session.durationText);
  }

  if (session.step === 'PKG_FIXED_FLIGHT_DATE') {
    const flights = session.availableFlights || [];
    const choice = parseInt(text, 10);
    if (isNaN(choice) || choice < 1 || choice > flights.length) {
      return `⚠️ Please select a valid flight date (1–${flights.length}):\n\n` + msg.packageCustomFlightDateMenu(flights, session.selectedCityObj?.cityName || 'Pakistan', session.durationText);
    }

    const selectedFlight = flights[choice - 1];
    const roomKey = (session.selectedRoom?.key || '').toLowerCase();

    // Only ask number of pax when choosing sharing!
    if (roomKey === 'sharing') {
      updateSession(phone, {
        step: 'PKG_FIXED_ASK_PAX',
        selectedFlight
      });

      return (
        `👥 *Number of Passengers for Sharing Accommodation*\n\n` +
        `Package: *${session.selectedCombo.makkah}* + *${session.selectedCombo.madinah}*\n` +
        `Room Category: *${session.selectedRoom.label}* (*${session.selectedRoom.rate.toLocaleString()} PKR/person*)\n` +
        `Flight: *${selectedFlight.dates}*\n\n` +
        `Please enter the total number of passengers _(e.g. 1, 2, 4, etc.):_` +
        msg.MENU_FOOTER
      );
    }

    // For Double, Triple, Quad — pax is auto-determined!
    const pax = roomKey === 'double' ? 2 : (roomKey === 'triple' ? 3 : (roomKey === 'quad' ? 4 : 2));
    const totalPkr = session.selectedRoom.rate * pax;
    const totalSar = Math.round(totalPkr / (exchangeInfo?.effectiveRate || 75.57));

    updateSession(phone, {
      step: 'AWAIT_PASSPORT',
      flow: 'PACKAGE_FIXED',
      selectedFlight,
      passengersCount: pax,
      totalPassengers: pax,
      passengerCount: pax,
      passportCount: pax,
      passports: [],
      currentPassengerIndex: 1,
      expectedPassports: pax,
      status: 'PENDING_PASSPORT',
      totalPkr,
      totalSar,
      familyHeadName: 'Valued Customer'
    });

    return msg.requestPassportImage(1, pax);
  }

  if (session.step === 'PKG_FIXED_ASK_PAX') {
    const pax = parseInt(text, 10);
    if (isNaN(pax) || pax < 1) {
      return `⚠️ Please enter a valid number of passengers (e.g. *1*, *2*, *4*, etc.):`;
    }

    const totalPkr = session.selectedRoom.rate * pax;
    const totalSar = Math.round(totalPkr / (exchangeInfo?.effectiveRate || 75.57));

    updateSession(phone, {
      step: 'AWAIT_PASSPORT',
      flow: 'PACKAGE_FIXED',
      passengersCount: pax,
      totalPassengers: pax,
      passengerCount: pax,
      passportCount: pax,
      passports: [],
      currentPassengerIndex: 1,
      expectedPassports: pax,
      status: 'PENDING_PASSPORT',
      totalPkr,
      totalSar,
      familyHeadName: 'Valued Customer'
    });

    return msg.requestPassportImage(1, pax);
  }

  // ============================================================
  //  SUB-FLOW B: MAKE YOUR OWN PACKAGE (CUSTOMIZED BUILDER)
  // ============================================================

  if (session.step === 'PKG_CUSTOM_DURATION') {
    let days = 14;
    let nights = 14;
    let makNights = 8;
    let medNights = 6;
    let durationKey = '14_DAYS';

    if (text === '2') {
      days = 21;
      nights = 20;
      makNights = 12;
      medNights = 8;
      durationKey = '21_DAYS';
    } else if (text !== '1') {
      return `⚠️ Please select *1* for 14 Days or *2* for 21 Days:\n\n` + msg.packageCustomDurationMenu();
    }

    updateSession(phone, {
      step: 'PKG_CUSTOM_CITY',
      durationDays: days,
      durationNights: nights,
      makkahNights: makNights,
      madinahNights: medNights,
      durationKey
    });

    return msg.packageCustomCityMenu();
  }

  if (session.step === 'PKG_CUSTOM_CITY') {
    const cityKey = CITY_KEY_MAP[text];
    if (!cityKey || !TICKET_RATES_BY_CITY[cityKey]) {
      return `⚠️ Please select a valid departure city (1–5):\n\n` + msg.packageCustomCityMenu();
    }

    const ticketRate = TICKET_RATES_BY_CITY[cityKey];
    const fixedData = FIXED_PACKAGES[cityKey] || FIXED_PACKAGES.ISLAMABAD;
    const flights = (session.durationDays === 14 ? fixedData.flights15 : (fixedData.flights20 || fixedData.flights21)) || [];

    updateSession(phone, {
      step: 'PKG_CUSTOM_ASK_PAX',
      cityKey,
      cityName: fixedData.cityName || cityKey,
      airline: fixedData.airline || 'Saudia / PIA',
      ticketRatePerPax: ticketRate,
      customFlights: flights
    });

    return (
      `👥 *Number of Passengers*\n\n` +
      `Sector: *${fixedData.cityName}* (Ticket: *${ticketRate.toLocaleString()} PKR/Pax*)\n` +
      `Package: *${session.durationDays} Days* (${session.makkahNights}N Makkah + ${session.madinahNights}N Madinah)\n\n` +
      `Please enter total number of passengers in your group _(e.g. 1, 2, 4, etc.):_` +
      msg.MENU_FOOTER
    );
  }

  if (session.step === 'PKG_CUSTOM_ASK_PAX') {
    const pax = parseInt(text, 10);
    if (isNaN(pax) || pax < 1) {
      return `⚠️ Please enter a valid number of passengers (e.g. *1*, *2*, *4*, etc.):`;
    }

    const ticketTotal = session.ticketRatePerPax * pax;

    // Calculate Visa WITH Transport base rate in SAR
    let visaTransportSarPerPax = 550; // standard default
    const { VISA_RATES } = require('../config');
    const vList = VISA_RATES.withTransport?.passengers || [];
    for (const p of vList) {
      const match = p.range.match(/(\d+)/);
      if (match && pax <= parseInt(match[1], 10)) {
        visaTransportSarPerPax = p.rate;
        break;
      }
    }

    updateSession(phone, {
      step: 'PKG_CUSTOM_TRANSPORT',
      passengersCount: pax,
      ticketTotalPkr: ticketTotal,
      visaTransportSarPerPax
    });

    return msg.packageCustomTransportMenu(pax);
  }

  if (session.step === 'PKG_CUSTOM_TRANSPORT') {
    const vehicleName = VEHICLE_TYPES[text];
    if (!vehicleName) {
      return `⚠️ Please select a valid vehicle type (1–5):\n\n` + msg.packageCustomTransportMenu(session.passengersCount);
    }

    const flights = session.customFlights || [];
    updateSession(phone, {
      step: 'PKG_CUSTOM_FLIGHT_DATE',
      vehicleType: vehicleName
    });

    return msg.packageCustomFlightDateMenu(flights, session.cityName, `${session.durationDays} Days`);
  }

  if (session.step === 'PKG_CUSTOM_FLIGHT_DATE') {
    const flights = session.customFlights || [];
    const choice = parseInt(text, 10);
    let flightDates = 'Confirmed Group Schedule';
    let flightRoute = `${session.cityName} ⇆ Saudi Arabia`;

    if (!isNaN(choice) && choice >= 1 && choice <= flights.length) {
      flightDates = flights[choice - 1].dates;
      flightRoute = flights[choice - 1].route;
    }

    updateSession(phone, {
      step: 'PKG_CUSTOM_MAKKAH_HOTEL',
      flightDates,
      flightRoute
    });

    return (
      `🕋 *Step 1/2: Select Makkah Hotel (${session.makkahNights} Nights)*\n\n` +
      msg.hotelCatalogMenu('MAKKAH', makkahCatalog)
    );
  }

  // ── STEP: Select Makkah Hotel ────────────────────────────────
  if (session.step === 'PKG_CUSTOM_MAKKAH_HOTEL') {
    let selectedHotel = null;
    const cleanNum = parseInt(text.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(cleanNum) && cleanNum >= 1 && cleanNum <= makkahCatalog.length) {
      selectedHotel = makkahCatalog[cleanNum - 1];
    } else {
      const lower = text.toLowerCase().trim();
      selectedHotel = makkahCatalog.find(h => lower.includes(h.name.toLowerCase()) || h.name.toLowerCase().includes(lower));
    }

    if (!selectedHotel) {
      return `⚠️ Please select a valid Makkah hotel from the list:\n\n` + msg.hotelCatalogMenu('MAKKAH', makkahCatalog);
    }

    const roomMenu = msg.hotelRoomTypeMenu(selectedHotel, 1, 1);
    updateSession(phone, {
      step: 'PKG_CUSTOM_MAKKAH_ROOM_TYPE',
      selectedMakkahHotel: selectedHotel,
      makkahRoomTypeMap: roomMenu.optionsMap
    });

    return (
      `🕋 *Makkah Hotel:* ${selectedHotel.name} (${session.makkahNights} Nights)\n\n` +
      roomMenu.text
    );
  }

  if (session.step === 'PKG_CUSTOM_MAKKAH_ROOM_TYPE') {
    const roomMap = session.makkahRoomTypeMap || {};
    const selectedOption = roomMap[text];
    if (!selectedOption) {
      return `⚠️ Please select a valid room category:\n\n` + msg.hotelRoomTypeMenu(session.selectedMakkahHotel, 1, 1).text;
    }

    const hotel = session.selectedMakkahHotel;
    const ratePerPax = hotel.rates[selectedOption.key] || 40;
    const makkahTotalSar = ratePerPax * (session.makkahNights || 8) * (session.passengersCount || 1);

    updateSession(phone, {
      step: 'PKG_CUSTOM_MADINAH_HOTEL',
      makkahHotelName: hotel.name,
      makkahRoomType: selectedOption.label,
      makkahRatePerPax: ratePerPax,
      makkahTotalSar
    });

    return (
      `🕌 *Step 2/2: Select Madinah Hotel (${session.madinahNights} Nights)*\n\n` +
      msg.hotelCatalogMenu('MADINAH', madinahCatalog)
    );
  }

  // ── STEP: Select Madinah Hotel ───────────────────────────────
  if (session.step === 'PKG_CUSTOM_MADINAH_HOTEL') {
    let selectedHotel = null;
    const cleanNum = parseInt(text.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(cleanNum) && cleanNum >= 1 && cleanNum <= madinahCatalog.length) {
      selectedHotel = madinahCatalog[cleanNum - 1];
    } else {
      const lower = text.toLowerCase().trim();
      selectedHotel = madinahCatalog.find(h => lower.includes(h.name.toLowerCase()) || h.name.toLowerCase().includes(lower));
    }

    if (!selectedHotel) {
      return `⚠️ Please select a valid Madinah hotel from the list:\n\n` + msg.hotelCatalogMenu('MADINAH', madinahCatalog);
    }

    const roomMenu = msg.hotelRoomTypeMenu(selectedHotel, 1, 1);
    updateSession(phone, {
      step: 'PKG_CUSTOM_MADINAH_ROOM_TYPE',
      selectedMadinahHotel: selectedHotel,
      madinahRoomTypeMap: roomMenu.optionsMap
    });

    return (
      `🕌 *Madinah Hotel:* ${selectedHotel.name} (${session.madinahNights} Nights)\n\n` +
      roomMenu.text
    );
  }

  if (session.step === 'PKG_CUSTOM_MADINAH_ROOM_TYPE') {
    const roomMap = session.madinahRoomTypeMap || {};
    const selectedOption = roomMap[text];
    if (!selectedOption) {
      return `⚠️ Please select a valid room category:\n\n` + msg.hotelRoomTypeMenu(session.selectedMadinahHotel, 1, 1).text;
    }

    const hotel = session.selectedMadinahHotel;
    const ratePerPax = hotel.rates[selectedOption.key] || 35;
    const medNights = session.madinahNights || 6;
    const pax = session.passengersCount || 1;
    const madinahTotalSar = ratePerPax * medNights * pax;

    // Calculate total Package in PKR & SAR
    const hotelsTotalSar = session.makkahTotalSar + madinahTotalSar;
    const visaTransportTotalSar = (session.visaTransportSarPerPax || 550) * pax;
    const packageTotalSar = hotelsTotalSar + visaTransportTotalSar;
    const convertedHotelAndVisaPkr = exchangeInfo.convertToPkr(packageTotalSar);
    const grandTotalPkr = session.ticketTotalPkr + convertedHotelAndVisaPkr;

    const pkgData = {
      ...session,
      madinahHotelName: hotel.name,
      madinahRoomType: selectedOption.label,
      madinahRatePerPax: ratePerPax,
      madinahTotalSar,
      hotelsTotalSar,
      visaTransportTotalSar,
      totalSar: packageTotalSar,
      totalPkr: grandTotalPkr,
      passengersCount: pax,
      totalPassengers: pax,
      passengerCount: pax,
      passportCount: pax,
      passports: [],
      currentPassengerIndex: 1,
      expectedPassports: pax,
      status: 'PENDING_PASSPORT',
      familyHeadName: 'Valued Customer',
      packagePendingVoucherTrigger: true,
      step: 'AWAIT_PASSPORT',
      flow: 'PACKAGE_CUSTOM'
    };

    updateSession(phone, pkgData);

    return msg.requestPassportImage(1, pax);
  }

  return msg.packageTypeMenu();
}

module.exports = {
  handlePackageFlow
};
