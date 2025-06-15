const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { extractBankInfoFromImage, extractMoneyAmountFromImage } = require('../utils/openai');
const { getDownloadLink } = require('../utils/telegramUtils');
const { extractMoneyFromText } = require('../utils/textParser');

/**
 * Xử lý lệnh trích xuất thông tin ngân hàng từ ảnh
 */
const handleImageBankInfo = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    
    // Thông báo cho người dùng biết đang xử lý
    bot.sendMessage(chatId, "⏳ 正在获取银行账户信息…");
    
    // Lấy ảnh có độ phân giải cao nhất
    const photos = msg.photo;
    const photoFileId = photos[photos.length - 1].file_id;
    
    // Lấy đường dẫn tải ảnh
    const downloadUrl = await getDownloadLink(photoFileId, process.env.TELEGRAM_BOT_TOKEN);
    
    if (!downloadUrl) {
      bot.sendMessage(chatId, "❌ 无法获取图片文件信息.");
      return;
    }
    
    // Tải ảnh
    const response = await axios.get(downloadUrl, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(response.data);
    
    // Trích xuất thông tin ngân hàng từ ảnh
    const bankInfo = await extractBankInfoFromImage(imageBuffer);
    
    if (bankInfo) {
      const currentDate = new Date().toLocaleDateString('vi-VN');
      
      // Tạo mã theo định dạng yêu cầu: 1 chữ cái + 2 số
      const randomLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26)); // A-Z
      const randomNumber = Math.floor(Math.random() * 100).toString().padStart(2, '0'); // 00-99
      const uniqueCode = randomLetter + randomNumber;
      
      // Tạo tin nhắn
      const formattedMessage = 
        `${uniqueCode} - ${currentDate}\n` +
        `${bankInfo.bankName || "[未找到]"}\n` +
        `${bankInfo.bankNameEnglish || "[未找到]"}\n` +
        `${bankInfo.accountNumber || "[未找到]"}\n` +
        `${bankInfo.accountName || "[未找到]"}`;
      
      bot.sendMessage(chatId, formattedMessage);
    } else {
      bot.sendMessage(chatId, "❌ 无法从该图片识别出银行账户信息.");
    }
  } catch (error) {
    console.error('Error in handleImageBankInfo:', error);
    bot.sendMessage(msg.chat.id, "处理图片时出错，请重试。");
  }
};

/**
 * Xử lý lệnh trích xuất thông tin ngân hàng từ ảnh được reply
 */
const handleReplyImageBankInfo = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    
    // Kiểm tra nếu tin nhắn được reply có chứa ảnh
    if (!msg.reply_to_message || !msg.reply_to_message.photo) {
      bot.sendMessage(chatId, "❌ 请回复一条含有图片的消息。");
      return;
    }
    
    // Thông báo cho người dùng biết đang xử lý
    bot.sendMessage(chatId, "⏳ 正在获取银行账户信息…");
    
    // Lấy ảnh có độ phân giải cao nhất từ tin nhắn được reply
    const photos = msg.reply_to_message.photo;
    const photoFileId = photos[photos.length - 1].file_id;
    
    // Lấy đường dẫn tải ảnh
    const downloadUrl = await getDownloadLink(photoFileId, process.env.TELEGRAM_BOT_TOKEN);
    
    if (!downloadUrl) {
      bot.sendMessage(chatId, "❌ 无法获取图片文件信息.");
      return;
    }
    
    // Tải ảnh
    const response = await axios.get(downloadUrl, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(response.data);
    
    // Trích xuất thông tin ngân hàng từ ảnh
    const bankInfo = await extractBankInfoFromImage(imageBuffer);
    
    if (bankInfo) {
      const currentDate = new Date().toLocaleDateString('vi-VN');
      
      // Tạo mã theo định dạng yêu cầu: 1 chữ cái + 2 số
      const randomLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26)); // A-Z
      const randomNumber = Math.floor(Math.random() * 100).toString().padStart(2, '0'); // 00-99
      const uniqueCode = randomLetter + randomNumber;
      
      // Tạo tin nhắn
      const formattedMessage = 
        `${uniqueCode} - ${currentDate}\n` +
        `${bankInfo.bankName || "[未找到]"}\n` +
        `${bankInfo.bankNameEnglish || "[未找到]"}\n` +
        `${bankInfo.accountNumber || "[未找到]"}\n` +
        `${bankInfo.accountName || "[未找到]"}`;
      
      bot.sendMessage(chatId, formattedMessage);
    } else {
      bot.sendMessage(chatId, "❌ 无法从该图片识别出银行账户信息.");
    }
  } catch (error) {
    console.error('Error in handleReplyImageBankInfo:', error);
    bot.sendMessage(msg.chat.id, "处理图片时出错，请重试。");
  }
};

