import { useState, useEffect } from 'react';
import { absenceRequests } from '../api';

const filterTabs = [
  { value: '', label: 'الكل' },
  { value: 'pending', label: 'قيد الانتظار' },
  { value: 'approved', label: 'مقبولة' },
  { value: 'rejected', label: 'مرفوضة' },
];

const statusBadge = {
  pending: 'badge badge-warning',
  approved: 'badge badge-success',
  rejected: 'badge badge-danger',
};

const statusLabel = {
  pending: 'قيد الانتظار',
  approved: 'مقبول',
  rejected: 'مرفوض',
};

export default function AbsenceRequestsReview() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [actionId, setActionId] = useState(null);
  const [adminNote, setAdminNote] = useState('');

  const fetchRequests = async () => {
    try {
      const params = filter ? { status: filter } : {};
      const data = await absenceRequests.list(params);
      setRequests(data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchRequests(); }, [filter]);

  const handleReview = async (id, status) => {
    try {
      await absenceRequests.review(id, { status, admin_note: adminNote || undefined });
      setActionId(null);
      setAdminNote('');
      fetchRequests();
    } catch {}
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>مراجعة طلبات الغياب</h2>
      </div>

      <div className="filter-tabs">
        {filterTabs.map(t => (
          <button key={t.value} className={`filter-tab ${filter === t.value ? 'active' : ''}`}
            onClick={() => { setFilter(t.value); setLoading(true); }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="nx-empty"><p>جاري التحميل...</p></div>
      ) : requests.length === 0 ? (
        <div className="nx-empty"><div className="nx-empty-icon">📭</div><h3>لا توجد طلبات</h3><p>لا توجد طلبات غياب في هذا التصنيف</p></div>
      ) : (
        <div className="arr-list">
          {requests.map(r => (
            <div key={r.id} className="card arr-item">
              <div className="arr-item-header">
                <div className="arr-item-driver">
                  <span className="arr-driver-name">{r.driver_name}</span>
                  {r.station_name && <span className="arr-station">{r.station_name}</span>}
                </div>
                <span className={statusBadge[r.status]}>{statusLabel[r.status]}</span>
              </div>

              <div className="arr-item-body">
                <div className="arr-dates">{r.date_from} <span>→</span> {r.date_to}</div>
                <div className="arr-reason"><strong>السبب:</strong> {r.reason}</div>
                {r.note && <div className="arr-note"><strong>ملاحظة:</strong> {r.note}</div>}
              </div>

              <div className="arr-item-meta">
                <span>تقديم: {new Date(r.created_at).toLocaleString('fr-DZ')}</span>
                {r.phone && <span>هاتف: {r.phone}</span>}
                {r.vehicle_type && <span>مركبة: {r.vehicle_type}</span>}
                {r.license_plate && <span>لوحة: {r.license_plate}</span>}
                {r.reviewer_name && <span>مراجعة بواسطة: {r.reviewer_name}</span>}
              </div>

              {actionId === r.id ? (
                <div className="arr-action-form">
                  <input type="text" className="form-input" placeholder="ملاحظة (اختياري)..."
                    value={adminNote} onChange={e => setAdminNote(e.target.value)} />
                  <div className="arr-action-btns">
                    <button className="btn btn-success" onClick={() => handleReview(r.id, 'approved')}>قبول</button>
                    <button className="btn btn-danger" onClick={() => handleReview(r.id, 'rejected')}>رفض</button>
                    <button className="btn btn-ghost" onClick={() => setActionId(null)}>إلغاء</button>
                  </div>
                </div>
              ) : (
                <div className="arr-item-actions">
                  {r.status === 'pending' && (
                    <button className="btn btn-primary" onClick={() => setActionId(r.id)}>معالجة</button>
                  )}
                </div>
              )}

              {r.admin_note && (
                <div className="arr-admin-note">ملاحظة المشرف: {r.admin_note}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
