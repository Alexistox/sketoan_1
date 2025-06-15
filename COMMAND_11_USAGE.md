# Lệnh /11 - Trích xuất số tiền từ ảnh và text

## Mô tả
Lệnh `/11` cho phép trích xuất số tiền từ **ảnh** (sử dụng OpenAI GPT-4o) và **text** (sử dụng regex patterns) để tự động gọi lệnh `+` với số tiền đó.

## Cách sử dụng

1. **Reply một tin nhắn có ảnh hoặc text** với lệnh `/11`
2. Bot sẽ:
   - Trích xuất ảnh hoặc text từ tin nhắn được reply
   - Sử dụng OpenAI GPT-4o (cho ảnh) hoặc regex patterns (cho text) để tìm số tiền
   - Tự động gọi lệnh `+` với số tiền tìm được

## Ví dụ

### 📸 Từ ảnh:
```
User A: [gửi ảnh chuyển khoản 1,000,000 VND]
User B: /11 (reply ảnh của User A)
Bot: ⏳ 正在识别图片中的金额…
     [Tự động thực hiện lệnh +1000000]
```

### 📝 Từ text:
```
User A: "Chuyển khoản 1,500,000 VND vào tài khoản"
User B: /11 (reply text của User A)  
Bot: ⏳ 正在识别文字中的金额…
     [Tự động thực hiện lệnh +1500000]
```

## Quyền hạn
- Chỉ người dùng có quyền **Operator** mới có thể sử dụng lệnh này
- Nếu không có quyền, bot sẽ thông báo: "⛔ 您无权使用此命令！需要操作员权限。"

## So sánh với lệnh /12
- **Lệnh /11**: Trích xuất số tiền và gọi lệnh `+` (thêm tiền - deposit)
- **Lệnh /12**: Trích xuất số tiền và gọi lệnh `%` (thanh toán - payment)

## Định dạng text được hỗ trợ

### Độ ưu tiên cao:
- `1000 USDT`, `500 USD`, `1,000,000 VND`
- `$500`, `đ1,000,000`, `€100`
- `Số tiền: 1500`, `Amount: 2,500.50`

### Độ ưu tiên thấp:
- `1,000,000` (số lớn có dấu phân cách)
- `500000` (số đơn giản ít nhất 3 chữ số)

## Lưu ý
- Lệnh hoạt động khi reply **cả ảnh và text**
- Nếu không thể trích xuất số tiền, bot sẽ thông báo lỗi tương ứng
- Số tiền được trích xuất sẽ tự động được sử dụng với lệnh `+`
- Lệnh `+` sẽ tự động tính toán USDT dựa trên tỷ giá và phí

## Thông báo xử lý
- **Ảnh**: "⏳ 正在识别图片中的金额…" 
- **Text**: "⏳ 正在识别文字中的金额…"
- **Thành công**: Tin nhắn xử lý sẽ bị xóa và kết quả lệnh `+` sẽ được hiển thị
- **Thất bại**: 
  - "❌ 无法从该图片识别出金额信息。"
  - "❌ 无法从该文字识别出金额信息。"

## Cấu hình cần thiết
- **Cho ảnh**: Cần cấu hình `OPENAI_API_KEY` trong file `.env`
- **Cho text**: Không cần API bên ngoài (xử lý local)
- Bot cần quyền truy cập OpenAI API để sử dụng GPT-4o (chỉ cho ảnh)
- Cần thiết lập tỷ giá và phí trước khi sử dụng 