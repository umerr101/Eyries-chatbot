// ============================================================
//  utils/passengerAge.js — Passenger Age & Category Classifier
//  Rules:
//  • < 2 years  -> Infant (INF) — Visa Rate: 500 SAR
//  • 2–11 years -> Child (CHD)
//  • 12+ years  -> Adult (ADT)
// ============================================================

/**
 * Calculates exact passenger age and category classification from Date of Birth.
 * @param {string} dobStr - Date of birth string (e.g. 'YYYY-MM-DD', 'DD/MM/YYYY', etc.)
 * @param {string} referenceDateStr - Optional reference travel date (defaults to today)
 * @returns {{ age: number, type: 'INF'|'CHD'|'ADT', label: string, visaRate: number|null }}
 */
function getPassengerTypeFromDob(dobStr, referenceDateStr = null) {
  if (!dobStr || ['N/A', 'NONE', 'NOT DETECTED', ''].includes(String(dobStr).toUpperCase().trim())) {
    return { age: 30, type: 'ADT', label: 'Adult (12+ yrs)', visaRate: null };
  }

  let birthDate = null;
  const str = String(dobStr).trim();

  // Try standard YYYY-MM-DD
  if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(str)) {
    const parts = str.split(/[-/.]/);
    birthDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }
  // Try DD-MM-YYYY or DD/MM/YYYY
  else if (/^\d{1,2}[-/.]\d{1,2}[-/.]\d{4}$/.test(str)) {
    const parts = str.split(/[-/.]/);
    birthDate = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
  } else {
    birthDate = new Date(str);
  }

  if (!birthDate || isNaN(birthDate.getTime())) {
    return { age: 30, type: 'ADT', label: 'Adult (12+ yrs)', visaRate: null };
  }

  const refDate = referenceDateStr ? new Date(referenceDateStr) : new Date();
  const validRef = !isNaN(refDate.getTime()) ? refDate : new Date();

  let age = validRef.getFullYear() - birthDate.getFullYear();
  const m = validRef.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && validRef.getDate() < birthDate.getDate())) {
    age--;
  }

  if (age < 0) age = 0;

  if (age < 2) {
    return {
      age,
      type: 'INF',
      label: 'Infant (< 2 yrs)',
      visaRate: 500 // Infant Visa Rate fixed at 500 SAR
    };
  } else if (age < 12) {
    return {
      age,
      type: 'CHD',
      label: 'Child (2–11 yrs)',
      visaRate: null // Standard Child Visa Rate
    };
  } else {
    return {
      age,
      type: 'ADT',
      label: 'Adult (12+ yrs)',
      visaRate: null // Standard Adult Visa Rate
    };
  }
}

module.exports = {
  getPassengerTypeFromDob
};
