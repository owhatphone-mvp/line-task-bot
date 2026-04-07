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
  channelAccessToken: config.channelAccessToken
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
  if (text === '!help' || text === '!h' || text === '!ช่วย') {
    await sendHelpMessage(event.replyToken);
    return;
  }

  // ดูงานทั้งหมดของฉัน
  if (text === '!งานที่ต้องทำ' || text === '!mytasks' || text === '!mytask') {
    await showMyTasks(event.replyToken, groupId, userId);
    return;
  }

  // ดูงานที่ยังไม่เสร็จ
  if (text === '!งานค้าง' || text === '!pending') {
    await showPendingTasks(event.replyToken, groupId, userId);
    return;
  }

  // ส่งงาน/ตอบกลับงาน (รูปแบบ: !ส่งงาน <รหัสงาน> <ข้อความ>)
  if (text.startsWith('!ส่งงาน ') || text.startsWith('!done ')) {
    await handleTaskReply(event.replyToken, groupId, userId, displayName, text);
    return;
  }

  // รับงาน (รูปแบบ: !รับงาน หรือ !รับงาน <รหัสงาน>)
  if (text === '!รับงาน' || text.startsWith('!รับงาน ')) {
    await handleAcceptTask(event.replyToken, groupId, userId, displayName, text);
    return;
  }

  // สร้างงานใหม่ (รูปแบบ: !ตามงาน @ชื่อคน รายละเอียดงาน)
  const mentionees = event.message.mention?.mentionees || [];
  
  if (text.startsWith('!ตามงาน') && mentionees.length > 0) {
    await createTask(event, mentionees, displayName);
  }
}

// สร้างงานใหม่
async function createTask(event, mentionees, assignerName) {
  const { text } = event.message;
  const { groupId, userId: assignerId } = event.source;
  
  // สร้าง task ID แบบสั้น
  const taskId = generateTaskId();
  
  // ดึงข้อความงาน (ลบ !ตามงาน และ mention ออก)
  let taskMessage = text.replace(/^!ตามงาน\s*/, '');
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
    // สร้างข้อความแบบ textV2 พร้อม mention ผู้รับงาน
    const substitution = {};
    const mentionParts = [];

    createdTasks.forEach((task, index) => {
      const key = `assignee${index}`;
      substitution[key] = {
        type: 'mention',
        mentionee: {
          type: 'user',
          userId: task.assigneeId
        }
      };
      mentionParts.push(`{${key}}`);
    });

    const taskId = createdTasks[0].taskId;
    const messageText = `📋 สร้างงานใหม่แล้ว!\n\n` +
      `🆔 รหัสงาน: ${taskId}\n` +
      `👤 มอบให้: ${mentionParts.join(', ')}\n` +
      `📝 รายละเอียด: ${taskMessage}\n` +
      `👨‍💼 โดย: ${assignerName}\n\n` +
      `💡 ผู้รับงานตอบกลับด้วย:\n` +
      `!ส่งงาน ${taskId} <ข้อความ>`;

    try {
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [{
          type: 'textV2',
          text: messageText,
          substitution: substitution,
          quickReply: {
            items: [
              {
                type: 'action',
                action: {
                  type: 'message',
                  label: '✅ รับงาน',
                  text: `!รับงาน ${createdTasks[0].taskId}`
                }
              },
              {
                type: 'action',
                action: {
                  type: 'message',
                  label: '📋 งานที่ต้องทำ',
                  text: '!งานที่ต้องทำ'
                }
              }
            ]
          }
        }]
      });
    } catch (err) {
      console.error('Error sending textV2:', err);
      // fallback เป็นข้อความธรรมดาถ้า textV2 ไม่รองรับ
      const fallbackText = formatTaskCreatedMessage(createdTasks, assignerName, taskMessage);
      await replyMessage(event.replyToken, fallbackText);
    }
  }
}

