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

      {result && (
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
                <span className="result-value" style={{ color: '#B91C1C', fontWeight: 700 }}>{result.penalty.amount} درهم</span>
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
    </div>
  );
}
