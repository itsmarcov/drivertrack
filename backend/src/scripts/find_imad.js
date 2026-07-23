const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const { Pool } = require('pg');

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
  });
  const result = await pool.query("SELECT id, username, full_name, wilaya_code, wilaya_name, address_line FROM users WHERE LOWER(username) LIKE '%imad%'");
  console.log(JSON.stringify(result.rows, null, 2));
  await pool.end();
})();