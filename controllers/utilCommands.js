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
    
    // Lấy thông tin giao dịch gần đây
    const todayStr = new Date().toLocaleDateString('vi-VN');
    const deposits = await getDepositHistory(chatId);
    const payments = await getPaymentHistory(chatId);
    const cardSummary = await getCardSummary(chatId);
    
    // Tạo response JSON
    const responseData = {
      date: todayStr,
      deposits,
      payments,
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

*权限模型:*
👑 所有者(Owner) - 首位使用机器人的用户，拥有最高权限
👮 管理员(Admin) - 全系统管理员，可添加操作员
🔧 操作员(Operator) - 群组操作员，可执行交易操作
👤 普通用户(User) - 可使用基本功能

*管理命令:*
/setowner [用户名/ID] - 设置新的所有者 (仅所有者)
/addadmin [用户名/ID] - 添加系统管理员 (仅所有者)
/removeadmin [用户名/ID] - 移除系统管理员 (仅所有者)
加操作人 [用户名/ID] - 添加群组操作员 (所有者和管理员)
移除操作人 [用户名/ID] - 移除群组操作员 (所有者和管理员)
/remove [用户名/ID] - 移除群组操作员 (所有者)
/admins - 列出系统管理员 (所有人可见)
/users - 列出群组操作员 (所有人可见)

*基本命令:*
/start - 启动机器人
/help - 显示此帮助信息
/off - 结束会话消息

*交易记录:* (需要操作员权限)
+ [金额] [备注] - 添加入金记录
- [金额] [备注] - 添加出金记录
上课 - 清除当前交易记录
结束 - 显示交易报告

*设置命令:* (需要操作员权限)
设置费率 [数值] - 设置费率百分比
设置汇率 [数值] - 设置汇率
下发 [数值] - 标记已支付USDT金额

*卡管理:* (需要操作员权限)
/x [卡号] - 隐藏银行卡
/sx [卡号] - 显示银行卡
/hiddenCards - 列出所有隐藏卡
/delete [ID] - 删除交易记录

*货币转换:* (所有用户可用)
/t [金额] - VND转换为USDT
/v [金额] - USDT转换为VND
/d [费率] [汇率] - 设置临时费率和汇率 (需要操作员权限)
/m [单位] - 设置货币单位 (需要操作员权限)

*USDT地址管理:*
/usdt [地址] - 设置USDT地址 (仅管理员)
/u - 显示当前USDT地址 (所有用户可用)

*其他功能:*
/c - 从图像中提取银行信息 (所有用户可用)
/report - 显示交易报告 (所有用户可用)

*数学计算:* (所有用户可用)
输入数学表达式如 2+2 进行计算

*TRC20地址识别:* (所有用户可用)
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