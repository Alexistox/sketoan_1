const Group = require('../models/Group');
const Transaction = require('../models/Transaction');
const Card = require('../models/Card');
const Config = require('../models/Config');
const { formatSmart, formatRateValue, formatTelegramMessage, isTrc20Address } = require('../utils/formatter');
const { getDepositHistory, getPaymentHistory, getCardSummary } = require('./groupCommands');

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
      `🔄 VND ${formatSmart(amount)} ➡️ ${currencyUnit} ${formatSmart(usdtValue)}\n` +
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
      `🔄 ${currencyUnit} ${formatSmart(amount)} ➡️ VND ${formatSmart(vndValue)}\n` +
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
    const todayStr = new Date().toLocaleDateString('vi-VN');
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
      date: todayStr,
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
    bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
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
📋 *交易管理机器人使用指南* 📋

*权限系统:*
👑 所有者 - 拥有所有权限，可以添加/删除管理员
🔰 管理员 - 可以管理USDT地址、添加/删除操作员
🔹 操作员 - 可以执行交易和设置命令
👤 普通用户 - 只能使用基本查询功能

*基本命令 (所有用户):*
/start - 启动机器人
/help - 显示此帮助信息
/off - 结束会话消息
/t [金额] - VND转换为USDT
/v [金额] - USDT转换为VND
/u - 显示当前USDT地址
/report - 显示交易报告
/users - 列出用户
/ops - 列出此群组的操作员

*操作员命令:*
+ [金额] [备注] - 添加入金记录
- [金额] [备注] - 添加出金记录
上课 - 清除当前交易记录
设置费率 [数值] - 设置费率百分比
设置汇率 [数值] - 设置汇率
下发 [数值] - 标记已支付USDT金额
/x [卡号] - 隐藏银行卡
/sx [卡号] - 显示银行卡
/hiddenCards - 列出所有隐藏卡
/delete [ID] - 删除交易记录
/d [费率] [汇率] - 设置临时费率和汇率
/m [单位] - 设置货币单位

*管理员命令:*
/usdt [地址] - 设置USDT地址
加操作人 @username - 添加操作员
移除操作人 @username - 移除操作员
/op @username - 添加操作员
/removeop @username - 移除操作员

*所有者命令:*
/ad @username - 添加管理员
/removead @username - 移除管理员
/admins - 查看管理员列表
/setowner @username - 转让所有者权限
/remove @username - 移除用户(仅限维护)
/migrate - 数据迁移(仅限维护)

*其他功能:*
/c - 从图像中提取银行信息
输入数学表达式如 2+2 进行计算
输入TRC20地址以格式化显示
`;
    
    bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error in handleHelpCommand:', error);
    bot.sendMessage(chatId, "显示帮助信息时出错。请稍后再试。");
  }
};

module.exports = {
  handleCalculateUsdtCommand,
  handleCalculateVndCommand,
  handleMathExpression,
  handleTrc20Address,
  handleReportCommand,
  handleHelpCommand
}; 