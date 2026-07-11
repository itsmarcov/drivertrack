import { useState, useEffect, useCallback } from 'react';
import { activityLogs } from '../api';

const ACTION_LABELS = {
  login: 'تسجيل دخول',
  create_user: 'إنشاء مستخدم',
  update_user: 'تعديل مستخدم',
  delete_user: 'حذف مستخدم',
  create_driver: 'إضافة سائق',
  update_driver: 'تعديل سائق',
  delete_driver: 'حذف سائق',
  approve_driver: 'تفعيل سائق',
  reject_driver: 'رفض سائق',
  create_station: 'إضافة محطة',
  update_station: 'تعديل محطة',
  delete_station: 'حذف محطة',
  mark_late: 'تسجيل تأخير',
  manual_attendance: 'حضور يدوي',
  scan_attendance: 'مسح QR',
  mark_absences: 'تسجيل غياب',
  delete_absences: 'حذف غياب',
  submit_justification: 'تقديم مبرر',
  review_justification: 'مراجعة مبرر',
  archive_justification: 'أرشفة مبرر',
  restore_justification: 'استعادة مبرر',
  delete_justification: 'حذف مبرر',
  create_absence_request: 'طلب غياب مسبق',
  review_absence_request: 'مراجعة طلب غياب',
  cancel_absence_request: 'إلغاء طلب غياب',
  update_settings: 'تعديل الإعدادات',
  update_profile: 'تحديث الملف الشخصي',
};

const ACTION_ICONS = {
  login: '#3B82F6',
  create_user: '#10B981',
  update_user: '#F59E0B',
  delete_user: '#EF4444',
  create_driver: '#10B981',
  update_driver: '#F59E0B',
  delete_driver: '#EF4444',
  approve_driver: '#10B981',
  reject_driver: '#EF4444',
  create_station: '#10B981',
  update_station: '#F59E0B',
  delete_station: '#EF4444',
  mark_late: '#E53935',
  manual_attendance: '#3B82F6',
  scan_attendance: '#8B5CF6',
  mark_absences: '#E53935',
  delete_absences: '#EF4444',
  submit_justification: '#F59E0B',
  review_justification: '#10B981',
  archive_justification: '#6B7280',
  restore_justification: '#3B82F6',
  delete_justification: '#EF4444',
  create_absence_request: '#8B5CF6',
  review_absence_request: '#10B981',
  cancel_absence_request: '#EF4444',
  update_settings: '#6B7280',
  update_profile: '#3B82F6',
};

export default function ActivityLogs() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ actions: [], entity_types: [] });
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const pageSize = 50;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: pageSize, offset: page * pageSize };
      if (actionFilter) params.action = actionFilter;
      if (entityFilter) params.entity_type = entityFilter;
      const data = await activityLogs.getAll(params);
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      if (data.filters) setFilters(data.filters);
    } catch { setLogs([]); }
    setLoading(false);
  }, [actionFilter, entityFilter, page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>سجل النشاطات</h1>
        <span className="page-subtitle">{total} عملية</span>
      </div>

      <div className="filter-bar" style={{ gap: 10, flexWrap: 'wrap' }}>
        <select className="filter-select" value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(0); }}>
          <option value="">كل النشاطات</option>
          {filters.actions.map(a => (
            <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>
          ))}
        </select>
        <select className="filter-select" value={entityFilter} onChange={e => { setEntityFilter(e.target.value); setPage(0); }}>
          <option value="">كل الكيانات</option>
          {filters.entity_types.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="loading-spinner" />
      ) : logs.length === 0 ? (
        <div className="empty-state">لا توجد نشاطات</div>
      ) : (
        <>
          <div className="table-container" style={{ marginTop: 16 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>الوقت</th>
                  <th>المستخدم</th>
                  <th>الدور</th>
                  <th>النشاط</th>
                  <th>التفاصيل</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td className="td-time">{new Date(log.created_at).toLocaleString('ar-SA')}</td>
                    <td>{log.user_name}</td>
                    <td>{log.user_role === 'super_admin' ? 'مدير عام' : log.user_role === 'admin' ? 'مدير' : log.user_role === 'ops' ? 'مشغل' : log.user_role}</td>
                    <td>
                      <span className="badge" style={{ background: (ACTION_ICONS[log.action] || '#6B7280') + '18', color: ACTION_ICONS[log.action] || '#6B7280', border: 'none' }}>
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                    </td>
                    <td className="td-details">
                      {log.entity_type && <span className="log-entity">{log.entity_type} #{log.entity_id}</span>}
                      {log.details && (() => {
                        try {
                          const d = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
                          return <span className="log-meta">{JSON.stringify(d)}</span>;
                        } catch { return null; }
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination" style={{ marginTop: 16, display: 'flex', justifyContent: 'center', gap: 8 }}>
              <button className="btn btn-secondary" disabled={page === 0} onClick={() => setPage(p => p - 1)}>السابق</button>
              <span style={{ padding: '6px 12px', color: 'var(--nx-text-secondary)' }}>{page + 1} / {totalPages}</span>
              <button className="btn btn-secondary" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>التالي</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
