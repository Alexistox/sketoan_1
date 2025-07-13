const Transaction = require('../models/Transaction');
const Group = require('../models/Group');
const crypto = require('crypto');

/**
 * Xử lý lệnh /report1 - tạo và gửi link báo cáo giao dịch
 */
const handleReport1Command = async (bot, msg) => {
  try {
    const chatId = msg.chat.id.toString();
    
    // Kiểm tra quyền Operator
    const group = await Group.findOne({ chatId });
    if (!group) {
      bot.sendMessage(chatId, "❌ 群组未注册。");
      return;
    }

    const userId = msg.from.id.toString();
    if (!group.operators.includes(userId) && group.ownerId !== userId) {
      bot.sendMessage(chatId, "❌ 只有管理员可以使用此命令。");
      return;
    }

    // Tạo token bảo mật cho link (valid trong 24h)
    const timestamp = Date.now();
    const token = crypto.createHash('md5')
      .update(`${chatId}-${timestamp}-${process.env.REPORT_SECRET || 'default-secret'}`)
      .digest('hex');

    // Lưu token vào database hoặc cache (tạm thời lưu vào Group model)
    group.reportToken = token;
    group.reportTokenExpiry = new Date(timestamp + 24 * 60 * 60 * 1000); // 24h
    await group.save();

    // Tạo URL báo cáo
    const getBaseUrl = () => {
      // Ưu tiên BASE_URL từ env
      if (process.env.BASE_URL) {
        return process.env.BASE_URL;
      }
      
      // Nếu có HEROKU_APP_NAME (Heroku deployment)
      if (process.env.HEROKU_APP_NAME) {
        return `https://${process.env.HEROKU_APP_NAME}.herokuapp.com`;
      }
      
      // Fallback cho development
      const port = process.env.PORT || 3000;
      return `http://localhost:${port}`;
    };

    const baseUrl = process.env.BASE_URL || 
                     `https://${process.env.HEROKU_APP_NAME || 'your-app'}.herokuapp.com`;
    const reportUrl = `${baseUrl}/report/${chatId}?token=${token}`;

    // Đếm số giao dịch
    const transactionCount = await Transaction.countDocuments({ chatId });
    
    const message = `📊 **交易报告链接**\n\n` +
                   `🔗 链接: ${reportUrl}\n` +
                   `📝 总交易数: ${transactionCount}\n` +
                   `⏰ 链接有效期: 24小时\n` +
                   `🔒 仅限此群组管理员查看\n\n` +
                   `*点击链接查看完整交易记录*`;

    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });

  } catch (error) {
    console.error('Error in handleReport1Command:', error);
    bot.sendMessage(msg.chat.id, "❌ 生成报告链接时出错，请重试。");
  }
};

module.exports = {
  handleReport1Command
}; 