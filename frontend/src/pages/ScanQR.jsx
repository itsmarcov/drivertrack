import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { qr } from '../api';

export default function ScanQR() {
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [location, setLocation] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const inputRef = useRef(null);
  const beepRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    const beep = new AudioContext();
    beepRef.current = beep;
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { timeout: 5000, enableHighAccuracy: true }
      );
    }
    return () => beep.close();
  }, []);

  useEffect(() => {
    if (!processing && !result && !error) {
      inputRef.current?.focus();
    }
  }, [processing, result, error]);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const handler = (event) => {
        if (event.data?.type === 'SCAN_QUEUE_STATUS') {
          setPendingCount(event.data.count || 0);
          setSyncing(event.data.syncing || false);
        }
      };
      navigator.serviceWorker.addEventListener('message', handler);
      navigator.serviceWorker.ready.then((reg) => reg.active?.postMessage({ type: 'GET_QUEUE_STATUS' }));
      return () => navigator.serviceWorker.removeEventListener('message', handler);
    }
  }, []);

  useEffect(() => {
    const goOnline = () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then((reg) => reg.active?.postMessage({ type: 'SYNC_SCANS' }));
      }
    };
    window.addEventListener('online', goOnline);
    return () => window.removeEventListener('online', goOnline);
  }, []);

  const playBeep = (type) => {
    try {
      const ctx = beepRef.current;
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = type === 'success' ? 1200 : 300;
      gain.gain.value = 0.3;
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {}
  };

  const processQRData = async (data) => {
    if (!data.trim()) return;
    setProcessing(true);
    setError('');
    setResult(null);
    try {
      let parsed = data;
      try { parsed = JSON.parse(data); } catch { throw new Error('بيانات QR غير صالحة. يجب أن تكون بصيغة JSON صحيحة.'); }
      const response = await qr.scan(parsed, location?.lat, location?.lng);
      setResult(response);
      playBeep('success');
    } catch (err) {
      setError(err.message);
      playBeep('error');
    } finally {
      setProcessing(false);
      setInput('');
    }
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setInput(val);
    if (val.endsWith('\n') || val.endsWith('\r')) {
      processQRData(val.trim());
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      processQRData(input);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    processQRData(input);
  };

  return (
    <div className="scan-page">
      {pendingCount > 0 && (
        <div className={`scan-queue-banner ${syncing ? 'syncing' : ''}`}>
          <div className="scan-queue-banner-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
          </div>
          <span>{syncing ? `${pendingCount} مسحات في الانتظار، جاري المزامنة...` : `${pendingCount} مسحات في الانتظار`}</span>
        </div>
      )}

      <div className="scan-hero">
        <div className="scan-hero-icon">📋</div>
        <h2>مسح رمز QR</h2>
        <p>قم بتوجيه الدوشيت (ماسح QR) نحو رمز السائق</p>
        <span className="scan-agent-name">{user.full_name}</span>
        {location && <div className="scan-location-badge">📍 تم تحديد الموقع</div>}
      </div>

      <form onSubmit={handleSubmit} className="douchette-form" autoComplete="off">
        <div className="douchette-input-wrapper">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="انتظر بيانات QR من الدوشيت..."
            disabled={processing}
            className="douchette-input"
            autoFocus
          />
          <div className="douchette-status">
            <span className={`status-dot ${processing ? 'processing' : result ? 'success' : error ? 'error' : 'idle'}`}></span>
            <span className="status-text">
              {processing ? 'جارٍ التحقق...' : result ? 'تم التسجيل!' : error ? 'خطأ في المسح' : 'في انتظار المسح...'}
            </span>
          </div>
        </div>
        <button type="submit" className="btn btn-primary btn-block" disabled={processing || !input.trim()}>
          تسجيل الحضور يدوياً
        </button>
      </form>

      {error && (
        <div className="alert alert-error scan-alert">
          <strong>✕ فشل التسجيل</strong>
          <p style={{ marginTop: '0.25rem' }}>{error}</p>
        </div>
      )}

      {result && !result.queued && (
        <div className="scan-result-card">
          <div className={`scan-result-header ${result.record.is_late ? 'late' : ''}`}>
            <div className={`scan-result-header-icon ${result.record.is_late ? 'warning' : 'success'}`}>{result.record.is_late ? '⚠' : '✓'}</div>
            <div>
              <h4>{result.record.is_late ? '⚠️ تم التسجيل متأخراً' : 'تم تسجيل الحضور بنجاح'}</h4>
              <p>{result.record.driver_name}</p>
            </div>
          </div>
          <div className="result-details">
            <div className="result-row">
              <span className="result-label">السائق</span>
              <span className="result-value">{result.record.driver_name}</span>
            </div>
            <div className="result-row">
              <span className="result-label">التاريخ</span>
              <span className="result-value">{result.record.scan_date}</span>
            </div>
            <div className="result-row">
              <span className="result-label">الوقت</span>
              <span className="result-value">{result.record.scan_time}</span>
            </div>
            <div className="result-row">
              <span className="result-label">الحالة</span>
              {result.record.is_late ? <span className="badge badge-late">متأخر ⚠</span> : <span className="badge badge-success">موثق ✓</span>}
            </div>
            {result.penalty && (
              <div className="result-row">
                <span className="result-label">غرامة تأخير</span>
                <span className="result-value" style={{ color: '#B91C1C', fontWeight: 700 }}>{result.penalty.amount} د.ج</span>
              </div>
            )}
            {result.record.lat && result.record.lng && (
              <div className="result-row">
                <span className="result-label">الموقع</span>
                <span className="result-value text-sm" style={{ direction: 'ltr' }}>{result.record.lat}, {result.record.lng}</span>
              </div>
            )}
          </div>
          <button className="btn btn-outline scan-another" onClick={() => { setResult(null); setError(''); inputRef.current?.focus(); }}>
            مسح آخر +
          </button>
        </div>
      )}

      {result?.queued && (
        <div className="scan-result-card">
          <div className="scan-result-header">
            <div className="scan-result-header-icon" style={{ background: '#F59E0B20', color: '#F59E0B' }}>⏳</div>
            <div>
              <h4>تم حفظ المسح محلياً</h4>
              <p>سيتم إرساله تلقائياً عند استعادة الاتصال</p>
            </div>
          </div>
          <div className="result-details" style={{ padding: '0.5rem 1rem 1rem' }}>
            <p style={{ fontSize: '0.8125rem', color: 'var(--nx-text-secondary)', textAlign: 'center' }}>
              المسح في قائمة الانتظار برقم <strong>{pendingCount}</strong>
            </p>
          </div>
          <button className="btn btn-outline scan-another" onClick={() => { setResult(null); setError(''); inputRef.current?.focus(); }}>
            مسح آخر +
          </button>
        </div>
      )}
    </div>
  );
}
