import { useState, useEffect } from 'react';
import { penalties } from '../api';

export default function PenaltiesManagement() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState('');
  const [error, setError] = useState('');
  const [dlId, setDlId] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filterDate) params.date = filterDate;
      const data = await penalties.list(params);
      setList(data);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleFilter = (e) => { e.preventDefault(); load(); };

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

      <form className="nx-filter" onSubmit={handleFilter}>
        <div className="form-group">
          <label>التاريخ</label>
          <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
        </div>
        <button type="submit" className="btn btn-primary">تصفية</button>
        <button type="button" className="btn btn-outline" onClick={() => { setFilterDate(''); load(); }}>إعادة تعيين</button>
      </form>

      {loading ? (
        <div className="loading-screen" style={{ minHeight: 200 }}>
          <div className="nx-loader"><div className="nx-spinner"></div></div>
        </div>
      ) : list.length === 0 ? (
        <div className="nx-empty">
          <div className="nx-empty-icon">💰</div>
          <h3>لا توجد غرامات</h3>
          <p>سيتم تسجيل الغرامات تلقائياً عند تأخر السائقين عن 10:00 صباحاً</p>
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
