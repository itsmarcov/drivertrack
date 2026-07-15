process.env.TZ = 'Africa/Algiers';

require('express-async-errors');
const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { initDatabase, queryAll, queryOne, run } = require('./database');

const authRoutes = require('./routes/auth');
const driverRoutes = require('./routes/drivers');
const { router: qrRoutes } = require('./routes/qr');
const attendanceRoutes = require('./routes/attendance');
const stationRoutes = require('./routes/stations');
const penaltyRoutes = require('./routes/penalties');
const settingsRoutes = require('./routes/settings');
const absenceRoutes = require('./routes/absences');
const absenceRequestRoutes = require('./routes/absence_requests');
const analyticsRoutes = require('./routes/analytics');
const justificationRoutes = require('./routes/justifications');
const notificationRoutes = require('./routes/notifications');
const activityLogRoutes = require('./routes/activity_logs');
const announcementRoutes = require('./routes/announcements');
const tempClearRoutes = require('./routes/temp_clear');

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

app.set('trust proxy', 1);

app.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] === 'http') {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  next();
});

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://drivertrack-qlsq.onrender.com', 'https://navexdrivertrack.com', 'capacitor://localhost', 'http://localhost']
    : ['http://localhost:5173', 'http://localhost:5000'],
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/stations', stationRoutes);
app.use('/api/penalties', penaltyRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/absences', absenceRoutes);
app.use('/api/absence-requests', absenceRequestRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/justifications', justificationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/activity-logs', activityLogRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/admin', tempClearRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/config/public', (req, res) => {
  res.json({ recaptcha_site_key: process.env.RECAPTCHA_SITE_KEY || '' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err?.message || err);
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'حجم الطلب كبير جداً.' });
  }
  res.status(err?.status || 500).json({ error: err?.message || 'Internal server error.' });
});

const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(frontendDist));
app.get('*', (req, res) => {
  const indexPath = path.join(frontendDist, 'index.html');
  if (!req.accepts('html')) return res.status(404).end();
  const html = require('fs').readFileSync(indexPath, 'utf8');
  const apiUrl = process.env.PUBLIC_API_URL || '';
  const injected = html.replace('</head>', `<script>window.API_URL='${apiUrl}'</script></head>`);
  res.type('html').send(injected);
});

function getLocalIP() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

async function seedInitialData() {
  const bcrypt = require('bcryptjs');

  const deleteUser = async (username) => {
    const user = await queryOne('SELECT id FROM users WHERE username = $1', [username]);
    if (user) {
      await run('DELETE FROM penalties WHERE driver_id = $1', [user.id]);
      await run('DELETE FROM attendance WHERE driver_id = $1', [user.id]);
      await run('DELETE FROM attendance WHERE scanned_by = $1', [user.id]);
      await run('DELETE FROM absences WHERE driver_id = $1', [user.id]);
      await run('DELETE FROM absence_requests WHERE driver_id = $1', [user.id]);
      await run('DELETE FROM justifications WHERE driver_id = $1', [user.id]);
      await run('DELETE FROM users WHERE id = $1', [user.id]);
      console.log('  \u2713 Default user removed: ' + username);
    }
  };

  await deleteUser('ops1');
  await deleteUser('driver1');
  await deleteUser('driver2');

  const admin = await queryOne("SELECT id FROM users WHERE username = 'admin'");
  if (!admin) {
    const hash = bcrypt.hashSync('Admin@123', 10);
    await run(`INSERT INTO users (username, password_hash, role, full_name, email) VALUES ($1, $2, 'admin', $3, $4)`,
      ['admin', hash, 'System Administrator', 'admin@drivertrack.com']);
    console.log('  \u2713 Default admin created (username: admin, password: Admin@123)');
  }

  const newAdmin = await queryOne("SELECT id FROM users WHERE username = 'kebaili'");
  if (!newAdmin) {
    const hash = bcrypt.hashSync('Hanane2026@', 10);
    await run(`INSERT INTO users (username, password_hash, role, full_name, email) VALUES ($1, $2, 'admin', $3, $4)`,
      ['kebaili', hash, 'KEBAILI HANANE', 'kebaili@drivertrack.com']);
    console.log('  \u2713 Admin KEBAILI HANANE created (username: kebaili)');
  }

  const mounir = await queryOne("SELECT id FROM users WHERE username = 'mounir'");
  if (!mounir) {
    const hash = bcrypt.hashSync('Mounir2026@', 10);
    await run(`INSERT INTO users (username, password_hash, role, full_name, email) VALUES ($1, $2, 'super_admin', $3, $4)`,
      ['mounir', hash, 'Mounir Rassoul', 'mounir@drivertrack.com']);
    console.log('  \u2713 Super Admin Mounir Rassoul created (username: mounir)');
  }

  const ghazi = await queryOne("SELECT id FROM users WHERE username = 'ghazi'");
  if (!ghazi) {
    const hash = bcrypt.hashSync('Ghazi2026@', 10);
    await run(`INSERT INTO users (username, password_hash, role, full_name, email) VALUES ($1, $2, 'super_admin', $3, $4)`,
      ['ghazi', hash, 'GHAZI IMAD SA', 'ghazi@drivertrack.com']);
    console.log('  \u2713 Super Admin GHAZI IMAD SA created (username: ghazi)');
  }
}

async function start() {
  console.log('\n\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557');
  console.log('\u2551        DriverTRACK - Backend Server      \u2551');
  console.log('\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d');

  const fs = require('fs');
  const uploadDir = path.join(__dirname, '..', 'uploads', 'justifications');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  await initDatabase();
  await seedInitialData();

  const localIP = getLocalIP();

  app.listen(PORT, HOST, () => {
    console.log(`\n  \u{1F4BB} Local:    http://localhost:${PORT}`);
    console.log(`  \u{1F310} Network:  http://${localIP}:${PORT}`);
    console.log(`  \u{1F4E1} API:      http://localhost:${PORT}/api`);
    console.log(`  \u{1F4C5} DB:       PostgreSQL (${process.env.DATABASE_URL ? 'configured' : 'missing DATABASE_URL'})`);
    console.log('');
    console.log(`  \u{1F6A7} Network access: All devices on LAN can connect via the Network URL`);
    console.log('');
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
