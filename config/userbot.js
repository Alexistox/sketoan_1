const { TelegramApi } = require('telegram');
const { StringSession } = require('telegram/sessions');
const input = require('input');

class UserbotConfig {
  constructor() {
    this.apiId = parseInt(process.env.TELEGRAM_API_ID);
    this.apiHash = process.env.TELEGRAM_API_HASH;
    this.phoneNumber = process.env.TELEGRAM_PHONE_NUMBER;
    this.sessionString = process.env.TELEGRAM_SESSION || '';
    this.session = new StringSession(this.sessionString);
    this.client = null;
  }

  async initializeClient() {
    this.client = new TelegramApi(this.session, this.apiId, this.apiHash, {
      connectionRetries: 5,
    });

    await this.client.start({
      phoneNumber: async () => this.phoneNumber,
      password: async () => await input.text('Nhập mật khẩu 2FA (nếu có): '),
      phoneCode: async () => await input.text('Nhập mã xác thực từ Telegram: '),
      onError: (err) => console.log('Lỗi xác thực:', err),
    });

    console.log('Userbot đã kết nối thành công!');
    
    // Lưu session string để sử dụng lần sau
    if (!this.sessionString) {
      console.log('Session string mới:');
      console.log(this.client.session.save());
      console.log('Hãy thêm session string này vào biến môi trường TELEGRAM_SESSION');
    }

    return this.client;
  }

  getClient() {
    return this.client;
  }
}

module.exports = UserbotConfig; 