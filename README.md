# 🕌 Hajj & Umrah WhatsApp Chatbot

A fully automated WhatsApp chatbot for Hajj & Umrah visa and transport services built with `whatsapp-web.js` and Node.js.  
**No Twilio. No paid API keys. Just scan a QR code and go!**

---

## 🚀 How It Works

```
You run: npm start (or node src/index.js)
      ↓
A QR code appears in the terminal
      ↓
Scan it with WhatsApp on your phone
      ↓
Bot is LIVE on your number!
```

---

## ✨ Features

- **Visa Queries** — Long Stay (80 days) and 30-day packages (with/without transport)
- **Pakistani Airline Surcharge Detection** — Auto-applies +90 SAR surcharge for Pakistani airlines / Hajj terminals
- **Passport OCR** — Extracts 5 fields from passport MRZ images locally via `Tesseract.js` & `sharp`
- **Arabic Name Translation** — Translates First & Last name to Arabic via free MyMemory API
- **Transport Rate Lookup** — Dynamic lookup across 9 routes × 6 vehicle types
- **SQLite Session Persistence** — Saves user state in `database.sqlite` so state survives bot restarts
- **Payment & Escalation** — Displays bank payment details and redirects to live helpline/ticketing support when requested

---

## 🛠️ Setup & Running

### Step 1 — Install Dependencies

```bash
npm install
```

### Step 2 — Start the Bot

```bash
npm start
```

### Step 3 — Scan the QR Code

1. A QR code will render directly in your terminal.
2. Open WhatsApp on your phone → **Settings → Linked Devices → Link a Device**.
3. Scan the QR code.
4. Your session is authenticated! ✅

> **Note:** Your authenticated session is saved locally in `.wwebjs_auth/`. Subsequent restarts will automatically log in without re-scanning.

---

## 📱 WhatsApp Contacts

| Purpose | Contact Number |
|---|---|
| Bot Instance | +923125764118 |
| Helpline & Ticketing | +923180978480 |

---

## 🔄 Conversation Flow

```
Hi / Hello / Menu
  ├── 1. Visa Query
  │     ├── 1. Long Stay (80 days) — 650 SAR
  │     │       → YES → Send passport photo → OCR → Arabic translation
  │     │              → Confirm details → Payment info → Done ✅
  │     ├── 2. Visa WITH Transport (30 days)
  │     │       → Select passengers → Confirm rate → Passport → ...
  │     └── 3. Visa WITHOUT Transport (30 days) — 550 SAR
  │             → Enter airline → Pakistani? (+90 SAR)
  │             → Add 1st leg transport? → Confirm → Passport → ...
  │
  ├── 2. Transport Rates
  │     → Select route → Select vehicle → See price
  │
  ├── 3. Flight Ticket → Redirect to +923180978480
  │
  └── 4. Other Query → Redirect to +923180978480
```

---

## 📁 Project Structure

```
Eyries-chatbot/
├── passport_ocr_master.py   # Gemini 2.0 Flash OCR, SQLite staging, Arabic translation & Excel exporter
├── passports.db              # SQLite database for pending & confirmed passport records
├── Master_Passports.xlsx     # Styled Master Excel spreadsheet with Arabic names
├── sessions.json             # Persistent WhatsApp user conversation states
├── src/
│   ├── index.js              # Entry point: WhatsApp client initialization & high-res QR generator
│   ├── router.js             # Incoming message router
│   ├── db.js                 # Session storage manager
│   ├── stateManager.js       # Per-user conversation state manager
│   ├── config.js             # Visa rates, transport rate card, bank info
│   ├── flows/
│   │   ├── visaFlow.js       # Visa interactive conversation engine
│   │   └── transportFlow.js  # Transport rate calculator
│   ├── ocr/
│   │   ├── passport.js       # Passport OCR interface calling pythonBridge
│   │   └── pythonBridge.js   # Asynchronous bridge executing passport_ocr_master.py
│   └── utils/
│       └── messageBuilder.js # Formatted WhatsApp message templates
├── .env                      # API keys and environment variables
└── README.md                 # Project documentation
```

---

## 📌 Usage Notes

- Type **MENU** at any time to reset your state and return to the main menu.
- Sessions automatically expire after **30 minutes** of inactivity.
- The bot responds to **individual chats** only (group messages are filtered).
- OCR works best with clear, un-cropped, well-lit passport images.

---

## 🌐 Repository

GitHub Repository: [https://github.com/umerr101/Eyries-chatbot](https://github.com/umerr101/Eyries-chatbot)
