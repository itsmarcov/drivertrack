import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      const target = user.role === 'driver' ? '/driver' : '/admin';
      navigate(target, { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(username, password);
      const target = data.user.role === 'driver' ? '/driver' : '/admin';
      navigate(target, { replace: true });
    } catch (err) {
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
            <label>اسم المستخدم</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="أدخل اسم المستخدم" required dir="auto" />
          </div>
          <div className="form-group">
            <label>كلمة المرور</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="أدخل كلمة المرور" required />
          </div>
          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
            {loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
          </button>
        </form>
        <div className="login-divider">بيانات تجريبية</div>
        <div className="login-hint">
          <p>حسابات الاختبار:</p>
          <div className="login-hint-item">
            <span className="login-hint-dot admin"></span>
            <span>admin / Admin@123</span>
          </div>
          <div className="login-hint-item">
            <span className="login-hint-dot ops"></span>
            <span>ops1 / Ops@123</span>
          </div>
          <div className="login-hint-item">
            <span className="login-hint-dot driver"></span>
            <span>driver1 / Driver@123</span>
          </div>
        </div>
      </div>
    </div>
  );
}
