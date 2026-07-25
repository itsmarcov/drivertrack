const express = require('express');
const { queryAll, queryOne, run } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');
const { logActivity } = require('../logActivity');

const router = express.Router();

router.get('/my', authenticate, async (req, res) => {
  const rows = await queryAll(
    'SELECT * FROM driver_reports WHERE driver_id = $1 ORDER BY created_at DESC',
    [req.user.id]
  );
  res.json(rows);
});

router.post('/', authenticate, async (req, res) => {
  const { report_type, category, message } = req.body;
  if (!report_type || !['problem', 'suggestion'].includes(report_type)) {
    return res.status(400).json({ error: 'نوع التقرير غير صالح' });
  }
  if (!category || !category.trim()) {
    return res.status(400).json({ error: 'يرجى اختيار التصنيف' });
  }
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'يرجى كتابة الرسالة' });
  }
  const result = await run(
    'INSERT INTO driver_reports (driver_id, report_type, category, message) VALUES ($1, $2, $3, $4)',
    [req.user.id, report_type, category.trim(), message.trim()]
  );
  await logActivity(req.user, 'create', 'driver_report', result.lastInsertRowid, { report_type, category });
  res.status(201).json({ id: result.lastInsertRowid, message: 'تم إرسال التقرير بنجاح' });
});

router.get('/', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  const { status } = req.query;
  let sql = `SELECT dr.*, u.full_name AS driver_name, u.username AS driver_username,
    rv.full_name AS reviewer_name
    FROM driver_reports dr
    JOIN users u ON dr.driver_id = u.id
    LEFT JOIN users rv ON dr.reviewed_by = rv.id`;
  const params = [];
  if (status) {
    sql += ' WHERE dr.status = $1';
    params.push(status);
  }
  sql += ' ORDER BY dr.created_at DESC';
  const rows = await queryAll(sql, params);
  res.json(rows);
});

router.patch('/:id', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  const { status, admin_reply } = req.body;
  const report = await queryOne('SELECT * FROM driver_reports WHERE id = $1', [req.params.id]);
  if (!report) return res.status(404).json({ error: 'التقرير غير موجود' });
  const newStatus = status || report.status;
  const reply = admin_reply !== undefined ? admin_reply : report.admin_reply;
  await run(
    'UPDATE driver_reports SET status = $1, admin_reply = $2, reviewed_by = $3, reviewed_at = NOW(), updated_at = NOW() WHERE id = $4',
    [newStatus, reply, req.user.id, req.params.id]
  );
  await logActivity(req.user, 'update', 'driver_report', req.params.id, { status: newStatus });
  res.json({ message: 'تم تحديث التقرير' });
});

router.delete('/:id', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  const report = await queryOne('SELECT * FROM driver_reports WHERE id = $1', [req.params.id]);
  if (!report) return res.status(404).json({ error: 'التقرير غير موجود' });
  await run('DELETE FROM driver_reports WHERE id = $1', [req.params.id]);
  await logActivity(req.user, 'delete', 'driver_report', req.params.id);
  res.json({ message: 'تم حذف التقرير' });
});

module.exports = router;