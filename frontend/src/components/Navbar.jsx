import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  if (!user) return null;
  if (user.role === 'driver') return null;

  const isActive = (path) => {
    if (path === '/admin') return location.pathname === '/admin' ? 'active' : '';
    return location.pathname === path || location.pathname.startsWith(path + '/') ? 'active' : '';
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <nav className="navbar">
      <div className="nav-inner">
        <Link to="/admin" className="nav-brand">
          <img src="/NAVEXlogo.png" alt="NAVEX" className="nav-brand-logo" />
          <span className="nav-brand-text">Driver<span className="nav-brand-dot">TRACK</span></span>
        </Link>
        <div className="nav-links">
          <Link to="/admin" className={`nav-link ${isActive('/admin')}`}>لوحة التحكم</Link>
          <Link to="/admin/drivers" className={`nav-link ${isActive('/admin/drivers')}`}>السائقين</Link>
          <Link to="/admin/attendance" className={`nav-link ${isActive('/admin/attendance')}`}>سجلات الحضور</Link>
          <Link to="/admin/scan" className={`nav-link ${isActive('/admin/scan')}`}>
            <span className="nav-scan-badge">مسح QR</span>
          </Link>
          <Link to="/admin/penalties" className={`nav-link ${isActive('/admin/penalties')}`}>الغرامات</Link>
          {user.role === 'admin' && (
            <Link to="/admin/ops" className={`nav-link ${isActive('/admin/ops')}`}>المشغلين</Link>
          )}
          {user.role === 'admin' && (
            <Link to="/admin/stations" className={`nav-link ${isActive('/admin/stations')}`}>المحطات</Link>
          )}
        </div>
        <div className="nav-user">
          <div className="nav-user-info">
            <div className="nav-user-name">{user.full_name}</div>
            <span className={`nav-user-role role-${user.role}`}>
              {user.role === 'admin' ? 'مدير' : 'عمليات'}
            </span>
          </div>
          <button onClick={handleLogout} className="btn btn-ghost btn-sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            خروج
          </button>
        </div>
      </div>
    </nav>
  );
}
