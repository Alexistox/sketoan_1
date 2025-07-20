const { Api } = require('telegram/tl');

class UserbotWrapper {
  constructor(client) {
    this.client = client;
  }

  async sendMessage(chatId, text, options = {}) {
    try {
      const message = await this.client.sendMessage(chatId, {
        message: text,
        parseMode: options.parse_mode === 'HTML' ? 'html' : 'markdown',
        replyTo: options.reply_to_message_id,
        buttons: options.reply_markup ? this.convertInlineKeyboard(options.reply_markup) : undefined,
      });
      return message;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  async sendPhoto(chatId, photo, options = {}) {
    try {
      let file;
      if (typeof photo === 'string' && photo.startsWith('http')) {
        // URL
        file = photo;
      } else if (typeof photo === 'string') {
        // File path
        file = photo;
      } else {
        // Buffer or other formats
        file = photo;
      }

      const message = await this.client.sendFile(chatId, {
        file: file,
        caption: options.caption || '',
        parseMode: options.parse_mode === 'HTML' ? 'html' : 'markdown',
        replyTo: options.reply_to_message_id,
        buttons: options.reply_markup ? this.convertInlineKeyboard(options.reply_markup) : undefined,
      });
      return message;
    } catch (error) {
      console.error('Error sending photo:', error);
      throw error;
    }
  }

  async editMessageText(text, options = {}) {
    try {
      const { chat_id, message_id } = options;
      await this.client.editMessage(chat_id, {
        message: message_id,
        text: text,
        parseMode: options.parse_mode === 'HTML' ? 'html' : 'markdown',
        buttons: options.reply_markup ? this.convertInlineKeyboard(options.reply_markup) : undefined,
      });
    } catch (error) {
      console.error('Error editing message:', error);
      throw error;
    }
  }

  async deleteMessage(chatId, messageId) {
    try {
      await this.client.deleteMessages(chatId, [messageId], {
        revoke: true,
      });
    } catch (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
  }

  async answerCallbackQuery(callbackQueryId, options = {}) {
    try {
      // Gramjs không có answerCallbackQuery trực tiếp
      // Có thể gửi tin nhắn thông báo thay thế
      if (options.text) {
        console.log('Callback answer:', options.text);
      }
    } catch (error) {
      console.error('Error answering callback query:', error);
      throw error;
    }
  }

  async getFileLink(fileId) {
    try {
      // Với userbot, có thể download file trực tiếp
      return fileId; // Tạm thời return file ID
    } catch (error) {
      console.error('Error getting file link:', error);
      throw error;
    }
  }

  convertInlineKeyboard(markup) {
    if (!markup || !markup.inline_keyboard) return undefined;
    
    const buttons = markup.inline_keyboard.map(row => 
      row.map(button => {
        if (button.callback_data) {
          return this.client.buildReplyMarkup([
            [{ text: button.text, data: button.callback_data }]
          ]);
        } else if (button.url) {
          return { text: button.text, url: button.url };
        }
        return { text: button.text };
      })
    );
    
    return buttons;
  }

  // Thêm các methods khác khi cần thiết
  on(event, handler) {
    // Userbot sử dụng event handler khác, chỉ log để debug
    console.log(`Event listener registered for: ${event}`);
  }
}

module.exports = UserbotWrapper; 