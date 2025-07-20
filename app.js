require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { NewMessage } = require('telegram/events');
const axios = require('axios');
const NodeCache = require('node-cache');

// Import userbot config
const UserbotConfig = require('./config/userbot');
const UserbotWrapper = require('./utils/userbotWrapper');

// Import controllers và utils
const { handleMessage } = require('./controllers/messageController');
const { handleInlineButtonCallback } = require('./controllers/userCommands');
const { connectDB } = require('./config/db');

// Khởi tạo cache
const cache = new NodeCache({ stdTTL: 21600 }); // Cache in 6 hours

// Khởi tạo ứng dụng Express
const app = express();
app.use(express.json());

// Kết nối MongoDB
connectDB();

// Khởi tạo Userbot
const userbotConfig = new UserbotConfig();
let client;

// Hàm khởi tạo userbot
async function initializeUserbot() {
  try {
    client = await userbotConfig.initializeClient();
    const botWrapper = new UserbotWrapper(client);
    
    // Xử lý tin nhắn mới
    client.addEventHandler(async (event) => {
      try {
        const message = event.message;
        if (message) {
          // Chuyển đổi message format để tương thích với controller hiện tại
          const adaptedMsg = await adaptMessageFormat(message);
          await handleMessage(botWrapper, adaptedMsg, cache);
        }
      } catch (error) {
        console.error('Error handling message:', error);
        if (event.message?.chatId) {
          await client.sendMessage(event.message.chatId, {
            message: "处理消息时出错。请稍后再试。"
          });
        }
      }
    }, new NewMessage({}));

    console.log('Userbot events initialized');
    return { client, botWrapper };
  } catch (error) {
    console.error('Failed to initialize userbot:', error);
    process.exit(1);
  }
}

// Hàm chuyển đổi format tin nhắn cho tương thích
async function adaptMessageFormat(message) {
  return {
    message_id: message.id,
    from: {
      id: message.fromId?.userId || message.peerId?.userId,
      first_name: message.sender?.firstName || '',
      last_name: message.sender?.lastName || '',
      username: message.sender?.username || '',
    },
    chat: {
      id: message.chatId || message.peerId?.chatId || message.peerId?.userId,
      type: message.isGroup ? 'group' : (message.isChannel ? 'channel' : 'private'),
    },
    date: Math.floor(message.date),
    text: message.text || '',
    photo: message.photo ? [{ file_id: message.photo }] : undefined,
    reply_to_message: message.replyTo ? {
      message_id: message.replyTo.replyToMsgId,
    } : undefined,
  };
}

// Import và sử dụng report routes
const reportRoutes = require('./routes/reportRoutes');
app.use('/', reportRoutes);

// Route trang chủ
app.get('/', (req, res) => {
  res.send('Bot is running');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Initializing userbot...');
  await initializeUserbot();
});

// Xử lý lỗi không bắt được
process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Received SIGINT. Disconnecting userbot...');
  if (client) {
    await client.disconnect();
  }
  process.exit(0);
});

module.exports = { getClient: () => client }; 