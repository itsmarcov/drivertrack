import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const recaptchaReady = useRef(false);
  const siteKey = useRef('');
  const { login, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      const target = user.role === 'driver' ? '/driver' : '/admin';
      navigate(target, { replace: true });
    }
  }, [user, navigate]);

  const widgetId = useRef(null);

  useEffect(() => {
    fetch('/api/config/public').then(r => r.json()).then(cfg => {
      const key = cfg.recaptcha_site_key;
      if (!key) { recaptchaReady.current = true; return; }
      siteKey.current = key;
      window.recaptchaCallback = () => {
        widgetId.current = window.grecaptcha.render('recaptcha-widget', { sitekey: key });
        recaptchaReady.current = true;
      };
      const s = document.createElement('script');
      s.src = `https://www.google.com/recaptcha/api.js?onload=recaptchaCallback&render=explicit&hl=ar`;
      s.async = true;
      s.defer = true;
      document.head.appendChild(s);
    }).catch(() => recaptchaReady.current = true);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const token = widgetId.current != null ? window.grecaptcha?.getResponse(widgetId.current) : '';
    if (siteKey.current && (!token || token === '')) {
      setError('يرجى تأكيد أنك لست روبوتاً.');
      return;
    }
    setLoading(true);
    try {
      const data = await login(username, password, token || '');
      const target = data.user.role === 'driver' ? '/driver' : '/admin';
      navigate(target, { replace: true });
    } catch (err) {
      if (widgetId.current != null) window.grecaptcha?.reset(widgetId.current);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo-wrap">
          <img src="/NAVEXlogo.png" alt="NAVEX" className="login-logo-img" />
        </div>
        <h1>DriverTRACK</h1>
        <p className="login-subtitle">نظام تتبع حضور السائقين</p>
        <form onSubmit={handleSubmit}>
          {error && <div className="alert alert-error">✕ {error}</div>}
          <div className="form-group">
            <label>اسم المستخدم / البريد / الهاتف</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="أدخل اسم المستخدم أو البريد أو الهاتف" required dir="auto" />
          </div>
          <div className="form-group">
            <label>كلمة المرور</label>
            <div className="password-input-wrap">
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="أدخل كلمة المرور" required />
              <button type="button" className="password-toggle-btn" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
          </div>
          <div id="recaptcha-widget" style={{ display: siteKey.current ? 'flex' : 'none', justifyContent: 'center', margin: '12px 0' }}></div>
          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
            {loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
          </button>
          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <Link to="/register" style={{ color: 'var(--nx-text-secondary)', fontSize: '0.82rem' }}>ليس لديك حساب؟ تسجيل جديد</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
