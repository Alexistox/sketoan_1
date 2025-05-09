require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const mongoose = require('mongoose');
const moment = require('moment');
const { handleTransaction } = require('./handlers/transactionHandlers');
const { handleMessage } = require('./handlers/messageLogHandler');
const { handleBankImage } = require('./handlers/imageHandler');
const { handleTrc20Address, isTrc20Address } = require('./handlers/trc20Handler');
const { handleReportCommand, handleClearCommand, handleDualCommand, handleCalculateCommand } = require('./handlers/reportHandler');
const { handleUserManagement, handleCardManagement, isUsernameAllowed } = require('./handlers/userHandler');
const Settings = require('./models/Settings');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Create Express app
const app = express();
const port = process.env.PORT || 3000;

// Create bot instance
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Handle /start command
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, "欢迎使用交易机器人！");
});

// Handle addition command
bot.onText(/^\+/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    const username = msg.from.username;
    
    if (!await isUsernameAllowed(username)) {
      await bot.sendMessage(chatId, "您没有权限使用此命令。");
      return;
    }

    await handleTransaction(msg, bot);
  } catch (error) {
    console.error('Error handling addition command:', error);
    await bot.sendMessage(msg.chat.id, "处理命令时出错，请重试。");
  }
});

// Handle subtraction command
bot.onText(/^-/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    const username = msg.from.username;
    
    if (!await isUsernameAllowed(username)) {
      await bot.sendMessage(chatId, "您没有权限使用此命令。");
      return;
    }

    await handleTransaction(msg, bot);
  } catch (error) {
    console.error('Error handling subtraction command:', error);
    await bot.sendMessage(msg.chat.id, "处理命令时出错，请重试。");
  }
});

// Handle USDT payment command
bot.onText(/^下发/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    const username = msg.from.username;
    
    if (!await isUsernameAllowed(username)) {
      await bot.sendMessage(chatId, "您没有权限使用此命令。");
      return;
    }

    await handleTransaction(msg, bot);
  } catch (error) {
    console.error('Error handling USDT payment command:', error);
    await bot.sendMessage(msg.chat.id, "处理命令时出错，请重试。");
  }
});

// Handle TRC20 address
bot.onText(/^T[1-9A-Za-z]{33}$/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    const username = msg.from.username;
    
    if (!await isUsernameAllowed(username)) {
      await bot.sendMessage(chatId, "您没有权限使用此命令。");
      return;
    }

    await handleTrc20Address(msg, bot);
  } catch (error) {
    console.error('Error handling TRC20 address:', error);
    await bot.sendMessage(msg.chat.id, "处理TRC20地址时出错，请重试。");
  }
});

// Handle bank image
bot.onText(/\/c/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    const username = msg.from.username;
    
    if (!await isUsernameAllowed(username)) {
      await bot.sendMessage(chatId, "您没有权限使用此命令。");
      return;
    }

    if (msg.photo) {
      await handleBankImage(msg, bot);
    }
  } catch (error) {
    console.error('Error handling bank image:', error);
    await bot.sendMessage(msg.chat.id, "处理图片时出错，请重试。");
  }
});

// Handle photo with /c caption
bot.on('photo', async (msg) => {
  try {
    if (msg.caption && msg.caption.startsWith('/c')) {
      const chatId = msg.chat.id;
      const username = msg.from.username;
      
      if (!await isUsernameAllowed(username)) {
        await bot.sendMessage(chatId, "您没有权限使用此命令。");
        return;
      }

      await handleBankImage(msg, bot);
    }
  } catch (error) {
    console.error('Error handling photo with caption:', error);
    await bot.sendMessage(msg.chat.id, "处理图片时出错，请重试。");
  }
});

// Handle report command
bot.onText(/\/report/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    const username = msg.from.username;
    
    if (!await isUsernameAllowed(username)) {
      await bot.sendMessage(chatId, "您没有权限使用此命令。");
      return;
    }

    await handleReportCommand(chatId, bot);
  } catch (error) {
    console.error('Error handling report command:', error);
    await bot.sendMessage(msg.chat.id, "生成报告时出错，请重试。");
  }
});

// Handle clear command
bot.onText(/\/clear/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    const username = msg.from.username;
    
    if (!await isUsernameAllowed(username)) {
      await bot.sendMessage(chatId, "您没有权限使用此命令。");
      return;
    }

    await handleClearCommand(chatId, username, bot);
  } catch (error) {
    console.error('Error handling clear command:', error);
    await bot.sendMessage(msg.chat.id, "处理清除命令时出错，请重试。");
  }
});

