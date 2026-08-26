// ============================================================
//  flows/visaFlow.js — Complete visa conversation flow handler
// ============================================================

const { updateSession, resetSession }   = require('../stateManager');
const { extractPassportData }           = require('../ocr/passport');
const { confirmPassportWithGemini }     = require('../ocr/pythonBridge');
const msg                               = require('../utils/messageBuilder');
const { getEffectiveExchangeRate }      = require('../utils/exchangeRate');
const { PAKISTANI_AIRLINES, VISA_RATES, TRANSPORT_ROUTES } = require('../config');

/**
 * Handles all incoming messages for a user currently in the VISA flow.
 * Returns the reply string or array of strings to send back to the user.
 */
async function handleVisaFlow(phone, session, incomingMsg, mediaUrl) {
  const text = (incomingMsg || '').trim().toUpperCase();

  // ── STEP: Choose visa type ────────────────────────────────
  if (session.step === 'VISA_TYPE') {
    if (text === '1') {
      updateSession(phone, {
        step: 'ASK_PASSENGERS',
        visaType: 'longStay',
        perPersonRate: 600,
        visaLabel: 'Long Stay Visa (up to 80 days)'
      });
      return msg.longStayVisaDetails();
    }
    if (text === '2') {
      updateSession(phone, { step: 'WITH_TRANSPORT_PASSENGERS', visaType: 'withTransport' });
      return msg.visaWithTransportPassengerMenu();
    }
    if (text === '3') {
      updateSession(phone, { step: 'WITHOUT_TRANSPORT_AIRLINE', visaType: 'withoutTransport' });
      return msg.visaWithoutTransportInfo();
    }
    return msg.visaTypeMenu();
  }

  // ── STEP: Visa with Transport — Select package/rate ──────
  if (session.step === 'WITH_TRANSPORT_PASSENGERS') {
    const choice = parseInt(text, 10);
    const passengers = VISA_RATES.withTransport.passengers;
    if (choice >= 1 && choice <= passengers.length) {
      const selected = passengers[choice - 1];

      // Option 1 (5-47 passengers): Ask user for exact number of passengers
      if (choice === 1) {
        updateSession(phone, {
          step: 'ASK_PASSENGERS',
          perPersonRate: selected.rate,
          visaLabel: `Visa WITH Transport (${selected.range})`
        });
        return msg.passengerCountPrompt(`Visa WITH Transport (${selected.range}) — ${selected.rate} SAR/person`);
      }

      // Options 2-5 (4, 3, 2, or 1 passenger): Number of passengers is fixed by selection
      const exactCountMap = { 2: 4, 3: 3, 4: 2, 5: 1 };
      const count = exactCountMap[choice];
      const totalRate = selected.rate * count;
      const detailsBreakdown = `👥 ${count} passenger(s) @ ${selected.rate} SAR each = ${totalRate} SAR\n   🚗 Transport Included (${selected.range})`;

      updateSession(phone, {
        step: 'CONFIRM_RATE_AND_PASSENGERS',
        passengerCount: count,
        currentPassengerIndex: 1,
        perPersonRate: selected.rate,
        finalVisaRate: totalRate,
        visaLabel: `Visa WITH Transport (${selected.range})`
      });

      const exchangeInfo = await getEffectiveExchangeRate();
      return msg.rateConfirmation(totalRate, detailsBreakdown, exchangeInfo);
    }
    return msg.visaWithTransportPassengerMenu();
  }

  // ── STEP: Visa without Transport — Collect airline ────────
  if (session.step === 'WITHOUT_TRANSPORT_AIRLINE') {
    const airlineLower = (incomingMsg || '').trim().toLowerCase();
    const isPakistani  = PAKISTANI_AIRLINES.some(pa => airlineLower.includes(pa));
    const hajjParkingFee = isPakistani ? 90 : 0;

    updateSession(phone, {
      step: 'WITHOUT_TRANSPORT_FIRST_LEG_ROUTE',
      airline: incomingMsg.trim(),
      isPakistaniAirline: isPakistani,
      isHajjTerminal: isPakistani,
      hajjParkingFee: hajjParkingFee,
      perPersonRate: 550,
      baseVisaRate: 550,
    });

    return msg.firstLegRouteMenu(550, session.arrivalAirport);
  }

  // ── STEP: First Leg Transport Route Choice ────────────────
  if (session.step === 'WITHOUT_TRANSPORT_FIRST_LEG_ROUTE') {
    const isMadinah = (session.arrivalAirport || '').toUpperCase().includes('MADINAH') || (session.arrivalAirport || '').toUpperCase().includes('MED');

    const routeMap = isMadinah ? {
      '1': { id: 7, label: 'Madinah Airport → Madinah Hotel' },
      '2': { id: 3, label: 'Madinah Airport → Makkah Hotel' },
    } : {
      '1': { id: 2, label: 'Jeddah Airport → Makkah Hotel' },
      '2': { id: 8, label: 'Jeddah Airport → Jeddah City' },
      '3': { id: 4, label: 'Jeddah Airport → Madinah Hotel' },
    };

    if (routeMap[text]) {
      const selected = routeMap[text];
      const routeObj = TRANSPORT_ROUTES.find(r => r.id === selected.id);

      updateSession(phone, {
        step: 'WITHOUT_TRANSPORT_FIRST_LEG_VEHICLE',
        addFirstLeg: true,
        selectedRouteId: selected.id,
        selectedRouteLabel: selected.label,
        routeRates: routeObj.rates,
      });

      return msg.vehicleSelectionMenu(selected.label, routeObj.rates);
    }

    return msg.firstLegRouteMenu(550, session.arrivalAirport);
  }

  // ── STEP: First Leg Transport Vehicle Choice ───────────────
  if (session.step === 'WITHOUT_TRANSPORT_FIRST_LEG_VEHICLE') {
    const vehicleKeyMap = {
      '1': { key: 'sedan', label: 'Sedan (3-4)' },
      '2': { key: 'gmcYukon', label: 'GMC Yukon XL (6)' },
      '3': { key: 'hyundaiStaria', label: 'Hyundai Staria (6)' },
      '4': { key: 'toyotaHiace', label: 'Toyota Hiace (9)' },
      '5': { key: 'toyotaCoaster', label: 'Toyota Coaster (17)' },
      '6': { key: 'bus47', label: 'Bus (47 Seats)' },
    };

    if (vehicleKeyMap[text]) {
      const vehicle = vehicleKeyMap[text];
      const vehicleCost = session.routeRates[vehicle.key] || 0;

      updateSession(phone, {
        step: 'ASK_PASSENGERS',
        selectedVehicleKey: vehicle.key,
        selectedVehicleLabel: vehicle.label,
        vehicleCost: vehicleCost,
        visaLabel: `Visa WITHOUT Transport (${session.selectedRouteLabel} - ${vehicle.label})`
      });

      return msg.passengerCountPrompt(`Visa WITHOUT Transport (550 SAR/person)`);
    }

    return msg.vehicleSelectionMenu(session.selectedRouteLabel, session.routeRates);
  }

  // ── STEP: Ask Passenger Count (Universal) ──────────────────
  if (session.step === 'ASK_PASSENGERS') {
    const count = parseInt(text, 10);
    if (isNaN(count) || count < 1) {
      return `⚠️ Please enter a valid number of passengers (e.g. *1*, *2*, *3*, etc.):`;
    }

    const perPerson = session.perPersonRate || 600;
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

    updateSession(phone, {
      step: 'CONFIRM_RATE_AND_PASSENGERS',
      passengerCount: count,
      currentPassengerIndex: 1,
      finalVisaRate: grandTotal,
    });

    const exchangeInfo = await getEffectiveExchangeRate();
    return msg.rateConfirmation(grandTotal, detailsBreakdown, exchangeInfo);
  }

  // ── STEP: Confirm Rate & Passenger Count ─────────────────
  if (session.step === 'CONFIRM_RATE_AND_PASSENGERS') {
    if (text === 'YES') {
      updateSession(phone, { step: 'AWAIT_TICKET_IMAGE', agreedToRate: true });
      return msg.requestTicketImage();
    }
    if (text === 'NO') {
      resetSession(phone);
      return msg.mainMenu();
    }
    return `Please reply *YES* to confirm or *NO* to go back.`;
  }

  // ── STEP: Awaiting Ticket Image ────────────────────────────
  if (session.step === 'AWAIT_TICKET_IMAGE') {
    if (!mediaUrl) {
      return msg.requestTicketImage();
    }
    updateSession(phone, { step: 'TICKET_PROCESSING' });
    return { type: 'TICKET_TRIGGER', media: mediaUrl };
  }

  // ── STEP: Awaiting Passport Image ─────────────────────────
  if (session.step === 'AWAIT_PASSPORT') {
    const currIndex = session.currentPassengerIndex || 1;
    const totalCount = session.passengerCount || 1;

    if (!mediaUrl) {
      return msg.requestPassportImage(currIndex, totalCount);
    }

    // Signal router to run OCR
    updateSession(phone, { step: 'OCR_PROCESSING' });
    return { type: 'OCR_TRIGGER', media: mediaUrl };
  }

  // ── STEP: Passport Confirmation ────────────────────────────
  if (session.step === 'PASSPORT_CONFIRM') {
    const currIndex = session.currentPassengerIndex || 1;
    const totalCount = session.passengerCount || 1;

    if (text === 'YES') {
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      const requestId = session.voucherId || cleanPhone;

      let confirmMsg = null;
      let arabicRecord = null;
      try {
        const passportNum = session.passportData?.passportNumber;
        const res = await confirmPassportWithGemini(passportNum, session.passportData, cleanPhone, requestId);
        if (res && res.whatsapp_message) {
          confirmMsg = res.whatsapp_message;
        }
        if (res && res.record) {
          arabicRecord = res.record;
        }
      } catch (err) {
        console.error('[VisaFlow] Gemini Confirmation error:', err.message);
      }

      // Store confirmed passport media object and disk path in session list
      const mediaList = session.passportMediaList || [];
      if (session.pendingMediaData) {
        mediaList.push(session.pendingMediaData);
      }
      const savedPaths = session.savedPassportPaths || [];
      if (session.pendingImagePath && !savedPaths.includes(session.pendingImagePath)) {
        savedPaths.push(session.pendingImagePath);
      }

      // Record scanned passport number, image hash, and full passenger details
      const currentScanned = session.scannedPassportNumbers || [];
      const currentHashes = session.uploadedImageHashes || [];
      const currentPassengers = session.passengers || [];

      if (session.passportData) {
        const { getPassengerTypeFromDob } = require('../utils/passengerAge');
        const typeInfo = getPassengerTypeFromDob(session.passportData.dob, session.departureDate);

        if (session.passportData.passportNumber) {
          currentScanned.push(session.passportData.passportNumber.toUpperCase());
        }
        currentPassengers.push({
          firstName: session.passportData.firstName || 'Passenger',
          lastName: session.passportData.lastName || '',
          firstNameAr: arabicRecord?.first_name_ar || arabicRecord?.firstNameAr || '',
          lastNameAr: arabicRecord?.last_name_ar || arabicRecord?.lastNameAr || '',
          passportNumber: (session.passportData.passportNumber || 'N/A').toUpperCase(),
          nationality: session.passportData.nationality || 'Pakistani',
          expiryDate: session.passportData.expiryDate || 'N/A',
          dob: session.passportData.dob || 'N/A',
          age: typeInfo.age,
          passengerType: typeInfo.type,
          passengerTypeLabel: typeInfo.label
        });
      }
      if (session.pendingImageHash) {
        currentHashes.push(session.pendingImageHash);
      }

      if (currIndex < totalCount) {
        const nextIndex = currIndex + 1;
        updateSession(phone, {
          step: 'AWAIT_PASSPORT',
          currentPassengerIndex: nextIndex,
          scannedPassportNumbers: currentScanned,
          uploadedImageHashes: currentHashes,
          passportMediaList: mediaList,
          savedPassportPaths: savedPaths,
          passengers: currentPassengers
        });

        const progressMsg = `✅ *Passport ${currIndex} of ${totalCount} Confirmed & Recorded!*`;
        const nextPrompt = msg.requestPassportImage(nextIndex, totalCount);
        return [progressMsg, nextPrompt];
      } else {
        // All passengers confirmed!
        const familyHead = currentPassengers[0]
          ? `${currentPassengers[0].firstName || ''} ${currentPassengers[0].lastName || ''}`.trim()
          : 'Valued Customer';

        const isPackage = session.flow?.startsWith('PACKAGE');
        const exchangeInfo = await getEffectiveExchangeRate();

        let totalSar = session.totalSar;
        let totalPkr = session.totalPkr;

        if (!isPackage) {
          // Calculate Visa subtotal with Infant rule (Infant < 2 yrs = 500 SAR)
          const baseAdultRate = session.perPersonRate || 600;
          let visaSubtotal = 0;
          currentPassengers.forEach(p => {
            if (p.passengerType === 'INF') {
              visaSubtotal += 500; // Infant Visa Rate = 500 SAR
            } else {
              visaSubtotal += baseAdultRate;
            }
          });

          const vehicleCost = session.addFirstLeg ? (session.vehicleCost || 0) : 0;
          const hajjParkingFee = session.hajjParkingFee || 0;
          totalSar = visaSubtotal + vehicleCost + hajjParkingFee;
          totalPkr = exchangeInfo.convertToPkr(totalSar).toLocaleString();
        }

        updateSession(phone, {
          step: 'AWAIT_PAYMENT_RECEIPT',
          status: 'PAYMENT PENDING',
          passportConfirmed: true,
          scannedPassportNumbers: currentScanned,
          uploadedImageHashes: currentHashes,
          passportMediaList: mediaList,
          savedPassportPaths: savedPaths,
          passengers: currentPassengers,
          familyHeadName: familyHead,
          totalSar: totalSar,
          effectiveRate: exchangeInfo.effectiveRate,
          totalPkr: totalPkr
        });

        const allDoneMsg = `✅ *Passport ${currIndex} of ${totalCount} Confirmed & Recorded!*\n\n🎉 *All ${totalCount} passport(s) have been verified for ${familyHead}!*`;
        return allDoneMsg;
      }
    }
    if (text === 'NO') {
      updateSession(phone, { step: 'AWAIT_PASSPORT' });
      return msg.requestPassportImage(currIndex, totalCount);
    }
    return `Please reply *YES* if the details are correct or *NO* to resend your passport image.`;
  }

  // ── STEP: Payment Confirmation ────────────────────────────
  if (session.step === 'PAYMENT') {
    updateSession(phone, { step: 'DONE' });
    return msg.visaSubmittedMessage();
  }

  // ── STEP: Done ────────────────────────────────────────────
  if (session.step === 'DONE') {
    if (text === 'MENU' || text === 'HI' || text === 'HELLO' || text === 'START') {
      resetSession(phone);
      return msg.mainMenu();
    }
    return (
      `Your application is submitted! ✅\n\n` +
      `Reply *MENU* to start a new query or contact our helpline for assistance.`
    );
  }

  return msg.genericError();
}

module.exports = { handleVisaFlow };
