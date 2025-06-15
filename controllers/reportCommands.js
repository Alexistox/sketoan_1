const Group = require('../models/Group');
const { isUserOperator } = require('../utils/permissions');

/**
 * Xử lý lệnh /report1 - tạo link báo cáo giao dịch trên web
 */
const handleReport1Command = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Kiểm tra quyền - chỉ operator trở lên mới được sử dụng
    if (!(await isUserOperator(userId))) {
      bot.sendMessage(chatId, "⛔ 只有操作员及以上权限才能使用此命令！");
      return;
    }
    
    // Kiểm tra xem nhóm có tồn tại không
    const group = await Group.findOne({ chatId: chatId.toString() });
    if (!group) {
      bot.sendMessage(chatId, "❌ 该群组还没有任何交易数据。请先设置汇率费率。");
      return;
    }
    
    // Tạo token bảo mật cho link
    const token = require('crypto')
      .createHash('md5')
      .update(`${chatId}_${process.env.TELEGRAM_BOT_TOKEN}`)
      .digest('hex')
      .substring(0, 16);
    
    // Tạo URL báo cáo
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const reportUrl = `${baseUrl}/report/${chatId}/${token}`;
    
    console.log('Generated report URL:', reportUrl);
    
    // Kiểm tra nếu URL là localhost thì cảnh báo
    if (baseUrl.includes('localhost')) {
      bot.sendMessage(chatId, "⚠️ 注意：当前使用localhost地址，外部无法访问。请使用ngrok或设置BASE_URL环境变量。");
      return;
    }
    
    // Thông báo cho người dùng với HTML link và inline keyboard
    const message = `📊 <b>交易报告已生成</b>

ℹ️ <b>说明：</b>
• 该链接包含群组的所有交易明细
• 包括入款、下发、卡片等信息汇总  
• 链接仅适用于本群组，具有安全验证
• 可以在手机或电脑浏览器中打开查看

⏰ 报告生成时间：${new Date().toLocaleString('zh-CN')}

🔗 直接链接: <code>${reportUrl}</code>`;
    
    // Tạo inline keyboard với URL button để mở browser
    const keyboard = {
      inline_keyboard: [[
        {
          text: '🔗 打开交易报告',
          url: reportUrl
        }
      ]]
    };
    
    // Gửi tin nhắn với inline keyboard
    bot.sendMessage(chatId, message, { 
      parse_mode: 'HTML',
      reply_markup: keyboard,
      disable_web_page_preview: true
    });
    
  } catch (error) {
    console.error('Error in handleReport1Command:', error);
    bot.sendMessage(msg.chat.id, "处理 /report1 命令时出错，请重试。");
  }
};

module.exports = {
  handleReport1Command
}; 