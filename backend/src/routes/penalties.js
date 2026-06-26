const express = require('express');
const path = require('path');
const { queryAll, queryOne } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// --- Arabic text helpers ---

const AR_FORMS = {
  '\u0627': ['\uFE8D', '\uFE8E', '\uFE8E', '\uFE8D'],
  '\u0628': ['\uFE8F', '\uFE90', '\uFE92', '\uFE91'],
  '\u062A': ['\uFE95', '\uFE96', '\uFE98', '\uFE97'],
  '\u062B': ['\uFE99', '\uFE9A', '\uFE9C', '\uFE9B'],
  '\u062C': ['\uFE9D', '\uFE9E', '\uFEA0', '\uFE9F'],
  '\u062D': ['\uFEA1', '\uFEA2', '\uFEA4', '\uFEA3'],
  '\u062E': ['\uFEA5', '\uFEA6', '\uFEA8', '\uFEA7'],
  '\u062F': ['\uFEA9', '\uFEAA', '\uFEAA', '\uFEA9'],
  '\u0630': ['\uFEAB', '\uFEAC', '\uFEAC', '\uFEAB'],
  '\u0631': ['\uFEAD', '\uFEAE', '\uFEAE', '\uFEAD'],
  '\u0632': ['\uFEAF', '\uFEB0', '\uFEB0', '\uFEAF'],
  '\u0633': ['\uFEB1', '\uFEB2', '\uFEB4', '\uFEB3'],
  '\u0634': ['\uFEB5', '\uFEB6', '\uFEB8', '\uFEB7'],
  '\u0635': ['\uFEB9', '\uFEBA', '\uFEBC', '\uFEBB'],
  '\u0636': ['\uFEBD', '\uFEBE', '\uFEC0', '\uFEBF'],
  '\u0637': ['\uFEC1', '\uFEC2', '\uFEC4', '\uFEC3'],
  '\u0638': ['\uFEC5', '\uFEC6', '\uFEC8', '\uFEC7'],
  '\u0639': ['\uFEC9', '\uFECA', '\uFECC', '\uFECB'],
  '\u063A': ['\uFECD', '\uFECE', '\uFED0', '\uFECF'],
  '\u0641': ['\uFED1', '\uFED2', '\uFED4', '\uFED3'],
  '\u0642': ['\uFED5', '\uFED6', '\uFED8', '\uFED7'],
  '\u0643': ['\uFED9', '\uFEDA', '\uFEDC', '\uFEDB'],
  '\u0644': ['\uFEDD', '\uFEDE', '\uFEE0', '\uFEDF'],
  '\u0645': ['\uFEE1', '\uFEE2', '\uFEE4', '\uFEE3'],
  '\u0646': ['\uFEE5', '\uFEE6', '\uFEE8', '\uFEE7'],
  '\u0647': ['\uFEE9', '\uFEEA', '\uFEEC', '\uFEEB'],
  '\u0648': ['\uFEED', '\uFEEE', '\uFEEE', '\uFEED'],
  '\u064A': ['\uFEF1', '\uFEF2', '\uFEF4', '\uFEF3'],
  '\u0626': ['\uFE81', '\uFE82', '\uFE84', '\uFE83'],
  '\u0621': ['\uFE80', '\uFE80', '\uFE80', '\uFE80'],
  '\u0624': ['\uFE85', '\uFE86', '\uFE86', '\uFE85'],
  '\u0625': ['\uFE87', '\uFE88', '\uFE88', '\uFE87'],
  '\u0623': ['\uFE83', '\uFE84', '\uFE84', '\uFE83'],
  '\u0622': ['\uFE81', '\uFE82', '\uFE82', '\uFE81'],
  '\u0649': ['\uFEEF', '\uFEF0', '\uFEF0', '\uFEEF'],
  '\u0629': ['\uFE93', '\uFE94', '\uFE94', '\uFE93'],
  '\u0640': ['\u0640', '\u0640', '\u0640', '\u0640'],
};

const LAM_ALEF_FORMS = {
  '\u0644\u0627': '\uFEFB',
  '\u0644\u0623': '\uFEF5',
  '\u0644\u0625': '\uFEF7',
  '\u0644\u0622': '\uFEF9',
};

const PF_TO_LOGICAL = {};
for (const [logical, forms] of Object.entries(AR_FORMS)) {
  const lcp = logical.charCodeAt(0);
  for (const form of forms) {
    PF_TO_LOGICAL[form.charCodeAt(0)] = [lcp];
  }
}
for (const [pair, form] of Object.entries(LAM_ALEF_FORMS)) {
  PF_TO_LOGICAL[form.charCodeAt(0)] = [pair.charCodeAt(0), pair.charCodeAt(1)];
}

function isJoinerLeft(ch) {
  const nonJoiners = '\u0627\u062F\u0630\u0631\u0632\u0648\u0624\u0625\u0623\u0622';
  const cp = ch.charCodeAt(0);
  const isArabic = (cp >= 0x0600 && cp <= 0x06FF) || (cp >= 0xFE70 && cp <= 0xFEFF) || (cp >= 0x0750 && cp <= 0x077F);
  return isArabic && !nonJoiners.includes(ch) && ch !== '\u0621';
}

