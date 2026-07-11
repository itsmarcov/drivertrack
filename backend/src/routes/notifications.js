const express = require('express');
const { queryAll } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, authorize('admin', 'ops', 'super_admin'), async (req, res) => {
  const isOps = req.user.role === 'ops';
  const stationFilter = isOps ? 'AND u.station_id = $1' : '';
  const stationParam = isOps ? [req.user.station_id] : [];

  const [late, justifications, registrations, absenceRequests] = await Promise.all([
    queryAll(`
      SELECT a.id, a.driver_id, a.scan_time, a.created_at, a.late_reason,
             u.full_name AS driver_name, u.phone, u.vehicle_type, u.license_plate,
             ad.full_name AS scanned_by_name
      FROM attendance a
      JOIN users u ON u.id = a.driver_id
      LEFT JOIN users ad ON ad.id = a.scanned_by
      WHERE a.is_late = 1 AND a.scan_date = TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD')
      ${stationFilter}
      ORDER BY a.created_at DESC
    `, isOps ? [req.user.station_id] : []),
    queryAll(`
      SELECT j.id, j.driver_id, j.attendance_date, j.reason, j.note, j.created_at,
             u.full_name AS driver_name, u.vehicle_type, u.license_plate
      FROM justifications j
      JOIN users u ON u.id = j.driver_id
      WHERE j.status = 'pending'
      ${stationFilter.replace('u.station_id', 'u.station_id')}
      ORDER BY j.created_at DESC
    `, stationParam),
    (!isOps ? queryAll(`
      SELECT id, full_name, username, phone, vehicle_type, license_plate, created_at
      FROM users
      WHERE role = 'driver' AND is_active = 0
      ORDER BY created_at DESC
    `) : Promise.resolve([])),
    queryAll(`
      SELECT ar.id, ar.driver_id, ar.date_from, ar.date_to, ar.reason, ar.note, ar.created_at,
             u.full_name AS driver_name, u.vehicle_type, u.license_plate
      FROM absence_requests ar
      JOIN users u ON u.id = ar.driver_id
      WHERE ar.status = 'pending'
      ${stationFilter.replace('u.station_id', 'u.station_id')}
      ORDER BY ar.created_at DESC
    `, stationParam),
  ]);

  res.json({
    late,
    justifications,
    registrations,
    absence_requests: absenceRequests,
    totals: {
      late: late.length,
      justifications: justifications.length,
      registrations: registrations.length,
      absence_requests: absenceRequests.length,
    },
  });
});

module.exports = router;
