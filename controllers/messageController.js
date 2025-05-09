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
    
    // Đảm bảo người dùng gửi tin nhắn được lưu vào database
    if (msg.from && !msg.from.is_bot) {
      await registerNewMember(msg.from, chatId);
    }
    
    // Xử lý thành viên mới tham gia nhóm
    if (msg.new_chat_members) {
      const newMembers = msg.new_chat_members;
      
      // Kiểm tra xem bot có trong danh sách thành viên mới không
      const botInfo = await bot.getMe();
      const botId = botInfo.id.toString();
      const botJoined = newMembers.some(member => member.id.toString() === botId);
      
      if (botJoined) {
        // Bot vừa được thêm vào nhóm
        await handleBotAddedToGroup(bot, msg);
      } else {
        // Người dùng mới được thêm vào nhóm
        for (const member of newMembers) {
          // Gửi tin nhắn chào mừng
          await sendWelcomeMessage(bot, chatId, member);
          
          // Lưu thông tin người dùng mới vào database
          await registerNewMember(member, chatId);
        }
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

// Hàm đăng ký thành viên mới được thêm vào nhóm
const registerNewMember = async (member, chatId) => {
  try {
    const userId = member.id.toString();
    const username = member.username || member.first_name || 'unknown';
    const firstName = member.first_name || '';
    const lastName = member.last_name || '';
    
    // Kiểm tra xem người dùng đã tồn tại trong database chưa
    let user = await User.findOne({ userId: userId });
    
    if (!user) {
      // Tạo người dùng mới
      user = new User({
        userId: userId,
        username: username,
        firstName: firstName,
        lastName: lastName,
        isOwner: false,
        isAdmin: false,
        groupPermissions: [{ chatId: chatId.toString(), isOperator: false }]
      });
      
      await user.save();
      console.log(`New user registered: ${username} (ID: ${userId}) in group ${chatId}`);
    } else {
      // Cập nhật thông tin người dùng
      if (user.firstName !== firstName || user.lastName !== lastName || user.username !== username) {
        user.firstName = firstName;
        user.lastName = lastName;
        user.username = username;
        await user.save();
      }
      
      // Kiểm tra xem người dùng đã có trong nhóm chưa
      const existingGroupPerm = user.groupPermissions.find(perm => perm.chatId === chatId.toString());
      if (!existingGroupPerm) {
        user.groupPermissions.push({ chatId: chatId.toString(), isOperator: false });
        await user.save();
      }
    }
    
    return user;
  } catch (error) {
    console.error('Error in registerNewMember:', error);
    return null;
  }
};

// Hàm xử lý khi bot được thêm vào nhóm mới
const handleBotAddedToGroup = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const chatTitle = msg.chat.title || 'Nhóm';
    
    console.log(`Bot được thêm vào nhóm: ${chatTitle} (ID: ${chatId})`);
    
    // Thêm người đã mời bot vào nhóm như một người dùng
    const inviter = msg.from;
    if (inviter) {
      await registerNewMember(inviter, chatId);
    }
    
    // Gửi tin nhắn chào mừng và hướng dẫn
    const welcomeMessage = `👋 感谢您邀请我加入 "${chatTitle}" 群组！

🔹 我将帮助您管理交易记录和操作人员。
🔹 您可以使用 /help 命令查看所有可用功能。
🔹 建议将我设置为群组管理员，以便我能够记录所有群组成员的信息。

👤 您已被注册在我的数据库中。如果您是第一个邀请我的用户，您将成为机器人的所有者。`;
    
    bot.sendMessage(chatId, welcomeMessage);
    
    // Tạo cấu trúc nhóm mới trong database
    let group = await Group.findOne({ chatId: chatId.toString() });
    if (!group) {
      group = new Group({
        chatId: chatId.toString(),
        operators: []
      });
      await group.save();
    }
    
    // Kiểm tra xem đã có owner chưa
    const ownerExists = await User.findOne({ isOwner: true });
    
    // Nếu chưa có owner và người thêm bot không phải là bot
    if (!ownerExists && inviter && inviter.id !== bot.id) {
      const user = await User.findOne({ userId: inviter.id.toString() });
      if (user) {
        user.isOwner = true;
        user.isAdmin = true;
        await user.save();
        
        // Thêm người thêm bot vào danh sách operator của nhóm
        if (!group.operators.some(op => op.userId === user.userId)) {
          group.operators.push({
            userId: user.userId,
            username: user.username,
            dateAdded: new Date()
          });
          await group.save();
        }
        
        // Thông báo cho người dùng
        bot.sendMessage(chatId, `✅ 用户 @${user.username} 已被设置为机器人所有者和管理员`);
      }
    }
    
    // Lấy thông tin về bot
    const botInfo = await bot.getMe();
    console.log(`Bot Info: ${JSON.stringify(botInfo)}`);
    
    // Kiểm tra nếu bot có quyền admin để lấy danh sách thành viên
    try {
      const chatAdmins = await bot.getChatAdministrators(chatId);
      const isBotAdmin = chatAdmins.some(admin => admin.user.id === botInfo.id);
      
      if (isBotAdmin) {
        // Nếu bot là admin, thử lấy danh sách thành viên
        // Lưu ý: Telegram Bot API không cung cấp phương thức trực tiếp để lấy tất cả thành viên
        // Đây chỉ là giải pháp dự phòng, nhưng có thể không hoạt động với nhóm lớn
        bot.sendMessage(chatId, "🔍 正在检索群组成员...");
        
        // Vì giới hạn API, chúng ta chỉ có thể lấy các admin
        for (const admin of chatAdmins) {
          await registerNewMember(admin.user, chatId);
        }
        
        bot.sendMessage(chatId, "✅ 已注册群组管理员信息");
      } else {
        // Nếu bot không phải admin, gợi ý người dùng cấp quyền admin
        bot.sendMessage(chatId, "ℹ️ 建议将我设置为群组管理员，以便我能够更好地为您服务。");
      }
    } catch (error) {
      console.error(`Error checking admin status: ${error.message}`);
    }
    
  } catch (error) {
    console.error('Error in handleBotAddedToGroup:', error);
    bot.sendMessage(msg.chat.id, "处理加入群组时出错。请稍后再试。");
  }
};

module.exports = {
  handleMessage,
  checkAndRegisterUser,
  registerNewMember,
  handleBotAddedToGroup
}; 