/**
 * Xử lý lệnh /11 - trích xuất số tiền từ ảnh hoặc text và gọi lệnh +
 */
const handleElevenCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    
    // Kiểm tra nếu tin nhắn được reply có chứa ảnh hoặc text
    if (!msg.reply_to_message || (!msg.reply_to_message.photo && !msg.reply_to_message.text)) {
      bot.sendMessage(chatId, "❌ 请回复一条含有图片或文字的消息使用 /11 命令。");
      return;
    }
    
    let moneyAmount = null;
    
    // Xử lý ảnh
    if (msg.reply_to_message.photo) {
      // Nếu ảnh có caption, thử extract từ caption trước (nhanh hơn)
      if (msg.reply_to_message.caption) {
        const processingMsg = await bot.sendMessage(chatId, "⏳ 正在识别图片标题中的金额…");
        moneyAmount = extractMoneyFromText(msg.reply_to_message.caption);
        bot.deleteMessage(chatId, processingMsg.message_id);
      }
      
      // Nếu không tìm thấy số tiền trong caption, thử phân tích ảnh
      if (!moneyAmount || moneyAmount <= 0) {
        // Thông báo cho người dùng biết đang xử lý ảnh
        const processingMsg = await bot.sendMessage(chatId, "⏳ 正在识别图片中的金额…");
        
        // Lấy ảnh có độ phân giải cao nhất từ tin nhắn được reply
        const photos = msg.reply_to_message.photo;
        const photoFileId = photos[photos.length - 1].file_id;
        
        // Lấy đường dẫn tải ảnh
        const downloadUrl = await getDownloadLink(photoFileId, process.env.TELEGRAM_BOT_TOKEN);
        
        if (!downloadUrl) {
          bot.editMessageText("❌ 无法获取图片文件信息.", {
            chat_id: chatId,
            message_id: processingMsg.message_id
          });
          return;
        }
        
        // Tải ảnh
        const response = await axios.get(downloadUrl, { responseType: 'arraybuffer' });
        const imageBuffer = Buffer.from(response.data);
        
        // Trích xuất số tiền từ ảnh
        moneyAmount = await extractMoneyAmountFromImage(imageBuffer);
        
        // Xóa tin nhắn xử lý
        bot.deleteMessage(chatId, processingMsg.message_id);
      }
    }
    // Xử lý text
    else if (msg.reply_to_message.text) {
      // Thông báo cho người dùng biết đang xử lý text
      const processingMsg = await bot.sendMessage(chatId, "⏳ 正在识别文字中的金额…");
      
      // Trích xuất số tiền từ text
      moneyAmount = extractMoneyFromText(msg.reply_to_message.text);
      
      // Xóa tin nhắn xử lý
      bot.deleteMessage(chatId, processingMsg.message_id);
    }
    
    if (moneyAmount && moneyAmount > 0) {
      // Tạo tin nhắn giả để gọi lệnh +
      const fakeMsg = {
        ...msg,
        text: `+${moneyAmount}`,
        chat: { id: chatId },
        from: msg.from,
        message_id: msg.message_id
      };
      
      // Import và gọi function xử lý lệnh +
      const { handlePlusCommand } = require('./transactionCommands');
      await handlePlusCommand(bot, fakeMsg);
      
    } else {
      const messageType = msg.reply_to_message.photo ? '图片' : '文字';
      bot.sendMessage(chatId, `❌ 无法从该${messageType}识别出金额信息。`);
    }
  } catch (error) {
    console.error('Error in handleElevenCommand:', error);
    bot.sendMessage(msg.chat.id, "处理 /11 命令时出错，请重试。");
  }
};

