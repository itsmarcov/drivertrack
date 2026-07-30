import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import DriverProfile from './DriverProfile';
import JustificationTab from './JustificationTab';
import AbsenceRequests from './AbsenceRequests';
import ReportsTab from './ReportsTab';
import AddressGuide from '../components/AddressGuide';
import AddressForm from '../components/AddressForm';
import { useAuth } from '../context/AuthContext';
import { qr, attendance, announcements as announcementsApi, drivers, warnings } from '../api';
import { playSuccess, playNotification } from '../utils/sounds';

function SignaturePad({ onConfirm, onCancel }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const lastRef = useRef(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw guide line
    ctx.beginPath();
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.moveTo(20, 50);
    ctx.lineTo(c.width - 20, 50);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2.5;
  }, []);

  const startDraw = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;
    setIsDrawing(true);
    setHasDrawn(true);
    lastRef.current = { x, y };
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(lastRef.current.x, lastRef.current.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    lastRef.current = { x, y };
  };

  const endDraw = () => setIsDrawing(false);

  const clear = () => {
    const c = canvasRef.current;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    setHasDrawn(false);
  };

  const confirm = () => {
    if (!hasDrawn) return;
    onConfirm(canvasRef.current.toDataURL('image/png'));
  };

  return (
    <div className="sig-overlay">
      <div className="sig-modal">
        <h3 style={{ margin: '0 0 12px', fontSize: 15, textAlign: 'center' }}>التوقيع</h3>
        <p style={{ fontSize: 12, color: '#888', textAlign: 'center', margin: '0 0 12px' }}>يرجى التوقيع في المساحة أدناه</p>
        <canvas ref={canvasRef} width={300} height={100}
          onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
          onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
          style={{ border: '1px solid #ddd', borderRadius: 8, width: '100%', height: 100, touchAction: 'none', cursor: 'crosshair', background: '#fafafa' }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="btn btn-primary" onClick={confirm} disabled={!hasDrawn} style={{ flex: 1 }}>تأكيد التوقيع</button>
          <button className="btn btn-outline" onClick={clear}>مسح</button>
          <button className="btn btn-outline" onClick={onCancel}>إلغاء</button>
        </div>
      </div>
    </div>
  );
}

