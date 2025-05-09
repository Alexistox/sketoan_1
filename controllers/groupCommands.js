const Group = require('../models/Group');
const Transaction = require('../models/Transaction');
const Card = require('../models/Card');
const Config = require('../models/Config');
const { formatSmart, formatRateValue, formatTelegramMessage } = require('../utils/formatter');

/**
 * Xử lý lệnh xóa dữ liệu giao dịch (上课)
 */
const handleClearCommand = async (bot, chatId, userId, senderName) => {
  try {
    // Xóa tất cả giao dịch cũ
    let group = await Group.findOne({ chatId: chatId.toString() });
    if (!group) {
      group = new Group({
        chatId: chatId.toString(),
        lastClearDate: new Date()
      });
    } else {
      // Chỉ reset totalVND và totalUSDT nếu có dữ liệu
      group.totalVND = 0;
      group.totalUSDT = 0;
      group.usdtPaid = 0;
      group.remainingUSDT = 0;
      group.lastClearDate = new Date();
    }
    
    await group.save();
    
    // Lưu transaction mới
    const transaction = new Transaction({
      chatId: chatId.toString(),
      type: 'clear',
      amount: 0,
      message: '上课',
      senderName,
      rate: group.rate,
      exchangeRate: group.exchangeRate,
      timestamp: new Date()
    });
    
    await transaction.save();
    
    // Lấy đơn vị tiền tệ
    const configCurrency = await Config.findOne({ key: 'CURRENCY_UNIT' });
    const currencyUnit = configCurrency ? configCurrency.value : 'USDT';
    
    // Tạo response JSON
    const responseData = {
      chatId: chatId.replace('-100', ''), // Chuyển đổi định dạng chatId cho Telegram link
      date: new Date().toLocaleDateString('vi-VN'),
      deposits: '',
      depositsList: [],
      payments: '',
      paymentsList: [],
      rate: formatRateValue(group.rate) + "%",
      exchangeRate: formatRateValue(group.exchangeRate),
      totalAmount: "0",
      totalUSDT: "0",
      paidUSDT: "0",
      remainingUSDT: "0",
      currencyUnit,
      cards: []
    };
    
    // Format và gửi tin nhắn
    const response = formatTelegramMessage(responseData);
    bot.sendMessage(chatId, response, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('Error in handleClearCommand:', error);
    bot.sendMessage(chatId, "处理清除数据命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh thiết lập tỷ lệ phí (设置费率)
 */
const handleRateCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const senderName = msg.from.first_name;
    const messageText = msg.text;
    
    // Phân tích tin nhắn
    const parts = messageText.split('设置费率');
    if (parts.length !== 2) {
      bot.sendMessage(chatId, "设置费率后跟要设置的费率值。例如：设置费率 3.5");
      return;
    }
    
    // Lấy tỷ lệ mới
    const rateValue = parseFloat(parts[1].trim());
    if (isNaN(rateValue)) {
      bot.sendMessage(chatId, "无效的费率值。请提供有效数字。");
      return;
    }
    
    // Tìm hoặc tạo group
    let group = await Group.findOne({ chatId: chatId.toString() });
    if (!group) {
      group = new Group({
        chatId: chatId.toString(),
        rate: rateValue
      });
    } else {
      group.rate = rateValue;
    }
    
    await group.save();
    
    // Lưu transaction mới
    const transaction = new Transaction({
      chatId: chatId.toString(),
      type: 'setRate',
      amount: 0,
      message: messageText,
      senderName,
      rate: rateValue,
      exchangeRate: group.exchangeRate,
      messageId: msg.message_id.toString(),
      timestamp: new Date()
    });
    
    await transaction.save();
    
    // Tính toán giá trị ví dụ
    let exampleValue = null;
    if (group.exchangeRate > 0) {
      exampleValue = (100000 / group.exchangeRate) * (1 - rateValue / 100);
    }
    
    // Lấy đơn vị tiền tệ
    const configCurrency = await Config.findOne({ key: 'CURRENCY_UNIT' });
    const currencyUnit = configCurrency ? configCurrency.value : 'USDT';
    
    // Lấy thông tin giao dịch gần đây
    const todayStr = new Date().toLocaleDateString('vi-VN');
    const depositsData = await getDepositHistory(chatId);
    const paymentsData = await getPaymentHistory(chatId);
    const cardSummary = await getCardSummary(chatId);
    
    // Tạo response JSON
    const responseData = {
      chatId: chatId.replace('-100', ''), // Chuyển đổi định dạng chatId cho Telegram link
      date: todayStr,
      deposits: depositsData.text,
      depositsList: depositsData.list,
      payments: paymentsData.text,
      paymentsList: paymentsData.list,
      rate: formatRateValue(rateValue) + "%",
      exchangeRate: formatRateValue(group.exchangeRate),
      totalAmount: formatSmart(group.totalVND),
      totalUSDT: formatSmart(group.totalUSDT),
      paidUSDT: formatSmart(group.usdtPaid),
      remainingUSDT: formatSmart(group.remainingUSDT),
      currencyUnit,
      cards: cardSummary
    };
    
    // Thêm ví dụ nếu có
    if (exampleValue !== null) {
      responseData.example = formatSmart(exampleValue);
    }
    
    // Format và gửi tin nhắn
    const response = formatTelegramMessage(responseData);
    bot.sendMessage(chatId, response, { parse_mode: 'HTML' });
    
  } catch (error) {
    console.error('Error in handleRateCommand:', error);
    bot.sendMessage(msg.chat.id, "处理设置费率命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh thiết lập tỷ giá (设置汇率)
 */
const handleExchangeRateCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const senderName = msg.from.first_name;
    const messageText = msg.text;
    
    // Phân tích tin nhắn
    const parts = messageText.split('设置汇率');
    if (parts.length !== 2) {
      bot.sendMessage(chatId, "设置汇率后跟要设置的汇率值。例如：设置汇率 23700");
      return;
    }
    
    // Lấy tỷ giá mới
    const rateValue = parseFloat(parts[1].trim());
    if (isNaN(rateValue)) {
      bot.sendMessage(chatId, "无效的汇率值。请提供有效数字。");
      return;
    }
    
    // Tìm hoặc tạo group
    let group = await Group.findOne({ chatId: chatId.toString() });
    if (!group) {
      group = new Group({
        chatId: chatId.toString(),
        exchangeRate: rateValue
      });
    } else {
      group.exchangeRate = rateValue;
    }
    
    await group.save();
    
    // Lưu transaction mới
    const transaction = new Transaction({
      chatId: chatId.toString(),
      type: 'setExchangeRate',
      amount: 0,
      message: messageText,
      senderName,
      rate: group.rate,
      exchangeRate: rateValue,
      messageId: msg.message_id.toString(),
      timestamp: new Date()
    });
    
    await transaction.save();
    
    // Tính toán giá trị ví dụ
    let exampleValue = null;
    if (group.rate >= 0) {
      exampleValue = (100000 / rateValue) * (1 - group.rate / 100);
    }
    
    // Lấy đơn vị tiền tệ
    const configCurrency = await Config.findOne({ key: 'CURRENCY_UNIT' });
    const currencyUnit = configCurrency ? configCurrency.value : 'USDT';
    
    // Lấy thông tin giao dịch gần đây
    const todayStr = new Date().toLocaleDateString('vi-VN');
    const depositsData = await getDepositHistory(chatId);
    const paymentsData = await getPaymentHistory(chatId);
    const cardSummary = await getCardSummary(chatId);
    
    // Tạo response JSON
    const responseData = {
      chatId: chatId.replace('-100', ''), // Chuyển đổi định dạng chatId cho Telegram link
      date: todayStr,
      deposits: depositsData.text,
      depositsList: depositsData.list,
      payments: paymentsData.text,
      paymentsList: paymentsData.list,
      rate: formatRateValue(group.rate) + "%",
      exchangeRate: formatRateValue(rateValue),
      totalAmount: formatSmart(group.totalVND),
      totalUSDT: formatSmart(group.totalUSDT),
      paidUSDT: formatSmart(group.usdtPaid),
      remainingUSDT: formatSmart(group.remainingUSDT),
      currencyUnit,
      cards: cardSummary
    };
    
    // Thêm ví dụ nếu có
    if (exampleValue !== null) {
      responseData.example = formatSmart(exampleValue);
    }
    
    // Format và gửi tin nhắn
    const response = formatTelegramMessage(responseData);
    bot.sendMessage(chatId, response, { parse_mode: 'HTML' });
    
  } catch (error) {
    console.error('Error in handleExchangeRateCommand:', error);
    bot.sendMessage(msg.chat.id, "处理设置汇率命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh thiết lập tỷ lệ phí và tỷ giá đồng thời (/d)
 */
const handleDualRateCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const senderName = msg.from.first_name;
    const messageText = msg.text;
    
    // Phân tích tin nhắn
    const parts = messageText.split('/d ');
    if (parts.length !== 2) {
      bot.sendMessage(chatId, "指令无效。格式为：/d [费率] [汇率]");
      return;
    }
    
    // Lấy tỷ lệ mới
    const values = parts[1].trim().split(' ');
    if (values.length < 2) {
      bot.sendMessage(chatId, "请同时提供费率和汇率。例如：/d 3.5 23700");
      return;
    }
    
    const newRate = parseFloat(values[0]);
    const newExRate = parseFloat(values[1]);
    
    if (isNaN(newRate) || isNaN(newExRate)) {
      bot.sendMessage(chatId, "无效的费率或汇率值。请提供有效数字。");
      return;
    }
    
    // Tìm hoặc tạo group
    let group = await Group.findOne({ chatId: chatId.toString() });
    if (!group) {
      group = new Group({
        chatId: chatId.toString(),
        rate: newRate,
        exchangeRate: newExRate
      });
    } else {
      group.rate = newRate;
      group.exchangeRate = newExRate;
    }
    
    await group.save();
    
    // Lưu transaction mới
    const transaction = new Transaction({
      chatId: chatId.toString(),
      type: 'setRate',
      amount: 0,
      message: messageText,
      senderName,
      rate: newRate,
      exchangeRate: newExRate,
      messageId: msg.message_id.toString(),
      timestamp: new Date()
    });
    
    await transaction.save();
    
    // Tính toán giá trị ví dụ
    const exampleValue = (100000 / newExRate) * (1 - newRate / 100);
    
    // Lấy đơn vị tiền tệ
    const configCurrency = await Config.findOne({ key: 'CURRENCY_UNIT' });
    const currencyUnit = configCurrency ? configCurrency.value : 'USDT';
    
    // Lấy thông tin giao dịch gần đây
    const todayStr = new Date().toLocaleDateString('vi-VN');
    const depositsData = await getDepositHistory(chatId);
    const paymentsData = await getPaymentHistory(chatId);
    const cardSummary = await getCardSummary(chatId);
    
    // Tạo response JSON
    const responseData = {
      chatId: chatId.replace('-100', ''), // Chuyển đổi định dạng chatId cho Telegram link
      date: todayStr,
      deposits: depositsData.text,
      depositsList: depositsData.list,
      payments: paymentsData.text,
      paymentsList: paymentsData.list,
      rate: formatRateValue(newRate) + "%",
      exchangeRate: formatRateValue(newExRate),
      example: formatSmart(exampleValue),
      totalAmount: formatSmart(group.totalVND),
      totalUSDT: formatSmart(group.totalUSDT),
      paidUSDT: formatSmart(group.usdtPaid),
      remainingUSDT: formatSmart(group.remainingUSDT),
      currencyUnit,
      cards: cardSummary
    };
    
    // Format và gửi tin nhắn
    const response = formatTelegramMessage(responseData);
    bot.sendMessage(chatId, response, { parse_mode: 'HTML' });
    
  } catch (error) {
    console.error('Error in handleDualRateCommand:', error);
    bot.sendMessage(msg.chat.id, "处理双费率命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh xóa dữ liệu nhóm (/delete)
 */
const handleDeleteCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    
    // Xóa tất cả giao dịch của nhóm
    await Transaction.deleteMany({ chatId: chatId.toString() });
    
    // Xóa tất cả thông tin thẻ
    await Card.deleteMany({ chatId: chatId.toString() });
    
    // Reset thông tin nhóm
    let group = await Group.findOne({ chatId: chatId.toString() });
    if (!group) {
      group = new Group({ chatId: chatId.toString() });
    } else {
      group.totalVND = 0;
      group.totalUSDT = 0;
      group.usdtPaid = 0;
      group.remainingUSDT = 0;
      group.rate = 0;
      group.exchangeRate = 0;
      group.lastClearDate = new Date();
    }
    
    await group.save();
    
    // Lưu transaction mới về lệnh delete
    const transaction = new Transaction({
      chatId: chatId.toString(),
      type: 'delete',
      message: '/delete',
      senderName: msg.from.first_name,
      timestamp: new Date()
    });
    
    await transaction.save();
    
    bot.sendMessage(chatId, "Dữ liệu đã được xóa.");
    
  } catch (error) {
    console.error('Error in handleDeleteCommand:', error);
    bot.sendMessage(msg.chat.id, "处理删除命令时出错。请稍后再试。");
  }
};

/**
 * Hàm lấy lịch sử giao dịch gửi tiền
 */
const getDepositHistory = async (chatId) => {
  try {
    // Tìm nhóm và lấy ngày clear cuối cùng
    const group = await Group.findOne({ chatId: chatId.toString() });
    if (!group) return "";
    
    const lastClearDate = group.lastClearDate;
    
    // Lấy tất cả giao dịch deposit và withdraw sau lần clear cuối
    const transactions = await Transaction.find({
      chatId: chatId.toString(),
      type: { $in: ['deposit', 'withdraw'] },
      timestamp: { $gt: lastClearDate }
    }).sort({ timestamp: -1 }).limit(10);
    
    if (transactions.length === 0) return "";
    
    // Hỗ trợ cả hai chế độ: chuỗi (cũ) và danh sách (mới)
    
    // Format giá trị trả về chuỗi (backwards compatibility)
    const details = transactions.map(t => t.details).filter(d => d && d.trim() !== '');
    
    // Format giá trị trả về danh sách (mới)
    const detailsList = transactions.map(t => ({
      details: t.details,
      messageId: t.messageId || '',
      type: t.type,
      amount: t.amount,
      usdtAmount: t.usdtAmount,
      timestamp: t.timestamp
    }));
    
    // Trả về cả hai giá trị, formatter sẽ ưu tiên dùng danh sách nếu có
    return {
      text: details.join('\n'),
      list: detailsList
    };
  } catch (error) {
    console.error('Error in getDepositHistory:', error);
    return "";
  }
};

/**
 * Hàm lấy lịch sử giao dịch thanh toán
 */
const getPaymentHistory = async (chatId) => {
  try {
    // Tìm nhóm và lấy ngày clear cuối cùng
    const group = await Group.findOne({ chatId: chatId.toString() });
    if (!group) return "";
    
    const lastClearDate = group.lastClearDate;
    
    // Lấy tất cả giao dịch payment sau lần clear cuối
    const transactions = await Transaction.find({
      chatId: chatId.toString(),
      type: 'payment',
      timestamp: { $gt: lastClearDate }
    }).sort({ timestamp: -1 }).limit(5);
    
    if (transactions.length === 0) return "";
    
    // Hỗ trợ cả hai chế độ: chuỗi (cũ) và danh sách (mới)
    
    // Format giá trị trả về chuỗi (backwards compatibility)
    const details = transactions.map(t => t.details).filter(d => d && d.trim() !== '');
    
    // Format giá trị trả về danh sách (mới)
    const detailsList = transactions.map(t => ({
      details: t.details,
      messageId: t.messageId || '',
      amount: t.amount,
      usdtAmount: t.usdtAmount,
      timestamp: t.timestamp
    }));
    
    // Trả về cả hai giá trị, formatter sẽ ưu tiên dùng danh sách nếu có
    return {
      text: details.join('\n'),
      list: detailsList
    };
  } catch (error) {
    console.error('Error in getPaymentHistory:', error);
    return "";
  }
};

/**
 * Hàm lấy thông tin các thẻ
 */
const getCardSummary = async (chatId) => {
  try {
    // Lấy tất cả thẻ của nhóm không bị ẩn
    const cards = await Card.find({
      chatId: chatId.toString(),
      hidden: false
    });
    
    if (cards.length === 0) return [];
    
    // Lấy thông tin group
    const group = await Group.findOne({ chatId: chatId.toString() });
    const showRemaining = (group && group.rate === 0 && group.exchangeRate === 1);
    
    // Format thông tin từng thẻ
    const summary = cards.map(card => {
      let cardInfo = `${card.cardCode}=${formatSmart(card.total)}`;
      
      // Thêm thông tin limit nếu có
      if (card.limit > 0) {
        const remaining = card.limit - card.total;
        cardInfo += `|剩余额度:${formatSmart(remaining)}`;
      }
      
      // Thêm thông tin thanh toán còn lại nếu rate=0 và exchange rate=1
      if (showRemaining) {
        const remainingPayment = card.total - card.paid;
        cardInfo += `|剩余余额:${formatSmart(remainingPayment)}`;
      }
      
      return cardInfo;
    });
    
    return summary;
  } catch (error) {
    console.error('Error in getCardSummary:', error);
    return [];
  }
};

module.exports = {
  handleClearCommand,
  handleRateCommand,
  handleExchangeRateCommand,
  handleDualRateCommand,
  handleDeleteCommand,
  getDepositHistory,
  getPaymentHistory,
  getCardSummary
}; 