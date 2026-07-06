const express = require('express');
const { queryAll, queryOne } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

function todayStr(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

router.get('/', authenticate, authorize('admin', 'ops'), async (req, res) => {
  const isOps = req.user.role === 'ops';
  const stationId = isOps ? req.user.station_id : null;

  const to = req.query.to || todayStr(new Date());
  const queryDays = req.query.days;
  const days = Math.min(Math.max(parseInt(queryDays) || 14, 1), 30);
  const from = req.query.from || (queryDays ? todayStr(new Date(new Date(to).getTime() - (days - 1) * 86400000)) : to);

  const sf = (sql) => {
    if (!stationId) return sql;
    return sql.replace(/FROM attendance a/g, 'FROM attendance a JOIN users du ON a.driver_id = du.id AND du.station_id = ' + stationId)
              .replace(/FROM absences a/g, 'FROM absences a JOIN users du ON a.driver_id = du.id AND du.station_id = ' + stationId);
  };

  const [attendanceCount] = await queryAll(
    sf(`SELECT COUNT(*) as count FROM attendance a WHERE a.scan_date BETWEEN '${from}' AND '${to}'`)
  );

  const [absCount] = await queryAll(
    sf(`SELECT COUNT(*) as count FROM absences a WHERE a.absence_date BETWEEN '${from}' AND '${to}'`)
  );

  const [totalDrivers] = await queryAll(
    `SELECT COUNT(*) as count FROM users WHERE role = 'driver' AND is_active::text = '1'${stationId ? ' AND station_id = ' + stationId : ''}`
  );

  // day-by-day trend for the requested days going backward from `to`
  const lastNDays = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(to);
    d.setDate(d.getDate() - (days - 1 - i));
    const ds = todayStr(d);
    if (ds < from || ds > to) continue;
    const [att] = await queryAll(sf(`SELECT COUNT(*) as count FROM attendance a WHERE a.scan_date = '${ds}'`));
    const [abs] = await queryAll(sf(`SELECT COUNT(*) as count FROM absences a WHERE a.absence_date = '${ds}'`));
    lastNDays.push({ date: ds, attendance: parseInt(att.count), absences: parseInt(abs.count) });
  }

  const peakHours = await queryAll(
    sf(`SELECT SUBSTRING(a.scan_time FROM 1 FOR 2) as hour, COUNT(*) as count
        FROM attendance a WHERE a.scan_date BETWEEN '${from}' AND '${to}'
        GROUP BY hour ORDER BY count DESC LIMIT 5`)
  );

  const stationsMostAbsences = await queryAll(
    `SELECT s.id, s.name, COALESCE(cnt, 0) as count
     FROM stations s
     LEFT JOIN (
       SELECT u.station_id, COUNT(a.id) as cnt
       FROM absences a JOIN users u ON a.driver_id = u.id
       WHERE a.absence_date BETWEEN '${from}' AND '${to}'
       GROUP BY u.station_id
     ) sub ON s.id = sub.station_id
     ${stationId ? 'WHERE s.id = ' + stationId : ''}
     ORDER BY count DESC LIMIT 5`
  );

  const stationsBestAttendance = await queryAll(
    `SELECT s.id, s.name,
        COALESCE(ont.cnt, 0) as on_time,
        COALESCE(tot.cnt, 0) as total
     FROM stations s
     LEFT JOIN (
       SELECT u.station_id, COUNT(a.id) as cnt
       FROM attendance a JOIN users u ON a.driver_id = u.id
       WHERE a.scan_date BETWEEN '${from}' AND '${to}' AND a.is_late = 0
       GROUP BY u.station_id
     ) ont ON s.id = ont.station_id
     LEFT JOIN (
       SELECT u.station_id, COUNT(a.id) as cnt
       FROM attendance a JOIN users u ON a.driver_id = u.id
       WHERE a.scan_date BETWEEN '${from}' AND '${to}'
       GROUP BY u.station_id
     ) tot ON s.id = tot.station_id
     ${stationId ? 'WHERE s.id = ' + stationId : ''}
     ORDER BY on_time DESC LIMIT 5`
  );

  res.json({
    date_from: from,
    date_to: to,
    attendance_today: parseInt(attendanceCount.count),
    absence_today: parseInt(absCount.count),
    total_drivers: parseInt(totalDrivers.count),
    attendance_over_time: lastNDays,
    peak_scan_hours: peakHours.map(h => ({ hour: h.hour + ':00', count: parseInt(h.count) })),
    stations_most_absences: stationsMostAbsences.map(s => ({ id: s.id, name: s.name, count: parseInt(s.count) })),
    stations_best_attendance: stationsBestAttendance.map(s => ({
      id: s.id, name: s.name, on_time: parseInt(s.on_time), total: parseInt(s.total)
    })),
  });
});

