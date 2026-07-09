const express = require('express');
const ExcelJS = require('exceljs');
const { queryAll, queryOne, run } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');
const { getShiftCutoffs } = require('./qr');

const router = express.Router();

router.post('/mark-late', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  const { attendance_id, reason } = req.body;
  if (!attendance_id) return res.status(400).json({ error: 'attendance_id مطلوب' });
  if (!reason || !reason.trim()) return res.status(400).json({ error: 'السبب مطلوب' });

  const att = await queryOne(
    `SELECT a.id, a.driver_id, a.is_late, a.scan_date, u.full_name as driver_name
     FROM attendance a JOIN users u ON a.driver_id = u.id WHERE a.id = $1`,
    [attendance_id]
  );
  if (!att) return res.status(404).json({ error: 'تسجيل الحضور غير موجود' });
  if (att.is_late) return res.status(400).json({ error: 'هذا السائق مسجل كمتأخر بالفعل' });

  await run('UPDATE attendance SET is_late = 1, late_reason = $1, source = CASE WHEN source = \'qr\' THEN \'qr\' ELSE source END WHERE id = $2',
    [reason.trim(), attendance_id]);

  const existingPenalty = await queryOne('SELECT id FROM penalties WHERE attendance_id = $1', [attendance_id]);
  if (!existingPenalty) {
    await run(
      "INSERT INTO penalties (driver_id, attendance_id, penalty_date, reason, amount) VALUES ($1, $2, $3, $4, $5)",
      [att.driver_id, attendance_id, att.scan_date, `تأخر بتسجيل المدير: ${reason.trim()}`, 150]
    );
  }

  const record = await queryOne(
    `SELECT a.id, a.driver_id, a.scanned_by, a.scan_date, a.scan_time, a.is_late, a.late_reason, a.source,
            u.full_name as driver_name, s.full_name as scanned_by_name
     FROM attendance a
     JOIN users u ON a.driver_id = u.id
     JOIN users s ON a.scanned_by = s.id
     WHERE a.id = $1`,
    [attendance_id]
  );

  res.json({ message: `تم تسجيل تأخير ${att.driver_name}`, record });
});

router.post('/manual', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  const { driver_id } = req.body;
  if (!driver_id) return res.status(400).json({ error: 'driver_id مطلوب' });

  const driver = await queryOne("SELECT id, full_name, is_active, shift FROM users WHERE id = $1 AND role = 'driver'", [driver_id]);
  if (!driver) return res.status(404).json({ error: 'السائق غير موجود' });
  if (!driver.is_active) return res.status(400).json({ error: 'حساب السائق غير نشط' });

  const today = new Date();
  const dateStr = today.getFullYear() + '-' +
    String(today.getMonth() + 1).padStart(2, '0') + '-' +
    String(today.getDate()).padStart(2, '0');

  const existing = await queryOne('SELECT id FROM attendance WHERE driver_id = $1 AND scan_date = $2', [driver_id, dateStr]);
  if (existing) return res.status(409).json({ error: 'تم تسجيل حضور هذا السائق اليوم بالفعل' });

  const time = String(today.getHours()).padStart(2, '0') + ':' +
               String(today.getMinutes()).padStart(2, '0') + ':' +
               String(today.getSeconds()).padStart(2, '0');

  const cutoffs = await getShiftCutoffs(driver.shift);
  const late = time > cutoffs.late_cutoff ? 1 : 0;

  const result = await run(
    `INSERT INTO attendance (driver_id, scanned_by, scan_date, scan_time, qr_signature, is_late, source)
     VALUES ($1, $2, $3, $4, $5, $6, 'manual')`,
    [driver_id, req.user.id, dateStr, time, 'manual', late]
  );

  let penalty = null;
  if (late) {
    const penResult = await run(
      "INSERT INTO penalties (driver_id, attendance_id, penalty_date, reason, amount) VALUES ($1, $2, $3, $4, $5)",
      [driver_id, result.lastInsertRowid, dateStr, `تأخر عن الحضور (${time})`, 150]
    );
    penalty = await queryOne('SELECT * FROM penalties WHERE id = $1', [penResult.lastInsertRowid]);
  }

  const record = await queryOne(
    `SELECT a.id, a.driver_id, a.scanned_by, a.scan_date, a.scan_time, a.verified, a.is_late, a.source,
            u.full_name as driver_name
     FROM attendance a
     JOIN users u ON a.driver_id = u.id
     WHERE a.id = $1`,
    [result.lastInsertRowid]
  );

  res.status(201).json({ message: `تم تسجيل حضور ${driver.full_name} يدوياً`, record, penalty });
});

