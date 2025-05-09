const Group = require('../models/Group');
const Transaction = require('../models/Transaction');
const Card = require('../models/Card');
const Config = require('../models/Config');
const { formatSmart, formatRateValue, formatTelegramMessage, isSingleNumber } = require('../utils/formatter');
const { getDepositHistory, getPaymentHistory, getCardSummary } = require('./groupCommands');

/**
 * Xử lý lệnh thêm tiền (+)
 */
const handlePlusCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const senderName = msg.from.first_name;
    const messageText = msg.text;
    const messageId = msg.message_id.toString();
    
    // Phân tích tin nhắn
    const parts = messageText.split('+');
    if (parts.length !== 2) {
      bot.sendMessage(chatId, "指令无效。格式为：+数字 或 +数字 [卡号] [额度]");
      return;
    }
    
    // Xử lý các tham số
    const inputParts = parts[1].trim().split(' ');
    const expr = inputParts[0];
    const cardCode = inputParts.length > 1 ? inputParts[1].toUpperCase() : '';
    const cardLimit = inputParts.length > 2 ? parseFloat(inputParts[2]) : 0;
    
    // Tính toán số tiền
    let amountVND;
    if (!isSingleNumber(expr)) {
      try {
        amountVND = eval(expr);
      } catch(err) {
        bot.sendMessage(chatId, "表达式无效，请重试。");
        return;
      }
    } else {
      amountVND = parseFloat(expr);
    }
    
    if (isNaN(amountVND)) {
      bot.sendMessage(chatId, "金额无效。");
      return;
    }
    
    // Tìm hoặc tạo group
    let group = await Group.findOne({ chatId: chatId.toString() });
    if (!group) {
      bot.sendMessage(chatId, "请设置汇率，费率");
      return;
    }
    
    // Kiểm tra tỷ giá
    if (!group.exchangeRate) {
      bot.sendMessage(chatId, "请设置汇率，费率");
      return;
    }
    
    // Tính toán giá trị USDT
    const xValue = group.rate;
    const yValue = group.exchangeRate;
    const newUSDT = (amountVND / yValue) * (1 - xValue / 100);
    
    // Cập nhật group
    group.totalVND += amountVND;
    group.totalUSDT += newUSDT;
    group.remainingUSDT = group.totalUSDT - group.usdtPaid;
    await group.save();
    
    // Lấy đơn vị tiền tệ
    const configCurrency = await Config.findOne({ key: 'CURRENCY_UNIT' });
    const currencyUnit = configCurrency ? configCurrency.value : 'USDT';
    
    // Tạo chi tiết giao dịch
    let details;
    if (cardCode) {
      details = `${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} +${formatSmart(amountVND)} (${cardCode}) = ${formatSmart(newUSDT)} ${currencyUnit}`;
    } else {
      details = `${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} +${formatSmart(amountVND)} = ${formatSmart(newUSDT)} ${currencyUnit}`;
    }
    
    // Lưu giao dịch mới
    const transaction = new Transaction({
      chatId: chatId.toString(),
      type: 'deposit',
      amount: amountVND,
      usdtAmount: newUSDT,
      message: messageText,
      details,
      senderName,
      cardCode,
      limit: cardLimit,
      rate: xValue,
      exchangeRate: yValue,
      timestamp: new Date(),
      messageId
    });
    
    await transaction.save();
    
    // Nếu có mã thẻ, cập nhật hoặc tạo thẻ mới
    if (cardCode) {
      let card = await Card.findOne({ chatId: chatId.toString(), cardCode });
      if (!card) {
        card = new Card({
          chatId: chatId.toString(),
          cardCode,
          total: amountVND,
          paid: 0,
          limit: cardLimit > 0 ? cardLimit : 0,
          hidden: false,
          lastUpdated: new Date()
        });
      } else {
        card.total += amountVND;
        if (cardLimit > 0) {
          card.limit = cardLimit;
        }
        card.lastUpdated = new Date();
      }
      await card.save();
    }
    
    // Tính toán giá trị ví dụ
    let exampleValue = null;
    if (Math.abs(amountVND) < 1) {
      exampleValue = (100000 / yValue) * (1 - xValue / 100);
    }
    
    // Lấy thông tin giao dịch gần đây
    const todayStr = new Date().toLocaleDateString('vi-VN');
    const depositData = await getDepositHistory(chatId);
    const paymentData = await getPaymentHistory(chatId);
    const cardSummary = await getCardSummary(chatId);
    
    // Tạo response JSON
    const responseData = {
      date: todayStr,
      depositData,
      paymentData,
      rate: formatRateValue(xValue) + "%",
      exchangeRate: formatRateValue(yValue),
      totalAmount: formatSmart(group.totalVND),
      totalUSDT: formatSmart(group.totalUSDT),
      paidUSDT: formatSmart(group.usdtPaid),
      remainingUSDT: formatSmart(group.remainingUSDT),
      currencyUnit,
      cards: cardSummary
    };
    
    // Thêm ví dụ nếu cần
    if (exampleValue !== null) {
      responseData.example = formatSmart(exampleValue);
    }
    
    // Format và gửi tin nhắn
    const response = formatTelegramMessage(responseData);
    bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
    
  } catch (error) {
    console.error('Error in handlePlusCommand:', error);
    bot.sendMessage(msg.chat.id, "处理入款命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh rút tiền (-)
 */
const handleMinusCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const senderName = msg.from.first_name;
    const messageText = msg.text;
    const messageId = msg.message_id.toString();
    
    // Phân tích tin nhắn
    const parts = messageText.split('-');
    if (parts.length !== 2) {
      bot.sendMessage(chatId, "指令无效。格式为：-数字 或 -数字 [卡号]");
      return;
    }
    
    // Xử lý các tham số
    const inputParts = parts[1].trim().split(' ');
    const expr = inputParts[0];
    const cardCode = inputParts.length > 1 ? inputParts[1].toUpperCase() : '';
    
    // Tính toán số tiền
    let amountVND;
    if (!isSingleNumber(expr)) {
      try {
        amountVND = eval(expr);
      } catch(err) {
        bot.sendMessage(chatId, "表达式无效，请重试。");
        return;
      }
    } else {
      amountVND = parseFloat(expr);
    }
    
    if (isNaN(amountVND)) {
      bot.sendMessage(chatId, "金额无效。");
      return;
    }
    
    // Tìm hoặc tạo group
    let group = await Group.findOne({ chatId: chatId.toString() });
    if (!group) {
      bot.sendMessage(chatId, "请设置汇率，费率");
      return;
    }
    
    // Kiểm tra tỷ giá
    if (!group.exchangeRate) {
      bot.sendMessage(chatId, "请设置汇率，费率");
      return;
    }
    
    // Tính toán giá trị USDT
    const xValue = group.rate;
    const yValue = group.exchangeRate;
    const minusUSDT = (amountVND / yValue) * (1 - xValue / 100);
    
    // Cập nhật group
    group.totalVND -= amountVND;
    group.totalUSDT -= minusUSDT;
    group.remainingUSDT = group.totalUSDT - group.usdtPaid;
    await group.save();
    
    // Lấy đơn vị tiền tệ
    const configCurrency = await Config.findOne({ key: 'CURRENCY_UNIT' });
    const currencyUnit = configCurrency ? configCurrency.value : 'USDT';
    
    // Tạo chi tiết giao dịch
    let details;
    if (cardCode) {
      details = `${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} -${formatSmart(amountVND)} (${cardCode}) = -${formatSmart(minusUSDT)} ${currencyUnit}`;
    } else {
      details = `${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} -${formatSmart(amountVND)} = -${formatSmart(minusUSDT)} ${currencyUnit}`;
    }
    
    // Lưu giao dịch mới
    const transaction = new Transaction({
      chatId: chatId.toString(),
      type: 'withdraw',
      amount: -amountVND,
      usdtAmount: -minusUSDT,
      message: messageText,
      details,
      senderName,
      cardCode,
      rate: xValue,
      exchangeRate: yValue,
      timestamp: new Date(),
      messageId
    });
    
    await transaction.save();
    
    // Nếu có mã thẻ, cập nhật thẻ
    if (cardCode) {
      let card = await Card.findOne({ chatId: chatId.toString(), cardCode });
      if (card) {
        card.total -= amountVND;
        card.lastUpdated = new Date();
        await card.save();
      } else {
        // Tạo thẻ mới với số tiền âm
        card = new Card({
          chatId: chatId.toString(),
          cardCode,
          total: -amountVND,
          paid: 0,
          hidden: false,
          lastUpdated: new Date()
        });
        await card.save();
      }
    }
    
    // Tính toán giá trị ví dụ
    let exampleValue = null;
    if (Math.abs(amountVND) < 1) {
      exampleValue = (100000 / yValue) * (1 - xValue / 100);
    }
    
    // Lấy thông tin giao dịch gần đây
    const todayStr = new Date().toLocaleDateString('vi-VN');
    const depositData = await getDepositHistory(chatId);
    const paymentData = await getPaymentHistory(chatId);
    const cardSummary = await getCardSummary(chatId);
    
    // Tạo response JSON
    const responseData = {
      date: todayStr,
      depositData,
      paymentData,
      rate: formatRateValue(xValue) + "%",
      exchangeRate: formatRateValue(yValue),
      totalAmount: formatSmart(group.totalVND),
      totalUSDT: formatSmart(group.totalUSDT),
      paidUSDT: formatSmart(group.usdtPaid),
      remainingUSDT: formatSmart(group.remainingUSDT),
      currencyUnit,
      cards: cardSummary
    };
    
    // Thêm ví dụ nếu cần
    if (exampleValue !== null) {
      responseData.example = formatSmart(exampleValue);
    }
    
    // Format và gửi tin nhắn
    const response = formatTelegramMessage(responseData);
    bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
    
  } catch (error) {
    console.error('Error in handleMinusCommand:', error);
    bot.sendMessage(msg.chat.id, "处理出款命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh thanh toán (下发)
 */
const handlePercentCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const senderName = msg.from.first_name;
    const messageText = msg.text;
    const messageId = msg.message_id.toString();
    
    // Phân tích tin nhắn
    const parts = messageText.split('下发');
    if (parts.length !== 2) {
      bot.sendMessage(chatId, "指令无效。格式为：下发数字 (USDT) 或 下发数字 [卡号]");
      return;
    }
    
    // Xử lý các tham số
    const inputParts = parts[1].trim().split(' ');
    const expr = inputParts[0];
    const cardCode = inputParts.length > 1 ? inputParts[1].toUpperCase() : '';
    
    // Tính toán số tiền USDT
    let payUSDT;
    if (!isSingleNumber(expr)) {
      try {
        payUSDT = eval(expr);
      } catch(err) {
        bot.sendMessage(chatId, "表达式无效，请重试。");
        return;
      }
    } else {
      payUSDT = parseFloat(expr);
    }
    
    if (isNaN(payUSDT)) {
      bot.sendMessage(chatId, "USDT金额无效。");
      return;
    }
    
    // Tìm hoặc tạo group
    let group = await Group.findOne({ chatId: chatId.toString() });
    if (!group) {
      bot.sendMessage(chatId, "请设置汇率，费率");
      return;
    }
    
    // Kiểm tra tỷ giá
    if (!group.exchangeRate) {
      bot.sendMessage(chatId, "请设置汇率，费率");
      return;
    }
    
    // Lấy đơn vị tiền tệ
    const configCurrency = await Config.findOne({ key: 'CURRENCY_UNIT' });
    const currencyUnit = configCurrency ? configCurrency.value : 'USDT';
    
    // Cập nhật group
    group.usdtPaid += payUSDT;
    group.remainingUSDT = group.totalUSDT - group.usdtPaid;
    await group.save();
    
    // Tạo chi tiết giao dịch
    let details;
    if (cardCode) {
      details = `${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} +${formatSmart(payUSDT)} ${currencyUnit} (${cardCode})`;
    } else {
      details = `${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} +${formatSmart(payUSDT)} ${currencyUnit}`;
    }
    
    // Lưu giao dịch mới
    const transaction = new Transaction({
      chatId: chatId.toString(),
      type: 'payment',
      usdtAmount: payUSDT,
      message: messageText,
      details,
      senderName,
      cardCode,
      rate: group.rate,
      exchangeRate: group.exchangeRate,
      timestamp: new Date(),
      messageId
    });
    
    await transaction.save();
    
    // Nếu có mã thẻ, cập nhật thẻ
    if (cardCode) {
      let card = await Card.findOne({ chatId: chatId.toString(), cardCode });
      if (card) {
        card.paid += payUSDT;
        card.lastUpdated = new Date();
        await card.save();
      } else {
        // Không tạo thẻ mới khi chỉ thanh toán mà không có tiền gửi
        bot.sendMessage(chatId, `卡号 ${cardCode} 不存在。`);
        return;
      }
    }
    
    // Tính toán giá trị ví dụ
    let exampleValue = null;
    if (Math.abs(payUSDT) < 0.1) {
      exampleValue = (100000 / group.exchangeRate) * (1 - group.rate / 100);
    }
    
    // Lấy thông tin giao dịch gần đây
    const todayStr = new Date().toLocaleDateString('vi-VN');
    const depositData = await getDepositHistory(chatId);
    const paymentData = await getPaymentHistory(chatId);
    const cardSummary = await getCardSummary(chatId);
    
    // Tạo response JSON
    const responseData = {
      date: todayStr,
      depositData,
      paymentData,
      rate: formatRateValue(group.rate) + "%",
      exchangeRate: formatRateValue(group.exchangeRate),
      totalAmount: formatSmart(group.totalVND),
      totalUSDT: formatSmart(group.totalUSDT),
      paidUSDT: formatSmart(group.usdtPaid),
      remainingUSDT: formatSmart(group.remainingUSDT),
      currencyUnit,
      cards: cardSummary
    };
    
    // Thêm ví dụ nếu cần
    if (exampleValue !== null) {
      responseData.example = formatSmart(exampleValue);
    }
    
    // Format và gửi tin nhắn
    const response = formatTelegramMessage(responseData);
    bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
    
  } catch (error) {
    console.error('Error in handlePercentCommand:', error);
    bot.sendMessage(msg.chat.id, "处理下发命令时出错。请稍后再试。");
  }
};

module.exports = {
  handlePlusCommand,
  handleMinusCommand,
  handlePercentCommand
}; 