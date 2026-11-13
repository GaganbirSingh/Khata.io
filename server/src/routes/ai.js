const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const Customer = require('../models/Customer');
const { validate } = require('../middleware/validate');
const { parseLocal } = require('../services/ai/localParser');
const gemini = require('../services/ai/gemini');
const { matchCustomer } = require('../utils/names');
const { applySpotPayment } = require('../utils/khata');
const { TEMPLATES, fillTemplate, whatsappLink, getOrCreatePaymentRequest, payUrl } = require('../services/reminders');

const router = express.Router();

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: config.isTest ? 1000 : 20,
  keyGenerator: (req) => req.user._id.toString(),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a minute.' },
});

// Photos stay in memory only and are dropped after the request.
const upload = multer({
  storage: multer.memoryStorage(),
  // 4 MB: under Vercel's 4.5 MB request limit. The browser shrinks photos first.
  limits: { fileSize: 4 * 1024 * 1024, files: 1, fields: 5 },
});

function sniffImage(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

function describeMatch(name, customers) {
  if (!name) return { id: null, name: null, isNew: false, candidates: [] };
  const { match, candidates } = matchCustomer(name, customers);
  if (match) return { id: match._id.toString(), name: match.name, balance: match.balancePaise / 100, isNew: false, candidates: [] };
  return {
    id: null,
    name,
    isNew: candidates.length === 0,
    candidates: candidates.map((c) => ({ id: c._id.toString(), name: c.name, balance: c.balancePaise / 100 })),
  };
}

function cleanEntries(list) {
  return list
    .filter((e) => e && ['udhaar', 'jama'].includes(e.type) && Number(e.amount) > 0 && Number(e.amount) <= 100000)
    .slice(0, 10)
    .map((e) => ({
      type: e.type,
      amount: Math.round(Number(e.amount) * 100) / 100,
      items: String(e.items || '').trim().slice(0, 120),
      sure: e.sure !== false,
    }));
}

router.get('/status', (req, res) => {
  res.json({ enabled: config.ai.enabled, tier: config.gemini.tier });
});

router.post('/parse', aiLimiter, validate(z.object({ text: z.string().trim().min(1, 'Type or say an entry').max(500) })), async (req, res) => {
  const customers = await Customer.find({ shop: req.user._id }, { name: 1, nameKey: 1, balancePaise: 1 });
  const local = parseLocal(req.valid.text);
  let engine = 'local';
  let customerName = local.customerName;
  let entries = cleanEntries(local.entries);
  let customer = describeMatch(customerName, customers);
  let note = null;

  const localConfident = !local.needsCheck && entries.length > 0 && (customer.id || customer.isNew);
  if (!localConfident && config.ai.enabled) {
    try {
      const ai = await gemini.parseText(req.valid.text, customers);
      const aiEntries = cleanEntries(ai.entries);
      if (aiEntries.length > 0) {
        engine = 'gemini';
        entries = aiEntries;
        customerName = ai.customerName || customerName;
        customer = ai.matchedCustomer
          ? { id: ai.matchedCustomer._id.toString(), name: ai.matchedCustomer.name, balance: ai.matchedCustomer.balancePaise / 100, isNew: false, candidates: [] }
          : describeMatch(customerName, customers);
      }
    } catch (err) {
      if (!config.isTest) console.error('Gemini parse failed:', err.status || '', err.message);
      note = 'AI was not available, so a simpler reader was used.';
    }
  }
  if (local.warnings.includes('script_not_supported') && engine === 'local') {
    note = 'Please type in English letters (like "Ramesh ne 250 ka atta liya").';
  }
  // A payment written together with a purchase pays for today's goods first.
  const rawEntries = entries;
  const { entries: split, spot } = applySpotPayment(entries);
  const needsCheck = split.length === 0 || split.some((e) => !e.sure) || !customer.id;
  res.json({ engine, customer, entries: split, rawEntries, spot, needsCheck, note });
});

router.post('/scan', aiLimiter, upload.single('photo'), async (req, res) => {
  if (!config.ai.enabled) {
    return res.status(503).json({ error: 'Khata scanning needs the Gemini API key to be set up.' });
  }
  if (config.gemini.tier === 'free' && req.body?.sampleDataOnly !== 'true') {
    return res.status(400).json({ error: 'Please confirm this page has only sample data, not real customer details.' });
  }
  if (!req.file) return res.status(400).json({ error: 'Choose a photo of your khata page' });
  const mimeType = sniffImage(req.file.buffer);
  if (!mimeType) return res.status(400).json({ error: 'Please upload a JPG, PNG or WEBP photo' });

  let raw;
  try {
    raw = await gemini.scanImage(req.file.buffer, mimeType);
  } catch (err) {
    // Log why (bad key, wrong model name, quota...) but never the photo itself.
    if (!config.isTest) console.error('Gemini scan failed:', err.status || '', err.message);
    return res.status(502).json({ error: 'Could not read the photo right now. Please try again.' });
  } finally {
    req.file.buffer = null; // drop the image as soon as possible
  }
  const customers = await Customer.find({ shop: req.user._id }, { name: 1, nameKey: 1, balancePaise: 1 });
  const entries = raw
    .filter((e) => e && Number(e.amount) > 0 && Number(e.amount) <= 100000 && ['udhaar', 'jama'].includes(e.type))
    .slice(0, 40)
    .map((e, i) => {
      const confidence = Math.max(0, Math.min(1, Number(e.confidence) || 0));
      const customer = describeMatch(String(e.customerName || '').trim().slice(0, 60), customers);
      return {
        line: i + 1,
        customer,
        type: e.type,
        amount: Math.round(Number(e.amount) * 100) / 100,
        items: String(e.items || '').trim().slice(0, 120),
        confidence,
        needsCheck: confidence < 0.8 || !customer.id,
      };
    });
  res.json({ entries });
});

router.post(
  '/reminder',
  aiLimiter,
  validate(
    z.object({
      customerId: z.string().refine((v) => mongoose.isValidObjectId(v), 'Invalid customer'),
      language: z.enum(['hi', 'pa', 'en']),
      tone: z.enum(['polite', 'friendly', 'firm']),
    })
  ),
  async (req, res) => {
    const customer = await Customer.findOne({ _id: req.valid.customerId, shop: req.user._id });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    if (customer.balancePaise <= 0) return res.status(400).json({ error: 'This customer has nothing pending' });

    let template = TEMPLATES[req.valid.language][req.valid.tone];
    let engine = 'template';
    if (config.ai.enabled) {
      try {
        template = await gemini.writeReminderTemplate(req.valid);
        engine = 'gemini';
      } catch {
        engine = 'template';
      }
    }
    const request = await getOrCreatePaymentRequest(req.user._id, customer._id);
    const link = payUrl(request.token);
    const message = fillTemplate(template, {
      name: customer.name.split(' ')[0],
      shop: req.user.shopName.replace(/\s*\(demo\)$/i, ''),
      amountPaise: customer.balancePaise,
      link,
    });
    res.json({ engine, message, payUrl: link, amount: customer.balancePaise / 100 });
  }
);

module.exports = router;
module.exports.whatsappLink = whatsappLink;