// แปลงวันที่จากข้อความไทย เช่น "10/04 15:00", "10/04/2026 15:00", "พรุ่งนี้ 15:00", "วันนี้ 18:00"
function parseDeadline(text) {
  const now = new Date();
  
  // รูปแบบ "พรุ่งนี้ HH:MM"
  let match = text.match(/พรุ่งนี้\s*(\d{1,2})[:.:](\d{2})/);
  if (match) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(parseInt(match[1]), parseInt(match[2]), 0, 0);
    return d;
  }

  // รูปแบบ "วันนี้ HH:MM" หรือ "HH:MM"
  match = text.match(/(?:วันนี้\s*)?(\d{1,2})[:.:](\d{2})$/);
  if (match && !text.match(/\d{1,2}\/\d{1,2}/)) {
    const d = new Date(now);
    d.setHours(parseInt(match[1]), parseInt(match[2]), 0, 0);
    if (d <= now) d.setDate(d.getDate() + 1); // ถ้าเวลาผ่านไปแล้ว ให้เป็นพรุ่งนี้
    return d;
  }

  // รูปแบบ "DD/MM HH:MM" หรือ "DD/MM/YYYY HH:MM"
  match = text.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s+(\d{1,2})[:.:](\d{2})/);
  if (match) {
    const day = parseInt(match[1]);
    const month = parseInt(match[2]) - 1;
    let year = match[3] ? parseInt(match[3]) : now.getFullYear();
    if (year < 100) year += 2000;
    if (year > 2500) year -= 543; // แปลง พ.ศ. เป็น ค.ศ.
    const hour = parseInt(match[4]);
    const min = parseInt(match[5]);
    return new Date(year, month, day, hour, min, 0);
  }

  return null;
}