router.get('/stations-report', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  const dateStr = req.query.date || todayStr(new Date());

  const stations = await queryAll('SELECT id, name, code FROM stations ORDER BY name ASC');

  const result = [];
  for (const s of stations) {
    const [totalDrivers] = await queryAll(
      `SELECT COUNT(*) as count FROM users WHERE role = 'driver' AND is_active::text = '1' AND station_id = $1`,
      [s.id]
    );
    const total = parseInt(totalDrivers.count);
    if (total === 0) continue;

    const [presentToday] = await queryAll(
      `SELECT COUNT(DISTINCT a.driver_id) as count FROM attendance a JOIN users u ON a.driver_id = u.id
       WHERE a.scan_date = $1 AND u.station_id = $2`,
      [dateStr, s.id]
    );
    const present = parseInt(presentToday.count);

    const [lateToday] = await queryAll(
      `SELECT COUNT(DISTINCT a.driver_id) as count FROM attendance a JOIN users u ON a.driver_id = u.id
       WHERE a.scan_date = $1 AND a.is_late = 1 AND u.station_id = $2`,
      [dateStr, s.id]
    );
    const late = parseInt(lateToday.count);

    const [avgTime] = await queryAll(
      `SELECT MIN(a.scan_time::time) as earliest_time,
              AVG(EXTRACT(EPOCH FROM a.scan_time::time)) as avg_epoch
       FROM attendance a JOIN users u ON a.driver_id = u.id
       WHERE a.scan_date = $1 AND u.station_id = $2`,
      [dateStr, s.id]
    );
    const earliestTime = avgTime?.earliest_time || null;
    const avgScanSeconds = avgTime?.avg_epoch ? Math.round(parseFloat(avgTime.avg_epoch)) : null;
    const avgScanTime = avgScanSeconds !== null
      ? String(Math.floor(avgScanSeconds / 3600)).padStart(2, '0') + ':' +
        String(Math.floor((avgScanSeconds % 3600) / 60)).padStart(2, '0')
      : null;

    const absent = total - present;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;
    let rating;
    if (rate >= 90) rating = 'PERFECT';
    else if (rate >= 70) rating = 'GOOD';
    else rating = 'RISKY';

    result.push({
      station_id: s.id,
      station_name: s.name,
      station_code: s.code,
      total_drivers: total,
      present_today: present,
      late_today: late,
      absent_today: absent,
      attendance_rate: rate,
      avg_scan_time: avgScanTime,
      avg_scan_seconds: avgScanSeconds,
      earliest_scan_time: earliestTime,
      rating,
    });
  }

  result.sort((a, b) => {
    const aSec = a.avg_scan_seconds;
    const bSec = b.avg_scan_seconds;
    const aTimeScore = aSec !== null ? Math.max(0, 1 - (aSec - 18000) / 25200) * 100 : 0;
    const bTimeScore = bSec !== null ? Math.max(0, 1 - (bSec - 18000) / 25200) * 100 : 0;
    const aComposite = a.attendance_rate * 0.5 + aTimeScore * 0.5;
    const bComposite = b.attendance_rate * 0.5 + bTimeScore * 0.5;
    return bComposite - aComposite;
  });
  result.forEach((s, i) => { s.rank = i + 1; });

  res.json({ date: dateStr, stations: result });
});

module.exports = router;
