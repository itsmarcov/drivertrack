const express = require('express');
const ExcelJS = require('exceljs');
const { queryAll, queryOne, run } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

function dateStr(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

router.get('/', authenticate, authorize('admin', 'ops'), async (req, res) => {
  const { date_from, date_to, shift, station_id } = req.query;
  const today = dateStr(new Date());
  let sql = `SELECT a.id, a.driver_id, a.absence_date, a.shift, a.created_at,
                    u.full_name as driver_name, u.phone, u.vehicle_type, u.license_plate, u.station_id,
                    st.name as station_name
             FROM absences a
             JOIN users u ON a.driver_id = u.id
             LEFT JOIN stations st ON u.station_id = st.id
             WHERE 1=1`;
  const params = [];
  let paramIndex = 1;
  if (date_from) { sql += ` AND a.absence_date >= $${paramIndex++}`; params.push(date_from); }
  if (date_to) { sql += ` AND a.absence_date <= $${paramIndex++}`; params.push(date_to); }
  if (shift) { sql += ` AND a.shift = $${paramIndex++}`; params.push(shift); }
  if (req.user.role === 'ops') {
    sql += ` AND u.station_id = $${paramIndex++}`;
    params.push(req.user.station_id);
  } else if (station_id) {
    sql += ` AND u.station_id = $${paramIndex++}`;
    params.push(parseInt(station_id));
  }
  sql += ' ORDER BY a.absence_date DESC, u.full_name ASC';
  const records = await queryAll(sql, params);
  res.json(records);
});

router.post('/mark', authenticate, authorize('admin', 'ops'), async (req, res) => {
  const targetDate = req.body.date || dateStr(new Date());
  const today = dateStr(new Date());

  const settings = await queryAll('SELECT key, value FROM settings');
  const config = {};
  settings.forEach(s => { config[s.key] = s.value; });

  const morningAbsent = config.morning_absent_cutoff || '12:30:00';
  const eveningAbsent = config.evening_absent_cutoff || '17:30:00';

  let driverWhere = "role = 'driver' AND is_active::text = '1'";
  const driverParams = [];
  let paramIdx = 1;
  if (req.user.role === 'ops') {
    driverWhere += ` AND station_id = $${paramIdx++}`;
    driverParams.push(req.user.station_id);
  }
  const drivers = await queryAll(`SELECT id, shift FROM users WHERE ${driverWhere}`, driverParams);
  let marked = 0;

  for (const driver of drivers) {
    const cutoff = driver.shift === 'evening' ? eveningAbsent : morningAbsent;
    const existing = await queryOne(
      'SELECT id FROM attendance WHERE driver_id = $1 AND scan_date = $2',
      [driver.id, targetDate]
    );
    if (existing) continue;
    const currentTime = targetDate === today ? dateStr(new Date()).split(' ')[1] || '23:59' : '23:59';
    if (currentTime < cutoff) continue;
    await run(
      'INSERT INTO absences (driver_id, absence_date, shift, marked_by) VALUES ($1, $2, $3, $4) ON CONFLICT (driver_id, absence_date) DO NOTHING',
      [driver.id, targetDate, driver.shift || 'morning', req.user.id]
    );
    marked++;
  }

  res.json({ message: `Marked ${marked} absences for ${targetDate}.` });
});

router.get('/export', authenticate, authorize('admin', 'ops'), async (req, res) => {
  const { date_from, date_to, shift } = req.query;
  let sql = `SELECT a.id, a.absence_date, a.shift,
                    u.full_name as driver_name, u.username, u.phone, u.vehicle_type, u.license_plate,
                    st.name as station_name
             FROM absences a
             JOIN users u ON a.driver_id = u.id
             LEFT JOIN stations st ON u.station_id = st.id
             WHERE 1=1`;
  const params = [];
  let paramIndex = 1;
  if (date_from) { sql += ` AND a.absence_date >= $${paramIndex++}`; params.push(date_from); }
  if (date_to) { sql += ` AND a.absence_date <= $${paramIndex++}`; params.push(date_to); }
  if (shift) { sql += ` AND a.shift = $${paramIndex++}`; params.push(shift); }
  if (req.user.role === 'ops') {
    sql += ` AND u.station_id = $${paramIndex++}`;
    params.push(req.user.station_id);
  }
  sql += ' ORDER BY a.absence_date DESC, u.full_name ASC';
  const absences = await queryAll(sql, params);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Absences');
  ws.columns = [
    { header: '#', key: 'num', width: 5 },
    { header: 'Full Name', key: 'driver_name', width: 22 },
    { header: 'Username', key: 'username', width: 16 },
    { header: 'Phone', key: 'phone', width: 16 },
    { header: 'Vehicle Type', key: 'vehicle_type', width: 16 },
    { header: 'License Plate', key: 'license_plate', width: 16 },
    { header: 'Station', key: 'station_name', width: 18 },
    { header: 'Date', key: 'absence_date', width: 14 },
    { header: 'Shift', key: 'shift', width: 12 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE53935' } };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  headerRow.height = 24;

  absences.forEach((d, i) => {
    ws.addRow({
      num: i + 1,
      driver_name: d.driver_name,
      username: d.username,
      phone: d.phone || '—',
      vehicle_type: d.vehicle_type || '—',
      license_plate: d.license_plate || '—',
      station_name: d.station_name || '—',
      absence_date: d.absence_date,
      shift: d.shift === 'evening' ? 'Evening' : 'Morning',
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
  res.setHeader('Content-Disposition', `attachment; filename="absences-${dateStr(new Date())}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

router.delete('/:date', authenticate, authorize('admin'), async (req, res) => {
  const { date } = req.params;
  const result = await run('DELETE FROM absences WHERE absence_date = $1', [date]);
  res.json({ message: `Deleted ${result.changes} absences for ${date}.` });
});

module.exports = router;
