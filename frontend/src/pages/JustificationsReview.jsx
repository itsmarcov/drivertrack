import { useState, useEffect, useRef } from 'react';
import { justifications } from '../api';

const STAT_CARDS = [
  { key: 'pendingCount', label: 'قيد المراجعة', icon: '\u23F3', cls: 'jstat-pending' },
  { key: 'approvedCount', label: 'مقبول', icon: '\u2713', cls: 'jstat-approved' },
  { key: 'rejectedCount', label: 'مرفوض', icon: '\u2717', cls: 'jstat-rejected' },
  { key: 'totalCount', label: 'المجموع', icon: '\u2211', cls: 'jstat-total' },
];

function groupByDay(items) {
  const map = {};
  items.forEach((j) => {
    const d = j.attendance_date;
    if (!map[d]) map[d] = [];
    map[d].push(j);
  });
  return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
}

function reasonLabel(r) {
  const map = { sick: 'مرض', en_panne: 'عطل في المركبة', other: 'أخرى' };
  return map[r] || r;
}

function StatusBadge({ status }) {
  if (status === 'approved') return <span className="badge badge-success">مقبول</span>;
  if (status === 'rejected') return <span className="badge badge-danger">مرفوض</span>;
  return <span className="badge badge-warning">قيد المراجعة</span>;
}