/**
 * Xử lý lệnh /12 - trích xuất số tiền từ ảnh hoặc text và gọi lệnh %
 */
const handleTwelveCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    
    // Kiểm tra nếu tin nhắn được reply có chứa ảnh hoặc text
    if (!msg.reply_to_message || (!msg.reply_to_message.photo && !msg.reply_to_message.text)) {
      bot.sendMessage(chatId, "❌ 请回复一条含有图片或文字的消息使用 /12 命令。");
      return;
    }
    
    let moneyAmount = null;
    
    // Xử lý ảnh
    if (msg.reply_to_message.photo) {
      // Nếu ảnh có caption, thử extract từ caption trước (nhanh hơn)
      if (msg.reply_to_message.caption) {
        const processingMsg = await bot.sendMessage(chatId, "⏳ 正在识别图片标题中的金额…");
        moneyAmount = extractMoneyFromText(msg.reply_to_message.caption);
        bot.deleteMessage(chatId, processingMsg.message_id);
      }
      
      // Nếu không tìm thấy số tiền trong caption, thử phân tích ảnh
      if (!moneyAmount || moneyAmount <= 0) {
        // Thông báo cho người dùng biết đang xử lý ảnh
        const processingMsg = await bot.sendMessage(chatId, "⏳ 正在识别图片中的金额…");
        
        // Lấy ảnh có độ phân giải cao nhất từ tin nhắn được reply
        const photos = msg.reply_to_message.photo;
        const photoFileId = photos[photos.length - 1].file_id;
        
        // Lấy đường dẫn tải ảnh
        const downloadUrl = await getDownloadLink(photoFileId, process.env.TELEGRAM_BOT_TOKEN);
        
        if (!downloadUrl) {
          bot.editMessageText("❌ 无法获取图片文件信息.", {
            chat_id: chatId,
            message_id: processingMsg.message_id
          });
          return;
        }
        
        // Tải ảnh
        const response = await axios.get(downloadUrl, { responseType: 'arraybuffer' });
        const imageBuffer = Buffer.from(response.data);
        
        // Trích xuất số tiền từ ảnh
        moneyAmount = await extractMoneyAmountFromImage(imageBuffer);
        
        // Xóa tin nhắn xử lý
        bot.deleteMessage(chatId, processingMsg.message_id);
      }
    }
    // Xử lý text
    else if (msg.reply_to_message.text) {
      // Thông báo cho người dùng biết đang xử lý text
      const processingMsg = await bot.sendMessage(chatId, "⏳ 正在识别文字中的金额…");
      
      // Trích xuất số tiền từ text
      moneyAmount = extractMoneyFromText(msg.reply_to_message.text);
      
      // Xóa tin nhắn xử lý
      bot.deleteMessage(chatId, processingMsg.message_id);
    }
    
    if (moneyAmount && moneyAmount > 0) {
      // Tạo tin nhắn giả để gọi lệnh %
      const fakeMsg = {
        ...msg,
        text: `%${moneyAmount}`,
        chat: { id: chatId },
        from: msg.from,
        message_id: msg.message_id
      };
      
      // Import và gọi function xử lý lệnh %
      const { handlePercentCommand } = require('./transactionCommands');
      await handlePercentCommand(bot, fakeMsg);
      
    } else {
      const messageType = msg.reply_to_message.photo ? '图片' : '文字';
      bot.sendMessage(chatId, `❌ 无法从该${messageType}识别出金额信息。`);
    }
  } catch (error) {
    console.error('Error in handleTwelveCommand:', error);
    bot.sendMessage(msg.chat.id, "处理 /12 命令时出错，请重试。");
  }
};

module.exports = {
  handleImageBankInfo,
  handleReplyImageBankInfo,
  handleTwelveCommand,
  handleElevenCommand
}; 