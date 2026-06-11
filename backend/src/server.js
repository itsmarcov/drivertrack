const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { initDatabase, queryAll, queryOne, run } = require('./database');

const authRoutes = require('./routes/auth');
const driverRoutes = require('./routes/drivers');
const qrRoutes = require('./routes/qr');
const attendanceRoutes = require('./routes/attendance');
const stationRoutes = require('./routes/stations');
const penaltyRoutes = require('./routes/penalties');

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/stations', stationRoutes);
app.use('/api/penalties', penaltyRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(frontendDist));
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
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
  const admin = await queryOne("SELECT id FROM users WHERE username = 'admin'");
  if (!admin) {
    const hash = bcrypt.hashSync('Admin@123', 10);
    await run(`INSERT INTO users (username, password_hash, role, full_name, email) VALUES ($1, $2, 'admin', $3, $4)`,
      ['admin', hash, 'System Administrator', 'admin@drivertrack.com']);
    console.log('  \u2713 Default admin created (username: admin, password: Admin@123)');
  }
  const ops = await queryOne("SELECT id FROM users WHERE username = 'ops1'");
  if (!ops) {
    const hash = bcrypt.hashSync('Ops@123', 10);
    await run(`INSERT INTO users (username, password_hash, role, full_name, email) VALUES ($1, $2, 'ops', $3, $4)`,
      ['ops1', hash, 'Operations Agent', 'ops@drivertrack.com']);
    console.log('  \u2713 Default OPS agent created (username: ops1, password: Ops@123)');
  }
  const driver1 = await queryOne("SELECT id FROM users WHERE username = 'driver1'");
  if (!driver1) {
    const hash = bcrypt.hashSync('Driver@123', 10);
    await run(`INSERT INTO users (username, password_hash, role, full_name, email, phone, vehicle_type, license_plate) VALUES ($1, $2, 'driver', $3, $4, $5, $6, $7)`,
      ['driver1', hash, 'Ahmed Ali', 'ahmed@example.com', '0501234567', 'Motorcycle', 'ABC-123']);
    console.log('  \u2713 Default driver created (username: driver1, password: Driver@123)');
  }
  const driver2 = await queryOne("SELECT id FROM users WHERE username = 'driver2'");
  if (!driver2) {
    const hash = bcrypt.hashSync('Driver@123', 10);
    await run(`INSERT INTO users (username, password_hash, role, full_name, email, phone, vehicle_type, license_plate) VALUES ($1, $2, 'driver', $3, $4, $5, $6, $7)`,
      ['driver2', hash, 'Sara Khalid', 'sara@example.com', '0559876543', 'Car', 'XYZ-789']);
    console.log('  \u2713 Default driver created (username: driver2, password: Driver@123)');
  }
}

async function start() {
  console.log('\n\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557');
  console.log('\u2551        DriverTRACK - Backend Server      \u2551');
  console.log('\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d');

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
