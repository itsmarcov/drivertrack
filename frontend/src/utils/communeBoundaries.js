let boundaryData = null;

const CACHE_KEY = 'drivertrack_boundaries';

export async function loadBoundaries() {
  if (boundaryData) return boundaryData;

  // Try localStorage first
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    try {
      boundaryData = JSON.parse(cached);
      return boundaryData;
    } catch {}
  }

  try {
    const res = await fetch('/data/communes-boundaries.geojson');
    boundaryData = await res.json();
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(boundaryData));
    } catch {}
  } catch {
    boundaryData = { type: 'FeatureCollection', features: [] };
  }
  return boundaryData;
}

export function findBoundary(nameFr) {
  if (!boundaryData?.features) return null;
  return boundaryData.features.find(
    (f) => f.properties.nameFr === nameFr
  ) || null;
}

export function findBoundaries(nameFrList) {
  if (!boundaryData?.features || nameFrList.length === 0) return [];
  const nameSet = new Set(nameFrList);
  return boundaryData.features.filter(
    (f) => nameSet.has(f.properties.nameFr)
  );
}
