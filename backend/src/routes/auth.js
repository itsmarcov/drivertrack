const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { queryAll, queryOne, run } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'محاولات تسجيل دخول كثيرة جداً. حاول مرة أخرى بعد 15 دقيقة.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

function setTokenCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 365 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  const user = await queryOne(
    `SELECT u.*, s.name as station_name FROM users u LEFT JOIN stations s ON u.station_id = s.id WHERE LOWER(u.username) = LOWER($1) AND u.is_active = 1`,
    [username]
  );
  if (!user) {
    const inactiveUser = await queryOne(
      'SELECT id, is_active FROM users WHERE LOWER(username) = LOWER($1)', [username]
    );
    if (inactiveUser) {
      console.log(`Login failed: user "${username}" found but is_active = ${inactiveUser.is_active}`);
    } else {
      console.log(`Login failed: user "${username}" not found in database`);
    }
    return res.status(401).json({ error: 'Invalid username or password.' });
  }
  if (!bcrypt.compareSync(password, user.password_hash)) {
    console.log(`Login failed: wrong password for user "${username}"`);
    return res.status(401).json({ error: 'Invalid username or password.' });
  }
  const token_version = user.token_version || 0;
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, full_name: user.full_name, station_id: user.station_id, token_version },
    JWT_SECRET,
    { expiresIn: '365d' }
  );

  setTokenCookie(res, token);

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      vehicle_type: user.vehicle_type,
      license_plate: user.license_plate,
      station_id: user.station_id,
    },
  });
});

router.post('/logout', (req, res) => {
  res.cookie('token', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 0, path: '/' });
  res.json({ message: 'Logged out.' });
});

router.post('/register', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  const { username, password, full_name, role, email, phone, station_id } = req.body;
  if (!username || !password || !full_name || !role) {
    return res.status(400).json({ error: 'Username, password, full name, and role are required.' });
  }
  if (!['admin', 'ops'].includes(role)) {
    return res.status(400).json({ error: 'You can only create admin or ops accounts.' });
  }
  if (station_id) {
    const station = await queryOne('SELECT id FROM stations WHERE id = $1', [station_id]);
    if (!station) return res.status(400).json({ error: 'Invalid station.' });
  }
  const existing = await queryOne('SELECT id FROM users WHERE username = $1', [username]);
  if (existing) return res.status(409).json({ error: 'Username already exists.' });
  const hash = bcrypt.hashSync(password, 10);
  const result = await run(
    'INSERT INTO users (username, password_hash, role, full_name, email, phone, station_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [username, hash, role, full_name, email || null, phone || null, station_id || null]
  );
  const user = await queryOne(
    'SELECT id, username, role, full_name, email, phone, station_id, created_at FROM users WHERE id = $1',
    [result.lastInsertRowid]
  );
  res.status(201).json(user);
});

router.get('/me', authenticate, async (req, res) => {
  const user = await queryOne(
    `SELECT u.id, u.username, u.role, u.full_name, u.email, u.phone, u.vehicle_type, u.license_plate,
            u.station_id, u.is_active, u.created_at, s.name as station_name
     FROM users u LEFT JOIN stations s ON u.station_id = s.id WHERE u.id = $1`,
    [req.user.id]
  );
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json(user);
});

router.get('/ops', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  const opsList = await queryAll(
    `SELECT u.id, u.username, u.full_name, u.email, u.phone, u.station_id, u.is_active, u.created_at,
            s.name as station_name
     FROM users u LEFT JOIN stations s ON u.station_id = s.id WHERE u.role = 'ops' ORDER BY u.full_name ASC`
  );
  res.json(opsList);
});

