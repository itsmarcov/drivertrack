const express = require('express');
const path = require('path');
const { queryAll, queryOne, run } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// ── Arabic reshaper (same as penalties) ──
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
// ─────────────────────────────────────────────────────────────────────────────

router.get('/', authenticate, async (req, res) => {
  const { status, driver_id, station_id, search } = req.query;
  const params = []; let pIdx = 1;
  let sql = `SELECT w.id, w.driver_id, w.admin_id, w.title, w.content, w.status,
             w.signed_at, w.archived_at, w.created_at, w.signature_data,
             u.full_name as driver_name, u.phone as driver_phone, u.license_plate, u.station_id,
             s.name as station_name,
             a.full_name as admin_name
             FROM warnings w
             JOIN users u ON w.driver_id = u.id
             LEFT JOIN stations s ON u.station_id = s.id
             JOIN users a ON w.admin_id = a.id
             WHERE 1=1`;
  if (req.user.role === 'driver') {
    sql += ` AND w.driver_id = $${pIdx++}`;
    params.push(req.user.id);
  }
  if (status) { sql += ` AND w.status = $${pIdx++}`; params.push(status); }
  if (driver_id) { sql += ` AND w.driver_id = $${pIdx++}`; params.push(parseInt(driver_id)); }
  if (station_id) { sql += ` AND u.station_id = $${pIdx++}`; params.push(parseInt(station_id)); }
  if (search) {
    sql += ` AND (u.full_name ILIKE $${pIdx} OR u.phone ILIKE $${pIdx} OR u.license_plate ILIKE $${pIdx})`;
    params.push(`%${search}%`);
    pIdx++;
  }
  sql += ' ORDER BY w.created_at DESC';
  res.json(await queryAll(sql, params));
});

router.get('/stats', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  const rows = await queryAll(`SELECT status, COUNT(*)::int as count FROM warnings GROUP BY status`);
  const stats = { pending: 0, signed: 0, archived: 0 };
  rows.forEach((r) => { stats[r.status] = r.count; });
  const total = await queryOne('SELECT COUNT(*)::int as count FROM warnings');
  res.json({ ...stats, total: total.count });
});

router.post('/', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  const { driver_ids, title, content } = req.body;
  if (!driver_ids || !title || !content) return res.status(400).json({ error: 'driver_ids, title and content are required' });
  const ids = Array.isArray(driver_ids) ? driver_ids : [driver_ids];
  const results = [];
  for (const driverId of ids) {
    const result = await run(
      'INSERT INTO warnings (driver_id, admin_id, title, content) VALUES ($1, $2, $3, $4)',
      [parseInt(driverId), req.user.id, title, content]
    );
    results.push(result.lastInsertRowid);
  }
  res.status(201).json({ created: results.length, ids: results });
});

router.get('/:id', authenticate, async (req, res) => {
  const warning = await queryOne(
    `SELECT w.*, u.full_name as driver_name, u.phone as driver_phone, u.license_plate, u.station_id,
            s.name as station_name,
            a.full_name as admin_name
     FROM warnings w
     JOIN users u ON w.driver_id = u.id
     LEFT JOIN stations s ON u.station_id = s.id
     JOIN users a ON w.admin_id = a.id
     WHERE w.id = $1`,
    [parseInt(req.params.id)]
  );
  if (!warning) return res.status(404).json({ error: 'Warning not found' });
  if (req.user.role === 'driver' && warning.driver_id !== req.user.id)
    return res.status(403).json({ error: 'Unauthorized' });
  res.json(warning);
});

router.patch('/:id/sign', authenticate, authorize('driver'), async (req, res) => {
  const warning = await queryOne('SELECT * FROM warnings WHERE id = $1', [parseInt(req.params.id)]);
  if (!warning) return res.status(404).json({ error: 'Warning not found' });
  if (warning.driver_id !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });
  if (warning.status !== 'pending') return res.status(400).json({ error: 'Warning already ' + warning.status });
  const { signature_data } = req.body;
  if (!signature_data) return res.status(400).json({ error: 'Signature data is required' });
  await run('UPDATE warnings SET status = $1, signed_at = NOW(), signature_data = $2 WHERE id = $3',
    ['signed', signature_data, warning.id]);
  res.json({ success: true });
});

router.patch('/:id/archive', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  const warning = await queryOne('SELECT * FROM warnings WHERE id = $1', [parseInt(req.params.id)]);
  if (!warning) return res.status(404).json({ error: 'Warning not found' });
  await run('UPDATE warnings SET status = $1, archived_at = NOW() WHERE id = $2', ['archived', warning.id]);
  res.json({ success: true });
});

router.patch('/:id/restore', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  const warning = await queryOne('SELECT * FROM warnings WHERE id = $1', [parseInt(req.params.id)]);
  if (!warning) return res.status(404).json({ error: 'Warning not found' });
  await run("UPDATE warnings SET status = 'pending', archived_at = NULL WHERE id = $1", [warning.id]);
  res.json({ success: true });
});

