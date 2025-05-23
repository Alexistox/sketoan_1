const mongoose = require('mongoose');

const UsdtMediaSchema = new mongoose.Schema({
  address: {
    type: String,
    required: true
  },
  mediaType: {
    type: String, // photo, video, animation, sticker
    required: true
  },
  fileId: {
    type: String,
    required: true
  },
  fileUniqueId: {
    type: String
  },
  ownerId: {
    type: String // user id của người lưu
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  confirmedBy: [
    {
      username: String,
      userId: String,
      fullName: String
    }
  ]
});

module.exports = mongoose.model('UsdtMedia', UsdtMediaSchema); 