const API_BASE = '/api';

async function request(endpoint, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  let res;
  try {
    res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers, credentials: 'same-origin' });
  } catch {
    throw new Error('تعذر الاتصال بالخادم. تحقق من اتصال الإنترنت.');
  }
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error('خطأ في استجابة الخادم. حاول مرة أخرى.');
  }
  if (res.status === 403 && data.error === 'Session expired. Please login again.') {
    window.location.href = '/login';
    throw new Error('انتهت الجلسة. يرجى تسجيل الدخول مرة أخرى.');
  }
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function requestFormData(endpoint, formData) {
  let res;
  try {
    res = await fetch(`${API_BASE}${endpoint}`, { method: 'POST', body: formData, credentials: 'same-origin' });
  } catch {
    throw new Error('تعذر الاتصال بالخادم. تحقق من اتصال الإنترنت.');
  }
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error('خطأ في استجابة الخادم. حاول مرة أخرى.');
  }
  if (res.status === 403 && data.error === 'Session expired. Please login again.') {
    window.location.href = '/login';
    throw new Error('انتهت الجلسة. يرجى تسجيل الدخول مرة أخرى.');
  }
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const auth = {
  login: (username, password, recaptcha_token) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password, recaptcha_token }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  register: (data) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  me: async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, { credentials: 'same-origin' });
      if (res.status === 401 || res.status === 403) return null;
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },
  listOps: () => request('/auth/ops'),
  updateOps: (id, data) => request(`/auth/ops/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteOps: (id) => request(`/auth/ops/${id}`, { method: 'DELETE' }),
  listAdmins: () => request('/auth/admins'),
  deleteAdmin: (id) => request(`/auth/admins/${id}`),
  updateProfile: (data) => request('/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),
  registerDriver: (data) => request('/auth/register-driver', { method: 'POST', body: JSON.stringify(data) }),
  pendingDrivers: () => request('/auth/pending-drivers'),
  approveDriver: (id) => request(`/auth/pending-drivers/${id}/approve`, { method: 'PUT' }),
  rejectDriver: (id) => request(`/auth/pending-drivers/${id}/reject`, { method: 'DELETE' }),
};

export const drivers = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/drivers${qs ? '?' + qs : ''}`);
  },
  get: (id) => request(`/drivers/${id}`),
  getAddress: (id) => request(`/drivers/${id}/address`),
  updateAddress: (id, data) => request(`/drivers/${id}/address`, { method: 'PATCH', body: JSON.stringify(data) }),
  create: (data) => request('/drivers', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/drivers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/drivers/${id}`, { method: 'DELETE' }),
};

export const qr = {
  getMyQR: () => request('/qr/my-qr'),
  scan: (qrData, lat, lng) => request('/qr/scan', { method: 'POST', body: JSON.stringify({ qrData, lat, lng }) }),
};

export const attendance = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/attendance${qs ? '?' + qs : ''}`);
  },
  my: () => request('/attendance/my'),
  profile: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/attendance/my/profile${qs ? '?' + qs : ''}`);
  },
  stats: () => request('/attendance/stats'),
  late: () => request('/attendance/late'),
  manualAttend: (driver_id) => request('/attendance/manual', { method: 'POST', body: JSON.stringify({ driver_id }) }),
  markLate: (data) => request('/attendance/mark-late', { method: 'POST', body: JSON.stringify(data) }),
  exportLate: async (date) => {
    const qs = date ? `?date=${date}` : '';
    const res = await fetch(`/api/attendance/late/export${qs}`, { credentials: 'same-origin' });
    if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'فشل تصدير المتأخرين'); }
    return res.blob();
  },
  exportExcel: async (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`/api/attendance/export${qs ? '?' + qs : ''}`, { credentials: 'same-origin' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to export attendance');
    }
    return res.blob();
  },
};

export const stations = {
  list: () => request('/stations'),
  listPublic: () => request('/stations/public'),
  create: (data) => request('/stations', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/stations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/stations/${id}`, { method: 'DELETE' }),
};

export const penalties = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/penalties${qs ? '?' + qs : ''}`);
  },
  my: () => request('/penalties/my'),
  stats: () => request('/penalties/stats'),
  report: async (id) => {
    const res = await fetch(`/api/penalties/${id}/report`, { credentials: 'same-origin' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to generate report');
    }
    return res.blob();
  },
};

export const settings = {
  get: () => request('/settings'),
  update: (data) => request('/settings', { method: 'PUT', body: JSON.stringify(data) }),
};

export const absences = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/absences${qs ? '?' + qs : ''}`);
  },
  mark: (date) => request('/absences/mark', { method: 'POST', body: JSON.stringify({ date }) }),
  exportExcel: async (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`/api/absences/export${qs ? '?' + qs : ''}`, { credentials: 'same-origin' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to export absences');
    }
    return res.blob();
  },
  deleteByDate: (date) => request(`/absences/${date}`, { method: 'DELETE' }),
};

export const justifications = {
  submit: (formData) => requestFormData('/justifications', formData),
  my: () => request('/justifications/my'),
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/justifications${qs ? '?' + qs : ''}`);
  },
  review: (id, data) => request(`/justifications/${id}/review`, { method: 'PATCH', body: JSON.stringify(data) }),
  proofUrl: (id) => `/api/justifications/${id}/proof`,
  downloadUrl: (id) => `/api/justifications/${id}/proof/download`,
  remove: (id) => request(`/justifications/${id}`, { method: 'DELETE' }),
  stats: () => request('/justifications/stats'),
  archive: (id) => request(`/justifications/${id}/archive`, { method: 'POST' }),
  restore: (id) => request(`/justifications/${id}/restore`, { method: 'POST' }),
};

export const absenceRequests = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/absence-requests${qs ? '?' + qs : ''}`);
  },
  my: () => request('/absence-requests/my'),
  create: (data) => request('/absence-requests', { method: 'POST', body: JSON.stringify(data) }),
  review: (id, data) => request(`/absence-requests/${id}/review`, { method: 'PATCH', body: JSON.stringify(data) }),
  cancel: (id) => request(`/absence-requests/${id}`, { method: 'DELETE' }),
};

export const analytics = {
  get: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/analytics${qs ? '?' + qs : ''}`);
  },
  stationsReport: (date) => {
    const qs = date ? `?date=${date}` : '';
    return request(`/analytics/stations-report${qs}`);
  },
};

export const notifications = {
  getAll: () => request('/notifications'),
};

export const activityLogs = {
  getAll: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/activity-logs${qs ? '?' + qs : ''}`);
  },
};

export const announcements = {
  list: () => request('/announcements'),
  active: () => request('/announcements/active'),
  create: (data) => request('/announcements', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/announcements/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/announcements/${id}`, { method: 'DELETE' }),
};
