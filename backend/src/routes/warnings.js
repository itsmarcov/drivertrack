const express = require('express');
const { queryAll, queryOne, run } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  const { status, driver_id } = req.query;
  const params = []; let pIdx = 1;
  let sql = `SELECT w.id, w.driver_id, w.admin_id, w.title, w.content, w.status,
             w.signed_at, w.archived_at, w.created_at,
             u.full_name as driver_name, u.phone as driver_phone, u.license_plate,
             a.full_name as admin_name
             FROM warnings w
             JOIN users u ON w.driver_id = u.id
             JOIN users a ON w.admin_id = a.id
             WHERE 1=1`;
  if (req.user.role === 'driver') {
    sql += ` AND w.driver_id = $${pIdx++}`;
    params.push(req.user.id);
  }
  if (status) { sql += ` AND w.status = $${pIdx++}`; params.push(status); }
  if (driver_id && req.user.role !== 'driver') { sql += ` AND w.driver_id = $${pIdx++}`; params.push(parseInt(driver_id)); }
  sql += ' ORDER BY w.created_at DESC';
  res.json(await queryAll(sql, params));
});

router.get('/stats', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  const rows = await queryAll(
    `SELECT status, COUNT(*)::int as count FROM warnings GROUP BY status`
  );
  const stats = { pending: 0, signed: 0, archived: 0 };
  rows.forEach((r) => { stats[r.status] = r.count; });
  const total = await queryOne('SELECT COUNT(*)::int as count FROM warnings');
  res.json({ ...stats, total: total.count });
});

router.post('/', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  const { driver_id, title, content } = req.body;
  if (!driver_id || !title || !content) return res.status(400).json({ error: 'driver_id, title and content are required' });
  const result = await run(
    'INSERT INTO warnings (driver_id, admin_id, title, content) VALUES ($1, $2, $3, $4)',
    [parseInt(driver_id), req.user.id, title, content]
  );
  const warning = await queryOne('SELECT * FROM warnings WHERE id = $1', [result.lastInsertRowid]);
  res.status(201).json(warning);
});

router.get('/:id', authenticate, async (req, res) => {
  const warning = await queryOne(
    `SELECT w.*, u.full_name as driver_name, u.phone as driver_phone, u.license_plate,
            a.full_name as admin_name
     FROM warnings w
     JOIN users u ON w.driver_id = u.id
     JOIN users a ON w.admin_id = a.id
     WHERE w.id = $1`,
    [parseInt(req.params.id)]
  );
  if (!warning) return res.status(404).json({ error: 'Warning not found' });
  if (req.user.role === 'driver' && warning.driver_id !== req.user.id)
    return res.status(403).json({ error: 'Unauthorized' });
  res.json(warning);
});

router.patch('/:id/sign', authenticate, authorize('driver'), async (req, res) => {
  const warning = await queryOne('SELECT * FROM warnings WHERE id = $1', [parseInt(req.params.id)]);
  if (!warning) return res.status(404).json({ error: 'Warning not found' });
  if (warning.driver_id !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });
  if (warning.status !== 'pending') return res.status(400).json({ error: 'Warning already ' + warning.status });
  await run('UPDATE warnings SET status = $1, signed_at = NOW() WHERE id = $2', ['signed', warning.id]);
  res.json({ success: true });
});

router.patch('/:id/archive', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  const warning = await queryOne('SELECT * FROM warnings WHERE id = $1', [parseInt(req.params.id)]);
  if (!warning) return res.status(404).json({ error: 'Warning not found' });
  await run('UPDATE warnings SET status = $1, archived_at = NOW() WHERE id = $2', ['archived', warning.id]);
  res.json({ success: true });
});

router.patch('/:id/restore', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  const warning = await queryOne('SELECT * FROM warnings WHERE id = $1', [parseInt(req.params.id)]);
  if (!warning) return res.status(404).json({ error: 'Warning not found' });
  await run("UPDATE warnings SET status = 'pending', archived_at = NULL WHERE id = $1", [warning.id]);
  res.json({ success: true });
});

module.exports = router;
