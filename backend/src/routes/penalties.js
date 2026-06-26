const express = require('express');
const path = require('path');
const { queryAll, queryOne } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// ── Arabic reshaper ───────────────────────────────────────────────────────────
const AR_FORMS = {
  '\u0627':['\uFE8D','\uFE8E','\uFE8E','\uFE8D'],'\u0628':['\uFE8F','\uFE90','\uFE92','\uFE91'],
  '\u062A':['\uFE95','\uFE96','\uFE98','\uFE97'],'\u062B':['\uFE99','\uFE9A','\uFE9C','\uFE9B'],
  '\u062C':['\uFE9D','\uFE9E','\uFEA0','\uFE9F'],'\u062D':['\uFEA1','\uFEA2','\uFEA4','\uFEA3'],
  '\u062E':['\uFEA5','\uFEA6','\uFEA8','\uFEA7'],'\u062F':['\uFEA9','\uFEAA','\uFEAA','\uFEA9'],
  '\u0630':['\uFEAB','\uFEAC','\uFEAC','\uFEAB'],'\u0631':['\uFEAD','\uFEAE','\uFEAE','\uFEAD'],
  '\u0632':['\uFEAF','\uFEB0','\uFEB0','\uFEAF'],'\u0633':['\uFEB1','\uFEB2','\uFEB4','\uFEB3'],
  '\u0634':['\uFEB5','\uFEB6','\uFEB8','\uFEB7'],'\u0635':['\uFEB9','\uFEBA','\uFEBC','\uFEBB'],
  '\u0636':['\uFEBD','\uFEBE','\uFEC0','\uFEBF'],'\u0637':['\uFEC1','\uFEC2','\uFEC4','\uFEC3'],
  '\u0638':['\uFEC5','\uFEC6','\uFEC8','\uFEC7'],'\u0639':['\uFEC9','\uFECA','\uFECC','\uFECB'],
  '\u063A':['\uFECD','\uFECE','\uFED0','\uFECF'],'\u0641':['\uFED1','\uFED2','\uFED4','\uFED3'],
  '\u0642':['\uFED5','\uFED6','\uFED8','\uFED7'],'\u0643':['\uFED9','\uFEDA','\uFEDC','\uFEDB'],
  '\u0644':['\uFEDD','\uFEDE','\uFEE0','\uFEDF'],'\u0645':['\uFEE1','\uFEE2','\uFEE4','\uFEE3'],
  '\u0646':['\uFEE5','\uFEE6','\uFEE8','\uFEE7'],'\u0647':['\uFEE9','\uFEEA','\uFEEC','\uFEEB'],
  '\u0648':['\uFEED','\uFEEE','\uFEEE','\uFEED'],'\u064A':['\uFEF1','\uFEF2','\uFEF4','\uFEF3'],
  '\u0626':['\uFE81','\uFE82','\uFE84','\uFE83'],'\u0621':['\uFE80','\uFE80','\uFE80','\uFE80'],
  '\u0624':['\uFE85','\uFE86','\uFE86','\uFE85'],'\u0625':['\uFE87','\uFE88','\uFE88','\uFE87'],
  '\u0623':['\uFE83','\uFE84','\uFE84','\uFE83'],'\u0622':['\uFE81','\uFE82','\uFE82','\uFE81'],
  '\u0649':['\uFEEF','\uFEF0','\uFEF0','\uFEEF'],'\u0629':['\uFE93','\uFE94','\uFE94','\uFE93'],
  '\u0640':['\u0640','\u0640','\u0640','\u0640'],
};
const LAM_ALEF = {'\u0644\u0627':'\uFEFB','\u0644\u0623':'\uFEF5','\u0644\u0625':'\uFEF7','\u0644\u0622':'\uFEF9'};
const PF_TO_LOGICAL = {};
for (const [l,forms] of Object.entries(AR_FORMS)){const lcp=l.charCodeAt(0);for(const f of forms)PF_TO_LOGICAL[f.charCodeAt(0)]=[lcp];}
for (const [pair,form] of Object.entries(LAM_ALEF)) PF_TO_LOGICAL[form.charCodeAt(0)]=[pair.charCodeAt(0),pair.charCodeAt(1)];

