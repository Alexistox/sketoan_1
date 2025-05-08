const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  chatId: {
    type: String,
    required: true,
    ref: 'Group'
  },
  type: {
    type: String,
    enum: ['deposit', 'withdraw', 'payment', 'setRate', 'setExchangeRate', 'clear', 'delete'],
    required: true
  },
  amount: {
    type: Number,
    default: 0
  },
  usdtAmount: {
    type: Number,
    default: 0
  },
  cardCode: {
    type: String,
    default: ''
  },
  limit: {
    type: Number,
    default: 0
  },
  senderName: {
    type: String,
    required: true
  },
  message: {
    type: String,
    default: ''
  },
  details: {
    type: String,
    default: ''
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  rate: {
    type: Number,
    default: 0
  },
  exchangeRate: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', TransactionSchema); 