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
    console.log('Database tables initialized (SQLite)');
    // Migration
    db.run(`ALTER TABLE tasks ADD COLUMN deadline DATETIME`, () => {});
    db.run(`ALTER TABLE tasks ADD COLUMN reminder_sent INTEGER DEFAULT 0`, () => {});
    db.run(`ALTER TABLE tasks ADD COLUMN accepted_at DATETIME`, () => {});
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
       AND status != 'completed' 
       AND reminder_sent = 0`,
      [now]
    );
  },

  markReminderSent: (taskId) => {
    return run(`UPDATE tasks SET reminder_sent = 1 WHERE task_id = ?`, [taskId]);
  },

  replyToTask: (taskId, replyMessage) => {
    return run(
      DATABASE_URL
        ? `UPDATE tasks SET status = 'completed', reply_message = ?, replied_at = NOW(), updated_at = NOW() WHERE task_id = ?`
        : `UPDATE tasks SET status = 'completed', reply_message = ?, replied_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE task_id = ?`,
      [replyMessage, taskId]
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
  }
};

module.exports = { db, TaskDB };
