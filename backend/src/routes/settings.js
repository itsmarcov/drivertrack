const express = require('express');
const { queryAll, queryOne, run } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');
const { logActivity } = require('../logActivity');

const router = express.Router();

router.get('/', authenticate, authorize('admin', 'ops'), async (req, res) => {
  const rows = await queryAll('SELECT key, value FROM settings ORDER BY key');
  const obj = {};
  rows.forEach(r => { obj[r.key] = r.value; });
  res.json(obj);
});

router.put('/', authenticate, authorize('admin'), async (req, res) => {
  const allowed = ['morning_late_cutoff', 'morning_absent_cutoff', 'evening_late_cutoff', 'evening_absent_cutoff'];
  for (const [key, value] of Object.entries(req.body)) {
    if (!allowed.includes(key)) continue;
    if (!/^\d{2}:\d{2}:\d{2}$/.test(value)) {
      return res.status(400).json({ error: `Invalid time format for ${key}. Use HH:MM:SS.` });
    }
    await run('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()', [key, value]);
  }
  const rows = await queryAll('SELECT key, value FROM settings ORDER BY key');
  const obj = {};
  rows.forEach(r => { obj[r.key] = r.value; });
  logActivity(req.user, 'update_settings', 'settings', null, { updated: Object.keys(req.body) });
  res.json(obj);
});

module.exports = router;
