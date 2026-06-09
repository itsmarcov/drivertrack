const express = require('express');
const bcrypt = require('bcryptjs');
const { queryAll, queryOne, run } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, authorize('admin', 'ops'), async (req, res) => {
  const drivers = await queryAll(
    `SELECT id, username, full_name, email, phone, vehicle_type, license_plate, is_active, created_at, updated_at
     FROM users WHERE role = 'driver' ORDER BY full_name ASC`
  );
  res.json(drivers);
});

router.get('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  if (req.user.role !== 'admin' && req.user.role !== 'ops' && req.user.id !== parseInt(id)) {
    return res.status(403).json({ error: 'Access denied.' });
  }
  const driver = await queryOne(
    `SELECT id, username, full_name, email, phone, vehicle_type, license_plate, is_active, created_at, updated_at
     FROM users WHERE id = $1 AND role = 'driver'`,
    [id]
  );
  if (!driver) return res.status(404).json({ error: 'Driver not found.' });
  res.json(driver);
});

router.post('/', authenticate, authorize('admin', 'ops'), async (req, res) => {
  const { username, password, full_name, email, phone, vehicle_type, license_plate } = req.body;
  if (!username || !password || !full_name) {
    return res.status(400).json({ error: 'Username, password, and full name are required.' });
  }
  const existing = await queryOne('SELECT id FROM users WHERE username = $1', [username]);
  if (existing) return res.status(409).json({ error: 'Username already exists.' });
  const hash = bcrypt.hashSync(password, 10);
  const result = await run(
    `INSERT INTO users (username, password_hash, role, full_name, email, phone, vehicle_type, license_plate)
     VALUES ($1, $2, 'driver', $3, $4, $5, $6, $7)`,
    [username, hash, full_name, email || null, phone || null, vehicle_type || null, license_plate || null]
  );
  const driver = await queryOne(
    'SELECT id, username, full_name, email, phone, vehicle_type, license_plate, is_active, created_at FROM users WHERE id = $1',
    [result.lastInsertRowid]
  );
  res.status(201).json(driver);
});

router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
  const { id } = req.params;
  const { full_name, email, phone, vehicle_type, license_plate, is_active, password } = req.body;
  const existing = await queryOne("SELECT id FROM users WHERE id = $1 AND role = 'driver'", [id]);
  if (!existing) return res.status(404).json({ error: 'Driver not found.' });

  const updates = [];
  const params = [];
  let paramIndex = 1;
  if (full_name !== undefined) { updates.push(`full_name = $${paramIndex++}`); params.push(full_name); }
  if (email !== undefined) { updates.push(`email = $${paramIndex++}`); params.push(email); }
  if (phone !== undefined) { updates.push(`phone = $${paramIndex++}`); params.push(phone); }
  if (vehicle_type !== undefined) { updates.push(`vehicle_type = $${paramIndex++}`); params.push(vehicle_type); }
  if (license_plate !== undefined) { updates.push(`license_plate = $${paramIndex++}`); params.push(license_plate); }
  if (is_active !== undefined) { updates.push(`is_active = $${paramIndex++}`); params.push(is_active); }
  if (password) { updates.push(`password_hash = $${paramIndex++}`); params.push(bcrypt.hashSync(password, 10)); }

  if (updates.length > 0) {
    updates.push(`updated_at = NOW()`);
    params.push(id);
    await run(`UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}`, params);
  }

  const driver = await queryOne(
    'SELECT id, username, full_name, email, phone, vehicle_type, license_plate, is_active, created_at, updated_at FROM users WHERE id = $1',
    [id]
  );
  res.json(driver);
});

router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  const { id } = req.params;
  const result = await run("DELETE FROM users WHERE id = $1 AND role = 'driver'", [id]);
  if (result.changes === 0) return res.status(404).json({ error: 'Driver not found.' });
  await run('DELETE FROM attendance WHERE driver_id = $1', [id]);
  res.json({ message: 'Driver deleted successfully.' });
});

module.exports = router;
