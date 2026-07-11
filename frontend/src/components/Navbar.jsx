import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { notifications as notifApi } from '../api';
import { useState, useEffect, useRef } from 'react';

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
}

function NavDropdown({ label, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const handle = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('click', handle);
    return () => document.removeEventListener('click', handle);
  }, [open]);
  return (
    <div ref={ref} className={`nav-dropdown ${open ? 'open' : ''}`}>
      <button className="nav-dropdown-toggle" onClick={() => setOpen(!open)}>
        <span>{label}</span>
        <svg className="nav-dropdown-arrow" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && (
        <div className="nav-dropdown-menu" onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const location = useLocation();
  const [hidden, setHidden] = useState(false);
  const [lastY, setLastY] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifData, setNotifData] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const notifRef = useRef(null);
  const profileRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      if (y > lastY && y > 80) setHidden(true);
      else if (y < 10) setHidden(false);
      setLastY(y);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastY]);

  useEffect(() => {
    if (!user || user.role === 'driver') return;
    const fetch = () => { notifApi.getAll().then(setNotifData).catch(() => {}); };
    fetch();
    const iv = setInterval(fetch, 30000);
    return () => clearInterval(iv);
  }, [user]);

  useEffect(() => {
    const handleClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
      if (menuRef.current && !menuRef.current.contains(e.target) && !e.target.closest('.nav-hamburger')) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!user) return null;
  if (user.role === 'driver') return null;

  const isActive = (path) => {
    if (path === '/admin') return location.pathname === '/admin' ? 'active' : '';
    return location.pathname === path || location.pathname.startsWith(path + '/') ? 'active' : '';
  };

  const [dismissed, setDismissed] = useState(new Set());
  const totalUnread = notifData ? Object.entries(notifData.totals).filter(([k]) => !dismissed.has(k)).reduce((s, [, c]) => s + c, 0) : 0;
  const dismissType = (type) => setDismissed(prev => new Set([...prev, type]));
  const dismissAll = () => {
    if (!notifData) return;
    setDismissed(new Set(Object.keys(notifData.totals)));
  };

  const isAdmin = user.role === 'admin' || user.role === 'super_admin';

  const notifSections = [
    { type: 'late', label: 'متأخرين', icon: '#E53935', bg: '#FEF2F2', link: '/admin/attendance', count: notifData?.late?.length },
    ...(isAdmin ? [{ type: 'justifications', label: 'مبررات', icon: '#F59E0B', bg: '#FFFBEB', link: '/admin/justifications', count: notifData?.justifications?.length }] : []),
    ...(isAdmin ? [{ type: 'registrations', label: 'تسجيلات جديدة', icon: '#3B82F6', bg: '#EFF6FF', link: '/admin/pending-drivers', count: notifData?.registrations?.length }] : []),
    { type: 'absence_requests', label: 'طلبات غياب', icon: '#8B5CF6', bg: '#F5F3FF', link: '/admin/absence-requests', count: notifData?.absence_requests?.length },
  ].filter(s => s.count > 0);

  const handleLogout = () => { logout(); };
  const inits = initials(user.full_name);

  /* ── Desktop grouped nav ── */
  const desktopNav = (
    <>
      <Link to="/admin" className={`nav-link ${isActive('/admin')}`}>لوحة التحكم</Link>

      <Link to="/admin/scan" className={`nav-link nav-link-scan ${isActive('/admin/scan')}`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><rect x="7" y="7" width="10" height="10" rx="1"/></svg>
        مسح QR
      </Link>

      <NavDropdown label="التشغيل">
        <Link to="/admin/drivers" className={`nav-dd-link ${isActive('/admin/drivers')}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          السائقين
        </Link>
        <Link to="/admin/attendance" className={`nav-dd-link ${isActive('/admin/attendance')}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          سجلات الحضور
        </Link>
      </NavDropdown>

      <NavDropdown label="الإدارة">
        <Link to="/admin/penalties" className={`nav-dd-link ${isActive('/admin/penalties')}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          الغرامات
        </Link>
        <Link to="/admin/absences" className={`nav-dd-link ${isActive('/admin/absences')}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          الغيابات
        </Link>
        <Link to="/admin/absence-requests" className={`nav-dd-link ${isActive('/admin/absence-requests')}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          طلبات الغياب
        </Link>
        {isAdmin && (
          <Link to="/admin/justifications" className={`nav-dd-link ${isActive('/admin/justifications')}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            المبررات
            {notifData?.justifications?.length > 0 && <span className="nav-dd-badge">{notifData.justifications.length}</span>}
          </Link>
        )}
      </NavDropdown>

      {isAdmin && (
        <NavDropdown label="النظام">
          <Link to="/admin/settings" className={`nav-dd-link ${isActive('/admin/settings')}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1.08 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1.08z"/></svg>
            الإعدادات
          </Link>
          <Link to="/admin/ops" className={`nav-dd-link ${isActive('/admin/ops')}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            المشغلين
          </Link>
          <Link to="/admin/stations" className={`nav-dd-link ${isActive('/admin/stations')}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            المحطات
          </Link>
          <Link to="/admin/activity-logs" className={`nav-dd-link ${isActive('/admin/activity-logs')}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            سجل النشاطات
          </Link>
          <Link to="/admin/pending-drivers" className={`nav-dd-link ${isActive('/admin/pending-drivers')}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
            تسجيلات جديدة
            {notifData?.registrations?.length > 0 && <span className="nav-dd-badge">{notifData.registrations.length}</span>}
          </Link>
        </NavDropdown>
      )}
    </>
  );

  /* ── Mobile drawer nav (flat list) ── */
  const drawerLinks = (onClick) => (
    <>
      <Link to="/admin" className={`nav-link ${isActive('/admin')}`} onClick={onClick}>لوحة التحكم</Link>
      <Link to="/admin/scan" className={`nav-link ${isActive('/admin/scan')}`} onClick={onClick}>
        <span className="nav-scan-badge">مسح QR</span>
      </Link>
      <Link to="/admin/drivers" className={`nav-link ${isActive('/admin/drivers')}`} onClick={onClick}>السائقين</Link>
      <Link to="/admin/attendance" className={`nav-link ${isActive('/admin/attendance')}`} onClick={onClick}>سجلات الحضور</Link>
      <hr className="nav-drawer-divider" />
      <Link to="/admin/penalties" className={`nav-link ${isActive('/admin/penalties')}`} onClick={onClick}>الغرامات</Link>
      <Link to="/admin/absences" className={`nav-link ${isActive('/admin/absences')}`} onClick={onClick}>الغيابات</Link>
      <Link to="/admin/absence-requests" className={`nav-link ${isActive('/admin/absence-requests')}`} onClick={onClick}>طلبات الغياب</Link>
      {isAdmin && (
        <Link to="/admin/justifications" className={`nav-link nav-link-just ${isActive('/admin/justifications')}`} onClick={onClick}>
          المبررات
          {notifData?.justifications?.length > 0 && <span className="nav-notif-badge nav-just-badge">{notifData.justifications.length}</span>}
        </Link>
      )}
      {isAdmin && (
        <Link to="/admin/pending-drivers" className={`nav-link nav-link-just ${isActive('/admin/pending-drivers')}`} onClick={onClick}>
          تسجيلات جديدة
          {notifData?.registrations?.length > 0 && <span className="nav-notif-badge nav-just-badge">{notifData.registrations.length}</span>}
        </Link>
      )}
      {isAdmin && (
        <>
          <hr className="nav-drawer-divider" />
          <Link to="/admin/settings" className={`nav-link ${isActive('/admin/settings')}`} onClick={onClick}>الإعدادات</Link>
          <Link to="/admin/ops" className={`nav-link ${isActive('/admin/ops')}`} onClick={onClick}>المشغلين</Link>
          <Link to="/admin/stations" className={`nav-link ${isActive('/admin/stations')}`} onClick={onClick}>المحطات</Link>
          <Link to="/admin/activity-logs" className={`nav-link ${isActive('/admin/activity-logs')}`} onClick={onClick}>سجل النشاطات</Link>
        </>
      )}
    </>
  );

  return (
    <>
      <nav className={`navbar${hidden ? ' navbar-hidden' : ''}`}>
        <div className="nav-inner">
          <Link to="/login" className="nav-brand">
            <img src="/NAVEXlogo.png" alt="NAVEX" className="nav-brand-logo" />
            <span className="nav-brand-text">Driver<span className="nav-brand-dot">TRACK</span></span>
          </Link>

          <div className="nav-links">
            <div className="nav-links-center">
              {desktopNav}
            </div>
            <button onClick={handleLogout} className="nav-link nav-logout-mobile" title="خروج">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              <span className="nav-logout-label">خروج</span>
            </button>
          </div>

          <button onClick={() => setMenuOpen(!menuOpen)} className="nav-hamburger" aria-label="القائمة">
            <span className={`nav-hamburger-line${menuOpen ? ' open' : ''}`} />
            <span className={`nav-hamburger-line${menuOpen ? ' open' : ''}`} />
            <span className={`nav-hamburger-line${menuOpen ? ' open' : ''}`} />
          </button>

          <div className="nav-actions">
            <div ref={notifRef} className="nav-notif-wrapper">
              <button onClick={() => { setNotifOpen(!notifOpen); if (!notifOpen) dismissAll(); }} className="nav-notif-btn" title="الإشعارات">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                {totalUnread > 0 && <span className="nav-notif-badge">{totalUnread}</span>}
              </button>
              {notifOpen && notifData && (
                <div className="nav-notif-dropdown">
                  <div className="nav-notif-header">
                    <span>الإشعارات</span>
                    <span className="nav-notif-count">{notifData.totals.late + notifData.totals.justifications + notifData.totals.registrations + notifData.totals.absence_requests} إجمالي</span>
                  </div>
                  <div className="nav-notif-list">
                    {notifSections.length === 0 ? (
                      <div className="nav-notif-empty">لا توجد إشعارات جديدة</div>
                    ) : (
                      notifSections.map(({ type, label, icon, bg, link, count }) => (
                        <div key={type} className="nav-notif-section">
                          <Link to={link} className="nav-notif-section-btn" onClick={() => setNotifOpen(false)}>
                            <div className="nav-notif-section-btn-icon" style={{ background: bg }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={icon} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                {type === 'late' && <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>}
                                {type === 'justifications' && <><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></>}
                                {type === 'registrations' && <><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></>}
                                {type === 'absence_requests' && <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></>}
                              </svg>
                            </div>
                            <div className="nav-notif-section-btn-body">
                              <span className="nav-notif-section-btn-label">{label}</span>
                              <span className="nav-notif-section-btn-meta">
                                {type === 'late' && 'تأخير اليوم'}
                                {type === 'justifications' && 'بانتظار المراجعة'}
                                {type === 'registrations' && 'سائقين جدد'}
                                {type === 'absence_requests' && 'بانتظار الموافقة'}
                              </span>
                            </div>
                            <div className="nav-notif-section-btn-end">
                              <span className="nav-notif-section-btn-count" style={{ color: icon, background: bg }}>{count}</span>
                              <button className="nav-notif-section-btn-mark" onClick={(e) => { e.preventDefault(); e.stopPropagation(); dismissType(type); }}>تم</button>
                              <svg className="nav-notif-section-btn-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                            </div>
                          </Link>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <div ref={profileRef} className="nav-profile-wrapper">
              <button onClick={() => setProfileOpen(!profileOpen)} className="nav-profile-btn" title={user.full_name}>
                <span className="nav-profile-avatar">{inits}</span>
              </button>
              {profileOpen && (
                <div className="nav-profile-dropdown">
                  <div className="nav-profile-header">
                    <div className="nav-profile-header-avatar">{inits}</div>
                    <div className="nav-profile-header-info">
                      <div className="nav-profile-header-name">{user.full_name}</div>
                      <div className="nav-profile-header-role">{user.role === 'super_admin' ? 'مدير عام' : user.role === 'admin' ? 'مدير' : 'مشغل'}</div>
                    </div>
                  </div>
                  <div className="nav-profile-body">
                    <Link to="/admin/profile" className="nav-profile-item" onClick={() => setProfileOpen(false)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1.08 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1.08z"/></svg>
                      <span>الإعدادات</span>
                    </Link>
                    <button onClick={handleLogout} className="nav-profile-item nav-profile-logout">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                      <span>تسجيل خروج</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button onClick={toggle} className="theme-toggle" title={dark ? 'الوضع النهاري' : 'الوضع الليلي'}>
              <svg className="theme-sun" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              <svg className="theme-moon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            </button>
          </div>
        </div>
      </nav>

      {menuOpen && <div className="nav-overlay" onClick={() => setMenuOpen(false)} />}

      <div ref={menuRef} className={`nav-drawer${menuOpen ? ' open' : ''}`}>
        <div className="nav-drawer-header">
          <div className="nav-drawer-header-avatar">{inits}</div>
          <div>
            <div className="nav-drawer-header-name">{user.full_name}</div>
            <div className="nav-drawer-header-role">{user.role === 'super_admin' ? 'مدير عام' : user.role === 'admin' ? 'مدير' : 'مشغل'}</div>
          </div>
        </div>
        <div className="nav-drawer-links">
          {drawerLinks(() => setMenuOpen(false))}
          <hr className="nav-drawer-divider" />
          <button onClick={() => { handleLogout(); setMenuOpen(false); }} className="nav-drawer-logout">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            <span>تسجيل خروج</span>
          </button>
        </div>
      </div>
    </>
  );
}
