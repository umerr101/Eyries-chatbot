// ============================================================
//  configLoader.js — Multi-Client SaaS Configuration Loader
// ============================================================

const fs   = require('fs');
const path = require('path');

const CLIENTS_DIR = path.join(__dirname, '..', 'clients');

/**
 * Loads client configuration JSON file dynamically based on CLIENT_ID.
 * Defaults to 'default' if not specified.
 */
function loadClientConfig(clientId = null) {
  const targetId = clientId || process.env.CLIENT_ID || 'default';
  const filePath = path.join(CLIENTS_DIR, `${targetId}.json`);

  if (!fs.existsSync(filePath)) {
    console.warn(`[ConfigLoader] Client config file '${targetId}.json' not found. Falling back to 'default.json'.`);
    const fallbackPath = path.join(CLIENTS_DIR, 'default.json');
    if (!fs.existsSync(fallbackPath)) {
      throw new Error(`[ConfigLoader] Default client configuration file missing at: ${fallbackPath}`);
    }
    const raw = fs.readFileSync(fallbackPath, 'utf8');
    return JSON.parse(raw);
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const config = JSON.parse(raw);
    console.log(`[ConfigLoader] Successfully loaded client config for: ${config.agencyName} (${config.clientId})`);
    return config;
  } catch (err) {
    console.error(`[ConfigLoader] Error parsing '${targetId}.json':`, err.message);
    throw err;
  }
}

module.exports = {
  loadClientConfig
};
