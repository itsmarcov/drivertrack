import { useState } from 'react';
import LoadingScreen from '../components/LoadingScreen';

const G = '#22C55E', O = '#F97316', R = '#EF4444', B5 = '#F0F2F5', W = '#FFFFFF', T = '#111827', M = '#6B7280';

const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const d = new Date();
const curYear = d.getFullYear();
const curMonth = d.getMonth();
const daysInMonth = new Date(curYear, curMonth + 1, 0).getDate();
const firstDow = new Date(curYear, curMonth, 1).getDay();

function mkHeat(rate) {
  if (rate >= 90) return G;
  if (rate >= 75) return '#4ADE80';
  if (rate >= 60) return '#FDE047';
  if (rate >= 40) return '#FB923C';
  return R;
}

function seedTrend() {
  const arr = [];
  let p = 28;
  for (let i = 29; i >= 0; i--) {
    const v = Math.max(22, Math.min(42, p + Math.round(Math.random() * 6 - 3)));
    arr.push({ day: i, present: v, late: Math.max(0, Math.round(Math.random() * 5 - 1)), absent: 48 - v });
    p = v;
  }
  return arr;
}
const trend = seedTrend();

function heatData() {
  const arr = [];
  for (let i = 1; i <= daysInMonth; i++) {
    const t = trend[Math.min(i - 1, trend.length - 1)];
    arr.push({ day: i, rate: Math.round((t.present / 48) * 100) });
  }
  return arr;
}
const heat = heatData();

const KPIS = [
  { label: 'Total Drivers', value: '48', sub: 'Active accounts', color: '#3B82F6' },
  { label: 'Present Today', value: '35', sub: '73% attendance', color: G },
  { label: 'Absent Today', value: '13', sub: '27% today', color: R },
];

