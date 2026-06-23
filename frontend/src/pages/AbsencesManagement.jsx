import { useState, useEffect } from 'react';
import { absences, stations as stationsApi } from '../api';
import { useAuth } from '../context/AuthContext';

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export default function AbsencesManagement() {
  const { user } = useAuth();
  const [absenceList, setAbsenceList] = useState([]);
  const [stationList, setStationList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [filterDate, setFilterDate] = useState(todayStr());
  const [filterShift, setFilterShift] = useState('');
  const [filterStation, setFilterStation] = useState('');
  const [marking, setMarking] = useState(false);

  const loadAbsences = async (date, shift, station) => {
    try {
      setLoading(true);
      const params = {};
      if (date) { params.date_from = date; params.date_to = date; }
      if (shift) params.shift = shift;
      if (station && user.role === 'admin') params.station_id = station;
      const data = await absences.list(params);
      setAbsenceList(data);
    } catch (err) {
      setMessage('❌ ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAbsences(filterDate, filterShift, filterStation);
    if (user.role === 'admin') {
      stationsApi.list().then(setStationList).catch(() => {});
    }
  }, []);

  const handleMark = async () => {
    if (!window.confirm('هل أنت متأكد من تسجيل غياب اليوم للسائقين الذين لم يسجلوا حضورهم؟')) return;
    setMarking(true);
    setMessage('');
    try {
      const res = await absences.mark();
      setMessage('✅ ' + res.message);
      loadAbsences(filterDate, filterShift, filterStation);
    } catch (err) {
      setMessage('❌ ' + err.message);
    } finally {
      setMarking(false);
    }
  };

  const handleExport = async () => {
    try {
      const params = {};
      if (filterDate) { params.date_from = filterDate; params.date_to = filterDate; }
      if (filterShift) params.shift = filterShift;
      if (filterStation && user.role === 'admin') params.station_id = filterStation;
      const blob = await absences.exportExcel(params);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `absences-${filterDate}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setMessage('❌ ' + err.message);
    }
  };

  const handleDateChange = (date) => {
    setFilterDate(date);
    loadAbsences(date, filterShift, filterStation);
  };

  const handleShiftChange = (shift) => {
    setFilterShift(shift);
    loadAbsences(filterDate, shift, filterStation);
  };

  const handleStationChange = (station) => {
    setFilterStation(station);
    loadAbsences(filterDate, filterShift, station);
  };

  const handleDeleteDate = async () => {
    if (!window.confirm(`هل أنت متأكد من حذف جميع غيابات ${filterDate}؟`)) return;
    setMessage('');
    try {
      const res = await absences.deleteByDate(filterDate);
      setMessage('✅ ' + res.message);
      loadAbsences(filterDate, filterShift, filterStation);
    } catch (err) {
      setMessage('❌ ' + err.message);
    }
  };

  if (loading) return (
    <div className="loading-screen">
      <div className="nx-loader">
        <div className="nx-spinner"></div>
        <span className="nx-loader-label">جاري تحميل الغيابات...</span>
      </div>
    </div>
  );

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-content">
          <h2>إدارة الغيابات</h2>
          <p>{absenceList.length} غياب في {filterDate}</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={handleMark} disabled={marking}>
            {marking ? 'جاري...' : 'تسجيل غياب اليوم'}
          </button>
          <button className="btn btn-outline" onClick={handleExport}>
            تصدير Excel
          </button>
        </div>
      </div>

      {message && (
        <div className={`alert ${message.includes('✅') ? 'alert-success' : 'alert-error'}`} onClick={() => setMessage('')}>
          {message}
        </div>
      )}

      <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <div className="form-row">
          <div className="form-group">
            <label>التاريخ (الأرشيف)</label>
            <input type="date" value={filterDate} onChange={(e) => handleDateChange(e.target.value)} />
          </div>
          <div className="form-group">
            <label>الفترة</label>
            <select value={filterShift} onChange={(e) => handleShiftChange(e.target.value)}>
              <option value="">الكل</option>
              <option value="morning">صباحية</option>
              <option value="evening">مسائية</option>
            </select>
          </div>
          {user.role === 'admin' && (
            <div className="form-group">
              <label>المحطة</label>
              <select value={filterStation} onChange={(e) => handleStationChange(e.target.value)}>
                <option value="">جميع المحطات</option>
                {stationList.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
          {user.role === 'admin' && (
            <div className="form-group" style={{ alignSelf: 'flex-end' }}>
              <button className="btn btn-danger" onClick={handleDeleteDate}>حذف غيابات هذا اليوم</button>
            </div>
          )}
        </div>
      </div>

      <div className="table-container">
        {absenceList.length === 0 ? (
          <div className="nx-empty">
            <div className="nx-empty-icon">📋</div>
            <h3>لا توجد غيابات</h3>
            <p>جميع السائقين مسجلون حضورهم اليوم</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>الاسم</th>
                <th>الهاتف</th>
                <th>المركبة</th>
                <th>اللوحة</th>
                <th>المحطة</th>
                <th>التاريخ</th>
                <th>الفترة</th>
              </tr>
            </thead>
            <tbody>
              {absenceList.map((a, i) => (
                <tr key={a.id}>
                  <td>{i + 1}</td>
                  <td><strong>{a.driver_name}</strong></td>
                  <td>{a.phone || '—'}</td>
                  <td>{a.vehicle_type || '—'}</td>
                  <td>{a.license_plate || '—'}</td>
                  <td>{a.station_name || '—'}</td>
                  <td>{a.absence_date}</td>
                  <td>{a.shift === 'evening' ? <span className="badge badge-warning">مسائية</span> : <span className="badge badge-info">صباحية</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
