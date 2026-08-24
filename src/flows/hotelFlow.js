// ============================================================
//  flows/hotelFlow.js — Interactive Makkah & Madinah Hotel Flow
// ============================================================

const { updateSession, resetSession } = require('../stateManager');
const { getEffectiveExchangeRate }    = require('../utils/exchangeRate');
const msg                             = require('../utils/messageBuilder');
const { activeClient }                = require('../config');

/**
 * Handles incoming messages for users in the HOTEL flow.
 */
async function handleHotelFlow(phone, session, incomingMsg) {
  const text = (typeof incomingMsg === 'string' ? incomingMsg : (incomingMsg && incomingMsg.body) || '').trim().toUpperCase();

  // Load client hotel catalogs (defaults to empty arrays if not present)
  const makkahHotels = activeClient.makkahHotels || [];
  const madinahHotels = activeClient.madinahHotels || [];

  // ── STEP: City Choice (Makkah vs Madinah) ─────────────────
  if (session.step === 'HOTEL_CITY_CHOICE') {
    if (text === '1') {
      updateSession(phone, { step: 'HOTEL_SELECT_MAKKAH', currentCity: 'MAKKAH' });
      return msg.hotelCatalogMenu('MAKKAH', makkahHotels);
    }
    if (text === '2') {
      updateSession(phone, { step: 'HOTEL_SELECT_MADINAH', currentCity: 'MADINAH' });
      return msg.hotelCatalogMenu('MADINAH', madinahHotels);
    }
    return msg.hotelCityChoiceMenu();
  }

  // ── STEP: Select Hotel (Makkah or Madinah) ────────────────
  if (session.step === 'HOTEL_SELECT_MAKKAH' || session.step === 'HOTEL_SELECT_MADINAH') {
    const isMakkah = session.step === 'HOTEL_SELECT_MAKKAH';
    const catalog = isMakkah ? makkahHotels : madinahHotels;

    let selectedHotel = null;
    const cleanNum = parseInt(text.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(cleanNum) && cleanNum >= 1 && cleanNum <= catalog.length) {
      selectedHotel = catalog[cleanNum - 1];
    } else {
      const lower = text.toLowerCase().trim();
      selectedHotel = catalog.find(h => lower.includes(h.name.toLowerCase()) || h.name.toLowerCase().includes(lower));
    }

    if (selectedHotel) {
      const rates = selectedHotel.rates || {};
      const hasNumericRates = Object.values(rates).some(v => v !== null && v !== undefined);

      if (!hasNumericRates || selectedHotel.name.toUpperCase().includes('VOCO')) {
        resetSession(phone);
        return msg.hotelOnBookingEscalation(selectedHotel);
      }

      updateSession(phone, {
        step: 'HOTEL_ASK_ROOM_COUNT',
        selectedHotel: selectedHotel,
        selectedRooms: [],
        currentRoomIndex: 1
      });

      return (
        `🏨 *Number of Rooms Required*\n\n` +
        `Hotel: *${selectedHotel.name}* (${session.currentCity})\n\n` +
        `How many rooms do you require at *${selectedHotel.name}*? _(e.g. 1, 2, 3, etc.):_` +
        msg.MENU_FOOTER
      );
    }
    return msg.hotelCatalogMenu(isMakkah ? 'MAKKAH' : 'MADINAH', catalog);
  }

  // ── STEP: Ask Room Count ──────────────────────────────────
  if (session.step === 'HOTEL_ASK_ROOM_COUNT') {
    const roomCount = parseInt(text, 10);
    if (isNaN(roomCount) || roomCount < 1) {
      return `⚠️ Please enter a valid number of rooms (e.g. *1*, *2*, *3*, etc.):`;
    }

    const hotel = session.selectedHotel;
    const menuObj = msg.hotelRoomTypeMenu(hotel, 1, roomCount);

    updateSession(phone, {
      step: 'HOTEL_ROOM_TYPE_SELECT',
      totalRooms: roomCount,
      currentRoomIndex: 1,
      selectedRooms: [],
      roomTypeMap: menuObj.optionsMap
    });

    return menuObj.text;
  }

  // ── STEP: Sequential Room Category Selection ───────────────
  if (session.step === 'HOTEL_ROOM_TYPE_SELECT') {
    const roomTypeMap = session.roomTypeMap || {};

    if (roomTypeMap[text]) {
      const selectedRoomOption = roomTypeMap[text];
      const hotel = session.selectedHotel;
      const ratePerNight = hotel.rates[selectedRoomOption.key];

      if (!ratePerNight && ratePerNight !== 0) {
        return `⚠️ *${selectedRoomOption.label}* option is not available for *${hotel.name}*.\nPlease choose another room type from the menu above.`;
      }

      const currentRooms = session.selectedRooms || [];
      const newRoom = {
        roomNumber: session.currentRoomIndex || 1,
        key: selectedRoomOption.key,
        label: selectedRoomOption.label,
        paxCapacity: selectedRoomOption.paxCapacity || 1,
        ratePerPax: ratePerNight
      };

      const updatedRooms = [...currentRooms, newRoom];
      const nextRoomIndex = (session.currentRoomIndex || 1) + 1;

      if (nextRoomIndex <= (session.totalRooms || 1)) {
        const menuObj = msg.hotelRoomTypeMenu(hotel, nextRoomIndex, session.totalRooms);
        updateSession(phone, {
          currentRoomIndex: nextRoomIndex,
          selectedRooms: updatedRooms,
          roomTypeMap: menuObj.optionsMap
        });
        return menuObj.text;
      }

      const { renderChatCalendar } = require('../utils/chatCalendarGenerator');
      const now = new Date();
      const currentYear = session.calendarYear || now.getFullYear();
      const currentMonth = session.calendarMonth !== undefined ? session.calendarMonth : now.getMonth();

      updateSession(phone, {
        step: 'HOTEL_ENTER_NIGHTS',
        selectedRooms: updatedRooms,
        calendarYear: currentYear,
        calendarMonth: currentMonth
      });

      const roomsSummaryText = updatedRooms.map(r => `• *Room ${r.roomNumber}:* ${r.label} — *${r.ratePerPax} SAR/night (per pax)*`).join('\n');
      const calendarText = renderChatCalendar(currentYear, currentMonth, { currentCity: session.currentCity });

      return (
        `🏨 Hotel: *${hotel.name}* (${session.currentCity})\n\n` +
        `Selected Rooms:\n${roomsSummaryText}\n\n` +
        `${calendarText}` +
        msg.MENU_FOOTER
      );
    }
    const menuObj = msg.hotelRoomTypeMenu(session.selectedHotel, session.currentRoomIndex || 1, session.totalRooms || 1);
    return menuObj.text;
  }

  // ── STEP: Visual Chat Calendar View & Stay Date Parsing ──────
  if (session.step === 'HOTEL_ENTER_NIGHTS') {
    const { renderChatCalendar, parseStayDatesOrNights } = require('../utils/chatCalendarGenerator');
    const hotel = session.selectedHotel;

    // Handle N (Next Month) reply
    if (text.toUpperCase() === 'N') {
      let curMonth = session.calendarMonth !== undefined ? session.calendarMonth : (new Date()).getMonth();
      let curYear = session.calendarYear || (new Date()).getFullYear();
      curMonth += 1;
      if (curMonth > 11) {
        curMonth = 0;
        curYear += 1;
      }
      updateSession(phone, { calendarYear: curYear, calendarMonth: curMonth });

      const calendarText = renderChatCalendar(curYear, curMonth, { currentCity: session.currentCity });
      return calendarText + msg.MENU_FOOTER;
    }

    // Try parsing stay dates or nights entry
    const parsed = parseStayDatesOrNights(text, session.calendarYear || 2026);
    if (!parsed || !parsed.nights || parsed.nights < 1) {
      return (
        `⚠️ Could not read stay duration. Please reply with:\n` +
        `• Total nights _(e.g. 3, 5, 7)_\n` +
        `• Or stay dates _(e.g. 27 Aug to 03 Sep)_\n\n` +
        `▶️ Or reply *N* for Next Month.`
      );
    }

    const nights = parsed.nights;
    const rooms = session.selectedRooms || [];

    // Calculate city total across all rooms: ratePerPax * paxCapacity * nights
    let cityTotal = 0;
    const processedRooms = rooms.map(r => {
      const pax = r.paxCapacity || 1;
      const roomTotal = r.ratePerPax * pax * nights;
      cityTotal += roomTotal;
      return {
        ...r,
        nights,
        roomTotal
      };
    });

    const mainRoom = processedRooms[0] || {};
    const roomTypeSummary = processedRooms.map(r => `Room ${r.roomNumber}: ${r.label}`).join(', ');

    const cityBooking = {
      city: session.currentCity,
      hotelName: hotel.name,
      roomType: roomTypeSummary,
      ratePerNight: mainRoom.ratePerPax || 0,
      rooms: processedRooms,
      nights: nights,
      cityTotal: cityTotal
    };

    if (session.currentCity === 'MAKKAH') {
      updateSession(phone, { makkahBooking: cityBooking });
    } else {
      updateSession(phone, { madinahBooking: cityBooking });
    }

    // Check if other city has been booked
    const hasMakkah = session.currentCity === 'MAKKAH' || !!session.makkahBooking;
    const hasMadinah = session.currentCity === 'MADINAH' || !!session.madinahBooking;

    if (!hasMakkah || !hasMadinah) {
      const nextCity = !hasMakkah ? 'MAKKAH' : 'MADINAH';
      updateSession(phone, { step: 'HOTEL_PROMPT_NEXT_CITY' });

      const datesLabel = (parsed.checkInPretty && parsed.checkOutPretty)
        ? ` (${parsed.checkInPretty} – ${parsed.checkOutPretty})`
        : '';

      return (
        `✅ *${session.currentCity} Hotel Selected!*\n\n` +
        `🏨 *${hotel.name}*\n` +
        `🛏️ Rooms: *${roomTypeSummary}*\n` +
        `🌙 Duration: *${nights} night(s)*${datesLabel}\n` +
        `💰 Total: *${cityTotal} SAR*\n\n` +
        `Would you like to select a hotel for *${nextCity}* as well?\n\n` +
        `1️⃣ *Yes, select ${nextCity} Hotel*\n` +
        `2️⃣ *No, view final hotel summary*\n\n` +
        `_(Reply 1 or 2)_` +
        msg.MENU_FOOTER
      );
    } else {
      // Both cities booked! Transition directly to flight ticket upload
      const makkahBooking = session.makkahBooking || cityBooking;
      const madinahBooking = session.madinahBooking || cityBooking;

      updateSession(phone, {
        step: 'HOTEL_ASK_TICKET_IMAGE',
        makkahBooking,
        madinahBooking
      });

      return (
        `✈️ *Flight Ticket Requirement*\n\n` +
        `Please upload a clear photo or **PDF document** of your *flight ticket booking* to record your travel departure date and passenger names on your hotel voucher:` +
        msg.MENU_FOOTER
      );
    }
  }

  // ── STEP: Prompt Next City Choice ─────────────────────────
  if (session.step === 'HOTEL_PROMPT_NEXT_CITY') {
    if (text === '1') {
      const isMakkahDone = !!session.makkahBooking;
      const nextCity = isMakkahDone ? 'MADINAH' : 'MAKKAH';
      const catalog = isMakkahDone ? madinahHotels : makkahHotels;

      updateSession(phone, {
        step: isMakkahDone ? 'HOTEL_SELECT_MADINAH' : 'HOTEL_SELECT_MAKKAH',
        currentCity: nextCity
      });

      return msg.hotelCatalogMenu(nextCity, catalog);
    }

    if (text === '2') {
      // Single city selected! Transition directly to flight ticket upload
      updateSession(phone, {
        step: 'HOTEL_ASK_TICKET_IMAGE'
      });

      return (
        `✈️ *Flight Ticket Requirement*\n\n` +
        `Please upload a clear photo or **PDF document** of your *flight ticket booking* to record your travel departure date and passenger names on your hotel voucher:` +
        msg.MENU_FOOTER
      );
    }

    return `Please reply *1* to add the next city or *2* to view final summary.`;
  }

  // ── STEP: Collect Flight Ticket Image ──────────────────────
  if (session.step === 'HOTEL_ASK_TICKET_IMAGE') {
    if (incomingMsg && typeof incomingMsg === 'object' && incomingMsg.data) {
      return { type: 'HOTEL_TICKET_TRIGGER', media: incomingMsg };
    }
    return (
      `✈️ *Please send a photo or PDF document of your flight ticket booking* to record your travel departure date on your voucher:` +
      msg.MENU_FOOTER
    );
  }

  // Fallback
  resetSession(phone);
  return msg.mainMenu();
}

module.exports = { handleHotelFlow };
