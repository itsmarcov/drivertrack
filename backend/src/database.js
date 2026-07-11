const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required for PostgreSQL.');
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
  max: 3,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
});

async function initDatabase() {
  const fs = require('fs');
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(schema);
  try {
    await pool.query('ALTER TABLE attendance ADD COLUMN IF NOT EXISTS is_late INTEGER DEFAULT 0');
    await pool.query('ALTER TABLE attendance ADD COLUMN IF NOT EXISTS lat DECIMAL(10,7)');
    await pool.query('ALTER TABLE attendance ADD COLUMN IF NOT EXISTS lng DECIMAL(10,7)');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS station_id INTEGER REFERENCES stations(id)');
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS shift VARCHAR(20) DEFAULT 'morning'");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 0");
    await pool.query("ALTER TABLE penalties ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'");
    await pool.query("ALTER TABLE penalties ADD COLUMN IF NOT EXISTS admin_note TEXT");
    await pool.query(`CREATE TABLE IF NOT EXISTS justifications (
      id SERIAL PRIMARY KEY,
      driver_id INTEGER NOT NULL REFERENCES users(id),
      attendance_date VARCHAR(20) NOT NULL,
      reason VARCHAR(50) NOT NULL,
      note TEXT,
      proof_file VARCHAR(255),
      status VARCHAR(20) DEFAULT 'pending',
      admin_note TEXT,
      reviewed_by INTEGER REFERENCES users(id),
      reviewed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(driver_id, attendance_date)
    )`);
    await pool.query("ALTER TABLE justifications ADD COLUMN IF NOT EXISTS proof_file VARCHAR(255)");
    await pool.query("ALTER TABLE justifications ADD COLUMN IF NOT EXISTS note TEXT");
    await pool.query("ALTER TABLE justifications ADD COLUMN IF NOT EXISTS admin_note TEXT");
    await pool.query("ALTER TABLE justifications ADD COLUMN IF NOT EXISTS reviewed_by INTEGER REFERENCES users(id)");
    await pool.query("ALTER TABLE justifications ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP");
    await pool.query("ALTER TABLE justifications DROP CONSTRAINT IF EXISTS justifications_reason_check");
    await pool.query("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check");
    await pool.query("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK(role IN ('super_admin', 'admin', 'ops', 'driver'))");
    await pool.query("ALTER TABLE attendance ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'qr'");
    await pool.query("ALTER TABLE attendance ADD COLUMN IF NOT EXISTS late_reason TEXT");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active INTEGER DEFAULT 1");
    await pool.query("UPDATE users SET is_active = 1 WHERE is_active IS NULL");
    await pool.query("ALTER TABLE justifications ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP");
    await pool.query(`CREATE TABLE IF NOT EXISTS absence_requests (
      id SERIAL PRIMARY KEY,
      driver_id INTEGER NOT NULL REFERENCES users(id),
      date_from VARCHAR(20) NOT NULL,
      date_to VARCHAR(20) NOT NULL,
      reason VARCHAR(255) NOT NULL,
      note TEXT,
      status VARCHAR(20) DEFAULT 'pending',
      reviewed_by INTEGER REFERENCES users(id),
      reviewed_at TIMESTAMP,
      admin_note TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS activity_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      user_name VARCHAR(255),
      user_role VARCHAR(20),
      action VARCHAR(50) NOT NULL,
      entity_type VARCHAR(50),
      entity_id INTEGER,
      details TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )`);
    await pool.query("CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_activity_logs_entity_type ON activity_logs(entity_type)");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS wilaya_code INTEGER");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS wilaya_name VARCHAR(100)");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS commune_code INTEGER");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS commune_name VARCHAR(100)");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS address_line TEXT");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,7)");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS longitude DECIMAL(10,7)");
  } catch {}
  return pool;
}

async function queryAll(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

async function queryOne(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows.length > 0 ? result.rows[0] : null;
}

async function run(sql, params = []) {
  let finalSql = sql;
  if (sql.trim().toUpperCase().startsWith('INSERT') && !sql.toUpperCase().includes('RETURNING')) {
    finalSql = sql + ' RETURNING id';
  }
  const result = await pool.query(finalSql, params);
  return {
    changes: result.rowCount,
    lastInsertRowid: result.rows[0]?.id || null,
  };
}

async function closeDatabase() {
  await pool.end();
}

module.exports = { initDatabase, queryAll, queryOne, run, closeDatabase, pool };
