const express = require('express');
const { queryAll, queryOne } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

function todayStr(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

router.get('/', authenticate, authorize('admin', 'ops'), async (req, res) => {
  const today = todayStr(new Date());
  const isOps = req.user.role === 'ops';
  const stationId = isOps ? req.user.station_id : null;
  const days = Math.min(Math.max(parseInt(req.query.days) || 14, 1), 30);

  const [attendanceToday] = await queryAll(
    `SELECT COUNT(*) as count FROM attendance a
     ${stationId ? 'JOIN users du ON a.driver_id = du.id AND du.station_id = $1' : ''}
     WHERE a.scan_date = '${today}'`,
    stationId ? [stationId] : []
  );

  const [absToday] = await queryAll(
    `SELECT COUNT(*) as count FROM absences a
     ${stationId ? 'JOIN users du ON a.driver_id = du.id AND du.station_id = $1' : ''}
     WHERE a.absence_date = '${today}'`,
    stationId ? [stationId] : []
  );

  const [totalDrivers] = await queryAll(
    `SELECT COUNT(*) as count FROM users WHERE role = 'driver' AND is_active = 1
     ${stationId ? 'AND station_id = $1' : ''}`,
    stationId ? [stationId] : []
  );

  const lastNDays = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = todayStr(d);

    const [att] = await queryAll(
      `SELECT COUNT(*) as count FROM attendance a
       ${stationId ? 'JOIN users du ON a.driver_id = du.id AND du.station_id = $1' : ''}
       WHERE a.scan_date = '${ds}'`,
      stationId ? [stationId] : []
    );
    const [abs] = await queryAll(
      `SELECT COUNT(*) as count FROM absences a
       ${stationId ? 'JOIN users du ON a.driver_id = du.id AND du.station_id = $1' : ''}
       WHERE a.absence_date = '${ds}'`,
      stationId ? [stationId] : []
    );
    lastNDays.push({
      date: ds,
      attendance: parseInt(att.count),
      absences: parseInt(abs.count),
    });
  }

  const peakHours = await queryAll(
    `SELECT SUBSTRING(a.scan_time FROM 1 FOR 2) as hour, COUNT(*) as count
     FROM attendance a
     ${stationId ? 'JOIN users du ON a.driver_id = du.id AND du.station_id = $1' : ''}
     WHERE a.scan_date = '${today}'
     GROUP BY hour ORDER BY count DESC LIMIT 5`,
    stationId ? [stationId] : []
  );

  const stationsMostAbsences = await queryAll(
    `SELECT s.id, s.name, COALESCE(cnt, 0) as count
     FROM stations s
     LEFT JOIN (
       SELECT u.station_id, COUNT(a.id) as cnt
       FROM absences a JOIN users u ON a.driver_id = u.id
       WHERE a.absence_date = '${today}'
       GROUP BY u.station_id
     ) sub ON s.id = sub.station_id
     ${stationId ? 'WHERE s.id = $1' : ''}
     ORDER BY count DESC LIMIT 5`,
    stationId ? [stationId] : []
  );

  const stationsBestAttendance = await queryAll(
    `SELECT s.id, s.name,
       COALESCE(ont.cnt, 0) as on_time,
       COALESCE(tot.cnt, 0) as total
     FROM stations s
     LEFT JOIN (
       SELECT u.station_id, COUNT(a.id) as cnt
       FROM attendance a JOIN users u ON a.driver_id = u.id
       WHERE a.scan_date = '${today}' AND a.is_late = 0
       GROUP BY u.station_id
     ) ont ON s.id = ont.station_id
     LEFT JOIN (
       SELECT u.station_id, COUNT(a.id) as cnt
       FROM attendance a JOIN users u ON a.driver_id = u.id
       WHERE a.scan_date = '${today}'
       GROUP BY u.station_id
     ) tot ON s.id = tot.station_id
     ${stationId ? 'WHERE s.id = $1' : ''}
     ORDER BY on_time DESC LIMIT 5`,
    stationId ? [stationId] : []
  );

  res.json({
    date: today,
    attendance_today: parseInt(attendanceToday.count),
    absence_today: parseInt(absToday.count),
    total_drivers: parseInt(totalDrivers.count),
    attendance_over_time: lastNDays,
    peak_scan_hours: peakHours.map(h => ({ hour: h.hour + ':00', count: parseInt(h.count) })),
    stations_most_absences: stationsMostAbsences.map(s => ({ id: s.id, name: s.name, count: parseInt(s.count) })),
    stations_best_attendance: stationsBestAttendance.map(s => ({
      id: s.id, name: s.name, on_time: parseInt(s.on_time), total: parseInt(s.total)
    })),
  });
});

module.exports = router;
