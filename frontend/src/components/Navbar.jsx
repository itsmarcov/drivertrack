import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const location = useLocation();

  if (!user) return null;
  if (user.role === 'driver') return null;

  const isActive = (path) => {
    if (path === '/admin') return location.pathname === '/admin' ? 'active' : '';
    return location.pathname === path || location.pathname.startsWith(path + '/') ? 'active' : '';
  };

  const handleLogout = () => { logout(); };

  return (
    <nav className="navbar">
      <div className="nav-inner">
        <Link to="/login" className="nav-brand">
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
          <Link to="/admin/absences" className={`nav-link ${isActive('/admin/absences')}`}>الغيابات</Link>
          <Link to="/admin/analytics" className={`nav-link ${isActive('/admin/analytics')}`}>التحليلات</Link>
          {user.role === 'admin' && (
            <>
              <Link to="/admin/settings" className={`nav-link ${isActive('/admin/settings')}`}>الإعدادات</Link>
              <Link to="/admin/ops" className={`nav-link ${isActive('/admin/ops')}`}>المشغلين</Link>
              <Link to="/admin/stations" className={`nav-link ${isActive('/admin/stations')}`}>المحطات</Link>
            </>
          )}
          <button onClick={handleLogout} className="nav-link nav-logout-mobile" title="خروج">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            <span className="nav-logout-label">خروج</span>
          </button>
        </div>

        <div className="nav-actions">
          <div className="nav-user">
            <span className={`nav-user-role role-${user.role}`}>{user.role === 'admin' ? 'مدير' : 'عمليات'}</span>
            <span className="nav-user-name">{user.full_name}</span>
            <button onClick={handleLogout} className="nav-user-logout" title="خروج">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
          </div>
          <button onClick={toggle} className="theme-toggle" title={dark ? 'الوضع النهاري' : 'الوضع الليلي'}>
            <svg className="theme-sun" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            <svg className="theme-moon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          </button>
        </div>
      </div>
    </nav>
  );
}
