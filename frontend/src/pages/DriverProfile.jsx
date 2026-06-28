import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { attendance, drivers } from '../api';
import LoadingScreen from '../components/LoadingScreen';

const G = '#22C55E';
const R = '#E53935';
const A = '#F59E0B';
const B = '#3B82F6';

function CirProg({ pct, size, stroke }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const filled = (pct / 100) * circ;
  const color = pct >= 80 ? G : pct >= 60 ? A : R;
  return (
    <svg width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eee" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${filled} ${circ - filled}`} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dasharray 1s ease' }} />
    </svg>
  );
}

function StatCard({ icon, label, value, accent, sub }) {
  return (
    <div style={{ flex: '1 1 140px', minWidth: 0, background: '#fff', borderRadius: 12, padding: '14px 16px', border: '0.5px solid #e8e8e8' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ color: accent, opacity: 0.8 }}>{icon}</span>
        <span style={{ fontSize: 11, color: '#888' }}>{label}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 500, color: '#111', lineHeight: 1.2 }}>{value}</div>
      {sub != null && <div style={{ fontSize: 10, color: accent, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function DriverProfile({ driverId, onClose }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [driverInfo, setDriverInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  const isAdminView = driverId != null;

  useEffect(() => {
    async function load() {
      try {
        const params = {};
        if (isAdminView) params.driver_id = driverId;
        const [p, d] = await Promise.all([
          attendance.profile(params),
          isAdminView ? drivers.get(driverId) : Promise.resolve(null),
        ]);
        setProfile(p);
        setDriverInfo(d);
      } catch (_) {}
      setLoading(false);
    }
    load();
  }, [driverId]);

  if (loading) return <LoadingScreen message="جاري تحميل الملف..." />;

  const p = profile || {};
  const info = isAdminView ? driverInfo : user;
  const present30 = p.total_present_30d || 0;
  const abs30 = p.total_absences_30d || 0;
  const streak = p.streak || 0;
  const rate = p.attendance_rate_30d || 0;
  const totalAtt = p.total_attendance || 0;
  const totalPen = p.total_penalties || 0;
  const totalPenAmt = p.total_penalty_amount || 0;
  const recent = Array.isArray(p.recent_attendance) ? p.recent_attendance : [];

  const initial = info?.full_name ? info.full_name.charAt(0) : '?';
  const daysLabel = rate >= 80 ? 'ممتاز' : rate >= 60 ? 'جيد' : rate >= 40 ? 'مقبول' : 'ضعيف';

  return (
    <div style={isAdminView ? {} : { padding: '16px' }}>
      {isAdminView && onClose && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>ملف السائق</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 18, color: '#888', cursor: 'pointer', padding: '4px 8px' }}>✕</button>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <div style={{ width: 54, height: 54, borderRadius: '50%', background: 'linear-gradient(135deg, #E53935, #B71C1C)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
          {initial}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: '#111' }}>{info?.full_name || ''}</div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
            {(info?.vehicle_type || '') + (info?.license_plate ? ' · ' + info.license_plate : '') + (info?.station_name ? ' · ' + info.station_name : '')}
          </div>
        </div>
      </div>

      {/* Circular rate + streak */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
        <div style={{ flex: 1, background: '#fff', borderRadius: 12, padding: 16, border: '0.5px solid #e8e8e8', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: 88, height: 88 }}>
            <CirProg pct={rate} size={88} stroke={8} />
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#111' }}>{rate}%</div>
              <div style={{ fontSize: 9, color: '#888' }}>حضور</div>
            </div>
          </div>
          <div style={{ fontSize: 10, color: rate >= 80 ? G : rate >= 60 ? A : R, marginTop: 6, fontWeight: 600 }}>{daysLabel}</div>
          <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>آخر 30 يوم</div>
        </div>
        <div style={{ flex: 1, background: '#fff', borderRadius: 12, padding: 16, border: '0.5px solid #e8e8e8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#111', lineHeight: 1 }}>{streak}</div>
          <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>أيام متتالية</div>
          {streak > 0 && <div style={{ fontSize: 11, color: A, marginTop: 2, fontWeight: 600 }}>{streak >= 5 ? 'مواظب' : streak >= 3 ? 'جيد' : 'بداية'}</div>}
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <StatCard icon={<CheckIcon />} label="حضور (30 يوم)" value={present30} accent={G} sub={abs30 > 0 ? `${abs30} غياب` : null} />
        <StatCard icon={<ClockIcon />} label="إجمالي الحضور" value={totalAtt} accent={B} />
        <StatCard icon={<PenaltyIcon />} label="الغرامات" value={totalPen} accent={R} sub={totalPenAmt > 0 ? `${totalPenAmt} دج` : null} />
      </div>

      {/* Progress bar detail */}
      <div style={{ background: '#fff', borderRadius: 12, padding: 14, border: '0.5px solid #e8e8e8', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#888', marginBottom: 6 }}>
          <span>معدل الحضور (30 يوم)</span>
          <span>{present30} / 30 يوم</span>
        </div>
        <div style={{ width: '100%', height: 6, borderRadius: 4, background: '#eee', overflow: 'hidden' }}>
          <div style={{ width: rate + '%', height: '100%', borderRadius: 4, background: rate >= 80 ? G : rate >= 60 ? A : R, transition: 'width 1s ease' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#888', marginTop: 4 }}>
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Recent Attendance */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 8 }}>آخر 10 تسجيلات</div>
        {recent.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 12, color: '#888' }}>لا توجد تسجيلات بعد</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {recent.map((r, i) => {
              const isToday = r.scan_date === new Date().toISOString().split('T')[0];
              const badge = r.is_late ? { text: 'متأخر', color: R, bg: '#FFEBEE' }
                : r.verified ? { text: 'موثق', color: G, bg: '#E8F5E9' }
                : { text: 'غير موثق', color: '#888', bg: '#f5f5f5' };
              return (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: i === 0 && isToday ? '#FFF5F5' : '#fff', borderRadius: 10, padding: '10px 12px', border: '0.5px solid #e8e8e8' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: badge.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {r.is_late ? <ExIcon /> : r.verified ? <CheckSmallIcon /> : <MinusIcon />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#111' }}>{r.scan_date}</div>
                    <div style={{ fontSize: 10, color: '#888', marginTop: 1 }}>{r.scan_time} · {r.scanned_by_name}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: badge.color, background: badge.bg, padding: '2px 8px', borderRadius: 6 }}>{badge.text}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function CheckIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
}
function ClockIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
}
function PenaltyIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
}
function ExIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={R} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>;
}
function CheckSmallIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
}
function MinusIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>;
}
