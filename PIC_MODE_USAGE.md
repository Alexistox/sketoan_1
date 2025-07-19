# Chế Độ Pic Mode (/pic)

## Tổng quan
Tính năng **Pic Mode** cho phép trích xuất số tiền từ ảnh hoặc text bằng cách reply đơn giản với số "1", "2", hoặc "3".

## Cách sử dụng

### 🔥 Bật/Tắt Pic Mode

```bash
/pic on   # Bật chế độ pic mode
/pic off  # Tắt chế độ pic mode  
```

### 📋 Khi Pic Mode được bật:

| Reply | Lệnh tương ứng | Mục đích | Công thức |
|-------|----------------|----------|-----------|
| **1** | `+` (Deposit) | Thêm tiền vào tài khoản | `(amount_VND / exchangeRate) * (1 - rate/100)` |
| **2** | `%` (Payment) | Thanh toán/chi tiền | Trực tiếp số USDT |
| **3** | `-` (Withdraw) | Rút tiền | `(amount_VND / withdrawExchangeRate) * (1 + withdrawRate/100)` |

### 🎯 Các bước thực hiện:

1. **Bật pic mode**: `/pic on`
2. **Tìm ảnh/text** có chứa số tiền cần xử lý
3. **Reply ảnh/text** với số tương ứng:
   - Reply **"1"** → Thực hiện lệnh `+` (thêm tiền)
   - Reply **"2"** → Thực hiện lệnh `%` (thanh toán)
   - Reply **"3"** → Thực hiện lệnh `-` (rút tiền)

## 📸 Hỗ trợ định dạng

### ✅ Được hỗ trợ:
- **Ảnh** (JPG, PNG, WebP)
- **Ảnh có caption** (sẽ ưu tiên trích xuất từ caption trước)
- **Text message** chứa số tiền
- **Screenshot** thông báo ngân hàng
- **Bill chuyển tiền**

### 📝 Pattern số tiền được nhận diện:
- `1,000,000 VND` (định dạng Mỹ)
- `1.000.000 VND` (định dạng Châu Âu)
- `1.000.000,50 VND` (Châu Âu với thập phân)
- `1,000,000.25 VND` (Mỹ với thập phân)
- `500.000đ`, `500,000đ`
- `2m5k` (định dạng đặc biệt: 2,005,000)
- `3w4` (định dạng đặc biệt: 34,000)
- `$1,500`, `$1.500`, `$1,500.50`

### 🔢 Định dạng số được hỗ trợ:

| Định dạng | Ý nghĩa | Kết quả |
|-----------|---------|---------|
| `1.000.000` | 1 triệu (Châu Âu) | 1,000,000 |
| `1,000,000` | 1 triệu (Mỹ) | 1,000,000 |
| `1.000.000,50` | 1 triệu rưỡi (Châu Âu) | 1,000,000.5 |
| `1,000,000.25` | 1 triệu 2 lăm (Mỹ) | 1,000,000.25 |
| `2.500.000,75` | 2 triệu 5 rưỡi (Châu Âu) | 2,500,000.75 |
| `3,500,000.99` | 3 triệu 5 (Mỹ) | 3,500,000.99 |

**Logic thông minh:** Nếu có 2 loại dấu phân cách, dấu xuất hiện **sau cùng** được coi là dấu thập phân!

## 🌟 Ví dụ thực tế

### Ví dụ 1: Thêm tiền từ ảnh chuyển khoản
```
[User A gửi ảnh screenshot chuyển khoản 2,000,000 VND]

User B: 1  (reply ảnh)
Bot: ⏳ 正在识别图片中的金额…
Bot: ✅ 已提取金额：2,000,000
     🔄 执行指令：+2,000,000
Bot: ✅ +2000000 VND → 123.45 USDT đã được thêm vào tài khoản
```

### Ví dụ 2: Thanh toán từ text
```
User A: "Chuyển khoản 1,500,000 VND cho khách hàng ABC"

User B: 2  (reply text)
Bot: ⏳ 正在识别文字中的金额…
Bot: ✅ 已提取金额：1,500,000
     🔄 执行指令：%1,500,000
Bot: ✅ %1500000 → Thanh toán 75.5 USDT thành công
```

### Ví dụ 3: Rút tiền từ ảnh có caption
```
[User A gửi ảnh với caption: "Rút tiền 3m2 VND"]

User B: 3  (reply ảnh)
Bot: ⏳ 正在识别图片标题中的金额…
Bot: ✅ 已提取金额：3,200,000
     🔄 执行指令：-3,200,000
Bot: ✅ -3200000 VND → -213.33 USDT đã được rút khỏi tài khoản
```

## ⚡ Tính năng thông minh

### 🚀 Tốc độ xử lý:
1. **Caption text** → Nhanh nhất (< 1s)
2. **Text message** → Nhanh (< 1s) 
3. **Ảnh OCR** → Chậm hơn (3-5s, sử dụng OpenAI GPT-4o)

### 🎯 Độ chính xác:
- **Text/Caption**: 95%+ với định dạng chuẩn
- **Ảnh OCR**: 85%+ với ảnh chất lượng tốt
- **Thông báo ngân hàng**: 98%+ với format chuẩn

### 🔒 Bảo mật:
- Chỉ **Operator** mới có thể sử dụng
- Mỗi giao dịch đều được log chi tiết
- Có thể hoàn tác bằng lệnh `/delete`

## 🚨 Lưu ý quan trọng

### ⚠️ Khi nào sử dụng:
- ✅ Xử lý nhanh nhiều bill/ảnh chuyển khoản
- ✅ Thông báo ngân hàng không chuẩn format
- ✅ Ảnh có chữ viết tay hoặc format đặc biệt

### ❌ Khi nào KHÔNG nên sử dụng:
- ❌ Cần kiểm soát chính xác 100%
- ❌ Ảnh mờ, chữ không rõ
- ❌ Số tiền có nhiều loại tiền tệ khác nhau

### 🔧 Troubleshooting:
```
❌ 无法从该图片识别出金额信息
→ Thử sử dụng lệnh thủ công: +1000000, %500, -2000000

❌ 表达式无效，请重试  
→ Ảnh chứa ký tự đặc biệt, hãy crop lại ảnh

❌ 请回复一条含有图片或文字的消息
→ Phải reply vào tin nhắn có ảnh/text, không gửi riêng lẻ
```

## 📊 So sánh với các tính năng khác

| Tính năng | Cách sử dụng | Tốc độ | Độ chính xác | Use case |
|-----------|--------------|--------|--------------|----------|
| **Pic Mode** | Reply 1/2/3 vào ảnh/text | ⚡⚡⚡ | ⭐⭐⭐⭐ | Xử lý hàng loạt ảnh |
| **Reply "1"** | Reply "1" vào thông báo ngân hàng | ⚡⚡⚡⚡ | ⭐⭐⭐⭐⭐ | Thông báo bank chuẩn |
| **Lệnh thủ công** | Gõ +/-/% | ⚡⚡⚡⚡⚡ | ⭐⭐⭐⭐⭐ | Kiểm soát chính xác |

## 🎉 Kết luận

**Pic Mode** là tính năng mạnh mẽ giúp tự động hóa việc xử lý giao dịch từ ảnh và text, tiết kiệm thời gian đáng kể khi phải xử lý nhiều bill/chuyển khoản cùng lúc.

**💡 Pro tip**: Bật pic mode khi cần xử lý hàng loạt, tắt khi cần độ chính xác tuyệt đối! 