// Handle dual command (rate and exchange rate)
bot.onText(/^\/d/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    const username = msg.from.username;
    
    if (!await isUsernameAllowed(username)) {
      await bot.sendMessage(chatId, "您没有权限使用此命令。");
      return;
    }

    await handleDualCommand(chatId, msg.text, username, bot);
  } catch (error) {
    console.error('Error handling dual command:', error);
    await bot.sendMessage(msg.chat.id, "处理双重命令时出错，请重试。");
  }
});

// Handle calculate commands
bot.onText(/^\/[tv]/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    const username = msg.from.username;
    
    if (!await isUsernameAllowed(username)) {
      await bot.sendMessage(chatId, "您没有权限使用此命令。");
      return;
    }

    await handleCalculateCommand(chatId, msg.text, bot);
  } catch (error) {
    console.error('Error handling calculate command:', error);
    await bot.sendMessage(msg.chat.id, "计算时出错，请重试。");
  }
});

// Handle user management commands
bot.onText(/^(加操作人|移除操作人|\/users)$/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    const username = msg.from.username;
    
    if (!await isUsernameAllowed(username)) {
      await bot.sendMessage(chatId, "您没有权限使用此命令。");
      return;
    }

    await handleUserManagement(chatId, msg.text, bot);
  } catch (error) {
    console.error('Error handling user management:', error);
    await bot.sendMessage(msg.chat.id, "处理用户管理时出错，请重试。");
  }
});

// Handle card management commands
bot.onText(/^(\/x|\/sx|\/hiddenCards)/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    const username = msg.from.username;
    
    if (!await isUsernameAllowed(username)) {
      await bot.sendMessage(chatId, "您没有权限使用此命令。");
      return;
    }

    await handleCardManagement(chatId, msg.text, bot);
  } catch (error) {
    console.error('Error handling card management:', error);
    await bot.sendMessage(msg.chat.id, "处理卡密管理时出错，请重试。");
  }
});

// Handle currency unit change
bot.onText(/^\/m/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    const username = msg.from.username;
    
    if (!await isUsernameAllowed(username)) {
      await bot.sendMessage(chatId, "您没有权限使用此命令。");
      return;
    }

    const newUnit = msg.text.substring(3).trim();
    if (!newUnit) {
      await bot.sendMessage(chatId, "请指定新的货币单位。");
      return;
    }

    await Settings.findOneAndUpdate(
      { key: 'CURRENCY_UNIT' },
      { value: newUnit },
      { upsert: true }
    );

    await bot.sendMessage(chatId, `货币单位已更改为: ${newUnit}`);
  } catch (error) {
    console.error('Error handling currency unit change:', error);
    await bot.sendMessage(msg.chat.id, "更改货币单位时出错，请重试。");
  }
});

// Handle end session command
bot.onText(/^\/off/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    const username = msg.from.username;
    
    if (!await isUsernameAllowed(username)) {
      await bot.sendMessage(chatId, "您没有权限使用此命令。");
      return;
    }

    await bot.sendMessage(chatId, "再见！");
  } catch (error) {
    console.error('Error handling end session command:', error);
    await bot.sendMessage(msg.chat.id, "处理结束会话命令时出错，请重试。");
  }
});

// Handle all messages for logging
bot.on('message', async (msg) => {
  try {
    await handleMessage(msg);
  } catch (error) {
    console.error('Error handling message:', error);
  }
});

// Error handling for polling
bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

