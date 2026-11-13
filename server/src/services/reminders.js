const crypto = require('crypto');
const config = require('../config');
const PaymentRequest = require('../models/PaymentRequest');
const { formatRupees } = require('../utils/money');

const { TEMPLATES } = require('./reminderTemplates');

function fillTemplate(template, { name, shop, amountPaise, link }) {
  return template
    .replace('{NAME}', name)
    .replace('{SHOP}', shop)
    .replace('{AMOUNT}', formatRupees(amountPaise))
    .replace('{LINK}', link);
}

// WhatsApp "click to chat" link. Nothing is sent automatically: WhatsApp
// opens with the message typed in and the shopkeeper presses Send.
function whatsappLink(phone, message) {
  const text = encodeURIComponent(message);
  return phone ? `https://wa.me/91${phone}?text=${text}` : `https://wa.me/?text=${text}`;
}

const LINK_DAYS = 30;

// Reuses the customer's current pay link if it is still valid.
async function getOrCreatePaymentRequest(shopId, customerId) {
  const now = new Date();
  const existing = await PaymentRequest.findOne({ shop: shopId, customer: customerId, expiresAt: { $gt: now } }).sort({
    createdAt: -1,
  });
  if (existing && existing.expiresAt - now > 7 * 24 * 3600 * 1000) return existing;
  return PaymentRequest.create({
    token: crypto.randomBytes(24).toString('base64url'),
    shop: shopId,
    customer: customerId,
    expiresAt: new Date(now.getTime() + LINK_DAYS * 24 * 3600 * 1000),
  });
}

function payUrl(token) {
  return `${config.appUrl}/pay/${token}`;
}

module.exports = { TEMPLATES, fillTemplate, whatsappLink, getOrCreatePaymentRequest, payUrl };
