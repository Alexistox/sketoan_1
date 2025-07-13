# 📊 Lệnh /report1 - Báo cáo giao dịch Web

## Mô tả
Lệnh `/report1` tạo một link bảo mật để xem toàn bộ lịch sử giao dịch của nhóm trên web browser với giao diện đẹp và thống kê chi tiết.

## Quyền hạn
- **Yêu cầu**: Quyền Operator hoặc Owner
- **Hạn chế**: Chỉ có thể sử dụng trong nhóm đã đăng ký

## Cách sử dụng

### Lệnh cơ bản
```
/report1
```

### Kết quả
Bot sẽ tạo và gửi:
- 🔗 **Link báo cáo**: URL an toàn để xem giao dịch
- 📝 **Tổng số giao dịch**: Số lượng giao dịch hiện có
- ⏰ **Thời hạn**: Link có hiệu lực 24 giờ
- 🔒 **Bảo mật**: Chỉ nhóm này có thể truy cập

## Tính năng Web Report

### Thống kê tổng quan
- 📊 Tổng số giao dịch
- 💰 Tổng số tiền gửi (VND)
- 💸 Tổng số tiền rút (VND)
- 🏦 Tổng số thanh toán (USDT)
- 📈 Số lượng từng loại giao dịch

### Bảng giao dịch chi tiết
- **Số thứ tự**: Thứ tự giao dịch
- **Loại giao dịch**: Gửi, rút, thanh toán, v.v.
- **Số tiền**: VND và USDT
- **Người gửi**: Tên người thực hiện giao dịch
- **Thời gian**: Ngày giờ chi tiết
- **Tin nhắn**: Nội dung giao dịch

### Tính năng web
- 📱 **Responsive**: Hoạt động tốt trên mobile và desktop
- 🔍 **Dễ đọc**: Giao diện đẹp, dễ theo dõi
- 📋 **Export**: Có thể copy dữ liệu từ bảng
- 🎨 **Màu sắc**: Phân loại giao dịch theo màu

## Ví dụ sử dụng

### 1. Tạo báo cáo cơ bản
```
/report1
```

**Kết quả:**
```
📊 交易报告链接

🔗 链接: https://yourbot.com/report/12345?token=abc123...
📝 总交易数: 156
⏰ 链接有效期: 24小时
🔒 仅限此群组管理员查看

*点击链接查看完整交易记录*
```

## Bảo mật

### Token bảo mật
- Mỗi link có token riêng biệt
- Token được mã hóa MD5 với timestamp
- Tự động hết hạn sau 24 giờ

### Kiểm soát truy cập
- Chỉ nhóm có quyền truy cập
- Không thể truy cập từ nhóm khác
- Link cũ sẽ vô hiệu khi tạo link mới

## Lưu ý quan trọng

### Môi trường
- Cần có biến môi trường `MONGODB_URI`
- Cần có biến môi trường `BASE_URL` (tùy chọn)
- Cần có biến môi trường `REPORT_SECRET` (tùy chọn)

### Giới hạn
- Mỗi nhóm chỉ có 1 link active
- Link hết hạn sau 24 giờ
- Cần kết nối internet để xem báo cáo

### Hiệu suất
- Báo cáo được tạo realtime từ MongoDB
- Tối ưu cho cả mobile và desktop
- Hỗ trợ nhóm có nhiều giao dịch

## Cấu hình .env

```env
# MongoDB connection
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/dbname

# Web server (tùy chọn)
BASE_URL=https://yourbot.com
PORT=3000

# Security (tùy chọn)
REPORT_SECRET=your-secret-key
```

## Troubleshooting

### Lỗi thường gặp

1. **"群组未注册"**
   - Nhóm chưa được đăng ký trong hệ thống
   - Cần có giao dịch đầu tiên để tạo nhóm

2. **"只有管理员可以使用此命令"**
   - Người dùng không có quyền Operator
   - Cần được thêm vào danh sách operators

3. **"链接已过期"**
   - Link đã hết hạn 24 giờ
   - Cần tạo link mới bằng `/report1`

4. **"访问被拒绝"**
   - Token không hợp lệ
   - Link có thể bị thay đổi hoặc giả mạo

### Giải pháp
- Đảm bảo bot có quyền truy cập MongoDB
- Kiểm tra biến môi trường được cấu hình đúng
- Đảm bảo web server đang chạy
- Kiểm tra network connection

## Lịch sử phiên bản
- **v1.0**: Tính năng cơ bản với báo cáo web
- **v1.1**: Thêm bảo mật token và hết hạn
- **v1.2**: Cải thiện giao diện responsive

---
*Tài liệu này cập nhật lần cuối: $(date)* 