import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import DriverProfile from './DriverProfile';
import JustificationTab from './JustificationTab';
import AbsenceRequests from './AbsenceRequests';
import AddressForm from '../components/AddressForm';
import { useAuth } from '../context/AuthContext';
import { qr, attendance, announcements as announcementsApi, drivers } from '../api';

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
  const [announcements, setAnnouncements] = useState([]);
  const [currentAnnouncement, setCurrentAnnouncement] = useState(null);
  const [hasAddress, setHasAddress] = useState(true);
  const [addressPromptDismissed, setAddressPromptDismissed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  useEffect(() => {
    qr.getMyQR().then(setQrData).catch((err) => setError(err.message));
    attendance.my().then(setRecords).catch(() => {});
    announcementsApi.active().then((data) => {
      setAnnouncements(data);
      const firstUnread = data.find((a) => !a.is_read);
      if (firstUnread) setCurrentAnnouncement(firstUnread);
    }).catch(() => {});
    drivers.getAddress(user.id).then((data) => {
      const filled = data && (data.wilaya_code || data.wilaya_name || data.commune_code || data.commune_name);
      setHasAddress(!!filled);
    }).catch(() => {});
  }, []);

  const safeRecords = Array.isArray(records) ? records : [];
  const todayRecord = safeRecords.find((r) => r.scan_date === qrData?.date);
  const recentRecords = safeRecords.slice(0, 5);

  const handleMarkRead = async () => {
    if (!currentAnnouncement) return;
    try {
      await announcementsApi.markRead(currentAnnouncement.id);
      setAnnouncements((prev) => prev.map((a) => a.id === currentAnnouncement.id ? { ...a, is_read: true } : a));
      const nextUnread = announcements.filter((a) => a.id !== currentAnnouncement.id && !a.is_read);
      if (nextUnread.length > 0) {
        setCurrentAnnouncement(nextUnread[0]);
      } else {
        setCurrentAnnouncement(null);
      }
    } catch (err) {
      setCurrentAnnouncement(null);
    }
  };

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

      {currentAnnouncement && (
        <div className="modal-overlay" onClick={(e) => e.stopPropagation()}>
          <div className="modal announcement-popup" onClick={(e) => e.stopPropagation()}>
            <div className="announcement-popup-header">
              <span className="announcement-popup-priority" data-priority={currentAnnouncement.priority}>
                {currentAnnouncement.priority === 'urgent' ? '⚡ إعلان عاجل' : '📢 إعلان'}
              </span>
              <span className="announcement-popup-date">
                {new Date(currentAnnouncement.created_at).toLocaleDateString('fr-DZ')}
              </span>
            </div>
            <div className="announcement-popup-body">
              {currentAnnouncement.message}
            </div>
            <div className="announcement-popup-footer">
              <button className="btn btn-primary announcement-popup-btn" onClick={handleMarkRead}>
                تم القراءة
              </button>
            </div>
          </div>
        </div>
      )}

      {!hasAddress && !addressPromptDismissed && (
        <div className="driver-address-prompt">
          <div className="driver-address-prompt-body">
            <span className="driver-address-prompt-icon">📍</span>
            <div>
              <div className="driver-address-prompt-title">أضف عنوان سكنك</div>
              <div className="driver-address-prompt-desc">لتسهيل تحديد موقعك من قبل المشرفين</div>
            </div>
          </div>
          <div className="driver-address-prompt-actions">
            <button className="btn btn-sm btn-primary" onClick={() => setActiveTab('address')}>إضافة عنوان</button>
            <button className="btn btn-sm btn-outline" onClick={() => setAddressPromptDismissed(true)}>تخطي</button>
          </div>
        </div>
      )}

      {error && <div className="alert alert-error driver-alert">{error}</div>}

      <div className="driver-tabs">
        <button className={`driver-tab ${activeTab === 'qr' ? 'active' : ''}`} onClick={() => setActiveTab('qr')}>رمز QR</button>
        <button className={`driver-tab ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>الملف الشخصي</button>
        <button className={`driver-tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>سجل الحضور</button>
        <button className={`driver-tab ${activeTab === 'justifications' ? 'active' : ''}`} onClick={() => setActiveTab('justifications')}>المبررات</button>
        <button className={`driver-tab ${activeTab === 'absence-requests' ? 'active' : ''}`} onClick={() => setActiveTab('absence-requests')}>الغيابات المسبقة</button>
        <button className={`driver-tab ${activeTab === 'address' ? 'active' : ''}`} onClick={() => setActiveTab('address')}>عنوان السكن</button>
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

      {activeTab === 'profile' && <DriverProfile />}

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

      {activeTab === 'justifications' && <JustificationTab />}
      {activeTab === 'absence-requests' && <AbsenceRequests compact />}
      {activeTab === 'address' && (
        <div className="driver-address-tab">
          <AddressForm driverId={user.id} />
        </div>
      )}
    </div>
  );
}
