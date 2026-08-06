# 🕌 Hajj & Umrah WhatsApp Chatbot

A fully automated WhatsApp chatbot for Hajj & Umrah visa and transport services.  
**No Twilio. No API keys. Just scan a QR code and go!**

---

## How It Works

```
You run: node src/index.js
      ↓
A QR code appears in the terminal
      ↓
Scan it with WhatsApp on your phone
      ↓
Bot is LIVE on your number (+923125764118)!
```

---

## Features

- **Visa Queries** — Long Stay (80 days) and 30-day packages (with/without transport)
- **Pakistani airline detection** — Auto-applies +90 SAR surcharge
- **Passport OCR** — Extracts 5 fields from passport image (Tesseract.js, runs locally)
- **Arabic Name Translation** — Translates First & Last name to Arabic (free MyMemory API)
- **Transport Rate Lookup** — All 9 routes × 6 vehicle types
- **Payment Flow** — Displays bank details after passport confirmation
- **Escalation** — Ticketing and helpline WhatsApp numbers (+923180978480) displayed when needed

---

## Setup (3 Steps)

### Step 1 — Install Dependencies (already done ✅)

```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')
& "C:\Program Files\nodejs\npm.cmd" install
```

### Step 2 — Start the Bot

```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')
& "C:\Program Files\nodejs\node.exe" "c:\Users\khali\OneDrive\Desktop\chatbot\src\index.js"
```

### Step 3 — Scan the QR Code

1. A QR code will appear in the terminal
2. Open WhatsApp on your phone
3. Go to **Settings → Linked Devices → Link a Device**
4. Scan the QR code
5. Bot is live! ✅

> **Note:** After the first scan, your session is saved in `.wwebjs_auth/`. You won't need to scan again on restart.

---

## WhatsApp Numbers

| Purpose | Number |
|---|---|
| Bot runs on | +923125764118 |
| Helpline & Ticketing | +923180978480 |

---

## Conversation Flow

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

## Project Structure

```
chatbot/
├── src/
│   ├── index.js              # WhatsApp client + QR auth
│   ├── router.js             # Message router
│   ├── stateManager.js       # Per-user conversation state
│   ├── config.js             # Rates, routes, contacts, payment
│   ├── flows/
│   │   ├── visaFlow.js       # Visa conversation flow
│   │   └── transportFlow.js  # Transport rate lookup
│   ├── ocr/
│   │   └── passport.js       # Tesseract.js OCR
│   ├── translation/
│   │   └── arabic.js         # Arabic name translation
│   └── utils/
│       └── messageBuilder.js # WhatsApp message templates
├── .wwebjs_auth/             # Saved WhatsApp session (auto-created)
├── .env                      # Business config
└── README.md
```

---

## Notes

- Type **MENU** at any time to restart the conversation
- Sessions expire after **30 minutes** of inactivity
- The bot only responds to **individual chats**, not groups
- OCR works best with **clear, well-lit, flat passport images**
- Arabic translation uses **MyMemory API** (free, 1000 requests/day)

---

## Going Live (Production)

When ready for production, simply:
1. Run the bot on any always-on PC or cheap VPS (e.g. DigitalOcean $4/month)
2. Keep the process alive with `pm2` (`npm install -g pm2` → `pm2 start src/index.js`)
3. For a **dedicated business number**, register a WhatsApp Business account on a separate SIM
