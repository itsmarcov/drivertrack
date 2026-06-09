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
  max: 10,
  idleTimeoutMillis: 30000,
});

async function initDatabase() {
  const fs = require('fs');
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(schema);
  try {
    await pool.query('ALTER TABLE attendance ADD COLUMN IF NOT EXISTS is_late INTEGER DEFAULT 0');
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
