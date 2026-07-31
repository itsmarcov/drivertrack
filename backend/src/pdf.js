const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const CHROME_PATHS = [
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/snap/bin/chromium',
];

function findChrome() {
  for (const p of CHROME_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  try {
    const bundled = puppeteer.executablePath();
    if (bundled && fs.existsSync(bundled)) return bundled;
  } catch {}
  return null;
}

let browserPromise = null;
async function getBrowser() {
  if (!browserPromise) {
    const executablePath = findChrome();
    if (!executablePath) {
      throw new Error(
        'Chrome/Chromium not found. Install it with:\n' +
        '  sudo apt update && sudo apt install chromium-browser -y\n' +
        'Or download manually from https://www.chromium.org/getting-involved/download-chromium'
      );
    }
    browserPromise = puppeteer.launch({
      headless: true,
      executablePath,
      args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    }).catch(e => {
      browserPromise = null;
      throw e;
    });
  }
  return browserPromise;
}

const fontsDir = path.join(__dirname, '..', 'fonts');
const FONTS = {
  ArR: fs.readFileSync(path.join(fontsDir, 'NotoSansArabic-Regular.ttf')).toString('base64'),
  ArB: fs.readFileSync(path.join(fontsDir, 'NotoSansArabic-Bold.ttf')).toString('base64'),
};

function logoUri() {
  const paths = [
    path.join(__dirname, '..', '..', 'frontend', 'dist', 'NAVEXlogo.png'),
    path.join(__dirname, '..', '..', 'frontend', 'public', 'NAVEXlogo.png'),
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) {
      const buf = fs.readFileSync(p);
      return `data:image/png;base64,${buf.toString('base64')}`;
    }
  }
  return null;
}

const SHEET = `
@page { size: A4; margin: 36px 48px; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { direction: rtl; font-family: 'ArR', sans-serif; color: #374151; }
@font-face { font-family: 'ArR'; src: url(data:font/ttf;base64,${FONTS.ArR}) format('truetype'); }
@font-face { font-family: 'ArB'; src: url(data:font/ttf;base64,${FONTS.ArB}) format('truetype'); font-weight: bold; }
.logo { text-align: center; margin-bottom: 24px; }
.logo img { height: 45px; }
.title { font-family: 'ArB'; font-size: 22px; color: #1a1a1a; text-align: center; }
.title-lg { font-family: 'ArB'; font-size: 24px; color: #E53935; text-align: center; }
.divider-red { border: none; border-top: 2px solid #E53935; margin: 12px 0; }
.divider-gray { border: none; border-top: 1px solid #E5E7EB; margin: 8px 0; }
.meta { font-size: 9px; color: #9CA3AF; text-align: center; margin-bottom: 16px; }
.info-row { display: flex; margin-bottom: 6px; font-size: 11px; }
.info-label { font-family: 'ArB'; color: #374151; min-width: 130px; text-align: right; }
.info-value { color: #111827; flex: 1; text-align: right; padding-right: 8px; }
.body-title { font-family: 'ArB'; font-size: 14px; color: #E53935; text-align: right; margin-bottom: 12px; }
.content { font-size: 12px; line-height: 1.8; text-align: right; white-space: pre-wrap; }
.sig-label { font-family: 'ArB'; font-size: 11px; color: #111827; text-align: right; margin-bottom: 4px; }
.sig-img { text-align: right; margin-bottom: 6px; }
.sig-img img { max-width: 160px; height: 50px; }
.sig-text { font-size: 10px; color: #6B7280; text-align: right; }
.footer { font-size: 8px; color: #9CA3AF; text-align: center; margin-top: 10px; }
.q-title { font-family: 'ArB'; font-size: 20px; color: #E53935; text-align: center; margin: 8px 0 2px; }
.q-desc { font-size: 11px; color: #6B7280; text-align: center; margin-bottom: 14px; white-space: pre-wrap; }
.q-meta { font-size: 9px; color: #9CA3AF; text-align: center; margin-bottom: 14px; }
.q-question { margin-top: 16px; padding: 10px 12px; border: 1px solid #E5E7EB; border-radius: 6px; }
.q-question-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.q-question-num { font-family: 'ArB'; font-size: 11px; background: #E53935; color: #fff; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; }
.q-question-text { font-family: 'ArB'; font-size: 13px; color: #111827; flex: 1; }
.q-type-badge { font-size: 9px; color: #6B7280; background: #F3F4F6; padding: 2px 8px; border-radius: 10px; white-space: nowrap; }
.q-table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 4px; }
.q-table th { background: #F9FAFB; font-family: 'ArB'; color: #374151; text-align: right; padding: 6px 8px; border: 1px solid #E5E7EB; }
.q-table td { padding: 6px 8px; border: 1px solid #E5E7EB; color: #111827; vertical-align: top; }
.q-answer-text { white-space: pre-wrap; }
.q-no-data { font-size: 11px; color: #9CA3AF; text-align: center; padding: 12px 0; }
`;