// จัดรูปแบบ deadline เป็นข้อความไทย
function formatDeadline(dateString) {
  const d = new Date(dateString);
  return d.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// จัดการรับงาน
async function handleAcceptTask(replyToken, groupId, userId, displayName, text) {
  const parts = text.replace('!รับงาน', '').trim().split(/\s+/);
  
  // หา task ID (ถ้ามี)
  let taskId = null;
  let deadlineText = '';
  
  if (parts.length > 0 && parts[0].match(/^[A-Z0-9]{6}$/)) {
    taskId = parts[0];
    deadlineText = parts.slice(1).join(' ');
  } else {
    deadlineText = parts.join(' ');
  }

  // หางาน
  let task;
  if (taskId) {
    task = await TaskDB.getTaskById(taskId);
  } else {
    const pendingTasks = await TaskDB.getTasksByAssignee(groupId, userId, 'pending');
    task = pendingTasks.length > 0 ? pendingTasks[0] : null;
  }

  if (!task) {
    await replyMessage(replyToken, 'ไม่พบงานที่รอรับครับ');
    return;
  }

  if (task.assignee_id !== userId) {
    await replyMessage(replyToken, `คุณไม่ใช่ผู้รับผิดชอบงานรหัส ${task.task_id} ครับ`);
    return;
  }

  if (task.status === 'accepted') {
    await replyMessage(replyToken, `คุณรับงานรหัส ${task.task_id} ไปแล้วครับ`);
    return;
  }

  if (task.status === 'completed') {
    await replyMessage(replyToken, `งานรหัส ${task.task_id} เสร็จสิ้นไปแล้วครับ`);
    return;
  }

  // ต้องระบุกำหนดส่ง
  if (!deadlineText) {
    try {
      await client.replyMessage({
        replyToken,
        messages: [{
          type: 'text',
          text: `📅 กรุณาระบุกำหนดส่งด้วยครับ\n\nพิมพ์: !รับงาน ${task.task_id} <กำหนดส่ง>\n\nตัวอย่าง:\n• !รับงาน ${task.task_id} วันนี้ 18:00\n• !รับงาน ${task.task_id} พรุ่งนี้ 12:00\n• !รับงาน ${task.task_id} 15/04 09:00`,
          quickReply: {
            items: [
              {
                type: 'action',
                action: { type: 'message', label: '⏰ วันนี้ 18:00', text: `!รับงาน ${task.task_id} วันนี้ 18:00` }
              },
              {
                type: 'action',
                action: { type: 'message', label: '📅 พรุ่งนี้ 12:00', text: `!รับงาน ${task.task_id} พรุ่งนี้ 12:00` }
              },
              {
                type: 'action',
                action: { type: 'message', label: '📅 พรุ่งนี้ 18:00', text: `!รับงาน ${task.task_id} พรุ่งนี้ 18:00` }
              }
            ]
          }
        }]
      });
    } catch (err) {
      await replyMessage(replyToken, `📅 กรุณาระบุกำหนดส่งด้วยครับ\n\nพิมพ์: !รับงาน ${task.task_id} <กำหนดส่ง>\nตัวอย่าง: !รับงาน ${task.task_id} พรุ่งนี้ 12:00`);
    }
    return;
  }

  // แปลงกำหนดส่ง
  const deadline = parseDeadline(deadlineText);
  if (!deadline) {
    await replyMessage(replyToken, `❌ รูปแบบวันที่ไม่ถูกต้อง\n\nตัวอย่างที่ใช้ได้:\n• วันนี้ 18:00\n• พรุ่งนี้ 12:00\n• 15/04 09:00\n• 15/04/2026 09:00`);
    return;
  }

  // บันทึก
  await TaskDB.acceptTask(task.task_id, deadline.toISOString());

  // ตอบกลับพร้อม tag ผู้มอบหมาย
  const confirmText = `👍 รับงานแล้ว!\n\n` +
    `📋 รหัสงาน: ${task.task_id}\n` +
    `📝 รายละเอียด: ${task.message}\n` +
    `👤 มอบโดย: {assigner}\n` +
    `🙋 รับโดย: ${displayName}\n` +
    `⏰ กำหนดส่ง: ${formatDeadline(deadline)}\n\n` +
    `💡 เสร็จแล้วพิมพ์: !ส่งงาน ${task.task_id} <ข้อความ>`;

  try {
    await client.replyMessage({
      replyToken,
      messages: [{
        type: 'textV2',
        text: confirmText,
        substitution: {
          assigner: {
            type: 'mention',
            mentionee: { type: 'user', userId: task.assigner_id }
          }
        }
      }]
    });
  } catch (err) {
    const fallback = confirmText.replace('{assigner}', task.assigner_name);
    await replyMessage(replyToken, fallback);
  }
}

// จัดการการตอบกลับงาน
async function handleTaskReply(replyToken, groupId, userId, displayName, text) {
  // แยก task ID และข้อความตอบกลับ
  const parts = text.split(' ');
  if (parts.length < 3) {
    await replyMessage(replyToken, 'รูปแบบไม่ถูกต้อง\nใช้: !ส่งงาน <รหัสงาน> <ข้อความตอบกลับ>\nตัวอย่าง: !ส่งงาน ABC123 งานเสร็จแล้วครับ');
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

  // ถ้ายังไม่ได้รับงาน ให้รับอัตโนมัติก่อนส่งงาน
  if (task.status === 'pending') {
    await TaskDB.acceptTask(taskId);
  }

  // บันทึกการตอบกลับ
  await TaskDB.replyToTask(taskId, replyMessage_text);

  // ส่งข้อความยืนยัน พร้อม tag ผู้มอบหมาย
  const confirmText = `✅ งานเสร็จสิ้น!\n\n` +
    `📋 รหัสงาน: ${taskId}\n` +
    `👤 มอบโดย: {assigner}\n` +
    `📝 รายละเอียด: ${task.message}\n\n` +
    `💬 คำตอบจาก ${displayName}:\n${replyMessage_text}`;

  try {
    await client.replyMessage({
      replyToken,
      messages: [{
        type: 'textV2',
        text: confirmText,
        substitution: {
          assigner: {
            type: 'mention',
            mentionee: {
              type: 'user',
              userId: task.assigner_id
            }
          }
        }
      }]
    });
  } catch (err) {
    console.error('Error sending textV2 reply:', err);
    const fallback = `✅ งานเสร็จสิ้น!\n\n` +
      `📋 รหัสงาน: ${taskId}\n` +
      `👤 มอบโดย: ${task.assigner_name}\n` +
      `📝 รายละเอียด: ${task.message}\n\n` +
      `💬 คำตอบจาก ${displayName}:\n${replyMessage_text}`;
    await replyMessage(replyToken, fallback);
  }
  
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
    const status = task.status === 'completed' ? '✅' : task.status === 'accepted' ? '👍' : '⏳';
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
    text += `   💡 ตอบกลับ: !ส่งงาน ${task.task_id} <ข้อความ>\n\n`;
  });

  await replyMessage(replyToken, text);
}

