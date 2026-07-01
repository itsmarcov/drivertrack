import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { attendance, analytics as analyticsApi } from '../api';
import LoadingScreen from '../components/LoadingScreen';

const G = '#1baf7a', B = '#2a78d6', R = '#e34948', A = '#eda100';

const daysRTL = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

const rangeOptions = [
  { value: 'today', label: 'اليوم' },
  { value: 'week', label: 'هذا الأسبوع' },
  { value: 'month', label: 'هذا الشهر' },
  { value: 'custom', label: 'مخصص' },
];

function fmtDate(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function AnimatedCard({ i, children, style, className }) {
  return <div className={'fade-slide-in' + (className ? ' ' + className : '')} style={{ animationDelay: `${i * 0.07}s`, ...style }}>{children}</div>;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const { dark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [stats, setStats] = useState(null);
  const [range, setRange] = useState('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [tt, setTt] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [filterKey, setFilterKey] = useState(0);
  const mounted = useRef(true);

  const getParams = useCallback(() => {
    if (range === 'week') return { days: 7 };
    if (range === 'month') return { days: 30 };
    if (range === 'custom' && customFrom) {
      const p = { from: customFrom };
      if (customTo) p.to = customTo;
      return p;
    }
    return {};
  }, [range, customFrom, customTo]);

  const fetchData = useCallback(async () => {
    const params = getParams();
    const isToday = Object.keys(params).length === 0;
    try {
      if (isToday) {
        const a = await analyticsApi.get({});
        if (mounted.current) setAnalytics(a);
      } else {
        const a = await analyticsApi.get(params);
        if (mounted.current) { setAnalytics(a); setStats(null); }
      }
    } catch {}
    try {
      if (isToday) {
        const s = await attendance.stats();
        if (mounted.current) setStats(s);
      }
    } catch {}
  }, [getParams]);

  useEffect(() => {
    mounted.current = true;
    fetchData();
    return () => { mounted.current = false; };
  }, [fetchData]);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    setFilterKey(n => n + 1);
  }, [range, customFrom, customTo]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = {};
      if (range === 'today') params.date = fmtDate(new Date());
      else if (range === 'custom' && customFrom) {
        params.date_from = customFrom;
        params.date_to = customTo || customFrom;
      }
      const blob = await attendance.exportExcel(params);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance-${range}-${fmtDate(new Date())}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
    setExporting(false);
  };

  const isToday = range === 'today';
  const totalDrivers = Number(stats?.total_drivers ?? analytics?.total_drivers ?? 0) || 0;
  const presentToday = Number(analytics?.attendance_today ?? stats?.present_today ?? 0) || 0;
  const absentToday = Math.max(Number(analytics?.absence_today) || 0, totalDrivers - presentToday);
  const presentPct = totalDrivers > 0 ? Math.round((presentToday / totalDrivers) * 100) : 0;
  const lateToday = Number(stats?.late_today) || 0;

  const attOverTime = analytics?.attendance_over_time ?? [];
  const chartData = attOverTime.map((d, i) => ({
    day: i, date: d.date, present: Number(d.attendance) || 0, absent: Number(d.absences) || 0,
  }));

  const chartDays = chartData.length;
  const lastIdx = chartData.length - 1;
  const perfCols = [
    { val: analytics?.stations_best_attendance?.[0]?.on_time != null ? analytics.stations_best_attendance[0].on_time + '/' + analytics.stations_best_attendance[0].total : '—', label: 'أفضل محطة التزام', delta: analytics?.stations_best_attendance?.[0]?.name ?? '—', color: G },
    { val: analytics?.peak_scan_hours?.[0]?.hour ?? '—', label: 'ذروة المسح', delta: analytics?.peak_scan_hours?.[0]?.count != null ? analytics.peak_scan_hours[0].count + ' مسح' : '—', color: A },
    { val: lastIdx >= 0 && chartData[lastIdx]?.present > 0 ? chartData[lastIdx].present : '—', label: range === 'today' ? 'حضور اليوم' : 'آخر يوم في الفترة', delta: lastIdx > 0 && chartData[lastIdx - 1]?.present > 0 ? 'قبل: ' + chartData[lastIdx - 1].present : '—', color: B },
  ];

  if (loading) return <LoadingScreen message="جاري تحميل لوحة التحكم..." />;

  const bg = dark ? '#17171A' : '#F4F5F7';
  const cardBg = dark ? '#232329' : '#FFFFFF';
  const cardBorder = dark ? '#2E2E36' : '#e8e8e8';
  const textPri = dark ? '#EDEDEE' : '#111';
  const textSec = dark ? '#888892' : '#888';
  const badgeBg = dark ? '#1E3A2E' : '#e9f9f0';
  const badgeText = dark ? '#4ADE80' : '#0f6e56';
  const segmentBg = dark ? '#2E2E36' : '#eee';
  const svgGrid = dark ? '#2E2E36' : '#ededea';
  const svgDonutBg = dark ? '#2E2E36' : '#f0f0f0';
  const tooltipBg = dark ? '#393943' : '#1F2937';
  const selectBg = dark ? '#232329' : '#FFFFFF';
  const selectColor = dark ? '#A0A0AB' : '#555';

  const rangeLabel = rangeOptions.find(o => o.value === range)?.label ?? 'اليوم';

  return (
    <div dir="rtl" className="admin-dash" style={{ background: bg, fontFamily: 'system-ui, Segoe UI, sans-serif' }}>

      {/* Top bar */}
      <AnimatedCard i={0} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '11px', color: textSec, marginBottom: '2px' }}>DriverTRACK</div>
          <div style={{ fontSize: '20px', fontWeight: 500, color: textPri }}>لوحة التحكم</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <select value={range} onChange={e => setRange(e.target.value)}
              style={{ background: selectBg, border: '0.5px solid ' + cardBorder, borderRadius: '8px', padding: '6px 10px', fontSize: '12px', color: selectColor, cursor: 'pointer', outline: 'none' }}>
              {rangeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {range === 'custom' && (
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                  style={{ background: selectBg, border: '0.5px solid ' + cardBorder, borderRadius: '8px', padding: '5px 8px', fontSize: '11px', outline: 'none', color: selectColor }} />
                <span style={{ fontSize: '11px', color: textSec }}>—</span>
                <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                  style={{ background: selectBg, border: '0.5px solid ' + cardBorder, borderRadius: '8px', padding: '5px 8px', fontSize: '11px', outline: 'none', color: selectColor }} />
              </div>
            )}
          </div>
          <button onClick={handleExport} disabled={exporting}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', background: cardBg, border: '0.5px solid ' + cardBorder, borderRadius: '8px', padding: '5px 12px', fontSize: '12px', color: selectColor, cursor: 'pointer', opacity: exporting ? 0.6 : 1 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            {exporting ? 'جاري التصدير...' : 'تصدير Excel'}
          </button>
        </div>
      </AnimatedCard>

      {/* KPI row */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <KpiCard i={1} dark={dark} accent={G} icon={<UsersIcon />} label="إجمالي السائقين" value={totalDrivers} delta={'إجمالي المسجلين'} deltaColor={textSec} />
        <KpiCard i={2} dark={dark} accent={B} icon={<CircleCheckIcon />} label={'حاضر - ' + rangeLabel} value={presentToday} delta={`${presentPct}% من ${totalDrivers}`} deltaColor={G} />
        <KpiCard i={3} dark={dark} accent={R} icon={<CircleXIcon />} label={'غائب - ' + rangeLabel} value={absentToday} delta={`${100 - presentPct}% من ${totalDrivers}`} deltaColor={R} />
      </div>

      {/* 2x2 Grid — key forces re-mount + animation on filter change */}
      <div key={filterKey} className="admin-dash-grid">

        {/* Card 1: Calendar Heatmap */}
        <AnimatedCard i={4} className="card-hover" style={{ background: cardBg, border: '0.5px solid ' + cardBorder, borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: textPri }}>معدل الحضور — {rangeLabel}</span>
            <span style={{ background: badgeBg, color: badgeText, padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{presentPct}% حضور</span>
          </div>
          <CalendarHeatmap data={chartData} range={range} presentPct={presentPct} onHover={setTt} dark={dark} totalDrivers={totalDrivers} />
          {tt && (
            <div style={{ position: 'fixed', top: tt.y - 40, right: tt.x + 12, background: tooltipBg, color: '#fff', padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, zIndex: 1000, pointerEvents: 'none', whiteSpace: 'nowrap' }}>
              {tt.day} · {tt.rate}% حضور
            </div>
          )}
        </AnimatedCard>

        {/* Card 2: Donut */}
        <AnimatedCard i={5} className="card-hover" style={{ background: cardBg, border: '0.5px solid ' + cardBorder, borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: textPri }}>الحضور حسب الحالة</span>
            <span style={{ background: badgeBg, color: badgeText, padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{presentPct}% حضور</span>
          </div>
          <SegmentedBar pct={[presentPct, Math.max(Math.round((lateToday / (totalDrivers || 1)) * 100), 0), Math.max(100 - presentPct - Math.round((lateToday / (totalDrivers || 1)) * 100), 0)]} colors={[G, A, R]} bg={segmentBg} />
          <div className="dash-donut-row">
            <div className="dash-donut-wrap">
              <DonutChart values={[Math.max(presentToday, 0), Math.max(lateToday, 0), Math.max(absentToday, 0)]} colors={[G, A, R]} donutBg={svgDonutBg} />
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', pointerEvents: 'none' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: textPri }}>{presentToday}</div>
                <div style={{ fontSize: 10, color: textSec }}>حاضر</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[['حاضر', presentToday, presentPct + '%', G], ['متأخر', lateToday, (totalDrivers > 0 ? Math.round((lateToday / totalDrivers) * 100) : 0) + '%', A], ['غائب', absentToday, (totalDrivers > 0 ? Math.round((absentToday / totalDrivers) * 100) : 0) + '%', R]].map(([name, count, pct, color]) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: textSec, minWidth: 32 }}>{name}</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: textPri }}>{count}</span>
                  <span style={{ fontSize: 11, color: textSec }}>({pct})</span>
                </div>
              ))}
            </div>
          </div>
        </AnimatedCard>

        {/* Card 3: Trend Line — hidden for today */}
        {range !== 'today' && (
        <AnimatedCard i={6} className="card-hover" style={{ background: cardBg, border: '0.5px solid ' + cardBorder, borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: textPri }}>مؤشر الحضور — {chartDays} يوم</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: textSec }}><span style={{ width: 10, height: 3, borderRadius: 2, background: G, display: 'inline-block' }} /> حاضر</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: textSec }}><span style={{ width: 10, height: 3, borderRadius: 2, background: R, display: 'inline-block' }} /> غائب</span>
            </div>
          </div>
          {chartData.length > 0 ? (
            <LineChart14 data={chartData} colors={[G, R]} keys={['present', 'absent']} labels={['حاضر', 'غائب']} gridColor={svgGrid} textColor={textSec} tooltipBg={tooltipBg} />
          ) : (
            <div style={{ textAlign: 'center', padding: '30px 0', fontSize: 12, color: textSec }}>لا توجد بيانات كافية</div>
          )}
        </AnimatedCard>
        )}

        {/* Card 4: Performance Details — full width when trend hidden */}
        <AnimatedCard i={7} className="card-hover" style={{ background: cardBg, border: '0.5px solid ' + cardBorder, borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: textPri }}>تفاصيل الأداء</span>
            <span style={{ background: badgeBg, color: badgeText, padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{rangeLabel}</span>
          </div>
          <div className="admin-dash-perf">
            {perfCols.map((col, i) => (
              <div key={col.label} style={{ borderRight: i < 2 ? '0.5px solid ' + cardBorder : 'none', padding: '0 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 500, color: textPri }}>{col.val}</div>
                <div style={{ fontSize: 10, color: textSec, marginTop: 2 }}>{col.label}</div>
                <div style={{ fontSize: 10, color: col.color }}>{col.delta}</div>
              </div>
            ))}
          </div>
        </AnimatedCard>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function KpiCard({ i, dark, accent, icon, label, value, delta, deltaColor }) {
  const bg = dark ? '#232329' : '#FFFFFF';
  const border = dark ? '#2E2E36' : '#e8e8e8';
  const textSec = dark ? '#888892' : '#888';
  const textPri = dark ? '#EDEDEE' : '#111';
  return (
    <AnimatedCard i={i} style={{ flex: '1 1 180px', minWidth: 0, background: bg, border: '0.5px solid ' + border, borderRadius: 12, padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: accent, borderRadius: '0 12px 12px 0' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
        <span style={{ color: textSec, opacity: 0.6 }}>{icon}</span>
        <span style={{ fontSize: 11, color: textSec }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 500, color: textPri, lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: 11, color: deltaColor, marginTop: 2 }}>{delta}</div>
    </AnimatedCard>
  );
}

function SegmentedBar({ pct, colors, bg }) {
  return (
    <div style={{ width: '100%' }}>
      <div style={{ width: '100%', height: 8, borderRadius: 6, display: 'flex', overflow: 'hidden', background: bg }}>
        {pct.map((p, i) => <div key={i} style={{ width: Math.max(p, 0) + '%', background: colors[i], transition: 'width 0.8s ease' }} />)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11, color: '#888892' }}>
        <span>حاضر</span>
        <span>متأخر</span>
        <span>غائب</span>
      </div>
    </div>
  );
}

function DonutChart({ values, colors, donutBg }) {
  const r = 62, cx = 75, cy = 75, sw = 14;
  const circ = 2 * Math.PI * r;
  const sum = values.reduce((a, b) => a + b, 0) || 1;
  let off = -circ * 0.25;
  return (
    <svg width={150} height={150} viewBox="0 0 150 150">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={donutBg} strokeWidth={sw} />
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

function CalendarHeatmap({ data, range, presentPct, onHover, dark, totalDrivers }) {
  const textSec = dark ? '#888892' : '#888';
  const defTextCol = (r) => r >= 55 ? '#fff' : (dark ? '#CCC' : '#333');
  const hc = (v, max) => {
    if (max === 0) return '#e0e0e0';
    const r = (v / max) * 100;
    return r >= 85 ? G : r >= 70 ? '#63c99a' : r >= 55 ? A : r >= 40 ? '#eb6834' : R;
  };

  if (range === 'today') {
    const maxA = totalDrivers;
    const rate = maxA > 0 ? Math.round((presentPct / 100) * maxA) : 0;
    const pctVal = presentPct;
    const color = hc(rate, maxA);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%' }}>
          <div style={{ width: 80, height: 80, borderRadius: 12, background: color, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: pctVal >= 55 ? '#fff' : '#333', flexShrink: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{rate}</div>
            <div style={{ fontSize: 9 }}>حاضر</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 500, color: dark ? '#EDEDEE' : '#111' }}>{pctVal}%</div>
            <div style={{ fontSize: 11, color: textSec, marginTop: 2 }}>معدل الحضور اليوم</div>
            <div style={{ width: '100%', height: 6, borderRadius: 4, background: dark ? '#2E2E36' : '#eee', marginTop: 6, overflow: 'hidden' }}>
              <div style={{ width: pctVal + '%', height: '100%', background: color, borderRadius: 4, transition: 'width 0.8s ease' }} />
            </div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: textSec, textAlign: 'center' }}>{totalDrivers} سائق — {Math.round((100 - pctVal) * totalDrivers / 100)} غائب</div>
      </div>
    );
  }

  // Multi-day view: build rows from data
  const rows = [];
  let row = [];
  // pad first row to align with day-of-week
  const firstDate = new Date(data[0]?.date || new Date());
  const pad = firstDate.getDay(); // 0=Sun, 6=Sat — RTL means we want right-side alignment
  // In RTL, the grid starts with Sunday (أحد) on the right
  // pad days before the first date
  for (let i = 0; i < pad; i++) row.push(null);
  const maxV = Math.max(...data.map(d => d.present), 1);
  data.forEach((d) => {
    row.push(d);
    if (row.length === 7) { rows.push(row); row = []; }
  });
  if (row.length > 0) rows.push(row);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
        {daysRTL.map(d => (
          <div key={d} style={{ fontSize: 9, color: textSec, textAlign: 'center', fontWeight: 600, padding: '2px 0' }}>{d}</div>
        ))}
        {rows.flat().map((cell, i) => {
          if (!cell) return <div key={`e${i}`} />;
          const dayNum = new Date(cell.date).getDate();
          const rate = maxV > 0 ? (cell.present / maxV) * 100 : 0;
          const c = hc(cell.present, maxV);
          return (
            <div key={cell.date}
              onMouseEnter={(e) => onHover({ x: e.clientX, y: e.clientY, day: dayNum, rate: Math.round(rate) })}
              onMouseLeave={() => onHover(null)}
              style={{ height: 30, borderRadius: 4, background: c, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 600, color: rate >= 55 ? '#fff' : '#333', cursor: 'pointer', transition: 'transform .12s, box-shadow .12s' }}>
              {dayNum}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 6, fontSize: 10, color: textSec }}>
        <span>مرتفع</span>
        {[G, '#63c99a', A, '#eb6834', R].map(c => <div key={c} style={{ width: 14, height: 14, borderRadius: 3, background: c }} />)}
        <span>منخفض</span>
      </div>
    </div>
  );
}

function LineChart14({ data, colors, keys, gridColor, textColor, tooltipBg }) {
  const W = 500, H = 160, PT = 8, PB = 20, PL = 6, PR = 6;
  const cw = W - PL - PR, ch = H - PT - PB;
  const max = Math.max(...data.flatMap(d => keys.map(k => d[k])), 1);
  const xs = (i) => PL + (i / Math.max(data.length - 1, 1)) * cw;
  const ys = (v) => PT + ch - (v / max) * ch;
  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: 'block', minWidth: W }}>
        {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
          const y = PT + ch - f * ch;
          return <line key={i} x1={PL} y1={y} x2={PL + cw} y2={y} stroke={gridColor} strokeWidth="1" />;
        })}
        {keys.map((k, ki) => {
          const pts = data.map((d, i) => `${xs(i)},${ys(d[k])}`);
          const area = `${pts.join(' ')} L${xs(data.length - 1)},${PT + ch} L${xs(0)},${PT + ch} Z`;
          return (
            <g key={k}>
              <path d={area} fill={colors[ki]} opacity="0.05" />
              <path d={`M${pts.join(' L')}`} fill="none" stroke={colors[ki]} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              {data.length > 0 && (
                <circle cx={pts[pts.length - 1].split(',')[0]} cy={pts[pts.length - 1].split(',')[1]} r="3" fill={colors[ki]} stroke="#fff" strokeWidth="2" />
              )}
            </g>
          );
        })}
        {data.length > 0 && (
          <g>
            <rect x={xs(data.length - 1) - 28} y={PT - 2} width={70} height={20} rx={6} fill={tooltipBg} opacity="0.95" />
            <text x={xs(data.length - 1)} y={PT + 12} textAnchor="middle" fontSize={9} fill="#fff" fontWeight={600}>
              {data[data.length - 1].present} حاضر | {data[data.length - 1].absent} غائب
            </text>
          </g>
        )}
      </svg>
    </div>
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
