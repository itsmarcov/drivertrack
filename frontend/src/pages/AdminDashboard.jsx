import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import LoadingScreen from '../components/LoadingScreen';

const G = '#1baf7a', B = '#2a78d6', R = '#e34948', A = '#eda100';
const BG = '#F4F5F7', CW = '#FFFFFF', CB = '#e8e8e8', CT = '#111', CM = '#888', CL = '#898781';

const daysRTL = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
const mRates = [82,75,90,88,60,95,78,70,85,92,65,80,73,88,91,55,79,84,68,95,72,86,90,77,63,88,82,74,69,91];

function heatColor(r) {
  if (r >= 85) return G;
  if (r >= 70) return '#63c99a';
  if (r >= 55) return A;
  if (r >= 40) return '#eb6834';
  return R;
}

function mkTrend() {
  const arr = [];
  for (let i = 0; i < 30; i++) {
    const p = Math.round(26 + Math.sin(i / 3.5) * 6 + Math.random() * 4);
    const l = Math.round(2 + Math.random() * 5);
    arr.push({ day: i, present: p, late: l, absent: 48 - p - l });
  }
  return arr;
}
const trend = mkTrend();

const perfCols = [
  { val: '91%', label: 'معدل الالتزام', delta: '↑ +2%', data: [78,82,80,85,88,91,89,91], color: G },
  { val: '76%', label: 'معدل المشاركة', delta: '↑ +3%', data: [65,68,72,70,74,76,75,76], color: B },
  { val: '187', label: 'مسح اليوم', delta: '↑ +12', data: [155,165,160,175,170,182,188,187], color: A },
];

