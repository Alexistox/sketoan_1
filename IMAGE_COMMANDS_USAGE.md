# Lệnh Trích Xuất Số Tiền (/11 và /12)

## Tổng quan
Bot hỗ trợ hai lệnh mạnh mẽ để trích xuất số tiền từ **ảnh** và **text**:
- **`/11`**: Trích xuất số tiền và thực hiện lệnh `+` (thêm tiền - deposit)
- **`/12`**: Trích xuất số tiền và thực hiện lệnh `%` (thanh toán - payment)

## So sánh hai lệnh

| Lệnh | Chức năng | Lệnh được gọi | Mục đích | Hỗ trợ |
|------|-----------|---------------|----------|---------|
| `/11` | Trích xuất số tiền → `+` | Lệnh deposit (`+`) | Thêm tiền vào tài khoản | 📸 Ảnh + 📝 Text |
| `/12` | Trích xuất số tiền → `%` | Lệnh payment (`%`) | Thanh toán/chi tiền | 📸 Ảnh + 📝 Text |

## Cách sử dụng (chung cho cả hai lệnh)

### Bước 1: Chuẩn bị
1. Đảm bảo có quyền **Operator** trong nhóm
2. Chuẩn bị ảnh hoặc text chứa số tiền cần trích xuất

### Bước 2: Thực hiện
1. Reply tin nhắn có **ảnh** hoặc **text** với lệnh `/11` hoặc `/12`
2. Bot sẽ hiển thị thông báo xử lý tương ứng
3. Chờ bot xử lý và trả về kết quả

## Ví dụ thực tế

### Ví dụ với lệnh /11 (Deposit)

#### 📸 Từ ảnh:
```
User A: [gửi ảnh chuyển khoản 1,000,000 VND]
User B: /11 (reply ảnh)
Bot: ⏳ 正在识别图片中的金额…
     → Tự động thực hiện +1000000
     → Tính toán USDT tương ứng dựa trên tỷ giá
     → Cập nhật số dư tài khoản
```

#### 📝 Từ text:
```
User A: "Chuyển khoản 1,500,000 VND vào tài khoản"
User B: /11 (reply text)
Bot: ⏳ 正在识别文字中的金额…
     → Tự động thực hiện +1500000
     → Tính toán USDT và cập nhật số dư
```

### Ví dụ với lệnh /12 (Payment)

#### 📸 Từ ảnh:
```
User A: [gửi ảnh thanh toán 500 USDT]
User B: /12 (reply ảnh)
Bot: ⏳ 正在识别图片中的金额…
     → Tự động thực hiện %500
     → Trừ tiền từ số dư USDT
```

#### 📝 Từ text:
```
User A: "Payment of 750 USDT completed"
User B: /12 (reply text)
Bot: ⏳ 正在识别文字中的金额…
     → Tự động thực hiện %750
     → Cập nhật báo cáo thanh toán
```

## Các định dạng text được hỗ trợ

Bot có thể trích xuất số tiền từ các định dạng text sau (hỗ trợ **6 ngôn ngữ**: Tiếng Việt, Tiếng Anh, Tiếng Trung, Tiếng Thái, Tiếng Hàn, Tiếng Nhật):

### 1. Số có đơn vị tiền tệ
- **Quốc tế**: `1000 USDT`, `500 USD`, `750 dollars`, `1200 bucks`, `800 US dollars`
- **Việt Nam**: `1,000,000 VND`, `1500 vnđ`, `750 đ`
- **Trung Quốc**: `1000元`, `500人民币`, `1500 RMB`
- **Thái Lan**: `1500 บาท`, `2000 THB`, `750 baht`
- **Hàn Quốc**: `1500원`, `2000 KRW`, `750 won`
- **Nhật Bản**: `1500円`, `2000 JPY`, `750 yen`
- **Australia**: `800 AUD`, `1200 AU$`

### 2. Số có ký hiệu tiền tệ
- **Quốc tế**: `$500`, `€100`, `£250`
- **Việt Nam**: `đ1,000,000`
- **Trung Quốc**: `￥1500`, `¥2500`
- **Thái Lan**: `฿1500`
- **Hàn Quốc**: `₩2500`
- **Nhật Bản**: `¥3000`

### 3. Số có từ khóa tiền (đa ngôn ngữ)
- **Tiếng Việt**: `Số tiền: 1500`, `Chuyển 500000`, `Thanh toán 1000000`, `Total: 2500`
- **Tiếng Anh**: `Amount: 2,500.50`, `Money: 1000`, `Payment 750`, `Transfer 1200`, `Balance: 800`
- **Tiếng Trung**: `金额：2500`, `转账 3000`, `付款：1,000,000`, `收款1500元`, `余额 2000 USDT`, `总计：5000元`, `支付 1200元`, `汇款：800美元`
- **Tiếng Thái**: `เงิน: 2000`, `โอน 1500 บาท`, `จ่าย 500`, `รับ: 1,200`, `ยอดเงิน 750`, `ชำระ: 3000`
- **Tiếng Hàn**: `돈: 2000`, `송금 1500원`, `지불 500`, `수령: 1,200`, `잔액 750`, `금액: 3000원`
- **Tiếng Nhật**: `お金: 2000`, `送金 1500円`, `支払い 500`, `受取: 1,200`, `残高 750`, `金額: 3000円`

