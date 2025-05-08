const formatSmart = (num) => {
  const floorVal = Math.floor(Math.abs(num));
  const fraction = Math.abs(num) - floorVal;
  
  if (fraction < 1e-9) {
    return Math.round(num).toString();
  } else {
    return num.toFixed(2);
  }
};

const formatRateValue = (num) => {
  num = parseFloat(num);
  if (isNaN(num)) {
    return "0.00";
  }
  return num.toFixed(2);
};

const formatTelegramMessage = (jsonData) => {
  const currencyUnit = jsonData.currencyUnit || 'USDT';
  
  let output = '';
  
  // Date header (bold)
  output += `*🧧今日是 ${jsonData.date} 🧧*\n`;
  
  if (jsonData.deposits && jsonData.deposits.trim() !== '') {
    output += "今日入款:\n";
    output += `\`\`\`\n${jsonData.deposits}\n\`\`\``;
  } else {
    output += "今日入款: 没有\n\n";
  }
  
  if (jsonData.payments && jsonData.payments.trim() !== '') {
    output += "今日下发:\n";
    output += `\`\`\`\n${jsonData.payments}\n\`\`\``;
  } else {
    output += "今日下发: 没有\n\n";
  }
  
  const rateInfo = `费率=${jsonData.rate}|💱入款汇率=${jsonData.exchangeRate}`;
  
  if (jsonData.example) {
    rateInfo += `\n例子: 100.000=${jsonData.example} ${currencyUnit}`;
  }
  
  output += `\`\`\`\n${rateInfo}\n\`\`\``;
  
  output += `*今日入款合计 💰: ${jsonData.totalAmount}*\n`;
  output += `*入款 ${currencyUnit} 合计: ${jsonData.totalUSDT}*\n`;
  output += `*出款 ${currencyUnit} 合计: ${jsonData.paidUSDT}*\n`;
  output += `*当前${currencyUnit} 剩余合计: ${jsonData.remainingUSDT}*💎`;
  
  if (jsonData.cards && jsonData.cards.length > 0) {
    output += `\n 卡额度 💳:\n\`\`\`\n${jsonData.cards.join("\n")}\`\`\``;
  }
  
  return output;
};

module.exports = {
  formatSmart,
  formatRateValue,
  formatTelegramMessage
}; 