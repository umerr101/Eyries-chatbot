// ============================================================
//  src/data/packageCatalog.js — Fixed & Custom Umrah Package Catalog
// ============================================================

const TICKET_RATES_BY_CITY = {
  ISLAMABAD: 164000,
  LAHORE: 164000,
  MULTAN: 164000,
  PESHAWAR: 164000,
  KARACHI: 140000,
};

const FIXED_PACKAGES = {
  ISLAMABAD: {
    cityName: 'Islamabad',
    airline: 'Saudia Airlines',
    route: 'ISB – JED – ISB',
    inclusions: 'Visa + Full Transport (JED-MAK-MED-MAK-JED) + Hotel Accommodation + Makkah & Madinah Ziarat',
    durations: ['15_DAYS', '20_DAYS'],
    hotels: [
      {
        id: 1,
        makkah: 'Dar Hassan (Similar) - Shuttle',
        madinah: 'Safeer Sakni-2 (Similar) 850m',
        rates15: { sharing: 251500, quad: 256500, triple: 264000, double: 280000 },
        rates20: { sharing: 258500, quad: 265500, triple: 276000, double: 298000 }
      },
      {
        id: 2,
        makkah: 'Dar Hassan (Similar) - Shuttle',
        madinah: 'Safeer Sakni-1 (Similar) 650m',
        rates15: { sharing: 257000, quad: 263500, triple: 273000, double: 292500 },
        rates20: { sharing: 266000, quad: 274500, triple: 288000, double: 314500 }
      },
      {
        id: 3,
        makkah: 'Kiswa Towers - Shuttle',
        madinah: 'Safeer Sakni-2 (Similar) 850m',
        rates15: { sharing: 256000, quad: 262000, triple: 271500, double: 291000 },
        rates20: { sharing: 266000, quad: 274000, triple: 287000, double: 314500 }
      },
      {
        id: 4,
        makkah: 'Kiswa Towers - Shuttle',
        madinah: 'Safeer Sakni-1 (Similar) 650m',
        rates15: { sharing: 261500, quad: 269000, triple: 280500, double: 303500 },
        rates20: { sharing: 273000, quad: 283000, triple: 299500, double: 331500 }
      },
      {
        id: 5,
        makkah: 'Jada Al Khalil (Similar) - 1100m',
        madinah: 'Safeer Sakni-2 (Similar) 850m',
        rates15: { sharing: 258500, quad: 265500, triple: 276000, double: 298500 },
        rates20: { sharing: 269500, quad: 279500, triple: 294500, double: 326000 }
      },
      {
        id: 6,
        makkah: 'Jada Al Khalil (Similar) - 1100m',
        madinah: 'Safeer Sakni-1 (Similar) 650m',
        rates15: { sharing: 264000, quad: 272500, triple: 285500, double: 311000 },
        rates20: { sharing: 277000, quad: 288500, triple: 306500, double: 342500 }
      },
      {
        id: 7,
        makkah: 'Tara Johra / Miad Majd (Similar) - 800m',
        madinah: 'Safeer Sakni-2 (Similar) 850m',
        rates15: { sharing: 260500, quad: 267000, triple: 278000, double: 301500 },
        rates20: { sharing: 272000, quad: 281000, triple: 297000, double: 330500 }
      },
      {
        id: 8,
        makkah: 'Tara Johra / Miad Majd (Similar) - 800m',
        madinah: 'Safeer Sakni-1 (Similar) 650m',
        rates15: { sharing: 266000, quad: 274000, triple: 287500, double: 314000 },
        rates20: { sharing: 279500, quad: 290500, triple: 309500, double: 347000 }
      },
      {
        id: 9,
        makkah: 'Saif Al Majd (Similar) - 750m',
        madinah: 'Safeer Sakni-2 (Similar) 850m',
        rates15: { sharing: 268000, quad: 277500, triple: 291500, double: 322000 },
        rates20: { sharing: 283500, quad: 297000, triple: 317500, double: 361000 }
      },
      {
        id: 10,
        makkah: 'Saif Al Majd (Similar) - 750m',
        madinah: 'Safeer Sakni-1 (Similar) 650m',
        rates15: { sharing: 273500, quad: 284000, triple: 301000, double: 334500 },
        rates20: { sharing: 290500, quad: 306000, triple: 330000, double: 377500 }
      },
      {
        id: 11,
        makkah: 'Saif Al Majd (Similar) - 750m',
        madinah: 'Ariawan Rose (Similar) - 250m',
        rates15: { sharing: null, quad: 303000, triple: 325500, double: 371000 },
        rates20: { sharing: null, quad: 330500, triple: 362500, double: 427000 }
      },
      {
        id: 12,
        makkah: 'Masarat Silver (Similar) - 700m',
        madinah: 'Safeer Sakni-2 (Similar) 850m',
        rates15: { sharing: 268500, quad: 278500, triple: 294500, double: 328000 },
        rates20: { sharing: 284000, quad: 298500, triple: 322000, double: 370000 }
      },
      {
        id: 13,
        makkah: 'Masarat Silver (Similar) - 700m',
        madinah: 'Safeer Sakni-1 (Similar) 650m',
        rates15: { sharing: 274000, quad: 285500, triple: 304000, double: 340500 },
        rates20: { sharing: 291500, quad: 308000, triple: 334500, double: 387000 }
      },
      {
        id: 14,
        makkah: 'Masarat Al Khalil (Similar) - 850m',
        madinah: 'Safeer Sakni-2 (Similar) 850m',
        rates15: { sharing: 266000, quad: 275500, triple: 290500, double: 322000 },
        rates20: { sharing: 280500, quad: 294000, triple: 315500, double: 361000 }
      },
      {
        id: 15,
        makkah: 'Masarat Al Khalil (Similar) - 850m',
        madinah: 'Safeer Sakni-1 (Similar) 650m',
        rates15: { sharing: 271500, quad: 282500, triple: 299500, double: 334500 },
        rates20: { sharing: 288000, quad: 303500, triple: 328000, double: 377500 }
      }
    ],
    flights15: [
      { id: 1, route: 'SV723 02SEP26 ISB-JED / SV722 16SEP26 JED-ISB', seats: 5, dates: '02 Sep 2026 – 16 Sep 2026' },
      { id: 2, route: 'SV723 08SEP26 ISB-JED / SV726 22SEP26 JED-ISB', seats: 24, dates: '08 Sep 2026 – 22 Sep 2026' },
      { id: 3, route: 'SV723 15SEP26 ISB-JED / SV726 29SEP26 JED-ISB', seats: 25, dates: '15 Sep 2026 – 29 Sep 2026' },
      { id: 4, route: 'SV723 22SEP26 ISB-JED / SV726 06OCT26 JED-ISB', seats: 19, dates: '22 Sep 2026 – 06 Oct 2026' },
      { id: 5, route: 'SV727 23SEP26 ISB-JED / SV722 07OCT26 JED-ISB', seats: 29, dates: '23 Sep 2026 – 07 Oct 2026' },
      { id: 6, route: 'SV723 26SEP26 ISB-JED / SV726 10OCT26 JED-ISB', seats: 25, dates: '26 Sep 2026 – 10 Oct 2026' },
      { id: 7, route: 'SV723 30SEP26 ISB-JED / SV726 14OCT26 JED-ISB', seats: 23, dates: '30 Sep 2026 – 14 Oct 2026' }
    ],
    flights20: [
      { id: 1, route: 'SV723 06SEP26 ISB-JED / SV726 26SEP26 JED-ISB', seats: 11, dates: '06 Sep 2026 – 26 Sep 2026' },
      { id: 2, route: 'SV723 13SEP26 ISB-JED / SV726 03OCT26 JED-ISB', seats: 25, dates: '13 Sep 2026 – 03 Oct 2026' },
      { id: 3, route: 'SV723 20SEP26 ISB-JED / SV726 10OCT26 JED-ISB', seats: 25, dates: '20 Sep 2026 – 10 Oct 2026' },
      { id: 4, route: 'SV723 24SEP26 ISB-JED / SV726 14OCT26 JED-ISB', seats: 25, dates: '24 Sep 2026 – 14 Oct 2026' },
      { id: 5, route: 'SV723 27SEP26 ISB-JED / SV726 17OCT26 JED-ISB', seats: 25, dates: '27 Sep 2026 – 17 Oct 2026' },
      { id: 6, route: 'SV723 28SEP26 ISB-JED / SV726 18OCT26 JED-ISB', seats: 25, dates: '28 Sep 2026 – 18 Oct 2026' }
    ]
  },

  LAHORE: {
    cityName: 'Lahore',
    airline: 'Saudia Airlines',
    route: 'LHE – JED – LHE',
    inclusions: 'Visa + Full Transport (JED-MAK-MED-MAK-JED) + Hotel Accommodation + Makkah & Madinah Ziarat',
    durations: ['21_DAYS'],
    hotels: [
      {
        id: 1,
        makkah: 'Dar Hassan (Shuttle)',
        madinah: 'Fahama Madina (Shuttle)',
        rates21: { sharing: 256980, quad: 265340, triple: 270660, double: 286620 }
      },
      {
        id: 2,
        makkah: 'Dar Hassan (Shuttle)',
        madinah: 'Safeer Sakni 2 (800m)',
        rates21: { sharing: 260020, quad: 269444, triple: 276132, double: 296044 }
      },
      {
        id: 3,
        makkah: 'Kiswa Towers (4* Star)',
        madinah: 'Safeer Sakni 2 (800m)',
        rates21: { sharing: 270964, quad: 278868, triple: 291940, double: 319300 }
      },
      {
        id: 4,
        makkah: 'Kiswa Towers (4* Star)',
        madinah: 'Safeer Sakni 1 (550m)',
        rates21: { sharing: 278827, quad: 287988, triple: 304100, double: 335716 }
      },
      {
        id: 5,
        makkah: 'Miad Al Majd (800m)',
        madinah: 'Safeer Sakni 2 (800m)',
        rates21: { sharing: 277348, quad: 286164, triple: 301972, double: 334804 }
      },
      {
        id: 6,
        makkah: 'Saif Al Majd (750m)',
        madinah: 'Safeer Sakni 1 (550m)',
        rates21: { sharing: 295588, quad: 310104, triple: 334196, double: 381316 }
      },
      {
        id: 7,
        makkah: 'Masarat Silver (700m)',
        madinah: 'Safeer Sakni 2 (800m)',
        rates21: { sharing: 295588, quad: 310788, triple: 334804, double: 385876 }
      },
      {
        id: 8,
        makkah: 'Badar Al Massa / Similar (600m)',
        madinah: 'Kayan Al Massi / Similar (150m)',
        rates21: { sharing: null, quad: 358516, triple: 397428, double: 474948 }
      },
      {
        id: 9,
        makkah: 'Voco (4* Star)',
        madinah: 'Deyar Hotels / Similar',
        rates21: { sharing: null, quad: 324620, triple: 353246, double: 410500 }
      },
      {
        id: 10,
        makkah: 'Hiba Muhajreen / Similar (250m)',
        madinah: 'Taiba Rose / Similar (150m)',
        rates21: { sharing: null, quad: 365204, triple: 407460, double: 491060 }
      }
    ],
    flights15: [
      { id: 1, route: 'SV 739 LHE-JED / SV 738 JED-LHE', dates: '02 Sep – 16 Sep 2026' },
      { id: 2, route: 'SV 739 LHE-JED / SV 738 JED-LHE', dates: '08 Sep – 22 Sep 2026' },
      { id: 3, route: 'SV 735 LHE-JED / SV 734 JED-LHE', dates: '15 Sep – 29 Sep 2026' },
      { id: 4, route: 'SV 739 LHE-JED / SV 738 JED-LHE', dates: '22 Sep – 06 Oct 2026' },
      { id: 5, route: 'SV 735 LHE-JED / SV 734 JED-LHE', dates: '30 Sep – 14 Oct 2026' }
    ],
    flights21: [
      { id: 1, route: 'SV 739 LHE-JED / SV 738 JED-LHE', dates: '24 Aug – 13 Sep 2026' },
      { id: 2, route: 'SV 739 LHE-JED / SV 738 JED-LHE', dates: '29 Aug – 18 Sep 2026' },
      { id: 3, route: 'SV 735 LHE-JED / SV 734 JED-LHE', dates: '29 Aug – 18 Sep 2026' },
      { id: 4, route: 'SV 739 LHE-JED / SV 738 JED-LHE', dates: '30 Aug – 19 Sep 2026' },
      { id: 5, route: 'SV 739 LHE-JED / SV 738 JED-LHE', dates: '31 Aug – 20 Sep 2026' },
      { id: 6, route: 'SV 739 LHE-JED / SV 738 JED-LHE', dates: '02 Sep – 22 Sep 2026' },
      { id: 7, route: 'SV 735 LHE-JED / SV 734 JED-LHE', dates: '02 Sep – 22 Sep 2026' },
      { id: 8, route: 'SV 735 LHE-JED / SV 734 JED-LHE', dates: '04 Sep – 24 Sep 2026' },
      { id: 9, route: 'SV 739 LHE-JED / SV 738 JED-LHE', dates: '07 Sep – 27 Sep 2026' },
      { id: 10, route: 'SV 739 LHE-JED / SV 738 JED-LHE', dates: '08 Sep – 28 Sep 2026' },
      { id: 11, route: 'SV 735 LHE-JED / SV 734 JED-LHE', dates: '13 Sep – 04 Oct 2026' },
      { id: 12, route: 'SV 739 LHE-JED / SV 738 JED-LHE', dates: '15 Sep – 05 Oct 2026' },
      { id: 13, route: 'SV 739 LHE-JED / SV 738 JED-LHE', dates: '16 Sep – 06 Oct 2026' },
      { id: 14, route: 'SV 739 LHE-JED / SV 738 JED-LHE', dates: '18 Sep – 08 Oct 2026' },
      { id: 15, route: 'SV 735 LHE-JED / SV 734 JED-LHE', dates: '18 Sep – 08 Oct 2026' }
    ]
  },

  MULTAN: {
    cityName: 'Multan',
    airline: 'Saudia Airlines',
    route: 'MUX – JED – MUX',
    inclusions: 'Visa + Full Transport (JED-MAK-MED-MAK-JED) + Hotel Accommodation + Makkah & Madinah Ziarat',
    durations: ['21_DAYS'],
    hotels: [
      {
        id: 1,
        makkah: 'Dar Hassan (Shuttle)',
        madinah: 'Fahama Madina (Shuttle)',
        rates21: { sharing: 256980, quad: 265340, triple: 270660, double: 286620 }
      },
      {
        id: 2,
        makkah: 'Dar Hassan (Shuttle)',
        madinah: 'Safeer Sakni 2 (800m)',
        rates21: { sharing: 260020, quad: 269444, triple: 276132, double: 296044 }
      },
      {
        id: 3,
        makkah: 'Kiswa Towers (4* Star)',
        madinah: 'Safeer Sakni 2 (800m)',
        rates21: { sharing: 270964, quad: 278868, triple: 291940, double: 319300 }
      },
      {
        id: 4,
        makkah: 'Kiswa Towers (4* Star)',
        madinah: 'Safeer Sakni 1 (550m)',
        rates21: { sharing: 278827, quad: 287988, triple: 304100, double: 335716 }
      },
      {
        id: 5,
        makkah: 'Miad Al Majd (800m)',
        madinah: 'Safeer Sakni 2 (800m)',
        rates21: { sharing: 277348, quad: 286164, triple: 301972, double: 334804 }
      },
      {
        id: 6,
        makkah: 'Saif Al Majd (750m)',
        madinah: 'Safeer Sakni 1 (550m)',
        rates21: { sharing: 295588, quad: 310104, triple: 334196, double: 381316 }
      },
      {
        id: 7,
        makkah: 'Masarat Silver (700m)',
        madinah: 'Safeer Sakni 2 (800m)',
        rates21: { sharing: 295588, quad: 310788, triple: 334804, double: 385876 }
      }
    ],
    flights15: [
      { id: 1, route: 'SV 801 MUX-JED / SV 800 JED-MUX', dates: '03 Sep – 17 Sep 2026' },
      { id: 2, route: 'SV 801 MUX-JED / SV 800 JED-MUX', dates: '06 Sep – 20 Sep 2026' }
    ],
    flights21: [
      { id: 1, route: 'SV 801 MUX-JED / SV 800 JED-MUX', dates: '03 Sep – 23 Sep 2026' },
      { id: 2, route: 'SV 801 MUX-JED / SV 800 JED-MUX', dates: '06 Sep – 26 Sep 2026' }
    ]
  },

  KARACHI: {
    cityName: 'Karachi',
    airline: 'Pakistan International Airlines (PIA)',
    route: 'KHI – JED / MED – KHI',
    inclusions: 'Visa + Full Transport (JED-MAK-MED-MAK-JED) + Hotel Accommodation + Makkah & Madinah Ziarat',
    durations: ['21_DAYS'],
    infantRate: 70000,
    childWithoutBedRate: 185000,
    hotels: [
      {
        id: 1,
        makkah: 'Dar Hassan (Shuttle)',
        madinah: 'Al Diyafah Towers (Shuttle)',
        rates21: { sharing: 223299, quad: 230999, triple: 240855, double: 261183 }
      },
      {
        id: 2,
        makkah: 'Dar Hassan (Shuttle)',
        madinah: 'Safeer Sakni 2 (800m)',
        rates21: { sharing: 225147, quad: 232231, triple: 242703, double: 265495 }
      },
      {
        id: 3,
        makkah: 'Kiswa Towers (4* Star)',
        madinah: 'Safeer Sakni 2 (800m)',
        rates21: { sharing: 232539, quad: 240547, triple: 253791, double: 282127 }
      },
      {
        id: 4,
        makkah: 'Kiswa Towers (4* Star)',
        madinah: 'Safeer Sakni 1 (550m)',
        rates21: { sharing: 239315, quad: 249171, triple: 265495, double: 297527 }
      },
      {
        id: 5,
        makkah: 'Miad Al Majd (800m)',
        madinah: 'Safeer Sakni 2 (800m)',
        rates21: { sharing: 239007, quad: 247939, triple: 263955, double: 297835 }
      },
      {
        id: 6,
        makkah: 'Saif Al Majd (750m)',
        madinah: 'Safeer Sakni 2 (550m)',
        rates21: { sharing: 250095, quad: 263647, triple: 284283, double: 328327 }
      },
      {
        id: 7,
        makkah: 'Saif Al Majd (750m)',
        madinah: 'Safeer Sakni 1 (550m)',
        rates21: { sharing: 256871, quad: 272271, triple: 295987, double: 343272 }
      }
    ],
    flights15: [
      { id: 1, route: 'KHI JED KHI', dates: '01 Sep – 15 Sep 2026' },
      { id: 2, route: 'KHI JED KHI', dates: '03 Sep – 17 Sep 2026' },
      { id: 3, route: 'KHI JED KHI', dates: '10 Sep – 24 Sep 2026' },
      { id: 4, route: 'KHI JED KHI', dates: '15 Sep – 29 Sep 2026' },
      { id: 5, route: 'KHI MED KHI', dates: '21 Sep – 05 Oct 2026' },
      { id: 6, route: 'KHI JED KHI', dates: '24 Sep – 08 Oct 2026' },
      { id: 7, route: 'KHI JED KHI', dates: '30 Sep – 14 Oct 2026' }
    ],
    flights21: [
      { id: 1, route: 'KHI JED KHI', dates: '01 Sep – 21 Sep 2026' },
      { id: 2, route: 'KHI JED KHI', dates: '03 Sep – 23 Sep 2026' },
      { id: 3, route: 'KHI JED KHI', dates: '10 Sep – 30 Sep 2026' },
      { id: 4, route: 'KHI JED KHI', dates: '13 Sep – 03 Oct 2026' },
      { id: 5, route: 'KHI JED KHI', dates: '15 Sep – 05 Oct 2026' },
      { id: 6, route: 'KHI JED KHI', dates: '17 Sep – 07 Oct 2026' },
      { id: 7, route: 'KHI JED KHI', dates: '20 Sep – 10 Oct 2026' },
      { id: 8, route: 'KHI MED KHI', dates: '21 Sep – 11 Oct 2026' },
      { id: 9, route: 'KHI JED KHI', dates: '23 Sep – 13 Oct 2026' },
      { id: 10, route: 'KHI JED KHI', dates: '24 Sep – 14 Oct 2026' },
      { id: 11, route: 'KHI MED KHI', dates: '28 Sep – 18 Oct 2026' },
      { id: 12, route: 'KHI JED KHI', dates: '29 Sep – 19 Oct 2026' },
      { id: 13, route: 'KHI JED KHI', dates: '30 Sep – 20 Oct 2026' }
    ]
  },

  PESHAWAR: {
    cityName: 'Peshawar',
    airline: 'Saudia Airlines / Connecting',
    route: 'PEW – JED – PEW',
    inclusions: 'Visa + Full Transport (JED-MAK-MED-MAK-JED) + Hotel Accommodation + Makkah & Madinah Ziarat',
    durations: ['15_DAYS', '20_DAYS'],
    hotels: [],
    flights15: [
      { id: 1, route: 'PEW-JED / JED-PEW', dates: '02 Sep – 16 Sep 2026' },
      { id: 2, route: 'PEW-JED / JED-PEW', dates: '08 Sep – 22 Sep 2026' },
      { id: 3, route: 'PEW-JED / JED-PEW', dates: '15 Sep – 29 Sep 2026' },
      { id: 4, route: 'PEW-JED / JED-PEW', dates: '22 Sep – 06 Oct 2026' },
      { id: 5, route: 'PEW-JED / JED-PEW', dates: '26 Sep – 10 Oct 2026' }
    ],
    flights20: [
      { id: 1, route: 'PEW-JED / JED-PEW', dates: '06 Sep – 26 Sep 2026' },
      { id: 2, route: 'PEW-JED / JED-PEW', dates: '13 Sep – 03 Oct 2026' },
      { id: 3, route: 'PEW-JED / JED-PEW', dates: '20 Sep – 10 Oct 2026' },
      { id: 4, route: 'PEW-JED / JED-PEW', dates: '27 Sep – 17 Oct 2026' }
    ]
  }
};

module.exports = {
  TICKET_RATES_BY_CITY,
  FIXED_PACKAGES
};
