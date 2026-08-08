import { useState, useEffect, useRef } from 'react';
import { warnings, drivers, stations } from '../api';

export default function WarningsManagement() {
  const [list, setList] = useState([]);
  const [driverList, setDriverList] = useState([]);
  const [stationList, setStationList] = useState([]);
  const [stats, setStats] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('');
  const [filterStation, setFilterStation] = useState('');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ driver_ids: [], title: '', content: '' });
  const [selectAll, setSelectAll] = useState(false);
  const [formDriverSearch, setFormDriverSearch] = useState('');
  const [bulkMode, setBulkMode] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(null);
  const [pdfError, setPdfError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    const params = {};
    if (filter) params.status = filter;
    if (filterStation) params.station_id = filterStation;
    if (search) params.search = search;
    try { const w = await warnings.list(params); setList(w); } catch (e) { console.error('load warnings', e); }
    try { const s = await warnings.stats(); setStats(s); } catch (e) { console.error('load stats', e); }
    try { const d = await drivers.list(); setDriverList(d); } catch (e) { console.error('load drivers', e); }
    try { const st = await stations.list(); setStationList(st); } catch (e) { console.error('load stations', e); }
  };
  useEffect(() => { load(); }, [filter, filterStation, search]);

  const filteredDrivers = driverList.filter((d) => {
    if (bulkMode && filterStation && d.station_id !== parseInt(filterStation)) return false;
    if (!formDriverSearch) return true;
    const q = formDriverSearch.toLowerCase();
    return d.full_name?.toLowerCase().includes(q) || d.phone?.includes(q) || d.license_plate?.toLowerCase().includes(q);
  });

  const toggleDriver = (id) => {
    setForm((f) => ({
      ...f,
      driver_ids: f.driver_ids.includes(id) ? f.driver_ids.filter((x) => x !== id) : [...f.driver_ids, id],
    }));
  };

  const prevSelectAll = useRef(false);
  useEffect(() => {
    if (selectAll) {
      setForm((f) => ({ ...f, driver_ids: filteredDrivers.map((d) => d.id) }));
    } else if (prevSelectAll.current) {
      setForm((f) => ({ ...f, driver_ids: [] }));
    }
    prevSelectAll.current = selectAll;
  }, [selectAll]);

  const handleCreate = async () => {
    if (form.driver_ids.length === 0 || !form.title || !form.content) return;
    setSaving(true);
    try {
      await warnings.create({ driver_ids: form.driver_ids, title: form.title, content: form.content });
      setShowForm(false);
      setForm({ driver_ids: [], title: '', content: '' });
      setBulkMode(false);
      setFormDriverSearch('');
      setSelectAll(false);
      load();
    } catch (e) { console.error('create warning', e); }
    setSaving(false);
  };

  const handleArchive = async (id) => { try { await warnings.archive(id); load(); } catch (e) { console.error('archive', e); } };
  const handleRestore = async (id) => { try { await warnings.restore(id); load(); } catch (e) { console.error('restore', e); } };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try { await warnings.remove(confirmDelete.id); load(); } catch (e) { console.error('delete', e); }
    setDeleting(false);
    setConfirmDelete(null);
  };

  const handlePdf = async (id) => {
    setPdfLoading(id);
    setPdfError('');
    try {
      const blob = await warnings.downloadPdf(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `warning-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) { setPdfError(err.message); }
    setPdfLoading(null);
  };

  const statusBadge = (s) => {
    const m = {
      pending: { label: 'بانتظار التوقيع', cls: 'badge-warning', icon: '🕓' },
      signed: { label: 'موقع', cls: 'badge-success', icon: '✍️' },
      archived: { label: 'مؤرشف', cls: 'badge', icon: '📁' },
    };
    const x = m[s] || { label: s, cls: 'badge', icon: '•' };
    return <span className={`badge ${x.cls} w-status-badge`}><span className="w-status-badge-icon">{x.icon}</span>{x.label}</span>;
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2>الإنذارات</h2>
          {stats && (
            <div className="w-stats-bar">
              <span className="w-stat-chip w-stat-total">المجموع: <strong>{stats.total}</strong></span>
              <span className="w-stat-chip w-stat-pending">بانتظار التوقيع: <strong>{stats.pending}</strong></span>
              <span className="w-stat-chip w-stat-signed">موقع: <strong>{stats.signed}</strong></span>
              <span className="w-stat-chip w-stat-archived">مؤرشف: <strong>{stats.archived}</strong></span>
            </div>
          )}
        </div>
        <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setBulkMode(false); setForm({ driver_ids: [], title: '', content: '' }); }}>
          {showForm ? 'إلغاء' : '+ إنذار جديد'}
        </button>
      </div>

      {showForm && (
        <div className="w-form-card">
          <div className="w-form-header">
            <h3>{bulkMode ? 'إرسال إنذار لمجموعة من السائقين' : 'إنذار جديد'}</h3>
            <label className="w-bulk-toggle">
              <input type="checkbox" checked={bulkMode} onChange={() => { setBulkMode(!bulkMode); setForm({ driver_ids: [], title: '', content: '' }); setSelectAll(false); }} />
              <span>إرسال لمجموعة</span>
            </label>
          </div>
          <div className="w-form-body">
            <div className="w-form-row">
              <input className="form-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="عنوان الإنذار" />
            </div>
            <div className="w-form-row">
              <textarea className="form-input" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="محتوى الإنذار..." rows={4} />
            </div>
            <div className="w-form-row">
              <input className="form-input" value={formDriverSearch} onChange={(e) => setFormDriverSearch(e.target.value)} placeholder="بحث عن سائق بالاسم أو الهاتف..." />
            </div>
            {bulkMode && (
              <div className="w-form-row" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select className="form-input" style={{ flex: 1 }} value={filterStation} onChange={(e) => setFilterStation(e.target.value)}>
                  <option value="">جميع المحطات</option>
                  {stationList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
            <div className="w-driver-grid">
              <div className="w-driver-grid-header">
                <span>السائقون ({filteredDrivers.length})</span>
                {bulkMode && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                    <input type="checkbox" checked={selectAll} onChange={() => setSelectAll(!selectAll)} />
                    اختر الكل
                  </label>
                )}
              </div>
              <div className="w-driver-grid-list">
                {filteredDrivers.map((d) => (
                  <div key={d.id} className={`w-driver-item ${form.driver_ids.includes(d.id) ? 'selected' : ''}`}
                    onClick={() => toggleDriver(d.id)}>
                    <div className="w-driver-item-info">
                      <div className="w-driver-item-name">{d.full_name}</div>
                      <div className="w-driver-item-meta">{d.phone} {d.station_name ? `· ${d.station_name}` : ''}</div>
                    </div>
                    {form.driver_ids.includes(d.id) && <span className="w-driver-check">✓</span>}
                  </div>
                ))}
                {filteredDrivers.length === 0 && <div className="w-empty">لا يوجد سائقين</div>}
              </div>
            </div>
            <div className="w-form-actions">
              <button className="btn btn-primary" onClick={handleCreate}
                disabled={saving || form.driver_ids.length === 0 || !form.title || !form.content}>
                {saving ? 'جاري الإرسال...' : `إرسال الإنذار (${form.driver_ids.length} سائق)`}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-filters">
        <input className="form-input w-search-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث عن سائق..." />
        <select className="form-input w-station-select" value={filterStation} onChange={(e) => setFilterStation(e.target.value)}>
          <option value="">جميع المحطات</option>
          {stationList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div className="w-status-filters">
          {['', 'pending', 'signed', 'archived'].map((s) => (
            <button key={s} className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter(s)}>
              {s === '' ? 'الكل' : s === 'pending' ? 'بانتظار التوقيع' : s === 'signed' ? 'موقع' : 'مؤرشف'}
            </button>
          ))}
        </div>
      </div>

      {pdfError && <div className="alert alert-error" style={{ marginBottom: 12, fontSize: 13 }}>{pdfError}</div>}

      <div className="w-list">
        {list.length === 0 ? (
          <div className="nx-empty">
            <div className="nx-empty-icon">📋</div>
            <h3>لا توجد إنذارات</h3>
          </div>
        ) : (
          list.map((w) => (
            <div key={w.id} className={`w-card w-card-${w.status}`}>
              <div className="w-card-top">
                <div className="w-card-title-row">
                  <span className="w-card-icon">⚠️</span>
                  <div className="w-card-title-col">
                    <strong className="w-card-title">{w.title}</strong>
                    <span className="w-card-subtitle">{new Date(w.created_at).toLocaleString('fr-DZ')}</span>
                  </div>
                  {statusBadge(w.status)}
                </div>
                <div className="w-card-actions">
                  <button className="btn btn-sm btn-outline" onClick={() => handlePdf(w.id)} disabled={pdfLoading === w.id} title="تحميل PDF">
                    {pdfLoading === w.id ? '...' : 'PDF'}
                  </button>
                  {(w.status === 'pending' || w.status === 'signed') && (
                    <button className="btn btn-sm btn-outline" onClick={() => handleArchive(w.id)} title="أرشفة الإنذار">أرشفة</button>
                  )}
                  {w.status === 'archived' && (
                    <button className="btn btn-sm btn-outline" onClick={() => handleRestore(w.id)} title="استرجاع الإنذار">استرجاع</button>
                  )}
                  <button className="btn btn-sm btn-danger" onClick={() => setConfirmDelete(w)} title="حذف نهائي">حذف</button>
                </div>
              </div>
              <div className="w-card-content">{w.content}</div>
              <div className="w-card-meta">
                <span className="w-card-meta-driver"><strong>{w.driver_name}</strong></span>
                {w.phone && <span>📞 {w.phone}</span>}
                {w.license_plate && <span>🚗 {w.license_plate}</span>}
                {w.station_name && <span className="w-station-badge">{w.station_name}</span>}
                {w.admin_name && <span>من: {w.admin_name}</span>}
                {w.signed_at && <span>وقع في: {new Date(w.signed_at).toLocaleString('fr-DZ')}</span>}
              </div>
            </div>
          ))
        )}
      </div>

      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal w-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="w-confirm-icon">🗑️</div>
            <h3>حذف الإنذار</h3>
            <p>هل أنت متأكد من حذف الإنذار <strong>{confirmDelete.title}</strong> نهائياً؟ لا يمكن التراجع عن هذه العملية.</p>
            <div className="w-confirm-actions">
              <button className="btn btn-outline" onClick={() => setConfirmDelete(null)}>إلغاء</button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'جاري الحذف...' : 'حذف نهائي'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
