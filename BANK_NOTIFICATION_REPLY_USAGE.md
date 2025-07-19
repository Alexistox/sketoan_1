# Tính năng Reply "1" vào Thông báo Ngân hàng

## Mô tả
Tính năng này cho phép người dùng reply "1" vào tin nhắn thông báo ngân hàng để tự động trích xuất số tiền và thực hiện lệnh `+` (thêm tiền - deposit).

## Cách sử dụng

### Bước 1: Chuẩn bị
1. Đảm bảo có quyền **Operator** trong nhóm
2. Có tin nhắn thông báo ngân hàng (được gửi từ ngân hàng hoặc copy/paste)

### Bước 2: Thực hiện
1. **Reply tin nhắn thông báo ngân hàng** với nội dung **"1"**
2. Bot sẽ:
   - Kiểm tra xem tin nhắn có phải là thông báo ngân hàng không
   - Trích xuất số tiền từ thông báo
   - Tự động thực hiện lệnh `+` với số tiền đó

## Ví dụ thực tế

### ✅ Ví dụ thành công:
```
User A: - Tiền vào: +2,000,000 đ
        - Tài khoản: 20918031 tại ACB
        - Lúc: 2025-01-13 09:03:09
        - Nội dung CK: NGUYEN THI LAN chuyen tien GD 694612-071325 09:03:09

User B: 1 (reply tin nhắn của User A)

Bot: ⏳ 正在识别银行通知中的金额…
     → Tự động thực hiện +2000000
     → Tính toán USDT tương ứng dựa trên tỷ giá
     → Cập nhật số dư tài khoản
```

### ❌ Ví dụ thất bại:
```
User A: "Hôm nay thời tiết đẹp"
User B: 1 (reply tin nhắn của User A)
Bot: ❌ 这不是银行通知消息。只能回复银行通知消息使用此功能。
```

## Các định dạng thông báo ngân hàng được hỗ trợ

### 🏦 Thông báo tiếng Việt:
- "Tiền vào: +1,000,000 đ"
- "Chuyển khoản từ tài khoản 123456789"
- "Số dư tài khoản: 5,000,000 VND"
- "Giao dịch chuyển tiền thành công"
- "Nạp tiền vào tài khoản ACB"

### 🏦 Thông báo tiếng Anh:
- "Account credited with $500"
- "Transfer received from account 123456789"
- "Available balance: $2,500.00"
- "Transaction successful: Payment of $750"
- "Deposit into account completed"

### 🏦 Thông báo tiếng Trung:
- "入账：1000元"
- "转账成功：500 RMB"
- "余额：2500元"
- "收款：1500人民币"
- "账户充值完成"

## Tên ngân hàng được nhận diện

### Việt Nam:
- ACB, Vietcombank, Techcombank, BIDV, VietinBank
- Agribank, Sacombank, MB Bank, VPBank, TPBank
- HDBank, SHB

### Quốc tế:
- Các từ khóa: "bank", "banking", "ATM", "internet banking", "mobile banking"

## Patterns được nhận diện

### 💰 Số tiền:
- `1,000,000 đ`, `2,000 VND`, `500 USD`, `100 USDT`
- `$500`, `đ1,000,000`, `€100`, `¥1000`

### ⏰ Thời gian:
- `2025-01-13 09:03:09`
- `09:03:09`
- `13/01/2025`

### 🏦 Số tài khoản:
- Các số có ít nhất 8 chữ số: `20918031`, `123456789`

## Điều kiện nhận diện thông báo ngân hàng

Tin nhắn được coi là **thông báo ngân hàng** nếu:

1. **Có từ khóa ngân hàng** VÀ (**có pattern tiền** HOẶC **có số tài khoản**)
2. **Có ít nhất 2 trong 3 patterns**: tiền, thời gian, tài khoản

## Quyền hạn
- Chỉ người dùng có quyền **Operator** mới có thể sử dụng tính năng này
- Nếu không có quyền, bot sẽ thông báo: "⛔ 您无权使用此命令！需要操作员权限。"

## Thông báo lỗi

### ❌ Không phải thông báo ngân hàng:
```
❌ 这不是银行通知消息。只能回复银行通知消息使用此功能。
```

### ❌ Không trích xuất được số tiền:
```
❌ 无法从银行通知中识别出金额信息。
```

### ❌ Không có quyền:
```
⛔ 您无权使用此命令！需要操作员权限。
```

### ❌ Tin nhắn không phải text:
```
❌ 请回复一条文字消息使用此功能。
```

## So sánh với các lệnh khác

| Tính năng | Cách sử dụng | Mục đích | Đặc điểm |
|-----------|--------------|----------|----------|
| **Reply "1"** | Reply "1" vào thông báo ngân hàng | Tự động + tiền | Chỉ nhận diện thông báo ngân hàng |
| **+ thủ công** | Gõ "+số_tiền" | Thêm tiền thủ công | Kiểm soát hoàn toàn |

## Lưu ý quan trọng

1. **Độ chính xác**: Tính năng sử dụng regex patterns để nhận diện, độ chính xác cao với thông báo ngân hàng chuẩn
2. **Xử lý lỗi**: Nếu không nhận diện được, hãy sử dụng lệnh `+` thủ công
3. **Ghi log**: Mọi giao dịch đều được ghi log và có thể hoàn tác bằng lệnh `/skip`
4. **Bảo mật**: Chỉ Operator mới có thể sử dụng để đảm bảo an toàn

## Ví dụ JSON Response
Sau khi xử lý thành công, bot sẽ trả về thông tin chi tiết như:
```json
{
  "date": "01/13/2025",
  "totalAmount": "7,000,000",
  "totalUSDT": "437.50",
  "paidUSDT": "100.00",
  "remainingUSDT": "337.50",
  "rate": "2%",
  "exchangeRate": "16000"
}
```

## Troubleshooting

### Q: Tại sao bot không nhận diện thông báo ngân hàng?
A: Kiểm tra xem thông báo có chứa:
- Từ khóa ngân hàng (tiền vào, tài khoản, chuyển khoản, v.v.)
- Pattern số tiền (1,000,000 đ, $500, v.v.)
- Số tài khoản (ít nhất 8 chữ số)

### Q: Tại sao số tiền trích xuất không chính xác?
A: Sử dụng lệnh `+` thủ công để kiểm soát chính xác hơn

### Q: Có thể sử dụng với thông báo ngân hàng nước ngoài?
A: Có, hỗ trợ tiếng Anh và tiếng Trung với các từ khóa tương ứng 