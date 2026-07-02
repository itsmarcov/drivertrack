import { useState, useEffect } from 'react';
import { auth } from '../api';

export default function PendingDrivers() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPending = () => {
    setLoading(true);
    auth.pendingDrivers().then(setDrivers).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchPending(); }, []);

  const handleApprove = async (id) => {
    try {
      await auth.approveDriver(id);
      setDrivers((prev) => prev.filter((d) => d.id !== id));
    } catch {}
  };

  const handleReject = async (id) => {
    if (!window.confirm('هل أنت متأكد من رفض هذا التسجيل؟')) return;
    try {
      await auth.rejectDriver(id);
      setDrivers((prev) => prev.filter((d) => d.id !== id));
    } catch {}
  };

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-content">
          <h2>طلبات تسجيل السائقين</h2>
          <p className="page-header-subtitle">الموافقة أو رفض طلبات التسجيل الجديدة</p>
        </div>
      </div>

      {loading ? (
        <div className="loading">جاري التحميل...</div>
      ) : drivers.length === 0 ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--nx-text-tertiary)' }}>
          لا توجد طلبات تسجيل معلقة
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>اسم المستخدم</th>
                <th>البريد</th>
                <th>الهاتف</th>
                <th>المحطة</th>
                <th>المركبة</th>
                <th>اللوحة</th>
                <th>تاريخ التسجيل</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((d) => (
                <tr key={d.id}>
                  <td><strong>{d.full_name}</strong></td>
                  <td>{d.username}</td>
                  <td>{d.email || '—'}</td>
                  <td>{d.phone || '—'}</td>
                  <td>{d.station_name || '—'}</td>
                  <td>{d.vehicle_type || '—'}</td>
                  <td>{d.license_plate || '—'}</td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--nx-text-secondary)' }}>{new Date(d.created_at).toLocaleDateString('fr-DZ')}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <button onClick={() => handleApprove(d.id)} className="btn btn-sm" style={{ background: '#16A34A', color: 'white', border: 'none' }}>موافقة</button>
                      <button onClick={() => handleReject(d.id)} className="btn btn-sm btn-danger">رفض</button>
                    </div>
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