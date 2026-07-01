import { useState, useEffect } from 'react';
import LoadingScreen from '../components/LoadingScreen';
import { useAuth } from '../context/AuthContext';
import { attendance, drivers, stations as stationsApi } from '../api';

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export default function AttendanceLogs() {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [driverList, setDriverList] = useState([]);
  const [stationList, setStationList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState(todayStr());
  const [filterDriver, setFilterDriver] = useState('');
  const [filterStation, setFilterStation] = useState('');
  const [exporting, setExporting] = useState(false);

  const loadData = async (date, driver, station) => {
    try {
      setLoading(true);
      const params = {};
      if (date) params.date = date;
      if (driver) params.driver_id = driver;
      if (station && ['admin', 'super_admin'].includes(user.role)) params.station_id = station;
      const data = await attendance.list(params);
      setRecords(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(filterDate, filterDriver, filterStation);
    drivers.list().then(setDriverList).catch(() => {});
    if (['admin', 'super_admin'].includes(user.role)) {
      stationsApi.list().then(setStationList).catch(() => {});
    }
  }, []);

  const handleExport = async () => {
    try {
      setExporting(true);
      const params = {};
      if (filterDate) params.date = filterDate;
      if (filterDriver) params.driver_id = filterDriver;
      if (filterStation && ['admin', 'super_admin'].includes(user.role)) params.station_id = filterStation;
      const blob = await attendance.exportExcel(params);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance-${filterDate}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    } finally {
      setExporting(false);
    }
  };

  const isDriver = user.role === 'driver';

  if (isDriver) {
    return <DriverAttendanceView />;
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-content">
          <h2>سجلات الحضور</h2>
          <p>{records.length} تسجيل في {filterDate}</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={handleExport} disabled={exporting}>
            {exporting ? 'جاري...' : 'تصدير Excel'}
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <div className="form-row">
          <div className="form-group">
            <label>التاريخ</label>
            <input type="date" value={filterDate} onChange={(e) => { setFilterDate(e.target.value); loadData(e.target.value, filterDriver, filterStation); }} />
          </div>
          <div className="form-group">
            <label>السائق</label>
            <select value={filterDriver} onChange={(e) => { setFilterDriver(e.target.value); loadData(filterDate, e.target.value, filterStation); }}>
              <option value="">جميع السائقين</option>
              {driverList.map((d) => (
                <option key={d.id} value={d.id}>{d.full_name}</option>
              ))}
            </select>
          </div>
          {['admin', 'super_admin'].includes(user.role) && (
            <div className="form-group">
              <label>المحطة</label>
              <select value={filterStation} onChange={(e) => { setFilterStation(e.target.value); loadData(filterDate, filterDriver, e.target.value); }}>
                <option value="">جميع المحطات</option>
                {stationList.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {loading ? <LoadingScreen /> : records.length === 0 ? (
        <div className="nx-empty">
          <div className="nx-empty-icon">📋</div>
          <h3>لا توجد سجلات حضور</h3>
          <p>لا توجد سجلات تطابق معايير البحث المحددة</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>السائق</th>
                <th>التاريخ</th>
                <th>الوقت</th>
                <th>مسح بواسطة</th>
                <th>رقم الهاتف</th>
                <th>اللوحة</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => (
                <tr key={r.id}>
                  <td className="text-sm text-muted">{i + 1}</td>
                  <td><strong>{r.driver_name}</strong></td>
                  <td>{r.scan_date}</td>
                  <td>{r.scan_time}</td>
                  <td>{r.scanned_by_name}</td>
                  <td className="text-sm">{r.driver_phone || '—'}</td>
                  <td className="text-sm">{r.license_plate || '—'}</td>
                  <td>{r.is_late ? <span className="badge badge-late">متأخر</span> : r.verified ? <span className="badge badge-success">موثق ✓</span> : <span className="badge badge-danger">غير موثق</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DriverAttendanceView() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    attendance.my()
      .then(setRecords)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-content">
          <h2>سجل حضورك</h2>
          <p>{records.length} تسجيل</p>
        </div>
      </div>

      {loading ? <LoadingScreen /> : records.length === 0 ? (
        <div className="nx-empty">
          <div className="nx-empty-icon">📋</div>
          <h3>لا توجد سجلات حضور بعد</h3>
          <p>سيتم عرض سجل حضورك هنا بعد أول تسجيل</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>الوقت</th>
                <th>مسح بواسطة</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.scan_date}</strong></td>
                  <td>{r.scan_time}</td>
                  <td>{r.scanned_by_name}</td>
                  <td>{r.is_late ? <span className="badge badge-late">متأخر</span> : r.verified ? <span className="badge badge-success">موثق ✓</span> : <span className="badge badge-danger">غير موثق</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
