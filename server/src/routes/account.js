const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const User = require('../models/User');
const { validate } = require('../middleware/validate');
const { clearSession } = require('../middleware/auth');
const { deleteShopData, exportShopData } = require('../services/accountData');

const router = express.Router();

router.patch(
  '/',
  validate(
    z.object({
      shopName: z.string().trim().min(2, 'Enter your shop name').max(80).optional(),
      shopType: z.enum(User.SHOP_TYPES).optional(),
      language: z.enum(User.LANGUAGES).optional(),
      defaultTone: z.enum(User.TONES).optional(),
    })
  ),
  async (req, res) => {
    Object.assign(req.user, req.valid);
    await req.user.save();
    res.json({ user: req.user.toPublic() });
  }
);

router.post(
  '/password',
  validate(z.object({ current: z.string().min(1).max(128), next: z.string().min(8, 'New password must be at least 8 characters').max(128) })),
  async (req, res) => {
    if (req.user.isDemo) return res.status(400).json({ error: 'Demo accounts do not have a password' });
    const ok = await bcrypt.compare(req.valid.current, req.user.passwordHash);
    if (!ok) return res.status(400).json({ error: 'Current password is wrong', field: 'current' });
    req.user.passwordHash = await bcrypt.hash(req.valid.next, 12);
    await req.user.save();
    res.json({ ok: true });
  }
);

// Right to access: everything we hold, as a JSON file.
router.get('/export', async (req, res) => {
  const data = await exportShopData(req.user._id);
  res.set('Content-Disposition', 'attachment; filename="khata-io-my-data.json"');
  res.set('Cache-Control', 'no-store');
  res.json(data);
});

// Right to erasure: deletes the account and all its data immediately.
router.delete('/', validate(z.object({ password: z.string().max(128).optional() })), async (req, res) => {
  if (!req.user.isDemo) {
    const ok = req.valid.password && (await bcrypt.compare(req.valid.password, req.user.passwordHash));
    if (!ok) return res.status(400).json({ error: 'Password is wrong', field: 'password' });
  }
  await deleteShopData(req.user._id);
  clearSession(res);
  res.json({ ok: true });
});

module.exports = router;
