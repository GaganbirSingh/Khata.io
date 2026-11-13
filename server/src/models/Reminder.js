const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema(
  {
    shop: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    language: { type: String, enum: ['hi', 'pa', 'en'], required: true },
    tone: { type: String, enum: ['polite', 'friendly', 'firm'], required: true },
    message: { type: String, required: true, maxlength: 1000 },
    amountPaise: { type: Number, required: true },
    channel: { type: String, enum: ['whatsapp'], default: 'whatsapp' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Reminder', reminderSchema);
