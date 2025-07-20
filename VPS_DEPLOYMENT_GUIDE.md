# Hướng dẫn Deploy Userbot lên Digital Ocean VPS

## Bước 1: Tạo và cấu hình VPS

### 1.1 Tạo Droplet trên Digital Ocean
1. Đăng nhập vào Digital Ocean
2. Tạo Droplet mới:
   - **OS**: Ubuntu 22.04 LTS
   - **Plan**: Basic ($6/tháng - 1GB RAM, 1 vCPU)
   - **Datacenter**: Singapore hoặc gần Việt Nam
   - **Authentication**: SSH Keys (khuyến nghị)

### 1.2 Kết nối SSH
```bash
ssh root@your_server_ip
```

## Bước 2: Cài đặt môi trường

### 2.1 Update hệ thống
```bash
apt update && apt upgrade -y
```

### 2.2 Cài đặt Node.js 20.x
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt-get install -y nodejs
```

### 2.3 Cài đặt MongoDB
```bash
# Import public key
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -

# Create list file
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Update and install
apt-get update
apt-get install -y mongodb-org

# Start MongoDB service
systemctl start mongod
systemctl enable mongod
```

### 2.4 Cài đặt PM2 (Process Manager)
```bash
npm install -g pm2
```

### 2.5 Cài đặt Git
```bash
apt-get install -y git
```

## Bước 3: Deploy code

### 3.1 Clone repository
```bash
# Tạo thư mục cho app
mkdir /var/www
cd /var/www

# Clone code của bạn
git clone https://github.com/your-username/your-repo.git userbot
cd userbot
```

### 3.2 Cài đặt dependencies
```bash
npm install
```

### 3.3 Tạo file .env
```bash
nano .env
```

Nội dung file .env:
```env
# Database Configuration
MONGODB_URI=mongodb://localhost:27017/telegram-bot

# Telegram Userbot Configuration
TELEGRAM_API_ID=your_api_id_here
TELEGRAM_API_HASH=your_api_hash_here
TELEGRAM_PHONE_NUMBER=+84xxxxxxxxx

# Session string (để trống lần đầu)
TELEGRAM_SESSION=

# Server Configuration
PORT=3000

# OpenAI Configuration (nếu có)
OPENAI_API_KEY=your_openai_api_key_here
```

## Bước 4: Xác thực Telegram lần đầu

### 4.1 Chạy một lần để tạo session
```bash
npm start
```

- Nhập mã xác thực từ Telegram
- Nhập mật khẩu 2FA (nếu có)
- Copy session string được in ra
- Dừng app bằng `Ctrl+C`

### 4.2 Thêm session string vào .env
```bash
nano .env
```

Thêm session string vào biến `TELEGRAM_SESSION`.

## Bước 5: Cấu hình PM2

### 5.1 Tạo ecosystem file
```bash
nano ecosystem.config.js
```

Nội dung file:
```javascript
module.exports = {
  apps: [{
    name: 'userbot',
    script: 'app.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
```

### 5.2 Tạo thư mục logs
```bash
mkdir logs
```

### 5.3 Khởi động với PM2
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

Chạy command được PM2 đề xuất để auto-start khi reboot.

## Bước 6: Cấu hình Firewall

### 6.1 Cài đặt UFW
```bash
ufw enable
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 3000
```

## Bước 7: Cấu hình Nginx (Optional - cho domain)

### 7.1 Cài đặt Nginx
```bash
apt-get install -y nginx
```

### 7.2 Cấu hình virtual host
```bash
nano /etc/nginx/sites-available/userbot
```

Nội dung:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 7.3 Kích hoạt site
```bash
ln -s /etc/nginx/sites-available/userbot /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

## Bước 8: SSL với Let's Encrypt (Optional)

```bash
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d your-domain.com
```

## Bước 9: Commands quản lý

### PM2 Commands:
```bash
# Xem status
pm2 status

# Xem logs
pm2 logs userbot

# Restart app
pm2 restart userbot

# Stop app
pm2 stop userbot

# Monitor
pm2 monit
```

### Update code:
```bash
cd /var/www/userbot
git pull origin main
npm install
pm2 restart userbot
```

## Bước 10: Backup và Monitoring

### 10.1 Backup script
```bash
nano /root/backup.sh
```

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/root/backups"
mkdir -p $BACKUP_DIR

# Backup MongoDB
mongodump --out $BACKUP_DIR/mongo_$DATE

# Backup code
tar -czf $BACKUP_DIR/code_$DATE.tar.gz -C /var/www userbot

# Keep only last 7 backups
find $BACKUP_DIR -type f -mtime +7 -delete

echo "Backup completed: $DATE"
```

```bash
chmod +x /root/backup.sh
```

### 10.2 Cron job cho backup hằng ngày
```bash
crontab -e
```

Thêm dòng:
```
0 2 * * * /root/backup.sh >> /var/log/backup.log 2>&1
```

## Troubleshooting

### Kiểm tra logs:
```bash
pm2 logs userbot --lines 100
tail -f /var/log/mongodb/mongod.log
```

### Kiểm tra ports:
```bash
netstat -tlnp | grep :3000
```

### Kiểm tra memory:
```bash
free -h
df -h
```

### Restart services:
```bash
systemctl restart mongod
pm2 restart userbot
systemctl restart nginx
```

## Lưu ý bảo mật:

1. **Thay đổi SSH port**:
```bash
nano /etc/ssh/sshd_config
# Port 22 -> Port 2222
systemctl restart sshd
ufw allow 2222
ufw delete allow ssh
```

2. **Tạo user non-root**:
```bash
adduser deploy
usermod -aG sudo deploy
```

3. **Disable root login**:
```bash
nano /etc/ssh/sshd_config
# PermitRootLogin no
```

4. **Fail2Ban**:
```bash
apt-get install fail2ban
```

Với hướng dẫn này, userbot của bạn sẽ chạy ổn định 24/7 trên VPS! 