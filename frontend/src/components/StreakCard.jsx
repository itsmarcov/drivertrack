import { useState, useEffect } from 'react';

const MILESTONES = [
  { n: 7, icon: '🔥', label: 'أسبوع' },
  { n: 14, icon: '📅', label: 'أسبوعين' },
  { n: 30, icon: '🗓️', label: 'شهر' },
  { n: 60, icon: '🏅', label: 'شهرين' },
  { n: 100, icon: '🏆', label: 'مئة يوم' },
];

function messageFor(s) {
  if (s.streak === 0) {
    if (s.dead) return `انتهت سلسلة الحضور. كانت قد وصلت إلى ${s.best_streak} يوم متواصل`;
    if (s.total_days > 0) return `آخر تسجيل حضور كان قبل ${s.days_since_last} يوم. سجّل حضورك غداً لبدء سلسلة جديدة`;
    return 'لم يتم تسجيل أي حضور بعد. سجّل حضورك غداً لبدء سلسلة الحضور';
  }
  if (s.streak === 1) return 'تم تسجيل حضور يوم واحد. استمر غداً لمواصلة السلسلة';
  if (s.streak === 7) return 'تم تحقيق سلسلة حضور أسبوع كامل';
  if (s.streak === 14) return 'تم تحقيق سلسلة حضور أسبوعين متتاليين';
  if (s.streak === 21) return 'تم تحقيق سلسلة حضور 21 يوم متتالي';
  if (s.streak === 30) return 'تم تحقيق سلسلة حضور شهر كامل';
  if (s.streak === 60) return 'تم تحقيق سلسلة حضور شهرين متتاليين';
  if (s.streak === 100) return 'تم تحقيق سلسلة حضور 100 يوم متتالي';
  return `سلسلة حضور متواصلة منذ ${s.streak} يوم`;
}

export default function StreakCard({ data, compact }) {
  const s = data || {};
  const streak = s.streak || 0;
  const best = s.best_streak || 0;
  const [celebrated, setCelebrated] = useState(null);

  useEffect(() => {
    if (streak === 0) return;
    try {
      const key = 'dt_last_streak';
      const prev = parseInt(localStorage.getItem(key) || '0', 10);
      const crossed = MILESTONES.find((m) => prev < m.n && streak >= m.n);
      if (crossed) setCelebrated(crossed);
      localStorage.setItem(key, String(streak));
    } catch (_) {}
  }, [streak]);

  const next = MILESTONES.find((m) => m.n > streak) || null;
  const progress = next ? Math.min(streak / next.n, 1) : 1;
  const flameSize = compact ? 26 : Math.min(34 + streak * 2.2, 72);
  const state = s.at_risk ? 'risk' : streak === 0 && s.dead ? 'dead' : streak === 0 ? 'cold' : 'on';

  return (
    <div className={`streak-card streak-${state}${compact ? ' streak-compact' : ''}`}>
      <div className="streak-main">
        <div className="streak-flame" style={{ fontSize: flameSize }}>
          {s.at_risk ? '⏳' : streak > 0 ? '🔥' : '📋'}
        </div>
        <div className="streak-meta">
          <div className="streak-count">{streak}</div>
          <div className="streak-label">{streak === 1 ? 'يوم حضور متواصل' : streak > 1 ? 'أيام حضور متواصلة' : 'لا توجد سلسلة'}</div>
        </div>
        <div className="streak-best">
          <div className="streak-best-num">{best}</div>
          <div className="streak-best-label">أطول سلسلة</div>
        </div>
      </div>

      <div className="streak-msg">{messageFor(s)}</div>

      {next && streak > 0 && (
        <div className="streak-progress">
          <div className="streak-progress-head">
            <span>المرحلة القادمة: {next.icon} {next.label}</span>
            <span>{streak}/{next.n}</span>
          </div>
          <div className="streak-progress-bar">
            <div className="streak-progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        </div>
      )}

      <div className="streak-milestones">
        {MILESTONES.map((m) => {
          const done = streak >= m.n;
          return (
            <div key={m.n} className={`streak-chip ${done ? 'done' : ''}`} title={m.label}>
              <span>{done ? m.icon : '🔒'}</span>
              <small>{m.n}</small>
            </div>
          );
        })}
      </div>

      <div className="streak-footer">
        <span>حضور هذا الشهر: {s.month_days || 0} / {s.month_total || 30} يوم</span>
        {s.today_scanned ? <span className="streak-today">اليوم ✔</span> : <span className="streak-today no">اليوم ما زال ✘</span>}
      </div>

      {celebrated && (
        <div className="streak-celebration">
          🎉 إنجاز جديد! تم تحقيق سلسلة {celebrated.label} من الحضور المتواصل ({celebrated.n} يوم)
        </div>
      )}
    </div>
  );
}
