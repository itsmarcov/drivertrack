const express = require('express');
const path = require('path');
const { queryAll, queryOne } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

function rtl(text) {
  const tokens = [];
  let buf = '';
  for (const ch of text) {
    if (ch === ' ' || ch === '\n') {
      if (buf) tokens.push(buf);
      tokens.push(ch);
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf) tokens.push(buf);
  const rev = tokens.map(t => {
    if (/^\s+$/.test(t) || /^[\d.,:;\-\/]+$/.test(t)) return t;
    return t.split('').reverse().join('');
  });
  return rev.reverse().join('');
}

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
              a.scan_time as scan_time
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
    const fs = require('fs');

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 40, bottom: 40, left: 50, right: 50 },
      info: { Title: 'Penalty Report', Author: 'DriverTRACK' },
    });

    const fontsDir = path.join(__dirname, '..', '..', 'fonts');
    doc.registerFont('ArR', path.join(fontsDir, 'NotoSansArabic-Regular.ttf'));
    doc.registerFont('ArB', path.join(fontsDir, 'NotoSansArabic-Bold.ttf'));

    let logoPath = path.join(__dirname, '..', '..', '..', 'frontend', 'dist', 'NAVEXlogo.png');
    if (!fs.existsSync(logoPath)) {
      const altPath = path.join(__dirname, '..', '..', '..', 'frontend', 'public', 'NAVEXlogo.png');
      if (fs.existsSync(altPath)) logoPath = altPath;
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="penalty-${penalty.id}.pdf"`);
    doc.pipe(res);

    const pgW = 545;
    let y = 40;
    const colL = 50;
    const colW = 495;

    // logo
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, colL + colW / 2 - 60, y, { height: 40 });
      y += 55;
    }

    // header
    doc.font('ArB').fontSize(22).fillColor('#E53935')
      .text(rtl('إشعار غرامة'), colL, y, { width: colW, align: 'center' });
    y += 32;
    doc.font('ArR').fontSize(11).fillColor('#6B7280')
      .text('Penalty Notification', colL, y, { width: colW, align: 'center' });
    y += 22;

    // line
    doc.moveTo(colL, y).lineTo(colL + colW, y).strokeColor('#E5E7EB').stroke();
    y += 18;

    // info rows
    const rows = [
      [rtl('اسم السائق:'), penalty.driver_name],
      [rtl('رقم الهاتف:'), penalty.driver_phone || '---'],
      [rtl('لوحة السيارة:'), penalty.license_plate || '---'],
      [rtl('تاريخ الغرامة:'), penalty.penalty_date],
      [rtl('وقت التسجيل:'), penalty.scan_time ? new Date(penalty.scan_time).toLocaleString('ar-DZ') : '---'],
      [rtl('السبب:'), penalty.reason],
    ];
    for (const [label, value] of rows) {
      doc.font('ArB').fontSize(11).fillColor('#374151')
        .text(label, colL, y, { width: colW, align: 'right' });
      doc.font('ArR').fillColor('#1A1A1A')
        .text(rtl(String(value)), colL + 130, y, { width: colW - 130, align: 'right' });
      y += 20;
    }

    y += 8;
    doc.moveTo(colL, y).lineTo(colL + colW, y).strokeColor('#E5E7EB').stroke();
    y += 24;

    // section title
    doc.font('ArB').fontSize(13).fillColor('#1A1A1A')
      .text(rtl('تفاصيل العقوبة'), colL, y, { width: colW, align: 'center' });
    y += 24;

    // body text
    const body = rtl(
      'سيدي السائق،\n\n' +
      'نود إعلامك أنه نتيجة لتأخرك عن الموعد المحدد في تاريخ ' + penalty.penalty_date +
      '، فقد تم تسجيل غرامة عليك بمبلغ ' + penalty.amount + ' د.ج.\n\n' +
      'كما يتم تخفيض تعويضات جميع الطرود التي قمت بتوزيعها في هذا اليوم من 250 د.ج للطرد إلى 150 د.ج للطرد.\n\n' +
      'عليك الالتزام بالمواعيد المحددة تفادياً للغرامات المستقبلية.'
    );

    doc.font('ArR').fontSize(11).fillColor('#4B5563')
      .text(body, colL, y, { width: colW, align: 'right' });
    y = doc.y + 20;

    // line
    doc.moveTo(colL, y).lineTo(colL + colW, y).strokeColor('#E5E7EB').stroke();
    y += 18;

    // footer
    doc.font('ArR').fontSize(9).fillColor('#9CA3AF')
      .text(rtl('تم إصدار هذا التقرير بواسطة DriverTRACK — ' + new Date().toLocaleString('ar-DZ')), colL, y, { width: colW, align: 'center' });

    doc.end();
  } catch (err) {
    console.error('PDF generation error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate report: ' + err.message });
    }
  }
});

module.exports = router;