router.get('/', authenticate, authorize('admin', 'ops', 'super_admin'), async (req, res) => {
  const { date, driver_id, station_id } = req.query;
  let sql = `
    SELECT a.id, a.driver_id, a.scanned_by, a.scan_date, a.scan_time, a.verified, a.is_late, a.lat, a.lng, a.source, a.created_at, a.late_reason,
           u.full_name as driver_name, u.phone as driver_phone, u.license_plate, u.station_id,
           s.full_name as scanned_by_name
    FROM attendance a
    JOIN users u ON a.driver_id = u.id
    JOIN users s ON a.scanned_by = s.id
    WHERE 1=1
  `;
  const params = [];
  let paramIndex = 1;
  if (date) { sql += ` AND a.scan_date = $${paramIndex++}`; params.push(date); }
  if (driver_id) { sql += ` AND a.driver_id = $${paramIndex++}`; params.push(parseInt(driver_id)); }
  if (req.user.role === 'ops') {
    sql += ` AND u.station_id = $${paramIndex++}`;
    params.push(req.user.station_id);
  } else if (station_id) {
    sql += ` AND u.station_id = $${paramIndex++}`;
    params.push(parseInt(station_id));
  }
  sql += ' ORDER BY a.created_at DESC';
  const records = await queryAll(sql, params);
  res.json(records);
});

router.get('/my', authenticate, authorize('driver'), async (req, res) => {
  const records = await queryAll(
    `SELECT a.id, a.scan_date, a.scan_time, a.verified, a.is_late, a.lat, a.lng, a.source, a.created_at, a.late_reason,
             s.full_name as scanned_by_name
     FROM attendance a
     JOIN users s ON a.scanned_by = s.id
     WHERE a.driver_id = $1
     ORDER BY a.created_at DESC
     LIMIT 50`,
    [req.user.id]
  );
  res.json(records);
});

