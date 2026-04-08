/**
 * Database layer - รองรับทั้ง PostgreSQL (Render) และ SQLite (Local)
 * ถ้ามี DATABASE_URL จะใช้ PostgreSQL, ถ้าไม่มีจะใช้ SQLite
 */

const DATABASE_URL = process.env.DATABASE_URL;
let db;

// ─── PostgreSQL Mode ───
if (DATABASE_URL) {
  const { Pool } = require('pg');
  db = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  console.log('Connected to PostgreSQL database');

  // สร้างตาราง
  (async () => {
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS tasks (
          id SERIAL PRIMARY KEY,
          task_id TEXT UNIQUE NOT NULL,
          group_id TEXT NOT NULL,
          assigner_id TEXT NOT NULL,
          assigner_name TEXT,
          assignee_id TEXT NOT NULL,
          assignee_name TEXT,
          message TEXT NOT NULL,
          status TEXT DEFAULT 'pending',
          reply_message TEXT,
          deadline TIMESTAMP,
          reminder_sent INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          accepted_at TIMESTAMP,
          replied_at TIMESTAMP
        )
      `);
      // Migration: add reject_reason if not exists
      try { await db.query(`ALTER TABLE tasks ADD COLUMN reject_reason TEXT`); } catch(e) {}
      // Migration: add reminder columns
      try { await db.query(`ALTER TABLE tasks ADD COLUMN reminder_1h_sent INTEGER DEFAULT 0`); } catch(e) {}
      try { await db.query(`ALTER TABLE tasks ADD COLUMN reminder_day_sent INTEGER DEFAULT 0`); } catch(e) {}
      await db.query(`
        CREATE TABLE IF NOT EXISTS group_members (
          id SERIAL PRIMARY KEY,
          group_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          display_name TEXT,
          joined_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(group_id, user_id)
        )
      `);
      await db.query(`
        CREATE TABLE IF NOT EXISTS chat_logs (
          id SERIAL PRIMARY KEY,
          group_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          display_name TEXT,
          message TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      await db.query(`
        CREATE TABLE IF NOT EXISTS points (
          id SERIAL PRIMARY KEY,
          group_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          display_name TEXT,
          total_points INTEGER DEFAULT 0,
          tasks_completed INTEGER DEFAULT 0,
          tasks_on_time INTEGER DEFAULT 0,
          current_streak INTEGER DEFAULT 0,
          best_streak INTEGER DEFAULT 0,
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(group_id, user_id)
        )
      `);
      await db.query(`
        CREATE TABLE IF NOT EXISTS points_log (
          id SERIAL PRIMARY KEY,
          group_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          task_id TEXT,
          points INTEGER NOT NULL,
          reason TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      console.log('Database tables initialized (PostgreSQL)');
    } catch (err) {
      console.error('Error initializing PostgreSQL tables:', err);
    }
  })();

// ─── SQLite Mode ───
} else {
  const sqlite3 = require('sqlite3').verbose();
  const DB_PATH = process.env.DATABASE_PATH || './database.sqlite';

  db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) console.error('Error opening database:', err);
    else {
      console.log('Connected to SQLite database');
      initSQLiteTables();
    }
  });

  function initSQLiteTables() {
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
        deadline DATETIME,
        reminder_sent INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        accepted_at DATETIME,
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
    db.run(`
      CREATE TABLE IF NOT EXISTS chat_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        display_name TEXT,
        message TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS points (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        display_name TEXT,
        total_points INTEGER DEFAULT 0,
        tasks_completed INTEGER DEFAULT 0,
        tasks_on_time INTEGER DEFAULT 0,
        current_streak INTEGER DEFAULT 0,
        best_streak INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(group_id, user_id)
      )
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS points_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        task_id TEXT,
        points INTEGER NOT NULL,
        reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Database tables initialized (SQLite)');
    // Migration
    db.run(`ALTER TABLE tasks ADD COLUMN deadline DATETIME`, () => {});
    db.run(`ALTER TABLE tasks ADD COLUMN reminder_sent INTEGER DEFAULT 0`, () => {});
    db.run(`ALTER TABLE tasks ADD COLUMN accepted_at DATETIME`, () => {});
    db.run(`ALTER TABLE tasks ADD COLUMN reject_reason TEXT`, () => {});
  }
}

// ─── Helper: ทำให้ query interface เหมือนกันทั้ง PG และ SQLite ───
function queryOne(sql, params = []) {
  if (DATABASE_URL) {
    // PostgreSQL: แปลง ? เป็น $1, $2, ...
    let i = 0;
    const pgSql = sql.replace(/\?/g, () => `$${++i}`);
    return db.query(pgSql, params).then(r => r.rows[0] || null);
  } else {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => err ? reject(err) : resolve(row || null));
    });
  }
}

