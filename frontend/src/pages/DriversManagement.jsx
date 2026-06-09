import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { drivers } from '../api';

function DriverForm({ driver, onSave, onCancel }) {
  const [form, setForm] = useState({
    username: '',
    password: '',
    full_name: '',
    email: '',
    phone: '',
    vehicle_type: '',
    license_plate: '',
    ...driver,
  });

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{driver ? 'تعديل السائق' : 'إضافة سائق جديد'}</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>اسم المستخدم</label>
              <input name="username" value={form.username} onChange={handleChange} required disabled={!!driver} />
            </div>
            <div className="form-group">
              <label>{driver ? 'كلمة مرور جديدة (اتركها فارغة إن لم ترد تغييرها)' : 'كلمة المرور'}</label>
              <input name="password" type="password" value={form.password} onChange={handleChange} required={!driver} />
            </div>
          </div>
          <div className="form-group">
            <label>الاسم الكامل</label>
            <input name="full_name" value={form.full_name} onChange={handleChange} required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>البريد الإلكتروني</label>
              <input name="email" type="email" value={form.email} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>رقم الهاتف</label>
              <input name="phone" value={form.phone} onChange={handleChange} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>نوع المركبة</label>
              <input name="vehicle_type" value={form.vehicle_type} onChange={handleChange} placeholder="دراجة نارية / سيارة" />
            </div>
            <div className="form-group">
              <label>رقم اللوحة</label>
              <input name="license_plate" value={form.license_plate} onChange={handleChange} />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">{driver ? 'حفظ التعديلات' : 'إضافة السائق'}</button>
            <button type="button" className="btn btn-outline" onClick={onCancel}>إلغاء</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DriversManagement() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const canAdd = user.role === 'admin' || user.role === 'ops';
  const [driverList, setDriverList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingDriver, setEditingDriver] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  const loadDrivers = async () => {
    try {
      setLoading(true);
      const data = await drivers.list();
      setDriverList(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDrivers(); }, []);

  const handleSave = async (formData) => {
    try {
      if (editingDriver) {
        const payload = { ...formData };
        delete payload.username;
        delete payload.id;
        delete payload.created_at;
        delete payload.updated_at;
        if (!payload.password) delete payload.password;
        await drivers.update(editingDriver.id, payload);
      } else {
        await drivers.create(formData);
      }
      setShowForm(false);
      setEditingDriver(null);
      loadDrivers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`هل أنت متأكد من حذف السائق "${name}"؟`)) return;
    try {
      await drivers.delete(id);
      loadDrivers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (driver) => {
    setEditingDriver(driver);
    setShowForm(true);
  };

  const handleToggleActive = async (driver) => {
    try {
      await drivers.update(driver.id, { is_active: driver.is_active ? 0 : 1 });
      loadDrivers();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;

  return (
    <div className="page admin-page">
      <div className="page-header">
        <h2>{isAdmin ? 'إدارة السائقين' : 'إدارة السائقين'}</h2>
        {canAdd && (
          <button className="btn btn-primary" onClick={() => { setEditingDriver(null); setShowForm(true); }}>+ إضافة سائق</button>
        )}
      </div>
      {error && <div className="alert alert-error" onClick={() => setError('')}>{error}</div>}
      {showForm && canAdd && <DriverForm driver={editingDriver} onSave={handleSave} onCancel={() => { setShowForm(false); setEditingDriver(null); }} />}
      {driverList.length === 0 ? (
        <p className="empty-state">لا يوجد سائقون بعد. قم بإضافة أول سائق!</p>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>اسم المستخدم</th>
                <th>الهاتف</th>
                <th>نوع المركبة</th>
                <th>رقم اللوحة</th>
                <th>الحالة</th>
                {isAdmin && <th>الإجراءات</th>}
              </tr>
            </thead>
            <tbody>
              {driverList.map((d) => (
                <tr key={d.id}>
                  <td><strong>{d.full_name}</strong></td>
                  <td>{d.username}</td>
                  <td>{d.phone || '—'}</td>
                  <td>{d.vehicle_type || '—'}</td>
                  <td>{d.license_plate || '—'}</td>
                  <td>{d.is_active ? <span className="badge badge-success">نشط</span> : <span className="badge badge-danger">غير نشط</span>}</td>
                  {isAdmin && (
                    <td className="actions-cell">
                      <button className="btn btn-sm btn-outline" onClick={() => handleEdit(d)}>تعديل</button>
                      <button className="btn btn-sm btn-warning" onClick={() => handleToggleActive(d)}>{d.is_active ? 'تعطيل' : 'تفعيل'}</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(d.id, d.full_name)}>حذف</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {user.role === 'ops' && (
        <div className="info-card">
          <p>🔧 يمكنك إضافة سائقين جدد عبر زر "إضافة سائق" أعلاه. للإدارة الكاملة، تواصل مع مدير النظام.</p>
        </div>
      )}
    </div>
  );
}
