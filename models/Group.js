const mongoose = require('mongoose');

const GroupSchema = new mongoose.Schema({
  chatId: {
    type: String,
    required: true,
    unique: true
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
  rate: {
    type: Number,
    default: 0
  },
  exchangeRate: {
    type: Number,
    default: 0
  },
  numberFormat: {
    type: String,
    enum: ['default', 'formatted'],
    default: 'default'
  },
  lastClearDate: {
    type: Date,
    default: Date.now
  },
  operators: {
    type: [{
      userId: String,
      username: String,
      dateAdded: {
        type: Date,
        default: Date.now
      }
    }],
    default: []
  },
  reportToken: {
    type: String,
    default: null
  },
  reportTokenExpiry: {
    type: Date,
    default: null
  },
  ownerId: {
    type: String,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('Group', GroupSchema); 