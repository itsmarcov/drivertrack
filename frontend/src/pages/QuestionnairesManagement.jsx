import { useState, useEffect } from 'react';
import LoadingScreen from '../components/LoadingScreen';
import { questionnaires } from '../api';
import { playSuccess, playError } from '../utils/sounds';

function createEmptyQuestion() {
  return { question_text: '', question_type: 'text', options: ['', ''] };
}

export default function QuestionnairesManagement() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', questions: [createEmptyQuestion()] });
  const [detail, setDetail] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      setList(await questionnaires.list());
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setForm({ title: '', description: '', questions: [createEmptyQuestion()] });
    setShowForm(true);
  };

  const updateQuestion = (idx, patch) => {
    setForm((f) => {
      const questions = f.questions.map((q, i) => (i === idx ? { ...q, ...patch } : q));
      return { ...f, questions };
    });
  };

  const updateOption = (qIdx, optIdx, value) => {
    setForm((f) => {
      const questions = f.questions.map((q, i) => {
        if (i !== qIdx) return q;
        const options = q.options.map((o, oi) => (oi === optIdx ? value : o));
        return { ...q, options };
      });
      return { ...f, questions };
    });
  };

  const addQuestion = () => {
    setForm((f) => ({ ...f, questions: [...f.questions, createEmptyQuestion()] }));
  };

  const removeQuestion = (idx) => {
    setForm((f) => ({ ...f, questions: f.questions.filter((_, i) => i !== idx) }));
  };

  const addOption = (qIdx) => {
    setForm((f) => {
      const questions = f.questions.map((q, i) => (i === qIdx ? { ...q, options: [...q.options, ''] } : q));
      return { ...f, questions };
    });
  };

  const removeOption = (qIdx, optIdx) => {
    setForm((f) => {
      const questions = f.questions.map((q, i) => {
        if (i !== qIdx) return q;
        const options = q.options.filter((_, oi) => oi !== optIdx);
        return { ...q, options };
      });
      return { ...f, questions };
    });
  };

  const handleSubmit = async () => {
    setError('');
    const questions = form.questions
      .filter((q) => q.question_text.trim())
      .map((q) => ({
        question_text: q.question_text.trim(),
        question_type: q.question_type,
        options: q.question_type === 'choice' ? q.options.map((o) => o.trim()).filter(Boolean) : undefined,
      }));
    if (!form.title.trim()) { setError('يرجى إدخال عنوان الاستبيان'); return; }
    if (questions.length === 0) { setError('يرجى إضافة سؤال واحد على الأقل'); return; }
    setSaving(true);
    try {
      await questionnaires.create({ title: form.title.trim(), description: form.description.trim() || null, questions });
      playSuccess();
      setShowForm(false);
      load();
    } catch (err) { playError(); setError(err.message); }
    setSaving(false);
  };

  const handleDownloadReport = async (id) => {
    setPdfLoading(id);
    setError('');
    try {
      const blob = await questionnaires.downloadReport(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `questionnaire-${id}-report.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) { setError(err.message); }
    setPdfLoading(null);
  };

  const toggleStatus = async (q) => {
    try {
      await questionnaires.updateStatus(q.id, q.status === 'active' ? 'closed' : 'active');
      playSuccess();
      load();
    } catch (err) { playError(); setError(err.message); }
  };

  const handleDelete = async (q) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الاستبيان وكل الإجابات المرتبطة به؟')) return;
    try {
      await questionnaires.remove(q.id);
      playSuccess();
      load();
    } catch (err) { playError(); setError(err.message); }
  };

  const openDetail = async (q) => {
    try {
      setDetail(await questionnaires.get(q.id));
    } catch (err) { setError(err.message); }
  };

  const typeLabel = (t) => (t === 'choice' ? 'اختيار من متعدد' : t === 'rating' ? 'تقييم' : 'نص');

  if (loading) return <LoadingScreen />;

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-content">
          <h2>الاستبيانات</h2>
          <p>{list.length} استبيان</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={openCreate}>+ استبيان جديد</button>
        </div>
      </div>

      {error && <div className="alert alert-error" onClick={() => setError('')}>{error}</div>}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 620 }}>
            <div className="modal-header">
              <h3>استبيان جديد</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', padding: '16px' }}>
              <div className="form-group">
                <label className="form-label">عنوان الاستبيان *</label>
                <input className="form-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثال: استبيان رضا السائقين" />
              </div>
              <div className="form-group">
                <label className="form-label">الوصف</label>
                <textarea className="form-input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="وصف اختياري..." />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '12px 0 8px' }}>
                <strong style={{ fontSize: 14 }}>الأسئلة</strong>
                <button className="btn btn-sm btn-outline" onClick={addQuestion}>+ إضافة سؤال</button>
              </div>

              {form.questions.map((q, qIdx) => (
                <div key={qIdx} style={{ border: '1px solid var(--nx-border)', borderRadius: 8, padding: 12, marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <strong style={{ fontSize: 13 }}>سؤال {qIdx + 1}</strong>
                    <button className="btn btn-sm btn-danger" onClick={() => removeQuestion(qIdx)}>حذف</button>
                  </div>
                  <div className="form-group">
                    <input className="form-input" value={q.question_text} onChange={(e) => updateQuestion(qIdx, { question_text: e.target.value })} placeholder="نص السؤال..." />
                  </div>
                  <div className="form-group">
                    <select className="form-input" value={q.question_type} onChange={(e) => {
                      const type = e.target.value;
                      updateQuestion(qIdx, type === 'choice' ? { question_type: type, options: q.options.length >= 2 ? q.options : ['', ''] } : { question_type: type, options: [] });
                    }}>
                      <option value="text">إجابة نصية</option>
                      <option value="choice">اختيار من متعدد</option>
                      <option value="rating">تقييم (1-5)</option>
                    </select>
                  </div>
                  {q.question_type === 'choice' && (
                    <div>
                      {q.options.map((opt, optIdx) => (
                        <div key={optIdx} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                          <input className="form-input" value={opt} onChange={(e) => updateOption(qIdx, optIdx, e.target.value)} placeholder={`خيار ${optIdx + 1}`} />
                          <button className="btn btn-sm btn-outline" onClick={() => removeOption(qIdx, optIdx)}>✕</button>
                        </div>
                      ))}
                      <button className="btn btn-sm btn-outline" onClick={() => addOption(qIdx)}>+ خيار</button>
                    </div>
                  )}
                  {q.question_type === 'rating' && <div style={{ fontSize: 12, color: 'var(--nx-text-muted)' }}>سيجيب السائق بتقييم من 1 إلى 5 نجوم</div>}
                </div>
              ))}
            </div>
            <div className="modal-footer" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: 12, borderTop: '1px solid var(--nx-border-light)' }}>
              <button className="btn btn-outline" onClick={() => setShowForm(false)}>إلغاء</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
                {saving ? 'جاري النشر...' : 'نشر الاستبيان'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="table-container">
        {list.length === 0 ? (
          <div className="nx-empty">
            <div className="nx-empty-icon">📝</div>
            <h3>لا توجد استبيانات بعد</h3>
            <p>قم بإنشاء استبيان وإرساله للسائقين</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>العنوان</th>
                <th>الأسئلة</th>
                <th>الإجابات</th>
                <th>الحالة</th>
                <th>تاريخ الإنشاء</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {list.map((q) => (
                <tr key={q.id}>
                  <td>
                    <div>
                      <strong style={{ fontSize: 13 }}>{q.title}</strong>
                      {q.description && <div style={{ fontSize: 11, color: 'var(--nx-text-muted)' }}>{q.description.length > 50 ? q.description.slice(0, 50) + '…' : q.description}</div>}
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}>{q.questions_count}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button className={`btn btn-sm ${q.responses_count > 0 ? 'btn-primary' : 'btn-outline'}`} onClick={() => openDetail(q)} title="عرض الإجابات" style={{ minWidth: 50 }}>
                      {q.responses_count || 0}
                    </button>
                  </td>
                  <td>
                    <span className={`badge ${q.status === 'active' ? 'badge-success' : 'badge'}`}>
                      {q.status === 'active' ? 'نشط' : 'مغلق'}
                    </span>
                  </td>
                  <td className="text-sm text-muted">{new Date(q.created_at).toLocaleDateString('fr-DZ')}</td>
                  <td>
                    <div className="flex gap-2" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                      <button className="btn btn-sm btn-outline" onClick={() => handleDownloadReport(q.id)} disabled={pdfLoading === q.id} title="تقرير PDF">
                        {pdfLoading === q.id ? '...' : 'PDF'}
                      </button>
                      <button className="btn btn-sm btn-outline" onClick={() => toggleStatus(q)} title={q.status === 'active' ? 'إغلاق' : 'تفعيل'}>
                        {q.status === 'active' ? 'إغلاق' : 'تفعيل'}
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(q)}>حذف</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 700 }}>
            <div className="modal-header">
              <h3>إجابات: {detail.title}</h3>
              <button className="modal-close" onClick={() => setDetail(null)}>✕</button>
            </div>
            <div style={{ maxHeight: '70vh', overflowY: 'auto', padding: '16px' }}>
              {detail.responses.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--nx-text-muted)', fontSize: 13 }}>لا توجد إجابات بعد</div>
              ) : (
                detail.questions.map((qq, qIdx) => (
                  <div key={qq.id} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span className="badge badge-danger" style={{ borderRadius: '50%', minWidth: 22, textAlign: 'center' }}>{qIdx + 1}</span>
                      <strong style={{ fontSize: 13 }}>{qq.question_text}</strong>
                    </div>
                    <table className="table" style={{ marginTop: 4 }}>
                      <tbody>
                        {detail.responses.map((r) => {
                          let answer = r.answers[qq.id];
                          if (answer === undefined || answer === null || answer === '') answer = <span style={{ color: '#999' }}>بدون إجابة</span>;
                          else if (qq.question_type === 'rating') {
                            const n = Number(answer);
                            answer = !isNaN(n) ? '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n)) + ` (${n})` : String(answer);
                          }
                          return (
                            <tr key={r.id}>
                              <td style={{ width: '30%', fontSize: 12 }}>
                                <div><strong>{r.driver_name}</strong></div>
                                <div style={{ fontSize: 11, color: 'var(--nx-text-muted)' }}>{r.driver_phone}{r.station_name ? ` · ${r.station_name}` : ''}</div>
                              </td>
                              <td style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{answer}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
