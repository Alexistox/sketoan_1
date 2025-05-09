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
const { isUserOwner, isUserAdmin, isUserOperator } = require('../utils/permissions');

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
      // Kiểm tra quyền Operator
      if (await isUserOperator(userId, chatId)) {
        await handleClearCommand(bot, chatId, userId, firstName);
      } else {
        bot.sendMessage(chatId, "⛔ 您无权使用此命令！需要操作员权限。");
      }
      return;
    }
    
    if (messageText === '结束') {
      await handleReportCommand(bot, chatId, firstName);
      return;
    }
    
    if (messageText.startsWith('设置费率')) {
      // Kiểm tra quyền Operator
      if (await isUserOperator(userId, chatId)) {
        await handleRateCommand(bot, msg);
      } else {
        bot.sendMessage(chatId, "⛔ 您无权使用此命令！需要操作员权限。");
      }
      return;
    }
    
    if (messageText.startsWith('设置汇率')) {
      // Kiểm tra quyền Operator
      if (await isUserOperator(userId, chatId)) {
        await handleExchangeRateCommand(bot, msg);
      } else {
        bot.sendMessage(chatId, "⛔ 您无权使用此命令！需要操作员权限。");
      }
      return;
    }
    
    if (messageText.startsWith('下发')) {
      // Kiểm tra quyền Operator
      if (await isUserOperator(userId, chatId)) {
        await handlePercentCommand(bot, msg);
      } else {
        bot.sendMessage(chatId, "⛔ 您无权使用此命令！需要操作员权限。");
      }
      return;
    }
    
    // Lệnh quản lý operators
    if (messageText.startsWith('加操作人')) {
      // Kiểm tra quyền Admin
      if (await isUserAdmin(userId)) {
        await handleAddOperatorCommand(bot, msg);
      } else {
        bot.sendMessage(chatId, "⛔ 只有机器人所有者和管理员才能使用此命令！");
      }
      return;
    }
    
    if (messageText.startsWith('移除操作人')) {
      // Kiểm tra quyền Admin
      if (await isUserAdmin(userId)) {
        await handleRemoveOperatorCommand(bot, msg);
      } else {
        bot.sendMessage(chatId, "⛔ 只有机器人所有者和管理员才能使用此命令！");
      }
      return;
    }
    
    // Xử lý các lệnh bắt đầu bằng "/"
    if (messageText.startsWith('/')) {
      if (messageText === '/start') {
        bot.sendMessage(chatId, "欢迎使用交易管理机器人！");
        return;
      }
      
      if (messageText === '/help') {
        await handleHelpCommand(bot, chatId);
        return;
      }
      
      if (messageText === '/off') {
        bot.sendMessage(chatId, "感谢大家的辛勤付出，祝大家发财！ 💰💸🍀");
        return;
      }
      
      // Các lệnh quản lý admin - chỉ owner
      if (messageText.startsWith('/ad ')) {
        await handleAddAdminCommand(bot, msg);
        return;
      }
      
      if (messageText.startsWith('/removead ')) {
        await handleRemoveAdminCommand(bot, msg);
        return;
      }
      
      if (messageText === '/admins') {
        await handleListAdminsCommand(bot, msg);
        return;
      }
      
      // Các lệnh quản lý operator - admin và owner
      if (messageText.startsWith('/op ')) {
        await handleAddOperatorInGroupCommand(bot, msg);
        return;
      }
      
      if (messageText.startsWith('/removeop ')) {
        await handleRemoveOperatorInGroupCommand(bot, msg);
        return;
      }
      
      if (messageText === '/ops') {
        await handleListOperatorsCommand(bot, msg);
        return;
      }
      
      if (messageText.startsWith('/m ')) {
        // Kiểm tra quyền Operator
        if (await isUserOperator(userId, chatId)) {
          await handleCurrencyUnitCommand(bot, msg);
        } else {
          bot.sendMessage(chatId, "⛔ 您无权使用此命令！需要操作员权限。");
        }
        return;
      }
      
      // Lệnh chuyển đổi tiền tệ - tất cả user
      if (messageText.startsWith('/t ')) {
        await handleCalculateUsdtCommand(bot, msg);
        return;
      }
      
      if (messageText.startsWith('/v ')) {
        await handleCalculateVndCommand(bot, msg);
        return;
      }
      
      if (messageText.startsWith('/d ')) {
        // Kiểm tra quyền Operator
        if (await isUserOperator(userId, chatId)) {
          await handleDualRateCommand(bot, msg);
        } else {
          bot.sendMessage(chatId, "⛔ 您无权使用此命令！需要操作员权限。");
        }
        return;
      }
      
      if (messageText.startsWith('/x ')) {
        // Kiểm tra quyền Operator
        if (await isUserOperator(userId, chatId)) {
          await handleHideCardCommand(bot, msg);
        } else {
          bot.sendMessage(chatId, "⛔ 您无权使用此命令！需要操作员权限。");
        }
        return;
      }
      
      if (messageText.startsWith('/sx ')) {
        // Kiểm tra quyền Operator
        if (await isUserOperator(userId, chatId)) {
          await handleShowCardCommand(bot, msg);
        } else {
          bot.sendMessage(chatId, "⛔ 您无权使用此命令！需要操作员权限。");
        }
        return;
      }
      
      if (messageText === '/hiddenCards') {
        // Kiểm tra quyền Operator
        if (await isUserOperator(userId, chatId)) {
          await handleListHiddenCardsCommand(bot, msg);
        } else {
          bot.sendMessage(chatId, "⛔ 您无权使用此命令！需要操作员权限。");
        }
        return;
      }
      
      if (messageText.startsWith('/delete')) {
        // Kiểm tra quyền Operator
        if (await isUserOperator(userId, chatId)) {
          await handleDeleteCommand(bot, msg);
        } else {
          bot.sendMessage(chatId, "⛔ 您无权使用此命令！需要操作员权限。");
        }
        return;
      }
      
      // Lệnh thiết lập địa chỉ USDT - chỉ admin và owner
      if (messageText.startsWith('/usdt ')) {
        if (await isUserAdmin(userId)) {
          await handleSetUsdtAddressCommand(bot, msg);
        } else {
          bot.sendMessage(chatId, "⛔ 只有机器人所有者和管理员才能使用此命令！");
        }
        return;
      }
      
      if (messageText === '/u') {
        await handleGetUsdtAddressCommand(bot, msg);
        return;
      }
      
      if (messageText === '/users') {
        await handleListUsersCommand(bot, msg);
        return;
      }
      
      if (messageText === '/report') {
        await handleReportCommand(bot, chatId, firstName);
        return;
      }
      
      // Lệnh thiết lập owner - chỉ owner
      if (messageText.startsWith('/setowner')) {
        if (await isUserOwner(userId)) {
          await handleSetOwnerCommand(bot, msg);
        } else {
          bot.sendMessage(chatId, "⛔ 只有机器人所有者才能使用此命令！");
        }
        return;
      }
      
      // Lệnh xóa operator - chỉ owner bảo trì
      if (messageText.startsWith('/remove ')) {
        if (await isUserOwner(userId)) {
          await handleRemoveCommand(bot, msg);
        } else {
          bot.sendMessage(chatId, "⛔ 只有机器人所有者才能使用此命令！");
        }
        return;
      }
      
      // Lệnh migrate data - chỉ owner bảo trì
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
      // Kiểm tra quyền Operator
      if (await isUserOperator(userId, chatId)) {
        await handlePlusCommand(bot, msg);
      } else {
        bot.sendMessage(chatId, "⛔ 您无权使用此命令！需要操作员权限。");
      }
      return;
    }
    
    if (messageText.startsWith('-')) {
      // Kiểm tra quyền Operator
      if (await isUserOperator(userId, chatId)) {
        await handleMinusCommand(bot, msg);
      } else {
        bot.sendMessage(chatId, "⛔ 您无权使用此命令！需要操作员权限。");
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
      
      // Nếu chưa có owner, user đầu tiên sẽ là owner và admin
      const isFirstUser = !ownerExists;
      
      user = new User({
        userId: userId.toString(),
        username,
        firstName,
        lastName,
        isOwner: isFirstUser,
        isAdmin: isFirstUser,
        groupPermissions: []
      });
      
      await user.save();
      
      if (isFirstUser) {
        console.log(`User ${username} (ID: ${userId}) is now the bot owner and admin`);
      }
    }
    
    return user;
  } catch (error) {
    console.error('Error in checkAndRegisterUser:', error);
    return null;
  }
};

