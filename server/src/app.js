const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const config = require('./config');
const { requireAuth } = require('./middleware/auth');
const { originCheck } = require('./middleware/security');
const { notFound, errorHandler } = require('./middleware/errors');

// All user input is validated with zod before it reaches a query, and ids are
// checked with isValidObjectId, so request bodies cannot inject query operators.
mongoose.set('strictQuery', true);

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:', 'blob:'],
          'font-src': ["'self'"],
          'connect-src': ["'self'"],
          'frame-ancestors': ["'none'"],
          'form-action': ["'self'"],
          'object-src': ["'none'"],
          'upgrade-insecure-requests': config.isProd ? [] : null,
        },
      },
      referrerPolicy: { policy: 'no-referrer' },
      crossOriginEmbedderPolicy: false,
    })
  );
  app.use((req, res, next) => {
    res.set('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=(), payment=()');
    next();
  });

  // Webhooks need the raw body, so they are mounted before the JSON parser.
  app.use('/api/webhooks', require('./routes/webhooks'));

  // Scheduled cleanup (Vercel Cron). Vercel sends "Authorization: Bearer <CRON_SECRET>".
  app.get('/api/cron/cleanup', async (req, res, next) => {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.get('authorization') !== `Bearer ${secret}`) return res.status(401).json({ error: 'Not allowed' });
    try {
      const { runCleanup } = require('./services/accountData');
      const removed = await runCleanup();
      res.set('Cache-Control', 'no-store').json({ ok: true, removed });
    } catch (err) {
      next(err);
    }
  });

  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use('/api', originCheck);
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.use('/api/meta', require('./routes/meta'));
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/pay', require('./routes/pay'));
  app.use('/api/dashboard', requireAuth, require('./routes/dashboard'));
  app.use('/api/customers', requireAuth, require('./routes/customers'));
  app.use('/api/entries', requireAuth, require('./routes/entries'));
  app.use('/api/ai', requireAuth, require('./routes/ai'));
  app.use('/api/reminders', requireAuth, require('./routes/reminders'));
  app.use('/api/reports', requireAuth, require('./routes/reports'));
  app.use('/api/account', requireAuth, require('./routes/account'));
  app.use('/api', notFound);

  // In production the built React app is served from the same server.
  const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
    app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
