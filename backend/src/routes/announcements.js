const express = require('express');
const { queryAll, queryOne, run } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');
const { logActivity } = require('../logActivity');

const router = express.Router();

router.get('/', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  const rows = await queryAll(`SELECT a.*,
    COALESCE((SELECT json_agg(json_build_object('id', u.id, 'full_name', u.full_name, 'read_at', ar.read_at))
      FROM announcement_reads ar JOIN users u ON u.id = ar.driver_id WHERE ar.announcement_id = a.id), '[]')::json AS readers,
    (SELECT COUNT(*) FROM announcement_reads WHERE announcement_id = a.id) AS readers_count
    FROM announcements a ORDER BY a.created_at DESC`);
  res.json(rows);
});

router.get('/active', authenticate, async (req, res) => {
  const now = new Date().toISOString();
  const userId = req.user.id;
  const user = await queryOne('SELECT role, station_id FROM users WHERE id = $1', [userId]);
  if (!user || user.role !== 'driver') return res.json([]);
  const rows = await queryAll(`SELECT a.*,
    (SELECT COUNT(*) FROM announcement_reads WHERE announcement_id = a.id) AS readers_count
    FROM announcements a
    WHERE a.is_active = 1
      AND (a.starts_at IS NULL OR a.starts_at <= $1::timestamp)
      AND (a.expires_at IS NULL OR a.expires_at >= $1::timestamp)
    ORDER BY a.priority DESC, a.created_at DESC`, [now]);
  const filtered = rows.filter((a) => {
    if (a.audience_type === 'all') return true;
    if (a.audience_type === 'drivers') {
      if (!a.driver_ids) return false;
      const ids = a.driver_ids.split(',').map((s) => parseInt(s.trim()));
      return ids.includes(userId);
    }
    if (a.audience_type === 'stations') {
      if (!a.station_ids || !user.station_id) return false;
      const ids = a.station_ids.split(',').map((s) => parseInt(s.trim()));
      return ids.includes(user.station_id);
    }
    return false;
  });
  const readIds = await queryAll(
    'SELECT announcement_id FROM announcement_reads WHERE driver_id = $1',
    [userId]
  );
  const readSet = new Set(readIds.map((r) => r.announcement_id));
  const result = filtered.map((a) => ({ ...a, is_read: readSet.has(a.id) }));
  res.json(result);
});

router.post('/:id/read', authenticate, async (req, res) => {
  const userId = req.user.id;
  const user = await queryOne('SELECT role FROM users WHERE id = $1', [userId]);
  if (!user || user.role !== 'driver') return res.status(403).json({ error: 'Forbidden' });
  const announcement = await queryOne('SELECT id FROM announcements WHERE id = $1', [req.params.id]);
  if (!announcement) return res.status(404).json({ error: 'Announcement not found' });
  await run(
    'INSERT INTO announcement_reads (announcement_id, driver_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [req.params.id, userId]
  );
  res.json({ success: true });
});

router.get('/:id/readers', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  const rows = await queryAll(
    `SELECT ar.driver_id, u.full_name, u.username, ar.read_at
     FROM announcement_reads ar JOIN users u ON u.id = ar.driver_id
     WHERE ar.announcement_id = $1 ORDER BY ar.read_at`,
    [req.params.id]
  );
  res.json(rows);
});

router.post('/', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  const { message, priority, audience_type, station_ids, driver_ids, starts_at, expires_at } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ error: 'الرجاء كتابة الرسالة' });
  const result = await run(`INSERT INTO announcements (message, priority, audience_type, station_ids, driver_ids, starts_at, expires_at, created_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [message.trim(), priority || 'normal', audience_type || 'all', station_ids || null, driver_ids || null, starts_at || null, expires_at || null, req.user.id]);
  logActivity(req.user, 'create_announcement', 'announcement', result.lastInsertRowid, { message: message.trim(), priority });
  const row = await queryOne('SELECT * FROM announcements WHERE id = $1', [result.lastInsertRowid]);
  res.status(201).json(row);
});

router.put('/:id', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  const { message, priority, audience_type, station_ids, driver_ids, starts_at, expires_at, is_active } = req.body;
  const existing = await queryOne('SELECT * FROM announcements WHERE id = $1', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'الإعلان غير موجود' });
  await run(`UPDATE announcements SET message = COALESCE($1, message), priority = COALESCE($2, priority),
    audience_type = COALESCE($3, audience_type), station_ids = COALESCE($4, station_ids),
    driver_ids = COALESCE($5, driver_ids), starts_at = COALESCE($6, starts_at),
    expires_at = COALESCE($7, expires_at), is_active = COALESCE($8, is_active),
    updated_at = NOW() WHERE id = $9`,
    [message || null, priority || null, audience_type || null, station_ids || null, driver_ids || null, starts_at || null, expires_at || null, is_active != null ? (is_active ? 1 : 0) : null, req.params.id]);
  logActivity(req.user, 'update_announcement', 'announcement', parseInt(req.params.id), {});
  const row = await queryOne('SELECT * FROM announcements WHERE id = $1', [req.params.id]);
  res.json(row);
});

router.delete('/:id', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  const existing = await queryOne('SELECT * FROM announcements WHERE id = $1', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'الإعلان غير موجود' });
  await run('DELETE FROM announcements WHERE id = $1', [req.params.id]);
  logActivity(req.user, 'delete_announcement', 'announcement', parseInt(req.params.id), {});
  res.json({ success: true });
});

module.exports = router;