const express = require('express');
const { queryAll, queryOne, run } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.post('/', authenticate, authorize('driver'), async (req, res) => {
  const { date_from, date_to, reason, note } = req.body;
  if (!date_from || !date_to || !reason) {
    return res.status(400).json({ error: 'date_from, date_to, reason مطلوبة' });
  }
  if (date_from > date_to) {
    return res.status(400).json({ error: 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية' });
  }
  const today = new Date();
  const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
  if (date_from < todayStr) {
    return res.status(400).json({ error: 'لا يمكن تقديم طلب غياب في تاريخ مضى' });
  }
  const overlap = await queryOne(
    `SELECT id FROM absence_requests
     WHERE driver_id = $1 AND status IN ('pending', 'approved')
       AND date_from <= $2 AND date_to >= $3`,
    [req.user.id, date_to, date_from]
  );
  if (overlap) {
    return res.status(409).json({ error: 'يوجد طلب غياب مسبق في هذه الفترة' });
  }
  const result = await run(
    `INSERT INTO absence_requests (driver_id, date_from, date_to, reason, note, status)
     VALUES ($1, $2, $3, $4, $5, 'pending')`,
    [req.user.id, date_from, date_to, reason, note || null]
  );
  const record = await queryOne('SELECT * FROM absence_requests WHERE id = $1', [result.lastInsertRowid]);
  res.status(201).json(record);
});

router.get('/my', authenticate, authorize('driver'), async (req, res) => {
  const records = await queryAll(
    `SELECT ar.*, u.full_name as driver_name
     FROM absence_requests ar
     JOIN users u ON ar.driver_id = u.id
     WHERE ar.driver_id = $1
     ORDER BY ar.created_at DESC`,
    [req.user.id]
  );
  res.json(records);
});

router.get('/', authenticate, authorize('admin', 'ops', 'super_admin'), async (req, res) => {
  const { status, driver_id, date_from, date_to } = req.query;
  let sql = `SELECT ar.*, u.full_name as driver_name, u.phone, u.vehicle_type, u.license_plate,
                    st.name as station_name, rv.full_name as reviewer_name
             FROM absence_requests ar
             JOIN users u ON ar.driver_id = u.id
             LEFT JOIN stations st ON u.station_id = st.id
             LEFT JOIN users rv ON ar.reviewed_by = rv.id
             WHERE 1=1`;
  const params = [];
  let paramIndex = 1;
  if (status) { sql += ` AND ar.status = $${paramIndex++}`; params.push(status); }
  if (driver_id) { sql += ` AND ar.driver_id = $${paramIndex++}`; params.push(parseInt(driver_id)); }
  if (date_from) { sql += ` AND ar.date_from >= $${paramIndex++}`; params.push(date_from); }
  if (date_to) { sql += ` AND ar.date_to <= $${paramIndex++}`; params.push(date_to); }
  if (req.user.role === 'ops') {
    sql += ` AND u.station_id = $${paramIndex++}`;
    params.push(req.user.station_id);
  }
  sql += ' ORDER BY ar.created_at DESC';
  const records = await queryAll(sql, params);
  res.json(records);
});

router.patch('/:id/review', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  const { id } = req.params;
  const { status, admin_note } = req.body;
  if (!status || !['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'status must be approved or rejected' });
  }
  const request = await queryOne('SELECT * FROM absence_requests WHERE id = $1', [id]);
  if (!request) return res.status(404).json({ error: 'الطلب غير موجود' });
  if (request.status !== 'pending') {
    return res.status(400).json({ error: 'تمت معالجة هذا الطلب بالفعل' });
  }
  await run(
    `UPDATE absence_requests SET status = $1, reviewed_by = $2, reviewed_at = NOW(), admin_note = $3 WHERE id = $4`,
    [status, req.user.id, admin_note || null, id]
  );
  const record = await queryOne(
    `SELECT ar.*, u.full_name as driver_name, rv.full_name as reviewer_name
     FROM absence_requests ar
     JOIN users u ON ar.driver_id = u.id
     LEFT JOIN users rv ON ar.reviewed_by = rv.id
     WHERE ar.id = $1`,
    [id]
  );
  res.json(record);
});

router.delete('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const request = await queryOne('SELECT * FROM absence_requests WHERE id = $1', [id]);
  if (!request) return res.status(404).json({ error: 'الطلب غير موجود' });
  if (req.user.role === 'driver' && request.driver_id !== req.user.id) {
    return res.status(403).json({ error: 'ليس لديك صلاحية لحذف هذا الطلب' });
  }
  if (request.status !== 'pending') {
    return res.status(400).json({ error: 'لا يمكن حذف طلب تمت معالجته' });
  }
  await run('DELETE FROM absence_requests WHERE id = $1', [id]);
  res.json({ message: 'تم حذف الطلب' });
});

module.exports = router;
