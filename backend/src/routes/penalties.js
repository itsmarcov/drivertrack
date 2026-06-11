const express = require('express');
const path = require('path');
const { queryAll, queryOne } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

const { convertArabic } = require('arabic-reshaper');

function rtl(text) {
  const reshaped = convertArabic(text);
  const paragraphs = reshaped.split('\n');
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
    const rev = tokens.map(t => {
      if (/^\s+$/.test(t) || /^[\d.,:;\-\/\u060C]+$/.test(t)) return t;
      return t.split('').reverse().join('');
    });
    return rev.reverse().join('');
  }).join('\n');
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

    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="penalty-${penalty.id}.pdf"`);
      res.send(Buffer.concat(chunks));
    });
    doc.on('error', (e) => { throw e; });

    let y = 40;
    const L = 50, W = 495;

    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, L + W / 2 - 60, y, { height: 40 });
      y += 55;
    }

    doc.font('ArB').fontSize(22).fillColor('#E53935')
      .text(rtl('إشعار غرامة'), L, y, { width: W, align: 'center' });
    y += 30;

    doc.moveTo(L, y).lineTo(L + W, y).strokeColor('#E5E7EB').stroke();
    y += 18;

    const section = (title, cb) => {
      doc.font('ArB').fontSize(12).fillColor('#1A1A1A')
        .text(rtl(title), L, y, { width: W, align: 'right' });
      y += 18;
      cb();
      y += 6;
    };

    const row = (label, value) => {
      const labelW = 140;
      doc.font('ArB').fontSize(10).fillColor('#374151')
        .text(rtl(label), L, y, { width: labelW, align: 'right' });
      doc.font('ArR').fillColor('#1A1A1A')
        .text(rtl(String(value)), L + labelW + 5, y, { width: W - labelW - 5, align: 'right' });
      y += 18;
    };

    section('معلومات السائق', () => {
      row('الاسم الكامل:', penalty.driver_name);
      row('رقم الهاتف:', penalty.driver_phone || '---');
      row('لوحة السيارة:', penalty.license_plate || '---');
    });

    section('تفاصيل الغرامة', () => {
      row('التاريخ:', penalty.penalty_date);
      row('وقت التسجيل:', penalty.scan_time ? new Date(penalty.scan_time).toLocaleString('ar-DZ') : '---');
      row('السبب:', penalty.reason);
      row('المبلغ:', penalty.amount + ' د.ج');
    });

    doc.moveTo(L, y).lineTo(L + W, y).strokeColor('#E5E7EB').stroke();
    y += 18;

    doc.font('ArB').fontSize(13).fillColor('#1A1A1A')
      .text(rtl('إشعار'), L, y, { width: W, align: 'center' });
    y += 22;

    const body =
      'سيدي السائق ' + penalty.driver_name + '،\n\n' +
      'نود إعلامك أنه نتيجة لتأخرك عن الموعد المحدد في تاريخ ' + penalty.penalty_date +
      '، فقد تم تسجيل غرامة عليك بمبلغ ' + penalty.amount + ' د.ج.\n\n' +
      'كما يتم تخفيض تعويضات جميع الطرود التي قمت بتوزيعها في هذا اليوم من 250 د.ج للطرد إلى 150 د.ج للطرد.\n\n' +
      'عليك الالتزام بالمواعيد المحددة تفادياً للغرامات المستقبلية.';

    doc.font('ArR').fontSize(11).fillColor('#4B5563')
      .text(rtl(body), L, y, { width: W, align: 'right' });
    y = doc.y + 20;

    doc.moveTo(L, y).lineTo(L + W, y).strokeColor('#E5E7EB').stroke();
    y += 16;

    doc.font('ArR').fontSize(9).fillColor('#9CA3AF')
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
