# 🏪 Shop Cooldown Management Bot

Discord bot สำหรับจัดการคูลดาวน์ร้านค้า พร้อม Slash Commands และระบบแจ้งเตือนอัตโนมัติ

## การติดตั้ง

1. ติดตั้ง Node.js จาก [nodejs.org](https://nodejs.org)

2. ติดตั้ง dependencies:
```bash
npm install
```

3. สร้าง Discord Application:
   - ไปที่ [Discord Developer Portal](https://discord.com/developers/applications)
   - คลิก "New Application"
   - ตั้งชื่อ bot
   - ไปที่แท็บ "Bot"
   - คลิก "Add Bot"
   - คัดลอก Token

4. เซ็ตอัพ environment variables:
   - แก้ไขไฟล์ `.env`
   - ใส่ Token ของ bot ใน `DISCORD_TOKEN`
   - ใส่ Client ID ใน `CLIENT_ID`

5. เชิญ bot เข้า server:
   - ไปที่แท็บ "OAuth2" > "URL Generator"
   - เลือก Scope: "bot"
   - เลือก Bot Permissions ที่ต้องการ
   - คัดลอก URL และเปิดในเบราว์เซอร์

## การรัน

```bash
npm start
```

## ✨ ฟีเจอร์หลัก

### 🕐 Slash Commands
- `/cooldown` - ตั้งเวลาคูลดาวน์ให้ร้าน (1-120 นาที)
- `/check_cooldown` - ตรวจสอบสถานะคูลดาวน์ของทุกร้าน  
- `/cancel_cooldown` - ยกเลิกคูลดาวน์ร้านที่เลือก
- `/sync` - Force sync slash commands (สำหรับแอดมิน)
- `/check_permissions` - ตรวจสอบสิทธิ์ของบอท

### 🏪 ร้านค้าที่รองรับ
- ร้านทะเลทราย
- ร้านไก่

### 🔔 ระบบแจ้งเตือนอัตโนมัติ
- **แจ้งเตือนล่วงหน้า 5 นาที** (สำหรับคูลดาวน์ > 5 นาที)
- **แจ้งเตือนเมื่อหมดเวลา** พร้อมอัปเดต embed
- **รีเฟรชเวลาทุกนาที** ในข้อความ embed

### 🎨 ฟีเจอร์พิเศษ
- **Rich Embeds** สีสันสวยงาม
- **Real-time Updates** อัปเดตเวลาแบบทันที
- **Permission Checker** ตรวจสอบสิทธิ์บอท
- **Admin Controls** ระบบ sync commands
- **Conflict Prevention** ป้องกันตั้งคูลดาวน์ซ้ำ

## 🚀 การใช้งาน

### ตัวอย่างคำสั่ง:
```
/cooldown shop:ร้านทะเลทราย minutes:30
/check_cooldown
/cancel_cooldown shop:ร้านไก่
```

## การพัฒนาต่อ

สามารถเพิ่มร้านใหม่ได้ในไฟล์ `src/index.js` ในตัวแปร `shops` array

```
node -v
npm -v
```

### Installation
1. Clone the repository:
   ```
   git clone <repository-url>
   ```
2. Navigate to the project directory:
   ```
   cd my-project
   ```
3. Install the dependencies:
   ```
   npm install
   ```

### Running the Application
To run the application, use the following command:

```
npm start
```

### Project Structure
```
shop-cooldown-bot/
├── src/
│   └── index.js        # Shop Cooldown Management Bot
├── .env               # Environment variables (Bot Token)
├── .gitignore         # Git ignore file
├── package.json       # Dependencies (discord.js, dotenv)
└── README.md          # This documentation
```

## 🎯 สถานะระบบ
- **ร้านทะเลทราย**: 🟢/🔴 (พร้อมใช้งาน/คูลดาวน์)
- **ร้านไก่**: 🟢/🔴 (พร้อมใช้งาน/คูลดาวน์)

## ⚠️ ข้อกำหนด
- Discord.js v14+
- Node.js v16.9.0+
- Bot ต้องมีสิทธิ์ Slash Commands

## Contributing
If you would like to contribute to this project, please fork the repository and submit a pull request.

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.