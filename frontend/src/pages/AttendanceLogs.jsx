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
  const canManual = ['admin', 'super_admin'].includes(user.role);
  const [records, setRecords] = useState([]);
  const [driverList, setDriverList] = useState([]);
  const [stationList, setStationList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState(todayStr());
  const [filterDriver, setFilterDriver] = useState('');
  const [filterStation, setFilterStation] = useState('');
  const [exporting, setExporting] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualDriver, setManualDriver] = useState('');
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualError, setManualError] = useState('');
  const [manualSuccess, setManualSuccess] = useState('');
  const [lateTarget, setLateTarget] = useState(null);
  const [lateReason, setLateReason] = useState('');
  const [lateSubmitting, setLateSubmitting] = useState(false);

  const loadData = async (date, driver, station) => {
    try {
      setLoading(true);
      const params = {};
      if (date) params.date = date;
      if (driver) params.driver_id = driver;
      if (station && canManual) params.station_id = station;
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
    if (canManual) {
      stationsApi.list().then(setStationList).catch(() => {});
    }
  }, []);

  const handleExport = async () => {
    try {
      setExporting(true);
      const params = {};
      if (filterDate) params.date = filterDate;
      if (filterDriver) params.driver_id = filterDriver;
      if (filterStation && canManual) params.station_id = filterStation;
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

  const handleManualSubmit = async () => {
    if (!manualDriver) { setManualError('الرجاء اختيار سائق'); return; }
    setManualSubmitting(true);
    setManualError('');
    setManualSuccess('');
    try {
      const res = await attendance.manualAttend(parseInt(manualDriver));
      setManualSuccess(res.message || 'تم تسجيل الحضور بنجاح');
      setManualDriver('');
      setTimeout(() => setShowManual(false), 1200);
      loadData(filterDate, filterDriver, filterStation);
    } catch (err) {
      setManualError(err.message);
    } finally {
      setManualSubmitting(false);
    }
  };

  const handleMarkLate = async () => {
    if (!lateTarget || !lateReason.trim()) return;
    setLateSubmitting(true);
    try {
      await attendance.markLate({ attendance_id: lateTarget.id, reason: lateReason.trim() });
      setLateTarget(null);
      setLateReason('');
      loadData(filterDate, filterDriver, filterStation);
    } catch (err) {
      alert(err.message);
    } finally {
      setLateSubmitting(false);
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
        <div className="page-header-actions" style={{ gap: '0.5rem' }}>
          {canManual && (
            <button className="btn btn-primary" onClick={() => { setManualError(''); setManualSuccess(''); setShowManual(true); }}>
              + تسجيل يدوي
            </button>
          )}
          <button className="btn btn-outline" onClick={handleExport} disabled={exporting}>
            {exporting ? 'جاري...' : 'تصدير Excel'}
          </button>
        </div>
      </div>

      {showManual && (
        <div className="modal-overlay" onClick={() => setShowManual(false)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>تسجيل حضور يدوي</h3>
              <button className="modal-close" onClick={() => setShowManual(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ paddingTop: 0 }}>
              {manualError && <div className="alert alert-error" style={{ marginBottom: '0.75rem' }}>{manualError}</div>}
              {manualSuccess && <div className="alert alert-success" style={{ marginBottom: '0.75rem' }}>{manualSuccess}</div>}
              <div className="form-group">
                <label>اختر السائق</label>
                <select value={manualDriver} onChange={(e) => setManualDriver(e.target.value)} className="form-input">
                  <option value="">-- اختر سائق --</option>
                  {driverList.filter((d) => d.is_active).map((d) => (
                    <option key={d.id} value={d.id}>{d.full_name} ({d.license_plate || d.username})</option>
                  ))}
                </select>
              </div>
              <div className="form-actions" style={{ marginTop: '1rem' }}>
                <button className="btn btn-primary" onClick={handleManualSubmit} disabled={manualSubmitting || !manualDriver}>
                  {manualSubmitting ? 'جاري...' : 'تأكيد التسجيل'}
                </button>
                <button className="btn btn-outline" onClick={() => setShowManual(false)}>إلغاء</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {lateTarget && (
        <div className="modal-overlay" onClick={() => { setLateTarget(null); setLateReason(''); }}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>تسجيل تأخير: {lateTarget.name}</h3>
              <button className="modal-close" onClick={() => { setLateTarget(null); setLateReason(''); }}>✕</button>
            </div>
            <div className="modal-body" style={{ paddingTop: 0 }}>
              <div className="form-group">
                <label>سبب التأخير</label>
                <textarea value={lateReason} onChange={(e) => setLateReason(e.target.value)} className="form-input" placeholder="اكتب سبب التأخير..." rows={3} style={{ resize: 'vertical' }} />
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--nx-text-secondary)', marginBottom: '0.75rem' }}>
                سيتم تسجيل غرامة 150 د.ج تلقائياً
              </div>
              <div className="form-actions">
                <button className="btn btn-primary" style={{ background: '#DC2626' }} onClick={handleMarkLate} disabled={lateSubmitting || !lateReason.trim()}>
                  {lateSubmitting ? 'جاري...' : 'تأكيد التأخير'}
                </button>
                <button className="btn btn-outline" onClick={() => { setLateTarget(null); setLateReason(''); }}>إلغاء</button>
              </div>
            </div>
          </div>
        </div>
      )}

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
          {canManual && (
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
                <th>بواسطة</th>
                <th>طريقة التسجيل</th>
                <th>رقم الهاتف</th>
                <th>اللوحة</th>
                <th>سبب التأخير</th>
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
                  <td>{r.source === 'manual' ? <span className="badge badge-info">يدوي</span> : r.source === 'admin_late' ? <span className="badge badge-late">تأخير</span> : <span className="badge" style={{ background: 'var(--nx-bg-glass)', color: 'var(--nx-text-secondary)', border: '1px solid var(--nx-border)' }}>QR</span>}</td>
                  <td className="text-sm">{r.driver_phone || '—'}</td>
                  <td className="text-sm">{r.license_plate || '—'}</td>
                  <td className="text-sm">{r.late_reason || '—'}</td>
                  <td>
                    {r.is_late ? <span className="badge badge-late">متأخر</span> : r.verified ? <span className="badge badge-success">موثق</span> : <span className="badge badge-danger">غير موثق</span>}
                    {canManual && !r.is_late && (
                      <button onClick={() => setLateTarget({ id: r.id, name: r.driver_name })} className="btn btn-sm" style={{ marginRight: '0.35rem', background: '#DC2626', color: 'white', border: 'none', fontSize: '0.7rem', padding: '0.15rem 0.4rem' }}>
                        تأخير
                      </button>
                    )}
                  </td>
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
                <th>بواسطة</th>
                <th>طريقة التسجيل</th>
                <th>سبب التأخير</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.scan_date}</strong></td>
                  <td>{r.scan_time}</td>
                  <td>{r.scanned_by_name}</td>
                  <td>{r.source === 'manual' ? <span className="badge badge-info">يدوي</span> : r.source === 'admin_late' ? <span className="badge badge-late">تأخير</span> : <span className="badge" style={{ background: 'var(--nx-bg-glass)', color: 'var(--nx-text-secondary)', border: '1px solid var(--nx-border)' }}>QR</span>}</td>
                  <td className="text-sm">{r.late_reason || '—'}</td>
                  <td>{r.is_late ? <span className="badge badge-late">متأخر</span> : r.verified ? <span className="badge badge-success">موثق</span> : <span className="badge badge-danger">غير موثق</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
