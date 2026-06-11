import { useState, useEffect } from 'react';
import { stations } from '../api';

export default function StationsManagement() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', code: '' });
  const [error, setError] = useState('');

  const load = async () => {
    try { setLoading(true); const data = await stations.list(); setList(data); } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editing) {
        await stations.update(editing.id, form);
      } else {
        await stations.create(form);
      }
      setShowForm(false);
      setEditing(null);
      setForm({ name: '', code: '' });
      load();
    } catch (err) { setError(err.message); }
  };

  const handleEdit = (s) => {
    setEditing(s);
    setForm({ name: s.name, code: s.code });
    setShowForm(true);
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`هل أنت متأكد من حذف المحطة "${name}"؟`)) return;
    try {
      await stations.delete(id);
      load();
    } catch (err) { setError(err.message); }
  };

  if (loading) return (
    <div className="loading-screen" style={{ minHeight: 200 }}>
      <div className="nx-loader"><div className="nx-spinner"></div></div>
    </div>
  );

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-content">
          <h2>إدارة المحطات</h2>
          <p>{list.length} محطة</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => { setEditing(null); setForm({ name: '', code: '' }); setShowForm(true); }}>+ إضافة محطة</button>
        </div>
      </div>

      {error && <div className="alert alert-error" onClick={() => setError('')}>{error}</div>}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editing ? 'تعديل المحطة' : 'إضافة محطة جديدة'}</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>اسم المحطة</label>
                <input name="name" value={form.name} onChange={handleChange} placeholder="مثال: محطة الشارقة" required />
              </div>
              <div className="form-group">
                <label>رمز المحطة</label>
                <input name="code" value={form.code} onChange={handleChange} placeholder="مثال: SHJ-01" required />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">{editing ? 'حفظ' : 'إنشاء'}</button>
                <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="table-container">
        {list.length === 0 ? (
          <div className="nx-empty">
            <div className="nx-empty-icon">🏭</div>
            <h3>لا توجد محطات بعد</h3>
            <p>قم بإضافة أول محطة لتوزيع السائقين والمشغلين</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>الرمز</th>
                <th>تاريخ الإنشاء</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id}>
                  <td><strong>{s.name}</strong></td>
                  <td><code>{s.code}</code></td>
                  <td className="text-sm text-muted">{s.created_at}</td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn-sm btn-outline" onClick={() => handleEdit(s)}>تعديل</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(s.id, s.name)}>حذف</button>
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
