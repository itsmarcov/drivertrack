import { useState, useEffect, useRef } from 'react';
import { justifications } from '../api';

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

  const viewProof = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(justifications.proofUrl(id), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('فشل تحميل الملف');
      const blob = await res.blob();
      setProofUrl(URL.createObjectURL(blob));
    } catch (e) { setError(e.message); }
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

  if (loading && list.length === 0) return <div className="loading">جاري التحميل...</div>;

  return (
    <div>
      <h2 style={{ marginBottom: '1rem' }}>المبررات</h2>

      {error && <div className="alert alert-error">{error}</div>}

      {stats && (
        <div className="stats-row" style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div className="stat-card" style={{ background: '#fff3e0', flex: 1, minWidth: 120, padding: '0.75rem', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#e65100' }}>{stats.pendingCount}</div>
            <div style={{ fontSize: '0.8rem', color: '#666' }}>قيد المراجعة</div>
          </div>
          <div className="stat-card" style={{ background: '#e8f5e9', flex: 1, minWidth: 120, padding: '0.75rem', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#2e7d32' }}>{stats.approvedCount}</div>
            <div style={{ fontSize: '0.8rem', color: '#666' }}>مقبول</div>
          </div>
          <div className="stat-card" style={{ background: '#fbe9e7', flex: 1, minWidth: 120, padding: '0.75rem', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#c62828' }}>{stats.rejectedCount}</div>
            <div style={{ fontSize: '0.8rem', color: '#666' }}>مرفوض</div>
          </div>
          <div className="stat-card" style={{ background: '#e3f2fd', flex: 1, minWidth: 120, padding: '0.75rem', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1565c0' }}>{stats.totalCount}</div>
            <div style={{ fontSize: '0.8rem', color: '#666' }}>المجموع</div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: '1rem' }}>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="form-input" style={{ width: 200 }}>
          <option value="">جميع المبررات</option>
          <option value="pending">قيد المراجعة</option>
          <option value="approved">مقبولة</option>
          <option value="rejected">مرفوضة</option>
        </select>
      </div>

      {list.length === 0 && !loading && <p>لا توجد مبررات</p>}

      <div className="table-responsive">
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
            {list.map((j) => (
              <tr key={j.id}>
                <td>{j.driver_name}<br /><small style={{ color: '#999' }}>{j.phone}</small></td>
                <td>{j.attendance_date}</td>
                <td>{reasonLabel(j.reason)}{j.note && <br />}<small>{j.note}</small></td>
                <td>{j.admin_note || '—'}</td>
                <td>
                  {j.proof_file ? (
                    <button onClick={() => viewProof(j.id)} className="btn btn-sm" style={{ background: 'none', border: 'none', color: '#E53935', cursor: 'pointer', textDecoration: 'underline' }}>
                      عرض الملف
                    </button>
                  ) : '—'}
                </td>
                <td>{statusBadge(j.status)}</td>
                <td>
                  {j.status === 'pending' && (
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button onClick={() => handleApprove(j.id)} disabled={actionLoading === j.id}
                        className="btn btn-sm" style={{ background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 4, padding: '0.25rem 0.5rem', cursor: 'pointer' }}>
                        {actionLoading === j.id ? '...' : 'قبول'}
                      </button>
                      <button onClick={() => { setShowReject(showReject === j.id ? null : j.id); setRejectNote(''); }}
                        className="btn btn-sm" style={{ background: '#c62828', color: '#fff', border: 'none', borderRadius: 4, padding: '0.25rem 0.5rem', cursor: 'pointer' }}>
                        رفض
                      </button>
                    </div>
                  )}
                  {showReject === j.id && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <textarea value={rejectNote} onChange={(e) => setRejectNote(e.target.value)}
                        placeholder="سبب الرفض..." rows={2} className="form-input" style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }} />
                      <button onClick={() => handleReject(j.id)} disabled={actionLoading === j.id}
                        className="btn btn-sm" style={{ background: '#c62828', color: '#fff', border: 'none', borderRadius: 4, padding: '0.25rem 0.5rem', cursor: 'pointer' }}>
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
        <div className="modal-overlay" onClick={() => { setProofUrl(null); URL.revokeObjectURL(proofUrl); }}>
          <div className="modal-content" style={{ maxWidth: 600, maxHeight: '80vh', overflow: 'auto', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => { setProofUrl(null); URL.revokeObjectURL(proofUrl); }}
              style={{ position: 'absolute', top: 8, right: 12, background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#333', zIndex: 10 }}>✕</button>
            {proofUrl.endsWith('.pdf') ? (
              <iframe src={proofUrl} style={{ width: '100%', height: 500, border: 'none' }} title="Proof" />
            ) : (
              <img src={proofUrl} alt="proof" style={{ width: '100%' }} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
