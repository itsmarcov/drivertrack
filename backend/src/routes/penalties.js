const express = require('express');
const path = require('path');
const { queryAll, queryOne } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, authorize('admin', 'ops'), async (req, res) => {
  const { date, driver_id } = req.query;
  let sql = `
    SELECT p.id, p.driver_id, p.attendance_id, p.penalty_date, p.reason, p.amount, p.created_at,
           u.full_name as driver_name, u.phone as driver_phone
    FROM penalties p
    JOIN users u ON p.driver_id = u.id
    WHERE 1=1
  `;
  const params = [];
  let pIdx = 1;
  if (date) { sql += ` AND p.penalty_date = $${pIdx++}`; params.push(date); }
  if (driver_id) { sql += ` AND p.driver_id = $${pIdx++}`; params.push(parseInt(driver_id)); }
  if (req.user.role === 'ops' && req.user.station_id) {
    sql += ` AND u.station_id = $${pIdx++}`;
    params.push(req.user.station_id);
  }
  sql += ' ORDER BY p.created_at DESC';
  const penalties = await queryAll(sql, params);
  res.json(penalties);
});

router.get('/stats', authenticate, authorize('admin', 'ops'), async (req, res) => {
  const today = new Date();
  const dateStr = today.getFullYear() + '-' +
    String(today.getMonth() + 1).padStart(2, '0') + '-' +
    String(today.getDate()).padStart(2, '0');

  let sql = 'SELECT COUNT(*) as count, COALESCE(SUM(amount),0) as total FROM penalties WHERE penalty_date = $1';
  const params = [dateStr];
  if (req.user.role === 'ops' && req.user.station_id) {
    sql += ' AND driver_id IN (SELECT id FROM users WHERE station_id = $2)';
    params.push(req.user.station_id);
  }
  const stats = await queryOne(sql, params);
  res.json({
    count: parseInt(stats.count),
    total: parseFloat(stats.total),
    date: dateStr,
  });
});

router.get('/my', authenticate, authorize('driver'), async (req, res) => {
  const penalties = await queryAll(
    `SELECT p.id, p.attendance_id, p.penalty_date, p.reason, p.amount, p.created_at
     FROM penalties p
     WHERE p.driver_id = $1
     ORDER BY p.created_at DESC
     LIMIT 50`,
    [req.user.id]
  );
  res.json(penalties);
});

