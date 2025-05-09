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

// Handle % as alternative for payment command (同样处理为下发命令)
bot.onText(/^%/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    const username = msg.from.username;
    
    if (!await isUsernameAllowed(username)) {
      await bot.sendMessage(chatId, "您没有权限使用此命令。");
      return;
    }
    
    // Convert % command to 下发 format
    const messageText = msg.text.replace(/^%/, '下发');
    const modifiedMsg = { ...msg, text: messageText };
    
    await handleTransaction(modifiedMsg, bot);
  } catch (error) {
    console.error('Error handling % payment command:', error);
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

// Handle report command (for both /report and 结束)
bot.onText(/^(\/report|结束)$/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    const username = msg.from.username;
    const senderName = msg.from.first_name;
    
    if (!await isUsernameAllowed(username)) {
      await bot.sendMessage(chatId, "您没有权限使用此命令。");
      return;
    }

    await handleReportCommand(bot, chatId, senderName);
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
bot.onText(/^(设置操作人|移除操作人|\/users)$/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    const username = msg.from.username;
    
    if (!await isUsernameAllowed(username)) {
      await bot.sendMessage(chatId, "您没有权限使用此命令。");
      return;
    }

    const command = msg.text;
    let handleCommand;
    
    if (command === '设置操作人') {
      // 设置操作人 is an alias for /op
      handleCommand = '/op';
    } else if (command === '移除操作人') {
      // 移除操作人 is an alias for /removeop
      handleCommand = '/removeop';
    } else {
      handleCommand = command;
    }
    
    await handleUserManagement(chatId, handleCommand, bot);
  } catch (error) {
    console.error('Error handling user management command:', error);
    await bot.sendMessage(msg.chat.id, "处理用户管理命令时出错，请重试。");
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

// Handle operator add commands (with parameters)
bot.onText(/^(设置操作人|\/op)\s+(.+)$/, async (msg, match) => {
  try {
    const chatId = msg.chat.id;
    const username = msg.from.username;
    const targetUsername = match[2].trim();
    
    if (!await isUsernameAllowed(username)) {
      await bot.sendMessage(chatId, "您没有权限使用此命令。");
      return;
    }
    
    // Handle by converting to the standardized format for the existing handler
    const modifiedMsg = { ...msg, text: `加操作人 ${targetUsername}` };
    await handleAddOperatorCommand(bot, modifiedMsg);
  } catch (error) {
    console.error('Error handling operator add command:', error);
    await bot.sendMessage(msg.chat.id, "添加操作人时出错，请重试。");
  }
});

// Handle operator remove commands (with parameters)
bot.onText(/^(移除操作人|\/removeop)\s+(.+)$/, async (msg, match) => {
  try {
    const chatId = msg.chat.id;
    const username = msg.from.username;
    const targetUsername = match[2].trim();
    
    if (!await isUsernameAllowed(username)) {
      await bot.sendMessage(chatId, "您没有权限使用此命令。");
      return;
    }
    
    // Create a modified message with the standard command format
    const modifiedMsg = { ...msg, text: `移除操作人 ${targetUsername}` };
    await handleRemoveOperatorCommand(bot, modifiedMsg);
  } catch (error) {
    console.error('Error handling operator remove command:', error);
    await bot.sendMessage(msg.chat.id, "移除操作人时出错，请重试。");
  }
});

// Start Express server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 