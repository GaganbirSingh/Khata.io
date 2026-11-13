const express = require('express');
const config = require('../config');
const { TERMS_VERSION, PRIVACY_VERSION } = require('../legal');

const router = express.Router();

// Public facts the website shows on its legal pages and feature notices.
router.get('/', (req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json({
    ai: { enabled: config.ai.enabled, tier: config.gemini.tier },
    payments: { mode: config.payments.mode },
    retentionDays: config.retentionDays,
    demoHours: config.demoHours,
    legal: { ...config.legal, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION },
  });
});

module.exports = router;
