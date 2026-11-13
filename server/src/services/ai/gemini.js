// Gemini integration. Privacy rules applied here:
//  - Text entries are parsed locally first; Gemini is only asked when the
//    local parser is unsure.
//  - Known customer names are replaced with placeholders before sending.
//  - Reminder messages are written with placeholders ({NAME}, {AMOUNT}...)
//    so no customer data is sent at all; real values are filled in here.
//  - Uploaded khata photos are sent once and never stored by this app.
const config = require('../../config');

let clientFactory = () => {
  const { GoogleGenAI } = require('@google/genai');
  return new GoogleGenAI({ apiKey: config.gemini.apiKey });
};
let client = null;

function setClientFactory(factory) {
  clientFactory = factory;
  client = null;
}

function getClient() {
  if (!config.gemini.apiKey) return null;
  if (!client) client = clientFactory();
  return client;
}

async function generateJson({ parts, schema, system }) {
  const ai = getClient();
  if (!ai) {
    const err = new Error('AI is not configured');
    err.code = 'AI_DISABLED';
    throw err;
  }
  const response = await ai.models.generateContent({
    model: config.gemini.model,
    contents: [{ role: 'user', parts }],
    config: {
      systemInstruction: system,
      responseMimeType: 'application/json',
      responseJsonSchema: schema,
      temperature: 0.1,
      httpOptions: { timeout: config.gemini.timeoutMs },
    },
  });
  const text = typeof response.text === 'function' ? response.text() : response.text;
  try {
    return JSON.parse(text || '');
  } catch {
    const err = new Error('AI returned an unreadable answer');
    err.code = 'AI_BAD_OUTPUT';
    throw err;
  }
}

const ENTRY_RULES =
  'Definitions: "udhaar" means the customer took goods or money on credit (they now owe more). ' +
  '"jama" means the customer paid money back (they owe less). Amounts are Indian rupees. ' +
  'Never invent entries or amounts that are not written. If anything is unclear, set sure=false.';

const PARSE_SCHEMA = {
  type: 'object',
  properties: {
    customerName: { type: 'string', description: 'Empty string if no name is given' },
    entries: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['udhaar', 'jama'] },
          amount: { type: 'number' },
          items: { type: 'string' },
          sure: { type: 'boolean' },
        },
        required: ['type', 'amount', 'items', 'sure'],
      },
    },
  },
  required: ['customerName', 'entries'],
};

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Replaces known customer names with CUSTOMER_1, CUSTOMER_2...
function pseudonymise(text, customers) {
  const map = new Map();
  let out = text;
  const names = [];
  customers.forEach((c) => {
    names.push({ name: c.name, id: c });
    const first = c.name.split(' ')[0];
    if (first.length >= 3 && first !== c.name) names.push({ name: first, id: c });
  });
  names.sort((a, b) => b.name.length - a.name.length);
  for (const { name, id } of names) {
    const re = new RegExp(`(^|[^\\p{L}])(${escapeRegExp(name)})(?=[^\\p{L}]|$)`, 'giu');
    if (re.test(out)) {
      let token = [...map.entries()].find(([, v]) => v === id)?.[0];
      if (!token) {
        token = `CUSTOMER_${map.size + 1}`;
        map.set(token, id);
      }
      out = out.replace(re, `$1${token}`);
    }
  }
  return { text: out, map };
}

async function parseText(text, customers) {
  const { text: safeText, map } = pseudonymise(text, customers);
  const data = await generateJson({
    system:
      'You turn a shopkeeper\'s short note (Hinglish, Hindi, Punjabi or English) into khata entries. ' +
      ENTRY_RULES +
      ' Customer names may appear as placeholders like CUSTOMER_1; return the placeholder unchanged as customerName.',
    parts: [{ text: safeText.slice(0, 500) }],
    schema: PARSE_SCHEMA,
  });
  let matchedCustomer = null;
  let customerName = typeof data.customerName === 'string' ? data.customerName.trim().slice(0, 60) : null;
  if (customerName && map.has(customerName)) {
    matchedCustomer = map.get(customerName);
    customerName = matchedCustomer.name;
  }
  return { customerName, matchedCustomer, entries: Array.isArray(data.entries) ? data.entries : [] };
}

const SCAN_SCHEMA = {
  type: 'object',
  properties: {
    entries: {
      type: 'array',
      maxItems: 40,
      items: {
        type: 'object',
        properties: {
          customerName: { type: 'string' },
          items: { type: 'string' },
          amount: { type: 'number' },
          type: { type: 'string', enum: ['udhaar', 'jama'] },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
        required: ['customerName', 'items', 'amount', 'type', 'confidence'],
      },
    },
  },
  required: ['entries'],
};

async function scanImage(buffer, mimeType) {
  const data = await generateJson({
    system:
      'You read a photo of a handwritten Indian shop credit notebook (bahi khata). ' +
      'Return one entry per written line that has a customer name and an amount. ' +
      ENTRY_RULES +
      ' Treat a line as jama only if it clearly shows a payment (words like jama, mila, paid, or a minus sign). ' +
      'Skip headings, dates-only lines and page totals. confidence is how sure you are about the name and amount (0 to 1). ' +
      'If the image is not a khata page, return an empty list.',
    parts: [
      { text: 'Read the entries on this khata page.' },
      { inlineData: { mimeType, data: buffer.toString('base64') } },
    ],
    schema: SCAN_SCHEMA,
  });
  return Array.isArray(data.entries) ? data.entries : [];
}

const LANGUAGE_NAMES = {
  hi: 'Hinglish (Hindi written in English letters)',
  pa: 'Punjabi written in English letters',
  en: 'simple English',
};

const PLACEHOLDERS = ['{NAME}', '{SHOP}', '{AMOUNT}', '{LINK}'];

async function writeReminderTemplate({ language, tone }) {
  const data = await generateJson({
    system:
      'You write short WhatsApp payment reminders for small Indian shops. ' +
      'Use exactly these placeholders once each: {NAME} (customer), {SHOP} (shop), {AMOUNT} (amount due), {LINK} (payment link). ' +
      'Rules: be respectful; never threaten, shame, mention legal action, police, penalties, interest or late fees; ' +
      'never pretend to be a bank or government; under 350 characters; no emojis.',
    parts: [{ text: `Language: ${LANGUAGE_NAMES[language]}. Tone: ${tone}.` }],
    schema: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] },
  });
  const message = String(data.message || '').trim();
  const valid =
    message.length > 0 &&
    message.length <= 400 &&
    PLACEHOLDERS.every((p) => message.split(p).length === 2) &&
    !/\{(?!NAME\}|SHOP\}|AMOUNT\}|LINK\})[^}]*\}/.test(message) &&
    !/(police|court|legal|lawyer|fine|penalty|interest|case|FIR|jail|kanooni)/i.test(message);
  if (!valid) {
    const err = new Error('AI reminder failed safety checks');
    err.code = 'AI_BAD_OUTPUT';
    throw err;
  }
  return message;
}

module.exports = { parseText, scanImage, writeReminderTemplate, pseudonymise, setClientFactory, PLACEHOLDERS };