function html(head, body) {
  return `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><style>${SHEET}</style>${head || ''}</head><body>${body}</body></html>`;
}

function infoRow(label, value) {
  return `<div class="info-row"><div class="info-label">${label}</div><div class="info-value">${value}</div></div>`;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(d) {
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}-${String(dt.getMonth() + 1).padStart(2, '0')}-${dt.getFullYear()}`;
}

function formatAmount(v) {
  const n = parseFloat(v);
  return isNaN(n) ? String(v) : String(Math.round(n));
}

async function generatePdf(htmlContent) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'load', timeout: 30000 });
  const raw = await page.pdf({ format: 'A4', printBackground: true });
  await page.close();
  const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
  if (buf.length < 200) throw new Error('Generated PDF is too small (' + buf.length + ' bytes)');
  const header = buf.slice(0, 5).toString();
  if (header !== '%PDF-') throw new Error('Generated output is not a valid PDF (header: ' + header + ')');
  return buf;
}

function warningHtml(w) {
  const logoSrc = logoUri();
  const logoBlock = logoSrc ? `<div class="logo"><img src="${logoSrc}" alt=""></div>` : '';
  const infoRows = [
    infoRow('السائق:', escapeHtml(w.driver_name)),
    infoRow('رقم الهاتف:', escapeHtml(w.driver_phone || '---')),
  ];
  if (w.license_plate) infoRows.push(infoRow('لوحة الترقيم:', escapeHtml(w.license_plate)));
  if (w.station_name) infoRows.push(infoRow('المحطة:', escapeHtml(w.station_name)));
  infoRows.push(infoRow('تم الإصدار من:', escapeHtml(w.admin_name)));

  let sigBlock = '';
  if (w.signature_data) {
    sigBlock = `<div class="sig-img"><img src="${w.signature_data}" alt="signature"></div>`;
  } else if (w.status === 'signed') {
    sigBlock = `<div class="sig-text">تم التوقيع إلكترونيًا</div>`;
  }
  if (w.signed_at) {
    sigBlock += `<div class="sig-text" style="margin-top:4px;">تاريخ التوقيع: ${formatDate(w.signed_at)}</div>`;
  }

  return html('', `
    ${logoBlock}
    <div class="title">إشعار إنذار</div>
    <hr class="divider-red">
    <div class="meta">رقم الإشعار: #${escapeHtml(w.id)}    تاريخ الإنشاء: ${formatDate(w.created_at)}</div>
    ${infoRows.join('\n')}
    <hr class="divider-gray">
    <div class="body-title">${escapeHtml(w.title)}</div>
    <div class="content">${escapeHtml(w.content)}</div>
    <hr class="divider-gray">
    <div class="sig-label">توقيع السائق:</div>
    ${sigBlock}
    <hr class="divider-gray">
    <div class="footer">تم إصدار هذا التقرير بواسطة DriverTRACK — ${new Date().toLocaleString('ar-DZ')}</div>
  `);
}

function penaltyHtml(p) {
  const logoSrc = logoUri();
  const logoBlock = logoSrc ? `<div class="logo"><img src="${logoSrc}" alt=""></div>` : '';
  const amount = formatAmount(p.amount);

  return html('', `
    ${logoBlock}
    <div class="title-lg">إشعار غرامة تأخير</div>
    <hr class="divider-gray">
    ${infoRow('السائق:', escapeHtml(p.driver_name))}
    ${infoRow('رقم الهاتف:', escapeHtml(p.driver_phone || '---'))}
    ${infoRow('تاريخ المخالفة:', formatDate(p.penalty_date))}
    <hr class="divider-gray">
    <div class="content">نحيطكم علمًا بأنه تم تسجيل غرامة مالية بسبب التأخر عن الموعد المحدد للحضور.</div>
    <div class="content" style="margin-top:8px;">كما نود إعلامكم بأنه، وكنتيجة لهذا التأخير، سيتم احتساب ربح التوصيل الخاص بكم لهذا اليوم بمبلغ ${amount} دج فقط عن كل طرد يتم توصيله.</div>
    <div class="content" style="margin-top:8px;">نرجو الالتزام بالمواعيد المحددة مستقبلاً لتفادي أي إجراءات أو خصومات مماثلة.</div>
    <div class="content" style="margin-top:8px;">مع الشكر والتقدير.</div>
    <hr class="divider-gray">
    <div class="footer">تم إصدار هذا التقرير بواسطة DriverTRACK — ${new Date().toLocaleString('ar-DZ')}</div>
  `);
}

function questionTypeLabel(type) {
  const m = { text: 'إجابة نصية', choice: 'اختيار من متعدد', rating: 'تقييم' };
  return m[type] || type;
}

function formatRating(v) {
  const n = Number(v);
  if (isNaN(n)) return escapeHtml(String(v));
  const full = Math.round(n);
  let stars = '';
  for (let i = 1; i <= 5; i++) stars += i <= full ? '★' : '☆';
  return `${stars} (${n})`;
}

function formatAnswer(answer, type) {
  if (answer === undefined || answer === null || answer === '') return '<span style="color:#9CA3AF;">بدون إجابة</span>';
  if (type === 'rating') return formatRating(answer);
  return escapeHtml(String(answer));
}

function questionnaireReportHtml(q, questions, responses) {
  const logoSrc = logoUri();
  const logoBlock = logoSrc ? `<div class="logo"><img src="${logoSrc}" alt=""></div>` : '';

  const questionBlocks = questions.map((qq, idx) => {
    const tableRows = responses.length === 0
      ? `<tr><td colspan="3" class="q-no-data">لا توجد إجابات بعد</td></tr>`
      : responses.map((r) => `
          <tr>
            <td>${escapeHtml(r.driver_name)}</td>
            <td style="white-space:nowrap;">${escapeHtml(r.driver_phone || '---')}</td>
            <td class="q-answer-text">${formatAnswer(r.answers[qq.id], qq.question_type)}</td>
          </tr>
        `).join('\n');

    return `
      <div class="q-question">
        <div class="q-question-head">
          <span class="q-question-num">${idx + 1}</span>
          <span class="q-question-text">${escapeHtml(qq.question_text)}</span>
          <span class="q-type-badge">${questionTypeLabel(qq.question_type)}</span>
        </div>
        <table class="q-table">
          <thead>
            <tr>
              <th style="width:30%;">السائق</th>
              <th style="width:20%;">الهاتف</th>
              <th>الإجابة</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    `;
  }).join('\n');

  return html('', `
    ${logoBlock}
    <div class="title">تقرير استبيان</div>
    <div class="q-title">${escapeHtml(q.title)}</div>
    ${q.description ? `<div class="q-desc">${escapeHtml(q.description)}</div>` : ''}
    <div class="q-meta">تاريخ الإصدار: ${formatDate(new Date())} — عدد الإجابات: ${responses.length}</div>
    <hr class="divider-red">
    ${questionBlocks}
    <hr class="divider-gray">
    <div class="footer">تم إصدار هذا التقرير بواسطة DriverTRACK — ${new Date().toLocaleString('ar-DZ')}</div>
  `);
}

module.exports = { generatePdf, warningHtml, penaltyHtml, questionnaireReportHtml };