export default function AdminDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tt, setTt] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(t);
  }, []);

  if (loading) return <LoadingScreen message="جاري تحميل لوحة التحكم..." />;

  return (
    <div dir="rtl" style={{ background: BG, minHeight: '100vh', fontFamily: 'system-ui, Segoe UI, sans-serif', padding: '28px 32px' }}>

      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '11px', color: CM, marginBottom: '2px' }}>DriverTRACK</div>
          <div style={{ fontSize: '20px', fontWeight: 500, color: CT }}>لوحة التحكم</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: CW, border: '0.5px solid #e0e0e0', borderRadius: '20px', padding: '5px 14px', fontSize: '12px', color: '#555' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span>1 يونيو – 30 يونيو 2026</span>
          <span style={{ fontSize: '8px', color: CM }}>▾</span>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <KpiCard accent={G} icon={<UsersIcon />} label="إجمالي السائقين" value="48" delta="↑ +3 هذا الشهر" deltaColor={G} />
        <KpiCard accent={B} icon={<CircleCheckIcon />} label="حاضر اليوم" value="35" delta="↑ 73% معدل الحضور" deltaColor={G} />
        <KpiCard accent={R} icon={<CircleXIcon />} label="غائب اليوم" value="13" delta="↓ 27% نسبة الغياب" deltaColor={R} />
      </div>

      {/* 2x2 Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {/* Card 1: Calendar Heatmap */}
        <div style={{ background: CW, border: '0.5px solid ' + CB, borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: CT }}>خريطة الحرارة الشهرية</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={CM} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ cursor: 'pointer', opacity: 0.5 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={CM} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ cursor: 'pointer', opacity: 0.5 }}><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
              {daysRTL.map(d => (
                <div key={d} style={{ fontSize: 9, color: CM, textAlign: 'center', fontWeight: 600, padding: '2px 0' }}>{d}</div>
              ))}
              {Array.from({ length: 2 }).map((_, i) => <div key={`p${i}`} />)}
              {mRates.map((r, i) => (
                <div key={i}
                  onMouseEnter={(e) => setTt({ x: e.clientX, y: e.clientY, day: i + 1, rate: r })}
                  onMouseLeave={() => setTt(null)}
                  style={{ height: 30, borderRadius: 4, background: heatColor(r), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 600, color: r >= 55 ? '#fff' : '#333', cursor: 'pointer', transition: 'transform .12s, box-shadow .12s' }}>
                  {i + 1}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 6, fontSize: 10, color: CM }}>
              <span>مرتفع</span>
              {[G, '#63c99a', A, '#eb6834', R].map(c => <div key={c} style={{ width: 14, height: 14, borderRadius: 3, background: c }} />)}
              <span>منخفض</span>
            </div>
          </div>
          {tt && (
            <div style={{ position: 'fixed', top: tt.y - 40, right: tt.x + 12, background: '#1F2937', color: '#fff', padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, zIndex: 1000, pointerEvents: 'none', whiteSpace: 'nowrap' }}>
              {tt.day} يونيو · {tt.rate}% حضور
            </div>
          )}
        </div>

        {/* Card 2: Donut */}
        <div style={{ background: CW, border: '0.5px solid ' + CB, borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: CT }}>الحضور حسب الحالة</span>
            <span style={{ background: '#e9f9f0', color: '#0f6e56', padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>73% حضور</span>
          </div>
          <SegmentedBar pct={[73, 10, 17]} colors={[G, A, R]} labels={['حاضر', 'متأخر', 'غائب']} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 16 }}>
            <div style={{ position: 'relative', width: 150, height: 150, flexShrink: 0 }}>
              <DonutChart values={[35, 5, 8]} colors={[G, A, R]} />
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', pointerEvents: 'none' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: CT }}>35</div>
                <div style={{ fontSize: 10, color: CM }}>حاضر</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[['حاضر', 35, '73%', G], ['متأخر', 5, '10%', A], ['غائب', 8, '17%', R]].map(([name, count, pct, color]) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: CM, minWidth: 32 }}>{name}</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: CT }}>{count}</span>
                  <span style={{ fontSize: 11, color: CM }}>({pct})</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Card 3: Trend Line */}
        <div style={{ background: CW, border: '0.5px solid ' + CB, borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: CT }}>المتجه اليومي — 30 يوم</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={CM} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ cursor: 'pointer', opacity: 0.5 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={CM} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ cursor: 'pointer', opacity: 0.5 }}><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 11, color: CM, marginBottom: 8, justifyContent: 'flex-start' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: G, display: 'inline-block' }} /> حاضر</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: A, display: 'inline-block', backgroundImage: 'repeating-linear-gradient(90deg,'+A+' 0,'+A+' 4px,transparent 4px,transparent 7px)' }} /> متأخر</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: R, display: 'inline-block' }} /> غائب</span>
          </div>
          <LineChart30 data={trend} colors={[G, A, R]} keys={['present', 'late', 'absent']} labels={['حاضر', 'متأخر', 'غائب']} />
        </div>

        {/* Card 4: Performance Details */}
        <div style={{ background: CW, border: '0.5px solid ' + CB, borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: CT }}>تفاصيل الأداء</span>
            <span style={{ background: '#e9f9f0', color: '#0f6e56', padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>هذا الأسبوع</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
            {perfCols.map((col, i) => (
              <div key={col.label} style={{ borderRight: i < 2 ? '0.5px solid ' + CB : 'none', padding: '0 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 500, color: CT }}>{col.val}</div>
                <div style={{ fontSize: 10, color: CM, marginTop: 2 }}>{col.label}</div>
                <div style={{ fontSize: 10, color: G }}>{col.delta}</div>
                <MiniSparkline data={col.data} color={col.color} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function KpiCard({ accent, icon, label, value, delta, deltaColor }) {
  return (
    <div style={{ flex: '1 1 180px', minWidth: 0, background: CW, border: '0.5px solid ' + CB, borderRadius: 12, padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: accent, borderRadius: '0 12px 12px 0' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
        <span style={{ color: CM, opacity: 0.6 }}>{icon}</span>
        <span style={{ fontSize: 11, color: CM }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 500, color: CT, lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: 11, color: deltaColor, marginTop: 2 }}>{delta}</div>
    </div>
  );
}

function SegmentedBar({ pct, colors }) {
  return (
    <div style={{ width: '100%' }}>
      <div style={{ width: '100%', height: 8, borderRadius: 6, display: 'flex', overflow: 'hidden', background: '#eee' }}>
        {pct.map((p, i) => <div key={i} style={{ width: p + '%', background: colors[i] }} />)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11, color: CM }}>
        <span>حاضر</span>
        <span>متأخر</span>
        <span>غائب</span>
      </div>
    </div>
  );
}

function DonutChart({ values, colors }) {
  const r = 62, cx = 75, cy = 75, sw = 14;
  const circ = 2 * Math.PI * r;
  const sum = values.reduce((a, b) => a + b, 0) || 1;
  let off = -circ * 0.25;
  return (
    <svg width={150} height={150} viewBox="0 0 150 150">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f0f0f0" strokeWidth={sw} />
      {values.map((v, i) => {
        if (v === 0) return null;
        const len = (v / sum) * circ;
        const o = off;
        off += len;
        return <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={colors[i]} strokeWidth={sw} strokeDasharray={`${len} ${circ - len}`} strokeDashoffset={-o} strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`} />;
      })}
    </svg>
  );
}

function LineChart30({ data, colors, keys, labels }) {
  const W = 500, H = 160, PT = 8, PB = 20, PL = 6, PR = 6;
  const cw = W - PL - PR, ch = H - PT - PB;
  const max = Math.max(...data.flatMap(d => keys.map(k => d[k])), 1);
  const xs = (i) => PL + (i / Math.max(data.length - 1, 1)) * cw;
  const ys = (v) => PT + ch - (v / max) * ch;
  const xStep = cw / Math.max(data.length - 1, 1);

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: 'block', minWidth: W }}>
        {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
          const y = PT + ch - f * ch;
          return <line key={i} x1={PL} y1={y} x2={PL + cw} y2={y} stroke="#ededea" strokeWidth="1" />;
        })}
        {keys.map((k, ki) => {
          const pts = data.map((d, i) => `${xs(i)},${ys(d[k])}`);
          const area = `${pts.join(' ')} L${xs(data.length - 1)},${PT + ch} L${xs(0)},${PT + ch} Z`;
          return (
            <g key={k}>
              <path d={area} fill={colors[ki]} opacity="0.05" />
              <path d={`M${pts.join(' L')}`} fill="none" stroke={colors[ki]} strokeWidth={2} strokeDasharray={ki === 1 ? '5 3' : 'none'} strokeLinecap="round" strokeLinejoin="round" />
            </g>
          );
        })}
        <text x={xs(0)} y={H - 2} textAnchor="middle" fontSize={9} fill={CL}>منذ 30 يوم</text>
        <text x={xs(29)} y={H - 2} textAnchor="middle" fontSize={9} fill={CL}>اليوم</text>
        {/* Hover tooltip for last point */}
        {data.length > 0 && (
          <g>
            <rect x={xs(29) - 28} y={PT - 2} width={56} height={20} rx={6} fill="#1F2937" opacity="0.9" />
            <text x={xs(29)} y={PT + 12} textAnchor="middle" fontSize={9} fill="#fff" fontWeight={600}>
              {labels[0]} {data[29].present} | {labels[1]} {data[29].late} | {labels[2]} {data[29].absent}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

function MiniSparkline({ data, color }) {
  const w = 120, h = 40;
  const pad = 2;
  const cw = w - pad * 2, ch = h - pad * 2;
  const mx = Math.max(...data, 1);
  const pts = data.map((v, i) => `${pad + (i / (data.length - 1 || 1)) * cw},${pad + ch - (v / mx) * ch}`);
  const area = `M${pts[0]} L${pts.slice(1).join(' L')} L${pad + cw},${pad + ch} L${pad},${pad + ch} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', marginTop: 6 }}>
      <path d={area} fill={color} opacity="0.1" />
      <path d={`M${pts.join(' L')}`} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1].split(',')[0]} cy={pts[pts.length - 1].split(',')[1]} r="2.5" fill={color} stroke={CW} strokeWidth="1.5" />
    </svg>
  );
}

function UsersIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}
function CircleCheckIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
}
function CircleXIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>;
}
