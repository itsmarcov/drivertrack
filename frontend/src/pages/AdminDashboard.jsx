import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { attendance, drivers } from '../api';

export default function AdminDashboard() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const [stats, setStats] = useState(null);
  const [recentAttendance, setRecentAttendance] = useState([]);
  const [driverCount, setDriverCount] = useState(0);

  useEffect(() => {
    attendance.stats().then(setStats).catch(() => {});
    attendance.list({}).then((data) => setRecentAttendance(data.slice(0, 10))).catch(() => {});
    drivers.list().then((data) => setDriverCount(data.length)).catch(() => {});
  }, []);

  return (
    <div className="page admin-page">
      <div className="page-header">
        <h2>لوحة التحكم</h2>
        <p>{isAdmin ? 'مدير النظام' : 'وكيل العمليات'} — {user.full_name}</p>
      </div>

      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-value">{stats.total_drivers}</div>
            <div className="stat-label">إجمالي السائقين</div>
          </div>
          <div className="stat-card stat-highlight">
            <div className="stat-icon">✅</div>
            <div className="stat-value">{stats.present_today}</div>
            <div className="stat-label">حاضر اليوم</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📅</div>
            <div className="stat-value">{stats.date}</div>
            <div className="stat-label">تاريخ اليوم</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-value">{stats.total_drivers > 0 ? Math.round((stats.present_today / stats.total_drivers) * 100) : 0}%</div>
            <div className="stat-label">نسبة الحضور</div>
          </div>
        </div>
      )}

      <div className="action-cards">
        <Link to="/admin/scan" className="action-card">
          <div className="action-icon">📋</div>
          <h3>مسح QR</h3>
          <p>استخدم الدوشيت لتسجيل حضور السائقين</p>
        </Link>
        <Link to="/admin/drivers" className="action-card">
          <div className="action-icon">👤</div>
          <h3>إدارة السائقين</h3>
          <p>{isAdmin ? 'إضافة وتعديل ومراقبة حسابات السائقين' : 'إضافة وعرض السائقين'}</p>
        </Link>
        <Link to="/admin/attendance" className="action-card">
          <div className="action-icon">📋</div>
          <h3>سجلات الحضور</h3>
          <p>عرض وتصفية سجلات حضور السائقين</p>
        </Link>
        {isAdmin && (
          <Link to="/admin/ops" className="action-card">
            <div className="action-icon">🔧</div>
            <h3>إدارة المشغلين</h3>
            <p>إضافة وإدارة حسابات وكلاء العمليات (OPS)</p>
          </Link>
        )}
      </div>

      <div className="section">
        <div className="section-header">
          <h3>آخر عمليات تسجيل الحضور</h3>
          <Link to="/admin/attendance" className="btn btn-sm btn-outline">عرض الكل</Link>
        </div>
        {recentAttendance.length === 0 ? (
          <p className="empty-state">لا توجد سجلات حضور بعد</p>
        ) : (
          <div className="table-container">
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
  );
}