export default function JustificationsReview() {
  const [list, setList] = useState([]);
  const [stats, setStats] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [archivedFilter, setArchivedFilter] = useState('false');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [proofUrl, setProofUrl] = useState(null);
  const [rejectNote, setRejectNote] = useState('');
  const [showReject, setShowReject] = useState(null);
  const mounted = useRef(true);

  const fetchAll = () => {
    setLoading(true);
    setError('');
    const params = {};
    if (statusFilter) params.status = statusFilter;
    params.archived = archivedFilter;
    Promise.all([
      justifications.list(params),
      justifications.stats(),
    ])
      .then(([data, s]) => {
        if (!mounted.current) return;
        setList(data);
        setStats(s);
      })
      .catch((e) => { if (mounted.current) setError(e.message); })
      .finally(() => { if (mounted.current) setLoading(false); });
  };

  useEffect(() => {
    mounted.current = true;
    fetchAll();
    return () => { mounted.current = false; };
  }, [statusFilter, archivedFilter]);

  const handleApprove = async (id) => {
    setActionLoading(id);
    try {
      await justifications.review(id, { status: 'approved' });
      fetchAll();
    } catch (e) { setError(e.message); }
    finally { setActionLoading(null); }
  };

  const handleReject = async (id) => {
    setActionLoading(id);
    try {
      await justifications.review(id, { status: 'rejected', admin_note: rejectNote || null });
      setShowReject(null);
      setRejectNote('');
      fetchAll();
    } catch (e) { setError(e.message); }
    finally { setActionLoading(null); }
  };

  const handleArchive = async (id) => {
    setActionLoading(id);
    try {
      await justifications.archive(id);
      fetchAll();
    } catch (e) { setError(e.message); }
    finally { setActionLoading(null); }
  };

  const handleRestore = async (id) => {
    setActionLoading(id);
    try {
      await justifications.restore(id);
      fetchAll();
    } catch (e) { setError(e.message); }
    finally { setActionLoading(null); }
  };

  const [proofBlob, setProofBlob] = useState(null);

  const viewProof = async (id) => {
    try {
      const res = await fetch(justifications.proofUrl(id), { credentials: 'same-origin' });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'فشل تحميل الملف');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setProofUrl(url);
      setProofBlob(blob);
    } catch (e) { setError(e.message); }
  };

  const closeProof = () => {
    if (proofUrl) { URL.revokeObjectURL(proofUrl); }
    setProofUrl(null);
    setProofBlob(null);
  };

  const handleDownload = async (id) => {
    try {
      const res = await fetch(justifications.downloadUrl(id), { credentials: 'same-origin' });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'فشل التحميل');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'proof';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) { setError(e.message); }
  };

  const handleDelete = async (id, driverName) => {
    if (!window.confirm(`هل أنت متأكد من حذف مبرر ${driverName}؟`)) return;
    setActionLoading(id);
    try {
      await justifications.remove(id);
      fetchAll();
    } catch (e) { setError(e.message); }
    finally { setActionLoading(null); }
  };

  const grouped = groupByDay(list);
  const isPdf = proofBlob?.type?.includes('pdf');

  if (loading && list.length === 0) return <div className="loading">جاري التحميل...</div>;

  return (
    <div className="page fade-slide-in">

      {error && <div className="alert alert-error">{error}</div>}

      {stats && (
        <div className="jstat-row fade-slide-in">
          {STAT_CARDS.map((c, i) => (
            <div key={c.key} className={'jstat-card card-hover ' + c.cls} style={{ animationDelay: `${0.05 + i * 0.07}s` }}>
              <div className="jstat-icon">{c.icon}</div>
              <div>
                <div className="jstat-num">{Number(stats[c.key]) || 0}</div>
                <div className="jstat-label">{c.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="nx-filter" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ flex: '1 1 160px' }}>
          <label className="form-label" style={{ fontSize: '0.8rem' }}>تصفية حسب الحالة</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="form-input">
            <option value="">جميع الحالات</option>
            <option value="pending">قيد المراجعة</option>
            <option value="approved">مقبولة</option>
            <option value="rejected">مرفوضة</option>
          </select>
        </div>
        <div className="form-group" style={{ flex: '1 1 140px' }}>
          <label className="form-label" style={{ fontSize: '0.8rem' }}>الأرشيف</label>
          <select value={archivedFilter} onChange={(e) => setArchivedFilter(e.target.value)} className="form-input">
            <option value="false">نشطة</option>
            <option value="true">مؤرشفة</option>
            <option value="">الكل</option>
          </select>
        </div>
      </div>

      {grouped.length === 0 && !loading && (
        <div className="nx-empty">
          <div className="nx-empty-icon">📋</div>
          <h3>لا توجد مبررات</h3>
          <p>{archivedFilter === 'true' ? 'لا توجد مبررات مؤرشفة' : 'لم يتم تقديم أي مبررات بعد'}</p>
        </div>
      )}

      <div className="fade-slide-in" style={{ animationDelay: '0.1s' }}>
        {grouped.map(([date, items]) => (
          <div key={date} style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: '0.85rem', fontWeight: 700, color: 'var(--nx-text)',
              padding: '6px 0', marginBottom: 4,
              borderBottom: '2px solid var(--nx-border)', display: 'flex', alignItems: 'center', gap: 8
            }}>
              <span>{date}</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--nx-text-muted)', fontWeight: 400 }}>
                ({items.length} {items.length === 1 ? 'مبرر' : 'مبررات'})
              </span>
            </div>
            <div className="table-container table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>السائق</th>
                    <th>السبب</th>
                    <th>ملاحظة</th>
                    <th>الملف</th>
                    <th>الحالة</th>
                    <th>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((j, idx) => (
                    <tr key={j.id} className="nx-table-row" style={{ animationDelay: `${0.15 + idx * 0.04}s` }}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{j.driver_name}</div>
                        <small style={{ color: 'var(--nx-text-muted)', fontSize: '0.75rem' }}>{j.phone}</small>
                      </td>
                      <td>
                        {reasonLabel(j.reason)}
                        {j.note && <><br /><small style={{ color: 'var(--nx-text-secondary)', fontSize: '0.75rem' }}>{j.note}</small></>}
                      </td>
                      <td style={{ color: 'var(--nx-text-secondary)', fontSize: '0.8rem' }}>{j.admin_note || '—'}</td>
                      <td>
                        {j.proof_file ? (
                          <div className="jaction-group" style={{ flexDirection: 'column', gap: '0.25rem' }}>
                            <button onClick={() => viewProof(j.id)} className="btn btn-ghost btn-sm">
                              عرض الملف
                            </button>
                            <button onClick={() => handleDownload(j.id)} className="btn btn-sm" style={{ background: 'var(--nx-bg-glass)', border: '1px solid var(--nx-border)', color: 'var(--nx-text)' }}>
                              تحميل
                            </button>
                          </div>
                        ) : '—'}
                      </td>
                      <td><StatusBadge status={j.status} /></td>
                      <td>
                        <div className="jaction-group" style={{ flexWrap: 'wrap' }}>
                          {j.status === 'pending' && !j.archived_at && (
                            <>
                              <button onClick={() => handleApprove(j.id)} disabled={actionLoading === j.id}
                                className="btn btn-sm jaction-approve">
                                {actionLoading === j.id ? '...' : 'قبول'}
                              </button>
                              <button onClick={() => { setShowReject(showReject === j.id ? null : j.id); setRejectNote(''); }}
                                className="btn btn-sm jaction-reject">
                                رفض
                              </button>
                            </>
                          )}
                          {!j.archived_at ? (
                            <button onClick={() => handleArchive(j.id)} disabled={actionLoading === j.id}
                              className="btn btn-sm" style={{ background: 'transparent', border: '1px solid var(--nx-border)', color: 'var(--nx-text-muted)', fontSize: '0.75rem' }}>
                              أرشفة
                            </button>
                          ) : (
                            <button onClick={() => handleRestore(j.id)} disabled={actionLoading === j.id}
                              className="btn btn-sm" style={{ background: 'transparent', border: '1px solid var(--nx-primary)', color: 'var(--nx-primary)', fontSize: '0.75rem' }}>
                              استعادة
                            </button>
                          )}
                          <button onClick={() => handleDelete(j.id, j.driver_name)} disabled={actionLoading === j.id}
                            className="btn btn-sm" style={{ background: 'transparent', border: '1px solid var(--nx-border)', color: 'var(--nx-text-muted)', fontSize: '0.75rem' }}>
                            حذف
                          </button>
                        </div>
                        {showReject === j.id && (
                          <div className="jaction-reject-box fade-slide-in">
                            <textarea value={rejectNote} onChange={(e) => setRejectNote(e.target.value)}
                              placeholder="سبب الرفض..." rows={2} className="form-input" style={{ fontSize: '0.8rem', marginBottom: '0.35rem' }} />
                            <button onClick={() => handleReject(j.id)} disabled={actionLoading === j.id}
                              className="btn btn-sm jaction-reject-confirm">
                              {actionLoading === j.id ? '...' : 'تأكيد الرفض'}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {proofUrl && (
        <div className="modal-overlay" onClick={closeProof}>
          <div className="modal" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>الملف المرفق</h3>
              <button className="modal-close" onClick={closeProof}>✕</button>
            </div>
            {isPdf ? (
              <iframe src={proofUrl} style={{ width: '100%', height: 'min(500px, 70vh)', border: 'none', borderRadius: 'var(--nx-radius-sm)' }} title="Proof" />
            ) : (
              <img src={proofUrl} alt="proof" style={{ width: '100%', borderRadius: 'var(--nx-radius-sm)' }} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
