const CACHE_KEY = 'commune_boundaries_v2';

function loadCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch { return {}; }
}
function saveCache(cache) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {}
}

const cache = loadCache();

function osmToGeoJSON(data) {
  const nodes = {};
  (data.elements || []).forEach((el) => {
    if (el.type === 'node') nodes[el.id] = [el.lon, el.lat];
  });

  const features = [];
  const seen = new Set();

  (data.elements || []).forEach((el) => {
    if (el.type !== 'way' && el.type !== 'relation') return;
    if (seen.has(el.id)) return;
    seen.add(el.id);

    const nameAr = el.tags?.['name:ar'] || '';
    const nameFr = el.tags?.['name:fr'] || el.tags?.name || '';
    const name = nameAr || nameFr;
    if (!name) return;

    let coords = [];

    if (el.type === 'way' && el.nodes) {
      const ring = el.nodes.map((nid) => nodes[nid]).filter(Boolean);
      if (ring.length >= 4) coords = [ring];
    }

    if (el.type === 'relation' && el.members) {
      const outerRings = [];
      el.members.forEach((m) => {
        if (m.role && m.role !== 'outer') return;
        const wayEl = data.elements.find((e) => e.id === m.ref && e.type === 'way');
        if (wayEl && wayEl.nodes) {
          const ring = wayEl.nodes.map((nid) => nodes[nid]).filter(Boolean);
          if (ring.length >= 4) outerRings.push(ring);
        }
      });
      if (outerRings.length > 0) coords = outerRings;
    }

    if (coords.length > 0) {
      features.push({
        type: 'Feature',
        properties: { nameAr, nameFr, osmId: el.id },
        geometry: { type: 'Polygon', coordinates: coords },
      });
    }
  });

  return features;
}

const DZ_BBOX = '18.96,-2.17,37.09,11.99';
const inflight = {};

function buildQuery(searchName) {
  const escaped = searchName.replace(/"/g, '\\"');
  return `[out:json][timeout:15];
(
  way["boundary"="administrative"]["admin_level"~"^(7|8)$"]["name"="${escaped}"](${DZ_BBOX});
  relation["boundary"="administrative"]["admin_level"~"^(7|8)$"]["name"="${escaped}"](${DZ_BBOX});
);
out body;
>;
out skel qt;`;
}

async function queryOverpass(query) {
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) throw new Error('Overpass API error');
  return res.json();
}

async function searchBoundary(nameAr, nameFr) {
  const names = [nameFr, nameAr].filter(Boolean);
  for (const searchName of names) {
    try {
      const data = await queryOverpass(buildQuery(searchName));
      const features = osmToGeoJSON(data);
      const match = features.find((f) =>
        (nameAr && (f.properties.nameAr === nameAr || f.properties.nameFr === nameAr)) ||
        (nameFr && (f.properties.nameFr === nameFr || f.properties.nameAr === nameFr)) ||
        f.properties.nameFr.toLowerCase() === searchName.toLowerCase()
      );
      if (match) return match;
    } catch {}
  }
  return null;
}

export async function fetchCommuneBoundaries(communeInfoList) {
  const toFetch = communeInfoList.filter((c) => c.nameAr && !cache[c.nameAr]);
  if (toFetch.length === 0) return communeInfoList.map((c) => cache[c.nameAr]).filter(Boolean);

  const BATCH = 3;
  for (let i = 0; i < toFetch.length; i += BATCH) {
    const batch = toFetch.slice(i, i + BATCH);
    const promises = batch.map((info) => {
      const key = info.nameAr;
      if (inflight[key]) return inflight[key];

      const promise = (async () => {
        try {
          const match = await searchBoundary(info.nameAr, info.nameFr);
          cache[key] = match || null;
          return match || null;
        } catch {
          return null;
        } finally {
          delete inflight[key];
        }
      })();

      inflight[key] = promise;
      return promise;
    });

    await Promise.all(promises);
  }

  saveCache(cache);
  return communeInfoList.map((c) => cache[c.nameAr]).filter(Boolean);
}

export async function fetchCommuneBoundary(nameAr, nameFr) {
  const results = await fetchCommuneBoundaries([{ nameAr, nameFr }]);
  return results[0] || null;
}
