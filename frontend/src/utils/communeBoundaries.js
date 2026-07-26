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
