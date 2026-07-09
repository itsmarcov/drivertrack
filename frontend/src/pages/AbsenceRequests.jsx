import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { absenceRequests } from '../api';

const reasonOptions = [
  'مرض',
  'ظرف عائلي',
  'عطلة',
  'أسباب شخصية',
  'أخرى',
];

const statusBadge = {
  pending: 'badge badge-warning',
  approved: 'badge badge-success',
  rejected: 'badge badge-danger',
};

const statusLabel = {
  pending: 'قيد الانتظار',
  approved: 'مقبول',
  rejected: 'مرفوض',
};

export default function AbsenceRequests({ compact }) {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ date_from: '', date_to: '', reason: '', note: '' });

  const fetchRequests = async () => {
    try {
      const data = await absenceRequests.my();
      setRequests(data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchRequests(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!form.date_from || !form.date_to || !form.reason) {
      setError('يرجى ملء جميع الحقول المطلوبة');
      return;
    }
    setSubmitting(true);
    try {
      await absenceRequests.create(form);
      setSuccess('تم تقديم الطلب بنجاح');
      setForm({ date_from: '', date_to: '', reason: '', note: '' });
      fetchRequests();
    } catch (err) {
      setError(err.message);
    }
    setSubmitting(false);
  };

  const handleCancel = async (id) => {
    if (!confirm('هل أنت متأكد من حذف هذا الطلب؟')) return;
    try {
      await absenceRequests.cancel(id);
      fetchRequests();
    } catch {}
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className={compact ? 'ar-tab' : 'page-container'}>
      {!compact && <div className="page-header"><h2>طلبات الغياب</h2></div>}

      <div className="ar-grid">
        <div className={compact ? 'ar-form-card' : 'card ar-form-card'}>
          <h3 className="ar-form-title">تقديم طلب غياب</h3>

          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <form onSubmit={handleSubmit} className="ar-form">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">من تاريخ *</label>
                <input type="date" className="form-input" value={form.date_from} min={today}
                  onChange={e => setForm(f => ({ ...f, date_from: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">إلى تاريخ *</label>
                <input type="date" className="form-input" value={form.date_to} min={form.date_from || today}
                  onChange={e => setForm(f => ({ ...f, date_to: e.target.value }))} required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">السبب *</label>
              <select className="form-input" value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} required>
                <option value="">-- اختر السبب --</option>
                {reasonOptions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">ملاحظة (اختياري)</label>
              <textarea className="form-input ar-textarea" value={form.note} rows={3} placeholder="ملاحظة إضافية..."
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
              {submitting ? 'جاري الإرسال...' : 'تقديم الطلب'}
            </button>
          </form>
        </div>

        <div className="card ar-list-card">
          <h3 className="ar-list-title">طلباتي السابقة</h3>
          {loading ? (
            <div className="ar-loading">جاري التحميل...</div>
          ) : requests.length === 0 ? (
            <div className="ar-empty">لا توجد طلبات غياب سابقة</div>
          ) : (
            <div className="ar-list">
              {requests.map(r => (
                <div key={r.id} className="ar-item">
                  <div className="ar-item-top">
                    <span className={statusBadge[r.status] || 'badge'}>{statusLabel[r.status]}</span>
                    <span className="ar-item-dates">{r.date_from} → {r.date_to}</span>
                  </div>
                  <div className="ar-item-reason">{r.reason}</div>
                  {r.note && <div className="ar-item-note">{r.note}</div>}
                  <div className="ar-item-meta">
                    <span>تقديم: {new Date(r.created_at).toLocaleDateString('fr-DZ')}</span>
                    {r.reviewer_name && <span>مراجعة: {r.reviewer_name}</span>}
                    {r.admin_note && <span>ملاحظة: {r.admin_note}</span>}
                  </div>
                  {r.status === 'pending' && (
                    <button className="ar-cancel-btn" onClick={() => handleCancel(r.id)}>حذف</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
