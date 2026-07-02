import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth, stations } from '../api';

export default function DriverRegister() {
  const [form, setForm] = useState({ username: '', password: '', full_name: '', email: '', phone: '', vehicle_type: '', license_plate: '', station_id: '' });
  const [stationList, setStationList] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    stations.listPublic().then(setStationList).catch(() => {});
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (form.password.length < 6) { setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل.'); return; }
    setLoading(true);
    try {
      const res = await auth.registerDriver(form);
      setSuccess(res.message);
      setTimeout(() => navigate('/login'), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: 480 }}>
        <h1 style={{ textAlign: 'center', marginBottom: '0.25rem' }}>تسجيل سائق جديد</h1>
        <p className="login-subtitle" style={{ marginBottom: '1.25rem' }}>إنشاء حساب للدخول إلى التطبيق</p>
        <form onSubmit={handleSubmit}>
          {error && <div className="alert alert-error">✕ {error}</div>}
          {success && <div className="alert" style={{ background: '#DCFCE7', color: '#166534', border: '1px solid #86EFAC', borderRadius: 'var(--nx-radius)', padding: '0.75rem', marginBottom: '1rem', textAlign: 'center', fontWeight: 500 }}>✓ {success}</div>}
          <div className="form-group">
            <label>اسم المستخدم *</label>
            <input name="username" value={form.username} onChange={handleChange} placeholder="اسم المستخدم" required dir="auto" />
          </div>
          <div className="form-group">
            <label>كلمة المرور *</label>
            <input type="password" name="password" value={form.password} onChange={handleChange} placeholder="6 أحرف على الأقل" required minLength={6} />
          </div>
          <div className="form-group">
            <label>الاسم الكامل *</label>
            <input name="full_name" value={form.full_name} onChange={handleChange} placeholder="الاسم واللقب" required dir="auto" />
          </div>
          <div className="form-group">
            <label>البريد الإلكتروني</label>
            <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="example@mail.com" dir="auto" />
          </div>
          <div className="form-group">
            <label>رقم الهاتف</label>
            <input name="phone" value={form.phone} onChange={handleChange} placeholder="05XX XX XX XX" dir="auto" />
          </div>
          <div className="form-group">
            <label>المحطة *</label>
            <select name="station_id" value={form.station_id} onChange={handleChange} required>
              <option value="">اختر المحطة</option>
              {stationList.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>نوع المركبة</label>
            <input name="vehicle_type" value={form.vehicle_type} onChange={handleChange} placeholder="سيارة / شاحنة..." dir="auto" />
          </div>
          <div className="form-group">
            <label>رقم اللوحة</label>
            <input name="license_plate" value={form.license_plate} onChange={handleChange} placeholder="لوحة المركبة" dir="auto" />
          </div>
          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading || !!success}>
            {loading ? 'جاري التسجيل...' : 'تسجيل'}
          </button>
          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <Link to="/login" style={{ color: 'var(--nx-red)', fontSize: '0.85rem' }}>لديك حساب؟ سجل الدخول</Link>
          </div>
        </form>
      </div>
    </div>
  );
}