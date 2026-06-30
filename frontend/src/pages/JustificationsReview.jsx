import { useState, useEffect, useRef } from 'react';
import { justifications } from '../api';

const STAT_CARDS = [
  { key: 'pendingCount', label: 'قيد المراجعة', icon: '\u23F3', cls: 'jstat-pending' },
  { key: 'approvedCount', label: 'مقبول', icon: '\u2713', cls: 'jstat-approved' },
  { key: 'rejectedCount', label: 'مرفوض', icon: '\u2717', cls: 'jstat-rejected' },
  { key: 'totalCount', label: 'المجموع', icon: '\u2211', cls: 'jstat-total' },
];

export default function JustificationsReview() {
  const [list, setList] = useState([]);
  const [stats, setStats] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
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
    Promise.all([
      justifications.list(statusFilter ? { status: statusFilter } : {}),
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
  }, [statusFilter]);

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

  const [proofBlob, setProofBlob] = useState(null);

  const viewProof = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(justifications.proofUrl(id), {
        headers: { Authorization: `Bearer ${token}` },
      });
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

  const reasonLabel = (r) => {
    const map = { sick: 'مرض', en_panne: 'عطل في المركبة', other: 'أخرى' };
    return map[r] || r;
  };

  const statusBadge = (s) => {
    if (s === 'approved') return <span className="badge badge-success">مقبول</span>;
    if (s === 'rejected') return <span className="badge badge-danger">مرفوض</span>;
    return <span className="badge badge-warning">قيد المراجعة</span>;
  };

  const isPdf = proofBlob?.type?.includes('pdf');

  if (loading && list.length === 0) return <div className="loading">جاري التحميل...</div>;

  return (
    <div className="fade-slide-in">
      <h2 style={{ marginBottom: '1rem' }}>المبررات</h2>

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

      <div className="nx-filter">
        <div className="form-group">
          <label className="form-label" style={{ fontSize: '0.8rem' }}>تصفية حسب الحالة</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="form-input">
            <option value="">جميع المبررات</option>
            <option value="pending">قيد المراجعة</option>
            <option value="approved">مقبولة</option>
            <option value="rejected">مرفوضة</option>
          </select>
        </div>
      </div>

      {list.length === 0 && !loading && (
        <div className="nx-empty">
          <div className="nx-empty-icon">📋</div>
          <h3>لا توجد مبررات</h3>
          <p>لم يتم تقديم أي مبررات بعد</p>
        </div>
      )}

      <div className="table-responsive fade-slide-in" style={{ animationDelay: '0.1s' }}>
        <table className="table">
          <thead>
            <tr>
              <th>السائق</th>
              <th>التاريخ</th>
              <th>السبب</th>
              <th>ملاحظة</th>
              <th>الملف</th>
              <th>الحالة</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {list.map((j, idx) => (
              <tr key={j.id} className="nx-table-row" style={{ animationDelay: `${0.15 + idx * 0.04}s` }}>
                <td>
                  <div style={{ fontWeight: 600 }}>{j.driver_name}</div>
                  <small style={{ color: 'var(--nx-text-muted)', fontSize: '0.75rem' }}>{j.phone}</small>
                </td>
                <td>{j.attendance_date}</td>
                <td>
                  {reasonLabel(j.reason)}
                  {j.note && <><br /><small style={{ color: 'var(--nx-text-secondary)', fontSize: '0.75rem' }}>{j.note}</small></>}
                </td>
                <td style={{ color: 'var(--nx-text-secondary)', fontSize: '0.8rem' }}>{j.admin_note || '—'}</td>
                <td>
                  {j.proof_file ? (
                    <button onClick={() => viewProof(j.id)} className="btn btn-ghost btn-sm">
                      عرض الملف
                    </button>
                  ) : '—'}
                </td>
                <td>{statusBadge(j.status)}</td>
                <td>
                  {j.status === 'pending' && (
                    <div className="jaction-group">
                      <button onClick={() => handleApprove(j.id)} disabled={actionLoading === j.id}
                        className="btn btn-sm jaction-approve">
                        {actionLoading === j.id ? '...' : 'قبول'}
                      </button>
                      <button onClick={() => { setShowReject(showReject === j.id ? null : j.id); setRejectNote(''); }}
                        className="btn btn-sm jaction-reject">
                        رفض
                      </button>
                    </div>
                  )}
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

      {proofUrl && (
        <div className="modal-overlay" onClick={closeProof}>
          <div className="modal" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>الملف المرفق</h3>
              <button className="modal-close" onClick={closeProof}>✕</button>
            </div>
            {isPdf ? (
              <iframe src={proofUrl} style={{ width: '100%', height: 500, border: 'none', borderRadius: 'var(--nx-radius-sm)' }} title="Proof" />
            ) : (
              <img src={proofUrl} alt="proof" style={{ width: '100%', borderRadius: 'var(--nx-radius-sm)' }} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
