import { useState, useEffect } from 'react';
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
  const [editingId, setEditingId] = useState(null);
  const [editParcels, setEditParcels] = useState('');

  const load = async (date, station) => {
    try {
      setLoading(true);
      const params = {};
      if (date) params.date = date;
      if (station && user.role === 'admin') params.station_id = station;
      const data = await penalties.list(params);
      setList(data);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load(filterDate, filterStation);
    if (user.role === 'admin') {
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

  const startEdit = (p) => {
    setEditingId(p.id);
    setEditParcels(String(p.parcels_count || 0));
  };

  const saveParcels = async (id) => {
    try {
      const res = await penalties.update(id, { parcels_count: parseInt(editParcels) || 0 });
      setList(prev => prev.map(p => p.id === id ? { ...p, parcels_count: res.penalty.parcels_count, amount: res.penalty.amount } : p));
      setEditingId(null);
    } catch (err) { setError(err.message); }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditParcels('');
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
        </div>
      </div>

      {loading ? (
        <div className="loading-screen" style={{ minHeight: 200 }}>
          <div className="nx-loader"><div className="nx-spinner"></div></div>
        </div>
      ) : list.length === 0 ? (
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
                <th>الطرود</th>
                <th>الربح</th>
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
                  <td>
                    {user.role === 'admin' && editingId === p.id ? (
                      <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                        <input
                          type="number" min="0"
                          value={editParcels}
                          onChange={(e) => setEditParcels(e.target.value)}
                          style={{ width: 60, padding: '0.2rem' }}
                        />
                        <button className="btn btn-sm btn-primary" onClick={() => saveParcels(p.id)}>حفظ</button>
                        <button className="btn btn-sm btn-outline" onClick={cancelEdit}>إلغاء</button>
                      </div>
                    ) : (
                      <span
                        style={{ cursor: user.role === 'admin' ? 'pointer' : 'default', borderBottom: user.role === 'admin' ? '1px dashed #999' : 'none' }}
                        onClick={() => user.role === 'admin' && startEdit(p)}
                        title={user.role === 'admin' ? 'انقر لتعديل عدد الطرود' : ''}
                      >
                        {p.parcels_count ?? '0'}
                      </span>
                    )}
                  </td>
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
