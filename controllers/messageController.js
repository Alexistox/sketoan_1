const axios = require('axios');
const { extractBankInfoFromImage } = require('../utils/openai');
const { getDownloadLink, logMessage } = require('../utils/telegramUtils');
const { 
  formatSmart, 
  formatRateValue, 
  isMathExpression, 
  isSingleNumber, 
  isTrc20Address,
  formatTelegramMessage
} = require('../utils/formatter');

const Group = require('../models/Group');
const Transaction = require('../models/Transaction');
const Card = require('../models/Card');
const User = require('../models/User');
const Config = require('../models/Config');
const MessageLog = require('../models/MessageLog');

// Hàm xử lý tin nhắn chính
const handleMessage = async (bot, msg, cache) => {
  try {
    // Log message to database
    await logMessage(msg, process.env.TELEGRAM_BOT_TOKEN, MessageLog);
    
    // Log tin nhắn vào console để debug
    console.log('Received message:', JSON.stringify(msg, null, 2));
    
    // Lấy thông tin cơ bản từ tin nhắn
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username || msg.from.first_name || 'unknown';
    const firstName = msg.from.first_name || '';
    const lastName = msg.from.last_name || '';
    const timestamp = new Date();
    const messageText = msg.text || '';
    
    // Xử lý thành viên mới tham gia nhóm
    if (msg.new_chat_members) {
      const newMembers = msg.new_chat_members;
      for (const member of newMembers) {
        await sendWelcomeMessage(bot, chatId, member);
      }
      return;
    }
    
    // Xử lý các lệnh liên quan đến ảnh
    if (msg.photo) {
      if (msg.caption && msg.caption.startsWith('/c')) {
        await handleImageBankInfo(bot, msg);
        return;
      }
    }
    
    // Xử lý khi người dùng reply một tin nhắn có ảnh
    if (msg.reply_to_message && msg.reply_to_message.photo && msg.text && msg.text.startsWith('/c')) {
      await handleReplyImageBankInfo(bot, msg);
      return;
    }
    
    // Nếu không có văn bản, không xử lý
    if (!msg.text) {
      return;
    }
    
    // Kiểm tra và đăng ký người dùng mới
    await checkAndRegisterUser(userId, username, firstName, lastName);
    
    // Xử lý các lệnh tiếng Trung
    if (messageText === '上课') {
      if (await isUserAuthorized(userId, username, chatId)) {
        await handleClearCommand(bot, chatId, userId, firstName);
      } else {
        bot.sendMessage(chatId, "您无权使用此命令!");
      }
      return;
    }
    
    if (messageText === '结束') {
      await handleReportCommand(bot, chatId, firstName);
      return;
    }
    
    if (messageText.startsWith('设置费率')) {
      if (await isUserAuthorized(userId, username, chatId)) {
        await handleRateCommand(bot, msg);
      } else {
        bot.sendMessage(chatId, "您无权使用此命令!");
      }
      return;
    }
    
    if (messageText.startsWith('设置汇率')) {
      if (await isUserAuthorized(userId, username, chatId)) {
        await handleExchangeRateCommand(bot, msg);
      } else {
        bot.sendMessage(chatId, "您无权使用此命令!");
      }
      return;
    }
    
    if (messageText.startsWith('下发')) {
      if (await isUserAuthorized(userId, username, chatId)) {
        await handlePercentCommand(bot, msg);
      } else {
        bot.sendMessage(chatId, "您无权使用此命令!");
      }
      return;
    }
    
    if (messageText.startsWith('加操作人')) {
      if (await isUserOwner(userId)) {
        await handleAddOperatorCommand(bot, msg);
      } else {
        bot.sendMessage(chatId, "您没有权限使用此命令！");
      }
      return;
    }
    
    if (messageText.startsWith('移除操作人')) {
      if (await isUserOwner(userId)) {
        await handleRemoveOperatorCommand(bot, msg);
      } else {
        bot.sendMessage(chatId, "您没有权限使用此命令！");
      }
      return;
    }
    
    // Xử lý các lệnh bắt đầu bằng "/"
    if (messageText.startsWith('/')) {
      if (messageText === '/start') {
        bot.sendMessage(chatId, "欢迎使用交易管理机器人！");
        return;
      }
      
      if (messageText === '/off') {
        bot.sendMessage(chatId, "感谢大家的辛勤付出，祝大家发财！ 💰💸🍀");
        return;
      }
      
      if (messageText.startsWith('/m ')) {
        if (await isUserAuthorized(userId, username, chatId)) {
          await handleCurrencyUnitCommand(bot, msg);
        } else {
          bot.sendMessage(chatId, "您无权使用此命令!");
        }
        return;
      }
      
      if (messageText.startsWith('/t ')) {
        await handleCalculateUsdtCommand(bot, msg);
        return;
      }
      
      if (messageText.startsWith('/v ')) {
        await handleCalculateVndCommand(bot, msg);
        return;
      }
      
      if (messageText.startsWith('/d ')) {
        if (await isUserAuthorized(userId, username, chatId)) {
          await handleDualRateCommand(bot, msg);
        } else {
          bot.sendMessage(chatId, "您无权使用此命令!");
        }
        return;
      }
      
      if (messageText.startsWith('/x ')) {
        if (await isUserAuthorized(userId, username, chatId)) {
          await handleHideCardCommand(bot, msg);
        } else {
          bot.sendMessage(chatId, "您无权使用此命令!");
        }
        return;
      }
      
      if (messageText.startsWith('/sx ')) {
        if (await isUserAuthorized(userId, username, chatId)) {
          await handleShowCardCommand(bot, msg);
        } else {
          bot.sendMessage(chatId, "您无权使用此命令!");
        }
        return;
      }
      
      if (messageText === '/hiddenCards') {
        if (await isUserAuthorized(userId, username, chatId)) {
          await handleListHiddenCardsCommand(bot, msg);
        } else {
          bot.sendMessage(chatId, "您无权使用此命令!");
        }
        return;
      }
      
      if (messageText.startsWith('/delete')) {
        if (await isUserAuthorized(userId, username, chatId)) {
          await handleDeleteCommand(bot, msg);
        } else {
          bot.sendMessage(chatId, "您无权使用此命令!");
        }
        return;
      }
      
      if (messageText.startsWith('/usdt ')) {
        if (await isUserOwner(userId)) {
          await handleSetUsdtAddressCommand(bot, msg);
        } else {
          bot.sendMessage(chatId, "⛔ 只有机器人所有者才能使用此命令！");
        }
        return;
      }
      
      if (messageText === '/u') {
        await handleGetUsdtAddressCommand(bot, msg);
        return;
      }
      
      if (messageText === '/users') {
        if (await isUserAuthorized(userId, username, chatId)) {
          await handleListUsersCommand(bot, msg);
        } else {
          bot.sendMessage(chatId, "您没有权限查看用户列表。");
        }
        return;
      }
      
      if (messageText === '/report') {
        await handleReportCommand(bot, chatId, firstName);
        return;
      }
      
      if (messageText.startsWith('/setowner')) {
        if (await isUserOwner(userId)) {
          await handleSetOwnerCommand(bot, msg);
        } else {
          bot.sendMessage(chatId, "⛔ 只有机器人所有者才能使用此命令！");
        }
        return;
      }
      
      if (messageText.startsWith('/remove ')) {
        if (await isUserOwner(userId)) {
          await handleRemoveCommand(bot, msg);
        } else {
          bot.sendMessage(chatId, "⛔ 只有机器人所有者才能使用此命令！");
        }
        return;
      }
      
      if (messageText === '/migrate') {
        if (await isUserOwner(userId)) {
          await handleMigrateDataCommand(bot, msg);
        } else {
          bot.sendMessage(chatId, "⛔ 只有机器人所有者才能使用此命令！");
        }
        return;
      }
    }
    
    // Xử lý tin nhắn + và -
    if (messageText.startsWith('+')) {
      if (await isUserAuthorized(userId, username, chatId)) {
        await handlePlusCommand(bot, msg);
      } else {
        bot.sendMessage(chatId, "您无权使用此命令!");
      }
      return;
    }
    
    if (messageText.startsWith('-')) {
      if (await isUserAuthorized(userId, username, chatId)) {
        await handleMinusCommand(bot, msg);
      } else {
        bot.sendMessage(chatId, "您无权使用此命令!");
      }
      return;
    }
    
    // Xử lý biểu thức toán học
    if (isMathExpression(messageText)) {
      if (!isSingleNumber(messageText)) {
        await handleMathExpression(bot, chatId, messageText, firstName);
        return;
      }
    }
    
    // Xử lý địa chỉ TRC20
    if (isTrc20Address(messageText.trim())) {
      await handleTrc20Address(bot, chatId, messageText.trim(), firstName);
      return;
    }
    
  } catch (error) {
    console.error('Error in handleMessage:', error);
  }
};

