import pg from 'pg';
import { config } from 'dotenv';
config({ path: new URL('../../.env', import.meta.url) });
const c = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
});
try {
  await c.connect();
  const r = await c.query(
    "UPDATE users SET wilaya_code=NULL, wilaya_name=NULL, commune_code=NULL, commune_name=NULL, address_line=NULL, latitude=NULL, longitude=NULL WHERE full_name='Test driver' RETURNING id, username, full_name"
  );
  console.log(r.rows);
  await c.end();
} catch (e) {
  console.error('Error:', e.message || e.code || JSON.stringify(e));
  process.exit(1);
}