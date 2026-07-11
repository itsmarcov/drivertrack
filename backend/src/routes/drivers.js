const express = require('express');
const bcrypt = require('bcryptjs');
const { queryAll, queryOne, run } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');
const { logActivity } = require('../logActivity');

const router = express.Router();

router.get('/', authenticate, authorize('admin', 'ops'), async (req, res) => {
  const { station_id, shift, search } = req.query;
  let sql = `SELECT u.id, u.username, u.full_name, u.email, u.phone, u.vehicle_type, u.license_plate,
                    u.station_id, u.shift, u.is_active, u.created_at, u.updated_at,
                    s.name as station_name,
                    u.wilaya_code, u.wilaya_name, u.commune_code, u.commune_name, u.latitude, u.longitude
             FROM users u
             LEFT JOIN stations s ON u.station_id = s.id
             WHERE u.role = 'driver'`;
  const params = [];
  let paramIndex = 1;
  if (req.user.role === 'ops') {
    sql += ` AND u.station_id = $${paramIndex++}`;
    params.push(req.user.station_id);
  } else if (station_id) {
    sql += ` AND u.station_id = $${paramIndex++}`;
    params.push(parseInt(station_id));
  }
  if (shift) {
    sql += ` AND u.shift = $${paramIndex++}`;
    params.push(shift);
  }
  if (search) {
    sql += ` AND (u.full_name ILIKE $${paramIndex} OR u.username ILIKE $${paramIndex} OR u.phone ILIKE $${paramIndex})`;
    params.push(`%${search}%`);
    paramIndex++;
  }
  sql += ' ORDER BY u.full_name ASC';
  const drivers = await queryAll(sql, params);
  res.json(drivers);
});

router.get('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  if (req.user.role !== 'admin' && req.user.role !== 'ops' && req.user.id !== parseInt(id)) {
    return res.status(403).json({ error: 'Access denied.' });
  }
  const driver = await queryOne(
    `SELECT id, username, full_name, email, phone, vehicle_type, license_plate, station_id, shift, is_active, created_at, updated_at,
            wilaya_code, wilaya_name, commune_code, commune_name, address_line, latitude, longitude
     FROM users WHERE id = $1 AND role = 'driver'`,
    [id]
  );
  if (!driver) return res.status(404).json({ error: 'Driver not found.' });
  res.json(driver);
});

