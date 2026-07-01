import { useState, useEffect } from 'react';
import LoadingScreen from '../components/LoadingScreen';
import { penalties, stations as stationsApi } from '../api';
import { useAuth } from '../context/AuthContext';

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export default function PenaltiesManagement() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [stationList, setStationList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState(todayStr());
  const [filterStation, setFilterStation] = useState('');
  const [error, setError] = useState('');
  const [dlId, setDlId] = useState(null);

  const load = async (date, station) => {
    try {
      setLoading(true);
      const params = {};
      if (date) params.date = date;
      if (station && ['admin', 'super_admin'].includes(user.role)) params.station_id = station;
      const data = await penalties.list(params);
      setList(data);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load(filterDate, filterStation);
    if (['admin', 'super_admin'].includes(user.role)) {
      stationsApi.list().then(setStationList).catch(() => {});
    }
  }, []);

  const handleDateChange = (date) => {
    setFilterDate(date);
    load(date, filterStation);
  };

  const handleStationChange = (station) => {
    setFilterStation(station);
    load(filterDate, station);
  };

  const downloadReport = async (id) => {
    try {
      setDlId(id);
      const blob = await penalties.report(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `penalty-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) { setError(err.message); }
    finally { setDlId(null); }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-content">
          <h2>الغرامات</h2>
          <p>{list.length} غرامة</p>
        </div>
      </div>

      {error && <div className="alert alert-error" onClick={() => setError('')}>{error}</div>}

      <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <div className="form-row">
          <div className="form-group">
            <label>التاريخ</label>
            <input type="date" value={filterDate} onChange={(e) => handleDateChange(e.target.value)} />
          </div>
          {['admin', 'super_admin'].includes(user.role) && (
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
        </div>
      </div>

      {loading ? <LoadingScreen /> : list.length === 0 ? (
        <div className="nx-empty">
          <div className="nx-empty-icon">💰</div>
          <h3>لا توجد غرامات</h3>
          <p>سيتم تسجيل الغرامات تلقائياً عند تأخر السائقين</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>السائق</th>
                <th>التاريخ</th>
                <th>السبب</th>
                <th>المبلغ</th>
                <th>التقرير</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p, i) => (
                <tr key={p.id}>
                  <td className="text-sm text-muted">{i + 1}</td>
                  <td><strong>{p.driver_name}</strong></td>
                  <td>{p.penalty_date}</td>
                  <td className="text-sm">{p.reason}</td>
                  <td><strong style={{ color: '#B91C1C' }}>{p.amount} د.ج</strong></td>
                  <td>
                    <button className="btn btn-sm btn-outline" onClick={() => downloadReport(p.id)} disabled={dlId === p.id}>
                      {dlId === p.id ? '...' : 'PDF'}
                    </button>
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
