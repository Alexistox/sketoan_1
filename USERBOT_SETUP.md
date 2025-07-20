# Hướng dẫn chuyển đổi sang Userbot

Bot của bạn đã được chuyển đổi thành **Userbot** - hoạt động như một user thật thay vì bot.

## Ưu điểm của Userbot:
- Có thể đọc tất cả tin nhắn trong group (không cần được mention)
- Truy cập được nhiều tính năng hơn của Telegram
- Có thể tham gia group/channel như user bình thường
- Không bị giới hạn như Bot API

## Yêu cầu cấu hình:

### 1. Tạo Telegram Application
1. Truy cập https://my.telegram.org/apps
2. Đăng nhập bằng số điện thoại Telegram của bạn
3. Tạo application mới và lưu lại:
   - `Api id` 
   - `Api hash`

### 2. Cập nhật file .env

Thay thế các biến môi trường cũ bằng:

```env
# Database Configuration
MONGODB_URI=mongodb://localhost:27017/telegram-bot

# Telegram Userbot Configuration (thay thế TELEGRAM_BOT_TOKEN)
TELEGRAM_API_ID=your_api_id_here
TELEGRAM_API_HASH=your_api_hash_here
TELEGRAM_PHONE_NUMBER=+84xxxxxxxxx

# Session string (sẽ được tạo tự động lần đầu chạy)
TELEGRAM_SESSION=

# Server Configuration  
PORT=3000

# OpenAI Configuration (nếu có)
OPENAI_API_KEY=your_openai_api_key_here
```

### 3. Cài đặt dependencies mới

```bash
npm install
```

### 4. Chạy userbot lần đầu

```bash
npm start
```

Lần đầu chạy, bạn sẽ được yêu cầu:
- Nhập mã xác thực từ Telegram
- Nhập mật khẩu 2FA (nếu có)

Sau khi xác thực thành công, session string sẽ được tạo và in ra console. 
**Hãy copy session string này và thêm vào biến TELEGRAM_SESSION trong file .env để không phải xác thực lại.**

## Lưu ý quan trọng:

⚠️ **Bảo mật**: 
- Không chia sẻ API ID, API Hash và Session String với ai
- Session String cho phép truy cập hoàn toàn vào tài khoản Telegram

⚠️ **Giới hạn**:
- Một số tính năng callback query có thể hoạt động khác so với bot
- Userbot không thể được add vào group như bot, phải join như user

⚠️ **Tuân thủ**:
- Tuân thủ Terms of Service của Telegram
- Không spam hoặc vi phạm quy tắc cộng đồng

## Khắc phục sự cố:

### Lỗi xác thực:
```bash
# Xóa session và xác thực lại
# Xóa giá trị TELEGRAM_SESSION trong .env và chạy lại
```

### Lỗi kết nối:
```bash
# Kiểm tra network và proxy settings
# Đảm bảo không bị chặn truy cập Telegram
``` 