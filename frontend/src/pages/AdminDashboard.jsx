import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { attendance, drivers } from '../api';

export default function AdminDashboard() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const [stats, setStats] = useState(null);
  const [recentAttendance, setRecentAttendance] = useState([]);

  useEffect(() => {
    attendance.stats().then(setStats).catch(() => {});
    attendance.list({}).then((data) => setRecentAttendance(data.slice(0, 8))).catch(() => {});
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-content">
          <h2>لوحة التحكم</h2>
          <p>{isAdmin ? 'مدير النظام' : 'وكيل العمليات'} — {user.full_name}</p>
        </div>
      </div>

      {stats && (
        <div className="nx-stats">
          <div className="nx-stat">
            <div className="nx-stat-type">إجمالي السائقين</div>
            <div className="nx-stat-value">{stats.total_drivers}</div>
            <div className="nx-stat-label">جميع السائقين المسجلين</div>
            <div className="nx-stat-icon">👥</div>
          </div>
          <div className="nx-stat highlight">
            <div className="nx-stat-type">حاضر اليوم</div>
            <div className="nx-stat-value">{stats.present_today}</div>
            <div className="nx-stat-label">من أصل {stats.total_drivers} سائق</div>
            <div className="nx-stat-icon">✅</div>
          </div>
          <div className="nx-stat">
            <div className="nx-stat-type">نسبة الحضور</div>
            <div className="nx-stat-value">
              {stats.total_drivers > 0 ? Math.round((stats.present_today / stats.total_drivers) * 100) : 0}%
            </div>
            <div className="nx-stat-label">ليوم {stats.date}</div>
            <div className="nx-stat-icon">📊</div>
          </div>
          <div className="nx-stat">
            <div className="nx-stat-type">التاريخ</div>
            <div className="nx-stat-value" style={{ fontSize: '1.25rem' }}>{stats.date}</div>
            <div className="nx-stat-label">اليوم الحالي</div>
            <div className="nx-stat-icon">📅</div>
          </div>
        </div>
      )}

      <div className="nx-actions">
        <Link to="/admin/scan" className="nx-action">
          <div className="nx-action-icon">📋</div>
          <h3>مسح QR</h3>
          <p>استخدم الدوشيت لتسجيل حضور السائقين</p>
        </Link>
        <Link to="/admin/drivers" className="nx-action">
          <div className="nx-action-icon">👤</div>
          <h3>إدارة السائقين</h3>
          <p>{isAdmin ? 'إضافة وتعديل ومراقبة حسابات السائقين' : 'إضافة وعرض السائقين'}</p>
        </Link>
        <Link to="/admin/attendance" className="nx-action">
          <div className="nx-action-icon">📋</div>
          <h3>سجلات الحضور</h3>
          <p>عرض وتصفية سجلات حضور السائقين</p>
        </Link>
        {isAdmin && (
          <Link to="/admin/ops" className="nx-action">
            <div className="nx-action-icon">🔧</div>
            <h3>إدارة المشغلين</h3>
            <p>إضافة وإدارة حسابات وكلاء العمليات (OPS)</p>
          </Link>
        )}
      </div>

      <div className="nx-card">
        <div className="nx-card-header">
          <h3>آخر عمليات تسجيل الحضور</h3>
          <Link to="/admin/attendance" className="btn btn-sm btn-outline">عرض الكل</Link>
        </div>
        <div className="nx-card-body" style={{ padding: 0 }}>
          {recentAttendance.length === 0 ? (
            <div className="nx-empty">
              <div className="nx-empty-icon">📋</div>
              <h3>لا توجد سجلات حضور بعد</h3>
              <p>قم بمسح QR code لأحد السائقين لبدء التسجيل</p>
            </div>
          ) : (
            <div className="table-container" style={{ border: 'none', boxShadow: 'none', borderRadius: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>السائق</th>
                    <th>التاريخ</th>
                    <th>الوقت</th>
                    <th>مسح بواسطة</th>
                    <th>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAttendance.map((r) => (
                    <tr key={r.id}>
                      <td><strong>{r.driver_name}</strong></td>
                      <td>{r.scan_date}</td>
                      <td>{r.scan_time}</td>
                      <td>{r.scanned_by_name}</td>
                      <td>{r.verified ? <span className="badge badge-success">موثق</span> : <span className="badge badge-danger">غير موثق</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