// Hàm gửi tin nhắn chào mừng
const sendWelcomeMessage = async (bot, chatId, member) => {
  try {
    // Kiểm tra xem đây có phải là bot của chúng ta đang tham gia không
    if (member.is_bot && member.username === bot.options.username) {
      // Bot chúng ta vừa được thêm vào nhóm, gửi thông báo xin quyền admin
      const welcomeMessage = `感谢将我添加到群组中！🎉\n\n为了使我能够正常工作，请授予我管理员权限。这将使我能够：\n• 管理入群申请\n• 发送群链接\n• 查看消息统计\n\n请群主或管理员点击下方按钮授予权限。`;
      
      const keyboard = {
        inline_keyboard: [
          [
            { text: '授予管理员权限', callback_data: 'grant_admin_permission' },
            { text: '查看使用说明', callback_data: 'show_instructions' }
          ]
        ]
      };
      
      bot.sendMessage(chatId, welcomeMessage, {
        reply_markup: JSON.stringify(keyboard)
      });
    } else {
      // Người dùng thông thường tham gia nhóm
      const welcomeName = member.first_name;
      const welcomeMessage = `欢迎 ${welcomeName} 加入群组！! 🎉`;
      bot.sendMessage(chatId, welcomeMessage);
    }
  } catch (error) {
    console.error('Error in sendWelcomeMessage:', error);
  }
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
  handleMigrateDataCommand,
  handleAddAdminCommand,
  handleRemoveAdminCommand,
  handleListAdminsCommand,
  handleAddOperatorInGroupCommand,
  handleRemoveOperatorInGroupCommand,
  handleListOperatorsCommand
} = require('./userCommands');

const {
  handleCalculateUsdtCommand,
  handleCalculateVndCommand,
  handleMathExpression,
  handleTrc20Address,
  handleReportCommand,
  handleHelpCommand
} = require('./utilCommands');

const {
  handleImageBankInfo,
  handleReplyImageBankInfo
} = require('./imageCommands');

module.exports = {
  handleMessage
}; 