// ส่งข้อความช่วยเหลือ
async function sendHelpMessage(replyToken) {
  const helpText = `🤖 คู่มือใช้งาน Task Bot\n\n` +
    `📌 สั่งงาน:\n` +
    `   !ตามงาน @ชื่อคน รายละเอียดงาน\n\n` +
    `👍 รับงาน:\n` +
    `   !รับงาน - รับงานล่าสุด\n` +
    `   !รับงาน <รหัสงาน> - รับงานตามรหัส\n` +
    `   (หรือกดปุ่ม "รับงาน" ได้เลย)\n\n` +
    `✅ ส่งงาน:\n` +
    `   !ส่งงาน <รหัสงาน> <ข้อความ>\n\n` +
    `📋 ดูงาน:\n` +
    `   !งานที่ต้องทำ - ดูงานทั้งหมด\n` +
    `   !งานค้าง - ดูงานที่ยังไม่เสร็จ\n\n` +
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
    `!ตามงาน @ชื่อคน ตามด้วยรายละเอียดงาน`
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
    `!ส่งงาน ${taskId} <ข้อความ>`;
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

// ===== ระบบทวงงานอัตโนมัติ =====
// ตรวจสอบทุก 5 นาที ว่ามีงานเลยกำหนดไหม
setInterval(async () => {
  try {
    const overdueTasks = await TaskDB.getOverdueTasks();
    
    for (const task of overdueTasks) {
      console.log(`⏰ Overdue task found: ${task.task_id} - ${task.message}`);
      
      // ส่ง push message ทวงงานในกลุ่ม
      try {
        await client.pushMessage({
          to: task.group_id,
          messages: [{
            type: 'textV2',
            text: `⏰ ทวงงาน!\n\n` +
              `📋 รหัสงาน: ${task.task_id}\n` +
              `📝 รายละเอียด: ${task.message}\n` +
              `👤 ผู้รับงาน: {assignee}\n` +
              `⚠️ เลยกำหนดส่ง: ${formatDeadline(task.deadline)}\n\n` +
              `กรุณาส่งงานด้วย:\n!ส่งงาน ${task.task_id} <ข้อความ>`,
            substitution: {
              assignee: {
                type: 'mention',
                mentionee: { type: 'user', userId: task.assignee_id }
              }
            },
            quickReply: {
              items: [
                {
                  type: 'action',
                  action: { type: 'message', label: '✅ ส่งงานเลย', text: `!ส่งงาน ${task.task_id} เสร็จแล้วครับ` }
                }
              ]
            }
          }]
        });
        
        // บันทึกว่าส่ง reminder แล้ว
        await TaskDB.markReminderSent(task.task_id);
        console.log(`✅ Reminder sent for task ${task.task_id}`);
      } catch (err) {
        console.error(`Error sending reminder for task ${task.task_id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('Error checking overdue tasks:', err);
  }
}, 5 * 60 * 1000); // ทุก 5 นาที

console.log('⏰ Auto-reminder system started (checks every 5 minutes)');

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Webhook URL: http://your-domain.com/webhook`);
});