router.put('/ops/:id', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  const { id } = req.params;
  const { full_name, email, phone, station_id, is_active } = req.body;
  const ops = await queryOne("SELECT id FROM users WHERE id = $1 AND role = 'ops'", [id]);
  if (!ops) return res.status(404).json({ error: 'OPS user not found.' });
  const updates = [];
  const params = [];
  let p = 1;
  if (full_name !== undefined) { updates.push(`full_name = $${p++}`); params.push(full_name); }
  if (email !== undefined) { updates.push(`email = $${p++}`); params.push(email); }
  if (phone !== undefined) { updates.push(`phone = $${p++}`); params.push(phone); }
  if (station_id !== undefined) { updates.push(`station_id = $${p++}`); params.push(station_id || null); }
  if (is_active !== undefined) { updates.push(`is_active = $${p++}`); params.push(is_active); }
  if (updates.length > 0) {
    updates.push(`updated_at = NOW()`);
    params.push(id);
    await run(`UPDATE users SET ${updates.join(', ')} WHERE id = $${p}`, params);
  }
  const updated = await queryOne(
    `SELECT u.id, u.username, u.full_name, u.email, u.phone, u.station_id, u.is_active, u.created_at,
            s.name as station_name FROM users u LEFT JOIN stations s ON u.station_id = s.id WHERE u.id = $1`,
    [id]
  );
  res.json(updated);
});

router.delete('/ops/:id', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  const { id } = req.params;
  const ops = await queryOne("SELECT id FROM users WHERE id = $1 AND role = 'ops'", [id]);
  if (!ops) return res.status(404).json({ error: 'OPS user not found.' });
  await run('UPDATE attendance SET scanned_by = $1 WHERE scanned_by = $2', [req.user.id, id]);
  const result = await run('DELETE FROM users WHERE id = $1', [id]);
  res.json({ message: 'OPS user deleted successfully.' });
});

router.get('/admins', authenticate, authorize('super_admin'), async (req, res) => {
  const admins = await queryAll(
    `SELECT u.id, u.username, u.full_name, u.email, u.phone, u.is_active, u.created_at
     FROM users u WHERE u.role = 'admin' ORDER BY u.full_name ASC`
  );
  res.json(admins);
});

router.delete('/admins/:id', authenticate, authorize('super_admin'), async (req, res) => {
  const { id } = req.params;
  const admin = await queryOne("SELECT id FROM users WHERE id = $1 AND role = 'admin'", [id]);
  if (!admin) return res.status(404).json({ error: 'Admin user not found.' });
  await run('DELETE FROM penalties WHERE driver_id = $1', [id]);
  await run('DELETE FROM attendance WHERE driver_id = $1 OR scanned_by = $1', [id, id]);
  await run('DELETE FROM absences WHERE driver_id = $1', [id]);
  await run('DELETE FROM justifications WHERE driver_id = $1', [id]);
  await run('DELETE FROM users WHERE id = $1', [id]);
  res.json({ message: 'Admin user deleted.' });
});

router.put('/profile', authenticate, async (req, res) => {
  const { full_name, email, phone, current_password, new_password } = req.body;
  if (!full_name && email === undefined && phone === undefined && !current_password) {
    return res.status(400).json({ error: 'No fields to update.' });
  }
  if (new_password && !current_password) {
    return res.status(400).json({ error: 'Current password is required to set a new password.' });
  }
  const user = await queryOne('SELECT * FROM users WHERE id = $1', [req.user.id]);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  if (current_password) {
    if (!bcrypt.compareSync(current_password, user.password_hash)) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }
  }
  const updates = [];
  const params = [];
  let p = 1;
  if (full_name !== undefined) { updates.push(`full_name = $${p++}`); params.push(full_name); }
  if (email !== undefined) { updates.push(`email = $${p++}`); params.push(email || null); }
  if (phone !== undefined) { updates.push(`phone = $${p++}`); params.push(phone || null); }
  if (new_password) {
    updates.push(`password_hash = $${p++}`);
    params.push(bcrypt.hashSync(new_password, 10));
    updates.push('token_version = COALESCE(token_version, 0) + 1');
  }
  if (updates.length > 0) {
    updates.push('updated_at = NOW()');
    params.push(req.user.id);
    await run(`UPDATE users SET ${updates.join(', ')} WHERE id = $${p}`, params);
  }
  const updated = await queryOne(
    `SELECT u.id, u.username, u.role, u.full_name, u.email, u.phone, u.vehicle_type, u.license_plate,
            u.station_id, u.is_active, u.created_at, s.name as station_name
     FROM users u LEFT JOIN stations s ON u.station_id = s.id WHERE u.id = $1`,
    [req.user.id]
  );
  res.json(updated);
});

module.exports = router;
