import { useState, useEffect } from 'react';
import LoadingScreen from '../components/LoadingScreen';
import { announcements, stations as stationsApi } from '../api';

export default function AnnouncementsManagement() {
  const [list, setList] = useState([]);
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    message: '',
    priority: 'normal',
    audience_type: 'all',
    station_ids: '',
    driver_ids: '',
    starts_at: '',
    expires_at: '',
    is_active: 1,
  });

  const load = async () => {
    try {
      setLoading(true);
      const [data, st] = await Promise.all([announcements.list(), stationsApi.list()]);
      setList(data);
      setStations(st);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const openCreate = () => {
    setEditing(null);
    setForm({ message: '', priority: 'normal', audience_type: 'all', station_ids: '', driver_ids: '', starts_at: '', expires_at: '', is_active: 1 });
    setShowForm(true);
  };

  const openEdit = (a) => {
    setEditing(a);
    setForm({
      message: a.message,
      priority: a.priority,
      audience_type: a.audience_type,
      station_ids: a.station_ids || '',
      driver_ids: a.driver_ids || '',
      starts_at: a.starts_at ? a.starts_at.slice(0, 16) : '',
      expires_at: a.expires_at ? a.expires_at.slice(0, 16) : '',
      is_active: a.is_active,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const payload = {
        message: form.message,
        priority: form.priority,
        audience_type: form.audience_type,
        station_ids: form.audience_type === 'stations' ? form.station_ids : null,
        driver_ids: form.audience_type === 'drivers' ? form.driver_ids : null,
        starts_at: form.starts_at || null,
        expires_at: form.expires_at || null,
      };
      if (editing) {
        await announcements.update(editing.id, { ...payload, is_active: form.is_active ? 1 : 0 });
      } else {
        await announcements.create(payload);
      }
      setShowForm(false);
      setEditing(null);
      load();
    } catch (err) { setError(err.message); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الإعلان؟')) return;
    try {
      await announcements.delete(id);
      load();
    } catch (err) { setError(err.message); }
  };

  const toggleActive = async (a) => {
    try {
      await announcements.update(a.id, { is_active: a.is_active ? 0 : 1 });
      load();
    } catch (err) { setError(err.message); }
  };

  const now = new Date();

  if (loading) return <LoadingScreen />;

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-content">
          <h2>الإعلانات</h2>
          <p>{list.length} إعلان</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={openCreate}>+ إعلان جديد</button>
        </div>
      </div>

      {error && <div className="alert alert-error" onClick={() => setError('')}>{error}</div>}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <h3>{editing ? 'تعديل الإعلان' : 'إعلان جديد'}</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">الرسالة *</label>
                <textarea name="message" value={form.message} onChange={handleChange} rows={3} className="form-input" placeholder="نص الإعلان..." required />
              </div>
              <div className="form-group">
                <label className="form-label">الأولوية</label>
                <select name="priority" value={form.priority} onChange={handleChange} className="form-input">
                  <option value="normal">عادي</option>
                  <option value="urgent">عاجل</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">الجمهور المستهدف</label>
                <select name="audience_type" value={form.audience_type} onChange={handleChange} className="form-input">
                  <option value="all">جميع السائقين</option>
                  <option value="drivers">سائقين محددين</option>
                  <option value="stations">محطات محددة</option>
                </select>
              </div>
              {form.audience_type === 'drivers' && (
                <div className="form-group">
                  <label className="form-label">أرقام السائقين (مفصولة بفواصل)</label>
                  <input name="driver_ids" value={form.driver_ids} onChange={handleChange} className="form-input" placeholder="مثال: 1, 2, 5" />
                </div>
              )}
              {form.audience_type === 'stations' && (
                <div className="form-group">
                  <label className="form-label">المحطات</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 0' }}>
                    {stations.map((s) => {
                      const ids = form.station_ids ? form.station_ids.split(',').map((x) => x.trim()) : [];
                      const checked = ids.includes(String(s.id));
                      return (
                        <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer' }}>
                          <input type="checkbox" checked={checked} onChange={() => {
                            const newIds = checked ? ids.filter((x) => x !== String(s.id)) : [...ids, String(s.id)];
                            setForm({ ...form, station_ids: newIds.join(',') });
                          }} />
                          {s.name}
                        </label>
                      );
                    })}
                    {stations.length === 0 && <span style={{ fontSize: 12, color: '#888' }}>لا توجد محطات</span>}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">بداية العرض</label>
                  <input type="datetime-local" name="starts_at" value={form.starts_at} onChange={handleChange} className="form-input" />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">نهاية العرض</label>
                  <input type="datetime-local" name="expires_at" value={form.expires_at} onChange={handleChange} className="form-input" />
                </div>
              </div>
              {editing && (
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.is_active === 1} onChange={() => setForm({ ...form, is_active: form.is_active ? 0 : 1 })} />
                    مفعل
                  </label>
                </div>
              )}
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">{editing ? 'تحديث' : 'نشر'}</button>
                <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="table-container">
        {list.length === 0 ? (
          <div className="nx-empty">
            <div className="nx-empty-icon">📢</div>
            <h3>لا توجد إعلانات بعد</h3>
            <p>قم بإنشاء أول إعلان للسائقين</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>الرسالة</th>
                <th>الأولوية</th>
                <th>الجمهور</th>
                <th>الحالة</th>
                <th>الفترة</th>
                <th>تاريخ الإنشاء</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {list.map((a) => {
                const active = a.is_active === 1;
                const started = !a.starts_at || new Date(a.starts_at) <= now;
                const expired = a.expires_at && new Date(a.expires_at) < now;
                const visible = active && started && !expired;
                return (
                  <tr key={a.id}>
                    <td><strong style={{ fontSize: 13 }}>{a.message.length > 60 ? a.message.slice(0, 60) + '…' : a.message}</strong></td>
                    <td>
                      <span className={`badge ${a.priority === 'urgent' ? 'badge-danger' : 'badge-warning'}`}>
                        {a.priority === 'urgent' ? 'عاجل' : 'عادي'}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: '#888' }}>
                      {a.audience_type === 'all' ? 'الجميع' : a.audience_type === 'drivers' ? 'سائقين محددين' : 'محطات محددة'}
                    </td>
                    <td>
                      {visible ? <span className="badge badge-success">نشط</span>
                        : !active ? <span className="badge badge-danger">معطل</span>
                        : expired ? <span className="badge badge-warning">منتهي</span>
                        : <span className="badge badge-warning">مجدول</span>}
                    </td>
                    <td style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>
                      {a.starts_at ? new Date(a.starts_at).toLocaleDateString('fr-DZ') : 'فوري'}
                      {a.expires_at ? ' → ' + new Date(a.expires_at).toLocaleDateString('fr-DZ') : ''}
                    </td>
                    <td className="text-sm text-muted">{new Date(a.created_at).toLocaleDateString('fr-DZ')}</td>
                    <td>
                      <div className="flex gap-2" style={{ alignItems: 'center' }}>
                        <button className="btn btn-sm btn-outline" onClick={() => toggleActive(a)} title={active ? 'تعطيل' : 'تفعيل'}>
                          {active ? 'تعطيل' : 'تفعيل'}
                        </button>
                        <button className="btn btn-sm btn-outline" onClick={() => openEdit(a)}>تعديل</button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(a.id)}>حذف</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}