function arabicReshape(text) {
  if (!/[\u0600-\u06FF]/.test(text)) return text;
  let result = text;
  for (const [pair, form] of Object.entries(LAM_ALEF_FORMS)) {
    result = result.replace(new RegExp(pair, 'g'), form);
  }
  const chars = [...result];
  return chars.map((ch, i) => {
    const form = AR_FORMS[ch];
    if (!form) return ch;
    const prev = i > 0 ? chars[i - 1] : '';
    const next = i < chars.length - 1 ? chars[i + 1] : '';
    const prevJoins = prev && isJoinerLeft(prev) && AR_FORMS[prev];
    const nextJoins = next && isJoinerLeft(next) && AR_FORMS[next];
    if (!prevJoins && nextJoins) return form[3];
    if (prevJoins && nextJoins) return form[2];
    if (prevJoins && !nextJoins) return form[1];
    return form[0];
  }).join('');
}

function fixToUnicode(doc) {
  const font = doc._font;
  if (!font || !font.unicode) return;
  for (let i = 0; i < font.unicode.length; i++) {
    const cps = font.unicode[i];
    if (cps && cps.length === 1 && PF_TO_LOGICAL[cps[0]]) {
      font.unicode[i] = PF_TO_LOGICAL[cps[0]];
    }
  }
}

// Format amount: remove decimals, show as integer e.g. 150.00 -> "150"
function formatAmount(val) {
  const n = parseFloat(val);
  if (isNaN(n)) return String(val);
  return String(Math.round(n));
}

// --- End Arabic helpers ---

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
    const LINE_H = 22; // fixed line height — prevents line overlap

    // Logo
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, L + W / 2 - 60, y, { height: 40 });
      y += 55;
    }

    // Title
    doc.font('ArB').fontSize(22).fillColor('#E53935')
      .text(arabicReshape('إشعار غرامة تأخير'), L, y, { width: W, align: 'center', lineBreak: false, features: { ccmp: false } });
    fixToUnicode(doc);
    y += 35;

    doc.moveTo(L, y).lineTo(L + W, y).strokeColor('#E5E7EB').stroke();
    y += 18;

    // Row helper — labels reshaped, values left as-is (Latin names/phone/dates)
    const row = (label, value) => {
      const labelW = 100;
      const strVal = String(value);
      const isArabicValue = /[\u0600-\u06FF]/.test(strVal);
      const displayValue = isArabicValue ? arabicReshape(strVal) : strVal;

      doc.font('ArB').fontSize(11).fillColor('#374151')
        .text(arabicReshape(label), L, y, { width: labelW, align: 'right', lineBreak: false, features: { ccmp: false } });
      fixToUnicode(doc);

      doc.font('ArR').fillColor('#1A1A1A')
        .text(displayValue, L + labelW + 5, y, { width: W - labelW - 5, align: 'right', lineBreak: false, features: { ccmp: false } });
      fixToUnicode(doc);
      y += 20;
    };

    row('السائق:', penalty.driver_name);
    row('رقم الهاتف:', penalty.driver_phone || '---');
    row('تاريخ المخالفة:', formatDate(penalty.penalty_date));

    y += 8;
    doc.moveTo(L, y).lineTo(L + W, y).strokeColor('#E5E7EB').stroke();
    y += 20;

    // FIX: amount converted to clean integer string (e.g. 150.00 -> "150")
    const amount = formatAmount(penalty.amount);

    // Body lines — each rendered separately with lineBreak:false + fixed LINE_H
    // This prevents PDFKit mid-word breaks AND line overlap
    const bodyLines = [
      arabicReshape('نحيطكم علمًا بأنه تم تسجيل غرامة مالية بسبب التأخر عن الموعد المحدد للحضور.'),
      '',
      // amount kept outside arabicReshape — never reversed
      arabicReshape('كما نود إعلامكم بأنه، وكنتيجة لهذا التأخير، سيتم احتساب ربح التوصيل الخاص بكم لهذا اليوم بمبلغ ')
        + amount
        + arabicReshape(' دج فقط عن كل طرد يتم توصيله.'),
      '',
      arabicReshape('نرجو الالتزام بالمواعيد المحددة مستقبلاً لتفادي أي إجراءات أو خصومات مماثلة.'),
      '',
      arabicReshape('مع الشكر والتقدير.'),
    ];

    doc.font('ArR').fontSize(12).fillColor('#1A1A1A');
    for (const line of bodyLines) {
      if (line === '') { y += 10; continue; }
      doc.text(line, L, y, { width: W, align: 'right', lineBreak: false, features: { ccmp: false } });
      fixToUnicode(doc);
      y += LINE_H; // fixed step — no more overlap
    }

    y += 14;
    doc.moveTo(L, y).lineTo(L + W, y).strokeColor('#E5E7EB').stroke();
    y += 14;

    // Footer — DriverTRACK and date outside arabicReshape
    const now = new Date().toLocaleString('ar-DZ');
    const footer = arabicReshape('تم إصدار هذا التقرير بواسطة') + ' DriverTRACK — ' + now;
    doc.font('ArR').fontSize(8).fillColor('#9CA3AF')
      .text(footer, L, y, { width: W, align: 'right', lineBreak: false, features: { ccmp: false } });
    fixToUnicode(doc);

    doc.end();
  } catch (err) {
    console.error('PDF generation error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate report: ' + err.message });
    }
  }
});

module.exports = router;