router.get('/stats', authenticate, authorize('admin', 'ops'), async (req, res) => {
  const today = new Date();
  const dateStr = today.getFullYear() + '-' +
    String(today.getMonth() + 1).padStart(2, '0') + '-' +
    String(today.getDate()).padStart(2, '0');
  const hour = today.getHours();
  const currentShift = hour < 14 ? 'morning' : 'evening';

  const baseQuery = (role, stationId) => {
    let where = `role = 'driver' AND is_active::text = '1'`;
    const params = [];
    if (stationId) { where += ` AND station_id = $${params.length + 1}`; params.push(stationId); }
    return { where, params };
  };

  const stationId = req.user.role === 'ops' ? req.user.station_id : (req.query.station_id || null);

  const morning = baseQuery('driver', stationId);
  morning.where += ` AND (shift = 'morning' OR shift IS NULL)`;
  const evening = baseQuery('driver', stationId);
  evening.where += ` AND shift = 'evening'`;

  const totalMorning = await queryOne(`SELECT COUNT(*) as count FROM users WHERE ${morning.where}`, morning.params);
  const totalEvening = await queryOne(`SELECT COUNT(*) as count FROM users WHERE ${evening.where}`, evening.params);

  const attParams = [dateStr];
  let stationJoin = '';
  let stationWhere = '';
  if (stationId) {
    stationJoin = ' JOIN users u ON a.driver_id = u.id';
    stationWhere = ` AND u.station_id = $${attParams.length + 1}`;
    attParams.push(stationId);
  }

  const presentMorning = await queryOne(
    `SELECT COUNT(DISTINCT a.driver_id) as count FROM attendance a${stationJoin}
     WHERE a.scan_date = $1 AND a.driver_id IN (SELECT id FROM users WHERE (shift = 'morning' OR shift IS NULL)${stationWhere.replaceAll('u.station_id', 'station_id')})`,
    attParams
  );
  const presentEvening = await queryOne(
    `SELECT COUNT(DISTINCT a.driver_id) as count FROM attendance a${stationJoin}
     WHERE a.scan_date = $1 AND a.driver_id IN (SELECT id FROM users WHERE shift = 'evening'${stationWhere.replaceAll('u.station_id', 'station_id')})`,
    attParams
  );

  const lateMorning = await queryOne(
    `SELECT COUNT(DISTINCT a.driver_id) as count FROM attendance a${stationJoin}
     WHERE a.scan_date = $1 AND a.is_late = 1 AND a.driver_id IN (SELECT id FROM users WHERE (shift = 'morning' OR shift IS NULL)${stationWhere.replaceAll('u.station_id', 'station_id')})`,
    attParams
  );
  const lateEvening = await queryOne(
    `SELECT COUNT(DISTINCT a.driver_id) as count FROM attendance a${stationJoin}
     WHERE a.scan_date = $1 AND a.is_late = 1 AND a.driver_id IN (SELECT id FROM users WHERE shift = 'evening'${stationWhere.replaceAll('u.station_id', 'station_id')})`,
    attParams
  );

  const mTotal = parseInt(totalMorning.count);
  const eTotal = parseInt(totalEvening.count);
  const mPresent = parseInt(presentMorning.count);
  const ePresent = parseInt(presentEvening.count);

  res.json({
    total_drivers: mTotal + eTotal,
    total_morning: mTotal,
    total_evening: eTotal,
    present_today: mPresent + ePresent,
    present_morning: mPresent,
    present_evening: ePresent,
    late_today: parseInt(lateMorning.count) + parseInt(lateEvening.count),
    late_morning: parseInt(lateMorning.count),
    late_evening: parseInt(lateEvening.count),
    current_shift: currentShift,
    date: dateStr,
    station_id: stationId || null,
  });
});

router.get('/late', authenticate, authorize('admin', 'ops'), async (req, res) => {
  const today = new Date();
  const dateStr = today.getFullYear() + '-' +
    String(today.getMonth() + 1).padStart(2, '0') + '-' +
    String(today.getDate()).padStart(2, '0');

  let sql = `SELECT a.id, a.driver_id, a.scan_time, a.created_at, a.late_reason,
                    u.full_name as driver_name, u.phone, u.vehicle_type, u.license_plate,
                    s.full_name as scanned_by_name
             FROM attendance a
             JOIN users u ON a.driver_id = u.id
             JOIN users s ON a.scanned_by = s.id
             WHERE a.scan_date = $1 AND a.is_late = 1`;
  const params = [dateStr];

  if (req.user.role === 'ops' && req.user.station_id) {
    sql += ' AND u.station_id = $2';
    params.push(req.user.station_id);
  }

  sql += ' ORDER BY a.scan_time ASC';
  const lateDrivers = await queryAll(sql, params);
  res.json(lateDrivers);
});

