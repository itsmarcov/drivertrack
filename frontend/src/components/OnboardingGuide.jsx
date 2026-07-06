import { useState, useEffect } from 'react';

const STORAGE_KEY = 'nx_ops_onboarded';

const steps = [
  {
    icon: '👋',
    title: 'مرحباً بك في DriverTRACK',
    desc: 'هذا الدليل السريع سيساعدك على فهم كيفية استخدام النظام وإدارة مهامك اليومية كمشغل.',
  },
  {
    icon: '📊',
    title: 'لوحة التحكم',
    desc: 'من هنا ترى ملخص يومي: عدد السائقين الحاضرين، المتأخرين، والغائبين. يمكنك تصفية البيانات وتصدير تقارير Excel.',
  },
  {
    icon: '📋',
    title: 'مسح رمز QR',
    desc: 'هذه هي مهمتك الأساسية! وجه الماسح الضوئي نحو رمز QR الخاص بالسائق لتسجيل حضوره. سيتم تسجيل الوقت والموقع تلقائياً.',
    highlight: true,
    link: '/admin/scan',
    linkLabel: 'الذهاب إلى المسح',
  },
  {
    icon: '👥',
    title: 'السائقين والحضور',
    desc: 'يمكنك عرض قائمة السائقين وسجل الحضور والغياب. كل سائق لديه بطاقة تعريف تحتوي على QR خاص به.',
  },
  {
    icon: '⚠️',
    title: 'الغرامات',
    desc: 'في حال تأخر السائق، يتم تسجيل غرامة تلقائياً. يمكنك إدارة الغرامات ومراجعتها من قسم الغرامات.',
  },
  {
    icon: '🚀',
    title: 'انطلق!',
    desc: 'أنت الآن جاهز لبدء العمل. اذهب إلى شاشة المسح وابدأ بتسجيل حضور السائقين.',
    isLast: true,
    link: '/admin/scan',
    linkLabel: 'الذهاب إلى المسح',
  },
];

export default function OnboardingGuide() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) {
      const timer = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setOpen(false);
  };

  const handleSkip = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setOpen(false);
  };

  const next = () => {
    if (step < steps.length - 1) {
      setStep(s => s + 1);
    } else {
      dismiss();
    }
  };

  const prev = () => {
    if (step > 0) setStep(s => s - 1);
  };

  const s = steps[step];
  const progress = ((step + 1) / steps.length) * 100;

  if (!open) return null;

  return (
    <div className="onboard-overlay" onClick={handleSkip}>
      <div className="onboard-card glass-prominent nx-morph-in" onClick={e => e.stopPropagation()}>
        <button className="onboard-close" onClick={handleSkip}>✕</button>

        <div className="onboard-icon-wrap">
          <span className="onboard-icon">{s.icon}</span>
        </div>

        <h2 className="onboard-title">{s.title}</h2>
        <p className="onboard-desc">{s.desc}</p>

        {s.link && (
          <a href={s.link} className="btn btn-primary onboard-cta">
            {s.linkLabel}
          </a>
        )}

        <div className="onboard-progress-track">
          <div className="onboard-progress-fill" style={{ width: `${progress}%` }} />
        </div>

        <div className="onboard-step-indicator">
          {steps.map((_, i) => (
            <span key={i} className={`onboard-dot ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`} />
          ))}
        </div>

        <div className="onboard-actions">
          <button className="onboard-btn onboard-btn-ghost" onClick={handleSkip}>
            تخطي الدليل
          </button>
          <div className="onboard-actions-right">
            {step > 0 && (
              <button className="onboard-btn onboard-btn-outline" onClick={prev}>
                السابق
              </button>
            )}
            <button className="onboard-btn onboard-btn-primary" onClick={next}>
              {s.isLast ? 'ابدأ العمل' : 'التالي'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
