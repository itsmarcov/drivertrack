import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;
  if (user.role === 'driver') return null;

  return (
    <nav className="navbar">
      <div className="nav-inner">
        <Link to="/admin" className="nav-brand">DriverTRACK</Link>
        <div className="nav-links">
          <Link to="/admin" className="nav-link">لوحة التحكم</Link>
          <Link to="/admin/drivers" className="nav-link">السائقين</Link>
          <Link to="/admin/attendance" className="nav-link">سجلات الحضور</Link>
          <Link to="/admin/scan" className="nav-link nav-link-highlight">📋 مسح QR</Link>
          {user.role === 'admin' && (
            <Link to="/admin/ops" className="nav-link">المشغلين</Link>
          )}
        </div>
        <div className="nav-user">
          <span className="nav-user-name">{user.full_name}</span>
          <span className={`nav-user-role role-${user.role}`}>
            {user.role === 'admin' ? 'مدير' : 'عمليات'}
          </span>
          <button onClick={handleLogout} className="btn btn-sm btn-danger">تسجيل خروج</button>
        </div>
      </div>
    </nav>
  );
}
