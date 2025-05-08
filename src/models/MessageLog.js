const mongoose = require('mongoose');

const messageLogSchema = new mongoose.Schema({
  groupName: String,
  chatId: {
    type: String,
    required: true
  },
  senderId: String,
  senderName: String,
  username: String,
  timestamp: {
    type: Date,
    required: true
  },
  content: String,
  photoUrl: String,
  videoUrl: String,
  voiceUrl: String,
  documentUrl: String
}, {
  timestamps: true
});

module.exports = mongoose.model('MessageLog', messageLogSchema); 