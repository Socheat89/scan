const mysql = require('mysql2/promise');

let pool;

// Helper: check if a column exists in a table
async function columnExists(tableName, columnName) {
  const [[row]] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );
  return row.cnt > 0;
}

async function initializeDatabase() {
  const DB = process.env.DB_NAME || 'mekongcy_attendance_system';
  const autoCreateDb = String(process.env.DB_AUTO_CREATE ?? 'true').toLowerCase() === 'true';

  if (autoCreateDb) {
    const rootConn = await mysql.createConnection({
      host:     process.env.DB_HOST     || 's12904.sgp1.stableserver.net',
      port:     parseInt(process.env.DB_PORT || '3306'),
      user:     process.env.DB_USER     || 'mekongcy',
      password: process.env.DB_PASSWORD || 'Socheat!@#$2026'
    });

    try {
      await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${DB}\``);
    } catch (err) {
      console.warn(
        `Warning: could not auto-create database "${DB}". ` +
        `Create it manually (e.g. in cPanel) or set DB_AUTO_CREATE=false.`,
        err?.code ? `(${err.code})` : err
      );
    } finally {
      await rootConn.end();
    }
  }

  pool = mysql.createPool({
    host:               process.env.DB_HOST     || 'localhost',
    port:               parseInt(process.env.DB_PORT || '3306'),
    user:               process.env.DB_USER     || 'root',
    password:           process.env.DB_PASSWORD || '',
    database:           DB,
    waitForConnections: true,
    connectionLimit:    10
  });

  await pool.query(`CREATE TABLE IF NOT EXISTS branches (
    id         INT          NOT NULL AUTO_INCREMENT,
    name       VARCHAR(150) NOT NULL,
    location   VARCHAR(255) NOT NULL,
    qr_secret  VARCHAR(100) NOT NULL,
    created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
  ) ENGINE=InnoDB`);

  // ── Work Schedules ────────────────────────────────────────────────────────
  await pool.query(`CREATE TABLE IF NOT EXISTS work_schedules (
    id                INT          NOT NULL AUTO_INCREMENT,
    name              VARCHAR(150) NOT NULL,
    work_start_time   TIME         NOT NULL,
    lunch_start_time  TIME,
    lunch_end_time    TIME,
    work_end_time     TIME         NOT NULL,
    created_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
  ) ENGINE=InnoDB`);

  // Seed a default schedule if none exists
  const [[schedCount]] = await pool.query(`SELECT COUNT(*) AS cnt FROM work_schedules`);
  if (schedCount.cnt === 0) {
    await pool.query(
      `INSERT INTO work_schedules (name, work_start_time, lunch_start_time, lunch_end_time, work_end_time)
       VALUES (?, ?, ?, ?, ?)`,
      ['Default Shift (09:00–18:00)', '09:00:00', '12:00:00', '13:00:00', '18:00:00']
    );
    console.log('Default work schedule created: Default Shift (09:00–18:00)');
  }

  // ── Users ─────────────────────────────────────────────────────────────────
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id             INT          NOT NULL AUTO_INCREMENT,
    name           VARCHAR(150) NOT NULL,
    email          VARCHAR(150) NOT NULL UNIQUE,
    password       VARCHAR(255) NOT NULL,
    role           ENUM('admin','employee') NOT NULL DEFAULT 'employee',
    branch_id      INT,
    schedule_id    INT,
    monthly_salary DECIMAL(10,2) DEFAULT 0,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (branch_id)   REFERENCES branches(id)       ON DELETE SET NULL,
    FOREIGN KEY (schedule_id) REFERENCES work_schedules(id) ON DELETE SET NULL
  ) ENGINE=InnoDB`);

  // Migrations for existing users table
  if (!(await columnExists('users', 'schedule_id'))) {
    await pool.query(`ALTER TABLE users ADD COLUMN schedule_id INT AFTER branch_id`);
    await pool.query(`ALTER TABLE users ADD CONSTRAINT fk_users_schedule
                      FOREIGN KEY (schedule_id) REFERENCES work_schedules(id) ON DELETE SET NULL`);
    // Assign default schedule to all existing users lacking one
    const [[defaultSched]] = await pool.query(`SELECT id FROM work_schedules ORDER BY id LIMIT 1`);
    if (defaultSched) {
      await pool.query(`UPDATE users SET schedule_id = ? WHERE schedule_id IS NULL`, [defaultSched.id]);
    }
    console.log('Migration: schedule_id column added to users and backfilled.');
  }
  if (!(await columnExists('users', 'monthly_salary'))) {
    await pool.query(`ALTER TABLE users ADD COLUMN monthly_salary DECIMAL(10,2) DEFAULT 0 AFTER schedule_id`);
    console.log('Migration: monthly_salary column added to users.');
  }

  await pool.query(`CREATE TABLE IF NOT EXISTS attendance (
    id               INT  NOT NULL AUTO_INCREMENT,
    user_id          INT  NOT NULL,
    branch_id        INT  NOT NULL,
    date             DATE NOT NULL,
    check_in         TIME,
    break_out        TIME,
    break_in         TIME,
    check_out        TIME,
    total_hours      DECIMAL(5,2) DEFAULT 0,
    late_minutes     INT          DEFAULT 0,
    overtime_minutes INT          DEFAULT 0,
    status           ENUM('present','absent','late') DEFAULT 'absent',
    PRIMARY KEY (id),
    UNIQUE KEY uq_user_date (user_id, date),
    FOREIGN KEY (user_id)   REFERENCES users(id)    ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`);

  await pool.query(`CREATE TABLE IF NOT EXISTS settings (
    id            INT         NOT NULL AUTO_INCREMENT,
    config_key    VARCHAR(50) NOT NULL UNIQUE,
    config_value  VARCHAR(50) NOT NULL,
    PRIMARY KEY (id)
  ) ENGINE=InnoDB`);

  // ── User Schedule History (optional/advanced) ─────────────────────────────
  await pool.query(`CREATE TABLE IF NOT EXISTS user_schedule_history (
    id             INT  NOT NULL AUTO_INCREMENT,
    user_id        INT  NOT NULL,
    schedule_id    INT  NOT NULL,
    effective_from DATE NOT NULL,
    effective_to   DATE,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (user_id)     REFERENCES users(id)          ON DELETE CASCADE,
    FOREIGN KEY (schedule_id) REFERENCES work_schedules(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`);

  // ── GPS Security Logs ─────────────────────────────────────────────────────
  await pool.query(`CREATE TABLE IF NOT EXISTS gps_security_logs (
    id         INT           NOT NULL AUTO_INCREMENT,
    user_id    INT           NOT NULL,
    latitude   DOUBLE,
    longitude  DOUBLE,
    accuracy   DOUBLE,
    speed      DOUBLE,
    altitude   DOUBLE,
    heading    DOUBLE,
    is_mocked  TINYINT(1)    DEFAULT 0,
    risk_level ENUM('low','medium','high') NOT NULL DEFAULT 'low',
    reason     VARCHAR(255),
    created_at TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`);

  // ── Face Verification Logs ────────────────────────────────────────────────
  await pool.query(`CREATE TABLE IF NOT EXISTS face_verification_logs (
    id               INT           NOT NULL AUTO_INCREMENT,
    user_id          INT           NOT NULL,
    similarity_score DOUBLE,
    status           ENUM('pass','fail','no_template') NOT NULL,
    created_at       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`);

  // ── Branch IP Whitelist ───────────────────────────────────────────────────
  await pool.query(`CREATE TABLE IF NOT EXISTS branch_ip_whitelist (
    id                   INT          NOT NULL AUTO_INCREMENT,
    branch_id            INT          NOT NULL,
    ip_address_or_range  VARCHAR(50)  NOT NULL,
    created_at           TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`);

  // ── System Security Settings ──────────────────────────────────────────────
  await pool.query(`CREATE TABLE IF NOT EXISTS system_security_settings (
    \`key\`      VARCHAR(100) NOT NULL,
    \`value\`    VARCHAR(255) NOT NULL,
    updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`key\`)
  ) ENGINE=InnoDB`);

  // Face columns migration
  if (!(await columnExists('users', 'face_registered'))) {
    await pool.query(`ALTER TABLE users ADD COLUMN face_registered TINYINT(1) DEFAULT 0 AFTER monthly_salary`);
    console.log('Migration: face_registered column added to users.');
  }
  if (!(await columnExists('users', 'face_embedding'))) {
    await pool.query(`ALTER TABLE users ADD COLUMN face_embedding LONGTEXT AFTER face_registered`);
    console.log('Migration: face_embedding column added to users.');
  }

  const defaults = [['work_start_time','09:00'],['work_end_time','18:00'],['break_duration','60'],['grace_period','15']];
  for (const [k, v] of defaults) {
    await pool.query(`INSERT IGNORE INTO settings (config_key, config_value) VALUES (?, ?)`, [k, v]);
  }

  // Security setting defaults
  const secDefaults = [
    ['anti_gps_spoof_enabled',   'true'],
    ['max_gps_accuracy',         '50'],
    ['face_verification_enabled','false'],
    ['face_similarity_threshold','0.6'],
    ['ip_restriction_enabled',   'false'],
  ];
  for (const [k, v] of secDefaults) {
    await pool.query(
      'INSERT IGNORE INTO system_security_settings (`key`, `value`) VALUES (?, ?)', [k, v]
    );
  }

  const bcrypt = require('bcryptjs');
  const [[adminRow]] = await pool.query(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`);
  if (!adminRow) {
    const hash = await bcrypt.hash('admin123', 10);
    // Admin doesn't need a schedule; leave schedule_id NULL for admin role
    await pool.query(`INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'admin')`, ['Administrator', 'admin@admin.com', hash]);
    console.log('Default admin created: admin@admin.com / admin123');
  }

  console.log(`Database "${DB}" initialised.`);
}

function getPool() {
  if (!pool) throw new Error('Database not initialised');
  return pool;
}

module.exports = { initializeDatabase, getPool };