export default function AnalyticsDashboard() {
  const [loading] = useState(false);
  const [tooltip, setTooltip] = useState(null);

  if (loading) return <LoadingScreen message="Loading analytics..." />;

  const WVAL = typeof window !== 'undefined' ? Math.min(window.innerWidth - 40, 1200) : 1200;
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <div style={{ background: B5, minHeight: '100vh', fontFamily: 'Inter, sans-serif', padding: isMobile ? '12px' : '24px' }}>

      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={T} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: T, letterSpacing: '-0.3px' }}>Dashboard</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: W, borderRadius: '8px', padding: '4px 12px', fontSize: '13px', color: M, border: '1px solid #E5E7EB' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={M} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span>Jun 1 – Jun 30, 2026</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={M} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>

        {/* KPI row */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {KPIS.map(k => (
            <div key={k.label} style={{ background: W, borderRadius: '12px', padding: '8px 20px 8px 16px', display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid #E5E7EB' }}>
              <div style={{ width: '4px', height: '36px', borderRadius: '4px', background: k.color }} />
              <div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: T, lineHeight: 1.2 }}>{k.value}</div>
                <div style={{ fontSize: '11px', color: M, fontWeight: 500 }}>{k.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2x2 Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px' }}>

        {/* Card 1: Donut */}
        <div style={{ background: W, borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: T }}>Attendance by Status</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={M} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ cursor: 'pointer', opacity: 0.6 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={M} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ cursor: 'pointer', opacity: 0.6 }}><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Donut present={35} late={0} absent={13} total={48} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Legend dot={G} label="Present" value="35" pct="73%" />
              <Legend dot={R} label="Absent" value="13" pct="27%" />
            </div>
          </div>
        </div>

        {/* Card 2: Calendar Heatmap */}
        <div style={{ background: W, borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: T }}>Attendance Heatmap</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={M} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ cursor: 'pointer', opacity: 0.6 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={M} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ cursor: 'pointer', opacity: 0.6 }}><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px', width: '100%' }}>
              {days.map(d => <div key={d} style={{ fontSize: '9px', color: M, textAlign: 'center', fontWeight: 600, padding: '2px 0' }}>{d}</div>)}
              {Array.from({ length: firstDow }).map((_, i) => <div key={`pad-${i}`} />)}
              {heat.map(h => (
                <div key={h.day}
                  onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY, day: h.day, rate: h.rate })}
                  onMouseLeave={() => setTooltip(null)}
                  style={{ aspectRatio: '1', borderRadius: '4px', background: mkHeat(h.rate), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 600, color: h.rate >= 60 ? '#fff' : '#333', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}>
                  {h.day}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '10px', color: M }}>
              <span>Low</span>
              {[R, '#FB923C', '#FDE047', '#4ADE80', G].map(c => <div key={c} style={{ width: 14, height: 14, borderRadius: 3, background: c }} />)}
              <span>High</span>
            </div>
          </div>
          {tooltip && (
            <div style={{ position: 'fixed', top: tooltip.y - 44, left: tooltip.x + 12, background: '#1F2937', color: '#fff', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, zIndex: 1000, pointerEvents: 'none', whiteSpace: 'nowrap' }}>
              {monthNames[curMonth]} {tooltip.day} — {tooltip.rate}% attendance
            </div>
          )}
        </div>

        {/* Card 3: Details Strip */}
        <div style={{ background: W, borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: T }}>Details Strip</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={M} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ cursor: 'pointer', opacity: 0.6 }}><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            <FunnelBox label="Total Scans Today" value="187" sub="+12 vs yesterday" color={G} />
            <FunnelBox label="Engagement Rate" value="76%" sub="+3% this week" color={O} />
            <FunnelBox label="On-Time Rate" value="91%" sub="-2% this week" color={R} />
          </div>
        </div>

        {/* Card 4: Daily Trend */}
        <div style={{ background: W, borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: T }}>Daily Trend</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={M} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ cursor: 'pointer', opacity: 0.6 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={M} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ cursor: 'pointer', opacity: 0.6 }}><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: M, marginBottom: '8px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 3, borderRadius: 2, background: G, display: 'inline-block' }} /> Present</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 3, borderRadius: 2, background: O, display: 'inline-block' }} /> Late</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 3, borderRadius: 2, background: R, display: 'inline-block' }} /> Absent</span>
          </div>
          <TrendChart data={trend} colors={[G, O, R]} keys={['present', 'late', 'absent']} />
        </div>
      </div>
    </div>
  );
}

/* ── Pure SVG Sub-Components ── */

