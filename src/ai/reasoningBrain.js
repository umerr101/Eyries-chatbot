// ============================================================
//  src/ai/reasoningBrain.js — LLM Reasoning Engine (Google Gemini)
//  Natural language Q&A, business policy reasoning, & intent parsing
// ============================================================

const axios  = require('axios');
const config = require('../config');

const API_KEY = process.env.GEMINI_API_KEY;

// Candidate Gemini model endpoints
const CANDIDATE_MODELS = [
  'gemini-3.6-flash',
  'gemini-flash-latest'
];

/**
 * Builds dynamic system instructions including multi-tenant agency brand context & rules.
 */
function getSystemInstruction(clientConfig) {
  const agencyName = clientConfig?.agencyName || 'Eyries Holidays';
  const helpline   = clientConfig?.contacts?.helpline || '+923180978480';
  const bankTitle  = clientConfig?.bank?.accountTitle || 'Eyries Holidays';
  const branch     = clientConfig?.bank?.branch || 'Head Office, Islamabad';

  return `
You are the AI Travel Assistant & Co-Pilot for "${agencyName}", a premier Hajj & Umrah travel agency based in Pakistan.
Your primary role is to assist pilgrims with empathy, high accuracy, and deep knowledge of Hajj & Umrah travel services.

KEY KNOWLEDGE BASE & BUSINESS RULES:
1. Agency Brand: "${agencyName}" | Helpline: ${helpline} | Bank Account: "${bankTitle}" (${branch}).
2. Pakistani Airline Surcharge (+90 SAR): Flights with Pakistani airlines (PIA, Airblue, Serene Air, Air Sial, Fly Jinnah) arrive at Jeddah Hajj Terminal and incur an additional +90 SAR per person surcharge.
3. Passport Validity Rule: All passports MUST have at least 6 months (180 days) validity remaining from the travel date. If less, inform the user they must renew their passport first.
4. Transport Vehicles:
   • Sedan: 4 seats
   • GMC / SUV: 7 seats
   • HiAce / Van: 10–14 seats
   • Coaster / Bus: 30–47 seats
5. Visa Processing Time: 1–2 business days after payment confirmation. Passports are verified and sent forward for official processing.
6. Multilingual Requirement: Respond in the EXACT language used by the customer (Roman Urdu, Urdu script, English, or Arabic).

RESPONSE STYLE:
- Warm, polite, respectful, and professional. Use appropriate emojis (🌙, 🕋, 🕌, ✈️, 🚗, 📄).
- Format responses cleanly for WhatsApp using *bold*, _italic_, and bullet points.
- Always include a helpful Call to Action at the end (e.g. "Reply *YES* to proceed or *MENU* to view options").
`;
}

/**
 * 1. Generates natural language reasoning reply for customer queries.
 */
async function generateReasoningReply(userMessage, conversationHistory = [], userSession = {}, clientConfig = null) {
  const agencyName = clientConfig?.agencyName || 'Eyries Holidays';

  // 1. Call Python google-genai SDK (Fast & Reliable)
  try {
    const { runAIReasoningWithGemini } = require('../ocr/pythonBridge');
    const pyReply = await runAIReasoningWithGemini(userMessage, userSession, agencyName);
    if (pyReply && pyReply.trim()) {
      return pyReply.trim();
    }
  } catch (pyErr) {
    console.warn('[ReasoningBrain PythonBridge Warning]:', pyErr.message);
  }

  // 2. Direct REST Fallback
  if (!API_KEY) return null;
  const systemInstruction = getSystemInstruction(clientConfig || config);
  const promptText = `
[SYSTEM CONTEXT & KNOWLEDGE]
${systemInstruction}

[USER SESSION CONTEXT]
- Current Flow: ${userSession.flow || 'MAIN_MENU'}
- Current Step: ${userSession.step || 'START'}

[INCOMING CUSTOMER MESSAGE]
"${userMessage}"

Generate a helpful, accurate, and concise WhatsApp reply.
`;

  for (const model of CANDIDATE_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
      const payload = {
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 800 }
      };
      const res = await axios.post(url, payload, { timeout: 10000 });
      const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text && text.trim()) return text.trim();
    } catch (_) {
      continue;
    }
  }

  return null;
}

/**
 * 2. Parses unstructured natural language into structured JSON intent.
 */
async function parseUserIntent(userMessage) {
  if (!API_KEY) return null;

  const promptText = `
Analyze the customer's message and extract structured intent & booking details as JSON:
User Message: "${userMessage}"

Return ONLY valid JSON matching this schema:
{
  "intent": "VISA_INQUIRY" | "HOTEL_INQUIRY" | "TRANSPORT_INQUIRY" | "PACKAGE_INQUIRY" | "GENERAL_FAQ" | "HUMAN_ESCALATION",
  "passengerCount": number or null,
  "airline": string or null,
  "makkahNights": number or null,
  "madinahNights": number or null,
  "hotelStarRating": 3 | 4 | 5 | null,
  "language": "EN" | "URDU" | "ROMAN_URDU" | "AR"
}
`;

  for (const model of CANDIDATE_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
      const payload = {
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          temperature: 0.0
        }
      };

      const res = await axios.post(url, payload, { timeout: 6000 });
      const rawText = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      return JSON.parse(cleanJson);
    } catch (_) {
      continue;
    }
  }

  return null;
}

module.exports = {
  generateReasoningReply,
  parseUserIntent
};
