import { useState, useEffect } from 'react';

const MILESTONES = [
  { n: 7, icon: '🔥', label: 'أسبوع' },
  { n: 14, icon: '🐐', label: 'أسبوعين' },
  { n: 30, icon: '👑', label: 'شهر' },
  { n: 60, icon: '🦸', label: 'شهرين' },
  { n: 100, icon: '🏆', label: 'مئة يوم' },
];

function messageFor(s) {
  if (s.streak === 0) {
    if (s.dead) return `💀 النار طفات! كان عندك شريط ${s.best_streak} يوم... ابدا من الصفر يا بطل`;
    if (s.total_days > 0) return `⚠️ آخر حضور كان من ${s.days_since_last} يوم... النار تبرد. سجّل بكري غدوة`;
    return '🌱 ما زال ما بديتش النار. سجّل حضورك هذا الصباح واشعلها!';
  }
  if (s.streak === 1) return '🔥 شرارة اليوم الأول! حافظ عليها — غدوة تزيد تولع';
  if (s.streak === 2) return '🔥 نار في مهدها! يومين متواصلين. كمّل ما تفرطش';
  if (s.streak === 3) return '🔥🔥 3 أيام! راهي تولع مليح، لا تروح تضربها مية';
  if (s.streak === 4) return '4 أيام نار! حتى الماتور ديال البوسطة ما يصبرش قدك';
  if (s.streak === 5) return '🚗 5 أيام! الزيت والقعدة... نقصد الحضور دايم';
  if (s.streak === 6) return '6 أيام! بكرا يكون عندك أسبوع كامل مشتعل 💪';
  if (s.streak === 7) return '🔥🔥🔥 أسبوع كامل نار! "7 أيام بلا كسرة" — ملك الأسبوع';
  if (s.streak === 10) return '🚀 عشرة أيام! النار ولات نوع جديد من الحماس';
  if (s.streak === 14) return '🐐 أسبوعين نار! أنت المايسترو الحقيقي';
  if (s.streak === 21) return '🧠 21 يوم! العادة الذهبية صنعتها. خليها خالدة';
  if (s.streak === 30) return '👑 شهر كامل ما غبتش! أنت الأسطورة بعينها';
  if (s.streak === 60) return '🦸 شهرين نار! أنت أقوى من بطارية السيارة';
  if (s.streak === 100) return '🏆 مئة يوم! ما بقاتش فوق منك حاجة. إهدينا النصيحة';
  return `🔥 ${s.streak} يوم من النار المستمرة! خلي الماكينة خدامة`;
}

export default function StreakCard({ data }) {
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
  const flameSize = Math.min(34 + streak * 2.2, 72);
  const state = s.at_risk ? 'risk' : streak === 0 && s.dead ? 'dead' : streak === 0 ? 'cold' : 'on';

  return (
    <div className={`streak-card streak-${state}`}>
      <div className="streak-main">
        <div className="streak-flame" style={{ fontSize: flameSize }}>
          {s.at_risk ? '⏳' : streak > 0 ? '🔥' : '🪨'}
        </div>
        <div className="streak-meta">
          <div className="streak-count">{streak}</div>
          <div className="streak-label">{streak === 1 ? 'يوم نار متواصل' : streak > 1 ? 'أيام نار متواصلة' : 'نارك مطفية'}</div>
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
          🎉 إنجاز جديد! وصلت {celebrated.label} من النار ({celebrated.n} يوم) — يا نار يا بطل!
        </div>
      )}
    </div>
  );
}
