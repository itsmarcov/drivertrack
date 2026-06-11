const express = require('express');
const { queryAll, queryOne } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, authorize('admin', 'ops'), async (req, res) => {
  const { date, driver_id } = req.query;
  let sql = `
    SELECT p.id, p.driver_id, p.attendance_id, p.penalty_date, p.reason, p.amount, p.paid, p.created_at,
           u.full_name as driver_name, u.phone as driver_phone
    FROM penalties p
    JOIN users u ON p.driver_id = u.id
    WHERE 1=1
  `;
  const params = [];
  let pIdx = 1;
  if (date) { sql += ` AND p.penalty_date = $${pIdx++}`; params.push(date); }
  if (driver_id) { sql += ` AND p.driver_id = $${pIdx++}`; params.push(parseInt(driver_id)); }
  if (req.user.role === 'ops' && req.user.station_id) {
    sql += ` AND u.station_id = $${pIdx++}`;
    params.push(req.user.station_id);
  }
  sql += ' ORDER BY p.created_at DESC';
  const penalties = await queryAll(sql, params);
  res.json(penalties);
});

router.get('/stats', authenticate, authorize('admin', 'ops'), async (req, res) => {
  const today = new Date();
  const dateStr = today.getFullYear() + '-' +
    String(today.getMonth() + 1).padStart(2, '0') + '-' +
    String(today.getDate()).padStart(2, '0');

  let sql = 'SELECT COUNT(*) as count, COALESCE(SUM(amount),0) as total FROM penalties WHERE penalty_date = $1';
  const params = [dateStr];
  if (req.user.role === 'ops' && req.user.station_id) {
    sql += ' AND driver_id IN (SELECT id FROM users WHERE station_id = $2)';
    params.push(req.user.station_id);
  }
  const stats = await queryOne(sql, params);
  res.json({
    count: parseInt(stats.count),
    total: parseFloat(stats.total),
    date: dateStr,
  });
});

router.get('/my', authenticate, authorize('driver'), async (req, res) => {
  const penalties = await queryAll(
    `SELECT p.id, p.attendance_id, p.penalty_date, p.reason, p.amount, p.paid, p.created_at
     FROM penalties p
     WHERE p.driver_id = $1
     ORDER BY p.created_at DESC
     LIMIT 50`,
    [req.user.id]
  );
  res.json(penalties);
});

router.put('/:id/pay', authenticate, authorize('admin'), async (req, res) => {
  const { id } = req.params;
  const penalty = await queryOne('SELECT * FROM penalties WHERE id = $1', [id]);
  if (!penalty) return res.status(404).json({ error: 'Penalty not found.' });
  await run('UPDATE penalties SET paid = $1 WHERE id = $2', [penalty.paid ? 0 : 1, id]);
  const updated = await queryOne('SELECT * FROM penalties WHERE id = $1', [id]);
  res.json(updated);
});

module.exports = router;
