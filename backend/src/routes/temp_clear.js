const express = require('express');
const { queryOne, run } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.post('/clear-driver-address', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'username is required' });
  const user = await queryOne('SELECT id, full_name, wilaya_name FROM users WHERE username = $1 AND role = $2', [username, 'driver']);
  if (!user) return res.status(404).json({ error: 'Driver not found' });
  await run(
    "UPDATE users SET wilaya_code = NULL, wilaya_name = NULL, commune_code = NULL, commune_name = NULL, address_line = NULL, latitude = NULL, longitude = NULL WHERE id = $1",
    [user.id]
  );
  res.json({ message: `Address cleared for ${user.full_name}` });
});

module.exports = router;