router.get('/late/export', authenticate, authorize('admin', 'ops'), async (req, res) => {
  const today = new Date();
  const dateStr = req.query.date || (today.getFullYear() + '-' +
    String(today.getMonth() + 1).padStart(2, '0') + '-' +
    String(today.getDate()).padStart(2, '0'));

  let sql = `SELECT a.id, a.driver_id, a.scan_time, a.created_at, a.late_reason,
                    u.full_name as driver_name, u.phone, u.vehicle_type, u.license_plate, u.username,
                    s.full_name as scanned_by_name, st.name as station_name
             FROM attendance a
             JOIN users u ON a.driver_id = u.id
             JOIN users s ON a.scanned_by = s.id
             LEFT JOIN stations st ON u.station_id = st.id
             WHERE a.scan_date = $1 AND a.is_late = 1`;
  const params = [dateStr];

  if (req.user.role === 'ops' && req.user.station_id) {
    sql += ' AND u.station_id = $2';
    params.push(req.user.station_id);
  }

  sql += ' ORDER BY a.scan_time ASC';
  const lateDrivers = await queryAll(sql, params);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Retarded Drivers');
  ws.columns = [
    { header: '#', key: 'num', width: 5 },
    { header: 'Full Name', key: 'driver_name', width: 22 },
    { header: 'Username', key: 'username', width: 16 },
    { header: 'Phone', key: 'phone', width: 16 },
    { header: 'Vehicle Type', key: 'vehicle_type', width: 16 },
    { header: 'License Plate', key: 'license_plate', width: 16 },
    { header: 'Station', key: 'station_name', width: 18 },
    { header: 'Scan Time', key: 'scan_time', width: 12 },
    { header: 'Scanned By', key: 'scanned_by_name', width: 20 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE53935' } };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  headerRow.height = 24;

  lateDrivers.forEach((d, i) => {
    ws.addRow({
      num: i + 1,
      driver_name: d.driver_name,
      username: d.username,
      phone: d.phone || '—',
      vehicle_type: d.vehicle_type || '—',
      license_plate: d.license_plate || '—',
      station_name: d.station_name || '—',
      scan_time: d.scan_time,
      scanned_by_name: d.scanned_by_name,
    });
  });

  ws.eachRow((row, rowNum) => {
    if (rowNum > 1) {
      row.alignment = { vertical: 'middle' };
      row.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    }
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="retarded-drivers-${dateStr}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

router.get('/export', authenticate, authorize('admin', 'ops'), async (req, res) => {
  const { date, driver_id } = req.query;
  let sql = `SELECT a.id, a.scan_date, a.scan_time, a.is_late, a.verified, a.late_reason,
                    u.full_name as driver_name, u.username, u.phone as driver_phone, u.vehicle_type, u.license_plate,
                    st.name as station_name, s.full_name as scanned_by_name
             FROM attendance a
             JOIN users u ON a.driver_id = u.id
             JOIN users s ON a.scanned_by = s.id
             LEFT JOIN stations st ON u.station_id = st.id
             WHERE 1=1`;
  const params = [];
  let paramIndex = 1;
  if (date) { sql += ` AND a.scan_date = $${paramIndex++}`; params.push(date); }
  if (driver_id) { sql += ` AND a.driver_id = $${paramIndex++}`; params.push(parseInt(driver_id)); }
  if (req.user.role === 'ops') {
    sql += ` AND u.station_id = $${paramIndex++}`;
    params.push(req.user.station_id);
  }
  sql += ' ORDER BY a.scan_date DESC, u.full_name ASC';
  const records = await queryAll(sql, params);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Attendance');
  ws.columns = [
    { header: '#', key: 'num', width: 5 },
    { header: 'Full Name', key: 'driver_name', width: 22 },
    { header: 'Username', key: 'username', width: 16 },
    { header: 'Phone', key: 'driver_phone', width: 16 },
    { header: 'Vehicle Type', key: 'vehicle_type', width: 16 },
    { header: 'License Plate', key: 'license_plate', width: 16 },
    { header: 'Station', key: 'station_name', width: 18 },
    { header: 'Date', key: 'scan_date', width: 14 },
    { header: 'Time', key: 'scan_time', width: 10 },
    { header: 'Scanned By', key: 'scanned_by_name', width: 20 },
    { header: 'Status', key: 'status', width: 12 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE53935' } };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  headerRow.height = 24;

  records.forEach((d, i) => {
    ws.addRow({
      num: i + 1,
      driver_name: d.driver_name,
      username: d.username,
      driver_phone: d.driver_phone || '—',
      vehicle_type: d.vehicle_type || '—',
      license_plate: d.license_plate || '—',
      station_name: d.station_name || '—',
      scan_date: d.scan_date,
      scan_time: d.scan_time,
      scanned_by_name: d.scanned_by_name,
      status: d.is_late ? 'Late' : d.verified ? 'Present' : 'Unverified',
    });
  });

  ws.eachRow((row, rowNum) => {
    if (rowNum > 1) {
      row.alignment = { vertical: 'middle' };
      row.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    }
  });

  const todayStr = new Date().getFullYear() + '-' +
    String(new Date().getMonth() + 1).padStart(2, '0') + '-' +
    String(new Date().getDate()).padStart(2, '0');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="attendance-${todayStr}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

router.get('/my/profile', authenticate, authorize('admin', 'ops', 'driver'), async (req, res) => {
  const id = req.user.role === 'driver' ? req.user.id : parseInt(req.query.driver_id);
  if (!id) return res.status(400).json({ error: 'driver_id is required' });

  const totalAtt = await queryOne('SELECT COUNT(*) as count FROM attendance WHERE driver_id = $1', [id]);
  const totalPen = await queryOne('SELECT COUNT(*) as count, COALESCE(SUM(amount),0) as total FROM penalties WHERE driver_id = $1', [id]);
  const att30d = await queryOne(
    `SELECT COUNT(DISTINCT scan_date) as count FROM attendance WHERE driver_id = $1 AND scan_date::date >= CURRENT_DATE - INTERVAL '30 days'`, [id]);
  const abs30d = await queryOne(
    `SELECT COUNT(*) as count FROM absences a
     WHERE a.driver_id = $1 AND a.absence_date::date >= CURRENT_DATE - INTERVAL '30 days'
       AND NOT EXISTS (
         SELECT 1 FROM absence_requests ar
         WHERE ar.driver_id = a.driver_id
           AND ar.status = 'approved'
           AND ar.date_from <= a.absence_date
           AND ar.date_to >= a.absence_date
       )`, [id]);
  const dates = await queryAll('SELECT DISTINCT scan_date FROM attendance WHERE driver_id = $1 ORDER BY scan_date DESC', [id]);
  const recent = await queryAll(
    `SELECT a.id, a.scan_date, a.scan_time, a.verified, a.is_late, a.source, a.lat, a.lng, a.late_reason, s.full_name as scanned_by_name
     FROM attendance a JOIN users s ON a.scanned_by = s.id
     WHERE a.driver_id = $1 ORDER BY a.created_at DESC LIMIT 10`, [id]);

  let streak = 0;
  if (dates.length > 0) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const last = new Date(dates[0].scan_date); last.setHours(0, 0, 0, 0);
    if (Math.round((today - last) / 864e5) <= 1) {
      streak = 1;
      for (let i = 1; i < dates.length; i++) {
        const p = new Date(dates[i - 1].scan_date); p.setHours(0, 0, 0, 0);
        const c = new Date(dates[i].scan_date); c.setHours(0, 0, 0, 0);
        if (Math.round((p - c) / 864e5) === 1) streak++; else break;
      }
    }
  }

  const rate = Math.min(Math.round((parseInt(att30d.count) / 30) * 100), 100);

  res.json({
    total_attendance: parseInt(totalAtt.count),
    total_penalties: parseInt(totalPen.count),
    total_penalty_amount: parseFloat(totalPen.total),
    total_present_30d: parseInt(att30d.count),
    total_absences_30d: parseInt(abs30d.count),
    streak,
    attendance_rate_30d: rate,
    recent_attendance: recent,
  });
});

module.exports = router;