function DriverWarningsTab() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [signingId, setSigningId] = useState(null);
  const [showSigPad, setShowSigPad] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(null);
  const load = async () => {
    try { setList(await warnings.list()); } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleSignConfirm = async (sigData) => {
    if (!showSigPad) return;
    setSigningId(showSigPad.id);
    setShowSigPad(null);
    try { await warnings.sign(showSigPad.id, sigData); load(); } catch {}
    setSigningId(null);
  };

  const handlePdf = async (id) => {
    setPdfLoading(id);
    try {
      const blob = await warnings.downloadPdf(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `warning-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) { alert(err.message); }
    setPdfLoading(null);
  };

  if (loading) return <div className="nx-empty"><h3>جاري التحميل...</h3></div>;
  if (list.length === 0) return <div className="nx-empty"><div className="nx-empty-icon">✅</div><h3>لا توجد إنذارات</h3><p>ليس لديك أي إنذارات مسجلة</p></div>;
  return (
    <div>
      {showSigPad && <SignaturePad onConfirm={handleSignConfirm} onCancel={() => setShowSigPad(null)} />}
      {list.map((w) => (
        <div key={w.id} className="driver-history-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontSize: 15 }}>{w.title}</strong>
            <span className={`badge ${w.status === 'pending' ? 'badge-warning' : w.status === 'signed' ? 'badge-success' : 'badge'}`}>
              {w.status === 'pending' ? 'بانتظار التوقيع' : w.status === 'signed' ? 'تم التوقيع' : 'مؤرشف'}
            </span>
          </div>
          <div style={{ fontSize: 13, color: '#555', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{w.content}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#888' }}>
            <span>من: {w.admin_name} · {new Date(w.created_at).toLocaleDateString('fr-DZ')}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-sm btn-outline" onClick={() => handlePdf(w.id)} disabled={pdfLoading === w.id} style={{ fontSize: 11, padding: '2px 10px' }}>
                {pdfLoading === w.id ? '...' : 'PDF'}
              </button>
              {w.status === 'pending' && (
                <button className="btn btn-sm btn-primary" onClick={() => setShowSigPad(w)} disabled={signingId === w.id}
                  style={{ fontSize: 12, padding: '4px 16px' }}>
                  {signingId === w.id ? 'جاري...' : 'توقيع'}
                </button>
              )}
              {w.signed_at && <span style={{ fontSize: 11 }}>وقع: {new Date(w.signed_at).toLocaleDateString('fr-DZ')}</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

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
  const [showReports, setShowReports] = useState(false);

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
      if (firstUnread) { setCurrentAnnouncement(firstUnread); playNotification(); }
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
      playSuccess();
      setAnnouncements((prev) => {
        const updated = prev.map((a) => a.id === currentAnnouncement.id ? { ...a, is_read: true } : a);
        const nextUnread = updated.find((a) => !a.is_read);
        setCurrentAnnouncement(nextUnread || null);
        return updated;
      });
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

      {currentAnnouncement && (() => {
        const unreadList = announcements.filter((a) => !a.is_read);
        const currentIndex = unreadList.findIndex((a) => a.id === currentAnnouncement.id);
        return (
        <div className="modal-overlay" onClick={(e) => e.stopPropagation()}>
          <div className="modal announcement-popup" onClick={(e) => e.stopPropagation()}>
            <div className="announcement-popup-header">
              <span className="announcement-popup-priority" data-priority={currentAnnouncement.priority}>
                {currentAnnouncement.priority === 'urgent' ? '⚡ إعلان عاجل' : '📢 إعلان'}
              </span>
              <div className="announcement-popup-right">
                <span className="announcement-popup-counter">{currentIndex + 1}/{unreadList.length}</span>
                <span className="announcement-popup-date">
                  {new Date(currentAnnouncement.created_at).toLocaleDateString('fr-DZ')}
                </span>
              </div>
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
        );
      })()}

      {!hasAddress && !addressPromptDismissed && (
        <AddressGuide driverId={user.id} onComplete={() => { setHasAddress(true); setAddressPromptDismissed(true); }} />
      )}

      {error && <div className="alert alert-error driver-alert">{error}</div>}

      <div className="driver-tabs-scroll">
        <div className="driver-tabs">
          <button className={`driver-tab ${activeTab === 'qr' ? 'active' : ''}`} onClick={() => setActiveTab('qr')}>رمز QR</button>
          <button className={`driver-tab ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>الملف الشخصي</button>
          <button className={`driver-tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>سجل الحضور</button>
          <button className={`driver-tab ${activeTab === 'justifications' ? 'active' : ''}`} onClick={() => setActiveTab('justifications')}>المبررات</button>
          <button className={`driver-tab ${activeTab === 'absence-requests' ? 'active' : ''}`} onClick={() => setActiveTab('absence-requests')}>الغيابات المسبقة</button>
          <button className={`driver-tab ${activeTab === 'address' ? 'active' : ''}`} onClick={() => setActiveTab('address')}>عنوان السكن</button>
          <button className={`driver-tab ${activeTab === 'warnings' ? 'active' : ''}`} onClick={() => setActiveTab('warnings')}>الإنذارات</button>
        </div>
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
      {activeTab === 'warnings' && <DriverWarningsTab />}

      <button className="rp-fab" onClick={() => setShowReports(true)} title="تبليغ">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      </button>

      {showReports && (
        <div className="rp-overlay">
          <div className="rp-overlay-header">
            <button className="rp-overlay-close" onClick={() => setShowReports(false)}>✕</button>
            <span className="rp-overlay-title">تبليغ</span>
          </div>
          <div className="rp-overlay-body">
            <ReportsTab />
          </div>
        </div>
      )}
    </div>
  );
}
