import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { auth } from '../api';

export default function OpsManagement() {
  const { user } = useAuth();
  const [opsList, setOpsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', full_name: '', email: '', phone: '', role: 'ops' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadOps = async () => {
    try { setLoading(true); const data = await auth.listOps(); setOpsList(data); } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadOps(); }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await auth.register({ ...form });
      setSuccess(`تم إنشاء حساب "${form.full_name}" بنجاح`);
      setForm({ username: '', password: '', full_name: '', email: '', phone: '', role: 'ops' });
      setShowForm(false);
      loadOps();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return (
    <div className="loading-screen">
      <div className="nx-loader">
        <div className="nx-spinner"></div>
        <span className="nx-loader-label">جاري التحميل...</span>
      </div>
    </div>
  );

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-content">
          <h2>إدارة المشغلين (OPS)</h2>
          <p>{opsList.length} مشغل</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ إضافة مشغل</button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>إضافة مشغل جديد (OPS)</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>اسم المستخدم</label>
                  <input name="username" value={form.username} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label>كلمة المرور</label>
                  <input name="password" type="password" value={form.password} onChange={handleChange} required />
                </div>
              </div>
              <div className="form-group">
                <label>الاسم الكامل</label>
                <input name="full_name" value={form.full_name} onChange={handleChange} required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>البريد الإلكتروني</label>
                  <input name="email" type="email" value={form.email} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label>رقم الهاتف</label>
                  <input name="phone" value={form.phone} onChange={handleChange} />
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">إنشاء الحساب</button>
                <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="table-container">
        {opsList.length === 0 ? (
          <div className="nx-empty">
            <div className="nx-empty-icon">🔧</div>
            <h3>لا يوجد مشغلون بعد</h3>
            <p>قم بإضافة أول مشغل OPS</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>اسم المستخدم</th>
                <th>البريد</th>
                <th>الهاتف</th>
                <th>الحالة</th>
                <th>تاريخ الإنشاء</th>
              </tr>
            </thead>
            <tbody>
              {opsList.map((o) => (
                <tr key={o.id}>
                  <td><strong>{o.full_name}</strong></td>
                  <td>{o.username}</td>
                  <td>{o.email || '—'}</td>
                  <td>{o.phone || '—'}</td>
                  <td>{o.is_active ? <span className="badge badge-success">نشط</span> : <span className="badge badge-danger">غير نشط</span>}</td>
                  <td className="text-sm text-muted">{o.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
