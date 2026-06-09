import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { attendance, drivers } from '../api';

export default function AttendanceLogs() {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [driverList, setDriverList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState('');
  const [filterDriver, setFilterDriver] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filterDate) params.date = filterDate;
      if (filterDriver) params.driver_id = filterDriver;
      const data = await attendance.list(params);
      setRecords(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    drivers.list().then(setDriverList).catch(() => {});
  }, []);

  const handleFilter = (e) => {
    e.preventDefault();
    loadData();
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
          <p>{records.length} تسجيل</p>
        </div>
      </div>

      <form className="nx-filter" onSubmit={handleFilter}>
        <div className="form-group">
          <label>التاريخ</label>
          <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
        </div>
        <div className="form-group">
          <label>السائق</label>
          <select value={filterDriver} onChange={(e) => setFilterDriver(e.target.value)}>
            <option value="">جميع السائقين</option>
            {driverList.map((d) => (
              <option key={d.id} value={d.id}>{d.full_name}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>تصفية</button>
        <button type="button" className="btn btn-outline" style={{ whiteSpace: 'nowrap' }} onClick={() => { setFilterDate(''); setFilterDriver(''); loadData(); }}>إعادة تعيين</button>
      </form>

      {loading ? (
        <div className="loading-screen" style={{ minHeight: 200 }}>
          <div className="nx-loader">
            <div className="nx-spinner"></div>
          </div>
        </div>
      ) : records.length === 0 ? (
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
                  <td>{r.verified ? <span className="badge badge-success">موثق ✓</span> : <span className="badge badge-danger">غير موثق</span>}</td>
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

      {loading ? (
        <div className="loading-screen" style={{ minHeight: 200 }}>
          <div className="nx-loader">
            <div className="nx-spinner"></div>
          </div>
        </div>
      ) : records.length === 0 ? (
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
                  <td>{r.verified ? <span className="badge badge-success">موثق ✓</span> : <span className="badge badge-danger">غير موثق</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