### 4. Số lớn có dấu phân cách
- `1,000,000` (định dạng Mỹ)
- `1.000.000` (định dạng Châu Âu)
- `2,500.50` (có phần thập phân)

## Yêu cầu quyền hạn
- **Chỉ Operator** mới có thể sử dụng
- Nếu không đủ quyền: "⛔ 您无权使用此命令！需要操作员权限。"

## Các trường hợp lỗi

### 1. Không reply ảnh hoặc text
```
❌ 请回复一条含有图片或文字的消息使用 /11 命令。
❌ 请回复一条含有图片或文字的消息使用 /12 命令。
```

### 2. Không thể tải ảnh
```
❌ 无法获取图片文件信息.
```

### 3. Không tìm thấy số tiền
```
❌ 无法从该图片识别出金额信息。
❌ 无法从该文字识别出金额信息。
```

### 4. Lỗi xử lý
```
处理 /11 命令时出错，请重试。
处理 /12 命令时出错，请重试。
```

## Các loại nguồn được hỗ trợ

### 📸 Từ ảnh (sử dụng OpenAI GPT-4o):
- Ảnh chụp màn hình chuyển khoản
- Ảnh thẻ tín dụng/ghi nợ
- Ảnh hóa đơn, biên lai
- Ảnh hiển thị số tiền với các đơn vị khác nhau

### 📝 Từ text (sử dụng Regex patterns):
- Tin nhắn chuyển khoản
- Thông báo thanh toán
- Báo cáo số dư
- Bất kỳ text nào chứa số tiền

## Thông báo xử lý

### Ảnh:
- "⏳ 正在识别图片中的金额…"

### Text:
- "⏳ 正在识别文字中的金额…"

## Cấu hình cần thiết

### Environment Variables
```env
OPENAI_API_KEY=your_openai_api_key_here  # Chỉ cần cho xử lý ảnh
TELEGRAM_BOT_TOKEN=your_bot_token_here
```

### Điều kiện tiên quyết
1. **Cho ảnh**: Bot cần quyền truy cập OpenAI API
2. **Cho text**: Không cần API bên ngoài (xử lý local)
3. Đã thiết lập tỷ giá và phí trong nhóm
4. Người dùng có quyền Operator

## Lưu ý quan trọng
- ⚡ **Ảnh**: Bot sử dụng AI để nhận diện, độ chính xác phụ thuộc vào chất lượng ảnh
- 📝 **Text**: Bot sử dụng regex patterns, nhanh và chính xác với các định dạng phổ biến
- 🔄 Nếu kết quả không chính xác, hãy thử lại với ảnh rõ nét hơn hoặc text rõ ràng hơn
- 💾 Mọi giao dịch đều được ghi log và có thể hoàn tác bằng lệnh `/skip`
- 🎯 Kết quả cuối cùng tương đương với việc gõ lệnh `+số_tiền` hoặc `%số_tiền` thủ công

## Ví dụ JSON Response
Sau khi xử lý thành công, bot sẽ trả về thông tin chi tiết như:
```json
{
  "date": "12/15/2023",
  "totalAmount": "5,000,000",
  "totalUSDT": "312.50",
  "paidUSDT": "100.00",
  "remainingUSDT": "212.50",
  "rate": "2%",
  "exchangeRate": "16000"
}
```

## Độ ưu tiên trích xuất (cho text)
1. **Cao nhất**: Số có đơn vị tiền tệ đa ngôn ngữ
   - USDT, USD, VND, THB, KRW, JPY, AUD
   - 元, 人民币, RMB, บาท, 원, 円
   - dollars, bucks, won, yen, baht
2. **Cao**: Số có ký hiệu tiền tệ ($, đ, €, ¥, ￥, ₩, ฿)
3. **Trung bình**: Số có từ khóa tiền đa ngôn ngữ
   - Việt: số tiền, chuyển, thanh toán
   - Anh: amount, money, payment, transfer, balance
   - Trung: 金额, 转账, 付款, 收款, 余额, 支付
   - Thái: เงิน, โอน, จ่าย, รับ, ยอดเงิน, ชำระ
   - Hàn: 돈, 송금, 지불, 수령, 잔액, 금액
   - Nhật: お金, 送金, 支払い, 受取, 残高, 金額
4. **Thấp**: Số lớn có dấu phân cách (1,000,000)
5. **Thấp nhất**: Số đơn giản (ít nhất 3 chữ số) 