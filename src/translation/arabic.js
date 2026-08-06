// ============================================================
//  translation/arabic.js — MyMemory free translation API
//  Translates English names → Arabic
//  Free tier: 1000 requests/day (no API key needed)
// ============================================================

const axios = require('axios');

/**
 * Translates English text to Arabic using MyMemory free API.
 * Returns the translated string, or the original if translation fails.
 */
async function translateToArabic(text) {
  if (!text || text === 'Not detected') return text;

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|ar`;
    const response = await axios.get(url, { timeout: 8000 });

    const data = response.data;
    if (
      data &&
      data.responseStatus === 200 &&
      data.responseData &&
      data.responseData.translatedText
    ) {
      return data.responseData.translatedText;
    }
    return text;
  } catch (err) {
    console.error('[Translation] Error:', err.message);
    return text; // graceful fallback
  }
}

/**
 * Translates both first and last name to Arabic.
 * Returns { firstNameAr, lastNameAr }
 */
async function translateNames(firstName, lastName) {
  const [firstNameAr, lastNameAr] = await Promise.all([
    translateToArabic(firstName),
    translateToArabic(lastName),
  ]);
  return { firstNameAr, lastNameAr };
}

module.exports = { translateToArabic, translateNames };
