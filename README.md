# LINE Task Bot 🤖

ระบบมอบหมายงานผ่าน LINE Group ที่ช่วยให้คุณสามารถ tag คนในกลุ่มเพื่อมอบหมายงาน และให้คนๆ นั้นตอบกลับสถานะงานได้

## ฟีเจอร์หลัก

- ✅ **Tag มอบหมายงาน** - @ชื่อคน พร้อมรายละเอียดงาน
- ✅ **ตอบกลับงาน** - ผู้รับงานตอบกลับด้วยรหัสงาน
- ✅ **ติดตามสถานะ** - ดูงานที่กำลังทำและงานที่เสร็จแล้ว
- ✅ **หลายคนพร้อมกัน** - Tag หลายคนในครั้งเดียวได้
- ✅ **เก็บประวัติ** - บันทึกทุกการมอบหมายและการตอบกลับ

## คำสั่งใช้งาน

| คำสั่ง | รายละเอียด |
|--------|-----------|
| `@ชื่อคน รายละเอียดงาน` | สร้างงานใหม่ (tag ได้หลายคน) |
| `!done <รหัสงาน> <ข้อความ>` | ตอบกลับ/ทำเครื่องหมายงานเสร็จ |
| `!mytasks` | ดูงานทั้งหมดของคุณ |
| `!pending` | ดูงานที่ยังไม่เสร็จ |
| `!help` | แสดงคู่มือ |

## การติดตั้ง

### 1. ติดตั้ง Dependencies

```bash
npm install
```

### 2. ตั้งค่า LINE Developer

1. ไปที่ [LINE Developers](https://developers.line.biz/)
2. สร้าง Provider ใหม่
3. สร้าง Channel ประเภท **Messaging API**
4. บันทึกค่า:
   - **Channel Access Token** (Long-lived)
   - **Channel Secret**

### 3. ตั้งค่า Environment

```bash
cp .env.example .env
```

แก้ไขไฟล์ `.env`:

```env
LINE_CHANNEL_ACCESS_TOKEN=your_channel_access_token
LINE_CHANNEL_SECRET=your_channel_secret
PORT=3000
```

### 4. ตั้งค่า Webhook URL

ใน LINE Developer Console:
1. ไปที่ Messaging API settings
2. ตั้งค่า **Webhook URL**: `https://your-domain.com/webhook`
3. เปิดใช้งาน **Use webhook**
4. ปิด **Auto-reply** และ **Greeting** (optional)

### 5. รัน Server

```bash
# Development
npm run dev

# Production
npm start
```

## ตัวอย่างการใช้งาน

### สร้างงาน
```
@สมชาย @สมหญิง ช่วยเตรียมรายงานประจำเดือนให้หน่อยครับ
```

บอทจะตอบกลับ:
```
📋 สร้างงานใหม่แล้ว!

🆔 รหัสงาน: ABC123
👤 มอบให้: สมชาย, สมหญิง
📝 รายละเอียด: ช่วยเตรียมรายงานประจำเดือนให้หน่อยครับ
👨‍💼 โดย: คนมอบหมาย

💡 ผู้รับงานตอบกลับด้วย:
!done ABC123 <ข้อความ>
```

### ตอบกลับงาน
```
!done ABC123 ส่งงานแล้วครับ ดูที่ลิงก์นี้...
```

บอทจะตอบกลับ:
```
✅ งานเสร็จสิ้น!

📋 รหัสงาน: ABC123
👤 มอบโดย: คนมอบหมาย
📝 รายละเอียด: ช่วยเตรียมรายงาน...

💬 คำตอบจาก สมชาย:
ส่งงานแล้วครับ ดูที่ลิงก์นี้...
```

## โครงสร้างโปรเจค

```
line-task-bot/
├── server.js          # Main server & webhook handler
├── database.js        # SQLite database operations
├── package.json       # Dependencies
├── .env.example       # Environment template
└── README.md          # This file
```

## การ Deploy

### ใช้ ngrok สำหรับทดสอบ

```bash
# ติดตั้ง ngrok
# รัน server
npm run dev

# ใน terminal อื่น
ngrok http 3000

# เอา URL ที่ได้ไปใส่ใน LINE Developer Console
```

### Deploy บน Cloud

แนะนำ:
- [Railway](https://railway.app)
- [Render](https://render.com)
- [Heroku](https://heroku.com)
- VPS ของคุณเอง

อย่าลืมตั้งค่า Environment Variables บนแพลตฟอร์มที่ใช้

## การพัฒนาต่อ

- [ ] เพิ่มการแจ้งเตือนก่อนกำหนดเวลา
- [ ] เพิ่มความสำคัญของงาน (priority)
- [ ] เพิ่มกำหนดเวลาส่งงาน (deadline)
- [ ] สร้างหน้าเว็บดูรายงาน
- [ ] เชื่อมต่อกับ Calendar API

## License

MIT
