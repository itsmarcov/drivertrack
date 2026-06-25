import { useState, useEffect } from 'react';
import LoadingScreen from '../components/LoadingScreen';
import { settings } from '../api';

export default function SettingsManagement() {
  const [config, setConfig] = useState({
    morning_late_cutoff: '10:00:00',
    morning_absent_cutoff: '12:30:00',
    evening_late_cutoff: '16:00:00',
    evening_absent_cutoff: '17:30:00',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    settings.get()
      .then((data) => {
        if (data && typeof data === 'object') setConfig(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (e) => setConfig({ ...config, [e.target.name]: e.target.value });

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await settings.update(config);
      setMessage('✅ تم حفظ الإعدادات بنجاح');
    } catch (err) {
      setMessage('❌ ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingScreen message="جاري تحميل الإعدادات..." />;

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-content">
          <h2>إعدادات الفترات</h2>
          <p>تحديد أوقات التأخير والغياب لكل فترة</p>
        </div>
      </div>

      {message && (
        <div className={`alert ${message.includes('✅') ? 'alert-success' : 'alert-error'}`} onClick={() => setMessage('')}>
          {message}
        </div>
      )}

      <div className="card" style={{ padding: '1.5rem' }}>
        <form onSubmit={handleSave}>
          <h3 style={{ marginBottom: '0.75rem', color: '#e53935' }}>الفترة الصباحية</h3>
          <div className="form-row">
            <div className="form-group">
              <label>وقت التأخير (بعد هذا الوقت يعتبر متأخراً)</label>
              <input
                type="time"
                name="morning_late_cutoff"
                value={config.morning_late_cutoff ? config.morning_late_cutoff.slice(0, 5) : '10:00'}
                onChange={(e) => handleChange({ target: { name: 'morning_late_cutoff', value: e.target.value + ':00' } })}
              />
            </div>
            <div className="form-group">
              <label>وقت الغياب (بعد هذا الوقت يعتبر غائباً)</label>
              <input
                type="time"
                name="morning_absent_cutoff"
                value={config.morning_absent_cutoff ? config.morning_absent_cutoff.slice(0, 5) : '12:30'}
                onChange={(e) => handleChange({ target: { name: 'morning_absent_cutoff', value: e.target.value + ':00' } })}
              />
            </div>
          </div>

          <h3 style={{ marginBottom: '0.75rem', marginTop: '1.5rem', color: '#e53935' }}>الفترة المسائية</h3>
          <div className="form-row">
            <div className="form-group">
              <label>وقت التأخير</label>
              <input
                type="time"
                name="evening_late_cutoff"
                value={config.evening_late_cutoff ? config.evening_late_cutoff.slice(0, 5) : '16:00'}
                onChange={(e) => handleChange({ target: { name: 'evening_late_cutoff', value: e.target.value + ':00' } })}
              />
            </div>
            <div className="form-group">
              <label>وقت الغياب</label>
              <input
                type="time"
                name="evening_absent_cutoff"
                value={config.evening_absent_cutoff ? config.evening_absent_cutoff.slice(0, 5) : '17:30'}
                onChange={(e) => handleChange({ target: { name: 'evening_absent_cutoff', value: e.target.value + ':00' } })}
              />
            </div>
          </div>

          <div style={{ marginTop: '1.5rem' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
