const express = require('express');
const path = require('path');
const { queryAll, queryOne } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

function rtl(text) {
  const paragraphs = text.split('\n');
  return paragraphs.map(para => {
    const tokens = [];
    let buf = '';
    for (const ch of para) {
      if (ch === ' ') {
        if (buf) tokens.push(buf);
        tokens.push(ch);
        buf = '';
      } else {
        buf += ch;
      }
    }
    if (buf) tokens.push(buf);
    return tokens.reverse().join('');
  }).join('\n');
}

router.get('/', authenticate, authorize('admin', 'ops'), async (req, res) => {
  const { date, driver_id, station_id } = req.query;
  let sql = `
    SELECT p.id, p.driver_id, p.attendance_id, p.penalty_date, p.reason, p.amount, p.created_at,
           u.full_name as driver_name, u.phone as driver_phone, u.station_id
    FROM penalties p
    JOIN users u ON p.driver_id = u.id
    WHERE 1=1
  `;
  const params = [];
  let pIdx = 1;
  if (date) { sql += ` AND p.penalty_date = $${pIdx++}`; params.push(date); }
  if (driver_id) { sql += ` AND p.driver_id = $${pIdx++}`; params.push(parseInt(driver_id)); }
  if (req.user.role === 'ops') {
    sql += ` AND u.station_id = $${pIdx++}`;
    params.push(req.user.station_id);
  } else if (station_id) {
    sql += ` AND u.station_id = $${pIdx++}`;
    params.push(parseInt(station_id));
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

  let sql = 'SELECT COUNT(*) as count, COALESCE(SUM(amount),0) as total FROM penalties p JOIN users u ON p.driver_id = u.id WHERE p.penalty_date = $1';
  const params = [dateStr];
  if (req.user.role === 'ops' && req.user.station_id) {
    sql += ' AND u.station_id = $2';
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

    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="penalty-${penalty.id}.pdf"`);
      res.send(Buffer.concat(chunks));
    });
    doc.on('error', (e) => { throw e; });

    function formatDate(d) {
      const dt = new Date(d);
      const day = String(dt.getDate()).padStart(2, '0');
      const month = String(dt.getMonth() + 1).padStart(2, '0');
      const year = dt.getFullYear();
      return `${day}-${month}-${year}`;
    }

    let y = 40;
    const L = 50, W = 495;

    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, L + W / 2 - 60, y, { height: 40 });
      y += 55;
    }

    doc.font('ArB').fontSize(22).fillColor('#E53935')
      .text(rtl('إشعار غرامة تأخير'), L, y, { width: W, align: 'center' });
    y += 35;

    doc.moveTo(L, y).lineTo(L + W, y).strokeColor('#E5E7EB').stroke();
    y += 18;

    const row = (label, value) => {
      const tw = doc.font('ArB').fontSize(11).fillColor('#374151');
      const labelW = 100;
      tw.text(rtl(label), L, y, { width: labelW, align: 'right' });
      doc.font('ArR').fillColor('#1A1A1A')
        .text(rtl(String(value)), L + labelW + 5, y, { width: W - labelW - 5, align: 'right' });
      y += 20;
    };

    row('السائق:', penalty.driver_name);
    row('رقم الهاتف:', penalty.driver_phone || '---');
    row('تاريخ المخالفة:', formatDate(penalty.penalty_date));

    y += 8;
    doc.moveTo(L, y).lineTo(L + W, y).strokeColor('#E5E7EB').stroke();
    y += 20;

    const bodyText =
      'نحيطكم علمًا بأنه تم تسجيل غرامة مالية بسبب التأخر عن الموعد المحدد للحضور.\n\n' +
      'كما نود إعلامكم بأنه، وكنتيجة لهذا التأخير، سيتم احتساب ربح التوصيل الخاص بكم لهذا اليوم بمبلغ ' +
      '150 دج فقط عن كل طرد يتم توصيله.\n\n' +
      'نرجو الالتزام بالمواعيد المحددة مستقبلاً لتفادي أي إجراءات أو خصومات مماثلة.\n\n' +
      'مع الشكر والتقدير.';

    doc.font('ArR').fontSize(12).fillColor('#1A1A1A')
      .text(rtl(bodyText), L, y, { width: W, align: 'right', lineGap: 4 });
    y = doc.y + 24;

    doc.moveTo(L, y).lineTo(L + W, y).strokeColor('#E5E7EB').stroke();
    y += 14;

    doc.font('ArR').fontSize(8).fillColor('#9CA3AF')
      .text(rtl('تم إصدار هذا التقرير بواسطة DriverTRACK — ' + new Date().toLocaleString('ar-DZ')), L, y, { width: W, align: 'center' });

    doc.end();
  } catch (err) {
    console.error('PDF generation error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate report: ' + err.message });
    }
  }
});

module.exports = router;
