const express = require('express');
const ExcelJS = require('exceljs');
const { queryAll, queryOne } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

function stationFilter(user, params, paramIndex) {
  let sql = '';
  if (user.role === 'ops') {
    sql = ` AND u.station_id = $${paramIndex++}`;
    params.push(user.station_id);
  }
  return { sql, paramIndex };
}

router.get('/', authenticate, authorize('admin', 'ops'), async (req, res) => {
  const { date, driver_id, station_id } = req.query;
  let sql = `
    SELECT a.id, a.driver_id, a.scanned_by, a.scan_date, a.scan_time, a.verified, a.is_late, a.created_at,
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
    `SELECT a.id, a.scan_date, a.scan_time, a.verified, a.is_late, a.created_at,
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

  let driverWhere = "role = 'driver' AND is_active = 1";
  let attWhere = 'scan_date = $1';
  const attParams = [dateStr];
  let attLateWhere = 'scan_date = $1 AND is_late = 1';
  let paramIdx = 2;

  if (req.user.role === 'ops' && req.user.station_id) {
    driverWhere += ` AND station_id = $${paramIdx}`;
    attWhere += ` AND u.station_id = $${paramIdx}`;
    attLateWhere += ` AND u.station_id = $${paramIdx}`;
    const sid = [req.user.station_id];
    const total = await queryOne(`SELECT COUNT(*) as count FROM users WHERE ${driverWhere}`, sid);
    const present = await queryOne(
      `SELECT COUNT(DISTINCT a.driver_id) as count FROM attendance a JOIN users u ON a.driver_id = u.id WHERE ${attWhere}`,
      [...attParams, ...sid]
    );
    const late = await queryOne(
      `SELECT COUNT(DISTINCT a.driver_id) as count FROM attendance a JOIN users u ON a.driver_id = u.id WHERE ${attLateWhere}`,
      [...attParams, ...sid]
    );
    return res.json({
      total_drivers: parseInt(total.count),
      present_today: parseInt(present.count),
      late_today: parseInt(late.count),
      date: dateStr,
      station_id: req.user.station_id,
    });
  }

  const total = await queryOne(`SELECT COUNT(*) as count FROM users WHERE ${driverWhere}`);
  const present = await queryOne(
    'SELECT COUNT(DISTINCT driver_id) as count FROM attendance WHERE scan_date = $1',
    [dateStr]
  );
  const late = await queryOne(
    "SELECT COUNT(DISTINCT driver_id) as count FROM attendance WHERE scan_date = $1 AND is_late = 1",
    [dateStr]
  );

  res.json({
    total_drivers: parseInt(total.count),
    present_today: parseInt(present.count),
    late_today: parseInt(late.count),
    date: dateStr,
  });
});

router.get('/late', authenticate, authorize('admin', 'ops'), async (req, res) => {
  const today = new Date();
  const dateStr = today.getFullYear() + '-' +
    String(today.getMonth() + 1).padStart(2, '0') + '-' +
    String(today.getDate()).padStart(2, '0');

  let sql = `SELECT a.id, a.driver_id, a.scan_time, a.created_at,
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

  let sql = `SELECT a.id, a.driver_id, a.scan_time, a.created_at,
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

module.exports = router;
