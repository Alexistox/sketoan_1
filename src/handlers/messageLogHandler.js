const MessageLog = require('../models/MessageLog');
const moment = require('moment');

const handleMessage = async (msg) => {
  try {
    const {
      chat: { id: chatId, title: groupName },
      from: { id: senderId, first_name: senderName, username },
      text: content,
      photo,
      video,
      voice,
      document
    } = msg;

    const messageLog = new MessageLog({
      groupName,
      chatId: chatId.toString(),
      senderId: senderId.toString(),
      senderName,
      username,
      timestamp: moment().toDate(),
      content,
      photoUrl: photo ? photo[photo.length - 1].file_id : null,
      videoUrl: video ? video.file_id : null,
      voiceUrl: voice ? voice.file_id : null,
      documentUrl: document ? document.file_id : null
    });

    await messageLog.save();
    return true;
  } catch (error) {
    console.error('Error saving message log:', error);
    return false;
  }
};

const getMessageLogs = async (chatId, startDate, endDate) => {
  try {
    const query = {
      chatId: chatId.toString(),
      timestamp: {
        $gte: startDate,
        $lte: endDate
      }
    };

    const logs = await MessageLog.find(query)
      .sort({ timestamp: -1 })
      .lean();

    return logs;
  } catch (error) {
    console.error('Error getting message logs:', error);
    return [];
  }
};

module.exports = {
  handleMessage,
  getMessageLogs
}; 