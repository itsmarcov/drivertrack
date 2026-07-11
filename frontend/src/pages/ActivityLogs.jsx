import { useState, useEffect, useCallback, useMemo } from 'react';
import { activityLogs } from '../api';

const ACTION_LABELS = {
  login: 'تسجيل دخول', create_user: 'إنشاء مستخدم', update_user: 'تعديل مستخدم', delete_user: 'حذف مستخدم',
  create_driver: 'إضافة سائق', update_driver: 'تعديل سائق', delete_driver: 'حذف سائق',
  approve_driver: 'تفعيل سائق', reject_driver: 'رفض سائق',
  create_station: 'إضافة محطة', update_station: 'تعديل محطة', delete_station: 'حذف محطة',
  mark_late: 'تسجيل تأخير', manual_attendance: 'حضور يدوي', scan_attendance: 'مسح QR',
  mark_absences: 'تسجيل غياب', delete_absences: 'حذف غياب',
  submit_justification: 'تقديم مبرر', review_justification: 'مراجعة مبرر',
  archive_justification: 'أرشفة مبرر', restore_justification: 'استعادة مبرر', delete_justification: 'حذف مبرر',
  create_absence_request: 'طلب غياب مسبق', review_absence_request: 'مراجعة طلب غياب', cancel_absence_request: 'إلغاء طلب غياب',
  update_settings: 'تعديل الإعدادات', update_profile: 'تحديث الملف الشخصي',
};

const ACTION_GROUP = {
  login: 'auth', create_user: 'create', update_user: 'update', delete_user: 'delete',
  create_driver: 'create', update_driver: 'update', delete_driver: 'delete',
  approve_driver: 'create', reject_driver: 'delete',
  create_station: 'create', update_station: 'update', delete_station: 'delete',
  mark_late: 'flag', manual_attendance: 'flag', scan_attendance: 'flag',
  mark_absences: 'flag', delete_absences: 'delete',
  submit_justification: 'create', review_justification: 'update',
  archive_justification: 'archive', restore_justification: 'restore', delete_justification: 'delete',
  create_absence_request: 'create', review_absence_request: 'update', cancel_absence_request: 'delete',
  update_settings: 'update', update_profile: 'update',
};

const GROUP_COLORS = {
  create: { bg: '#D1FAE5', text: '#065F46', dot: '#10B981' },
  update: { bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B' },
  delete: { bg: '#FEE2E2', text: '#991B1B', dot: '#EF4444' },
  flag: { bg: '#DBEAFE', text: '#1E40AF', dot: '#3B82F6' },
  auth: { bg: '#E0E7FF', text: '#3730A3', dot: '#6366F1' },
  archive: { bg: '#F3F4F6', text: '#4B5563', dot: '#6B7280' },
  restore: { bg: '#EDE9FE', text: '#5B21B6', dot: '#8B5CF6' },
};

function getGroup(action) { return GROUP_COLORS[ACTION_GROUP[action] || 'update']; }

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `منذ ${hrs} ساعة`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `منذ ${days} أيام`;
  return new Date(dateStr).toLocaleDateString('ar-SA');
}

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0][0].toUpperCase();
}

