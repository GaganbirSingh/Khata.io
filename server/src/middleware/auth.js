const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');

const COOKIE = 'uk_session';
const MAX_AGE_MS = 7 * 24 * 3600 * 1000;

// The only cookie this app sets. It is essential (keeps you logged in),
// httpOnly (JavaScript cannot read it) and never used for tracking.
function setSession(res, user) {
  const token = jwt.sign({ sub: user._id.toString() }, config.jwtSecret, { expiresIn: '7d' });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'lax',
    maxAge: user.isDemo ? Math.min(MAX_AGE_MS, user.demoExpiresAt - Date.now()) : MAX_AGE_MS,
    path: '/',
  });
}

function clearSession(res) {
  res.clearCookie(COOKIE, { httpOnly: true, secure: config.isProd, sameSite: 'lax', path: '/' });
}

async function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token) return res.status(401).json({ error: 'Please log in' });
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    clearSession(res);
    return res.status(401).json({ error: 'Your session expired. Please log in again.' });
  }
  const user = await User.findById(payload.sub);
  if (!user || (user.isDemo && user.demoExpiresAt < new Date())) {
    clearSession(res);
    return res.status(401).json({ error: 'Please log in' });
  }
  if (Date.now() - user.lastActiveAt.getTime() > 3600 * 1000) {
    await User.updateOne({ _id: user._id }, { $set: { lastActiveAt: new Date() } });
  }
  req.user = user;
  return next();
}

module.exports = { setSession, clearSession, requireAuth, COOKIE };
