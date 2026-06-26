import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../context/AuthContext';
import { qr, attendance } from '../api';

function QRDisplay({ data }) {
  const qrValue = JSON.stringify({
    driverId: data.driverId,
    date: data.date,
    signature: data.signature,
  });

  const timeLeft = () => {
    const now = new Date();
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const diff = end - now;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const [countdown, setCountdown] = useState(timeLeft());
  useEffect(() => {
    const timer = setInterval(() => setCountdown(timeLeft()), 1000);
    return () => clearInterval(timer);
  }, []);

  const refreshPage = () => window.location.reload();

  return (
    <div className="driver-qr-section">
      <div className="driver-greeting">
        <p>{data.date}</p>
        <h2>{data.fullName}</h2>
      </div>
      <div className="driver-qr-card">
        <div className="driver-qr-header">
          <span className="driver-date">رمز QR اليومي</span>
          <span className="driver-validity">ينتهي بعد: <strong className="countdown">{countdown}</strong></span>
        </div>
        <div className="driver-qr-code">
          <QRCodeSVG value={qrValue} size={200} level="H" includeMargin />
        </div>
        <button onClick={refreshPage} className="btn btn-sm btn-outline driver-refresh">تحديث</button>
      </div>
      <div className="driver-instructions">
        اعرض هذا الرمز لموظف التشغيل عند المحطة لتسجيل الحضور
      </div>
    </div>
  );
}

export default function DriverDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [qrData, setQrData] = useState(null);
  const [records, setRecords] = useState([]);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('qr');

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  useEffect(() => {
    qr.getMyQR().then(setQrData).catch((err) => setError(err.message));
    attendance.my().then(setRecords).catch(() => {});
  }, []);

  const safeRecords = Array.isArray(records) ? records : [];
  const todayRecord = safeRecords.find((r) => r.scan_date === qrData?.date);
  const recentRecords = safeRecords.slice(0, 5);

  return (
    <div className="driver-app">
      <div className="driver-top-bar">
        <div className="driver-top-row">
          <div className="driver-top-info" onClick={handleLogout} style={{ cursor: 'pointer' }} title="خروج">
            <img src="/NAVEXlogo.png" alt="NAVEX" className="nav-brand-logo" />
            <span className="driver-role-badge">سائق</span>
            <span className="driver-username">{user.username}</span>
          </div>
          <button onClick={handleLogout} className="driver-logout-btn">تسجيل خروج</button>
        </div>
        <div className="driver-top-greeting">
          مرحباً، <strong>{user.full_name}</strong>
        </div>
      </div>

      {error && <div className="alert alert-error driver-alert">{error}</div>}

      <div className="driver-tabs">
        <button className={`driver-tab ${activeTab === 'qr' ? 'active' : ''}`} onClick={() => setActiveTab('qr')}>رمز QR</button>
        <button className={`driver-tab ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>الملف الشخصي</button>
        <button className={`driver-tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>سجل الحضور</button>
      </div>

      {activeTab === 'qr' && (
        <>
          {qrData && <QRDisplay data={qrData} />}
          {todayRecord ? (
            <div className="driver-today-banner success">
              <span>تم تسجيل حضورك اليوم</span>
              <small>الساعة {todayRecord.scan_time}</small>
            </div>
          ) : qrData && (
            <div className="driver-today-banner warning">
              <span>لم يتم تسجيل الحضور بعد</span>
              <small>اعرض رمز QR لموظف التشغيل</small>
            </div>
          )}
        </>
      )}

      {activeTab === 'profile' && (
        <div className="driver-profile-section">
          <div className="driver-profile-header">
            <div className="driver-profile-avatar">{user.full_name ? user.full_name.charAt(0) : '?'}</div>
            <h3>{user.full_name}</h3>
          </div>
          <div className="driver-profile-details">
            <div className="driver-profile-item">
              <span className="dpi-label">اسم المستخدم</span>
              <span className="dpi-value">{user.username}</span>
            </div>
            <div className="driver-profile-item">
              <span className="dpi-label">البريد الإلكتروني</span>
              <span className="dpi-value">{user.email || '—'}</span>
            </div>
            <div className="driver-profile-item">
              <span className="dpi-label">رقم الهاتف</span>
              <span className="dpi-value">{user.phone || '—'}</span>
            </div>
            <div className="driver-profile-item">
              <span className="dpi-label">نوع المركبة</span>
              <span className="dpi-value">{user.vehicle_type || '—'}</span>
            </div>
            <div className="driver-profile-item">
              <span className="dpi-label">رقم اللوحة</span>
              <span className="dpi-value">{user.license_plate || '—'}</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="driver-history-section">
          <h3>آخر تسجيلات الحضور</h3>
          {recentRecords.length === 0 ? (
            <div className="nx-empty">
              <div className="nx-empty-icon">📋</div>
              <h3>لا توجد سجلات بعد</h3>
              <p>سيتم عرض سجل حضورك هنا بعد أول تسجيل</p>
            </div>
          ) : (
            recentRecords.map((r) => (
              <div key={r.id} className="driver-history-item">
                <div className="dhi-main">
                  <span className="dhi-date">{r.scan_date}</span>
                  <span className="dhi-time">{r.scan_time}</span>
                </div>
                <div className="dhi-sub">
                  <span>{r.scanned_by_name}</span>
                  {r.verified ? <span className="badge badge-success">مسجل</span> : <span className="badge badge-danger">غير موثق</span>}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