router.post('/', authenticate, authorize('admin', 'ops'), async (req, res) => {
  const { username, password, full_name, email, phone, vehicle_type, license_plate, station_id, shift } = req.body;
  if (!username || !password || !full_name) {
    return res.status(400).json({ error: 'Username, password, and full name are required.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  let driverStationId = station_id || null;
  if (req.user.role === 'ops') {
    driverStationId = req.user.station_id;
    if (!driverStationId) return res.status(400).json({ error: 'No station assigned to your account.' });
  }
  if (driverStationId) {
    const station = await queryOne('SELECT id FROM stations WHERE id = $1', [driverStationId]);
    if (!station) return res.status(400).json({ error: 'Invalid station.' });
  }
  const existing = await queryOne('SELECT id FROM users WHERE username = $1', [username]);
  if (existing) return res.status(409).json({ error: 'Username already exists.' });
  const hash = bcrypt.hashSync(password, 10);
  const result = await run(
    `INSERT INTO users (username, password_hash, role, full_name, email, phone, vehicle_type, license_plate, station_id, shift)
     VALUES ($1, $2, 'driver', $3, $4, $5, $6, $7, $8, $9)`,
    [username, hash, full_name, email || null, phone || null, vehicle_type || null, license_plate || null, driverStationId, shift || 'morning']
  );
  const driver = await queryOne(
    'SELECT id, username, full_name, email, phone, vehicle_type, license_plate, station_id, shift, is_active, created_at FROM users WHERE id = $1',
    [result.lastInsertRowid]
  );
  logActivity(req.user, 'create_driver', 'driver', driver.id, { full_name: driver.full_name });
  res.status(201).json(driver);
});

router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
  const { id } = req.params;
  const { full_name, email, phone, vehicle_type, license_plate, station_id, shift, is_active, password } = req.body;
  const existing = await queryOne("SELECT id, full_name FROM users WHERE id = $1 AND role = 'driver'", [id]);
  if (!existing) return res.status(404).json({ error: 'Driver not found.' });

  const updates = [];
  const params = [];
  let paramIndex = 1;
  if (full_name !== undefined) { updates.push(`full_name = $${paramIndex++}`); params.push(full_name); }
  if (email !== undefined) { updates.push(`email = $${paramIndex++}`); params.push(email); }
  if (phone !== undefined) { updates.push(`phone = $${paramIndex++}`); params.push(phone); }
  if (vehicle_type !== undefined) { updates.push(`vehicle_type = $${paramIndex++}`); params.push(vehicle_type); }
  if (license_plate !== undefined) { updates.push(`license_plate = $${paramIndex++}`); params.push(license_plate); }
  if (station_id !== undefined) { updates.push(`station_id = $${paramIndex++}`); params.push(station_id); }
  if (is_active !== undefined) { updates.push(`is_active = $${paramIndex++}`); params.push(is_active); }
  if (shift !== undefined) { updates.push(`shift = $${paramIndex++}`); params.push(shift); }
  if (password) {
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    const hash = bcrypt.hashSync(password, 10);
    updates.push(`password_hash = $${paramIndex++}`);
    params.push(hash);
    updates.push(`token_version = COALESCE(token_version, 0) + 1`);
  }

  if (updates.length > 0) {
    updates.push(`updated_at = NOW()`);
    params.push(id);
    await run(`UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}`, params);
  }

  const driver = await queryOne(
    `SELECT id, username, full_name, email, phone, vehicle_type, license_plate, station_id, shift, is_active, created_at, updated_at,
            wilaya_code, wilaya_name, commune_code, commune_name, address_line, latitude, longitude FROM users WHERE id = $1`,
    [id]
  );
  logActivity(req.user, 'update_driver', 'driver', Number(id), { full_name: existing.full_name, updates: Object.keys(req.body) });
  res.json(driver);
});

router.get('/:id/address', authenticate, async (req, res) => {
  const { id } = req.params;
  if (req.user.role !== 'admin' && req.user.role !== 'ops' && req.user.role !== 'super_admin' && req.user.id !== parseInt(id)) {
    return res.status(403).json({ error: 'Access denied.' });
  }
  const addr = await queryOne(
    `SELECT wilaya_code, wilaya_name, commune_code, commune_name, address_line, latitude, longitude
     FROM users WHERE id = $1`,
    [id]
  );
  if (!addr) return res.status(404).json({ error: 'User not found.' });
  res.json(addr);
});

router.patch('/:id/address', authenticate, async (req, res) => {
  const { id } = req.params;
  if (req.user.role !== 'admin' && req.user.role !== 'ops' && req.user.role !== 'super_admin' && req.user.id !== parseInt(id)) {
    return res.status(403).json({ error: 'Access denied.' });
  }
  const { wilaya_code, wilaya_name, commune_code, commune_name, address_line, latitude, longitude } = req.body;
  const updates = [];
  const params = [];
  let p = 1;
  if (wilaya_code !== undefined) { updates.push(`wilaya_code = $${p++}`); params.push(wilaya_code); }
  if (wilaya_name !== undefined) { updates.push(`wilaya_name = $${p++}`); params.push(wilaya_name); }
  if (commune_code !== undefined) { updates.push(`commune_code = $${p++}`); params.push(commune_code); }
  if (commune_name !== undefined) { updates.push(`commune_name = $${p++}`); params.push(commune_name); }
  if (address_line !== undefined) { updates.push(`address_line = $${p++}`); params.push(address_line); }
  if (latitude !== undefined) { updates.push(`latitude = $${p++}`); params.push(latitude); }
  if (longitude !== undefined) { updates.push(`longitude = $${p++}`); params.push(longitude); }
  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update.' });
  updates.push('updated_at = NOW()');
  params.push(id);
  await run(`UPDATE users SET ${updates.join(', ')} WHERE id = $${p}`, params);
  const addr = await queryOne(
    `SELECT wilaya_code, wilaya_name, commune_code, commune_name, address_line, latitude, longitude
     FROM users WHERE id = $1`,
    [id]
  );
  logActivity(req.user, 'update_address', 'user', Number(id), { has_coords: !!(latitude || longitude), wilaya: wilaya_name || null });
  res.json(addr);
});

router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  const { id } = req.params;
  const existing = await queryOne("SELECT id, full_name FROM users WHERE id = $1 AND role = 'driver'", [id]);
  if (!existing) return res.status(404).json({ error: 'Driver not found.' });
  await run('DELETE FROM absences WHERE driver_id = $1', [id]);
  await run('DELETE FROM penalties WHERE driver_id = $1', [id]);
  await run('DELETE FROM attendance WHERE driver_id = $1', [id]);
  await run("DELETE FROM users WHERE id = $1 AND role = 'driver'", [id]);
  logActivity(req.user, 'delete_driver', 'driver', Number(id), { full_name: existing.full_name });
  res.json({ message: 'Driver deleted successfully.' });
});

module.exports = router;
