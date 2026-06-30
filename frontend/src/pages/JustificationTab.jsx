import { useState, useEffect, useRef } from 'react';
import { justifications } from '../api';

const reasons = [
  { value: 'sick', label: 'مرض' },
  { value: 'en_panne', label: 'عطل في المركبة' },
  { value: 'other', label: 'أخرى' },
];

export default function JustificationTab() {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [history, setHistory] = useState([]);
  const fileRef = useRef(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    justifications.my()
      .then((h) => { if (mounted.current) setHistory(h); })
      .catch(() => {});
    return () => { mounted.current = false; };
  }, []);

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) { setFile(null); setPreview(null); return; }
    if (f.size > 3 * 1024 * 1024) { setError('حجم الملف يتجاوز 3 ميغابايت'); setFile(null); setPreview(null); return; }
    setError('');
    setFile(f);
    if (f.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result);
      reader.readAsDataURL(f);
    } else {
      setPreview(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason) { setError('الرجاء اختيار سبب'); return; }
    if (reason === 'other' && !note.trim()) { setError('الرجاء كتابة ملاحظة'); return; }
    setSubmitting(true);
    setError('');
    setSuccess('');
    const fd = new FormData();
    fd.append('reason', reason);
    if (note.trim()) fd.append('note', note);
    if (file) fd.append('proof', file);
    try {
      await justifications.submit(fd);
      setSuccess('تم إرسال المبرر بنجاح');
      setReason('');
      setNote('');
      setFile(null);
      setPreview(null);
      if (fileRef.current) fileRef.current.value = '';
      const h = await justifications.my();
      if (mounted.current) setHistory(h);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadge = (s) => {
    if (s === 'approved') return <span className="badge badge-success">مقبول</span>;
    if (s === 'rejected') return <span className="badge badge-danger">مرفوض</span>;
    return <span className="badge badge-warning">قيد المراجعة</span>;
  };

  const reasonLabel = (r) => {
    const found = reasons.find((x) => x.value === r);
    return found ? found.label : r;
  };

  return (
    <div className="fade-slide-in">
      <div className="justify-today-banner">
        <strong>تقديم مبرر لليوم</strong>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="justify-form-card">
        <form onSubmit={handleSubmit} className="justify-form">
          <label className="form-label">السبب</label>
          <div className="reason-chips">
            {reasons.map((r) => (
              <button type="button" key={r.value}
                className={'reason-chip' + (reason === r.value ? ' active' : '')}
                onClick={() => { setReason(r.value); setError(''); }}>
                {r.label}
              </button>
            ))}
          </div>

          {reason === 'other' && (
            <div className="form-group">
              <label className="form-label">ملاحظة</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="اكتب سبب التبرير..." rows={3} className="form-input" />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">إرفاق ملف (صور، PDF، DOC — 3MB حد أقصى)</label>
            <div className={'proof-upload-box' + (file ? ' has-file' : '')} onClick={() => fileRef.current?.click()}>
              {preview ? <img src={preview} alt="preview" className="proof-preview" /> : <span>اضغط لاختيار ملف</span>}
              {file && !preview && <span className="file-name">{file.name}</span>}
            </div>
            <input type="file" ref={fileRef} onChange={handleFile} accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx" hidden />
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={submitting || !reason}>
            {submitting ? 'جاري الإرسال...' : 'إرسال المبرر'}
          </button>
        </form>
      </div>

      {history.length > 0 && (
        <div className="fade-slide-in" style={{ animationDelay: '0.15s' }}>
          <h4 style={{ marginBottom: '0.85rem', fontSize: '0.95rem', color: 'var(--nx-text-secondary)' }}>المبررات السابقة</h4>
          {history.map((j, i) => (
            <div key={j.id} className="justify-history-card" style={{ animationDelay: `${0.2 + i * 0.06}s` }}>
              <div className="justify-history-left">
                <span className="justify-history-date">{j.attendance_date}</span>
                <span className="justify-history-reason">{reasonLabel(j.reason)}</span>
              </div>
              <div>{statusBadge(j.status)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
