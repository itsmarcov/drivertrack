const express = require('express');
const { queryAll, queryOne } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');
const { generatePdf, penaltyHtml } = require('../pdf');

const router = express.Router();

router.get('/', authenticate, authorize('admin', 'ops'), async (req, res) => {
  const { date, driver_id, station_id } = req.query;
  let sql = `SELECT p.id, p.driver_id, p.attendance_id, p.penalty_date, p.reason, p.amount, p.created_at,
             u.full_name as driver_name, u.phone as driver_phone, u.station_id
             FROM penalties p JOIN users u ON p.driver_id = u.id WHERE 1=1`;
  const params = []; let pIdx = 1;
  if (date) { sql += ` AND p.penalty_date = $${pIdx++}`; params.push(date); }
  if (driver_id) { sql += ` AND p.driver_id = $${pIdx++}`; params.push(parseInt(driver_id)); }
  if (req.user.role === 'ops') { sql += ` AND u.station_id = $${pIdx++}`; params.push(req.user.station_id); }
  else if (station_id) { sql += ` AND u.station_id = $${pIdx++}`; params.push(parseInt(station_id)); }
  sql += ' ORDER BY p.created_at DESC';
  res.json(await queryAll(sql, params));
});

router.get('/stats', authenticate, authorize('admin', 'ops'), async (req, res) => {
  const today = new Date();
  const dateStr = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');
  let sql = 'SELECT COUNT(*) as count, COALESCE(SUM(amount),0) as total FROM penalties p JOIN users u ON p.driver_id = u.id WHERE p.penalty_date = $1';
  const params = [dateStr];
  if (req.user.role === 'ops' && req.user.station_id) { sql += ' AND u.station_id = $2'; params.push(req.user.station_id); }
  const stats = await queryOne(sql, params);
  res.json({ count: parseInt(stats.count), total: parseFloat(stats.total), date: dateStr });
});

router.get('/my', authenticate, authorize('driver'), async (req, res) => {
  res.json(await queryAll(
    `SELECT p.id, p.attendance_id, p.penalty_date, p.reason, p.amount, p.created_at
     FROM penalties p WHERE p.driver_id = $1 ORDER BY p.created_at DESC LIMIT 50`,
    [req.user.id]
  ));
});

router.get('/:id/report', authenticate, async (req, res) => {
  try {
    const penalty = await queryOne(
      `SELECT p.id, p.penalty_date, p.reason, p.amount, p.created_at, p.driver_id,
              u.full_name as driver_name, u.phone as driver_phone, u.license_plate,
              a.scan_time FROM penalties p JOIN users u ON p.driver_id = u.id
              LEFT JOIN attendance a ON p.attendance_id = a.id WHERE p.id = $1`,
      [parseInt(req.params.id)]
    );
      if (!penalty) return res.status(404).json({ error: 'Penalty not found' });
    if (req.user.role === 'driver' && penalty.driver_id !== req.user.id)
      return res.status(403).json({ error: 'Unauthorized' });

    const buf = await generatePdf(penaltyHtml(penalty));
    console.log('Penalty PDF generated: %d bytes, header=%s', buf.length, buf.slice(0, 5).toString());
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="penalty-${penalty.id}.pdf"`);
    res.setHeader('Content-Length', buf.length);
    res.end(buf);
  } catch (err) {
    console.error('PDF error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate report: ' + err.message });
  }
});

module.exports = router;
