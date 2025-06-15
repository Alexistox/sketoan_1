/**
 * Trích xuất số tiền từ text
 * @param {string} text - Text cần phân tích
 * @returns {Number|null} - Số tiền trích xuất được hoặc null nếu thất bại
 */
const extractMoneyFromText = (text) => {
  if (!text || typeof text !== 'string') {
    return null;
  }

  // Loại bỏ các ký tự không cần thiết và chuẩn hóa text
  const cleanText = text.trim();
  
  // Các pattern để tìm số tiền (hỗ trợ đa ngôn ngữ)
  const patterns = [
    // Số có đơn vị tiền tệ (mở rộng nhiều ngôn ngữ)
    /(\d{1,3}(?:[,.]?\d{3})*(?:\.\d{1,2})?)\s*(?:usdt|usd|vnd|vnđ|đ|dollars?|dollar|bucks|us\$|us dollars|元|人民币|rmb|원|won|円|yen|บาท|baht|aud|au\$|krw|jpy|thb)/gi,
    
    // Số có ký hiệu tiền tệ phía trước (mở rộng)
    /[đ$¥€£￥₩฿]\s*(\d{1,3}(?:[,.]?\d{3})*(?:\.\d{1,2})?)/gi,
    
    // Số có từ khóa liên quan đến tiền (đa ngôn ngữ: Việt, Anh, Trung, Thái, Hàn, Nhật)
    /(?:số tiền|amount|money|tiền|total|tổng|transfer|chuyển|payment|thanh toán|收款|余额|balance|金额|钱|转账|付款|总计|金钱|支付|汇款|เงิน|โอน|จ่าย|รับ|ยอดเงิน|ชำระ|돈|송금|지불|수령|잔액|금액|お金|送金|支払い|受取|残高)\s*[:\-：]?\s*(\d+(?:[,.]?\d{3})*(?:\.\d{1,2})?)/gi,
    
    // Số lớn có dấu phân cách (ví dụ: 1,000,000 hoặc 1.000.000)
    /(\d{1,3}(?:[,]\d{3}){2,}|\d{1,3}(?:[.]\d{3}){2,})/g,
    
    // Các số đơn giản lớn (ít nhất 3 chữ số)
    /\b(\d{3,}(?:\.\d{1,2})?)\b/g
  ];

  const foundNumbers = [];

  // Tìm tất cả các số phù hợp với patterns
  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    const matches = cleanText.match(pattern);
    
    if (matches) {
      for (const match of matches) {
        // Trích xuất số từ match
        const numberMatch = match.match(/(\d+(?:[,.]?\d{3})*(?:\.\d{1,2})?)/);
        if (numberMatch) {
          const numberStr = numberMatch[1];
          
          // Chuẩn hóa số (loại bỏ dấu phẩy, xử lý dấu chấm)
          let cleanNumber = numberStr.replace(/,/g, '');
          
          // Xử lý trường hợp dấu chấm là phân cách hàng nghìn (châu Âu)
          // Nếu có nhiều hơn 2 chữ số sau dấu chấm cuối cùng thì đó là phân cách hàng nghìn
          const dotParts = cleanNumber.split('.');
          if (dotParts.length > 1 && dotParts[dotParts.length - 1].length > 2) {
            cleanNumber = cleanNumber.replace(/\./g, '');
          }
          
          const num = parseFloat(cleanNumber);
          if (!isNaN(num) && num > 0) {
            foundNumbers.push({
              value: num,
              original: numberStr,
              priority: i // Pattern có index thấp hơn có độ ưu tiên cao hơn
            });
          }
        }
      }
    }
  }

  if (foundNumbers.length === 0) {
    return null;
  }

  // Sắp xếp theo độ ưu tiên (pattern index thấp hơn có độ ưu tiên cao hơn)
  // Sau đó theo giá trị lớn hơn
  foundNumbers.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return b.value - a.value;
  });

  return foundNumbers[0].value;
};

/**
 * Kiểm tra xem text có chứa số tiền không
 * @param {string} text - Text cần kiểm tra
 * @returns {boolean} - True nếu có số tiền
 */
const hasMoneyInText = (text) => {
  return extractMoneyFromText(text) !== null;
};

module.exports = {
  extractMoneyFromText,
  hasMoneyInText
}; 