router.get('/:id/pdf', authenticate, async (req, res) => {
  try {
    const warning = await queryOne(
      `SELECT w.*, u.full_name as driver_name, u.phone as driver_phone, u.license_plate, u.station_id,
              s.name as station_name,
              a.full_name as admin_name
       FROM warnings w
       JOIN users u ON w.driver_id = u.id
       LEFT JOIN stations s ON u.station_id = s.id
       JOIN users a ON w.admin_id = a.id
       WHERE w.id = $1`,
      [parseInt(req.params.id)]
    );
    if (!warning) return res.status(404).json({ error: 'Warning not found' });
    if (req.user.role === 'driver' && warning.driver_id !== req.user.id)
      return res.status(403).json({ error: 'Unauthorized' });

    const PDFDocument = require('pdfkit');
    const fs = require('fs');
    const doc = new PDFDocument({ size:'A4', margin:0, info:{ Title:'Warning Report', Author:'DriverTRACK' } });
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
      res.setHeader('Content-Disposition', `attachment; filename="warning-${warning.id}.pdf"`);
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
    doc.font('ArB').fontSize(22).fillColor('#1a1a1a')
       .text(ar('إشعار إنذار'), PL, y, { width:W, align:'center', lineBreak:false });
    fixU(doc); y += 34;

    // Divider
    doc.moveTo(PL,y).lineTo(PL+W,y).strokeColor('#E53935').lineWidth(2).stroke(); y += 16;

    // Warning ID & Date
    doc.font('ArR').fontSize(9).fillColor('#9CA3AF')
       .text(ar('رقم الإشعار: #') + warning.id + '    ' + ar('تاريخ الإنشاء: ') + formatDate(warning.created_at), PL, y, { width:W, align:'center', lineBreak:false });
    fixU(doc); y += 24;

    // Info rows
    function infoRow(label, value) {
      const LW = 130;
      doc.font('ArB').fontSize(11).fillColor('#374151')
         .text(ar(label), PL, y, { width:LW, align:'right', lineBreak:false });
      fixU(doc);
      const isAr = /[\u0600-\u06FF]/.test(String(value));
      doc.font('ArR').fontSize(11).fillColor('#111827')
         .text(isAr ? ar(String(value)) : String(value), PL+LW+8, y, { width:W-LW-8, align:'right', lineBreak:false });
      fixU(doc);
      y += 22;
    }
    infoRow('السائق:', warning.driver_name);
    infoRow('رقم الهاتف:', warning.driver_phone || '---');
    if (warning.license_plate) infoRow('لوحة الترقيم:', warning.license_plate);
    if (warning.station_name) infoRow('المحطة:', warning.station_name);
    infoRow('تم الإصدار من:', warning.admin_name);

    y += 6;
    doc.moveTo(PL,y).lineTo(PL+W,y).strokeColor('#E5E7EB').lineWidth(1).stroke(); y += 16;

    // Title label
    doc.font('ArB').fontSize(14).fillColor('#E53935')
       .text(ar(warning.title), PL, y, { width:W, align:'right', lineBreak:false });
    fixU(doc); y += 28;

    // Content body with word wrap
    const LH = 22;
    function wrap(text, gap) {
      if (!text || text === '') { y += gap; return; }
      const words = text.split(' ');
      let line = '';
      for (const w of words) {
        const test = line ? line + ' ' + w : w;
        if (doc.widthOfString(test) > W && line) {
          doc.text(line, PL, y, { width: W, align: 'right', lineBreak: false });
          fixU(doc);
          y += LH; line = w;
        } else {
          line = test;
        }
      }
      if (line) { doc.text(line, PL, y, { width: W, align: 'right', lineBreak: false }); fixU(doc); y += LH; }
      y += gap;
    }
    doc.font('ArR').fontSize(12).fillColor('#374151');
    wrap(ar(warning.content), 16);

    // Signature section
    doc.moveTo(PL,y).lineTo(PL+W,y).strokeColor('#E5E7EB').lineWidth(1).stroke(); y += 16;

    doc.font('ArB').fontSize(11).fillColor('#111827')
       .text(ar('توقيع السائق:'), PL, y, { width:W, align:'right', lineBreak:false });
    fixU(doc); y += 6;

    if (warning.signature_data) {
      const sigData = warning.signature_data.replace(/^data:image\/\w+;base64,/, '');
      try {
        const sigImg = Buffer.from(sigData, 'base64');
        doc.image(sigImg, PL + W - 180, y, { width: 160, height: 50 });
        y += 60;
      } catch { y += 6; }
    } else if (warning.status === 'signed') {
      doc.font('ArR').fontSize(10).fillColor('#6B7280')
         .text(ar('تم التوقيع إلكترونيًا'), PL, y, { width:W, align:'right', lineBreak:false });
      fixU(doc);
      y += 22;
    }
    if (warning.signed_at) {
      doc.font('ArR').fontSize(10).fillColor('#6B7280')
         .text(ar('تاريخ التوقيع: ') + formatDate(warning.signed_at), PL, y, { width:W, align:'right', lineBreak:false });
      fixU(doc); y += 22;
    }

    y += 10;
    doc.moveTo(PL,y).lineTo(PL+W,y).strokeColor('#E5E7EB').lineWidth(1).stroke(); y += 12;

    // Footer
    const now = new Date().toLocaleString('ar-DZ');
    const footer = ar('تم إصدار هذا التقرير بواسطة') + ' DriverTRACK \u2014 ' + now;
    doc.font('ArR').fontSize(8).fillColor('#9CA3AF')
       .text(footer, PL, y, { width:W, align:'center', lineBreak:false });
    fixU(doc);

    doc.end();
  } catch (err) {
    console.error('Warning PDF error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate PDF: ' + err.message });
  }
});

module.exports = router;
