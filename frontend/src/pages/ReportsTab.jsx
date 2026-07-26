import { useState, useEffect } from 'react';
import { driverReports } from '../api';
import { playSuccess, playError } from '../utils/sounds';

const CATEGORIES = [
  { value: 'work_conditions', label: 'ظروف العمل' },
  { value: 'vehicle', label: 'المركبة' },
  { value: 'safety', label: 'السلامة' },
  { value: 'communication', label: 'التواصل' },
  { value: 'station', label: 'المحطة' },
  { value: 'schedule', label: 'الجدول الزمني' },
  { value: 'other', label: 'أخرى' },
];

const statusConfig = {
  pending: { label: 'قيد المراجعة', cls: 'badge badge-warning' },
  reviewed: { label: 'تمت المراجعة', cls: 'badge badge-info' },
  resolved: { label: 'تم الحل', cls: 'badge badge-success' },
};

export default function ReportsTab() {
  const [view, setView] = useState('landing');
  const [reportType, setReportType] = useState('');
  const [category, setCategory] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    driverReports.my().then(setHistory).catch(() => {}).finally(() => setLoadingHistory(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reportType) { setError('يرجى اختيار النوع'); return; }
    if (!category) { setError('يرجى اختيار التصنيف'); return; }
    if (!message.trim()) { setError('يرجى كتابة الرسالة'); return; }
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await driverReports.create({ report_type: reportType, category, message });
      playSuccess();
      setSuccess('تم إرسال تقريرك بنجاح! شكراً لملاحظتك.');
      setReportType('');
      setCategory('');
      setMessage('');
      const h = await driverReports.my();
      setHistory(h);
    } catch (err) {
      playError();
      setError(err.message);
    }
    setSubmitting(false);
  };

  const categoryLabel = (v) => CATEGORIES.find((c) => c.value === v)?.label || v;

  if (view === 'landing') {
    return (
      <div className="rp-landing">
        <div className="rp-landing-card">
          <div className="rp-landing-icon">💬</div>
          <h2 className="rp-landing-title">تبليغ عن مشكلة أو اقتراح</h2>
          <p className="rp-landing-text">
            لأنك جزء من نجاحنا، رأيك يساعدنا على التطور. أبلغنا بأي مشكلة تواجهك.
          </p>
          <div className="rp-type-grid">
            <button className="rp-type-card rp-type-problem" onClick={() => { setReportType('problem'); setView('form'); }}>
              <div className="rp-type-icon">⚠️</div>
              <div className="rp-type-label">مشكلة</div>
              <div className="rp-type-desc">أبلغ عن مشكلة تواجهك في العمل</div>
            </button>
            <button className="rp-type-card rp-type-suggestion" onClick={() => { setReportType('suggestion'); setView('form'); }}>
              <div className="rp-type-icon">💡</div>
              <div className="rp-type-label">اقتراح</div>
              <div className="rp-type-desc">شاركنا اقتراحك لتحسين العمل</div>
            </button>
          </div>
        </div>

        {history.length > 0 && (
          <div className="rp-history-section">
            <h3 className="rp-history-title">تقريراتي السابقة ({history.length})</h3>
            {history.map((r) => (
              <div key={r.id} className="rp-history-card">
                <div className="rp-history-top">
                  <span className={`rp-type-badge ${r.report_type === 'problem' ? 'rp-problem' : 'rp-suggestion'}`}>
                    {r.report_type === 'problem' ? '⚠️ مشكلة' : '💡 اقتراح'}
                  </span>
                  <span className={statusConfig[r.status]?.cls}>{statusConfig[r.status]?.label}</span>
                </div>
                <div className="rp-history-category">{categoryLabel(r.category)}</div>
                <div className="rp-history-message">{r.message}</div>
                {r.admin_reply && (
                  <div className="rp-history-reply">
                    <strong>رد المدير:</strong> {r.admin_reply}
                  </div>
                )}
                <div className="rp-history-date">
                  {new Date(r.created_at).toLocaleDateString('fr-DZ', { year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rp-form-view">
      <button className="rp-back-btn" onClick={() => { setView('landing'); setError(''); setSuccess(''); }}>
        ← العودة
      </button>

      <div className="rp-form-header">
        <span className={`rp-type-badge ${reportType === 'problem' ? 'rp-problem' : 'rp-suggestion'}`}>
          {reportType === 'problem' ? '⚠️ مشكلة' : '💡 اقتراح'}
        </span>
        <h3>أرسل {reportType === 'problem' ? 'مشكلتك' : 'اقتراحك'}</h3>
      </div>

      {error && <div className="alert alert-error" onClick={() => setError('')}>{error}</div>}
      {success && <div className="alert alert-success" onClick={() => { setSuccess(''); setView('landing'); }}>{success}</div>}

      <form onSubmit={handleSubmit} className="rp-form">
        <div className="form-group">
          <label className="form-label">التصنيف *</label>
          <select className="form-input" value={category} onChange={(e) => setCategory(e.target.value)} required>
            <option value="">-- اختر التصنيف --</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">الرسالة *</label>
          <textarea
            className="form-input"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            placeholder={reportType === 'problem' ? 'صف المشكلة التي تواجهها بالتفصيل...' : 'اكتب اقتراحك/how تتوقع تحسين العمل...'}
            required
          />
        </div>

        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'جاري الإرسال...' : 'إرسال التقرير'}
        </button>
      </form>
    </div>
  );
}