function queryAll(sql, params = []) {
  if (DATABASE_URL) {
    let i = 0;
    const pgSql = sql.replace(/\?/g, () => `$${++i}`);
    return db.query(pgSql, params).then(r => r.rows);
  } else {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
    });
  }
}

function run(sql, params = []) {
  if (DATABASE_URL) {
    let i = 0;
    const pgSql = sql.replace(/\?/g, () => `$${++i}`);
    return db.query(pgSql, params).then(r => ({ changes: r.rowCount }));
  } else {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes, lastID: this.lastID });
      });
    });
  }
}

// ─── TaskDB: ฟังก์ชันจัดการงาน ───
const TaskDB = {
  createTask: async (taskData) => {
    const { taskId, groupId, assignerId, assignerName, assigneeId, assigneeName, message } = taskData;
    const result = await run(
      `INSERT INTO tasks (task_id, group_id, assigner_id, assigner_name, assignee_id, assignee_name, message)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [taskId, groupId, assignerId, assignerName, assigneeId, assigneeName, message]
    );
    return { id: result.lastID, taskId };
  },

  getTaskById: (taskId) => {
    return queryOne(`SELECT * FROM tasks WHERE task_id = ?`, [taskId]);
  },

  getTasksByAssignee: (groupId, assigneeId, status = null) => {
    let sql = `SELECT * FROM tasks WHERE group_id = ? AND assignee_id = ?`;
    let params = [groupId, assigneeId];
    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }
    sql += ` ORDER BY created_at DESC`;
    return queryAll(sql, params);
  },

  acceptTask: (taskId, deadline = null) => {
    return run(
      DATABASE_URL
        ? `UPDATE tasks SET status = 'accepted', deadline = ?, accepted_at = NOW(), updated_at = NOW() WHERE task_id = ?`
        : `UPDATE tasks SET status = 'accepted', deadline = ?, accepted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE task_id = ?`,
      [deadline, taskId]
    );
  },

  getOverdueTasks: () => {
    const now = new Date().toISOString();
    return queryAll(
      `SELECT * FROM tasks 
       WHERE deadline IS NOT NULL 
       AND deadline <= ? 
       AND status = 'accepted'
       AND reminder_sent = 0`,
      [now]
    );
  },

  markReminderSent: (taskId) => {
    return run(`UPDATE tasks SET reminder_sent = 1 WHERE task_id = ?`, [taskId]);
  },

  // งานที่ถึงกำหนดภายใน 1 ชม. แต่ยังไม่เตือน
  getTasksDueSoon: () => {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    return queryAll(
      `SELECT * FROM tasks 
       WHERE deadline IS NOT NULL 
       AND deadline > ? 
       AND deadline <= ? 
       AND status = 'accepted'
       AND reminder_1h_sent = 0`,
      [now.toISOString(), oneHourLater.toISOString()]
    );
  },

  markReminder1hSent: (taskId) => {
    return run(`UPDATE tasks SET reminder_1h_sent = 1 WHERE task_id = ?`, [taskId]);
  },

  // งานที่กำหนดส่งวันนี้ (ข้ามวัน) แต่ยังไม่เตือนเช้า
  getTasksDueToday: () => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
    return queryAll(
      `SELECT * FROM tasks 
       WHERE deadline IS NOT NULL 
       AND deadline >= ? 
       AND deadline < ? 
       AND status = 'accepted'
       AND reminder_day_sent = 0
       AND DATE(accepted_at) < DATE(deadline)`,
      [startOfDay, endOfDay]
    );
  },

  markReminderDaySent: (taskId) => {
    return run(`UPDATE tasks SET reminder_day_sent = 1 WHERE task_id = ?`, [taskId]);
  },

  replyToTask: (taskId, replyMessage) => {
    return run(
      DATABASE_URL
        ? `UPDATE tasks SET status = 'submitted', reply_message = ?, replied_at = NOW(), updated_at = NOW() WHERE task_id = ?`
        : `UPDATE tasks SET status = 'submitted', reply_message = ?, replied_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE task_id = ?`,
      [replyMessage, taskId]
    );
  },

  approveTask: (taskId) => {
    return run(
      DATABASE_URL
        ? `UPDATE tasks SET status = 'completed', updated_at = NOW() WHERE task_id = ?`
        : `UPDATE tasks SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE task_id = ?`,
      [taskId]
    );
  },

  rejectTask: (taskId, reason) => {
    return run(
      DATABASE_URL
        ? `UPDATE tasks SET status = 'accepted', reject_reason = ?, reply_message = NULL, replied_at = NULL, updated_at = NOW() WHERE task_id = ?`
        : `UPDATE tasks SET status = 'accepted', reject_reason = ?, reply_message = NULL, replied_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE task_id = ?`,
      [reason, taskId]
    );
  },

  getAllTasksInGroup: (groupId, limit = 50) => {
    return queryAll(
      `SELECT * FROM tasks WHERE group_id = ? ORDER BY created_at DESC LIMIT ?`,
      [groupId, limit]
    );
  },

  saveMember: async (groupId, userId, displayName) => {
    if (DATABASE_URL) {
      return run(
        `INSERT INTO group_members (group_id, user_id, display_name)
         VALUES (?, ?, ?)
         ON CONFLICT (group_id, user_id) DO UPDATE SET display_name = ?`,
        [groupId, userId, displayName, displayName]
      );
    } else {
      return run(
        `INSERT OR REPLACE INTO group_members (group_id, user_id, display_name)
         VALUES (?, ?, ?)`,
        [groupId, userId, displayName]
      );
    }
  },

  getGroupMembers: (groupId) => {
    return queryAll(`SELECT * FROM group_members WHERE group_id = ?`, [groupId]);
  },

  // ดึงงานทั้งหมดในกลุ่ปเรียงตามวันที่สร้าง (เก่าสุดก่อน)
  getAllTasksChronological: (groupId) => {
    return queryAll(
      `SELECT * FROM tasks WHERE group_id = ? ORDER BY created_at ASC`,
      [groupId]
    );
  },

  // ─── Chat Logs ───
  saveChatLog: (groupId, userId, displayName, message) => {
    return run(
      `INSERT INTO chat_logs (group_id, user_id, display_name, message) VALUES (?, ?, ?, ?)`,
      [groupId, userId, displayName, message]
    );
  },

  // ดึงแชทในกลุ่มทั้งหมด เรียงจากเก่าสุด
  getChatLogsChronological: (groupId) => {
    return queryAll(
      `SELECT * FROM chat_logs WHERE group_id = ? ORDER BY created_at ASC`,
      [groupId]
    );
  },

  // ดึงแชทล่าสุด N ข้อความ (สำหรับบริบท AI)
  getRecentChatLogs: (groupId, limit = 20) => {
    return queryAll(
      `SELECT * FROM (
        SELECT * FROM chat_logs WHERE group_id = ? ORDER BY created_at DESC LIMIT ?
      ) sub ORDER BY created_at ASC`,
      [groupId, limit]
    );
  },

  // ดึงงานที่ยังไม่เสร็จทั้งหมดในกลุ่ม
  getAllPendingTasksInGroup: (groupId) => {
    return queryAll(
      `SELECT * FROM tasks WHERE group_id = ? AND status != 'completed' ORDER BY created_at DESC`,
      [groupId]
    );
  },

  // ─── Points System ───

  // เพิ่มแต้มให้ผู้ใช้
  addPoints: async (groupId, userId, displayName, points, taskId, reason) => {
    // upsert points record
    if (DATABASE_URL) {
      await run(
        `INSERT INTO points (group_id, user_id, display_name, total_points, updated_at)
         VALUES (?, ?, ?, ?, NOW())
         ON CONFLICT (group_id, user_id) DO UPDATE SET
           total_points = points.total_points + ?,
           display_name = ?,
           updated_at = NOW()`,
        [groupId, userId, displayName, points, points, displayName]
      );
    } else {
      const existing = await queryOne(`SELECT * FROM points WHERE group_id = ? AND user_id = ?`, [groupId, userId]);
      if (existing) {
        await run(`UPDATE points SET total_points = total_points + ?, display_name = ?, updated_at = CURRENT_TIMESTAMP WHERE group_id = ? AND user_id = ?`,
          [points, displayName, groupId, userId]);
      } else {
        await run(`INSERT INTO points (group_id, user_id, display_name, total_points) VALUES (?, ?, ?, ?)`,
          [groupId, userId, displayName, points]);
      }
    }
    // log
    await run(`INSERT INTO points_log (group_id, user_id, task_id, points, reason) VALUES (?, ?, ?, ?, ?)`,
      [groupId, userId, taskId, points, reason]);
  },

  // อัปเดตสถิติเมื่อทำงานเสร็จ
  recordTaskCompleted: async (groupId, userId, displayName, onTime) => {
    if (DATABASE_URL) {
      await run(
        `INSERT INTO points (group_id, user_id, display_name, tasks_completed, tasks_on_time, current_streak, best_streak, updated_at)
         VALUES (?, ?, ?, 1, ?, ?, ?, NOW())
         ON CONFLICT (group_id, user_id) DO UPDATE SET
           tasks_completed = points.tasks_completed + 1,
           tasks_on_time = points.tasks_on_time + ?,
           current_streak = CASE WHEN ? THEN points.current_streak + 1 ELSE 0 END,
           best_streak = GREATEST(points.best_streak, CASE WHEN ? THEN points.current_streak + 1 ELSE 0 END),
           display_name = ?,
           updated_at = NOW()`,
        [groupId, userId, displayName, onTime ? 1 : 0, onTime ? 1 : 0, onTime ? 1 : 0, onTime ? 1 : 0, onTime, onTime, displayName]
      );
    } else {
      const existing = await queryOne(`SELECT * FROM points WHERE group_id = ? AND user_id = ?`, [groupId, userId]);
      if (existing) {
        const newStreak = onTime ? existing.current_streak + 1 : 0;
        const bestStreak = Math.max(existing.best_streak, newStreak);
        await run(
          `UPDATE points SET tasks_completed = tasks_completed + 1, tasks_on_time = tasks_on_time + ?, current_streak = ?, best_streak = ?, display_name = ?, updated_at = CURRENT_TIMESTAMP WHERE group_id = ? AND user_id = ?`,
          [onTime ? 1 : 0, newStreak, bestStreak, displayName, groupId, userId]
        );
      } else {
        await run(
          `INSERT INTO points (group_id, user_id, display_name, tasks_completed, tasks_on_time, current_streak, best_streak) VALUES (?, ?, ?, 1, ?, ?, ?)`,
          [groupId, userId, displayName, onTime ? 1 : 0, onTime ? 1 : 0, onTime ? 1 : 0]
        );
      }
    }
  },

  // ดูแต้มของตัวเอง
  getPoints: (groupId, userId) => {
    return queryOne(`SELECT * FROM points WHERE group_id = ? AND user_id = ?`, [groupId, userId]);
  },

  // อันดับในกลุ่ม (Top 10)
  getLeaderboard: (groupId) => {
    return queryAll(
      `SELECT * FROM points WHERE group_id = ? AND total_points > 0 ORDER BY total_points DESC LIMIT 10`,
      [groupId]
    );
  },

  // ─── DM Support ───

  // ดึงงานของ user ข้ามทุกกลุ่ม (สำหรับ DM)
  getTasksByUserId: (userId, status = null) => {
    let sql = `SELECT * FROM tasks WHERE assignee_id = ?`;
    let params = [userId];
    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }
    sql += ` ORDER BY created_at DESC`;
    return queryAll(sql, params);
  },

  // ดึงงานที่ user สั่ง (สำหรับ review)
  getTasksByAssigner: (assignerId, status = null) => {
    let sql = `SELECT * FROM tasks WHERE assigner_id = ?`;
    let params = [assignerId];
    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }
    sql += ` ORDER BY created_at DESC`;
    return queryAll(sql, params);
  }
};

module.exports = { db, TaskDB, queryAll, queryOne };
