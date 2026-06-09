CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK(role IN ('admin', 'ops', 'driver')),
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  vehicle_type VARCHAR(100),
  license_plate VARCHAR(50),
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
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_driver ON attendance(driver_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(scan_date);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
