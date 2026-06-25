import { useState, useEffect } from 'react';
import { analytics } from '../api';

function Donut({ attendance, absence, total }) {
  const attended = attendance || 0;
  const absent = absence || 0;
  const remaining = Math.max(total - attended - absent, 0);
  const totalVal = attended + absent + remaining || 1;
  const attendedPct = (attended / totalVal) * 100;
  const absentPct = (absent / totalVal) * 100;
  const remainingPct = (remaining / totalVal) * 100;
  const r = 72;
  const circ = 2 * Math.PI * r;
  const attendedLen = (attendedPct / 100) * circ;
  const absentLen = (absentPct / 100) * circ;
  const remainingLen = (remainingPct / 100) * circ;
  const dash = `${attendedLen} ${circ - attendedLen}`;
  const dash2 = `${absentLen} ${circ - absentLen}`;
  const dash3 = `${remainingLen} ${circ - remainingLen}`;
  const off1 = 0;
  const off2 = -attendedLen;
  const off3 = -(attendedLen + absentLen);
  return (
    <svg width="180" height="180" viewBox="0 0 180 180">
      <circle cx="90" cy="90" r={r} fill="none" stroke="#F3F4F6" strokeWidth="20" />
      <circle cx="90" cy="90" r={r} fill="none" stroke="url(#donutGreen)" strokeWidth="20"
        strokeDasharray={dash} strokeDashoffset={off1} strokeLinecap="round" transform="rotate(-90 90 90)" />
      <circle cx="90" cy="90" r={r} fill="none" stroke="url(#donutRed)" strokeWidth="20"
        strokeDasharray={dash2} strokeDashoffset={off2} strokeLinecap="round" transform="rotate(-90 90 90)" />
      {remaining > 0 && (
        <circle cx="90" cy="90" r={r} fill="none" stroke="#E5E7EB" strokeWidth="20"
          strokeDasharray={dash3} strokeDashoffset={off3} strokeLinecap="round" transform="rotate(-90 90 90)" />
      )}
      <defs>
        <linearGradient id="donutGreen" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#22C55E"/><stop offset="100%" stopColor="#16A34A"/></linearGradient>
        <linearGradient id="donutRed" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#EF4444"/><stop offset="100%" stopColor="#DC2626"/></linearGradient>
      </defs>
      <text x="90" y="82" textAnchor="middle" fontSize="28" fontWeight="800" fill="#1A1A1A">{attended}</text>
      <text x="90" y="104" textAnchor="middle" fontSize="11" fontWeight="600" fill="#6B7280">حاضر</text>
    </svg>
  );
}

