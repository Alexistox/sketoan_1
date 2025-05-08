const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  chatId: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  totalVND: {
    type: Number,
    default: 0
  },
  totalUSDT: {
    type: Number,
    default: 0
  },
  usdtPaid: {
    type: Number,
    default: 0
  },
  remainingUSDT: {
    type: Number,
    default: 0
  },
  timestamp: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true
  },
  rawAmount: {
    type: Number,
    default: 0
  },
  rawUsdtPaid: {
    type: Number,
    default: 0
  },
  details: String,
  paymentDetails: String,
  rate: {
    type: Number,
    default: 0
  },
  exchangeRate: {
    type: Number,
    default: 0
  },
  cardCode: String,
  limit: Number,
  usdtAddress: String
}, {
  timestamps: true
});

module.exports = mongoose.model('Transaction', transactionSchema); 