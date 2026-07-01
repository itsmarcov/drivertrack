const CACHE = 'drivertrack-v3';
const ASSET_CACHE = 'drivertrack-assets-v3';
const DB_NAME = 'scan-queue';
const STORE_NAME = 'pending-scans';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => e.target.result.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function addPendingScan(body, auth) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).add({ body, auth, timestamp: Date.now(), status: 'pending' });
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function getPendingScans() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function deletePendingScan(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function notifyClients() {
  const scans = await getPendingScans();
  const count = scans.filter(s => s.status === 'pending').length;
  const clients = await self.clients.matchAll();
  clients.forEach(c => c.postMessage({ type: 'SCAN_QUEUE_STATUS', count }));
}

async function syncPendingScans() {
  const scans = await getPendingScans();
  const pending = scans.filter(s => s.status === 'pending');
  if (pending.length === 0) return;

  const clients = await self.clients.matchAll();
  clients.forEach(c => c.postMessage({ type: 'SCAN_QUEUE_STATUS', count: pending.length, syncing: true }));

  for (const scan of pending) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (scan.auth) headers['Authorization'] = scan.auth;
      const res = await fetch('/api/qr/scan', { method: 'POST', headers, body: JSON.stringify(scan.body) });
      if (res.ok) await deletePendingScan(scan.id);
    } catch {}
  }

  const remaining = await getPendingScans();
  const count = remaining.filter(s => s.status === 'pending').length;
  clients.forEach(c => c.postMessage({ type: 'SCAN_QUEUE_STATUS', count, syncing: false }));
}

self.addEventListener('install', (event) => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE && k !== ASSET_CACHE).map((k) => caches.delete(k)))
    ).then(() => clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method === 'POST' && event.request.url.includes('/qr/scan')) {
    event.respondWith(
      fetch(event.request.clone()).catch(async () => {
        try {
          const auth = event.request.headers.get('Authorization');
          const body = await event.request.clone().json();
          await addPendingScan(body, auth);
          notifyClients();
        } catch {}
        return new Response(
          JSON.stringify({ queued: true, message: 'تم حفظ المسح. سيتم المزامنة تلقائياً عند استعادة الاتصال.' }),
          { status: 202, headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const clone = response.clone();
          const isAsset = /\.(js|css|png|svg|woff2?)$/i.test(event.request.url);
          caches.open(isAsset ? ASSET_CACHE : CACHE).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

self.addEventListener('online', () => syncPendingScans());

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SYNC_SCANS') event.waitUntil(syncPendingScans());
  if (event.data?.type === 'GET_QUEUE_STATUS') event.waitUntil(notifyClients());
});
