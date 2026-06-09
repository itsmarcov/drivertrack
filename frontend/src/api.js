const API_BASE = '/api';

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const auth = {
  login: (username, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  register: (data) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  me: () => request('/auth/me'),
  listOps: () => request('/auth/ops'),
};

export const drivers = {
  list: () => request('/drivers'),
  get: (id) => request(`/drivers/${id}`),
  create: (data) => request('/drivers', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/drivers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/drivers/${id}`, { method: 'DELETE' }),
};

export const qr = {
  getMyQR: () => request('/qr/my-qr'),
  scan: (qrData) => request('/qr/scan', { method: 'POST', body: JSON.stringify({ qrData }) }),
};

export const attendance = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/attendance${qs ? '?' + qs : ''}`);
  },
  my: () => request('/attendance/my'),
  stats: () => request('/attendance/stats'),
};