// Hàm kiểm tra và đăng ký người dùng mới
const checkAndRegisterUser = async (userId, username, firstName, lastName) => {
  try {
    let user = await User.findOne({ userId: userId.toString() });
    
    if (!user) {
      // Kiểm tra xem đã có owner chưa
      const ownerExists = await User.findOne({ isOwner: true });
      
      // Nếu chưa có owner, user đầu tiên sẽ là owner
      const isFirstUser = !ownerExists;
      
      user = new User({
        userId: userId.toString(),
        username,
        firstName,
        lastName,
        isOwner: isFirstUser,
        isAllowed: isFirstUser
      });
      
      await user.save();
      
      if (isFirstUser) {
        console.log(`User ${username} (ID: ${userId}) is now the bot owner`);
      }
    }
    
    return user;
  } catch (error) {
    console.error('Error in checkAndRegisterUser:', error);
    return null;
  }
};

// Hàm kiểm tra quyền hạn owner
const isUserOwner = async (userId) => {
  try {
    const user = await User.findOne({ userId: userId.toString() });
    return user && user.isOwner;
  } catch (error) {
    console.error('Error in isUserOwner:', error);
    return false;
  }
};

// Hàm kiểm tra quyền hạn sử dụng (owner hoặc allowed)
const isUserAuthorized = async (userId, username, chatId) => {
  try {
    // Kiểm tra xem người dùng có phải là owner không
    const user = await User.findOne({ 
      $or: [
        { userId: userId.toString() },
        { username: username }
      ]
    });
    
    // Nếu là owner, cho phép tất cả
    if (user && user.isOwner) return true;
    
    // Kiểm tra xem người dùng có trong danh sách operators của nhóm không
    const group = await Group.findOne({ chatId: chatId.toString() });
    if (group && group.operators) {
      // Kiểm tra theo userId
      if (user && group.operators.some(op => op.userId === user.userId)) {
        return true;
      }
      
      // Kiểm tra theo username
      if (group.operators.some(op => op.username === username)) {
        return true;
      }
    }
    
    // Hỗ trợ ngược - kiểm tra quyền global legacy
    if (user && user.isAllowed) return true;
    
    // Hỗ trợ ngược - kiểm tra quyền theo nhóm legacy
    if (user && user.allowedGroups && user.allowedGroups.includes(chatId.toString())) {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error in isUserAuthorized:', error);
    return false;
  }
};

// Hàm gửi tin nhắn chào mừng
const sendWelcomeMessage = async (bot, chatId, member) => {
  const welcomeName = member.first_name;
  const welcomeMessage = `欢迎 ${welcomeName} 加入群组！! 🎉`;
  bot.sendMessage(chatId, welcomeMessage);
};

// Phần còn lại của file sẽ import các controller khác
const { 
  handleClearCommand,
  handleRateCommand,
  handleExchangeRateCommand,
  handleDualRateCommand,
  handleDeleteCommand
} = require('./groupCommands');

const {
  handlePlusCommand,
  handleMinusCommand,
  handlePercentCommand
} = require('./transactionCommands');

const {
  handleHideCardCommand,
  handleShowCardCommand,
  handleListHiddenCardsCommand
} = require('./cardCommands');

const {
  handleAddOperatorCommand,
  handleRemoveOperatorCommand,
  handleListUsersCommand,
  handleCurrencyUnitCommand,
  handleSetUsdtAddressCommand,
  handleGetUsdtAddressCommand,
  handleSetOwnerCommand,
  handleRemoveCommand,
  handleMigrateDataCommand
} = require('./userCommands');

const {
  handleCalculateUsdtCommand,
  handleCalculateVndCommand,
  handleMathExpression,
  handleTrc20Address,
  handleReportCommand
} = require('./utilCommands');

const {
  handleImageBankInfo,
  handleReplyImageBankInfo
} = require('./imageCommands');

module.exports = {
  handleMessage
}; 