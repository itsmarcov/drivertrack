const CACHE_KEY = 'commune_boundaries_cache';

function loadCache() {
  try { return JSON.parse(sessionStorage.getItem(CACHE_KEY) || '{}'); } catch { return {}; }
}
function saveCache(cache) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {}
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

    const name = el.tags?.name || el.tags?.['name:ar'] || '';
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
        properties: { name, osmId: el.id },
        geometry: { type: 'Polygon', coordinates: coords },
      });
    }
  });

  return features;
}

const DZ_BBOX = '18.96,-2.17,37.09,11.99';
const inflight = {};

export async function fetchCommuneBoundaries(communeNames) {
  const toFetch = communeNames.filter((n) => n && !cache[n]);
  if (toFetch.length === 0) return communeNames.map((n) => cache[n]).filter(Boolean);

  const BATCH = 5;
  for (let i = 0; i < toFetch.length; i += BATCH) {
    const batch = toFetch.slice(i, i + BATCH);
    const promises = batch.map((name) => {
      if (inflight[name]) return inflight[name];

      const query = `[out:json][timeout:8];
(
  way["boundary"="administrative"]["admin_level"~"^(7|8)$"]["name"="${name}"](${DZ_BBOX});
  relation["boundary"="administrative"]["admin_level"~"^(7|8)$"]["name"="${name}"](${DZ_BBOX});
);
out body;
>;
out skel qt;`;

      const promise = fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
      })
        .then((r) => r.json())
        .then((data) => {
          const features = osmToGeoJSON(data);
          const match = features.find((f) => f.properties.name === name);
          cache[name] = match || null;
          return match || null;
        })
        .catch(() => null)
        .finally(() => { delete inflight[name]; });

      inflight[name] = promise;
      return promise;
    });

    await Promise.all(promises);
  }

  saveCache(cache);
  return communeNames.map((n) => cache[n]).filter(Boolean);
}

export async function fetchCommuneBoundary(name) {
  const results = await fetchCommuneBoundaries([name]);
  return results[0] || null;
}