function isJoiner(ch){
  const nj='\u0627\u062F\u0630\u0631\u0632\u0648\u0624\u0625\u0623\u0622',cp=ch.charCodeAt(0);
  return((cp>=0x0600&&cp<=0x06FF)||(cp>=0xFE70&&cp<=0xFEFF))&&!nj.includes(ch)&&ch!=='\u0621';
}
function ar(text){
  if(!/[\u0600-\u06FF]/.test(text)) return text;
  let s=text;
  for(const[p,f]of Object.entries(LAM_ALEF))s=s.replace(new RegExp(p,'g'),f);
  const c=[...s];
  return c.map((ch,i)=>{
    const f=AR_FORMS[ch];if(!f)return ch;
    const pj=i>0&&isJoiner(c[i-1])&&AR_FORMS[c[i-1]];
    const nj=i<c.length-1&&isJoiner(c[i+1])&&AR_FORMS[c[i+1]];
    if(!pj&&nj)return f[3];if(pj&&nj)return f[2];if(pj&&!nj)return f[1];return f[0];
  }).join('');
}
function fixU(doc){
  const font=doc._font;if(!font||!font.unicode)return;
  for(let i=0;i<font.unicode.length;i++){const c=font.unicode[i];if(c&&c.length===1&&PF_TO_LOGICAL[c[0]])font.unicode[i]=PF_TO_LOGICAL[c[0]];}
}
function formatDate(d){const dt=new Date(d);return`${String(dt.getDate()).padStart(2,'0')}-${String(dt.getMonth()+1).padStart(2,'0')}-${dt.getFullYear()}`;}
function formatAmount(v){const n=parseFloat(v);return isNaN(n)?String(v):String(Math.round(n));}
// ─────────────────────────────────────────────────────────────────────────────

router.get('/', authenticate, authorize('admin', 'ops'), async (req, res) => {
  const { date, driver_id, station_id } = req.query;
  let sql = `SELECT p.id, p.driver_id, p.attendance_id, p.penalty_date, p.reason, p.amount, p.created_at,
             u.full_name as driver_name, u.phone as driver_phone, u.station_id
             FROM penalties p JOIN users u ON p.driver_id = u.id WHERE 1=1`;
  const params = []; let pIdx = 1;
  if (date) { sql += ` AND p.penalty_date = $${pIdx++}`; params.push(date); }
  if (driver_id) { sql += ` AND p.driver_id = $${pIdx++}`; params.push(parseInt(driver_id)); }
  if (req.user.role === 'ops') { sql += ` AND u.station_id = $${pIdx++}`; params.push(req.user.station_id); }
  else if (station_id) { sql += ` AND u.station_id = $${pIdx++}`; params.push(parseInt(station_id)); }
  sql += ' ORDER BY p.created_at DESC';
  res.json(await queryAll(sql, params));
});

router.get('/stats', authenticate, authorize('admin', 'ops'), async (req, res) => {
  const today = new Date();
  const dateStr = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');
  let sql = 'SELECT COUNT(*) as count, COALESCE(SUM(amount),0) as total FROM penalties p JOIN users u ON p.driver_id = u.id WHERE p.penalty_date = $1';
  const params = [dateStr];
  if (req.user.role === 'ops' && req.user.station_id) { sql += ' AND u.station_id = $2'; params.push(req.user.station_id); }
  const stats = await queryOne(sql, params);
  res.json({ count: parseInt(stats.count), total: parseFloat(stats.total), date: dateStr });
});

router.get('/my', authenticate, authorize('driver'), async (req, res) => {
  res.json(await queryAll(
    `SELECT p.id, p.attendance_id, p.penalty_date, p.reason, p.amount, p.created_at
     FROM penalties p WHERE p.driver_id = $1 ORDER BY p.created_at DESC LIMIT 50`,
    [req.user.id]
  ));
});

