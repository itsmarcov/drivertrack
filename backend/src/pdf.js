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
  await page.setContent(htmlContent, { waitUntil: 'networkidle0', timeout: 30000 });
  const buf = await page.pdf({ format: 'A4', printBackground: true });
  await page.close();
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

module.exports = { generatePdf, warningHtml, penaltyHtml };
