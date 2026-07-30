import { useState, useEffect } from 'react';
import { warnings, drivers } from '../api';

export default function WarningsManagement() {
  const [list, setList] = useState([]);
  const [driverList, setDriverList] = useState([]);
  const [stats, setStats] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ driver_id: '', title: '', content: '' });

  const load = async () => {
    try {
      const [w, s, d] = await Promise.all([
        warnings.list({ status: filter || undefined }),
        warnings.stats(),
        drivers.list(),
      ]);
      setList(w);
      setStats(s);
      setDriverList(d);
    } catch {}
  };
  useEffect(() => { load(); }, [filter]);

  const handleCreate = async () => {
    if (!form.driver_id || !form.title || !form.content) return;
    setSaving(true);
    try {
      await warnings.create({ driver_id: parseInt(form.driver_id), title: form.title, content: form.content });
      setShowForm(false);
      setForm({ driver_id: '', title: '', content: '' });
      load();
    } catch {}
    setSaving(false);
  };

  const handleArchive = async (id) => {
    try { await warnings.archive(id); load(); } catch {}
  };
  const handleRestore = async (id) => {
    try { await warnings.restore(id); load(); } catch {}
  };

  const statusBadge = (s) => {
    const m = { pending: { label: 'بانتظار التوقيع', cls: 'badge-warning' }, signed: { label: 'موقع', cls: 'badge-success' }, archived: { label: 'مؤرشف', cls: 'badge' } };
    const x = m[s] || { label: s, cls: 'badge' };
    return <span className={`badge ${x.cls}`}>{x.label}</span>;
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2>الإنذارات</h2>
          {stats && (
            <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 13, color: '#888' }}>
              <span>المجموع: <strong>{stats.total}</strong></span>
              <span>بانتظار التوقيع: <strong style={{ color: '#F59E0B' }}>{stats.pending}</strong></span>
              <span>موقع: <strong style={{ color: '#10B981' }}>{stats.signed}</strong></span>
              <span>مؤرشف: <strong style={{ color: '#6B7280' }}>{stats.archived}</strong></span>
            </div>
          )}
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'إلغاء' : '+ إنذار جديد'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <select className="form-input" value={form.driver_id} onChange={(e) => setForm({ ...form, driver_id: e.target.value })}>
              <option value="">اختر سائق...</option>
              {driverList.map((d) => <option key={d.id} value={d.id}>{d.full_name} ({d.phone || d.username})</option>)}
            </select>
            <input className="form-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="عنوان الإنذار" />
            <textarea className="form-input" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="محتوى الإنذار..." rows={4} />
            <button className="btn btn-primary" onClick={handleCreate} disabled={saving || !form.driver_id || !form.title || !form.content}>
              {saving ? 'جاري الحفظ...' : 'إرسال الإنذار'}
            </button>
          </div>
        </div>
      )}

      <div className="sm-filter" style={{ padding: '0 0 12px 0' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {['', 'pending', 'signed', 'archived'].map((s) => (
            <button key={s} className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter(s)}>
              {s === '' ? 'الكل' : s === 'pending' ? 'بانتظار التوقيع' : s === 'signed' ? 'موقع' : 'مؤرشف'}
            </button>
          ))}
        </div>
      </div>

      <div className="sm-sidebar-list" style={{ padding: 0 }}>
        {list.length === 0 ? (
          <div className="nx-empty">
            <div className="nx-empty-icon">📋</div>
            <h3>لا توجد إنذارات</h3>
          </div>
        ) : (
          list.map((w) => (
            <div key={w.id} className="sm-sidebar-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{w.title}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {statusBadge(w.status)}
                  {w.status === 'pending' && (
                    <button className="btn btn-sm btn-outline" onClick={() => handleArchive(w.id)} style={{ fontSize: 11, padding: '2px 8px' }}>أرشفة</button>
                  )}
                  {w.status === 'archived' && (
                    <button className="btn btn-sm btn-outline" onClick={() => handleRestore(w.id)} style={{ fontSize: 11, padding: '2px 8px' }}>استرجاع</button>
                  )}
                </div>
              </div>
              <div style={{ fontSize: 13, color: '#555', whiteSpace: 'pre-wrap' }}>{w.content}</div>
              <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#888' }}>
                <span>السائق: <strong>{w.driver_name}</strong></span>
                {w.phone && <span>{w.phone}</span>}
                {w.license_plate && <span>{w.license_plate}</span>}
                {w.signed_at && <span>وقع في: {new Date(w.signed_at).toLocaleString('fr-DZ')}</span>}
                <span style={{ marginRight: 'auto' }}>{new Date(w.created_at).toLocaleString('fr-DZ')}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
