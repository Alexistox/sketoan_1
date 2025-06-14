/**
 * Định dạng số thông minh: không có dấu phẩy phần nghìn, dấu chấm phần thập phân
 * @param {Number} num - Số cần định dạng
 * @param {String} format - Loại format ('default' hoặc 'formatted')
 * @returns {String} - Chuỗi đã định dạng
 */
const formatSmart = (num, format = 'default') => {
  if (format === 'formatted') {
    return formatNumberWithCommas(num);
  }
  
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
 * Định dạng số có dấu phẩy ngăn cách hàng nghìn và dấu chấm thập phân
 * @param {Number} num - Số cần định dạng
 * @returns {String} - Chuỗi đã định dạng với dấu phẩy
 */
const formatNumberWithCommas = (num) => {
  const floorVal = Math.floor(Math.abs(num));
  const fraction = Math.abs(num) - floorVal;
  
  let result = '';
  
  if (fraction < 1e-9) {
    // Số nguyên: thêm dấu phẩy ngăn cách hàng nghìn
    result = Math.round(num).toLocaleString('en-US');
  } else {
    // Số thập phân: thêm dấu phẩy và hiển thị 2 chữ số sau dấu chấm
    result = num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
  
  return result;
};

/**
 * Định dạng giá trị tỷ lệ (rate)
 * @param {Number} num - Số cần định dạng
 * @returns {String} - Chuỗi đã định dạng
 */
const formatRateValue = (num) => {
  // Đảm bảo num là số
  num = parseFloat(num);
  if (isNaN(num)) {
    return "0";
  }
  
  // Nếu là số nguyên, trả về không có số thập phân
  if (Number.isInteger(num)) {
    return num.toString();
  }
  
  // Nếu là số thập phân, loại bỏ các số 0 ở cuối
  return num.toString().replace(/\.?0+$/, '');
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
 * Format date in US style (MM/DD/YYYY)
 * @param {Date} date - Date to format
 * @returns {String} - Formatted date string
 */
const formatDateUS = (date) => {
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${year}/${month}/${day}`;
};

/**
 * Định dạng thời gian theo định dạng 24h (HH:mm:ss) theo múi giờ Campuchia (Asia/Phnom_Penh)
 * @param {Date} date - Đối tượng ngày cần định dạng
 * @returns {String} - Chuỗi thời gian đã định dạng (ví dụ: 14:05:00)
 */
const formatTimeString = (date) => {
  return date.toLocaleTimeString('en-US', { timeZone: 'Asia/Phnom_Penh', hour12: false });
};

/**
 * Lấy định dạng số của người dùng theo nhóm
 */
const getUserNumberFormat = async (userId, chatId) => {
  try {
    const User = require('../models/User');
    const user = await User.findOne({ userId: userId.toString() });
    
    if (!user) return 'default';
    
    // Tìm cài đặt cho nhóm cụ thể
    const groupSetting = user.groupPermissions.find(gp => gp.chatId === chatId.toString());
    
    return groupSetting ? groupSetting.numberFormat : 'default';
  } catch (error) {
    console.error('Error getting user number format:', error);
    return 'default';
  }
};

/**
 * Lấy định dạng số chung của nhóm
 */
const getGroupNumberFormat = async (chatId) => {
  try {
    const Group = require('../models/Group');
    const group = await Group.findOne({ chatId: chatId.toString() });
    
    return group ? group.numberFormat : 'default';
  } catch (error) {
    console.error('Error getting group number format:', error);
    return 'default';
  }
};

/**
 * Tạo tin nhắn telegram không sử dụng markdown
 * @param {Object} jsonData - Dữ liệu cần format
 * @param {String} numberFormat - Định dạng số ('default' hoặc 'formatted')
 * @returns {String} - Chuỗi đã định dạng
 */
const formatTelegramMessage = (jsonData, numberFormat = 'default') => {
  let output = '';
  
  // Date header - using US format (MM/DD/YYYY)
  const currentDate = new Date();
  const formattedDate = formatDateUS(currentDate);
  output += `*${formattedDate}:*\n`;
  
  // Deposits section
  if (jsonData.depositData && jsonData.depositData.entries && jsonData.depositData.entries.length > 0) {
    const depositCount = jsonData.depositData.totalCount || jsonData.depositData.entries.length;
    output += `*已入账* (${depositCount}笔):\n`;
    
    // Format giao dịch với ID và link
    jsonData.depositData.entries.forEach((entry) => {
      // Sử dụng ID từ entry thay vì tạo ID mới
      const id = entry.id || (entry.index + 1);
      if (entry.messageId && entry.chatLink) {
        // Tạo link đến tin nhắn gốc với ID là phần clickable
        output += `${entry.details} (id[${id}](${entry.chatLink}))\n`;
      }
    });
    output += '\n';
  } else {
    output += "*已入账*(0笔):\n\n";
  }
  
  // Payments section
  if (jsonData.paymentData && jsonData.paymentData.entries && jsonData.paymentData.entries.length > 0) {
    const paymentCount = jsonData.paymentData.totalCount || jsonData.paymentData.entries.length;
    output += `*已下发* (${paymentCount}笔):\n`;
    
    // Format giao dịch với ID và link
    jsonData.paymentData.entries.forEach((entry) => {
      // Dùng ký hiệu ! trước ID của payment
      // Sử dụng ID từ entry thay vì tạo ID mới
      const id = `!${entry.id || (entry.index + 1)}`;
      if (entry.messageId && entry.chatLink) {
        // Tạo link đến tin nhắn gốc với ID là phần clickable
        output += `${entry.details} ([${id}](${entry.chatLink}))\n`;
      }
    });
    output += '\n';
  } else {
    output += "*已下发*(0笔):\n\n";
  }
  output += `总入款💰: ${formatSmart(parseFloat(jsonData.totalAmount) || 0, numberFormat)}\n`;
  // Rate information
  const rateInfo = `费率： ${jsonData.rate}\n汇率： ${jsonData.exchangeRate}\n`;
 
  // Thêm ví dụ nếu có
  let rateInfoWithExample = rateInfo;
  if (jsonData.example) {
    rateInfoWithExample += `\n例如: 100000 = ${formatSmart(parseFloat(jsonData.example) || 0, numberFormat)} ${jsonData.currencyUnit || 'USDT'}`;
  }
  
  output += `${rateInfoWithExample}\n`;
  
  // Summary section
  output += `应下发 : ${formatSmart(parseFloat(jsonData.totalUSDT) || 0, numberFormat)}  ${jsonData.currencyUnit || 'USDT'}\n`;
  output += `已下发 : ${formatSmart(parseFloat(jsonData.paidUSDT) || 0, numberFormat)}  ${jsonData.currencyUnit || 'USDT'}\n`;
  output += `未下发 : ${formatSmart(parseFloat(jsonData.remainingUSDT) || 0, numberFormat)}  ${jsonData.currencyUnit || 'USDT'}`;
  
  // Cards section (if present)
  if (jsonData.cards && jsonData.cards.length > 0) {
    output += `\n卡额度 💳:\n${jsonData.cards.join("\n")}`;
  }
  
  return output;
};

module.exports = {
  formatSmart,
  formatNumberWithCommas,
  formatRateValue,
  isMathExpression,
  isSingleNumber,
  isTrc20Address,
  formatTelegramMessage,
  formatDateUS,
  formatTimeString,
  getUserNumberFormat,
  getGroupNumberFormat
}; 