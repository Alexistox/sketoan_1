const Group = require('../models/Group');
const Transaction = require('../models/Transaction');
const Card = require('../models/Card');
const Config = require('../models/Config');
const { formatSmart, formatRateValue, formatTelegramMessage, isSingleNumber, formatDateUS, formatTimeString, getUserNumberFormat, getGroupNumberFormat } = require('../utils/formatter');
const { getDepositHistory, getPaymentHistory, getCardSummary } = require('./groupCommands');
const { getButtonsStatus, getInlineKeyboard } = require('./userCommands');
const { extractAmountFromImage } = require('../utils/openai');
const { getDownloadLink } = require('../utils/telegramUtils');
const axios = require('axios');

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
    // Lấy đơn vị tiền tệ
    const configCurrency = await Config.findOne({ key: `CURRENCY_UNIT_${chatId}` });
    const currencyUnit = configCurrency ? configCurrency.value : 'USDT';

    // Bỏ qua giao dịch +0
    if (amountVND === 0) {
      // Chỉ hiển thị thông tin hiện tại mà không ghi nhận giao dịch
      const todayDate = new Date();
      const depositData = await getDepositHistory(chatId);
      const paymentData = await getPaymentHistory(chatId);
      const cardSummary = await getCardSummary(chatId);
      
      // Lấy format của người dùng trong nhóm này
      const userFormat = await getGroupNumberFormat(chatId);
      
      // Tạo response JSON
      const responseData = {
        date: formatDateUS(todayDate),
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
      
      // Format và gửi tin nhắn
      const response = formatTelegramMessage(responseData, userFormat);
      
      // Kiểm tra trạng thái hiển thị buttons
      const showButtons = await getButtonsStatus(chatId);
      const keyboard = showButtons ? await getInlineKeyboard(chatId) : null;
      
      bot.sendMessage(chatId, response, { 
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
      return;
    }
   
    
    // Tính toán giá trị USDT
    const xValue = group.rate;
    const yValue = group.exchangeRate;
    const newUSDT = (amountVND / yValue) * (1 - xValue / 100);
    
    // Tính toán phần (1-(费率/100))
    const rateFactor = (1 - xValue / 100).toFixed(2);
    
    // Cập nhật group
    group.totalVND += amountVND;
    group.totalUSDT += newUSDT;
    group.remainingUSDT = group.totalUSDT - group.usdtPaid;
    await group.save();
    
    // Lấy format của người dùng cho hiển thị details
    const userFormat = await getGroupNumberFormat(chatId);
    
    // Tạo chi tiết giao dịch
    let details;
    if (cardCode) {
      details = `\`${formatTimeString(new Date())}\` *${formatSmart(amountVND, userFormat)}*\\*${rateFactor}/${yValue} = ${formatSmart(newUSDT, userFormat)} (${cardCode}) \`${senderName}\``;
    } else {
      details = `\`${formatTimeString(new Date())}\` *${formatSmart(amountVND, userFormat)}*\\*${rateFactor}/${yValue} = ${formatSmart(newUSDT, userFormat)} \`${senderName}\``;
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
    const todayDate = new Date();
    const depositData = await getDepositHistory(chatId);
    const paymentData = await getPaymentHistory(chatId);
    const cardSummary = await getCardSummary(chatId);
    
    // Tạo response JSON
    const responseData = {
      date: formatDateUS(todayDate),
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
    const response = formatTelegramMessage(responseData, userFormat);
    
    // Kiểm tra trạng thái hiển thị buttons
    const showButtons = await getButtonsStatus(chatId);
    const keyboard = showButtons ? await getInlineKeyboard(chatId) : null;
    
    bot.sendMessage(chatId, response, { 
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
    
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
    
    // Tính toán phần (1-(费率/100))
    const rateFactor = (1 - xValue / 100).toFixed(2);
    
    // Cập nhật group
    group.totalVND -= amountVND;
    group.totalUSDT -= minusUSDT;
    group.remainingUSDT = group.totalUSDT - group.usdtPaid;
    await group.save();
    
    // Lấy đơn vị tiền tệ
    const configCurrency = await Config.findOne({ key: `CURRENCY_UNIT_${chatId}` });
    const currencyUnit = configCurrency ? configCurrency.value : 'USDT';
    
    // Lấy format của người dùng cho hiển thị details
    const userFormat = await getGroupNumberFormat(chatId);
    
    // Tạo chi tiết giao dịch
    let details;
    if (cardCode) {
      details = `\`${formatTimeString(new Date())}\` -*${formatSmart(amountVND, userFormat)}*\\*${rateFactor}/${yValue} = -${formatSmart(minusUSDT, userFormat)} (${cardCode}) \`${senderName}\``;
    } else {
      details = `\`${formatTimeString(new Date())}\` -*${formatSmart(amountVND, userFormat)}*\\*${rateFactor}/${yValue} = -${formatSmart(minusUSDT, userFormat)} \`${senderName}\``;
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
    const todayDate = new Date();
    const depositData = await getDepositHistory(chatId);
    const paymentData = await getPaymentHistory(chatId);
    const cardSummary = await getCardSummary(chatId);
    
    // Tạo response JSON
    const responseData = {
      date: formatDateUS(todayDate),
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
    const response = formatTelegramMessage(responseData, userFormat);
    
    // Kiểm tra trạng thái hiển thị buttons
    const showButtons = await getButtonsStatus(chatId);
    const keyboard = showButtons ? await getInlineKeyboard(chatId) : null;
    
    bot.sendMessage(chatId, response, { 
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
    
  } catch (error) {
    console.error('Error in handleMinusCommand:', error);
    bot.sendMessage(msg.chat.id, "处理出款命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh thanh toán (下发 hoặc %)
 */
const handlePercentCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const senderName = msg.from.first_name;
    const messageText = msg.text;
    const messageId = msg.message_id.toString();
    
    // Phân tích tin nhắn - hỗ trợ cả 下发 và % prefix
    let parts;
    if (messageText.startsWith('下发')) {
      parts = messageText.split('下发');
    } else if (messageText.startsWith('%')) {
      parts = messageText.split('%');
    } else {
      bot.sendMessage(chatId, "指令无效。格式为：下发数字 (USDT) 或 %数字 (USDT) 或 下发数字 [卡号] 或 %数字 [卡号]");
      return;
    }
    
    if (parts.length !== 2 || !parts[1].trim()) {
      bot.sendMessage(chatId, "指令无效。格式为：下发数字 (USDT) 或 %数字 (USDT) 或 下发数字 [卡号] 或 %数字 [卡号]");
      return;
    }
    
    // Xử lý các tham số
    const inputParts = parts[1].trim().split(' ');
    const expr = inputParts[0];
    const cardCode = inputParts.length > 1 ? inputParts[1].toUpperCase() : '';
    
    // Kiểm tra expr có hợp lệ không
    if (!expr || expr.trim() === '') {
      bot.sendMessage(chatId, "金额不能为空。");
      return;
    }
    
    // Tính toán số tiền USDT
    let payUSDT;
    
    // Debug logging
    console.log('Percent command debug:', {
      messageText,
      expr,
      isSingleNumberResult: isSingleNumber(expr)
    });
    
    if (!isSingleNumber(expr)) {
      try {
        payUSDT = eval(expr);
      } catch(err) {
        console.error('Eval error:', err);
        bot.sendMessage(chatId, "表达式无效，请重试。");
        return;
      }
    } else {
      payUSDT = parseFloat(expr);
    }
    
    console.log('Parsed USDT amount:', payUSDT);
    
    if (isNaN(payUSDT) || !isFinite(payUSDT)) {
      console.error('Invalid USDT amount:', { payUSDT, expr });
      bot.sendMessage(chatId, `USDT金额无效: ${expr} -> ${payUSDT}`);
      return;
    }
    
    // Ignore zero-value transactions
    if (payUSDT === 0) {
      bot.sendMessage(chatId, "金额为零，不处理。");
      return;
    }
    
    // Ensure positive amount for USDT payments
    if (payUSDT < 0) {
      bot.sendMessage(chatId, "USDT金额必须为正数。");
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
    const configCurrency = await Config.findOne({ key: `CURRENCY_UNIT_${chatId}` });
    const currencyUnit = configCurrency ? configCurrency.value : 'USDT';
    
    // Cập nhật group
    group.usdtPaid += payUSDT;
    group.remainingUSDT = group.totalUSDT - group.usdtPaid;
    await group.save();
    
    // Lấy format của người dùng cho hiển thị details  
    const userFormat = await getGroupNumberFormat(chatId);
    
    // Tạo chi tiết giao dịch
    let details;
    if (cardCode) {
      details = `\`${formatTimeString(new Date())}\`    *${formatSmart(payUSDT, userFormat)}*  ${currencyUnit} (${cardCode})`;
    } else {
      details = `\`${formatTimeString(new Date())}\`    *${formatSmart(payUSDT, userFormat)}*  ${currencyUnit}`;
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
    const todayDate = new Date();
    const depositData = await getDepositHistory(chatId);
    const paymentData = await getPaymentHistory(chatId);
    const cardSummary = await getCardSummary(chatId);
    
    // Tạo response JSON
    const responseData = {
      date: formatDateUS(todayDate),
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
    const response = formatTelegramMessage(responseData, userFormat);
    
    // Kiểm tra trạng thái hiển thị buttons
    const showButtons = await getButtonsStatus(chatId);
    const keyboard = showButtons ? await getInlineKeyboard(chatId) : null;
    
    bot.sendMessage(chatId, response, { 
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
    
  } catch (error) {
    console.error('Error in handlePercentCommand:', error);
    bot.sendMessage(msg.chat.id, "处理下发命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh skip (/skip) - Xóa một giao dịch theo ID
 */
const handleSkipCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const senderName = msg.from.first_name;
    const messageText = msg.text;
    
    // Phân tích tin nhắn để lấy ID
    const parts = messageText.split('/skip');
    if (parts.length !== 2) {
      bot.sendMessage(chatId, "指令无效。格式为：/skip [ID] 例如: /skip 3 或 /skip !2");
      return;
    }
    
    // Xử lý ID, loại bỏ khoảng trắng và ký tự !
    let idStr = parts[1].trim();
    let isPaymentId = false;
    
    if (idStr.startsWith('!')) {
      isPaymentId = true;
      idStr = idStr.substring(1);
    }
    
    // Chuyển đổi ID thành số
    const id = parseInt(idStr);
    if (isNaN(id) || id <= 0) {
      bot.sendMessage(chatId, "ID无效。应为正整数。");
      return;
    }
    
    // Tìm nhóm
    const group = await Group.findOne({ chatId: chatId.toString() });
    if (!group) {
      bot.sendMessage(chatId, "没有找到群组信息。");
      return;
    }
    
    // Lấy tất cả giao dịch trong nhóm sau lần clear cuối
    const lastClearDate = group.lastClearDate;
    
    let transactions;
    if (isPaymentId) {
      // Lấy các giao dịch payment
      transactions = await Transaction.find({
        chatId: chatId.toString(),
        type: 'payment',
        timestamp: { $gt: lastClearDate },
        skipped: { $ne: true }
      }).sort({ timestamp: 1 });
    } else {
      // Lấy các giao dịch deposit và withdraw
      transactions = await Transaction.find({
        chatId: chatId.toString(),
        type: { $in: ['deposit', 'withdraw'] },
        timestamp: { $gt: lastClearDate },
        skipped: { $ne: true }
      }).sort({ timestamp: 1 });
    }
    
    // Kiểm tra xem ID có hợp lệ không
    if (id > transactions.length) {
      bot.sendMessage(chatId, `ID无效。${isPaymentId ? '下发' : '入款'}记录中只有 ${transactions.length} 个条目。`);
      return;
    }
    
    // Lấy giao dịch cần skip - vì ID là số thứ tự trong mảng (bắt đầu từ 1), nên cần trừ 1
    const transaction = transactions[id - 1];
    
    // Bắt đầu xử lý skip dựa trên loại giao dịch
    if (transaction.type === 'deposit') {
      // Revert deposit: trừ VND và USDT
      group.totalVND -= transaction.amount;
      group.totalUSDT -= transaction.usdtAmount;
      group.remainingUSDT = group.totalUSDT - group.usdtPaid;
      
      // Nếu có mã thẻ, cập nhật thẻ
      if (transaction.cardCode) {
        const card = await Card.findOne({ chatId: chatId.toString(), cardCode: transaction.cardCode });
        if (card) {
          card.total -= transaction.amount;
          await card.save();
        }
      }
    } else if (transaction.type === 'withdraw') {
      // Revert withdraw: cộng VND và USDT
      group.totalVND += Math.abs(transaction.amount);
      group.totalUSDT += Math.abs(transaction.usdtAmount);
      group.remainingUSDT = group.totalUSDT - group.usdtPaid;
      
      // Nếu có mã thẻ, cập nhật thẻ
      if (transaction.cardCode) {
        const card = await Card.findOne({ chatId: chatId.toString(), cardCode: transaction.cardCode });
        if (card) {
          card.total += Math.abs(transaction.amount);
          await card.save();
        }
      }
    } else if (transaction.type === 'payment') {
      // Revert payment: trừ USDT đã thanh toán
      group.usdtPaid -= transaction.usdtAmount;
      group.remainingUSDT = group.totalUSDT - group.usdtPaid;
      
      // Nếu có mã thẻ, cập nhật thẻ
      if (transaction.cardCode) {
        const card = await Card.findOne({ chatId: chatId.toString(), cardCode: transaction.cardCode });
        if (card) {
          card.paid -= transaction.usdtAmount;
          await card.save();
        }
      }
    }
    
    // Lưu thay đổi vào group
    await group.save();
    
    // Đánh dấu giao dịch là đã skip
    transaction.skipped = true;
    transaction.skipReason = `Skipped by ${senderName} at ${new Date().toLocaleString()}`;
    await transaction.save();
    
    // Lưu transaction mới về lệnh skip
    const skipTransaction = new Transaction({
      chatId: chatId.toString(),
      type: 'skip',
      message: messageText,
      details: `Skip transaction ID: ${id}${isPaymentId ? '!' : ''} - ${transaction.details}`,
      senderName,
      timestamp: new Date()
    });
    
    await skipTransaction.save();
    
    // Lấy thông tin giao dịch gần đây sau khi skip
    const todayDate = new Date();
    const depositData = await getDepositHistory(chatId);
    const paymentData = await getPaymentHistory(chatId);
    const cardSummary = await getCardSummary(chatId);
    
    // Tạo response JSON
    const configCurrency = await Config.findOne({ key: `CURRENCY_UNIT_${chatId}` });
    const currencyUnit = configCurrency ? configCurrency.value : 'USDT';
    
    const responseData = {
      date: formatDateUS(todayDate),
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
    
    // Lấy format của người dùng
    const userFormat = await getGroupNumberFormat(chatId);
    
    // Format và gửi tin nhắn
    const response = formatTelegramMessage(responseData, userFormat);
    
    // Kiểm tra trạng thái hiển thị buttons
    const showButtons = await getButtonsStatus(chatId);
    const keyboard = showButtons ? await getInlineKeyboard(chatId) : null;
    
    bot.sendMessage(chatId, `✅ 成功删除ID为 ${id}${isPaymentId ? '!' : ''} 的交易记录。`, { 
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
    
    bot.sendMessage(chatId, response, { 
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
    
  } catch (error) {
    console.error('Error in handleSkipCommand:', error);
    bot.sendMessage(msg.chat.id, "处理删除命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh /autoplus để cấu hình tự động trích xuất số tiền
 */
const handleAutoPlusCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const messageText = msg.text.trim();
    const userId = msg.from.id;
    
    // Tìm group
    let group = await Group.findOne({ chatId: chatId.toString() });
    if (!group) {
      bot.sendMessage(chatId, "请先设置汇率和费率！");
      return;
    }

    // Phân tích lệnh
    const parts = messageText.split(' ');
    
    if (parts.length === 1) {
      // Chỉ gõ /autoplus - hiển thị trạng thái hiện tại
      const status = group.autoplus?.enabled ? "已启用" : "已禁用";
      const template = group.autoplus?.template || "未设置";
      bot.sendMessage(chatId, 
        `🤖 *自动加款状态*\n\n` +
        `状态: ${status}\n` +
        `模板: \`${template}\`\n\n` +
        `*使用方法:*\n` +
        `• \`/autoplus on [模板]\` - 启用并设置模板\n` +
        `• \`/autoplus off\` - 禁用\n` +
        `• \`/autoplus\` - 查看当前状态\n\n` +
        `*模板示例:*\n` +
        `\`/autoplus on 收到转账 {amount} 元\`\n` +
        `模板中的 \`{amount}\` 将被替换为实际金额`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const action = parts[1].toLowerCase();
    
    if (action === 'on') {
      if (parts.length < 3) {
        bot.sendMessage(chatId, "请提供模板！\n格式: `/autoplus on 模板文本`\n例如: `/autoplus on 收到转账 {amount} 元`", 
          { parse_mode: 'Markdown' });
        return;
      }
      
      // Lấy template từ phần còn lại của message
      const template = messageText.substring(messageText.indexOf(parts[2]));
      
      // Kiểm tra template có chứa {amount}
      if (!template.includes('{amount}')) {
        bot.sendMessage(chatId, "模板必须包含 `{amount}` 来标识金额位置！\n例如: `收到转账 {amount} 元`", 
          { parse_mode: 'Markdown' });
        return;
      }
      
      // Cập nhật group
      group.autoplus = group.autoplus || {};
      group.autoplus.enabled = true;
      group.autoplus.template = template;
      group.autoplus.lastUpdated = new Date();
      await group.save();
      
      bot.sendMessage(chatId, 
        `✅ *自动加款已启用*\n\n` +
        `模板: \`${template}\`\n\n` +
        `现在当收到匹配此模板的消息时，机器人会自动提取金额并执行加款操作。`,
        { parse_mode: 'Markdown' }
      );
      
    } else if (action === 'off') {
      // Tắt autoplus
      group.autoplus = group.autoplus || {};
      group.autoplus.enabled = false;
      group.autoplus.lastUpdated = new Date();
      await group.save();
      
      bot.sendMessage(chatId, "❌ 自动加款已禁用");
      
    } else {
      bot.sendMessage(chatId, "无效的操作！\n使用 `/autoplus on [模板]` 或 `/autoplus off`", 
        { parse_mode: 'Markdown' });
    }
    
  } catch (error) {
    console.error('Error in handleAutoPlusCommand:', error);
    bot.sendMessage(msg.chat.id, "处理自动加款命令时出错，请稍后重试。");
  }
};

/**
 * 从文本中提取金额，基于模板匹配
 */
const extractAmountFromText = (text, template) => {
  try {
    // Escape regex special characters in template except {amount} and {order_id}
    let escapedTemplate = template.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Replace {amount} with a regex pattern to capture numbers (including decimals and commas)
    escapedTemplate = escapedTemplate.replace('\\{amount\\}', '([0-9,]+(?:\\.[0-9]+)?)');
    
    // Replace {order_id} with a regex pattern to capture alphanumeric characters (optional)
    escapedTemplate = escapedTemplate.replace('\\{order_id\\}', '([a-zA-Z0-9]+)');
    
    // Make the template more flexible by allowing optional trailing parts
    // If template ends with {order_id} or similar, make it optional
    if (template.includes('{order_id}')) {
      // The order_id part is optional for matching
      escapedTemplate = escapedTemplate.replace('，订单号：\\([a-zA-Z0-9]+\\)', '(?:，订单号：[a-zA-Z0-9]+)?');
    }
    
    // Create regex with global and case-insensitive flags
    const regex = new RegExp(escapedTemplate, 'gi');
    
    // Try to match the pattern
    const match = regex.exec(text);
    
    if (match && match[1]) {
      // Clean the captured amount (remove commas, convert to number)
      const cleanAmount = match[1].replace(/,/g, '');
      const amount = parseFloat(cleanAmount);
      
      if (!isNaN(amount) && amount > 0) {
        return amount;
      }
    }
    
    // Fallback: Try to extract amount using common Chinese payment patterns
    const chinesePatterns = [
      /金额[：:]\s*([0-9,]+(?:\.[0-9]+)?)/gi,
      /金额\s*([0-9,]+(?:\.[0-9]+)?)/gi,
      /收到\s*([0-9,]+(?:\.[0-9]+)?)\s*元/gi,
      /转账\s*([0-9,]+(?:\.[0-9]+)?)\s*元/gi,
      /支付\s*([0-9,]+(?:\.[0-9]+)?)\s*元/gi,
      /收入\s*([0-9,]+(?:\.[0-9]+)?)/gi
    ];
    
    for (const pattern of chinesePatterns) {
      const fallbackMatch = pattern.exec(text);
      if (fallbackMatch && fallbackMatch[1]) {
        const cleanAmount = fallbackMatch[1].replace(/,/g, '');
        const amount = parseFloat(cleanAmount);
        
        if (!isNaN(amount) && amount > 0) {
          return amount;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting amount from text:', error);
    return null;
  }
};

/**
 * Kiểm tra và xử lý tin nhắn tự động autoplus
 */
const processAutoPlusMessage = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const messageText = msg.text || '';
    
    // Tìm group và kiểm tra autoplus
    const group = await Group.findOne({ chatId: chatId.toString() });
    if (!group || !group.autoplus?.enabled || !group.autoplus?.template) {
      return false; // Không xử lý
    }
    
    // Trích xuất số tiền từ text
    const amount = extractAmountFromText(messageText, group.autoplus.template);
    
    if (amount) {
      // Tạo tin nhắn giả để sử dụng với handlePlusCommand
      const fakeMsg = {
        ...msg,
        text: `+${amount}` // Tạo lệnh + với số tiền đã trích xuất
      };
      
      // Gọi handlePlusCommand với tin nhắn giả
      await handlePlusCommand(bot, fakeMsg);
      
      return true; // Đã xử lý
    }
    
    return false; // Không khớp template
  } catch (error) {
    console.error('Error in processAutoPlusMessage:', error);
    return false;
  }
};

/**
 * Xử lý lệnh /auto để quản lý patterns tự động
 */
const handleAutoCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const messageText = msg.text.trim();
    const userId = msg.from.id;
    
    // Tìm group
    let group = await Group.findOne({ chatId: chatId.toString() });
    if (!group) {
      bot.sendMessage(chatId, "请先设置汇率和费率！");
      return;
    }

    // Phân tích lệnh
    const parts = messageText.split(' ');
    
    if (parts.length === 1) {
      // Chỉ gõ /auto - hiển thị danh sách patterns
      const patterns = group.autoPatterns || [];
      if (patterns.length === 0) {
        bot.sendMessage(chatId, 
          `📋 *自动回复模式*\n\n` +
          `当前没有保存的模式\n\n` +
          `*使用方法:*\n` +
          `• \`/auto on [文本模式]\` - 添加模式\n` +
          `• \`/auto off [文本模式]\` - 删除模式\n` +
          `• \`/auto\` - 查看所有模式\n\n` +
          `*示例:*\n` +
          `\`/auto on 有新的支付订单。金额：{amount}，订单号：{order_id}\`\n\n` +
          `添加后，回复包含此模式的消息时使用 \`+\`, \`-\`, \`%\` 会自动提取金额`,
          { parse_mode: 'Markdown' }
        );
        return;
      }
      
      let responseText = `📋 *自动回复模式列表*\n\n`;
      patterns.forEach((pattern, index) => {
        const status = pattern.enabled ? "✅" : "❌";
        responseText += `${index + 1}. ${status} \`${pattern.pattern}\`\n`;
      });
      
      responseText += `\n*使用方法:*\n`;
      responseText += `回复匹配模式的消息时使用 \`+\`, \`-\`, \`%\` 会自动提取金额执行操作`;
      
      bot.sendMessage(chatId, responseText, { parse_mode: 'Markdown' });
      return;
    }

    const action = parts[1].toLowerCase();
    
    if (action === 'on') {
      if (parts.length < 3) {
        bot.sendMessage(chatId, 
          "请提供文本模式！\n" +
          "格式: `/auto on 文本模式`\n" +
          "例如: `/auto on 有新的支付订单。金额：{amount}，订单号：{order_id}`", 
          { parse_mode: 'Markdown' });
        return;
      }
      
      // Lấy pattern từ phần còn lại của message
      const pattern = messageText.substring(messageText.indexOf(parts[2]));
      
      // Kiểm tra pattern có chứa {amount}
      if (!pattern.includes('{amount}')) {
        bot.sendMessage(chatId, 
          "文本模式必须包含 `{amount}` 来标识金额位置！\n" +
          "例如: `有新的支付订单。金额：{amount}，订单号：{order_id}`", 
          { parse_mode: 'Markdown' });
        return;
      }
      
      // Kiểm tra pattern đã tồn tại chưa
      const existingPattern = group.autoPatterns.find(p => p.pattern === pattern);
      if (existingPattern) {
        bot.sendMessage(chatId, "此模式已存在！");
        return;
      }
      
      // Thêm pattern mới
      group.autoPatterns.push({
        pattern: pattern,
        enabled: true,
        dateAdded: new Date()
      });
      
      await group.save();
      
      bot.sendMessage(chatId, 
        `✅ *已添加自动回复模式*\n\n` +
        `模式: \`${pattern}\`\n\n` +
        `现在回复匹配此模式的消息时，使用 \`+\`, \`-\`, \`%\` 会自动提取金额并执行相应操作。`,
        { parse_mode: 'Markdown' }
      );
      
    } else if (action === 'off') {
      if (parts.length < 3) {
        bot.sendMessage(chatId, "请提供要删除的文本模式！", { parse_mode: 'Markdown' });
        return;
      }
      
      const pattern = messageText.substring(messageText.indexOf(parts[2]));
      
      // Tìm và xóa pattern
      const patternIndex = group.autoPatterns.findIndex(p => p.pattern === pattern);
      if (patternIndex === -1) {
        bot.sendMessage(chatId, "未找到此模式！");
        return;
      }
      
      group.autoPatterns.splice(patternIndex, 1);
      await group.save();
      
      bot.sendMessage(chatId, `❌ 已删除模式: \`${pattern}\``, { parse_mode: 'Markdown' });
      
    } else {
      bot.sendMessage(chatId, 
        "无效的操作！\n使用 `/auto on [模式]` 或 `/auto off [模式]`", 
        { parse_mode: 'Markdown' });
    }
    
  } catch (error) {
    console.error('Error in handleAutoCommand:', error);
    bot.sendMessage(msg.chat.id, "处理自动回复命令时出错，请稍后重试。");
  }
};

/**
 * 从文本中提取金额，基于多个patterns匹配
 */
const extractAmountFromAutoPatterns = (text, patterns) => {
  try {
    for (const patternObj of patterns) {
      if (!patternObj.enabled) continue;
      
      const template = patternObj.pattern;
      
      // Escape regex special characters in template except {amount} and {order_id}
      let escapedTemplate = template.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // Replace {amount} with a regex pattern to capture numbers
      escapedTemplate = escapedTemplate.replace('\\{amount\\}', '([0-9,]+(?:\\.[0-9]+)?)');
      
      // Replace {order_id} with a regex pattern (optional)
      escapedTemplate = escapedTemplate.replace('\\{order_id\\}', '([a-zA-Z0-9]+)');
      
      // Make it more flexible
      if (template.includes('{order_id}')) {
        escapedTemplate = escapedTemplate.replace('，订单号：\\([a-zA-Z0-9]+\\)', '(?:，订单号：[a-zA-Z0-9]+)?');
      }
      
      // Create regex
      const regex = new RegExp(escapedTemplate, 'gi');
      const match = regex.exec(text);
      
      if (match && match[1]) {
        const cleanAmount = match[1].replace(/,/g, '');
        const amount = parseFloat(cleanAmount);
        
        if (!isNaN(amount) && amount > 0) {
          return amount;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting amount from auto patterns:', error);
    return null;
  }
};

/**
 * Xử lý reply với +, -, % vào tin nhắn có auto patterns
 */
const processAutoReply = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const messageText = msg.text.trim();
    const replyToMessage = msg.reply_to_message;
    
    // Kiểm tra có phải reply không
    if (!replyToMessage || !replyToMessage.text) {
      return false;
    }
    
    // Kiểm tra reply có phải là +, -, % không
    if (!messageText.match(/^[+\-%]$/)) {
      return false;
    }
    
    // Tìm group và patterns
    const group = await Group.findOne({ chatId: chatId.toString() });
    if (!group || !group.autoPatterns || group.autoPatterns.length === 0) {
      return false;
    }
    
    // Trích xuất số tiền từ tin nhắn được reply
    const amount = extractAmountFromAutoPatterns(replyToMessage.text, group.autoPatterns);
    
    if (amount) {
      // Tạo tin nhắn giả để sử dụng với các handler commands
      let fakeMsg = {
        ...msg,
        text: `${messageText}${amount}` // Tạo lệnh với số tiền đã trích xuất
      };
      
      // Gọi handler tương ứng
      if (messageText === '+') {
        await handlePlusCommand(bot, fakeMsg);
      } else if (messageText === '-') {
        await handleMinusCommand(bot, fakeMsg);
      } else if (messageText === '%') {
        await handlePercentCommand(bot, fakeMsg);
      }
      
      return true; // Đã xử lý
    }
    
    return false;
  } catch (error) {
    console.error('Error in processAutoReply:', error);
    return false;
  }
};

/**
 * Xử lý reply với +, -, % vào ảnh để extract số tiền bằng OpenAI
 */
const processImageReply = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const messageText = msg.text.trim();
    const replyToMessage = msg.reply_to_message;
    
    // Kiểm tra có phải reply vào ảnh không
    if (!replyToMessage || !replyToMessage.photo) {
      return false;
    }
    
    // Kiểm tra reply có phải là +, -, % không
    if (!messageText.match(/^[+\-%]$/)) {
      return false;
    }
    
    try {
      // Lấy ảnh có độ phân giải cao nhất
      const photo = replyToMessage.photo[replyToMessage.photo.length - 1];
      
      // Lấy download link cho ảnh
      const imageUrl = await getDownloadLink(photo.file_id, process.env.TELEGRAM_BOT_TOKEN);
      
      if (!imageUrl) {
        bot.sendMessage(chatId, "❌ 无法获取图片，请重试。");
        return false;
      }
      
      // Download ảnh
      const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const imageBuffer = Buffer.from(imageResponse.data);
      
      // Extract số tiền từ ảnh bằng OpenAI
      const caption = replyToMessage.caption || '';
      const amount = await extractAmountFromImage(imageBuffer, caption);
      
      if (!amount) {
        bot.sendMessage(chatId, "❌ 无法从图片中提取金额，请检查图片内容。");
        return false;
      }
      
      // Tạo tin nhắn giả để sử dụng với các handler commands
      let fakeMsg = {
        ...msg,
        text: `${messageText}${amount}` // Tạo lệnh với số tiền đã trích xuất
      };
      
      // Gọi handler tương ứng
      if (messageText === '+') {
        await handlePlusCommand(bot, fakeMsg);
      } else if (messageText === '-') {
        await handleMinusCommand(bot, fakeMsg);
      } else if (messageText === '%') {
        await handlePercentCommand(bot, fakeMsg);
      }
      
      return true; // Đã xử lý
      
    } catch (error) {
      console.error('Error processing image:', error);
      bot.sendMessage(chatId, "❌ 处理图片时出错，请稍后重试。");
      return false;
    }
    
  } catch (error) {
    console.error('Error in processImageReply:', error);
    return false;
  }
};

module.exports = {
  handlePlusCommand,
  handleMinusCommand,
  handlePercentCommand,
  handleSkipCommand,
  handleAutoPlusCommand,
  extractAmountFromText,
  processAutoPlusMessage,
  handleAutoCommand,
  extractAmountFromAutoPatterns,
  processAutoReply,
  processImageReply
}; 