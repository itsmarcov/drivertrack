import { useState, useEffect } from 'react';
import AddressForm from './AddressForm';
import { drivers } from '../api';

const steps = [
  { num: 1, icon: '🏢', title: 'اختر ولايتك', desc: 'حدد الولاية التي تسكن فيها' },
  { num: 2, icon: '🏘️', title: 'اختر بلديتك', desc: 'حدد البلدية التي تنتمي إليها' },
  { num: 3, icon: '📍', title: 'حدد موقعك', desc: 'ضع علامة على الخريطة على موقع سكنك الدقيق' },
];

export default function AddressGuide({ driverId, onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const addr = await drivers.getAddress(driverId);
        if (addr && addr.wilaya_code && addr.commune_code && addr.latitude) {
          setCompleted(true);
          onComplete?.();
        }
      } catch {}
    })();
  }, [driverId]);

  const handleSaved = () => {
    setCompleted(true);
    setTimeout(() => onComplete?.(), 800);
  };

  if (completed) {
    return (
      <div className="ag-overlay">
        <div className="ag-done">
          <div className="ag-done-icon">✅</div>
          <h3>تم حفظ عنوانك بنجاح!</h3>
          <p>يمكنك الآن الوصول إلى لوحة التحكم</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ag-overlay">
      <div className="ag-container">
        <div className="ag-header">
          <div className="ag-welcome-icon">📍</div>
          <h2>مرحباً، {driverId}</h2>
          <p className="ag-subtitle">لنبدأ بإعداد عنوان سكنك — это سيستغرق أقل من دقيقة</p>
        </div>

        <div className="ag-steps-row">
          {steps.map((s) => (
            <div key={s.num} className={`ag-step-item ${currentStep >= s.num ? 'active' : ''}`}>
              <div className="ag-step-icon">{s.icon}</div>
              <div className="ag-step-num">{s.num}</div>
              <div className="ag-step-text">
                <div className="ag-step-title">{s.title}</div>
                <div className="ag-step-desc">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="ag-form-area">
          <AddressForm driverId={driverId} onSaved={handleSaved} compact />
        </div>
      </div>
    </div>
  );
}