const Transaction = require('../models/Transaction');
const Settings = require('../models/Settings');
const { formatSmart, formatRateValue, formatTelegramMessage } = require('../utils/formatters');
const moment = require('moment');

const handlePlusCommand = async (chatId, message, username) => {
  const parts = message.split('+');
  if (parts.length !== 2) {
    return "指令无效。格式为：+数字 或 +数字 [卡号] [额度]";
  }

  const inputParts = parts[1].trim().split(' ');
  const expr = inputParts[0];
  const cardCode = inputParts.length > 1 ? inputParts[1].toUpperCase() : '';
  const cardLimit = inputParts.length > 2 ? parseFloat(inputParts[2]) : '';

  let amountVND;
  try {
    amountVND = eval(expr);
  } catch (err) {
    return "表达式无效，请重试。";
  }

  if (isNaN(amountVND)) {
    return "金额无效";
  }

  const lastTransaction = await Transaction.findOne({ chatId }).sort({ createdAt: -1 });
  if (!lastTransaction) {
    return "请设置汇率，费率";
  }

  const { rate, exchangeRate } = lastTransaction;
  if (!exchangeRate) {
    return "请设置汇率，费率";
  }

  const newUSDT = (amountVND / exchangeRate) * (1 - rate / 100);
  const totalVND = (lastTransaction.totalVND || 0) + amountVND;
  const totalUSDT = (lastTransaction.totalUSDT || 0) + newUSDT;
  const usdtPaid = lastTransaction.usdtPaid || 0;
  const remain = totalUSDT - usdtPaid;

  const timestamp = moment().format('HH:mm');
  const details = cardCode 
    ? `${timestamp} +${formatSmart(amountVND)} (${cardCode}) = ${formatSmart(newUSDT)} USDT`
    : `${timestamp} +${formatSmart(amountVND)} = ${formatSmart(newUSDT)} USDT`;

  const transaction = new Transaction({
    chatId,
    message,
    totalVND,
    totalUSDT,
    usdtPaid,
    remainingUSDT: remain,
    timestamp,
    username,
    rawAmount: amountVND,
    details,
    rate,
    exchangeRate,
    cardCode,
    limit: cardLimit
  });

  await transaction.save();

  const cardSummary = await getCardSummary(chatId);
  const todayStr = moment().format('DD/MM/YYYY');

  const responseData = {
    date: todayStr,
    deposits: await getColumnValues(chatId, 'details'),
    payments: await getColumnValues(chatId, 'paymentDetails'),
    rate: formatRateValue(rate) + "%",
    exchangeRate: formatRateValue(exchangeRate),
    totalAmount: formatSmart(totalVND),
    totalUSDT: formatSmart(totalUSDT),
    paidUSDT: formatSmart(usdtPaid),
    remainingUSDT: formatSmart(remain),
    cards: cardSummary
  };

  if (Math.abs(amountVND) < 1) {
    responseData.example = formatSmart((100000 / exchangeRate) * (1 - rate / 100));
  }

  return formatTelegramMessage(responseData);
};

const handleMinusCommand = async (chatId, message, username) => {
  const parts = message.split('-');
  if (parts.length !== 2) {
    return "指令无效。格式为：-数字 或 -数字 [卡号]";
  }

  const inputParts = parts[1].trim().split(' ');
  const expr = inputParts[0];
  const cardCode = inputParts.length > 1 ? inputParts[1].toUpperCase() : '';

  let amountVND;
  try {
    amountVND = eval(expr);
  } catch (err) {
    return "表达式无效，请重试。";
  }

  if (isNaN(amountVND)) {
    return "金额无效";
  }

  const lastTransaction = await Transaction.findOne({ chatId }).sort({ createdAt: -1 });
  if (!lastTransaction) {
    return "请设置汇率，费率";
  }

  const { rate, exchangeRate } = lastTransaction;
  if (!exchangeRate) {
    return "请设置汇率，费率";
  }

  const minusUSDT = (amountVND / exchangeRate) * (1 - rate / 100);
  const totalVND = (lastTransaction.totalVND || 0) - amountVND;
  const totalUSDT = (lastTransaction.totalUSDT || 0) - minusUSDT;
  const usdtPaid = lastTransaction.usdtPaid || 0;
  const newRemain = totalUSDT - usdtPaid;

  const timestamp = moment().format('HH:mm');
  const details = cardCode
    ? `${timestamp} -${formatSmart(amountVND)} (${cardCode}) = -${formatSmart(minusUSDT)} USDT`
    : `${timestamp} -${formatSmart(amountVND)} = -${formatSmart(minusUSDT)} USDT`;

  const transaction = new Transaction({
    chatId,
    message,
    totalVND,
    totalUSDT,
    usdtPaid,
    remainingUSDT: newRemain,
    timestamp,
    username,
    rawAmount: -amountVND,
    details,
    rate,
    exchangeRate,
    cardCode
  });

  await transaction.save();

  const cardSummary = await getCardSummary(chatId);
  const todayStr = moment().format('DD/MM/YYYY');

  const responseData = {
    date: todayStr,
    deposits: await getColumnValues(chatId, 'details'),
    payments: await getColumnValues(chatId, 'paymentDetails'),
    rate: formatRateValue(rate) + "%",
    exchangeRate: formatRateValue(exchangeRate),
    totalAmount: formatSmart(totalVND),
    totalUSDT: formatSmart(totalUSDT),
    paidUSDT: formatSmart(usdtPaid),
    remainingUSDT: formatSmart(newRemain),
    cards: cardSummary
  };

  if (Math.abs(amountVND) < 1) {
    responseData.example = formatSmart((100000 / exchangeRate) * (1 - rate / 100));
  }

  return formatTelegramMessage(responseData);
};

