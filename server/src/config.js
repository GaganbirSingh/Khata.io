// All settings come from environment variables so no secret is ever committed.
require('dotenv').config({ quiet: true });

const env = process.env.NODE_ENV || 'development';
const isProd = env === 'production';

function required(name, fallbackForDev) {
  const value = process.env[name];
  if (value) return value;
  if (!isProd && fallbackForDev !== undefined) return fallbackForDev;
  throw new Error(`Missing required environment variable: ${name}`);
}

const appUrl = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');

const config = {
  env,
  isProd,
  isTest: env === 'test',
  port: Number(process.env.PORT || 4000),
  mongoUri: required('MONGODB_URI', 'mongodb://127.0.0.1:27017/khata_io'),
  jwtSecret: required('JWT_SECRET', 'dev-only-secret-change-me-dev-only-secret'),
  appUrl,
  // Origins allowed to make state-changing requests (CSRF defence).
  allowedOrigins: (process.env.ALLOWED_ORIGINS || appUrl)
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean),

  // Data retention (data minimisation). Inactive accounts are deleted.
  retentionDays: Number(process.env.DATA_RETENTION_DAYS || 30),
  demoHours: Number(process.env.DEMO_ACCOUNT_HOURS || 24),

  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
    // "free" means Google's Unpaid Services terms apply: Google may use prompts
    // to improve its products and says not to send personal information.
    tier: process.env.GEMINI_TIER === 'paid' ? 'paid' : 'free',
    timeoutMs: 20000,
  },

  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  },

  // Shown on legal pages and the footer. Fill these in before going public.
  legal: {
    operatorName: process.env.OPERATOR_NAME || 'Gaganbir Singh',
    contactEmail: process.env.CONTACT_EMAIL || 'gsingh1_be23@thapar.edu',
    grievanceOfficer: process.env.GRIEVANCE_OFFICER || 'Gaganbir Singh',
    city: process.env.OPERATOR_CITY || 'Patiala, India',
  },
};

config.ai = { enabled: Boolean(config.gemini.apiKey) };
config.payments = {
  mode:
    config.razorpay.keyId && config.razorpay.keySecret && config.razorpay.webhookSecret
      ? 'razorpay'
      : 'demo',
};

if (isProd && config.jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters in production');
}
if (config.razorpay.keyId && !config.razorpay.keyId.startsWith('rzp_test_')) {
  // This is a portfolio demo: refuse live keys so no real money can move by mistake.
  throw new Error('Live Razorpay keys are not allowed. Use test-mode keys (rzp_test_...).');
}

module.exports = config;
