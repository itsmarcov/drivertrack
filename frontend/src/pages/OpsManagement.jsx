import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { auth, stations } from '../api';

export default function OpsManagement() {
  const { user } = useAuth();
  const [opsList, setOpsList] = useState([]);
  const [stationList, setStationList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ username: '', password: '', full_name: '', email: '', phone: '', role: 'ops', station_id: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadOps = async () => {
    try { setLoading(true); const [data, st] = await Promise.all([auth.listOps(), stations.list()]); setOpsList(data); setStationList(st); } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadOps(); }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const payload = { ...form, station_id: form.station_id ? parseInt(form.station_id) : null };
    try {
      if (editing) {
        const { username, password, role, ...rest } = payload;
        if (!rest.password) delete rest.password;
        await auth.updateOps(editing.id, rest);
        setSuccess(`تم تحديث حساب "${form.full_name}" بنجاح`);
      } else {
        await auth.register(payload);
        setSuccess(`تم إنشاء حساب "${form.full_name}" بنجاح`);
      }
      setForm({ username: '', password: '', full_name: '', email: '', phone: '', role: 'ops', station_id: '' });
      setShowForm(false);
      setEditing(null);
      loadOps();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (ops) => {
    setEditing(ops);
    setForm({
      username: ops.username,
      password: '',
      full_name: ops.full_name,
      email: ops.email || '',
      phone: ops.phone || '',
      role: 'ops',
      station_id: ops.station_id ? String(ops.station_id) : '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`هل أنت متأكد من حذف المشغل "${name}"؟`)) return;
    try {
      await auth.deleteOps(id);
      setSuccess(`تم حذف المشغل "${name}" بنجاح`);
      loadOps();
    } catch (err) { setError(err.message); }
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
          <button className="btn btn-primary" onClick={() => { setEditing(null); setForm({ username: '', password: '', full_name: '', email: '', phone: '', role: 'ops', station_id: '' }); setShowForm(true); }}>+ إضافة مشغل</button>
        </div>
      </div>

      {error && <div className="alert alert-error" onClick={() => setError('')}>{error}</div>}
      {success && <div className="alert alert-success" onClick={() => setSuccess('')}>{success}</div>}

      {showForm && (
        <div className="modal-overlay" onClick={() => { setShowForm(false); setEditing(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editing ? 'تعديل المشغل' : 'إضافة مشغل جديد (OPS)'}</h3>
              <button className="modal-close" onClick={() => { setShowForm(false); setEditing(null); }}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>اسم المستخدم</label>
                  <input name="username" value={form.username} onChange={handleChange} required disabled={!!editing} />
                </div>
                <div className="form-group">
                  <label>{editing ? 'كلمة مرور جديدة (اختياري)' : 'كلمة المرور'}</label>
                  <input name="password" type="password" value={form.password} onChange={handleChange} required={!editing} />
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
              <div className="form-group">
                <label>المحطة</label>
                <select name="station_id" value={form.station_id} onChange={handleChange}>
                  <option value="">بدون محطة</option>
                  {stationList.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                </select>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">{editing ? 'حفظ التعديلات' : 'إنشاء الحساب'}</button>
                <button type="button" className="btn btn-outline" onClick={() => { setShowForm(false); setEditing(null); }}>إلغاء</button>
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
                <th>المحطة</th>
                <th>الحالة</th>
                <th>تاريخ الإنشاء</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {opsList.map((o) => (
                <tr key={o.id}>
                  <td><strong>{o.full_name}</strong></td>
                  <td>{o.username}</td>
                  <td>{o.email || '—'}</td>
                  <td>{o.phone || '—'}</td>
                  <td>{o.station_name ? <span className="badge badge-info">{o.station_name}</span> : '—'}</td>
                  <td>{o.is_active ? <span className="badge badge-success">نشط</span> : <span className="badge badge-danger">غير نشط</span>}</td>
                  <td className="text-sm text-muted">{o.created_at}</td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn-sm btn-outline" onClick={() => handleEdit(o)}>تعديل</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(o.id, o.full_name)}>حذف</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
