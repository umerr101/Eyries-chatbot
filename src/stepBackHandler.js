// ============================================================
//  stepBackHandler.js — Step-Back ('0' / 'BACK') Navigation Engine
// ============================================================

const { getSession, updateSession, resetSession } = require('./stateManager');
const msg = require('./utils/messageBuilder');
const { getPackageCatalog, FIXED_PACKAGES } = require('./data/packageCatalog');
const { TRANSPORT_ROUTES, VEHICLES, VISA_RATES } = require('./config');
const { loadClientConfig } = require('./configLoader');

/**
 * Handles '0' or 'BACK' commands to navigate one step back in any flow.
 */
async function handleStepBack(phone) {
  const session = getSession(phone);
  const flow = session.flow || 'MAIN_MENU';
  const step = session.step || 'WELCOME';

  const activeClient = loadClientConfig();
  const makkahCatalog = activeClient.makkahHotels || [];
  const madinahCatalog = activeClient.madinahHotels || [];

  // ── 1. Main Menu / Welcome / Root ─────────────────────────
  if (flow === 'MAIN_MENU' || step === 'WELCOME' || step === 'IDLE') {
    resetSession(phone);
    return msg.mainMenu();
  }

  // ── 2. Transport Flow ─────────────────────────────────────
  if (flow === 'TRANSPORT') {
    if (step === 'TRANSPORT_ROUTE') {
      resetSession(phone);
      return msg.mainMenu();
    }
    if (step === 'TRANSPORT_VEHICLE') {
      updateSession(phone, { step: 'TRANSPORT_ROUTE', selectedRouteId: null });
      return msg.transportRouteMenu();
    }
    if (step === 'TRANSPORT_ASK_FAMILY_HEAD') {
      updateSession(phone, { step: 'TRANSPORT_VEHICLE', selectedVehicleId: null });
      return msg.vehicleMenu(session.selectedRouteId);
    }
    if (step === 'TRANSPORT_DONE') {
      updateSession(phone, { step: 'TRANSPORT_ROUTE', selectedRouteId: null, selectedVehicleId: null });
      return msg.transportRouteMenu();
    }
    resetSession(phone);
    return msg.mainMenu();
  }

  // ── 3. Hotel Flow ─────────────────────────────────────────
  if (flow === 'HOTEL') {
    if (step === 'HOTEL_CITY_CHOICE') {
      resetSession(phone);
      return msg.mainMenu();
    }
    if (step === 'HOTEL_SELECT_MAKKAH' || step === 'HOTEL_SELECT_MADINAH') {
      updateSession(phone, { step: 'HOTEL_CITY_CHOICE' });
      return msg.hotelCityChoiceMenu();
    }
    if (step === 'HOTEL_ASK_ROOM_COUNT') {
      const isMadinah = session.currentCity === 'MADINAH';
      updateSession(phone, {
        step: isMadinah ? 'HOTEL_SELECT_MADINAH' : 'HOTEL_SELECT_MAKKAH',
        selectedHotel: null
      });
      return msg.hotelCatalogMenu(isMadinah ? 'MADINAH' : 'MAKKAH', isMadinah ? madinahCatalog : makkahCatalog);
    }
    if (step === 'HOTEL_ROOM_TYPE_SELECT') {
      const currRoom = session.currentRoomIndex || 1;
      if (currRoom > 1) {
        const rooms = (session.selectedRooms || []).slice(0, currRoom - 2);
        const prevIndex = currRoom - 1;
        const menuObj = msg.hotelRoomTypeMenu(session.selectedHotel, prevIndex, session.totalRooms);
        updateSession(phone, {
          currentRoomIndex: prevIndex,
          selectedRooms: rooms,
          roomTypeMap: menuObj.optionsMap
        });
        return menuObj.text;
      } else {
        updateSession(phone, { step: 'HOTEL_ASK_ROOM_COUNT', selectedRooms: [] });
        return (
          `🏨 *Number of Rooms Required*\n\n` +
          `Hotel: *${session.selectedHotel?.name}* (${session.currentCity})\n\n` +
          `How many rooms do you require at *${session.selectedHotel?.name}*? _(e.g. 1, 2, 3, etc.):_` +
          msg.MENU_FOOTER
        );
      }
    }
    if (step === 'HOTEL_ASK_STAY_DATES' || step === 'HOTEL_CALENDAR_POPUP') {
      const roomCount = session.totalRooms || 1;
      const menuObj = msg.hotelRoomTypeMenu(session.selectedHotel, roomCount, roomCount);
      updateSession(phone, {
        step: 'HOTEL_ROOM_TYPE_SELECT',
        currentRoomIndex: roomCount,
        roomTypeMap: menuObj.optionsMap
      });
      return menuObj.text;
    }
    if (step === 'HOTEL_ASK_FAMILY_HEAD') {
      updateSession(phone, { step: 'HOTEL_ASK_STAY_DATES' });
      return msg.hotelStayDatesPrompt(session.currentCity, session.selectedHotel?.name);
    }
    if (step === 'HOTEL_ASK_TICKET_IMAGE') {
      updateSession(phone, { step: 'HOTEL_ASK_FAMILY_HEAD' });
      return (
        `👤 *Family Head Name Required*\n\n` +
        `Please enter the full name of the Family Head for this hotel booking _(e.g. Waleed Ahmad)_:` +
        msg.MENU_FOOTER
      );
    }
    resetSession(phone);
    return msg.mainMenu();
  }

  // ── 4. Visa Flow ──────────────────────────────────────────
  if (flow === 'VISA') {
    if (step === 'VISA_TYPE') {
      resetSession(phone);
      return msg.mainMenu();
    }
    if (step === 'WITH_TRANSPORT_PASSENGERS' || step === 'WITHOUT_TRANSPORT_AIRLINE') {
      updateSession(phone, { step: 'VISA_TYPE', visaType: null });
      return msg.visaTypeMenu();
    }
    if (step === 'WITHOUT_TRANSPORT_FIRST_LEG_ROUTE') {
      updateSession(phone, { step: 'WITHOUT_TRANSPORT_AIRLINE' });
      return msg.visaWithoutTransportInfo();
    }
    if (step === 'WITHOUT_TRANSPORT_FIRST_LEG_VEHICLE') {
      updateSession(phone, { step: 'WITHOUT_TRANSPORT_FIRST_LEG_ROUTE' });
      return msg.firstLegRouteMenu(550, session.arrivalAirport);
    }
    if (step === 'ASK_PASSENGERS') {
      if (session.visaType === 'longStay') {
        updateSession(phone, { step: 'VISA_TYPE' });
        return msg.visaTypeMenu();
      }
      if (session.visaType === 'withTransport') {
        updateSession(phone, { step: 'WITH_TRANSPORT_PASSENGERS' });
        return msg.visaWithTransportPassengerMenu();
      }
      if (session.visaType === 'withoutTransport') {
        updateSession(phone, { step: 'WITHOUT_TRANSPORT_FIRST_LEG_VEHICLE' });
        return msg.vehicleSelectionMenu(session.selectedRouteLabel, session.routeRates || {});
      }
      updateSession(phone, { step: 'VISA_TYPE' });
      return msg.visaTypeMenu();
    }
    if (step === 'CONFIRM_RATE_AND_PASSENGERS' || step === 'CONFIRM_RATE') {
      if (session.visaType === 'withTransport' && [1, 2, 3, 4].includes(session.passengerCount)) {
        updateSession(phone, { step: 'WITH_TRANSPORT_PASSENGERS' });
        return msg.visaWithTransportPassengerMenu();
      }
      updateSession(phone, { step: 'ASK_PASSENGERS', passengerCount: null });
      return msg.passengerCountPrompt();
    }
    if (step === 'AWAIT_FLIGHT_TICKET') {
      updateSession(phone, { step: 'CONFIRM_RATE_AND_PASSENGERS' });
      const { getEffectiveExchangeRate } = require('./utils/exchangeRate');
      const exchangeInfo = await getEffectiveExchangeRate();
      const perPerson = session.perPersonRate || 600;
      const count = session.passengerCount || 1;
      const visaSubtotal = perPerson * count;
      const vehicleCost = session.addFirstLeg ? (session.vehicleCost || 0) : 0;
      const hajjParkingFee = session.hajjParkingFee || 0;
      const grandTotal = visaSubtotal + vehicleCost + hajjParkingFee;
      let detailsBreakdown = `👥 ${count} passenger(s) @ ${perPerson} SAR each = ${visaSubtotal} SAR`;
      if (session.addFirstLeg && vehicleCost > 0) {
        detailsBreakdown += `\n   🚗 1st Leg Transport (${session.selectedRouteLabel} - ${session.selectedVehicleLabel}): +${vehicleCost} SAR`;
      }
      if (hajjParkingFee > 0) {
        detailsBreakdown += `\n   🅿️ Hajj Terminal Fixed Car Parking Fee: +90 SAR`;
      }
      return msg.rateConfirmation(grandTotal, detailsBreakdown, exchangeInfo);
    }
    resetSession(phone);
    return msg.mainMenu();
  }

  // ── 5. Package Flow ───────────────────────────────────────
  if (flow === 'PACKAGE' || flow.startsWith('PACKAGE_')) {
    if (step === 'PKG_SELECT_TYPE') {
      resetSession(phone);
      return msg.mainMenu();
    }

    // ── FIXED PACKAGES ──
    if (step === 'PKG_FIXED_CITY') {
      updateSession(phone, { flow: 'PACKAGE', step: 'PKG_SELECT_TYPE' });
      return msg.packageTypeMenu();
    }
    if (step === 'PKG_FIXED_DURATION') {
      updateSession(phone, { step: 'PKG_FIXED_CITY' });
      return msg.packageFixedCityMenu();
    }
    if (step === 'PKG_FIXED_HOTEL_COMBO') {
      const cityObj = session.selectedCityObj || FIXED_PACKAGES[session.selectedCityKey || 'ISLAMABAD'];
      if (cityObj?.durations?.length > 1) {
        updateSession(phone, { step: 'PKG_FIXED_DURATION' });
        return msg.packageFixedDurationMenu(cityObj);
      } else {
        updateSession(phone, { step: 'PKG_FIXED_CITY' });
        return msg.packageFixedCityMenu();
      }
    }
    if (step === 'PKG_FIXED_ROOM_TYPE') {
      updateSession(phone, { step: 'PKG_FIXED_HOTEL_COMBO' });
      return msg.packageFixedHotelCombosMenu(session.availableHotels || [], session.durationKey);
    }
    if (step === 'PKG_FIXED_FLIGHT_DATE') {
      updateSession(phone, { step: 'PKG_FIXED_ROOM_TYPE' });
      return msg.packageFixedRoomTypeMenu(session.selectedCombo, session.durationKey).text;
    }
    if (step === 'PKG_FIXED_ASK_PAX') {
      updateSession(phone, { step: 'PKG_FIXED_FLIGHT_DATE' });
      return msg.packageCustomFlightDateMenu(session.availableFlights || [], session.selectedCityObj?.cityName || 'Pakistan', session.durationText);
    }

    // ── CUSTOM PACKAGES ──
    if (step === 'PKG_CUSTOM_DURATION') {
      updateSession(phone, { flow: 'PACKAGE', step: 'PKG_SELECT_TYPE' });
      return msg.packageTypeMenu();
    }
    if (step === 'PKG_CUSTOM_CITY') {
      updateSession(phone, { step: 'PKG_CUSTOM_DURATION' });
      return msg.packageCustomDurationMenu();
    }
    if (step === 'PKG_CUSTOM_ASK_PAX') {
      updateSession(phone, { step: 'PKG_CUSTOM_CITY' });
      return msg.packageCustomCityMenu();
    }
    if (step === 'PKG_CUSTOM_TRANSPORT') {
      const fixedData = FIXED_PACKAGES[session.cityKey] || FIXED_PACKAGES.ISLAMABAD;
      updateSession(phone, { step: 'PKG_CUSTOM_ASK_PAX' });
      return (
        `👥 *Number of Passengers*\n\n` +
        `Sector: *${fixedData.cityName}* (Ticket: *${(session.ticketRatePerPax || 0).toLocaleString()} PKR/Pax*)\n` +
        `Package: *${session.durationDays} Days* (${session.makkahNights}N Makkah + ${session.madinahNights}N Madinah)\n\n` +
        `Please enter total number of passengers in your group _(e.g. 1, 2, 4, etc.):_` +
        msg.MENU_FOOTER
      );
    }
    if (step === 'PKG_CUSTOM_FLIGHT_DATE') {
      updateSession(phone, { step: 'PKG_CUSTOM_TRANSPORT' });
      return msg.packageCustomTransportMenu(session.passengersCount || 1);
    }
    if (step === 'PKG_CUSTOM_MAKKAH_HOTEL') {
      updateSession(phone, { step: 'PKG_CUSTOM_FLIGHT_DATE' });
      return msg.packageCustomFlightDateMenu(session.customFlights || [], session.cityName, `${session.durationDays} Days`);
    }
    if (step === 'PKG_CUSTOM_MAKKAH_ROOM_TYPE') {
      updateSession(phone, { step: 'PKG_CUSTOM_MAKKAH_HOTEL' });
      return (
        `🕋 *Step 1/2: Select Makkah Hotel (${session.makkahNights} Nights)*\n\n` +
        msg.hotelCatalogMenu('MAKKAH', makkahCatalog)
      );
    }
    if (step === 'PKG_CUSTOM_MADINAH_HOTEL') {
      const roomMenu = msg.hotelRoomTypeMenu(session.selectedMakkahHotel, 1, 1);
      updateSession(phone, { step: 'PKG_CUSTOM_MAKKAH_ROOM_TYPE', makkahRoomTypeMap: roomMenu.optionsMap });
      return (
        `🕋 *Makkah Hotel:* ${session.selectedMakkahHotel?.name} (${session.makkahNights} Nights)\n\n` +
        roomMenu.text
      );
    }
    if (step === 'PKG_CUSTOM_MADINAH_ROOM_TYPE') {
      updateSession(phone, { step: 'PKG_CUSTOM_MADINAH_HOTEL' });
      return (
        `🕌 *Step 2/2: Select Madinah Hotel (${session.madinahNights} Nights)*\n\n` +
        msg.hotelCatalogMenu('MADINAH', madinahCatalog)
      );
    }

    resetSession(phone);
    return msg.mainMenu();
  }

  // ── 6. Universal Passport Uploads & OCR Confirmation ──────
  if (step === 'PASSPORT_CONFIRM') {
    updateSession(phone, { step: 'AWAIT_PASSPORT' });
    const currIndex = session.currentPassengerIndex || 1;
    const totalCount = session.passengerCount || session.totalPassengers || session.passengersCount || 1;
    return msg.requestPassportImage(currIndex, totalCount);
  }

  if (step === 'AWAIT_PASSPORT') {
    const currIndex = session.currentPassengerIndex || 1;
    const totalCount = session.passengerCount || session.totalPassengers || session.passengersCount || 1;

    if (currIndex > 1) {
      const prevIndex = currIndex - 1;
      const passengers = (session.passengers || []).slice(0, prevIndex - 1);
      const scanned = (session.scannedPassportNumbers || []).slice(0, prevIndex - 1);
      const savedPaths = (session.savedPassportPaths || []).slice(0, prevIndex - 1);

      updateSession(phone, {
        currentPassengerIndex: prevIndex,
        passengers,
        scannedPassportNumbers: scanned,
        savedPassportPaths: savedPaths
      });

      return [
        `↩️ *Returning to Passenger ${prevIndex} of ${totalCount}...*`,
        msg.requestPassportImage(prevIndex, totalCount)
      ];
    } else {
      if (session.flow?.startsWith('PACKAGE_FIXED')) {
        updateSession(phone, { step: 'PKG_FIXED_FLIGHT_DATE' });
        return msg.packageCustomFlightDateMenu(session.availableFlights || [], session.selectedCityObj?.cityName || 'Pakistan', session.durationText);
      }
      if (session.flow === 'VISA') {
        updateSession(phone, { step: 'AWAIT_FLIGHT_TICKET' });
        return msg.requestTicketImage();
      }
    }
  }

  resetSession(phone);
  return msg.mainMenu();
}

module.exports = { handleStepBack };
