const Group = require('../models/Group');
const Transaction = require('../models/Transaction');
const Card = require('../models/Card');
const Config = require('../models/Config');
const { formatSmart, formatRateValue, formatTelegramMessage, isTrc20Address, formatDateUS } = require('../utils/formatter');
const { getDepositHistory, getPaymentHistory, getCardSummary } = require('./groupCommands');
const { getButtonsStatus, getInlineKeyboard } = require('./userCommands');

/**
 * Xử lý lệnh tính toán USDT (/t)
 */
const handleCalculateUsdtCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const messageText = msg.text;
    
    // Phân tích tin nhắn
    const parts = messageText.split('/t ');
    if (parts.length !== 2) {
      bot.sendMessage(chatId, "语法无效。例如: /t 50000");
      return;
    }
    
    // Lấy số tiền VND
    const amount = parseFloat(parts[1].trim());
    if (isNaN(amount)) {
      bot.sendMessage(chatId, "金额无效。");
      return;
    }
    
    // Tìm group
    const group = await Group.findOne({ chatId: chatId.toString() });
    if (!group || !group.exchangeRate || !group.rate) {
      bot.sendMessage(chatId, "请先设置汇率和费率。");
      return;
    }
    
    // Tính toán
    const xValue = group.rate;
    const yValue = group.exchangeRate;
    const usdtValue = (amount / yValue) * (1 - xValue / 100);
    
    // Lấy đơn vị tiền tệ
    const configCurrency = await Config.findOne({ key: 'CURRENCY_UNIT' });
    const currencyUnit = configCurrency ? configCurrency.value : 'USDT';
    
    // Gửi kết quả
    bot.sendMessage(
      chatId,
      `🔄 ${formatSmart(amount)} ➡️ ${currencyUnit} ${formatSmart(usdtValue)}\n` +
      `(汇率: ${formatRateValue(yValue)}, 费率: ${formatRateValue(xValue)}%)`
    );
  } catch (error) {
    console.error('Error in handleCalculateUsdtCommand:', error);
    bot.sendMessage(msg.chat.id, "处理计算USDT命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh tính toán VND (/v)
 */
const handleCalculateVndCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const messageText = msg.text;
    
    // Phân tích tin nhắn
    const parts = messageText.split('/v ');
    if (parts.length !== 2) {
      bot.sendMessage(chatId, "语法无效。例如: /v 100");
      return;
    }
    
    // Lấy số tiền USDT
    const amount = parseFloat(parts[1].trim());
    if (isNaN(amount)) {
      bot.sendMessage(chatId, "金额无效。");
      return;
    }
    
    // Tìm group
    const group = await Group.findOne({ chatId: chatId.toString() });
    if (!group || !group.exchangeRate || !group.rate) {
      bot.sendMessage(chatId, "请先设置汇率和费率。");
      return;
    }
    
    // Tính toán
    const xValue = group.rate;
    const yValue = group.exchangeRate;
    const vndValue = (amount / (1 - xValue / 100)) * yValue;
    
    // Lấy đơn vị tiền tệ
    const configCurrency = await Config.findOne({ key: 'CURRENCY_UNIT' });
    const currencyUnit = configCurrency ? configCurrency.value : 'USDT';
    
    // Gửi kết quả
    bot.sendMessage(
      chatId,
      `🔄 ${currencyUnit} ${formatSmart(amount)} ➡️ ${formatSmart(vndValue)}\n` +
      `(汇率: ${formatRateValue(yValue)}, 费率: ${formatRateValue(xValue)}%)`
    );
  } catch (error) {
    console.error('Error in handleCalculateVndCommand:', error);
    bot.sendMessage(msg.chat.id, "处理计算VND命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý biểu thức toán học
 */
const handleMathExpression = async (bot, chatId, expression, senderName) => {
  try {
    // Tính toán kết quả
    let result;
    try {
      result = eval(expression);
    } catch (error) {
      bot.sendMessage(chatId, "表达式无效，请重试。");
      return;
    }
    
    if (isNaN(result)) {
      bot.sendMessage(chatId, "计算结果无效。");
      return;
    }
    
    // Gửi kết quả
    bot.sendMessage(
      chatId,
      `🧮 ${expression} = ${formatSmart(result)}`
    );
  } catch (error) {
    console.error('Error in handleMathExpression:', error);
    bot.sendMessage(chatId, "处理数学表达式时出错。请稍后再试。");
  }
};

/**
 * Xử lý địa chỉ TRC20
 */
const handleTrc20Address = async (bot, chatId, address, senderName) => {
  try {
    // Gửi kết quả
    bot.sendMessage(
      chatId,
      `🔍 USDT-TRC20 地址:\n\`${address}\``
    );
  } catch (error) {
    console.error('Error in handleTrc20Address:', error);
    bot.sendMessage(chatId, "处理TRC20地址时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh báo cáo (/report hoặc 结束)
 */
const handleReportCommand = async (bot, chatId, senderName) => {
  try {
    // Tìm group
    const group = await Group.findOne({ chatId: chatId.toString() });
    if (!group) {
      bot.sendMessage(chatId, "没有可用的数据。");
      return;
    }
    
    // Lấy đơn vị tiền tệ
    const configCurrency = await Config.findOne({ key: 'CURRENCY_UNIT' });
    const currencyUnit = configCurrency ? configCurrency.value : 'USDT';
    
    // Lấy thông tin tất cả các giao dịch trong ngày
    const todayDate = new Date();
    const lastClearDate = group.lastClearDate;
    
    // Lấy tất cả các giao dịch deposit/withdraw
    const depositTransactions = await Transaction.find({
      chatId: chatId.toString(),
      type: { $in: ['deposit', 'withdraw'] },
      timestamp: { $gt: lastClearDate },
      skipped: { $ne: true }
    }).sort({ timestamp: 1 });
    
    // Lấy tất cả các giao dịch payment
    const paymentTransactions = await Transaction.find({
      chatId: chatId.toString(),
      type: 'payment',
      timestamp: { $gt: lastClearDate },
      skipped: { $ne: true }
    }).sort({ timestamp: 1 });
    
    // Format dữ liệu giao dịch deposit
    const depositEntries = depositTransactions.map((t, index) => {
      return {
        id: index + 1,
        details: t.details,
        messageId: t.messageId || null,
        chatLink: t.messageId ? `https://t.me/c/${chatId.toString().replace('-100', '')}/${t.messageId}` : null,
        timestamp: t.timestamp,
        senderName: t.senderName || ''
      };
    });
    
    // Format dữ liệu giao dịch payment
    const paymentEntries = paymentTransactions.map((t, index) => {
      return {
        id: index + 1,
        details: t.details,
        messageId: t.messageId || null,
        chatLink: t.messageId ? `https://t.me/c/${chatId.toString().replace('-100', '')}/${t.messageId}` : null,
        timestamp: t.timestamp,
        senderName: t.senderName || ''
      };
    });
    
    // Lấy thông tin thẻ
    const cardSummary = await getCardSummary(chatId);
    
    // Tạo response JSON với tất cả giao dịch
    const responseData = {
      date: formatDateUS(todayDate),
      depositData: { 
        entries: depositEntries, 
        totalCount: depositEntries.length 
      },
      paymentData: { 
        entries: paymentEntries, 
        totalCount: paymentEntries.length 
      },
      rate: formatRateValue(group.rate) + "%",
      exchangeRate: formatRateValue(group.exchangeRate),
      totalAmount: formatSmart(group.totalVND),
      totalUSDT: formatSmart(group.totalUSDT),
      paidUSDT: formatSmart(group.usdtPaid),
      remainingUSDT: formatSmart(group.remainingUSDT),
      currencyUnit,
      cards: cardSummary
    };
    
    // Format và gửi tin nhắn
    const response = formatTelegramMessage(responseData);
    
    // Kiểm tra trạng thái hiển thị buttons
    const showButtons = await getButtonsStatus(chatId);
    const keyboard = showButtons ? await getInlineKeyboard(chatId) : null;
    
    bot.sendMessage(chatId, response, { 
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
    
  } catch (error) {
    console.error('Error in handleReportCommand:', error);
    bot.sendMessage(chatId, "处理报告命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh trợ giúp (/help)
 */
const handleHelpCommand = async (bot, chatId) => {
  try {
    const helpMessage = `
📖 *交易机器人使用说明* 📖

⚠️ *安全提醒：请勿随意泄露群组信息和USDT地址，所有操作请多方确认！*

*【权限分级】*
👑 所有者：最高权限，管理所有设置和成员
🔰 管理员：管理操作员和USDT地址
🔹 操作员：日常交易与设置
👤 普通用户：仅可查询和查看信息

*【基础命令】*
/start  启动机器人
/help  查看帮助信息
/off   结束会话消息
/u     查看当前USDT地址
/report  查看交易报告
/users   查看用户列表
/ops     查看本群操作员

*【汇率与费率】*
/t [金额]   VND转USDT  例：/t 1000000
/v [金额]   USDT转VND  例：/v 100
/d [费率] [汇率]  临时设置费率和汇率  例：/d 2/14600
设置费率 [数值]  设置费率  例：设置费率2
设置汇率 [数值]  设置汇率  例：设置汇率14600

*【交易命令（操作员）】*
+ [金额] [备注/卡号] [额度]  添加入金  例：+1000000 ABC123 50000
- [金额] [备注/卡号]         添加出金  例：-500000 ABC123
下发 [USDT] [卡号]           标记已支付  例：下发100 ABC123
上课                        清空今日交易
/delete [ID]                 删除交易记录  例：/delete 3
/skip [ID]                   跳过某条交易  例：/skip 2

*【银行卡管理】*
/x [卡号]      隐藏银行卡  例：/x ABC123
/sx [卡号]     显示银行卡  例：/sx ABC123
/hiddenCards  查看所有隐藏卡

*【自定义按钮】*
/inline [按钮]|[命令]  添加按钮  例：/inline 汇率|/report
/removeinline [按钮]    删除按钮
/buttons                查看所有按钮

*【管理员命令】*
/usdt [地址]      设置USDT地址
加操作人 @用户名  添加操作员
移除操作人 @用户名 移除操作员
/op @用户名       添加操作员
/removeop @用户名 移除操作员
/listgroups        查看所有群组

*【所有者命令】*
/ad @用户名        添加管理员
/removead @用户名  移除管理员
/admins            查看管理员列表
/setowner @用户名  转让所有者
/remove @用户名    移除用户（维护）
/migrate           数据迁移（维护）

*【其他功能】*
/c                 从图片提取银行信息
输入数学表达式如 2+2 直接计算
输入TRC20地址自动格式化显示

如有疑问请联系群管理员。祝您使用愉快！
`;
    bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error in handleHelpCommand:', error);
    bot.sendMessage(chatId, "显示帮助信息时出错。请稍后再试。");
  }
};

const handleStartCommand = async (bot, chatId) => {
  try {
    const startMessage = `欢迎使用记账机器人！\n\n开始新账单/ 上课\n记账入账▫️+10000 或者 +数字 [卡号] [额度]\n代付减账▫️-10000\n撤销账单▫️撤销账单id\n下发▫️下发 100  或者 %数字 [卡号] [额度]\n设置费率▫️设置汇率1600  或者 | 价格 费率/汇率\n设置操作▫️@群成员  （群成员 必须在设置之前发送消息）\n删除操作▫️@群成员  （群成员 必须在设置之前发送消息）\n操作人 ▫️ 查看被授权人员名单\n\n+0▫️\n结束| /report`;
    bot.sendMessage(chatId, startMessage);
  } catch (error) {
    console.error('Error in handleStartCommand:', error);
    bot.sendMessage(chatId, "显示账单帮助信息时出错。请稍后再试。");
  }
};

module.exports = {
  handleCalculateUsdtCommand,
  handleCalculateVndCommand,
  handleMathExpression,
  handleTrc20Address,
  handleReportCommand,
  handleHelpCommand,
  handleStartCommand
}; 