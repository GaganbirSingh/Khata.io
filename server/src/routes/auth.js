const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const User = require('../models/User');
const { validate } = require('../middleware/validate');
const { setSession, clearSession, requireAuth } = require('../middleware/auth');
const { seedDemoShop } = require('../services/demoSeed');
const { deleteShopData } = require('../services/accountData');
const { TERMS_VERSION, PRIVACY_VERSION } = require('../legal');

const router = express.Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: config.isTest ? 1000 : 20, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many attempts. Please wait a few minutes.' } });
// A real hash of a random string, so a login for an unknown email takes as long as a real one.
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 12);

const email = z.string().trim().toLowerCase().email('Enter a valid email').max(254);
const password = z.string().min(8, 'Password must be at least 8 characters').max(128);

const registerSchema = z.object({
  email,
  password,
  shopName: z.string().trim().min(2, 'Enter your shop name').max(80),
  shopType: z.enum(User.SHOP_TYPES).default('kirana'),
  language: z.enum(User.LANGUAGES).default('hi'),
  acceptTerms: z.literal(true, { message: 'Please accept the Terms and Privacy Policy' }),
  ageConfirmed: z.literal(true, { message: 'You must be 18 or older to use this app' }),
});

router.post('/register', limiter, validate(registerSchema), async (req, res) => {
  const { email: mail, password: pw, shopName, shopType, language } = req.valid;
  if (await User.exists({ email: mail })) {
    return res.status(409).json({ error: 'An account with this email already exists', field: 'email' });
  }
  const user = await User.create({
    email: mail,
    passwordHash: await bcrypt.hash(pw, 12),
    shopName,
    shopType,
    language,
    consent: { termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION, ageConfirmed: true, acceptedAt: new Date() },
  });
  setSession(res, user);
  return res.status(201).json({ user: user.toPublic() });
});

router.post('/login', limiter, validate(z.object({ email, password: z.string().min(1).max(128) })), async (req, res) => {
  const user = await User.findOne({ email: req.valid.email, isDemo: false });
  const ok = await bcrypt.compare(req.valid.password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !ok) return res.status(401).json({ error: 'Email or password is wrong' });
  user.lastActiveAt = new Date();
  await user.save();
  setSession(res, user);
  return res.json({ user: user.toPublic() });
});

router.post('/logout', async (req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user.toPublic() });
});

// One-click demo: a throwaway shop filled with fictional data, deleted automatically.
router.post(
  '/demo',
  limiter,
  validate(
    z.object({
      acceptTerms: z.literal(true, { message: 'Please accept the Terms and Privacy Policy' }),
      ageConfirmed: z.literal(true, { message: 'You must be 18 or older to use this app' }),
    })
  ),
  async (req, res) => {
    const user = await User.create({
      email: `demo-${crypto.randomBytes(8).toString('hex')}@demo.invalid`,
      passwordHash: await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10),
      shopName: 'Sharma General Store (demo)',
      shopType: 'kirana',
      language: 'hi',
      isDemo: true,
      demoExpiresAt: new Date(Date.now() + config.demoHours * 3600 * 1000),
      consent: { termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION, ageConfirmed: true, acceptedAt: new Date() },
    });
    try {
      await seedDemoShop(user._id);
    } catch (err) {
      await deleteShopData(user._id);
      throw err;
    }
    setSession(res, user);
    res.status(201).json({ user: user.toPublic() });
  }
);

module.exports = router;