function Sparkline({ data }) {
  const width = 600, height = 180;
  const pad = { t: 20, r: 10, b: 30, l: 10 };
  const chartW = width - pad.l - pad.r;
  const chartH = height - pad.t - pad.b;
  const max = Math.max(...data.map(d => d.attendance), 1);
  const points = data.map((d, i) => {
    const x = pad.l + (i / Math.max(data.length - 1, 1)) * chartW;
    const y = pad.t + chartH - (d.attendance / max) * chartH;
    return `${x},${y}`;
  }).join(' ');
  const absPoints = data.map((d, i) => {
    const x = pad.l + (i / Math.max(data.length - 1, 1)) * chartW;
    const y = pad.t + chartH - (d.absences / Math.max(max, 1)) * chartH;
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = data.map((d, i) => {
    const x = pad.l + (i / Math.max(data.length - 1, 1)) * chartW;
    const y = pad.t + chartH - (d.attendance / max) * chartH;
    return `${x},${y}`;
  });
  const areaStr = `M${areaPoints[0]} L${areaPoints.slice(1).join(' L')} L${pad.l + chartW},${pad.t + chartH} L${pad.l},${pad.t + chartH} Z`;

  const absAreaPoints = data.map((d, i) => {
    const x = pad.l + (i / Math.max(data.length - 1, 1)) * chartW;
    const y = pad.t + chartH - (d.absences / Math.max(max, 1)) * chartH;
    return `${x},${y}`;
  });
  const absAreaStr = `M${absAreaPoints[0]} L${absAreaPoints.slice(1).join(' L')} L${pad.l + chartW},${pad.t + chartH} L${pad.l},${pad.t + chartH} Z`;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="attArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22C55E" stopOpacity="0.3"/><stop offset="100%" stopColor="#22C55E" stopOpacity="0.01"/></linearGradient>
        <linearGradient id="absArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#EF4444" stopOpacity="0.2"/><stop offset="100%" stopColor="#EF4444" stopOpacity="0.01"/></linearGradient>
      </defs>
      {data.length > 1 && <path d={areaStr} fill="url(#attArea)" />}
      {data.length > 1 && <polyline points={points} fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
      {data.length > 1 && <path d={absAreaStr} fill="url(#absArea)" />}
      {data.length > 1 && <polyline points={absPoints} fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 3" />}
      {data.map((d, i) => {
        const x = pad.l + (i / Math.max(data.length - 1, 1)) * chartW;
        return (
          <text key={i} x={x} y={height - 6} textAnchor="middle" fontSize="9" fill="#9CA3AF">
            {d.date.slice(5)}
          </text>
        );
      })}
      {data.map((d, i) => {
        if (d.date === data[data.length - 1]?.date) {
          const x = pad.l + (i / Math.max(data.length - 1, 1)) * chartW;
          const attY = pad.t + chartH - (d.attendance / max) * chartH;
          const absY = pad.t + chartH - (d.absences / Math.max(max, 1)) * chartH;
          return (
            <g key={`label-${i}`}>
              <rect x={x + 6} y={attY - 9} width="28" height="16" rx="6" fill="#22C55E" opacity="0.9" />
              <text x={x + 20} y={attY + 2} textAnchor="middle" fontSize="10" fontWeight="700" fill="white">{d.attendance}</text>
              <rect x={x + 6} y={absY - 9} width="28" height="16" rx="6" fill="#EF4444" opacity="0.9" />
              <text x={x + 20} y={absY + 2} textAnchor="middle" fontSize="10" fontWeight="700" fill="white">{d.absences}</text>
            </g>
          );
        }
        return null;
      })}
    </svg>
  );
}

export default function AnalyticsDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analytics.get()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="loading-screen">
      <div className="nx-loader">
        <div className="nx-spinner"></div>
        <span className="nx-loader-label">جاري تحميل التحليلات...</span>
      </div>
    </div>
  );
  if (!data) return <div className="page"><p>لا توجد بيانات</p></div>;

  const maxPeak = Math.max(...data.peak_scan_hours.map(h => h.count), 1);
  const maxAbsStation = Math.max(...data.stations_most_absences.map(s => s.count), 1);

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-content">
          <h2>تحليلات الأداء</h2>
          <p className="text-muted">{data.date}</p>
        </div>
      </div>

      <div className="ios-grid">
        <div className="ios-card ios-card-summary">
          <div className="ios-summary-icon" style={{ background: 'linear-gradient(135deg,#DCFCE7,#BBF7D0)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <span className="ios-summary-label">حضور اليوم</span>
          <span className="ios-summary-value" style={{ color: '#16A34A' }}>{data.attendance_today}</span>
          <span className="ios-summary-sub">من أصل {data.total_drivers}</span>
        </div>
        <div className="ios-card ios-card-summary">
          <div className="ios-summary-icon" style={{ background: 'linear-gradient(135deg,#FEE2E2,#FECACA)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </div>
          <span className="ios-summary-label">غياب اليوم</span>
          <span className="ios-summary-value" style={{ color: '#DC2626' }}>{data.absence_today}</span>
          <span className="ios-summary-sub">سائق متغيب</span>
        </div>
        <div className="ios-card ios-card-summary">
          <div className="ios-summary-icon" style={{ background: 'linear-gradient(135deg,#DBEAFE,#BFDBFE)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <span className="ios-summary-label">إجمالي السائقين</span>
          <span className="ios-summary-value" style={{ color: '#2563EB' }}>{data.total_drivers}</span>
          <span className="ios-summary-sub">سائق نشط</span>
        </div>
      </div>

      <div className="ios-grid two-col">
        <div className="ios-card">
          <div className="ios-card-header">
            <span className="ios-card-title">🍩 توزيع اليوم</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', justifyContent: 'center', padding: '0.5rem 0' }}>
            <Donut attendance={data.attendance_today} absence={data.absence_today} total={data.total_drivers} />
            <div className="ios-legend-col">
              <div className="ios-legend-item"><span className="ios-dot" style={{ background: '#22C55E' }}></span> حاضر <strong>{data.attendance_today}</strong></div>
              <div className="ios-legend-item"><span className="ios-dot" style={{ background: '#EF4444' }}></span> غائب <strong>{data.absence_today}</strong></div>
              <div className="ios-legend-item"><span className="ios-dot" style={{ background: '#E5E7EB' }}></span> متبقي <strong>{Math.max(data.total_drivers - data.attendance_today - data.absence_today, 0)}</strong></div>
            </div>
          </div>
        </div>

        <div className="ios-card">
          <div className="ios-card-header">
            <span className="ios-card-title">📈 اتجاه الحضور — 14 يوم</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.25rem 0' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#6B7280' }}><span style={{ width: 12, height: 3, borderRadius: 2, background: '#22C55E', display: 'inline-block' }}></span> حضور</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#6B7280' }}><span style={{ width: 12, height: 3, borderRadius: 2, background: '#EF4444', display: 'inline-block', backgroundImage: 'repeating-linear-gradient(90deg,#EF4444 0,#EF4444 4px,transparent 4px,transparent 7px)' }}></span> غياب</span>
          </div>
          <Sparkline data={data.attendance_over_time} />
        </div>
      </div>

      <div className="ios-grid three-col">
        <div className="ios-card">
          <div className="ios-card-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span className="ios-card-title">أوقات الذروة</span>
          </div>
          {data.peak_scan_hours.length === 0 ? (
            <p className="text-muted" style={{ textAlign: 'center', padding: '1rem 0' }}>لا توجد بيانات</p>
          ) : (
            <div className="ios-bar-list">
              {data.peak_scan_hours.map((h, i) => (
                <div key={i} className="ios-bar-item">
                  <span className="ios-bar-label">{h.hour}</span>
                  <div className="ios-bar-track">
                    <div className="ios-bar-fill" style={{ width: (h.count / maxPeak) * 100 + '%', background: 'linear-gradient(90deg,#F59E0B,#D97706)' }}></div>
                  </div>
                  <span className="ios-bar-count">{h.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="ios-card">
          <div className="ios-card-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            <span className="ios-card-title">المحطات — الأكثر غياباً</span>
          </div>
          {data.stations_most_absences.length === 0 ? (
            <p className="text-muted" style={{ textAlign: 'center', padding: '1rem 0' }}>لا توجد محطات</p>
          ) : (
            <div className="ios-bar-list">
              {data.stations_most_absences.map((s, i) => (
                <div key={i} className="ios-bar-item">
                  <span className="ios-bar-label">{s.name || 'بدون محطة'}</span>
                  <div className="ios-bar-track">
                    <div className="ios-bar-fill" style={{ width: (s.count / maxAbsStation) * 100 + '%', background: 'linear-gradient(90deg,#EF4444,#DC2626)' }}></div>
                  </div>
                  <span className="ios-bar-count">{s.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="ios-card">
          <div className="ios-card-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C7 4 6 9 6 9z"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5C17 4 18 9 18 9z"/><path d="M4 22h16"/><path d="M10 22V2h4v20"/></svg>
            <span className="ios-card-title">المحطات — الأكثر انضباطاً</span>
          </div>
          {data.stations_best_attendance.length === 0 ? (
            <p className="text-muted" style={{ textAlign: 'center', padding: '1rem 0' }}>لا توجد محطات</p>
          ) : (
            <div className="ios-bar-list">
              {data.stations_best_attendance.map((s, i) => (
                <div key={i} className="ios-bar-item">
                  <span className="ios-bar-label">{s.name || 'بدون محطة'}</span>
                  <div className="ios-bar-track">
                    <div className="ios-bar-fill" style={{ width: (s.total > 0 ? (s.on_time / s.total) * 100 : 0) + '%', background: 'linear-gradient(90deg,#22C55E,#16A34A)' }}></div>
                  </div>
                  <span className="ios-bar-count">{s.on_time}/{s.total}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
