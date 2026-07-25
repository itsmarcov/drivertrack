import { useState, useEffect } from 'react';
import LoadingScreen from '../components/LoadingScreen';
import { driverReports } from '../api';
import { playSuccess, playError } from '../utils/sounds';

const CATEGORIES = {
  work_conditions: 'ظروف العمل',
  vehicle: 'المركبة',
  safety: 'السلامة',
  communication: 'التواصل',
  station: 'المحطة',
  schedule: 'الجدول الزمني',
  pay: 'الأجور',
  other: 'أخرى',
};

const statusConfig = {
  pending: { label: 'قيد المراجعة', cls: 'badge badge-warning' },
  reviewed: { label: 'تمت المراجعة', cls: 'badge badge-info' },
  resolved: { label: 'تم الحل', cls: 'badge badge-success' },
};

export default function ReportsManagement() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [replyModal, setReplyModal] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replyStatus, setReplyStatus] = useState('reviewed');

  const load = async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const data = await driverReports.list(params);
      setList(data);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [statusFilter]);

  const handleReply = async () => {
    try {
      await driverReports.update(replyModal.id, { status: replyStatus, admin_reply: replyText || null });
      playSuccess();
      setReplyModal(null);
      setReplyText('');
      load();
    } catch (err) { playError(); setError(err.message); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا التقرير؟')) return;
    try {
      await driverReports.delete(id);
      playSuccess();
      load();
    } catch (err) { playError(); setError(err.message); }
  };

  if (loading) return <LoadingScreen />;

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-content">
          <h2>تبليغات السائقين</h2>
          <p>{list.length} تقرير</p>
        </div>
      </div>

      {error && <div className="alert alert-error" onClick={() => setError('')}>{error}</div>}

      <div className="nx-filter" style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <div className="form-group" style={{ minWidth: 180 }}>
          <label className="form-label" style={{ fontSize: '0.8rem' }}>تصفية حسب الحالة</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="form-input">
            <option value="">جميع الحالات</option>
            <option value="pending">قيد المراجعة</option>
            <option value="reviewed">تمت المراجعة</option>
            <option value="resolved">تم الحل</option>
          </select>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="nx-empty">
          <div className="nx-empty-icon">💬</div>
          <h3>لا توجد تبليغات</h3>
          <p>{statusFilter ? 'لا توجد تبليغات بهذا الحالة' : 'لم يقم أي سائق بإرسال تبليغ بعد'}</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>السائق</th>
                <th>النوع</th>
                <th>التصنيف</th>
                <th>الرسالة</th>
                <th>الحالة</th>
                <th>التاريخ</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.driver_name}</div>
                    <small style={{ color: 'var(--nx-text-muted)', fontSize: '0.75rem' }}>@{r.driver_username}</small>
                  </td>
                  <td>
                    <span className={`rp-type-badge ${r.report_type === 'problem' ? 'rp-problem' : 'rp-suggestion'}`}>
                      {r.report_type === 'problem' ? 'مشكلة' : 'اقتراح'}
                    </span>
                  </td>
                  <td style={{ fontSize: 13 }}>{CATEGORIES[r.category] || r.category}</td>
                  <td style={{ maxWidth: 250 }}>
                    <div style={{ fontSize: 13, lineHeight: 1.5 }}>{r.message.length > 80 ? r.message.slice(0, 80) + '…' : r.message}</div>
                    {r.admin_reply && (
                      <div style={{ marginTop: 4, padding: '6px 8px', background: 'var(--nx-bg-glass)', borderRadius: 6, fontSize: 12, color: 'var(--nx-text-secondary)' }}>
                        <strong>رد:</strong> {r.admin_reply.length > 60 ? r.admin_reply.slice(0, 60) + '…' : r.admin_reply}
                      </div>
                    )}
                  </td>
                  <td><span className={statusConfig[r.status]?.cls}>{statusConfig[r.status]?.label}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--nx-text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(r.created_at).toLocaleDateString('fr-DZ')}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-sm btn-primary" onClick={() => { setReplyModal(r); setReplyText(r.admin_reply || ''); setReplyStatus(r.status); }}>
                        رد
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(r.id)}>حذف</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {replyModal && (
        <div className="modal-overlay" onClick={() => setReplyModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3>الرد على التقرير</h3>
              <button className="modal-close" onClick={() => setReplyModal(null)}>✕</button>
            </div>
            <div style={{ padding: '0 16px' }}>
              <div style={{ marginBottom: 12, padding: 10, background: 'var(--nx-bg-glass)', borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--nx-text-muted)', marginBottom: 4 }}>
                  {replyModal.driver_name} · {CATEGORIES[replyModal.category]}
                </div>
                <div style={{ fontSize: 13 }}>{replyModal.message}</div>
              </div>

              <div className="form-group">
                <label className="form-label">الحالة</label>
                <select className="form-input" value={replyStatus} onChange={(e) => setReplyStatus(e.target.value)}>
                  <option value="pending">قيد المراجعة</option>
                  <option value="reviewed">تمت المراجعة</option>
                  <option value="resolved">تم الحل</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">الرد (اختياري)</label>
                <textarea className="form-input" value={replyText} onChange={(e) => setReplyText(e.target.value)}
                  rows={3} placeholder="اكتب ردك على السائق..." />
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingBottom: 16 }}>
                <button className="btn btn-primary" onClick={handleReply}>حفظ</button>
                <button className="btn btn-outline" onClick={() => setReplyModal(null)}>إلغاء</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}