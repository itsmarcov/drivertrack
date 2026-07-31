import { useState, useEffect } from 'react';
import LoadingScreen from '../components/LoadingScreen';
import { questionnaires, drivers as driversApi, stations as stationsApi } from '../api';
import { playSuccess, playError } from '../utils/sounds';

function createEmptyQuestion() {
  return { question_text: '', question_type: 'text', options: ['', ''] };
}

export default function QuestionnairesManagement() {
  const [list, setList] = useState([]);
  const [driversList, setDriversList] = useState([]);
  const [stationList, setStationList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', questions: [createEmptyQuestion()], audience_type: 'all', station_ids: [], driver_ids: [], driver_search: '' });
  const [detail, setDetail] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const [q, d, s] = await Promise.all([questionnaires.list(), driversApi.list(), stationsApi.list()]);
      setList(q);
      setDriversList(d);
      setStationList(s);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setForm({ title: '', description: '', questions: [createEmptyQuestion()], audience_type: 'all', station_ids: [], driver_ids: [], driver_search: '' });
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

  const filteredFormDrivers = driversList.filter((d) => {
    if (!form.driver_search) return true;
    const q = form.driver_search.toLowerCase();
    return d.full_name?.toLowerCase().includes(q) || d.phone?.includes(q) || d.license_plate?.toLowerCase().includes(q);
  });

  const toggleDriverSel = (id) => {
    setForm((f) => ({
      ...f,
      driver_ids: f.driver_ids.includes(id) ? f.driver_ids.filter((x) => x !== id) : [...f.driver_ids, id],
    }));
  };

  const toggleStationSel = (id) => {
    setForm((f) => ({
      ...f,
      station_ids: f.station_ids.includes(id) ? f.station_ids.filter((x) => x !== id) : [...f.station_ids, id],
    }));
  };

  const audienceLabel = (q) => {
    if (q.audience_type === 'drivers') return `سائقين محددين (${q.driver_ids ? q.driver_ids.split(',').length : 0})`;
    if (q.audience_type === 'stations') return `محطات محددة (${q.station_ids ? q.station_ids.split(',').length : 0})`;
    return 'جميع السائقين';
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
    if (form.audience_type === 'drivers' && form.driver_ids.length === 0) { setError('يرجى اختيار سائق واحد على الأقل'); return; }
    if (form.audience_type === 'stations' && form.station_ids.length === 0) { setError('يرجى اختيار محطة واحدة على الأقل'); return; }
    setSaving(true);
    try {
      await questionnaires.create({
        title: form.title.trim(),
        description: form.description.trim() || null,
        questions,
        audience_type: form.audience_type,
        station_ids: form.audience_type === 'stations' ? form.station_ids : undefined,
        driver_ids: form.audience_type === 'drivers' ? form.driver_ids : undefined,
      });
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

              <div className="form-group">
                <label className="form-label">الجمهور المستهدف</label>
                <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                  {[
                    { v: 'all', label: 'جميع السائقين' },
                    { v: 'stations', label: 'محطات محددة' },
                    { v: 'drivers', label: 'سائقين محددين' },
                  ].map((o) => (
                    <label key={o.v} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                      <input type="radio" name="audience" checked={form.audience_type === o.v} onChange={() => setForm({ ...form, audience_type: o.v, station_ids: [], driver_ids: [] })} />
                      {o.label}
                    </label>
                  ))}
                </div>

                {form.audience_type === 'stations' && (
                  <div style={{ border: '1px solid var(--nx-border)', borderRadius: 8, padding: 10 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {stationList.map((s) => {
                        const checked = form.station_ids.includes(s.id);
                        return (
                          <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer', padding: '4px 8px', border: '1px solid var(--nx-border)', borderRadius: 6, background: checked ? 'var(--nx-bg-glass)' : 'transparent' }}>
                            <input type="checkbox" checked={checked} onChange={() => toggleStationSel(s.id)} />
                            {s.name}
                          </label>
                        );
                      })}
                      {stationList.length === 0 && <span style={{ fontSize: 12, color: 'var(--nx-text-muted)' }}>لا توجد محطات</span>}
                    </div>
                  </div>
                )}

                {form.audience_type === 'drivers' && (
                  <div>
                    <input className="form-input" style={{ marginBottom: 8 }} value={form.driver_search} onChange={(e) => setForm({ ...form, driver_search: e.target.value })} placeholder="بحث عن سائق بالاسم أو الهاتف..." />
                    <div style={{ border: '1px solid var(--nx-border)', borderRadius: 8, overflow: 'hidden', maxHeight: 200, overflowY: 'auto' }}>
                      {filteredFormDrivers.length === 0 ? (
                        <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--nx-text-muted)' }}>لا يوجد سائقين</div>
                      ) : (
                        filteredFormDrivers.map((d) => {
                          const checked = form.driver_ids.includes(d.id);
                          return (
                            <div key={d.id} onClick={() => toggleDriverSel(d.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 10px', borderBottom: '1px solid var(--nx-border-light)', cursor: 'pointer', background: checked ? 'var(--nx-bg-glass)' : 'transparent' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                <input type="checkbox" readOnly checked={checked} />
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.full_name}</div>
                                  <div style={{ fontSize: 11, color: 'var(--nx-text-muted)' }}>{d.phone}{d.station_name ? ` · ${d.station_name}` : ''}</div>
                                </div>
                              </div>
                              {checked && <span style={{ color: '#E53935', fontWeight: 700 }}>✓</span>}
                            </div>
                          );
                        })
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--nx-text-muted)', marginTop: 6 }}>تم اختيار {form.driver_ids.length} سائق</div>
                  </div>
                )}
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
                <th>الجمهور</th>
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
                  <td>
                    <span className="badge" style={{ fontSize: 11 }}>
                      {audienceLabel(q)}
                    </span>
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