function Donut({ present, late, absent, total }) {
  const r = 70, cx = 100, cy = 100, sw = 18;
  const circ = 2 * Math.PI * r;
  const vals = [present, late, absent];
  const colors = [G, O, R];
  const sum = vals.reduce((a, b) => a + b, 0) || 1;
  let offset = -circ * 0.25;
  const slices = vals.map((v, i) => {
    const len = (v / sum) * circ;
    const s = offset;
    offset += len;
    return { len, offset: s, color: colors[i] };
  });

  return (
    <svg width="200" height="200" viewBox="0 0 200 200">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F3F4F6" strokeWidth={sw} />
      {slices.map((s, i) =>
        s.len > 0 && (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={sw}
            strokeDasharray={`${s.len} ${circ - s.len}`} strokeDashoffset={-s.offset}
            strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`} />
        )
      )}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="28" fontWeight="800" fill={T}>{present}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize="10" fontWeight="600" fill={M}>Present</text>
    </svg>
  );
}

function Legend({ dot, label, value, pct }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: dot, flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: '11px', color: M, fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: '16px', fontWeight: 700, color: T }}>{value} <span style={{ fontSize: '11px', fontWeight: 500, color: M }}>({pct})</span></div>
      </div>
    </div>
  );
}

function FunnelBox({ label, value, sub, color }) {
  const w = 160, h = 34;
  const p1 = { x: 0, y: h }, p2 = { x: 20, y: 2 }, p3 = { x: 50, y: 0 }, p4 = { x: 80, y: 4 }, p5 = { x: 110, y: 2 }, p6 = { x: 140, y: 10 }, p7 = { x: w, y: h };
  const path = `M${p1.x},${p1.y} Q${p2.x},${p2.y} ${p3.x},${p3.y} T${p4.x},${p4.y} T${p5.x},${p5.y} T${p6.x},${p6.y} T${p7.x},${p7.y}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
      <div style={{ fontSize: '20px', fontWeight: 800, color: T }}>{value}</div>
      <div style={{ fontSize: '10px', color: M, fontWeight: 500, marginBottom: '4px' }}>{label}</div>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
        <defs>
          <linearGradient id={`fg-${label}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="50%" stopColor={color} stopOpacity="0.15" />
            <stop offset="100%" stopColor={color} stopOpacity="0.04" />
          </linearGradient>
        </defs>
        <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
        <path d={`${path} L${p7.x},${h} L${p1.x},${h} Z`} fill={`url(#fg-${label})`} />
      </svg>
      <div style={{ fontSize: '9px', color: M, marginTop: '2px' }}>{sub}</div>
    </div>
  );
}

function TrendChart({ data, colors, keys }) {
  const W = 500, H = 180, PT = 12, PB = 24, PL = 8, PR = 8;
  const cw = W - PL - PR, ch = H - PT - PB;
  const max = Math.max(...data.flatMap(d => keys.map(k => d[k])), 1);
  const xStep = cw / Math.max(data.length - 1, 1);

  function line(key, color) {
    const pts = data.map((d, i) => {
      const x = PL + i * xStep;
      const y = PT + ch - (d[key] / max) * ch;
      return `${x},${y}`;
    });
    return pts;
  }

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: 'block', minWidth: W }}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
          const y = PT + ch - f * ch;
          return <line key={i} x1={PL} y1={y} x2={PL + cw} y2={y} stroke="#F3F4F6" strokeWidth="1" />;
        })}
        {/* Lines */}
        {keys.map((k, ki) => {
          const pts = line(k, colors[ki]);
          const areaPts = `${pts.join(' ')} L${PL + cw},${PT + ch} L${PL},${PT + ch} Z`;
          return (
            <g key={k}>
              <path d={`M${pts.join(' L')}`} fill="none" stroke={colors[ki]} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d={areaPts} fill={colors[ki]} opacity="0.06" />
              {/* Dot on last point */}
              <circle cx={pts[pts.length - 1].split(',')[0]} cy={pts[pts.length - 1].split(',')[1]} r="3" fill={colors[ki]} stroke="#fff" strokeWidth="2" />
            </g>
          );
        })}
        {/* X-axis labels */}
        {[0, 7, 14, 21, 29].map(i => (
          <text key={i} x={PL + i * xStep} y={H - 4} textAnchor="middle" fontSize="9" fill={M}>
            {i === 29 ? 'Today' : `${30 - i}d ago`}
          </text>
        ))}
        {/* Tooltip on hover for last point */}
        {data.length > 0 && (() => {
          const last = data[data.length - 1];
          const prev = data.length > 1 ? data[data.length - 2] : last;
          const lx = PL + (data.length - 1) * xStep;
          const lxs = [PL + (data.length - 1) * xStep + 10, PT + 4];
          return (
            <g>
              <rect x={lx - 38} y={PT - 4} width="80" height="24" rx="6" fill="#1F2937" opacity="0.9" />
              <text x={lx - 20} y={PT + 7} textAnchor="middle" fontSize="9" fill="#fff" fontWeight="600">
                P{last.present} L{last.late} A{last.absent}
              </text>
              {keys.map((k, ki) => {
                const change = last[k] - prev[k];
                return (
                  <text key={k} x={PL + cw + 6} y={PT + 14 + ki * 16} fontSize="10" fill={colors[ki]} fontWeight="600">
                    {k}: {change > 0 ? '+' : ''}{change}
                  </text>
                );
              })}
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
