import { useState, useEffect } from 'react';
import { analytics } from '../api';
import { useAuth } from '../context/AuthContext';

const maxVal = (arr, key) => Math.max(...arr.map(i => i[key]), 1);

export default function AnalyticsDashboard() {
  const { user } = useAuth();
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

  const maxAtt = maxVal(data.attendance_over_time, 'attendance');
  const maxAbs = maxVal(data.attendance_over_time, 'absences');
  const maxPeak = maxVal(data.peak_scan_hours, 'count');

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-content">
          <h2>تحليلات الأداء</h2>
          <p>إحصائيات عامة عن حضور وانضباط السائقين — {data.date}</p>
        </div>
      </div>

      <div className="glass-row">
        <div className="glass-card">
          <div className="glass-icon green">✅</div>
          <div className="glass-label">حضور اليوم</div>
          <div className="glass-value">{data.attendance_today}</div>
          <div className="glass-sub">من أصل {data.total_drivers} سائق</div>
        </div>
        <div className="glass-card">
          <div className="glass-icon red">🚫</div>
          <div className="glass-label">غياب اليوم</div>
          <div className="glass-value">{data.absence_today}</div>
          <div className="glass-sub">سائق متغيب</div>
        </div>
        <div className="glass-card">
          <div className="glass-icon blue">👥</div>
          <div className="glass-label">إجمالي السائقين</div>
          <div className="glass-value">{data.total_drivers}</div>
          <div className="glass-sub">سائق نشط</div>
        </div>
      </div>

      <div className="glass-row">
        <div className="glass-card wide">
          <div className="glass-card-title">📊 الحضور والغياب — آخر 14 يوم</div>
          <div className="glass-chart">
            {data.attendance_over_time.map((d, i) => {
              const attPct = (d.attendance / maxAtt) * 100;
              const absPct = (d.absences / maxAbs) * 100;
              const day = d.date.slice(5);
              const isToday = d.date === data.date;
              return (
                <div key={i} className="glass-bar-col" title={`${d.date}: ${d.attendance} حاضر, ${d.absences} غائب`}>
                  <div className="glass-bar-stack">
                    <div className="glass-bar abs" style={{ height: Math.max(absPct, 2) + '%' }}></div>
                    <div className="glass-bar att" style={{ height: Math.max(attPct, 2) + '%' }}></div>
                  </div>
                  <span className={`glass-bar-label ${isToday ? 'today' : ''}`}>{day}</span>
                </div>
              );
            })}
          </div>
          <div className="glass-legend">
            <span><span className="dot att"></span> حضور</span>
            <span><span className="dot abs"></span> غياب</span>
          </div>
        </div>
      </div>

      <div className="glass-row triple">
        <div className="glass-card">
          <div className="glass-card-title">🕐 أوقات الذروة للمسح</div>
          {data.peak_scan_hours.length === 0 ? (
            <p className="text-muted" style={{ textAlign: 'center' }}>لا توجد بيانات</p>
          ) : (
            <div className="glass-bar-list">
              {data.peak_scan_hours.map((h, i) => (
                <div key={i} className="glass-bar-item">
                  <span className="glass-bar-item-label">{h.hour}</span>
                  <div className="glass-bar-item-track">
                    <div className="glass-bar-item-fill peak" style={{ width: (h.count / maxPeak) * 100 + '%' }}></div>
                  </div>
                  <span className="glass-bar-item-count">{h.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card">
          <div className="glass-card-title">🏢 المحطات — الأكثر غياباً</div>
          {data.stations_most_absences.length === 0 ? (
            <p className="text-muted" style={{ textAlign: 'center' }}>لا توجد محطات</p>
          ) : (
            <div className="glass-bar-list">
              {data.stations_most_absences.map((s, i) => (
                <div key={i} className="glass-bar-item">
                  <span className="glass-bar-item-label">{s.name || 'بدون محطة'}</span>
                  <div className="glass-bar-item-track">
                    <div className="glass-bar-item-fill absence" style={{ width: Math.min((s.count / Math.max(...data.stations_most_absences.map(x => x.count), 1)) * 100, 100) + '%' }}></div>
                  </div>
                  <span className="glass-bar-item-count">{s.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card">
          <div className="glass-card-title">🏆 المحطات — الأكثر انضباطاً</div>
          {data.stations_best_attendance.length === 0 ? (
            <p className="text-muted" style={{ textAlign: 'center' }}>لا توجد محطات</p>
          ) : (
            <div className="glass-bar-list">
              {data.stations_best_attendance.map((s, i) => (
                <div key={i} className="glass-bar-item">
                  <span className="glass-bar-item-label">{s.name || 'بدون محطة'}</span>
                  <div className="glass-bar-item-track">
                    <div className="glass-bar-item-fill discipline" style={{ width: (s.total > 0 ? (s.on_time / s.total) * 100 : 0) + '%' }}></div>
                  </div>
                  <span className="glass-bar-item-count">{s.on_time}/{s.total}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
