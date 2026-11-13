const crypto = require('crypto');
const config = require('../config');
const Payment = require('../models/Payment');
const WebhookEvent = require('../models/WebhookEvent');
const { addEntry } = require('./ledger');

function isDuplicateKey(err) {
  return err && err.code === 11000;
}

// Saves a received payment as a "jama" entry exactly once.
// paymentRef is unique in the database, so a second call is a no-op.
async function recordPayment(payment, providerPaymentId, amountPaise) {
  const paidAmount = amountPaise || payment.amountPaise;
  let duplicate = false;
  try {
    await addEntry({
      shopId: payment.shop,
      customerId: payment.customer,
      type: 'jama',
      amountPaise: paidAmount,
      items: payment.provider === 'demo' ? 'Demo UPI payment' : 'UPI payment',
      source: 'payment',
      paymentRef: `${payment.provider}:${providerPaymentId}`,
    });
  } catch (err) {
    if (!isDuplicateKey(err)) throw err;
    duplicate = true;
  }
  await Payment.updateOne(
    { _id: payment._id, status: 'created' },
    { $set: { status: 'paid', paidAt: new Date(), providerPaymentId } }
  );
  return { duplicate };
}

async function razorpayRequest(path, body) {
  const auth = Buffer.from(`${config.razorpay.keyId}:${config.razorpay.keySecret}`).toString('base64');
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error?.description || 'Payment provider error');
    err.status = 502;
    throw err;
  }
  return data;
}

// Starts a payment from the customer pay page.
async function startPayment({ request, shopName, amountPaise }) {
  const payment = await Payment.create({
    request: request._id,
    shop: request.shop,
    customer: request.customer,
    amountPaise,
    provider: config.payments.mode,
  });
  if (config.payments.mode === 'demo') {
    return { mode: 'demo', paymentId: payment._id.toString() };
  }
  try {
    // No customer phone or email is sent: Razorpay collects what it needs itself.
    const link = await razorpayRequest('/payment_links', {
      amount: amountPaise,
      currency: 'INR',
      accept_partial: false,
      reference_id: payment._id.toString(),
      description: `Payment to ${shopName}`.slice(0, 200),
      notify: { sms: false, email: false },
      reminder_enable: false,
      callback_url: `${config.appUrl}/pay/${request.token}?done=1`,
      callback_method: 'get',
      expire_by: Math.floor(Date.now() / 1000) + 24 * 3600,
    });
    payment.providerLinkId = link.id;
    await payment.save();
    return { mode: 'razorpay', paymentId: payment._id.toString(), url: link.short_url };
  } catch (err) {
    await Payment.deleteOne({ _id: payment._id });
    throw err;
  }
}

function verifySignature(rawBody, signature) {
  if (!signature || !config.razorpay.webhookSecret) return false;
  const expected = crypto.createHmac('sha256', config.razorpay.webhookSecret).update(rawBody).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(String(signature), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Handles a Razorpay webhook. Safe to receive the same event many times.
async function handleWebhook({ rawBody, signature, eventId }) {
  if (!verifySignature(rawBody, signature)) {
    const err = new Error('Invalid signature');
    err.status = 400;
    throw err;
  }
  if (eventId && (await WebhookEvent.exists({ eventId }))) return { ignored: 'duplicate' };

  const event = JSON.parse(rawBody.toString('utf8'));
  let outcome = { ignored: 'event_not_used' };
  if (event.event === 'payment_link.paid') {
    const link = event.payload?.payment_link?.entity;
    const pay = event.payload?.payment?.entity;
    const payment = link?.id ? await Payment.findOne({ providerLinkId: link.id }) : null;
    if (!payment) outcome = { ignored: 'unknown_link' };
    else if (!pay?.id) outcome = { ignored: 'no_payment_id' };
    else {
      const amount = Number.isInteger(link.amount_paid) && link.amount_paid > 0 ? link.amount_paid : payment.amountPaise;
      const { duplicate } = await recordPayment(payment, pay.id, amount);
      outcome = duplicate ? { ignored: 'duplicate' } : { recorded: true };
    }
  }
  if (eventId) {
    try {
      await WebhookEvent.create({ eventId });
    } catch (err) {
      if (!isDuplicateKey(err)) throw err;
    }
  }
  return outcome;
}

module.exports = { startPayment, recordPayment, handleWebhook, verifySignature };
