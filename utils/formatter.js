/**
 * Định dạng số thông minh: không có dấu phẩy phần nghìn, dấu chấm phần thập phân
 * @param {Number} num - Số cần định dạng
 * @returns {String} - Chuỗi đã định dạng
 */
const formatSmart = (num) => {
  const floorVal = Math.floor(Math.abs(num));
  const fraction = Math.abs(num) - floorVal;
  
  if (fraction < 1e-9) {
    // Số nguyên: chỉ hiển thị số không có định dạng
    return Math.round(num).toString();
  } else {
    // Số thập phân: hiển thị với 2 chữ số sau dấu chấm
    return num.toFixed(2);
  }
};

/**
 * Định dạng giá trị tỷ lệ (rate)
 * @param {Number} num - Số cần định dạng
 * @returns {String} - Chuỗi đã định dạng với 2 chữ số thập phân
 */
const formatRateValue = (num) => {
  // Đảm bảo num là số
  num = parseFloat(num);
  if (isNaN(num)) {
    return "0.00";
  }
  
  // Luôn hiển thị 2 chữ số thập phân
  return num.toFixed(2);
};

/**
 * Kiểm tra xem chuỗi có phải biểu thức toán học hợp lệ không
 * @param {String} msg - Chuỗi cần kiểm tra
 * @returns {Boolean} - true nếu là biểu thức toán học
 */
const isMathExpression = (msg) => {
  const mathRegex = /^[0-9+\-*/().\s]+$/;
  return mathRegex.test(msg);
};

/**
 * Kiểm tra xem chuỗi có phải là một số đơn giản không
 * @param {String} msg - Chuỗi cần kiểm tra
 * @returns {Boolean} - true nếu là số đơn giản
 */
const isSingleNumber = (msg) => {
  const numberRegex = /^-?\d+(\.\d+)?$/;
  return numberRegex.test(msg.trim());
};

/**
 * Kiểm tra xem chuỗi có phải là địa chỉ TRC20 hợp lệ không
 * @param {String} str - Chuỗi cần kiểm tra
 * @returns {Boolean} - true nếu là địa chỉ TRC20 hợp lệ
 */
const isTrc20Address = (str) => {
  const re = /^T[1-9A-Za-z]{33}$/;
  return re.test(str);
};

/**
 * Tạo tin nhắn telegram với định dạng markdown
 * @param {Object} jsonData - Dữ liệu cần format
 * @returns {String} - Chuỗi đã định dạng
 */
const formatTelegramMessage = (jsonData) => {
  let output = '';
  
  // Date header (bold)
  output += `*🧧今日是 ${jsonData.date} 🧧*\n`;
  
  if (jsonData.deposits && jsonData.deposits.trim() !== '') {
    output += "今日入款:\n";
    output += `\`\`\`\n${jsonData.deposits}\n\`\`\``;
  } else {
    output += "今日入款: 没有\n\n";
  }
  
  // Payments section
  if (jsonData.payments && jsonData.payments.trim() !== '') {
    output += "今日下发:\n";
    output += `\`\`\`\n${jsonData.payments}\n\`\`\``;
  } else {
    output += "今日下发: 没有\n\n";
  }
  
  // Rate information
  const rateInfo = `费率=${jsonData.rate}|💱入款汇率=${jsonData.exchangeRate}`;
  
  // Thêm ví dụ nếu có
  let rateInfoWithExample = rateInfo;
  if (jsonData.example) {
    rateInfoWithExample += `\n例子: 100.000=${jsonData.example} ${jsonData.currencyUnit || 'USDT'}`;
  }
  
  output += `\`\`\`\n${rateInfoWithExample}\n\`\`\``;
  
  // Summary section (bold)
  output += `*今日入款合计 💰: ${jsonData.totalAmount}*\n`;
  output += `*入款 ${jsonData.currencyUnit || 'USDT'} 合计: ${jsonData.totalUSDT}*\n`;
  output += `*出款 ${jsonData.currencyUnit || 'USDT'} 合计: ${jsonData.paidUSDT}*\n`;
  output += `*当前${jsonData.currencyUnit || 'USDT'} 剩余合计: ${jsonData.remainingUSDT}*💎`;
  
  // Cards section (if present)
  if (jsonData.cards && jsonData.cards.length > 0) {
    output += `\n 卡额度 💳:\n\`\`\`\n${jsonData.cards.join("\n")}\`\`\``;
  }
  
  return output;
};

module.exports = {
  formatSmart,
  formatRateValue,
  isMathExpression,
  isSingleNumber,
  isTrc20Address,
  formatTelegramMessage
}; 