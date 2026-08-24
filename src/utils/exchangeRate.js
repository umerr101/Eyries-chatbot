// ============================================================
//  utils/exchangeRate.js — Live SAR to PKR Exchange Rate Utility
// ============================================================

const https = require('https');

let cachedData = null;
let lastFetchTime = 0;
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour cache

/**
 * Fetches live SAR to PKR rate from open.er-api.com API.
 * Falls back to 74.5 PKR if network fails.
 */
async function fetchLiveSarToPkrRate() {
  const now = Date.now();
  if (cachedData && (now - lastFetchTime < CACHE_DURATION_MS)) {
    return cachedData;
  }

  return new Promise((resolve) => {
    const url = 'https://open.er-api.com/v6/latest/SAR';

    const req = https.get(url, { timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json && json.rates && json.rates.PKR) {
            const liveRate = parseFloat(json.rates.PKR);
            cachedData = liveRate;
            lastFetchTime = Date.now();
            console.log(`[ExchangeRate] Fetched live SAR to PKR rate: ${liveRate}`);
            return resolve(liveRate);
          }
        } catch (e) {
          console.error('[ExchangeRate] JSON parse error:', e.message);
        }
        resolve(cachedData || 74.5);
      });
    });

    req.on('error', (err) => {
      console.error('[ExchangeRate] HTTP error:', err.message);
      resolve(cachedData || 74.5);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(cachedData || 74.5);
    });
  });
}

/**
 * Calculates effective SAR to PKR rate by adding +1.5 PKR margin.
 * Returns { liveRate, margin: 1.5, effectiveRate, convertToPkr(sarAmount) }
 */
async function getEffectiveExchangeRate() {
  const liveRate = await fetchLiveSarToPkrRate();
  const margin = 1.5;
  const effectiveRate = parseFloat((liveRate + margin).toFixed(2));

  return {
    liveRate: parseFloat(liveRate.toFixed(2)),
    margin: 1.5,
    effectiveRate: effectiveRate,
    convertToPkr: (sarAmount) => Math.round(sarAmount * effectiveRate)
  };
}

module.exports = {
  fetchLiveSarToPkrRate,
  getEffectiveExchangeRate
};
