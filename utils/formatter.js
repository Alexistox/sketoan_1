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
 * Tạo tin nhắn telegram không có markdown với các cải tiến mới
 * @param {Object} jsonData - Dữ liệu cần format
 * @returns {String} - Chuỗi đã định dạng
 */
const formatTelegramMessage = (jsonData) => {
  let output = '';
  
  // Date header
  output += `🧧今日是 ${jsonData.date} 🧧\n\n`;
  
  // Xử lý phần deposits (入款)
  let depositCount = 0;
  let depositLines = [];
  
  if (jsonData.depositsList && jsonData.depositsList.length > 0) {
    depositCount = jsonData.depositsList.length;
    
    // Format với ID thứ tự và embedded links
    jsonData.depositsList.forEach((deposit, index) => {
      const idNumber = index + 1;
      const idLink = deposit.messageId ? 
        `<a href="https://t.me/c/${jsonData.chatId}/${deposit.messageId}">${idNumber}</a>` : 
        idNumber;
      depositLines.push(`[${idLink}] ${deposit.details}`);
    });
  } else if (jsonData.deposits && jsonData.deposits.trim() !== '') {
    // Nếu dùng cách cũ (chuỗi chứ không phải danh sách)
    // Đếm số dòng để tính số lượng giao dịch
    const lines = jsonData.deposits.trim().split('\n');
    depositCount = lines.length;
    depositLines = lines;
  }
  
  // Hiển thị danh sách deposits
  if (depositLines.length > 0) {
    output += `今日入款 (${depositCount}笔):\n`;
    output += `${depositLines.join('\n')}\n\n`;
  } else {
    output += `今日入款 (0笔): 没有\n\n`;
  }
  
  // Xử lý phần payments (下发)
  let paymentCount = 0;
  let paymentLines = [];
  
  if (jsonData.paymentsList && jsonData.paymentsList.length > 0) {
    paymentCount = jsonData.paymentsList.length;
    
    // Format với ID thứ tự và embedded links
    jsonData.paymentsList.forEach((payment, index) => {
      const idNumber = index + 1;
      const idLink = payment.messageId ? 
        `<a href="https://t.me/c/${jsonData.chatId}/${payment.messageId}">${idNumber}</a>` : 
        idNumber;
      paymentLines.push(`[${idLink}] ${payment.details}`);
    });
  } else if (jsonData.payments && jsonData.payments.trim() !== '') {
    // Nếu dùng cách cũ (chuỗi chứ không phải danh sách)
    // Đếm số dòng để tính số lượng giao dịch
    const lines = jsonData.payments.trim().split('\n');
    paymentCount = lines.length;
    paymentLines = lines;
  }
  
  // Hiển thị danh sách payments
  if (paymentLines.length > 0) {
    output += `今日下发 (${paymentCount}笔):\n`;
    output += `${paymentLines.join('\n')}\n\n`;
  } else {
    output += `今日下发 (0笔): 没有\n\n`;
  }
  
  // Rate information
  const rateInfo = `费率=${jsonData.rate}|💱入款汇率=${jsonData.exchangeRate}`;
  
  // Thêm ví dụ nếu có
  let rateInfoWithExample = rateInfo;
  if (jsonData.example) {
    rateInfoWithExample += `\n例子: 100.000=${jsonData.example} ${jsonData.currencyUnit || 'USDT'}`;
  }
  
  output += `${rateInfoWithExample}\n\n`;
  
  // Summary section
  output += `今日入款合计 💰: ${jsonData.totalAmount}\n`;
  output += `入款 ${jsonData.currencyUnit || 'USDT'} 合计: ${jsonData.totalUSDT}\n`;
  output += `出款 ${jsonData.currencyUnit || 'USDT'} 合计: ${jsonData.paidUSDT}\n`;
  output += `当前${jsonData.currencyUnit || 'USDT'} 剩余合计: ${jsonData.remainingUSDT}💎`;
  
  // Cards section (if present)
  if (jsonData.cards && jsonData.cards.length > 0) {
    output += `\n\n卡额度 💳:\n${jsonData.cards.join("\n")}`;
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