function formatDetails(details) {
  if (!details) return null;
  try {
    const d = typeof details === 'string' ? JSON.parse(details) : details;
    if (typeof d === 'string') return d;
    return Object.entries(d).filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => {
      const val = typeof v === 'object' ? JSON.stringify(v) : String(v);
      return { key: k, value: val.length > 40 ? val.slice(0, 40) + '…' : val };
    });
  } catch { return [{ key: 'data', value: details }]; }
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export default function ActivityLogs() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [filterActions, setFilterActions] = useState([]);
  const [filterEntities, setFilterEntities] = useState([]);
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const pageSize = 30;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: pageSize, offset: page * pageSize };
      if (actionFilter) params.action = actionFilter;
      if (entityFilter) params.entity_type = entityFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const data = await activityLogs.getAll(params);
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      if (data.filters) {
        setFilterActions(data.filters.actions || []);
        setFilterEntities(data.filters.entity_types || []);
      }
    } catch { setLogs([]); }
    setLoading(false);
  }, [actionFilter, entityFilter, dateFrom, dateTo, page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const totalPages = Math.ceil(total / pageSize);

  const todayLogs = useMemo(() => {
    const t = todayStr();
    return logs.filter(l => l.created_at && l.created_at.startsWith(t)).length;
  }, [logs]);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>سجل النشاطات</h1>
          <div className="page-subtitle">
            <span>{total} عملية</span>
            {todayLogs > 0 && <span className="log-today-badge">اليوم: {todayLogs}</span>}
          </div>
        </div>
      </div>

      <div className="log-filters">
        <div className="log-filters-row">
          <select className="filter-select" value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(0); }}>
            <option value="">كل النشاطات</option>
            {filterActions.map(a => (
              <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>
            ))}
          </select>
          <select className="filter-select" value={entityFilter} onChange={e => { setEntityFilter(e.target.value); setPage(0); }}>
            <option value="">كل الكيانات</option>
            {filterEntities.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input type="date" className="filter-input" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0); }} placeholder="من تاريخ" />
          <input type="date" className="filter-input" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0); }} placeholder="إلى تاريخ" />
        </div>
      </div>

      {loading ? (
        <div className="loading-spinner" />
      ) : logs.length === 0 ? (
        <div className="empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--nx-text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          <p>لا توجد نشاطات مطابقة</p>
        </div>
      ) : (
        <>
          <div className="log-feed">
            {logs.map(log => {
              const group = getGroup(log.action);
              const detailItems = formatDetails(log.details);
              return (
                <div key={log.id} className="log-card">
                  <div className="log-card-timeline" style={{ background: group.dot }} />
                  <div className="log-card-body">
                    <div className="log-card-top">
                      <div className="log-card-user">
                        <div className="log-card-avatar" style={{ background: group.bg, color: group.text }}>
                          {initials(log.user_name)}
                        </div>
                        <div className="log-card-user-info">
                          <span className="log-card-name">{log.user_name}</span>
                          <span className="log-card-role">{log.user_role === 'super_admin' ? 'مدير عام' : log.user_role === 'admin' ? 'مدير' : log.user_role === 'ops' ? 'مشغل' : log.user_role}</span>
                        </div>
                      </div>
                      <span className="log-card-time" title={new Date(log.created_at).toLocaleString('ar-SA')}>{timeAgo(log.created_at)}</span>
                    </div>
                    <div className="log-card-action">
                      <span className="log-card-badge" style={{ background: group.bg, color: group.text }}>
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                      {log.entity_type && (
                        <span className="log-card-entity">{log.entity_type} #{log.entity_id}</span>
                      )}
                    </div>
                    {detailItems && detailItems.length > 0 && (
                      <div className="log-card-details">
                        {detailItems.map((item, i) => (
                          <div key={i} className="log-detail-chip">
                            <span className="log-detail-key">{item.key}</span>
                            <span className="log-detail-val">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="log-pagination">
              <button className="btn btn-secondary" disabled={page === 0} onClick={() => setPage(p => p - 1)}>السابق</button>
              <div className="log-pagination-pages">
                {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
                  let pageNum;
                  if (totalPages <= 7) pageNum = i;
                  else if (page < 3) pageNum = i;
                  else if (page > totalPages - 4) pageNum = totalPages - 7 + i;
                  else pageNum = page - 3 + i;
                  return (
                    <button key={pageNum} className={`log-page-btn${pageNum === page ? ' active' : ''}`} onClick={() => setPage(pageNum)}>
                      {pageNum + 1}
                    </button>
                  );
                })}
              </div>
              <button className="btn btn-secondary" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>التالي</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
