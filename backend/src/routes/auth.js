const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { queryAll, queryOne, run } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  const user = await queryOne('SELECT * FROM users WHERE username = $1 AND is_active = 1', [username]);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
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
    },
  });
});

router.post('/register', authenticate, authorize('admin'), async (req, res) => {
  const { username, password, full_name, role, email, phone } = req.body;
  if (!username || !password || !full_name || !role) {
    return res.status(400).json({ error: 'Username, password, full name, and role are required.' });
  }
  if (!['admin', 'ops'].includes(role)) {
    return res.status(400).json({ error: 'Admin can only create admin or ops accounts.' });
  }
  const existing = await queryOne('SELECT id FROM users WHERE username = $1', [username]);
  if (existing) return res.status(409).json({ error: 'Username already exists.' });
  const hash = bcrypt.hashSync(password, 10);
  const result = await run(
    'INSERT INTO users (username, password_hash, role, full_name, email, phone) VALUES ($1, $2, $3, $4, $5, $6)',
    [username, hash, role, full_name, email || null, phone || null]
  );
  const user = await queryOne(
    'SELECT id, username, role, full_name, email, phone, created_at FROM users WHERE id = $1',
    [result.lastInsertRowid]
  );
  res.status(201).json(user);
});

router.get('/me', authenticate, async (req, res) => {
  const user = await queryOne(
    'SELECT id, username, role, full_name, email, phone, vehicle_type, license_plate, is_active, created_at FROM users WHERE id = $1',
    [req.user.id]
  );
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json(user);
});

router.get('/ops', authenticate, authorize('admin'), async (req, res) => {
  const opsList = await queryAll(
    `SELECT id, username, full_name, email, phone, is_active, created_at
     FROM users WHERE role = 'ops' ORDER BY full_name ASC`
  );
  res.json(opsList);
});

module.exports = router;
