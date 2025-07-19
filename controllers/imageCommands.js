const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { extractBankInfoFromImage, extractMoneyAmountFromImage } = require('../utils/openai');
const { getDownloadLink } = require('../utils/telegramUtils');
const { extractMoneyFromText, extractMoneyFromBankNotification } = require('../utils/textParser');

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
 * Xử lý khi reply "1" vào tin nhắn thông báo ngân hàng
 */
const handleBankNotificationReply = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    
    // Kiểm tra nếu tin nhắn được reply có chứa text
    if (!msg.reply_to_message || !msg.reply_to_message.text) {
      bot.sendMessage(chatId, );
      return;
    }
    
    const repliedText = msg.reply_to_message.text;
    
    // Kiểm tra tin nhắn có phải là thông báo ngân hàng không
    const isBankNotification = isBankNotificationMessage(repliedText);
    
    if (!isBankNotification) {
      bot.sendMessage(chatId, );
      return;
    }
    
    // Thông báo đang xử lý
    const processingMsg = await bot.sendMessage(chatId, "⏳ 正在识别银行通知中的金额…");
    
    // Trích xuất số tiền từ tin nhắn thông báo (ưu tiên "tiền vào" thay vì "số dư")
    const moneyAmount = extractMoneyFromBankNotification(repliedText);
    
    // Xóa tin nhắn xử lý
    bot.deleteMessage(chatId, processingMsg.message_id);
    
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
      bot.sendMessage(chatId, );
    }
    
  } catch (error) {
    console.error('Error in handleBankNotificationReply:', error);
    bot.sendMessage(msg.chat.id, "处理银行通知回复时出错，请重试。");
  }
};

/**
 * Kiểm tra tin nhắn có phải là thông báo ngân hàng không
 */
const isBankNotificationMessage = (text) => {
  if (!text || typeof text !== 'string') {
    return false;
  }
  
  // Các từ khóa thông báo ngân hàng tiếng Việt
  const vietnameseBankKeywords = [
    'tiền vào', 'tiền ra', 'tài khoản', 'số dư', 'chuyển khoản', 'giao dịch',
    'ngân hàng', 'ATM', 'internet banking', 'mobile banking',
    'chuyển tiền', 'nạp tiền', 'rút tiền', 'thanh toán',
    'ACB', 'Vietcombank', 'Techcombank', 'BIDV', 'VietinBank', 'Agribank',
    'Sacombank', 'MB Bank', 'VPBank', 'TPBank', 'HDBank', 'SHB',
    'nội dung ck', 'nội dung CK', 'số tk', 'số tài khoản',
    'lúc:', 'thời gian:', 'ngày:', 'gio:', 'giờ:'
  ];
  
  // Các từ khóa thông báo ngân hàng tiếng Anh
  const englishBankKeywords = [
    'account', 'balance', 'transfer', 'deposit', 'withdrawal', 'transaction',
    'bank', 'banking', 'payment', 'received', 'sent', 'credited', 'debited',
    'available balance', 'current balance', 'account number', 'ref no',
    'reference number', 'transaction id', 'txn id'
  ];
  
  // Các từ khóa thông báo ngân hàng tiếng Trung
  const chineseBankKeywords = [
    '入账', '出账', '转账', '余额', '账户', '银行', '支付', '收款', '付款',
    '交易', '流水', '账单', '汇款', '存款', '取款', '充值'
  ];
  
  // Patterns cho format số tiền và thời gian
  const moneyPattern = /[\d,]+\.?\d*\s*(?:đ|vnd|usd|usdt|yuan|rmb|元)/i;
  const timePattern = /\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}|\d{2}:\d{2}:\d{2}|\d{2}\/\d{2}\/\d{4}/;
  const accountPattern = /\d{8,}/; // Số tài khoản thường có ít nhất 8 chữ số
  
  const textLower = text.toLowerCase();
  
  // Kiểm tra có từ khóa ngân hàng không
  const hasVietnameseKeywords = vietnameseBankKeywords.some(keyword => textLower.includes(keyword));
  const hasEnglishKeywords = englishBankKeywords.some(keyword => textLower.includes(keyword));
  const hasChineseKeywords = chineseBankKeywords.some(keyword => text.includes(keyword));
  
  // Kiểm tra có pattern tiền/thời gian/tài khoản không
  const hasMoneyPattern = moneyPattern.test(text);
  const hasTimePattern = timePattern.test(text);
  const hasAccountPattern = accountPattern.test(text);
  
  // Tin nhắn được coi là thông báo ngân hàng nếu:
  // 1. Có từ khóa ngân hàng VÀ có pattern tiền hoặc tài khoản
  // 2. Có ít nhất 2 trong 3 patterns (tiền, thời gian, tài khoản)
  const hasBankKeywords = hasVietnameseKeywords || hasEnglishKeywords || hasChineseKeywords;
  const hasMultiplePatterns = [hasMoneyPattern, hasTimePattern, hasAccountPattern].filter(Boolean).length >= 2;
  
  return (hasBankKeywords && (hasMoneyPattern || hasAccountPattern)) || hasMultiplePatterns;
};

/**
 * Xử lý reply 1, 2, 3 trong chế độ pic mode
 */
const handlePicModeReply = async (bot, msg, replyNumber) => {
  try {
    const chatId = msg.chat.id;
    
    // Kiểm tra nếu tin nhắn được reply có chứa ảnh hoặc text
    if (!msg.reply_to_message || (!msg.reply_to_message.photo && !msg.reply_to_message.text)) {
      bot.sendMessage(chatId, "❌ 请回复一条含有图片或文字的消息");
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
      // Xác định lệnh dựa trên reply number
      let commandText, commandName;
      switch (replyNumber) {
        case '1':
          commandText = `+${moneyAmount}`;
          commandName = '+';
          break;
        case '2':
          commandText = `%${moneyAmount}`;
          commandName = '%';
          break;
        case '3':
          commandText = `-${moneyAmount}`;
          commandName = '-';
          break;
        default:
          return;
      }
      
      // Import formatter để hiển thị số tiền có dấu phân cách
      const { formatSmart } = require('../utils/formatter');
      
      // Gửi tin nhắn thông báo trích xuất thành công
      const extractionMessage = `✅ 已提取金额：${formatSmart(moneyAmount, 'formatted')}\n🔄 执行指令：${commandName}${formatSmart(moneyAmount, 'formatted')}`;
      await bot.sendMessage(chatId, extractionMessage);
      
      // Tạo tin nhắn giả để gọi lệnh tương ứng
      const fakeMsg = {
        ...msg,
        text: commandText,
        chat: { id: chatId },
        from: msg.from,
        message_id: msg.message_id
      };
      
      // Import và gọi function xử lý lệnh tương ứng
      const { handlePlusCommand, handleMinusCommand, handlePercentCommand } = require('./transactionCommands');
      
      switch (replyNumber) {
        case '1':
          await handlePlusCommand(bot, fakeMsg);
          break;
        case '2':
          await handlePercentCommand(bot, fakeMsg);
          break;
        case '3':
          await handleMinusCommand(bot, fakeMsg);
          break;
      }
      
    } else {
      const messageType = msg.reply_to_message.photo ? '图片' : '文字';
      bot.sendMessage(chatId, `❌ 无法从该${messageType}识别出金额信息。`);
    }
  } catch (error) {
    console.error('Error in handlePicModeReply:', error);
    bot.sendMessage(msg.chat.id, "处理图片模式回复时出错，请重试。");
  }
};

module.exports = {
  handleImageBankInfo,
  handleReplyImageBankInfo,
  handleBankNotificationReply,
  handlePicModeReply
}; 