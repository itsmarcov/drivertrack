import { useState, useEffect } from 'react';
import LoadingScreen from '../components/LoadingScreen';
import { useAuth } from '../context/AuthContext';
import { drivers, stations } from '../api';
import DriverProfile from './DriverProfile';

function DriverForm({ driver, onSave, onCancel }) {
  const [stationList, setStationList] = useState([]);
  const { user } = useAuth();

  useEffect(() => {
    if (user.role === 'admin') stations.list().then(setStationList).catch(() => {});
  }, []);

  const [form, setForm] = useState({
    username: '',
    password: '',
    full_name: '',
    email: '',
    phone: '',
    vehicle_type: '',
    license_plate: '',
    station_id: '',
    shift: 'morning',
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
        <div className="modal-header">
          <h3>{driver ? 'تعديل السائق' : 'إضافة سائق جديد'}</h3>
          <button className="modal-close" onClick={onCancel}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>اسم المستخدم</label>
              <input name="username" value={form.username} onChange={handleChange} required disabled={!!driver} />
            </div>
            <div className="form-group">
              <label>{driver ? 'كلمة مرور جديدة (اختياري)' : 'كلمة المرور'}</label>
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
          {user.role === 'admin' && (
            <div className="form-group">
              <label>المحطة</label>
              <select name="station_id" value={form.station_id} onChange={handleChange}>
                <option value="">بدون محطة</option>
                {stationList.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
              </select>
            </div>
          )}
          <div className="form-group">
            <label>الفترة</label>
            <select name="shift" value={form.shift} onChange={handleChange}>
              <option value="morning">صباحية</option>
              <option value="evening">مسائية</option>
            </select>
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
  const [stationList, setStationList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingDriver, setEditingDriver] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterStation, setFilterStation] = useState('');
  const [filterShift, setFilterShift] = useState('');
  const [selectedDriver, setSelectedDriver] = useState(null);

  const loadDrivers = async (station, shift, srch) => {
    try {
      setLoading(true);
      const params = {};
      if (station && user.role === 'admin') params.station_id = station;
      if (shift) params.shift = shift;
      if (srch) params.search = srch;
      const data = await drivers.list(params);
      setDriverList(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDrivers(filterStation, filterShift, search);
    if (isAdmin) stations.list().then(setStationList).catch(() => {});
  }, []);

  const handleSave = async (formData) => {
    try {
      const payload = { ...formData };
      if (payload.station_id === '' || payload.station_id === undefined) {
        delete payload.station_id;
      } else {
        payload.station_id = parseInt(payload.station_id);
      }
      if (editingDriver) {
        delete payload.username;
        delete payload.id;
        delete payload.created_at;
        delete payload.updated_at;
        if (!payload.password) delete payload.password;
        await drivers.update(editingDriver.id, payload);
      } else {
        await drivers.create(payload);
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

  const filtered = driverList;

  if (loading) return <LoadingScreen message="جاري تحميل السائقين..." />;

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-content">
          <h2>إدارة السائقين</h2>
          <p>{driverList.length} سائق مسجل</p>
        </div>
        <div className="page-header-actions">
          {canAdd && (
            <button className="btn btn-primary" onClick={() => { setEditingDriver(null); setShowForm(true); }}>
              + إضافة سائق
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error" onClick={() => setError('')}>{error}</div>}
      {showForm && canAdd && <DriverForm driver={editingDriver} onSave={handleSave} onCancel={() => { setShowForm(false); setEditingDriver(null); }} />}

      <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <div className="form-row">
          <div className="form-group">
            <label>بحث</label>
            <input type="text" placeholder="اسم / هاتف / مستخدم..." value={search}
              onChange={(e) => { setSearch(e.target.value); loadDrivers(filterStation, filterShift, e.target.value); }} />
          </div>
          {isAdmin && (
            <div className="form-group">
              <label>المحطة</label>
              <select value={filterStation} onChange={(e) => { setFilterStation(e.target.value); loadDrivers(e.target.value, filterShift, search); }}>
                <option value="">جميع المحطات</option>
                {stationList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          <div className="form-group">
            <label>الفترة</label>
            <select value={filterShift} onChange={(e) => { setFilterShift(e.target.value); loadDrivers(filterStation, e.target.value, search); }}>
              <option value="">الكل</option>
              <option value="morning">صباحية</option>
              <option value="evening">مسائية</option>
            </select>
          </div>
        </div>
      </div>

      <div className="table-container">
        <div className="table-toolbar">
          <span className="text-sm text-muted">{filtered.length} سائق</span>
        </div>
        {filtered.length === 0 ? (
          <div className="nx-empty">
            <div className="nx-empty-icon">👤</div>
            <h3>{search ? 'لا توجد نتائج' : 'لا يوجد سائقون بعد'}</h3>
            <p>{search ? 'حاول تغيير معايير البحث' : 'قم بإضافة أول سائق!'}</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>اسم المستخدم</th>
                <th>الهاتف</th>
                <th>المركبة</th>
                <th>اللوحة</th>
                <th>المحطة</th>
                <th>الفترة</th>
                <th>الحالة</th>
                {isAdmin && <th>الإجراءات</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id}>
                  <td><strong style={{ cursor: 'pointer', color: '#E53935' }} onClick={() => setSelectedDriver(d)}>{d.full_name}</strong></td>
                  <td>{d.username}</td>
                  <td>{d.phone || '—'}</td>
                  <td>{d.vehicle_type || '—'}</td>
                  <td>{d.license_plate || '—'}</td>
                  <td>{d.station_name || (d.station_id ? <span className="badge badge-info">محطة {d.station_id}</span> : '—')}</td>
                  <td>{d.shift === 'evening' ? <span className="badge badge-warning">مسائية</span> : <span className="badge badge-info">صباحية</span>}</td>
                  <td>{d.is_active ? <span className="badge badge-success">نشط</span> : <span className="badge badge-danger">غير نشط</span>}</td>
                  {isAdmin && (
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-sm btn-outline" onClick={() => handleEdit(d)}>تعديل</button>
                        <button className="btn btn-sm btn-outline" onClick={() => handleToggleActive(d)}>{d.is_active ? 'تعطيل' : 'تفعيل'}</button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(d.id, d.full_name)}>حذف</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {user.role === 'ops' && (
        <div className="alert alert-info" style={{ marginTop: '1rem' }}>
          يمكنك إضافة سائقين جدد عبر زر "إضافة سائق" أعلاه. للإدارة الكاملة، تواصل مع مدير النظام.
        </div>
      )}

      {selectedDriver && (
        <div className="modal-overlay" onClick={() => setSelectedDriver(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <DriverProfile driverId={selectedDriver.id} onClose={() => setSelectedDriver(null)} />
          </div>
        </div>
      )}
    </div>
  );
}
