const express = require('express');
const { queryAll, queryOne } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, authorize('admin', 'ops'), async (req, res) => {
  const { date, driver_id } = req.query;
  let sql = `
    SELECT a.id, a.driver_id, a.scanned_by, a.scan_date, a.scan_time, a.verified, a.created_at,
           u.full_name as driver_name, u.phone as driver_phone, u.license_plate,
           s.full_name as scanned_by_name
    FROM attendance a
    JOIN users u ON a.driver_id = u.id
    JOIN users s ON a.scanned_by = s.id
    WHERE 1=1
  `;
  const params = [];
  let paramIndex = 1;
  if (date) { sql += ` AND a.scan_date = $${paramIndex++}`; params.push(date); }
  if (driver_id) { sql += ` AND a.driver_id = $${paramIndex++}`; params.push(parseInt(driver_id)); }
  sql += ' ORDER BY a.created_at DESC';
  const records = await queryAll(sql, params);
  res.json(records);
});

router.get('/my', authenticate, authorize('driver'), async (req, res) => {
  const records = await queryAll(
    `SELECT a.id, a.scan_date, a.scan_time, a.verified, a.created_at,
            s.full_name as scanned_by_name
     FROM attendance a
     JOIN users s ON a.scanned_by = s.id
     WHERE a.driver_id = $1
     ORDER BY a.created_at DESC
     LIMIT 50`,
    [req.user.id]
  );
  res.json(records);
});

router.get('/stats', authenticate, authorize('admin', 'ops'), async (req, res) => {
  const today = new Date();
  const dateStr = today.getFullYear() + '-' +
    String(today.getMonth() + 1).padStart(2, '0') + '-' +
    String(today.getDate()).padStart(2, '0');

  const total = await queryOne("SELECT COUNT(*) as count FROM users WHERE role = 'driver' AND is_active = 1");
  const present = await queryOne(
    'SELECT COUNT(DISTINCT driver_id) as count FROM attendance WHERE scan_date = $1',
    [dateStr]
  );

  res.json({
    total_drivers: parseInt(total.count),
    present_today: parseInt(present.count),
    date: dateStr,
  });
});

module.exports = router;
