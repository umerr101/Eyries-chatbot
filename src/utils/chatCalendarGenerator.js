// ============================================================
//  utils/chatCalendarGenerator.js
//  Renders in-chat visual monthly text calendar with N next month navigation
// ============================================================

const MONTH_NAMES = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
];

const SHORT_MONTH_MAP = {
  'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAY': 4, 'JUN': 5,
  'JUL': 6, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11
};

/**
 * Renders a 7-column monthly text calendar formatted for WhatsApp text bubbles.
 * @param {number} year  - e.g. 2026
 * @param {number} month - 0-indexed (0 = Jan, 7 = Aug)
 * @param {object} options - { ticketDepDate, currentCity }
 */
function renderChatCalendar(year, month, options = {}) {
  const city = options.currentCity || 'MAKKAH';
  const monthName = MONTH_NAMES[month] || 'AUGUST';

  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Convert Sunday-indexed getDay() to Monday-indexed (0 = Mon, 6 = Sun)
  let startCol = firstDay.getDay() - 1;
  if (startCol < 0) startCol = 6;

  let grid = ' Mo  Tu  We  Th  Fr  Sa  Su\n';
  let currentLine = '';

  // Leading spaces for first week
  for (let i = 0; i < startCol; i++) {
    currentLine += '    ';
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dayStr = String(day).padStart(2, ' ');
    currentLine += ` ${dayStr} `;

    if ((startCol + day) % 7 === 0 || day === daysInMonth) {
      grid += currentLine + '\n';
      currentLine = '';
    }
  }

  const nextMonthIdx = (month + 1) % 12;
  const nextMonthYear = month === 11 ? year + 1 : year;
  const nextMonthName = MONTH_NAMES[nextMonthIdx];

  return (
    `🗓️ *${monthName} ${year} (${city} STAY DATES)*\n\n` +
    `\`\`\`\n${grid}\`\`\`\n` +
    `▶️ Reply *N* for Next Month _(${nextMonthName} ${nextMonthYear})_\n\n` +
    `💬 *Reply with your stay dates or duration:*\n` +
    `• E.g. *27 Aug to 03 Sep*\n` +
    `• Or reply with total nights _(e.g. 5, 7)_`
  );
}

/**
 * Parses user chat entries for stay duration (nights or date ranges).
 * Returns { nights, checkInPretty, checkOutPretty } or null.
 */
function parseStayDatesOrNights(inputText, baseYear = 2026) {
  if (!inputText) return null;
  const text = String(inputText).trim();

  // 1. FIRST check if user typed a date range (contains "to", "-", "till", "until" or month names e.g. "28 aug to 5 sep")
  const isRange = /\b(to|till|until|through|\-)\b/i.test(text) || text.includes('/') || (text.match(/\d{1,2}/g) || []).length >= 2;

  if (isRange) {
    const dateMatches = text.match(/(\d{1,2})(?:st|nd|rd|th)?[\s\/\-]*([A-Za-z]{3,9}|\d{1,2})(?:[\s\/\-]*(\d{2,4}))?/gi);
    if (dateMatches && dateMatches.length >= 2) {
      const parseSingle = (raw) => {
        const parts = raw.replace(/(st|nd|rd|th)/gi, '').split(/[\s\/\-]/).filter(Boolean);
        const d = parseInt(parts[0], 10);
        let m = 7; // default Aug
        let y = baseYear;
        if (parts[1]) {
          const upperM = parts[1].toUpperCase().substring(0, 3);
          if (SHORT_MONTH_MAP[upperM] !== undefined) {
            m = SHORT_MONTH_MAP[upperM];
          } else if (!isNaN(parseInt(parts[1], 10))) {
            m = parseInt(parts[1], 10) - 1;
          }
        }
        if (parts[2] && !isNaN(parseInt(parts[2], 10))) {
          y = parseInt(parts[2], 10);
          if (y < 100) y += 2000;
        }
        return new Date(y, m, d);
      };

      const d1 = parseSingle(dateMatches[0]);
      const d2 = parseSingle(dateMatches[1]);

      if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
        if (d2 < d1) {
          d2.setFullYear(d2.getFullYear() + 1);
        }
        const diffDays = Math.ceil(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24));
        if (diffDays >= 1 && diffDays <= 60) {
          const options = { day: '2-digit', month: 'short', year: 'numeric' };
          return {
            nights: diffDays,
            checkInPretty: d1.toLocaleDateString('en-GB', options),
            checkOutPretty: d2.toLocaleDateString('en-GB', options)
          };
        }
      }
    }
  }

  // 2. Check if user typed a pure single number of nights e.g. "5", "5 nights", "7 nights"
  const pureNumMatch = text.match(/^(\d{1,2})\s*(?:nights?|n)?$/i);
  if (pureNumMatch) {
    const val = parseInt(pureNumMatch[1], 10);
    if (val >= 1 && val <= 60) {
      return { nights: val, checkInPretty: '', checkOutPretty: '' };
    }
  }

  // 3. Fallback: single leading number ONLY if text contains no month names
  if (!/[a-z]/i.test(text)) {
    const numMatch = text.match(/^(\d{1,2})\b/);
    if (numMatch) {
      const val = parseInt(numMatch[1], 10);
      if (val >= 1 && val <= 60) {
        return { nights: val, checkInPretty: '', checkOutPretty: '' };
      }
    }
  }

  return null;
}

module.exports = {
  renderChatCalendar,
  parseStayDatesOrNights,
  MONTH_NAMES,
  SHORT_MONTH_MAP
};