router.get('/:id/report', authenticate, async (req, res) => {
  try {
    const penalty = await queryOne(
      `SELECT p.id, p.penalty_date, p.reason, p.amount, p.created_at, p.driver_id,
              u.full_name as driver_name, u.phone as driver_phone, u.license_plate,
              a.scan_time FROM penalties p JOIN users u ON p.driver_id = u.id
              LEFT JOIN attendance a ON p.attendance_id = a.id WHERE p.id = $1`,
      [parseInt(req.params.id)]
    );
    if (!penalty) return res.status(404).json({ error: 'Penalty not found' });
    if (req.user.role === 'driver' && penalty.driver_id !== req.user.id)
      return res.status(403).json({ error: 'Unauthorized' });

    const PDFDocument = require('pdfkit');
    const fs = require('fs');

    const doc = new PDFDocument({ size:'A4', margin:0, info:{ Title:'Penalty Report', Author:'DriverTRACK' } });
    const fontsDir = path.join(__dirname, '..', '..', 'fonts');
    doc.registerFont('ArR', path.join(fontsDir, 'NotoSansArabic-Regular.ttf'));
    doc.registerFont('ArB', path.join(fontsDir, 'NotoSansArabic-Bold.ttf'));

    let logoPath = path.join(__dirname, '..', '..', '..', 'frontend', 'dist', 'NAVEXlogo.png');
    if (!fs.existsSync(logoPath)) {
      const alt = path.join(__dirname, '..', '..', '..', 'frontend', 'public', 'NAVEXlogo.png');
      if (fs.existsSync(alt)) logoPath = alt; else logoPath = null;
    }

    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="penalty-${penalty.id}.pdf"`);
      res.send(Buffer.concat(chunks));
    });
    doc.on('error', e => { throw e; });

    const PL=50, PR=50, PT=40, W=595-PL-PR;
    let y = PT;

    // Logo
    if (logoPath && fs.existsSync(logoPath)) {
      doc.image(logoPath, PL + W/2 - 55, y, { height:45 });
      y += 60;
    }

    // Title
    doc.font('ArB').fontSize(24).fillColor('#E53935')
       .text(ar('إشعار غرامة تأخير'), PL, y, { width:W, align:'center', lineBreak:false });
    fixU(doc); y += 40;

    // Divider
    doc.moveTo(PL,y).lineTo(PL+W,y).strokeColor('#E5E7EB').lineWidth(1).stroke(); y += 16;

    // Info rows
    function infoRow(label, value) {
      const LW = 120;
      doc.font('ArB').fontSize(11).fillColor('#374151')
         .text(ar(label), PL, y, { width:LW, align:'right', lineBreak:false });
      fixU(doc);
      const isAr = /[\u0600-\u06FF]/.test(String(value));
      doc.font('ArR').fontSize(11).fillColor('#111827')
         .text(isAr ? ar(String(value)) : String(value), PL+LW+8, y, { width:W-LW-8, align:'right', lineBreak:false });
      fixU(doc);
      y += 22;
    }
    infoRow('السائق:', penalty.driver_name);
    infoRow('رقم الهاتف:', penalty.driver_phone || '---');
    infoRow('تاريخ المخالفة:', formatDate(penalty.penalty_date));

    y += 6;
    doc.moveTo(PL,y).lineTo(PL+W,y).strokeColor('#E5E7EB').lineWidth(1).stroke(); y += 20;

    // Body paragraphs — use lineBreak:true + doc.y to track real height
    const amount = formatAmount(penalty.amount);

    function bodyPara(text, gap=14) {
      doc.font('ArR').fontSize(12).fillColor('#111827')
         .text(ar(text), PL, y, { width:W, align:'right', lineBreak:true, lineGap:3 });
      fixU(doc);
      y = doc.y + gap;
    }

    bodyPara('نحيطكم علمًا بأنه تم تسجيل غرامة مالية بسبب التأخر عن الموعد المحدد للحضور.');

    // Amount: digits kept outside ar() so they are never reversed
    const amountLine =
      ar('كما نود إعلامكم بأنه، وكنتيجة لهذا التأخير، سيتم احتساب ربح التوصيل الخاص بكم لهذا اليوم بمبلغ ') +
      amount + ' ' + ar('دج فقط عن كل طرد يتم توصيله.');
    doc.font('ArR').fontSize(12).fillColor('#111827')
       .text(amountLine, PL, y, { width:W, align:'right', lineBreak:true, lineGap:3 });
    fixU(doc); y = doc.y + 14;

    bodyPara('نرجو الالتزام بالمواعيد المحددة مستقبلاً لتفادي أي إجراءات أو خصومات مماثلة.');
    bodyPara('مع الشكر والتقدير.', 20);

    // Footer
    doc.moveTo(PL,y).lineTo(PL+W,y).strokeColor('#E5E7EB').lineWidth(1).stroke(); y += 12;
    const now = new Date().toLocaleString('ar-DZ');
    const footer = ar('تم إصدار هذا التقرير بواسطة') + ' DriverTRACK \u2014 ' + now;
    doc.font('ArR').fontSize(8).fillColor('#9CA3AF')
       .text(footer, PL, y, { width:W, align:'center', lineBreak:false });
    fixU(doc);

    doc.end();
  } catch (err) {
    console.error('PDF error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate report: ' + err.message });
  }
});

module.exports = router;
