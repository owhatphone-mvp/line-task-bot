const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = process.env.DATABASE_PATH || './database.sqlite';

// สร้างหรือเปิดฐานข้อมูล
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
    initTables();
  }
});

// สร้างตารางที่จำเป็น
function initTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT UNIQUE NOT NULL,
      group_id TEXT NOT NULL,
      assigner_id TEXT NOT NULL,
      assigner_name TEXT,
      assignee_id TEXT NOT NULL,
      assignee_name TEXT,
      message TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      reply_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      replied_at DATETIME
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS group_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      display_name TEXT,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(group_id, user_id)
    )
  `);

  console.log('Database tables initialized');
}

// ฟังก์ชันสำหรับจัดการงาน
const TaskDB = {
  // สร้างงานใหม่
  createTask: (taskData) => {
    return new Promise((resolve, reject) => {
      const { taskId, groupId, assignerId, assignerName, assigneeId, assigneeName, message } = taskData;
      db.run(
        `INSERT INTO tasks (task_id, group_id, assigner_id, assigner_name, assignee_id, assignee_name, message)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [taskId, groupId, assignerId, assignerName, assigneeId, assigneeName, message],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, taskId });
        }
      );
    });
  },

  // ค้นหางานตาม ID
  getTaskById: (taskId) => {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM tasks WHERE task_id = ?`,
        [taskId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  },

  // ค้นหางานที่มอบให้คนๆ หนึ่ง
  getTasksByAssignee: (groupId, assigneeId, status = null) => {
    return new Promise((resolve, reject) => {
      let sql = `SELECT * FROM tasks WHERE group_id = ? AND assignee_id = ?`;
      let params = [groupId, assigneeId];
      
      if (status) {
        sql += ` AND status = ?`;
        params.push(status);
      }
      
      sql += ` ORDER BY created_at DESC`;
      
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  // อัพเดทสถานะงาน (ตอบกลับ)
  replyToTask: (taskId, replyMessage) => {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE tasks 
         SET status = 'completed', reply_message = ?, replied_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE task_id = ?`,
        [replyMessage, taskId],
        function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });
  },

  // ดึงงานทั้งหมดในกลุ่ม
  getAllTasksInGroup: (groupId, limit = 50) => {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM tasks WHERE group_id = ? ORDER BY created_at DESC LIMIT ?`,
        [groupId, limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  },

  // บันทึกข้อมูลสมาชิกกลุ่ม
  saveMember: (groupId, userId, displayName) => {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT OR REPLACE INTO group_members (group_id, user_id, display_name)
         VALUES (?, ?, ?)`,
        [groupId, userId, displayName],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID });
        }
      );
    });
  },

  // ดึงข้อมูลสมาชิกกลุ่ม
  getGroupMembers: (groupId) => {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM group_members WHERE group_id = ?`,
        [groupId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }
};

module.exports = { db, TaskDB };
