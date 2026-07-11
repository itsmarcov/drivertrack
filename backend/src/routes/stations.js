const express = require('express');
const { queryAll, queryOne, run } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');
const { logActivity } = require('../logActivity');

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  const stations = await queryAll('SELECT id, name, code, created_at FROM stations ORDER BY name ASC');
  res.json(stations);
});

router.get('/public', async (req, res) => {
  const stations = await queryAll('SELECT id, name FROM stations ORDER BY name ASC');
  res.json(stations);
});

router.post('/', authenticate, authorize('admin'), async (req, res) => {
  const { name, code } = req.body;
  if (!name || !code) return res.status(400).json({ error: 'Name and code are required.' });
  const existing = await queryOne('SELECT id FROM stations WHERE code = $1', [code]);
  if (existing) return res.status(409).json({ error: 'Station code already exists.' });
  const result = await run('INSERT INTO stations (name, code) VALUES ($1, $2)', [name, code]);
  const station = await queryOne('SELECT * FROM stations WHERE id = $1', [result.lastInsertRowid]);
  logActivity(req.user, 'create_station', 'station', station.id, { name: station.name, code: station.code });
  res.status(201).json(station);
});

router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
  const { id } = req.params;
  const { name, code } = req.body;
  const station = await queryOne('SELECT * FROM stations WHERE id = $1', [id]);
  if (!station) return res.status(404).json({ error: 'Station not found.' });
  const newName = name || station.name;
  const newCode = code || station.code;
  if (code && code !== station.code) {
    const dup = await queryOne('SELECT id FROM stations WHERE code = $1 AND id != $2', [code, id]);
    if (dup) return res.status(409).json({ error: 'Station code already exists.' });
  }
  await run('UPDATE stations SET name = $1, code = $2 WHERE id = $3', [newName, newCode, id]);
  const updated = await queryOne('SELECT * FROM stations WHERE id = $1', [id]);
  logActivity(req.user, 'update_station', 'station', Number(id), { name: newName, code: newCode });
  res.json(updated);
});

router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  const { id } = req.params;
  const usersWithStation = await queryOne('SELECT COUNT(*) as count FROM users WHERE station_id = $1', [id]);
  if (parseInt(usersWithStation.count) > 0) {
    return res.status(400).json({ error: 'Cannot delete station with assigned users. Reassign users first.' });
  }
  const result = await run('DELETE FROM stations WHERE id = $1', [id]);
  if (result.changes === 0) return res.status(404).json({ error: 'Station not found.' });
  logActivity(req.user, 'delete_station', 'station', Number(id));
  res.json({ message: 'Station deleted successfully.' });
});

module.exports = router;
