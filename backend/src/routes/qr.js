const express = require('express');
const crypto = require('crypto');
const { queryOne, run } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
const QR_SECRET = process.env.QR_SECRET;

function generateDateStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function generateSignature(driverId, dateStr) {
  return crypto.createHmac('sha256', QR_SECRET)
    .update(`${driverId}:${dateStr}`)
    .digest('hex');
}

router.get('/my-qr', authenticate, authorize('driver'), async (req, res) => {
  const driver = await queryOne('SELECT id, full_name, username FROM users WHERE id = $1', [req.user.id]);
  if (!driver) return res.status(404).json({ error: 'Driver not found.' });
  const date = generateDateStr();
  const signature = generateSignature(driver.id, date);
  res.json({
    driverId: driver.id,
    fullName: driver.full_name,
    date,
    signature,
  });
});

router.post('/scan', authenticate, authorize('admin', 'ops'), async (req, res) => {
  const { qrData } = req.body;
  if (!qrData) return res.status(400).json({ error: 'QR data is required.' });

  let parsed;
  try {
    parsed = typeof qrData === 'string' ? JSON.parse(qrData) : qrData;
  } catch {
    return res.status(400).json({ error: 'Invalid QR data format.' });
  }

  const { driverId, date, signature } = parsed;
  if (!driverId || !date || !signature) {
    return res.status(400).json({ error: 'Missing required QR fields (driverId, date, signature).' });
  }

  const today = generateDateStr();
  if (date !== today) {
    return res.status(400).json({ error: 'QR code is expired or invalid date.' });
  }

  const expectedSig = generateSignature(driverId, date);
  if (signature !== expectedSig) {
    return res.status(400).json({ error: 'Invalid QR signature. Possible tampering detected.' });
  }

  const driver = await queryOne("SELECT id, full_name, is_active FROM users WHERE id = $1 AND role = 'driver'", [driverId]);
  if (!driver) return res.status(404).json({ error: 'Driver not found.' });
  if (!driver.is_active) return res.status(403).json({ error: 'Driver account is deactivated.' });

  const existingToday = await queryOne(
    'SELECT id FROM attendance WHERE driver_id = $1 AND scan_date = $2',
    [driverId, today]
  );
  if (existingToday) {
    return res.status(409).json({ error: 'Attendance already recorded for this driver today.' });
  }

  const now = new Date();
  const time = String(now.getHours()).padStart(2, '0') + ':' +
               String(now.getMinutes()).padStart(2, '0') + ':' +
               String(now.getSeconds()).padStart(2, '0');

  const result = await run(
    'INSERT INTO attendance (driver_id, scanned_by, scan_date, scan_time, qr_signature) VALUES ($1, $2, $3, $4, $5)',
    [driverId, req.user.id, today, time, signature]
  );

  const record = await queryOne(
    `SELECT a.id, a.driver_id, a.scanned_by, a.scan_date, a.scan_time, a.verified, a.created_at,
            u.full_name as driver_name
     FROM attendance a
     JOIN users u ON a.driver_id = u.id
     WHERE a.id = $1`,
    [result.lastInsertRowid]
  );

  res.status(201).json({
    message: `Attendance recorded successfully for ${driver.full_name}`,
    record,
  });
});

module.exports = router;
