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

    const pdfmake = require('pdfmake');

    const fontsDir = path.join(__dirname, '..', '..', 'fonts');
    pdfmake.setFonts({
      Arabic: {
        normal: path.join(fontsDir, 'NotoSansArabic-Regular.ttf'),
        bold: path.join(fontsDir, 'NotoSansArabic-Bold.ttf'),
      },
    });
    pdfmake.setLocalAccessPolicy(() => true);

    const scanTime = penalty.scan_time ? new Date(penalty.scan_time).toLocaleString('ar-DZ') : '---';

    const docDef = {
      pageSize: 'A4',
      pageMargins: [50, 40, 50, 40],
      images: {
        logo: (() => {
          const distPath = path.join(__dirname, '..', '..', '..', 'frontend', 'dist', 'NAVEXlogo.png');
          if (require('fs').existsSync(distPath)) return distPath;
          return path.join(__dirname, '..', '..', '..', 'frontend', 'public', 'NAVEXlogo.png');
        })(),
      },
      defaultStyle: {
        font: 'Arabic',
        alignment: 'right',
        direction: 'rtl',
      },
      content: [
        {
          image: 'logo',
          width: 120,
          alignment: 'center',
          margin: [0, 0, 0, 20],
        },
        {
          text: 'إشعار غرامة',
          style: 'header',
          alignment: 'center',
          margin: [0, 0, 0, 4],
        },
        {
          text: 'Penalty Notification',
          style: 'subheader',
          alignment: 'center',
          margin: [0, 0, 0, 20],
        },
        {
          canvas: [{ type: 'line', x1: 0, y1: 0, x2: 495, y2: 0, lineWidth: 1, lineColor: '#E5E7EB' }],
          margin: [0, 0, 0, 16],
        },
        {
          columns: [
            { width: 120, text: 'اسم السائق:', style: 'label' },
            { width: '*', text: penalty.driver_name, style: 'value' },
          ],
          columnGap: 4,
          margin: [0, 0, 0, 6],
        },
        {
          columns: [
            { width: 120, text: 'رقم الهاتف:', style: 'label' },
            { width: '*', text: penalty.driver_phone || '---', style: 'value' },
          ],
          columnGap: 4,
          margin: [0, 0, 0, 6],
        },
        {
          columns: [
            { width: 120, text: 'لوحة السيارة:', style: 'label' },
            { width: '*', text: penalty.license_plate || '---', style: 'value' },
          ],
          columnGap: 4,
          margin: [0, 0, 0, 6],
        },
        {
          columns: [
            { width: 120, text: 'تاريخ الغرامة:', style: 'label' },
            { width: '*', text: penalty.penalty_date, style: 'value' },
          ],
          columnGap: 4,
          margin: [0, 0, 0, 6],
        },
        {
          columns: [
            { width: 120, text: 'وقت التسجيل:', style: 'label' },
            { width: '*', text: scanTime, style: 'value' },
          ],
          columnGap: 4,
          margin: [0, 0, 0, 6],
        },
        {
          columns: [
            { width: 120, text: 'السبب:', style: 'label' },
            { width: '*', text: penalty.reason, style: 'value' },
          ],
          columnGap: 4,
          margin: [0, 0, 0, 16],
        },
        {
          canvas: [{ type: 'line', x1: 0, y1: 0, x2: 495, y2: 0, lineWidth: 1, lineColor: '#E5E7EB' }],
          margin: [0, 0, 0, 20],
        },
        {
          text: 'تفاصيل العقوبة',
          style: 'sectionTitle',
          alignment: 'center',
          margin: [0, 0, 0, 16],
        },
        {
          text: [
            { text: 'سيدي السائق،\n\n', style: 'body' },
            { text: 'نود إعلامك أنه نتيجة لتأخرك عن الموعد المحدد في تاريخ ' + penalty.penalty_date + '، فقد تم تسجيل غرامة عليك بمبلغ ' + penalty.amount + ' د.ج.\n\n', style: 'body' },
            { text: 'كما يتم تخفيض تعويضات جميع الطرود التي قمت بتوزيعها في هذا اليوم من 250 د.ج للطرد إلى 150 د.ج للطرد.\n\n', style: 'body' },
            { text: 'عليك الالتزام بالمواعيد المحددة تفادياً للغرامات المستقبلية.', style: 'bodyBold', color: '#E53935' },
          ],
          alignment: 'right',
          margin: [0, 0, 0, 30],
        },
        {
          canvas: [{ type: 'line', x1: 0, y1: 0, x2: 495, y2: 0, lineWidth: 1, lineColor: '#E5E7EB' }],
          margin: [0, 0, 0, 16],
        },
        {
          text: 'تم إصدار هذا التقرير بواسطة DriverTRACK — ' + new Date().toLocaleString('ar-DZ'),
          style: 'footer',
          alignment: 'center',
        },
      ],
      styles: {
        header: { fontSize: 22, bold: true, color: '#E53935' },
        subheader: { fontSize: 11, color: '#6B7280' },
        sectionTitle: { fontSize: 13, bold: true, color: '#1A1A1A' },
        label: { fontSize: 11, bold: true, color: '#374151' },
        value: { fontSize: 11, color: '#1A1A1A' },
        body: { fontSize: 11, color: '#4B5563' },
        bodyBold: { fontSize: 11, bold: true },
        footer: { fontSize: 9, color: '#9CA3AF' },
      },
    };

    const outputDoc = pdfmake.createPdf(docDef);
    const buffer = await outputDoc.getBuffer();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="penalty-${penalty.id}.pdf"`);
    res.send(buffer);
  } catch (err) {
    console.error('PDF generation error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate report: ' + err.message });
    }
  }
});

module.exports = router;
