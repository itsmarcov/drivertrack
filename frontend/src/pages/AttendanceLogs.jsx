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
    <div className="page admin-page">
      <div className="page-header">
        <h2>سجلات الحضور</h2>
      </div>

      <form className="filter-bar" onSubmit={handleFilter}>
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
        <button type="submit" className="btn btn-primary" style={{ marginTop: '1.5rem' }}>تصفية</button>
        <button type="button" className="btn btn-outline" style={{ marginTop: '1.5rem' }} onClick={() => { setFilterDate(''); setFilterDriver(''); loadData(); }}>إعادة تعيين</button>
      </form>

      {loading ? (
        <div className="loading-screen"><div className="spinner"></div></div>
      ) : records.length === 0 ? (
        <p className="empty-state">لا توجد سجلات حضور تطابق معايير البحث</p>
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
                  <td>{i + 1}</td>
                  <td><strong>{r.driver_name}</strong></td>
                  <td>{r.scan_date}</td>
                  <td>{r.scan_time}</td>
                  <td>{r.scanned_by_name}</td>
                  <td>{r.driver_phone || '—'}</td>
                  <td>{r.license_plate || '—'}</td>
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
    <div className="page driver-page">
      <div className="page-header">
        <h2>سجل حضورك</h2>
      </div>
      {loading ? (
        <div className="loading-screen"><div className="spinner"></div></div>
      ) : records.length === 0 ? (
        <p className="empty-state">لا توجد سجلات حضور بعد</p>
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
                  <td>{r.scan_date}</td>
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
