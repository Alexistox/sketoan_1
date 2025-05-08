const Settings = require('../models/Settings');
const Transaction = require('../models/Transaction');
const moment = require('moment');
const { formatSmart, formatRateValue, formatTelegramMessage } = require('../utils/formatters');

const handleReportCommand = async (chatId, bot) => {
  try {
    // Get today's transactions
    const today = moment().startOf('day');
    const transactions = await Transaction.find({
      chatId,
      timestamp: { $gte: today.toDate() }
    }).sort({ timestamp: 1 });

    if (transactions.length === 0) {
      await bot.sendMessage(chatId, "暂无任何交易数据可用于生成报告。");
      return;
    }

    // Get latest transaction for current totals
    const latest = transactions[transactions.length - 1];
    const totalVND = latest.totalVND || 0;
    const totalUSDT = latest.totalUSDT || 0;
    const usdtPaid = latest.usdtPaid || 0;
    const remain = latest.remainingUSDT || 0;
    const xValue = latest.rate || 0;
    const yValue = latest.exchangeRate || 0;

    // Calculate completion rate
    const completionRate = totalUSDT > 0 ? (usdtPaid / totalUSDT) * 100 : 0;

    // Get card summary
    const cardSummary = await getCardSummary(transactions);

    // Get deposit and payment history
    const depositHistory = getDepositHistory(transactions);
    const paymentHistory = getPaymentHistory(transactions);

    // Create report
    const todayStr = moment().format('DD/MM/YYYY');
    const currentTime = moment().format('HH:mm');

    const report = `*交易报告 (${todayStr})*\n\n`;
    
    // Overview section
    report += `*概览*\n`;
    report += `总金额: ${formatSmart(totalVND)}\n`;
    report += `总 USDT: ${formatSmart(totalUSDT)}\n`;
    report += `USDT 已支付: ${formatSmart(usdtPaid)}\n`;
    report += `USDT 剩余: ${formatSmart(remain)}\n`;
    report += `完成率: ${formatSmart(completionRate)}%\n`;
    report += `费率: ${formatRateValue(xValue)}%| `;
    report += `汇率: ${formatRateValue(yValue)}\n\n`;

    // Card details section
    if (cardSummary && cardSummary.length > 0) {
      report += `*今日卡*\n\`\`\`\n${cardSummary.join("\n")}\n\`\`\`\n`;
    }

    // Deposit history section
    if (depositHistory) {
      report += `*今日入款*\n\`\`\`\n${depositHistory}\n\`\`\`\n`;
    }

    // Payment history section
    if (paymentHistory) {
      report += `*今日下发*\n\`\`\`\n${paymentHistory}\n\`\`\``;
    }

    await bot.sendMessage(chatId, report, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error generating report:', error);
    await bot.sendMessage(chatId, "生成报告时出错，请重试。");
  }
};

const handleClearCommand = async (chatId, username, bot) => {
  try {
    // Get current rate and exchange rate
    const latestTransaction = await Transaction.findOne({ chatId })
      .sort({ timestamp: -1 });

    const currentRate = latestTransaction ? latestTransaction.rate : 0;
    const currentExRate = latestTransaction ? latestTransaction.exchangeRate : 0;

    // Create new transaction with zeroed values
    const newTransaction = new Transaction({
      chatId,
      message: '/clear',
      totalVND: 0,
      totalUSDT: 0,
      usdtPaid: 0,
      remainingUSDT: 0,
      timestamp: moment().format('HH:mm'),
      username,
      rate: currentRate,
      exchangeRate: currentExRate
    });

    await newTransaction.save();

    // Calculate example value
    let exampleValue = 0;
    if (currentExRate > 0) {
      exampleValue = (100000 / currentExRate) * (1 - currentRate / 100);
    }

    const todayStr = moment().format('DD/MM/YYYY');
    const responseData = {
      date: todayStr,
      deposits: "",
      payments: "",
      rate: formatRateValue(currentRate) + "%",
      exchangeRate: formatRateValue(currentExRate),
      example: formatSmart(exampleValue),
      totalAmount: "0",
      totalUSDT: "0",
      paidUSDT: "0",
      remainingUSDT: "0",
      cards: []
    };

    const response = formatTelegramMessage(responseData);
    await bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error handling clear command:', error);
    await bot.sendMessage(chatId, "处理清除命令时出错，请重试。");
  }
};

const handleDualCommand = async (chatId, message, username, bot) => {
  try {
    const param = message.substring(3).trim();
    const parts = param.split('/');
    
    if (parts.length !== 2) {
      await bot.sendMessage(chatId, "语法无效。例如: /d 2/14600");
      return;
    }

    const newRate = parseFloat(parts[0]);
    const newExRate = parseFloat(parts[1]);

    if (isNaN(newRate) || isNaN(newExRate)) {
      await bot.sendMessage(chatId, "输入的数值无效，请检查后重试。");
      return;
    }

    // Get latest transaction for current totals
    const latestTransaction = await Transaction.findOne({ chatId })
      .sort({ timestamp: -1 });

    const totalVND = latestTransaction ? latestTransaction.totalVND : 0;
    const totalUSDT = latestTransaction ? latestTransaction.totalUSDT : 0;
    const usdtPaid = latestTransaction ? latestTransaction.usdtPaid : 0;
    const remain = latestTransaction ? latestTransaction.remainingUSDT : 0;

    // Create new transaction
    const newTransaction = new Transaction({
      chatId,
      message,
      totalVND,
      totalUSDT,
      usdtPaid,
      remainingUSDT: remain,
      timestamp: moment().format('HH:mm'),
      username,
      rate: newRate,
      exchangeRate: newExRate
    });

    await newTransaction.save();

    // Get card summary
    const transactions = await Transaction.find({
      chatId,
      timestamp: { $gte: moment().startOf('day').toDate() }
    }).sort({ timestamp: 1 });

    const cardSummary = await getCardSummary(transactions);

    // Calculate example value
    const exampleValue = (100000 / newExRate) * (1 - newRate / 100);

    const todayStr = moment().format('DD/MM/YYYY');
    const responseData = {
      date: todayStr,
      deposits: getDepositHistory(transactions),
      payments: getPaymentHistory(transactions),
      rate: formatRateValue(newRate) + "%",
      exchangeRate: formatRateValue(newExRate),
      example: formatSmart(exampleValue),
      totalAmount: formatSmart(totalVND),
      totalUSDT: formatSmart(totalUSDT),
      paidUSDT: formatSmart(usdtPaid),
      remainingUSDT: formatSmart(remain),
      cards: cardSummary
    };

    const response = formatTelegramMessage(responseData);
    await bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error handling dual command:', error);
    await bot.sendMessage(chatId, "处理双重命令时出错，请重试。");
  }
};

const handleCalculateCommand = async (chatId, message, bot) => {
  try {
    const parts = message.trim().split(' ');
    if (parts.length < 2) {
      await bot.sendMessage(chatId, "语法无效。例如: /t 100000 或 /v 100");
      return;
    }

    const amount = parseFloat(parts[1]);
    if (isNaN(amount)) {
      await bot.sendMessage(chatId, "金额无效。");
      return;
    }

    // Get latest transaction for current rates
    const latestTransaction = await Transaction.findOne({ chatId })
      .sort({ timestamp: -1 });

    if (!latestTransaction) {
      await bot.sendMessage(chatId, "请设置汇率，费率");
      return;
    }

    const xValue = latestTransaction.rate || 0;
    const yValue = latestTransaction.exchangeRate || 0;

    if (yValue === 0) {
      await bot.sendMessage(chatId, "请设置汇率，费率");
      return;
    }

    let result;
    if (message.startsWith('/t')) {
      // Calculate USDT from VND
      result = (amount / yValue) * (1 - xValue / 100);
      const copyableResult = result.toFixed(2).replace('.', ',');
      await bot.sendMessage(chatId, `${formatSmart(amount)} = \`${copyableResult}\` USDT`, { parse_mode: 'Markdown' });
    } else if (message.startsWith('/v')) {
      // Calculate VND from USDT
      result = amount / (1 - xValue / 100) * yValue;
      await bot.sendMessage(chatId, `${amount} USDT = \`${formatSmart(result)}\``, { parse_mode: 'Markdown' });
    }
  } catch (error) {
    console.error('Error handling calculate command:', error);
    await bot.sendMessage(chatId, "计算时出错，请重试。");
  }
};

// Helper functions
const getCardSummary = async (transactions) => {
  const cards = {};
  
  for (const tx of transactions) {
    if (tx.cardCode) {
      if (!cards[tx.cardCode]) {
        cards[tx.cardCode] = {
          total: 0,
          paid: 0,
          limit: tx.limit || 0
        };
      }
      
      cards[tx.cardCode].total += tx.rawAmount || 0;
      cards[tx.cardCode].paid += tx.rawUsdtPaid || 0;
      
      if (tx.limit > 0) {
        cards[tx.cardCode].limit = tx.limit;
      }
    }
  }

  const summary = [];
  for (const [code, data] of Object.entries(cards)) {
    if (!await isCardHidden(code)) {
      const remaining = data.limit - data.total;
      let cardInfo = `${code}=${formatSmart(data.total)}`;
      
      if (data.limit > 0) {
        cardInfo += `|剩余额度:${formatSmart(remaining)}`;
      }
      
      if (data.total - data.paid > 0) {
        cardInfo += `|剩余余额:${formatSmart(data.total - data.paid)}`;
      }
      
      summary.push(cardInfo);
    }
  }
  
  return summary;
};

const getDepositHistory = (transactions) => {
  return transactions
    .filter(tx => tx.details && !tx.details.includes('= 0'))
    .map(tx => tx.details)
    .join('\n');
};

const getPaymentHistory = (transactions) => {
  return transactions
    .filter(tx => tx.paymentDetails)
    .map(tx => tx.paymentDetails)
    .join('\n');
};

const isCardHidden = async (cardCode) => {
  const setting = await Settings.findOne({ key: 'HIDDEN_CARDS' });
  if (!setting) return false;
  
  const hiddenCards = setting.value.split(',').map(c => c.trim());
  return hiddenCards.includes(cardCode.toUpperCase());
};

module.exports = {
  handleReportCommand,
  handleClearCommand,
  handleDualCommand,
  handleCalculateCommand
}; 