const handlePercentCommand = async (chatId, message, username) => {
  const parts = message.split('下发');
  if (parts.length !== 2) {
    return "指令无效。格式为：下发数字 (USDT) 或 下发数字 [卡号]";
  }

  const inputParts = parts[1].trim().split(' ');
  const expr = inputParts[0];
  const cardCode = inputParts.length > 1 ? inputParts[1].toUpperCase() : '';

  let payUSDT;
  try {
    payUSDT = eval(expr);
  } catch (err) {
    return "表达式无效，请重试。";
  }

  if (isNaN(payUSDT)) {
    return "USDT金额无效";
  }

  const lastTransaction = await Transaction.findOne({ chatId }).sort({ createdAt: -1 });
  if (!lastTransaction) {
    return "请设置汇率，费率";
  }

  const { rate, exchangeRate } = lastTransaction;
  if (!exchangeRate) {
    return "请设置汇率，费率";
  }

  const totalVND = lastTransaction.totalVND || 0;
  const totalUSDT = lastTransaction.totalUSDT || 0;
  const oldPaid = lastTransaction.usdtPaid || 0;
  const newPaid = oldPaid + payUSDT;
  const newRemain = totalUSDT - newPaid;

  const timestamp = moment().format('HH:mm');
  const paymentDetails = cardCode
    ? `${timestamp} +${formatSmart(payUSDT)} USDT (${cardCode})`
    : `${timestamp} +${formatSmart(payUSDT)} USDT`;

  const transaction = new Transaction({
    chatId,
    message,
    totalVND,
    totalUSDT,
    usdtPaid: newPaid,
    remainingUSDT: newRemain,
    timestamp,
    username,
    rawUsdtPaid: payUSDT,
    paymentDetails,
    rate,
    exchangeRate,
    cardCode
  });

  await transaction.save();

  const cardSummary = await getCardSummary(chatId);
  const todayStr = moment().format('DD/MM/YYYY');

  const responseData = {
    date: todayStr,
    deposits: await getColumnValues(chatId, 'details'),
    payments: await getColumnValues(chatId, 'paymentDetails'),
    rate: formatRateValue(rate) + "%",
    exchangeRate: formatRateValue(exchangeRate),
    totalAmount: formatSmart(totalVND),
    totalUSDT: formatSmart(totalUSDT),
    paidUSDT: formatSmart(newPaid),
    remainingUSDT: formatSmart(newRemain),
    cards: cardSummary
  };

  if (Math.abs(payUSDT) < 0.1) {
    responseData.example = formatSmart((100000 / exchangeRate) * (1 - rate / 100));
  }

  return formatTelegramMessage(responseData);
};

const getCardSummary = async (chatId) => {
  const lastTransaction = await Transaction.findOne({ chatId }).sort({ createdAt: -1 });
  if (!lastTransaction) return [];

  const { rate, exchangeRate } = lastTransaction;
  const showRemaining = (rate === 0 && exchangeRate === 1);

  const transactions = await Transaction.find({
    chatId,
    createdAt: { $gte: moment().startOf('day').toDate() }
  });

  const cards = {};
  transactions.forEach(transaction => {
    const { rawAmount, rawUsdtPaid, cardCode, limit } = transaction;
    if (cardCode) {
      if (!cards[cardCode]) {
        cards[cardCode] = {
          total: 0,
          paid: 0,
          limit: limit > 0 ? limit : 0
        };
      }
      cards[cardCode].total += rawAmount || 0;
      cards[cardCode].paid += rawUsdtPaid || 0;
      if (limit > 0 && cards[cardCode].limit !== limit) {
        cards[cardCode].limit = limit;
      }
    }
  });

  const summary = [];
  for (const code in cards) {
    const card = cards[code];
    const cardLimit = card.limit;
    const remaining = cardLimit - card.total;

    let cardInfo = `${code}=${formatSmart(card.total)}`;

    if (cardLimit > 0) {
      cardInfo += `|剩余额度:${formatSmart(remaining)}`;
    }

    if (showRemaining) {
      const remainingPayment = card.total - card.paid;
      cardInfo += `|剩余余额:${formatSmart(remainingPayment)}`;
    }

    summary.push(cardInfo);
  }

  return summary;
};

const getColumnValues = async (chatId, field) => {
  const transactions = await Transaction.find({
    chatId,
    [field]: { $exists: true, $ne: '' },
    createdAt: { $gte: moment().startOf('day').toDate() }
  }).sort({ createdAt: -1 }).limit(field === 'details' ? 5 : 3);

  return transactions
    .map(t => t[field])
    .filter(value => {
      if (!value) return false;
      if (value.includes(" +0 ") || value.includes(" -0 ") || 
          value.includes(" = 0 ") || value.includes("= 0,00 ")) return false;
      return true;
    })
    .map(value => value.replace(" = ", "=").replace(" (", "(").replace(") ", ")"))
    .join("\n");
};

module.exports = {
  handlePlusCommand,
  handleMinusCommand,
  handlePercentCommand
}; 