// Xử lý các callback query từ inline keyboard
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const callbackData = query.data;
  
  try {
    // Kiểm tra quyền người dùng trong nhóm
    const chatMember = await bot.getChatMember(chatId, userId);
    
    if (callbackData === 'grant_admin_permission') {
      // Chỉ chủ nhóm hoặc admin mới có quyền thay đổi admin của bot
      if (chatMember.status !== 'creator' && chatMember.status !== 'administrator') {
        await bot.answerCallbackQuery(query.id, {
          text: "⚠️ 只有群主或管理员才能授予机器人权限",
          show_alert: true
        });
        return;
      }
      
      // Hướng dẫn cách cấp quyền admin
      const instructions = `🔄 *如何设置机器人为管理员* 🔄\n\n1. 点击群组头像或名称\n2. 选择"管理群组"\n3. 选择"管理员"\n4. 点击"添加管理员"\n5. 找到并选择本机器人\n6. 启用以下权限:\n   - 添加新管理员\n   - 删除消息\n   - 邀请用户\n   - 限制用户\n   - 置顶消息\n   - 管理语音聊天\n\n完成后，机器人将自动检测权限并启用高级功能。`;
      
      await bot.sendMessage(chatId, instructions, { parse_mode: 'Markdown' });
      
      // Sau khi gửi hướng dẫn, bắt đầu kiểm tra trạng thái admin
      await bot.answerCallbackQuery(query.id, {
        text: "✅ 已发送设置指南，请按照步骤操作",
        show_alert: false
      });
      
      // Bắt đầu kiểm tra định kỳ quyền admin
      checkAdminPermissions(bot, chatId);
    } 
    else if (callbackData === 'show_instructions') {
      // Hiển thị hướng dẫn sử dụng bot
      const botInstructions = `📋 *交易管理机器人使用指南* 📋\n\n*权限系统:*\n👑 所有者 - 拥有所有权限，可以添加/删除管理员\n🔰 管理员 - 可以管理USDT地址、添加/删除操作员\n🔹 操作员 - 可以执行交易和设置命令\n👤 普通用户 - 只能使用基本查询功能\n\n*基本命令 (所有用户):*\n/start - 启动机器人\n/help - 显示此帮助信息\n/report - 显示交易报告\n\n*更多详细命令请使用 /help 查看*`;
      
      await bot.sendMessage(chatId, botInstructions, { parse_mode: 'Markdown' });
      await bot.answerCallbackQuery(query.id);
    }
  } catch (error) {
    console.error('Error handling callback query:', error);
    await bot.answerCallbackQuery(query.id, {
      text: "处理请求时出错，请稍后再试",
      show_alert: true
    });
  }
});

// Hàm kiểm tra quyền admin của bot
async function checkAdminPermissions(bot, chatId) {
  try {
    // Lấy thông tin bot
    const botUser = await bot.getMe();
    
    // Kiểm tra quyền của bot trong nhóm
    const botStatus = await bot.getChatMember(chatId, botUser.id);
    
    if (botStatus.status === 'administrator') {
      // Bot đã được cấp quyền admin
      const permissions = botStatus.can_invite_users && 
                          botStatus.can_restrict_members && 
                          botStatus.can_pin_messages;
      
      if (permissions) {
        // Kiểm tra xem nhóm có phải là supergroup không
        const chat = await bot.getChat(chatId);
        
        if (chat.type === 'supergroup') {
          // Gửi thông báo thành công và cung cấp link invite
          const chatInviteLink = await bot.exportChatInviteLink(chatId);
          
          const successMessage = `✅ *设置成功* ✅\n\n机器人已成功获得管理员权限，现在可以使用所有功能。\n\n*群组链接:*\n${chatInviteLink}`;
          await bot.sendMessage(chatId, successMessage, { parse_mode: 'Markdown' });
          
          // Thiết lập chế độ kiểm duyệt thành viên mới
          try {
            await bot.setChatPermissions(chatId, {
              can_send_messages: true,
              can_send_media_messages: true,
              can_send_polls: true,
              can_send_other_messages: true,
              can_add_web_page_previews: true,
              can_change_info: false,
              can_invite_users: false,
              can_pin_messages: false
            });
            
            // Bật kiểm duyệt thành viên mới
            // Telegram Bot API không có phương thức trực tiếp để bật tính năng này
            // Chúng ta chỉ có thể hướng dẫn admin cách làm
            const moderationGuide = `*重要提示：*\n\n要启用新成员审核功能，请遵循以下步骤：\n\n1. 点击群组头像或名称\n2. 选择"管理群组"\n3. 选择"权限"\n4. 启用"批准新成员"选项\n\n此功能将要求新加入的成员获得管理员批准。`;
            
            await bot.sendMessage(chatId, moderationGuide, { parse_mode: 'Markdown' });
          } catch (error) {
            console.error('Error setting chat permissions:', error);
          }
          
          return;
        } else {
          // Nhóm không phải là supergroup, gửi hướng dẫn chuyển đổi
          const upgradeGuide = `⚠️ *需要升级到超级群组* ⚠️\n\n要使用所有功能，需要将此群组升级到超级群组。请按照以下步骤操作：\n\n1. 点击群组头像或名称\n2. 选择"管理群组"\n3. 点击"群组类型"\n4. 选择"升级到超级群组"\n\n升级后，机器人将自动启用所有功能。`;
          await bot.sendMessage(chatId, upgradeGuide, { parse_mode: 'Markdown' });
          
          // Lên lịch kiểm tra lại sau 1 phút
          setTimeout(() => checkAdminPermissions(bot, chatId), 60000);
          return;
        }
      }
    }
    
    // Nếu chưa có quyền admin hoặc quyền không đủ, lên lịch kiểm tra lại sau 1 phút
    setTimeout(() => checkAdminPermissions(bot, chatId), 60000);
    
  } catch (error) {
    console.error('Error checking admin permissions:', error);
  }
}

// Start Express server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 