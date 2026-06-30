import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { auth } from '../api';

export default function ProfileSettings() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg({ type: '', text: '' });
    if (form.new_password && form.new_password !== form.confirm_password) {
      setMsg({ type: 'error', text: 'كلمة المرور الجديدة وتأكيدها غير متطابقين.' });
      return;
    }
    setSaving(true);
    try {
      const body = { full_name: form.full_name, email: form.email || null, phone: form.phone || null };
      if (form.new_password) {
        body.current_password = form.current_password;
        body.new_password = form.new_password;
      }
      const pwChanged = !!form.new_password;
      await auth.updateProfile(body);
      setForm({ ...form, current_password: '', new_password: '', confirm_password: '' });
      setMsg({ type: 'success', text: 'تم تحديث الملف الشخصي بنجاح.' + (pwChanged ? ' استخدم كلمة المرور الجديدة في المرة القادمة.' : '') });
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
    setSaving(false);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-content">
          <h2>الملف الشخصي</h2>
          <p>تعديل معلومات حسابك</p>
        </div>
      </div>

      {msg.text && (
        <div className={`alert alert-${msg.type}`} onClick={() => setMsg({ type: '', text: '' })}>
          {msg.text}
        </div>
      )}

      <div className="card" style={{ padding: '1.5rem', maxWidth: 500 }}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>اسم المستخدم</label>
            <input value={user?.username || ''} disabled style={{ opacity: 0.6 }} />
          </div>
          <div className="form-group">
            <label>الاسم الكامل</label>
            <input name="full_name" value={form.full_name} onChange={handleChange} required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>البريد الإلكتروني</label>
              <input name="email" type="email" value={form.email} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>رقم الهاتف</label>
              <input name="phone" value={form.phone} onChange={handleChange} />
            </div>
          </div>

          <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--nx-border)' }}>
            <h4 style={{ marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--nx-text-secondary)' }}>تغيير كلمة المرور</h4>
            <div className="form-group">
              <label>كلمة المرور الحالية</label>
              <input name="current_password" type="password" value={form.current_password} onChange={handleChange} autoComplete="current-password" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>كلمة المرور الجديدة</label>
                <input name="new_password" type="password" value={form.new_password} onChange={handleChange} autoComplete="new-password" />
              </div>
              <div className="form-group">
                <label>تأكيد كلمة المرور</label>
                <input name="confirm_password" type="password" value={form.confirm_password} onChange={handleChange} autoComplete="new-password" />
              </div>
            </div>
          </div>

          <div className="form-actions" style={{ marginTop: '1.5rem' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
