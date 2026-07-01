import { useState, useEffect } from 'react';
import LoadingScreen from '../components/LoadingScreen';
import { useAuth } from '../context/AuthContext';
import { auth, stations } from '../api';

export default function OpsManagement() {
  const { user } = useAuth();
  const isSuper = user.role === 'super_admin';
  const [tab, setTab] = useState('ops');
  const [opsList, setOpsList] = useState([]);
  const [adminList, setAdminList] = useState([]);
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

  const loadAdmins = async () => {
    try { setLoading(true); const data = await auth.listAdmins(); setAdminList(data); } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (tab === 'ops') loadOps(); else loadAdmins(); }, [tab]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const payload = { ...form, station_id: form.station_id ? parseInt(form.station_id) : null };
    try {
      if (editing) {
        const { username, role, ...rest } = payload;
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
      tab === 'ops' ? loadOps() : loadAdmins();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (item) => {
    setEditing(item);
    setForm({
      username: item.username,
      password: '',
      full_name: item.full_name,
      email: item.email || '',
      phone: item.phone || '',
      role: 'ops',
      station_id: item.station_id ? String(item.station_id) : '',
    });
    setShowForm(true);
  };

  const handleDeleteOps = async (id, name) => {
    if (!window.confirm(`هل أنت متأكد من حذف المشغل "${name}"؟`)) return;
    try {
      await auth.deleteOps(id);
      setSuccess(`تم حذف المشغل "${name}" بنجاح`);
      loadOps();
    } catch (err) { setError(err.message); }
  };

  const handleDeleteAdmin = async (id, name) => {
    if (!window.confirm(`هل أنت متأكد من حذف المدير "${name}"؟`)) return;
    try {
      await auth.deleteAdmin(id);
      setSuccess(`تم حذف المدير "${name}" بنجاح`);
      loadAdmins();
    } catch (err) { setError(err.message); }
  };

  const openAddForm = (role) => {
    setEditing(null);
    setForm({ username: '', password: '', full_name: '', email: '', phone: '', role, station_id: '' });
    setShowForm(true);
  };

  if (loading) return <LoadingScreen message="جاري التحميل..." />;

  return (
    <div className="page fade-slide-in">
      <div className="page-header">
        <div className="page-header-content">
          <h2>{isSuper ? 'إدارة الحسابات' : 'إدارة المشغلين (OPS)'}</h2>
          <p>{tab === 'ops' ? opsList.length : adminList.length} مستخدم</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => openAddForm(tab === 'ops' ? 'ops' : 'admin')}>
            + إضافة {tab === 'ops' ? 'مشغل' : 'مدير'}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error" onClick={() => setError('')}>{error}</div>}
      {success && <div className="alert alert-success" onClick={() => setSuccess('')}>{success}</div>}

      {isSuper && (
        <div className="driver-tabs" style={{ marginBottom: '1.25rem' }}>
          <button className={'driver-tab' + (tab === 'ops' ? ' active' : '')} onClick={() => setTab('ops')}>المشغلون (OPS)</button>
          <button className={'driver-tab' + (tab === 'admin' ? ' active' : '')} onClick={() => setTab('admin')}>المديرون (Admin)</button>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => { setShowForm(false); setEditing(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editing ? 'تعديل' : 'إضافة'} {tab === 'ops' ? 'مشغل' : 'مدير'}</h3>
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
              {tab === 'ops' && (
                <div className="form-group">
                  <label>المحطة</label>
                  <select name="station_id" value={form.station_id} onChange={handleChange}>
                    <option value="">بدون محطة</option>
                    {stationList.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                  </select>
                </div>
              )}
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">{editing ? 'حفظ التعديلات' : 'إنشاء الحساب'}</button>
                <button type="button" className="btn btn-outline" onClick={() => { setShowForm(false); setEditing(null); }}>إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {tab === 'ops' && (
        <div className="table-container">
          {opsList.length === 0 ? (
            <div className="nx-empty"><div className="nx-empty-icon">🔧</div><h3>لا يوجد مشغلون بعد</h3><p>قم بإضافة أول مشغل OPS</p></div>
          ) : (
            <table className="table">
              <thead><tr><th>الاسم</th><th>اسم المستخدم</th><th>البريد</th><th>الهاتف</th><th>المحطة</th><th>الحالة</th><th>تاريخ الإنشاء</th><th>الإجراءات</th></tr></thead>
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
                        <button className="btn btn-sm btn-danger" onClick={() => handleDeleteOps(o.id, o.full_name)}>حذف</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'admin' && (
        <div className="table-container">
          {adminList.length === 0 ? (
            <div className="nx-empty"><div className="nx-empty-icon">🔧</div><h3>لا يوجد مديرون بعد</h3><p>قم بإضافة أول مدير</p></div>
          ) : (
            <table className="table">
              <thead><tr><th>الاسم</th><th>اسم المستخدم</th><th>البريد</th><th>الهاتف</th><th>الحالة</th><th>تاريخ الإنشاء</th><th>الإجراءات</th></tr></thead>
              <tbody>
                {adminList.map((a) => (
                  <tr key={a.id}>
                    <td><strong>{a.full_name}</strong></td>
                    <td>{a.username}</td>
                    <td>{a.email || '—'}</td>
                    <td>{a.phone || '—'}</td>
                    <td>{a.is_active ? <span className="badge badge-success">نشط</span> : <span className="badge badge-danger">غير نشط</span>}</td>
                    <td className="text-sm text-muted">{a.created_at}</td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-sm btn-danger" onClick={() => handleDeleteAdmin(a.id, a.full_name)}>حذف</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
