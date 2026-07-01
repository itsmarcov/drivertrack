CREATE TABLE IF NOT EXISTS stations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK(role IN ('super_admin', 'admin', 'ops', 'driver')),
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  vehicle_type VARCHAR(100),
  license_plate VARCHAR(50),
  station_id INTEGER REFERENCES stations(id),
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  driver_id INTEGER NOT NULL REFERENCES users(id),
  scanned_by INTEGER NOT NULL REFERENCES users(id),
  scan_date VARCHAR(20) NOT NULL,
  scan_time VARCHAR(20) NOT NULL,
  qr_signature TEXT NOT NULL,
  verified INTEGER DEFAULT 1,
  is_late INTEGER DEFAULT 0,
  lat DECIMAL(10,7),
  lng DECIMAL(10,7),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS penalties (
  id SERIAL PRIMARY KEY,
  driver_id INTEGER NOT NULL REFERENCES users(id),
  attendance_id INTEGER REFERENCES attendance(id),
  penalty_date VARCHAR(20) NOT NULL,
  reason VARCHAR(255) NOT NULL,
  amount DECIMAL(10,2) NOT NULL DEFAULT 150.00,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(100) PRIMARY KEY,
  value VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO settings (key, value) VALUES ('morning_late_cutoff', '10:00:00') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('morning_absent_cutoff', '12:30:00') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('evening_late_cutoff', '16:00:00') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('evening_absent_cutoff', '17:30:00') ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS absences (
  id SERIAL PRIMARY KEY,
  driver_id INTEGER NOT NULL REFERENCES users(id),
  absence_date VARCHAR(20) NOT NULL,
  shift VARCHAR(20) NOT NULL,
  marked_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(driver_id, absence_date)
);

CREATE TABLE IF NOT EXISTS justifications (
  id SERIAL PRIMARY KEY,
  driver_id INTEGER NOT NULL REFERENCES users(id),
  attendance_date VARCHAR(20) NOT NULL,
  reason VARCHAR(50) NOT NULL,
  note TEXT,
  proof_file VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending',
  admin_note TEXT,
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(driver_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_driver ON attendance(driver_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(scan_date);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
