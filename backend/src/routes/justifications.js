const express = require('express');
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const { queryAll, queryOne, run } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'justifications');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.user.id}_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp|pdf|doc|docx)$/i;
    if (allowed.test(path.extname(file.originalname))) return cb(null, true);
    cb(new Error('نوع الملف غير مدعوم. الأنواع المسموحة: JPG, PNG, PDF, DOC'));
  },
});

router.post('/', authenticate, authorize('driver'), (req, res, next) => {
  upload.single('proof')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'حجم الملف يتجاوز 3 ميغابايت' });
      }
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    const { reason, note } = req.body;
    if (!reason) return res.status(400).json({ error: 'السبب مطلوب' });

    const today = new Date();
    const dateStr = today.getFullYear() + '-' +
      String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0');

    const existing = await queryOne(
      'SELECT id FROM justifications WHERE driver_id = $1 AND attendance_date = $2',
      [req.user.id, dateStr]
    );
    if (existing) return res.status(409).json({ error: 'لقد قمت بالفعل بتقديم مبرر لهذا اليوم' });

    const result = await run(
      `INSERT INTO justifications (driver_id, attendance_date, reason, note, proof_file)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, dateStr, reason, note || null, req.file ? req.file.filename : null]
    );

    const justification = await queryOne('SELECT * FROM justifications WHERE id = $1', [result.lastInsertRowid]);
    res.status(201).json(justification);
  } catch (err) {
    console.error('Justification submit error:', err);
    res.status(500).json({ error: 'فشل إرسال المبرر: ' + err.message });
  }
});

router.get('/my', authenticate, authorize('driver'), async (req, res) => {
  try {
    const list = await queryAll(
      'SELECT * FROM justifications WHERE driver_id = $1 ORDER BY created_at DESC LIMIT 20',
      [req.user.id]
    );
    res.json(list);
  } catch (err) {
    console.error('My justifications error:', err);
    res.status(500).json({ error: 'فشل تحميل المبررات' });
  }
});

router.get('/', authenticate, authorize('admin', 'ops'), async (req, res) => {
  try {
    const { status } = req.query;
    let sql = `SELECT j.*, u.full_name as driver_name, u.phone, u.license_plate
               FROM justifications j JOIN users u ON j.driver_id = u.id`;
    const params = [];
    if (status) {
      sql += ' WHERE j.status = $1';
      params.push(status);
    }
    sql += ' ORDER BY j.created_at DESC';
    const list = await queryAll(sql, params);
    res.json(list);
  } catch (err) {
    console.error('Justifications list error:', err);
    res.status(500).json({ error: 'فشل تحميل المبررات' });
  }
});

router.patch('/:id/review', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_note } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'الحالة يجب أن تكون approved أو rejected' });
    }

    const justification = await queryOne('SELECT * FROM justifications WHERE id = $1', [id]);
    if (!justification) return res.status(404).json({ error: 'المبرر غير موجود' });
    if (justification.status !== 'pending') return res.status(400).json({ error: 'تمت مراجعة هذا المبرر بالفعل' });

    await run(
      `UPDATE justifications SET status = $1, admin_note = $2, reviewed_by = $3, reviewed_at = NOW()
       WHERE id = $4`,
      [status, admin_note || null, req.user.id, id]
    );

    if (status === 'approved') {
      await run(
        `UPDATE penalties SET status = 'cancelled', admin_note = 'مقبول - تم إلغاء الغرامة'
         WHERE driver_id = $1 AND penalty_date = $2 AND status = 'active'`,
        [justification.driver_id, justification.attendance_date]
      );
    }

    const updated = await queryOne('SELECT * FROM justifications WHERE id = $1', [id]);
    res.json(updated);
  } catch (err) {
    console.error('Review justification error:', err);
    res.status(500).json({ error: 'فشل مراجعة المبرر' });
  }
});

router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const justification = await queryOne('SELECT * FROM justifications WHERE id = $1', [req.params.id]);
    if (!justification) return res.status(404).json({ error: 'المبرر غير موجود' });

    if (justification.proof_file) {
      const filePath = path.join(uploadDir, justification.proof_file);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await run('DELETE FROM justifications WHERE id = $1', [req.params.id]);
    res.json({ message: 'تم حذف المبرر' });
  } catch (err) {
    console.error('Delete justification error:', err);
    res.status(500).json({ error: 'فشل حذف المبرر' });
  }
});

router.get('/:id/proof/download', authenticate, async (req, res) => {
  try {
    const justification = await queryOne('SELECT * FROM justifications WHERE id = $1', [req.params.id]);
    if (!justification) return res.status(404).json({ error: 'المبرر غير موجود' });
    if (!justification.proof_file) return res.status(404).json({ error: 'لا يوجد ملف مرفق' });

    const isOwner = justification.driver_id === req.user.id;
    const isAdmin = ['admin', 'ops'].includes(req.user.role);
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'غير مصرح لك' });

    const filePath = path.join(uploadDir, justification.proof_file);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'الملف غير موجود على الخادم' });
    }
    res.download(filePath);
  } catch (err) {
    console.error('Proof download error:', err);
    res.status(500).json({ error: 'فشل تحميل الملف' });
  }
});

router.get('/:id/proof', authenticate, async (req, res) => {
  try {
    const justification = await queryOne('SELECT * FROM justifications WHERE id = $1', [req.params.id]);
    if (!justification) return res.status(404).json({ error: 'المبرر غير موجود' });
    if (!justification.proof_file) return res.status(404).json({ error: 'لا يوجد ملف مرفق لهذا المبرر' });

    const isOwner = justification.driver_id === req.user.id;
    const isAdmin = ['admin', 'ops'].includes(req.user.role);
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'غير مصرح لك بمشاهدة هذا الملف' });

    const filePath = path.join(uploadDir, justification.proof_file);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'الملف غير موجود على الخادم. ربما تم حذفه بعد تحديث التطبيق.' });
    }
    res.sendFile(filePath);
  } catch (err) {
    console.error('Proof file error:', err);
    res.status(500).json({ error: 'فشل تحميل الملف: ' + err.message });
  }
});

router.get('/stats', authenticate, authorize('admin', 'ops'), async (req, res) => {
  try {
    const stats = await queryOne(
      `SELECT
        COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) as pending_count,
        COALESCE(SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END), 0) as approved_count,
        COALESCE(SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END), 0) as rejected_count,
        COUNT(*) as total_count
       FROM justifications`
    );
    res.json({
      pendingCount: parseInt(stats.pending_count),
      approvedCount: parseInt(stats.approved_count),
      rejectedCount: parseInt(stats.rejected_count),
      totalCount: parseInt(stats.total_count),
    });
  } catch (err) {
    console.error('Justification stats error:', err);
    res.status(500).json({ error: 'فشل تحميل إحصائيات المبررات' });
  }
});

module.exports = router;
