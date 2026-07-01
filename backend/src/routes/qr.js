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

async function getShiftCutoffs(shift) {
  const { queryOne } = require('../database');
  const prefix = shift === 'evening' ? 'evening' : 'morning';
  const late = await queryOne("SELECT value FROM settings WHERE key = $1", [`${prefix}_late_cutoff`]);
  const absent = await queryOne("SELECT value FROM settings WHERE key = $1", [`${prefix}_absent_cutoff`]);
  return {
    late_cutoff: late?.value || (shift === 'evening' ? '16:00:00' : '10:00:00'),
    absent_cutoff: absent?.value || (shift === 'evening' ? '17:30:00' : '12:30:00'),
  };
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
  const { qrData, lat, lng } = req.body;
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

  const driver = await queryOne("SELECT id, full_name, is_active, shift FROM users WHERE id = $1 AND role = 'driver'", [driverId]);
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

  const cutoffs = await getShiftCutoffs(driver.shift);
  const late = time > cutoffs.late_cutoff ? 1 : 0;

  const result = await run(
    `INSERT INTO attendance (driver_id, scanned_by, scan_date, scan_time, qr_signature, is_late, lat, lng, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'qr')`,
    [driverId, req.user.id, today, time, signature, late, lat || null, lng || null]
  );

  let penalty = null;
  if (late) {
    const penResult = await run(
      "INSERT INTO penalties (driver_id, attendance_id, penalty_date, reason, amount) VALUES ($1, $2, $3, $4, $5)",
      [driverId, result.lastInsertRowid, today, `تأخر عن الحضور (${time})`, 150]
    );
    penalty = await queryOne('SELECT * FROM penalties WHERE id = $1', [penResult.lastInsertRowid]);
  }

  const record = await queryOne(
    `SELECT a.id, a.driver_id, a.scanned_by, a.scan_date, a.scan_time, a.verified, a.is_late, a.lat, a.lng, a.created_at,
            u.full_name as driver_name
     FROM attendance a
     JOIN users u ON a.driver_id = u.id
     WHERE a.id = $1`,
    [result.lastInsertRowid]
  );

  res.status(201).json({
    message: `Attendance recorded successfully for ${driver.full_name}`,
    record,
    penalty,
  });
});

module.exports = { router, getShiftCutoffs };