router.get('/:id/report', authenticate, async (req, res) => {
  try {
    const penalty = await queryOne(
      `SELECT p.id, p.penalty_date, p.reason, p.amount, p.created_at, p.driver_id,
              u.full_name as driver_name, u.phone as driver_phone, u.license_plate,
              a.scanned_at as scan_time
       FROM penalties p
       JOIN users u ON p.driver_id = u.id
       LEFT JOIN attendance a ON p.attendance_id = a.id
       WHERE p.id = $1`,
      [parseInt(req.params.id)]
    );
    if (!penalty) return res.status(404).json({ error: 'Penalty not found' });
    if (req.user.role === 'driver' && penalty.driver_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 40, bottom: 40, left: 50, right: 50 },
      info: { Title: 'Penalty Report', Author: 'DriverTRACK' },
    });

    const fontsDir = path.join(__dirname, '..', 'fonts');
    doc.registerFont('Arabic', path.join(fontsDir, 'NotoSansArabic-Regular.ttf'));
    doc.registerFont('Arabic-Bold', path.join(fontsDir, 'NotoSansArabic-Bold.ttf'));

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="penalty-${penalty.id}.pdf"`);
    doc.pipe(res);

    const logoPath = path.join(__dirname, '..', '..', '..', 'frontend', 'public', 'NAVEXlogo.png');
    const fs = require('fs');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, 40, { height: 40 });
    }

    doc.font('Arabic-Bold').fontSize(22).fillColor('#E53935')
      .text('\u0625\u0634\u0639\u0627\u0631 \u063a\u0631\u0627\u0645\u0629', { align: 'center' });
    doc.moveDown(0.3);
    doc.font('Arabic').fontSize(11).fillColor('#6B7280')
      .text('Penalty Notification', { align: 'center' });
    doc.moveDown(1.5);

    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#E5E7EB').stroke();
    doc.moveDown(1);

    const leftX = 50;
    const labelW = 120;

    const row = (label, value) => {
      doc.font('Arabic-Bold').fontSize(11).fillColor('#374151').text(label, leftX, doc.y, { width: labelW, continued: true });
      doc.font('Arabic').fillColor('#1A1A1A').text(value, { width: 400 });
      doc.moveDown(0.5);
    };

    row('\u0627\u0633\u0645 \u0627\u0644\u0633\u0627\u0626\u0642:', penalty.driver_name);
    row('\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062a\u0641:', penalty.driver_phone || '---');
    row('\u0644\u0648\u062d\u0629 \u0627\u0644\u0633\u064a\u0627\u0631\u0629:', penalty.license_plate || '---');
    row('\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u063a\u0631\u0627\u0645\u0629:', penalty.penalty_date);
    row('\u0648\u0642\u062a \u0627\u0644\u062a\u0633\u062c\u064a\u0644:', penalty.scan_time ? new Date(penalty.scan_time).toLocaleString('ar-DZ') : '---');
    row('\u0627\u0644\u0633\u0628\u0628:', penalty.reason);

    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#E5E7EB').stroke();
    doc.moveDown(1.5);

    doc.font('Arabic-Bold').fontSize(13).fillColor('#1A1A1A')
      .text('\u062a\u0641\u0627\u0635\u064a\u0644 \u0627\u0644\u0639\u0642\u0648\u0628\u0629', { align: 'center' });
    doc.moveDown(1);

    doc.font('Arabic').fontSize(11).fillColor('#4B5563')
      .text('\u0633\u064a\u062f\u064a \u0627\u0644\u0633\u0627\u0626\u0642\u060c', { align: 'right' });
    doc.moveDown(0.3);
    doc.text(
      '\u0646\u0648\u062f \u0625\u0639\u0644\u0627\u0645\u0643 \u0623\u0646\u0647 \u0646\u062a\u064a\u062c\u0629 \u0644\u062a\u0623\u062e\u0631\u0643 \u0639\u0646 \u0627\u0644\u0645\u0648\u0639\u062f \u0627\u0644\u0645\u062d\u062f\u062f \u0641\u064a \u062a\u0627\u0631\u064a\u062e ' + penalty.penalty_date +
      '\u060c \u0641\u0642\u062f \u062a\u0645 \u062a\u0633\u062c\u064a\u0644 \u063a\u0631\u0627\u0645\u0629 \u0639\u0644\u064a\u0643 \u0628\u0645\u0628\u0644\u063a ' + penalty.amount + ' \u062f.\u062c.',
      { align: 'right' }
    );
    doc.moveDown(0.5);
    doc.text(
      '\u0643\u0645\u0627 \u064a\u062a\u0645 \u062a\u062e\u0641\u064a\u0636 \u062a\u0639\u0648\u064a\u0636\u0627\u062a \u062c\u0645\u064a\u0639 \u0627\u0644\u0637\u0631\u0648\u062f \u0627\u0644\u062a\u064a \u0642\u0645\u062a \u0628\u062a\u0648\u0632\u064a\u0639\u0647\u0627 \u0641\u064a \u0647\u0630\u0627 \u0627\u0644\u064a\u0648\u0645 \u0645\u0646 ' +
      '250 \u062f.\u062c \u0644\u0644\u0637\u0631\u062f \u0625\u0644\u0649 150 \u062f.\u062c \u0644\u0644\u0637\u0631\u062f.',
      { align: 'right' }
    );
    doc.moveDown(0.5);
    doc.font('Arabic-Bold').fillColor('#E53935')
      .text(
      '\u0639\u0644\u064a\u0643 \u0627\u0644\u0627\u0644\u062a\u0632\u0627\u0645 \u0628\u0627\u0644\u0645\u0648\u0627\u0639\u064a\u062f \u0627\u0644\u0645\u062d\u062f\u062f\u0629 \u062a\u0641\u0627\u062f\u064a\u064b\u0627 \u0644\u0644\u063a\u0631\u0627\u0645\u0627\u062a \u0627\u0644\u0645\u0633\u062a\u0642\u0628\u0644\u064a\u0629.',
      { align: 'right' }
    );

    doc.moveDown(2);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#E5E7EB').stroke();
    doc.moveDown(1);

    doc.font('Arabic').fontSize(9).fillColor('#9CA3AF')
      .text('\u062a\u0645 \u0625\u0635\u062f\u0627\u0631 \u0647\u0630\u0627 \u0627\u0644\u062a\u0642\u0631\u064a\u0631 \u0628\u0648\u0627\u0633\u0637\u0629 DriverTRACK \u2014 ' + new Date().toLocaleString('ar-DZ'), { align: 'center' });

    doc.end();
  } catch (err) {
    console.error('PDF generation error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate report: ' + err.message });
    }
  }
});

module.exports = router;
