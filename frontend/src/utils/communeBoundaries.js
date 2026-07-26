let boundaryData = null;

export async function loadBoundaries() {
  if (boundaryData) return boundaryData;
  try {
    const res = await fetch('/data/communes-boundaries.geojson');
    boundaryData = await res.json();
  } catch {
    boundaryData = { type: 'FeatureCollection', features: [] };
  }
  return boundaryData;
}

export function findBoundary(communeName) {
  if (!boundaryData?.features) return null;
  return boundaryData.features.find(
    (f) => f.properties.nameAr === communeName || f.properties.nameFr === communeName
  ) || null;
}

export function findBoundaries(communeNames) {
  if (!boundaryData?.features || communeNames.length === 0) return [];
  const nameSet = new Set(communeNames);
  return boundaryData.features.filter(
    (f) => nameSet.has(f.properties.nameAr) || nameSet.has(f.properties.nameFr)
  );
}

export async function fetchCommuneBoundaries(communeInfoList) {
  await loadBoundaries();
  const names = communeInfoList.map((c) => c.nameAr || c.nameFr).filter(Boolean);
  return findBoundaries(names);
}

export async function fetchCommuneBoundary(nameAr, nameFr) {
  await loadBoundaries();
  return findBoundary(nameAr) || findBoundary(nameFr) || null;
}
