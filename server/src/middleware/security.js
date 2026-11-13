const config = require('../config');

// CSRF defence: browsers always send an Origin header on cross-site POSTs.
// State-changing requests from any origin we do not own are rejected.
function originCheck(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (!origin) return next(); // same-origin form posts from old browsers, server-to-server calls
  if (config.allowedOrigins.includes(origin.replace(/\/$/, ''))) return next();
  return res.status(403).json({ error: 'Request blocked' });
}

module.exports = { originCheck };
