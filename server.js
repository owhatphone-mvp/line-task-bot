require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const { TaskDB } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// LINE SDK Configuration
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new line.messagingApi.MessagingApiClient({
  bearer: config.channelAccessToken
});

// LINE Webhook endpoint (must come BEFORE express.json to preserve raw body for signature validation)
app.post('/webhook', line.middleware(config), async (req, res) => {
  try {
    const events = req.body.events;
    
    for (const event of events) {
      await handleEvent(event);
    }
    
    res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// จัดการ events จาก LINE
async function handleEvent(event) {
  console.log('Received event:', JSON.stringify(event, null, 2));

  // จัดการข้อความที่ส่งมา
  if (event.type === 'message' && event.message.type === 'text') {
    await handleTextMessage(event);
  }
  
  // จัดการเมื่อบอทถูกเชิญเข้ากลุ่ม
  if (event.type === 'join') {
    await handleJoinEvent(event);
  }
  
  // จัดการเมื่อมีสมาชิกเข้ากลุ่ม
  if (event.type === 'memberJoined') {
    await handleMemberJoined(event);
  }
}

// จัดการข้อความ text
async function handleTextMessage(event) {
  const { text } = event.message;
  const { groupId, userId } = event.source;
  
  // ถ้าไม่ใช่ในกลุ่ม ให้ข้าม
  if (!groupId) {
    await replyMessage(event.replyToken, 'บอทนี้ทำงานในกลุ่ม LINE เท่านั้นครับ');
    return;
  }

  // ดึงข้อมูลผู้ใช้
  const userProfile = await getUserProfile(groupId, userId);
  const displayName = userProfile?.displayName || 'ไม่ระบุชื่อ';

  // บันทึกสมาชิก
  await TaskDB.saveMember(groupId, userId, displayName);

  // คำสั่งช่วยเหลือ
  if (text === '!help' || text === '!h') {
    await sendHelpMessage(event.replyToken);
    return;
  }

  // ดูงานทั้งหมดของฉัน
  if (text === '!mytasks' || text === '!งานของฉัน') {
    await showMyTasks(event.replyToken, groupId, userId);
    return;
  }

  // ดูงานที่ยังไม่เสร็จ
  if (text === '!pending' || text === '!งานค้าง') {
    await showPendingTasks(event.replyToken, groupId, userId);
    return;
  }

  // ตอบกลับงาน (รูปแบบ: !done <task_id> <ข้อความ>)
  if (text.startsWith('!done ') || text.startsWith('!เสร็จ ')) {
    await handleTaskReply(event.replyToken, groupId, userId, displayName, text);
    return;
  }

  // ตรวจสอบว่ามีการ mention/tag ใครหรือไม่
  const mentionees = event.message.mention?.mentionees || [];
  
  if (mentionees.length > 0) {
    // มีการ tag คน - สร้างงานใหม่
    await createTask(event, mentionees, displayName);
  }
}

// สร้างงานใหม่
async function createTask(event, mentionees, assignerName) {
  const { text } = event.message;
  const { groupId, userId: assignerId } = event.source;
  
  // สร้าง task ID แบบสั้น
  const taskId = generateTaskId();
  
  // ดึงข้อความงาน (ลบ mention ออก)
  let taskMessage = text;
  mentionees.forEach(mention => {
    taskMessage = taskMessage.replace(mention.text, '').trim();
  });
  
  // ถ้าไม่มีข้อความงาน ให้ใช้ข้อความเริ่มต้น
  if (!taskMessage) {
    taskMessage = 'ไม่มีรายละเอียดงาน';
  }

  // สร้างงานสำหรับแต่ละคนที่ถูก tag
  const createdTasks = [];
  
  for (const mention of mentionees) {
    // ข้ามถ้า tag ตัวเอง
    if (mention.userId === assignerId) continue;
    
    // ดึงข้อมูลผู้ถูกมอบหมาย
    const assigneeProfile = await getUserProfile(groupId, mention.userId);
    const assigneeName = assigneeProfile?.displayName || mention.text.replace('@', '');
    
    // บันทึกลงฐานข้อมูล
    await TaskDB.createTask({
      taskId,
      groupId,
      assignerId,
      assignerName,
      assigneeId: mention.userId,
      assigneeName,
      message: taskMessage
    });
    
    createdTasks.push({
      taskId,
      assigneeName,
      assigneeId: mention.userId
    });
  }

  if (createdTasks.length > 0) {
    // ส่งข้อความยืนยัน
    const replyText = formatTaskCreatedMessage(createdTasks, assignerName, taskMessage);
    await replyMessage(event.replyToken, replyText);
  }
}

// จัดการการตอบกลับงาน
async function handleTaskReply(replyToken, groupId, userId, displayName, text) {
  // แยก task ID และข้อความตอบกลับ
  const parts = text.split(' ');
  if (parts.length < 3) {
    await replyMessage(replyToken, 'รูปแบบไม่ถูกต้อง\nใช้: !done <รหัสงาน> <ข้อความตอบกลับ>\nตัวอย่าง: !done ABC123 งานเสร็จแล้วครับ');
    return;
  }

  const taskId = parts[1];
  const replyMessage_text = parts.slice(2).join(' ');

  // ค้นหางาน
  const task = await TaskDB.getTaskById(taskId);
  
  if (!task) {
    await replyMessage(replyToken, `ไม่พบงานรหัส ${taskId} ครับ`);
    return;
  }

  // ตรวจสอบว่าเป็นงานของคนนี้จริงๆ
  if (task.assignee_id !== userId) {
    await replyMessage(replyToken, `คุณไม่ใช่ผู้รับผิดชอบงานรหัส ${taskId} ครับ`);
    return;
  }

  // ตรวจสอบว่างานเสร็จไปแล้วหรือยัง
  if (task.status === 'completed') {
    await replyMessage(replyToken, `งานรหัส ${taskId} ถูกทำเครื่องหมายเสร็จสิ้นไปแล้วครับ`);
    return;
  }

  // บันทึกการตอบกลับ
  await TaskDB.replyToTask(taskId, replyMessage_text);

  // ส่งข้อความยืนยัน
  const confirmText = `✅ งานเสร็จสิ้น!\n\n` +
    `📋 รหัสงาน: ${taskId}\n` +
    `👤 มอบโดย: ${task.assigner_name}\n` +
    `📝 รายละเอียด: ${task.message}\n\n` +
    `💬 คำตอบจาก ${displayName}:\n${replyMessage_text}`;

  await replyMessage(replyToken, confirmText);
  
  // แจ้งเตือนผู้มอบหมายงาน (ถ้าอยู่ในกลุ่มเดียวกัน)
  try {
    await client.pushMessage({
      to: task.assigner_id,
      messages: [{
        type: 'text',
        text: `📢 งานที่คุณมอบหมายได้รับการตอบกลับแล้ว!\n\nรหัสงาน: ${taskId}\nจาก: ${displayName}\n\nคำตอบ: ${replyMessage_text}`
      }]
    });
  } catch (err) {
    console.log('Could not notify assigner:', err.message);
  }
}

// แสดงงานทั้งหมดของฉัน
async function showMyTasks(replyToken, groupId, userId) {
  const tasks = await TaskDB.getTasksByAssignee(groupId, userId);
  
  if (tasks.length === 0) {
    await replyMessage(replyToken, 'คุณไม่มีงานในระบบครับ 🎉');
    return;
  }

  let text = `📋 งานทั้งหมดของคุณ (${tasks.length} งาน):\n\n`;
  
  tasks.forEach((task, index) => {
    const status = task.status === 'completed' ? '✅' : '⏳';
    text += `${index + 1}. ${status} [${task.task_id}] ${task.message.substring(0, 30)}${task.message.length > 30 ? '...' : ''}\n`;
    text += `   จาก: ${task.assigner_name} | ${formatDate(task.created_at)}\n\n`;
  });

  await replyMessage(replyToken, text);
}

// แสดงงานที่ยังไม่เสร็จ
async function showPendingTasks(replyToken, groupId, userId) {
  const tasks = await TaskDB.getTasksByAssignee(groupId, userId, 'pending');
  
  if (tasks.length === 0) {
    await replyMessage(replyToken, 'ไม่มีงานค้างครับ! ยอดเยี่ยม 🎉');
    return;
  }

  let text = `⏳ งานที่ยังไม่เสร็จ (${tasks.length} งาน):\n\n`;
  
  tasks.forEach((task, index) => {
    text += `${index + 1}. [${task.task_id}] ${task.message}\n`;
    text += `   จาก: ${task.assigner_name} | ${formatDate(task.created_at)}\n`;
    text += `   💡 ตอบกลับ: !done ${task.task_id} <ข้อความ>\n\n`;
  });

  await replyMessage(replyToken, text);
}

// ส่งข้อความช่วยเหลือ
async function sendHelpMessage(replyToken) {
  const helpText = `🤖 คู่มือใช้งาน Task Bot\n\n` +
    `📌 สร้างงาน:\n` +
    `   @ชื่อคน รายละเอียดงาน\n` +
    `   (สามารถ tag หลายคนได้พร้อมกัน)\n\n` +
    `✅ ตอบกลับงาน:\n` +
    `   !done <รหัสงาน> <ข้อความ>\n` +
    `   ตัวอย่าง: !done ABC123 ส่งงานแล้วครับ\n\n` +
    `📋 ดูงาน:\n` +
    `   !mytasks - ดูงานทั้งหมดของคุณ\n` +
    `   !pending - ดูงานที่ยังไม่เสร็จ\n\n` +
    `❓ ช่วยเหลือ:\n` +
    `   !help - แสดงคู่มือนี้`;

  await replyMessage(replyToken, helpText);
}

// จัดการเมื่อบอทถูกเชิญเข้ากลุ่ม
async function handleJoinEvent(event) {
  const { groupId } = event.source;
  console.log(`Bot joined group: ${groupId}`);
  
  await replyMessage(event.replyToken, 
    `👋 สวัสดีครับ! ผมคือ Task Bot\n\n` +
    `พิมพ์ !help เพื่อดูวิธีใช้งาน\n\n` +
    `💡 เริ่มต้นใช้งาน:\n` +
    `@ชื่อคน ตามด้วยรายละเอียดงาน`
  );
}

// จัดการเมื่อมีสมาชิกเข้ากลุ่ม
async function handleMemberJoined(event) {
  const { groupId } = event.source;
  const joinedMembers = event.joined.members;
  
  for (const member of joinedMembers) {
    if (member.type === 'user') {
      const profile = await getUserProfile(groupId, member.userId);
      if (profile) {
        await TaskDB.saveMember(groupId, member.userId, profile.displayName);
      }
    }
  }
}

// ดึงข้อมูลผู้ใช้
async function getUserProfile(groupId, userId) {
  try {
    const profile = await client.getGroupMemberProfile(groupId, userId);
    return profile;
  } catch (err) {
    console.error('Error getting user profile:', err);
    return null;
  }
}

// ส่งข้อความตอบกลับ
async function replyMessage(replyToken, text) {
  try {
    await client.replyMessage({
      replyToken,
      messages: [{ type: 'text', text }]
    });
  } catch (err) {
    console.error('Error replying message:', err);
  }
}

// สร้างรหัสงานแบบสั้น
function generateTaskId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// จัดรูปแบบข้อความงานที่สร้าง
function formatTaskCreatedMessage(tasks, assignerName, message) {
  const taskId = tasks[0].taskId;
  const assigneeNames = tasks.map(t => t.assigneeName).join(', ');
  
  return `📋 สร้างงานใหม่แล้ว!\n\n` +
    `🆔 รหัสงาน: ${taskId}\n` +
    `👤 มอบให้: ${assigneeNames}\n` +
    `📝 รายละเอียด: ${message}\n` +
    `👨‍💼 โดย: ${assignerName}\n\n` +
    `💡 ผู้รับงานตอบกลับด้วย:\n` +
    `!done ${taskId} <ข้อความ>`;
}

// จัดรูปแบบวันที่
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('th-TH', { 
    day: 'numeric', 
    month: 'short', 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

// Health check endpoint
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'LINE Task Bot is running',
    timestamp: new Date().toISOString()
  });
});

// ดึงข้อมูลงานทั้งหมดในกลุ่ม (สำหรับ debug)
app.get('/api/tasks/:groupId', async (req, res) => {
  try {
    const tasks = await TaskDB.getAllTasksInGroup(req.params.groupId);
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Webhook URL: http://your-domain.com/webhook`);
});
