const Database = require('better-sqlite3');
const path = require('path');

// Initialize database in the project root
const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new Database(dbPath);

// Create the sessions table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    phone TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    last_activity INTEGER NOT NULL
  )
`);

module.exports = db;
