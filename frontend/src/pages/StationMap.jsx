import { useState, useEffect, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { stations } from '../api';
import { playSuccess, playError } from '../utils/sounds';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconIconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const STATION_COLORS = [
  '#E53935', '#1E88E5', '#43A047', '#FB8C00', '#8E24AA',
  '#00ACC1', '#F4511E', '#3949AB', '#7CB342', '#D81B60',
  '#5C6BC0', '#26A69A', '#AB47BC', '#EF5350', '#29B6F6',
  '#9CCC65', '#FFA726', '#EC407A', '#5E35B1', '#00E676',
];

function getStationColor(index) {
  return STATION_COLORS[index % STATION_COLORS.length];
}

function makeStationIcon(color) {
  return new L.DivIcon({
    className: 'map-station-icon',
    html: `<div style="background:${color};color:#fff;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;box-shadow:0 2px 8px ${color}80;border:2px solid #fff;">📌</div>`,
    iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -36],
  });
}

const driverIcon = new L.DivIcon({
  className: 'map-driver-icon',
  html: '<div style="background:#3B82F6;color:#fff;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;box-shadow:0 2px 6px rgba(59,130,246,0.4);border:2px solid #fff;">🚗</div>',
  iconSize: [26, 26], iconAnchor: [13, 26], popupAnchor: [0, -30],
});

const algeriaOutlineStyle = { color: '#1a1a2e', weight: 2, fillColor: '#e8e8f0', fillOpacity: 1 };
const communeBoundaryStyle = { color: '#999', weight: 0.5, fill: false };

let boundaryCache = null;
async function loadGeojson(url) {
  const res = await fetch(url);
  return res.json();
}

function MapCenterer({ center, zoom }) {
  const map = useMap();
  useEffect(() => { if (center) map.setView(center, zoom || map.getZoom()); }, [center, zoom, map]);
  return null;
}

function ZoomWatcher({ onZoom }) {
  const map = useMap();
  useEffect(() => {
    const h = () => onZoom(map.getZoom());
    map.on('zoomend', h);
    h();
    return () => map.off('zoomend', h);
  }, [map, onZoom]);
  return null;
}

function ClickMarker({ position, onClick }) {
  useMapEvents({ click(e) { onClick({ lat: e.latlng.lat, lng: e.latlng.lng }); } });
  if (!position) return null;
  return <Marker position={[position.lat, position.lng]} />;
}

function CoverageLayer({ stations: stationList, selectedStationId, showAll, boundaries, allCommunes }) {
  const features = useMemo(() => {
    const result = [];
    const targetStations = showAll ? stationList : stationList.filter((s) => s.id === selectedStationId);
    targetStations.forEach((s) => {
      if (!s.coverage_communes) return;
      const names = s.coverage_communes.split(',').map((n) => n.trim()).filter(Boolean);
      const color = getStationColor(stationList.indexOf(s));
      names.forEach((name) => {
        const commune = allCommunes.find((c) => c.name_ar === name || c.name_fr === name);
        if (!commune?.code) return;
        const boundary = boundaries.find((f) => f.properties.communeCode === String(commune.code));
        if (boundary) {
          result.push({
            ...boundary,
            properties: { ...boundary.properties, stationName: s.name, stationId: s.id, color },
          });
        } else {
          if (commune.lat && commune.lng) {
            const r = 0.025;
            const angles = [30, 90, 150, 210, 270, 330, 30];
            const coords = angles.map((a) => {
              const rad = (a * Math.PI) / 180;
              return [commune.lng + r * Math.cos(rad), commune.lat + r * Math.sin(rad) * 0.75];
            });
            result.push({
              type: 'Feature', properties: { nameFr: commune.name_fr, stationName: s.name, stationId: s.id, color },
              geometry: { type: 'Polygon', coordinates: [coords] },
            });
          }
        }
      });
    });
    return result;
  }, [stationList, selectedStationId, showAll, boundaries, allCommunes]);

  if (features.length === 0) return null;
  return (
    <>
      {features.map((f, i) => (
        <GeoJSON
          key={`cov-${f.properties.stationId}-${f.properties.nameFr || i}`}
          data={f}
          style={{ color: f.properties.color, fillColor: f.properties.color, fillOpacity: 0.35, weight: 3, opacity: 0.9 }}
        />
      ))}
    </>
  );
}

export default function StationMap() {
  const [data, setData] = useState({ stations: [], drivers: [] });
  const [loading, setLoading] = useState(true);
  const [splash, setSplash] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setSplash(false), 6000);
    return () => clearTimeout(t);
  }, []);
  const [editStation, setEditStation] = useState(null);
  const [form, setForm] = useState({ name: '', code: '', latitude: '', longitude: '', commune_name: '', coverage_communes: '' });
  const [communes, setCommunes] = useState([]);
  const [wilayas, setWilayas] = useState([]);
  const [boundaryData, setBoundaryData] = useState([]);
  const [algeriaOutline, setAlgeriaOutline] = useState(null);
  const [markerPos, setMarkerPos] = useState(null);
  const [sidebarTab, setSidebarTab] = useState('stations');
  const [saving, setSaving] = useState(false);
  const [filterStation, setFilterStation] = useState('');
  const [selectedStationId, setSelectedStationId] = useState(null);
  const [showAllCoverage, setShowAllCoverage] = useState(false);
  const [zoom, setZoom] = useState(6);

  const load = async () => {
    try {
      setLoading(true);
      const [mapData, algeria, boundaries, outline] = await Promise.all([
        stations.mapData(),
        loadGeojson('/data/algeria.json'),
        loadGeojson('/data/communes-boundaries.geojson'),
        loadGeojson('/data/algeria-boundary.geojson'),
      ]);
      setData(mapData);
      setCommunes(algeria.communes || []);
      setWilayas(algeria.wilayas || []);
      setBoundaryData(boundaries?.features || []);
      setAlgeriaOutline(outline);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filteredDrivers = useMemo(() => {
    if (!filterStation) return data.drivers;
    return data.drivers.filter((d) => String(d.station_id) === String(filterStation));
  }, [data.drivers, filterStation]);

  const openEdit = (s) => {
    setEditStation(s);
    setForm({
      name: s.name || '',
      code: s.code || '',
      latitude: s.latitude || '',
      longitude: s.longitude || '',
      commune_name: s.commune_name || '',
      coverage_communes: s.coverage_communes || '',
    });
    setMarkerPos(s.latitude && s.longitude ? { lat: Number(s.latitude), lng: Number(s.longitude) } : null);
  };

  const openCreate = () => {
    setEditStation({ _new: true });
    setForm({ name: '', code: '', latitude: '', longitude: '', commune_name: '', coverage_communes: '' });
    setMarkerPos(null);
  };

  const handleMapClick = (pos) => {
    if (!editStation) return;
    setMarkerPos(pos);
    setForm((prev) => ({ ...prev, latitude: pos.lat.toFixed(6), longitude: pos.lng.toFixed(6) }));
  };

  const handleSave = async () => {
    if (!form.name || !form.code) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name, code: form.code,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
        commune_name: form.commune_name || null,
        coverage_communes: form.coverage_communes || null,
      };
      if (editStation._new) await stations.create(payload);
      else await stations.update(editStation.id, payload);
      playSuccess();
      setEditStation(null);
      load();
    } catch (err) { playError(); }
    setSaving(false);
  };

  const handleStationClick = useCallback((station) => {
    if (editStation) return;
    setSelectedStationId((prev) => (prev === station.id ? null : station.id));
    setShowAllCoverage(false);
  }, [editStation]);

  const mapCenter = useMemo(() => {
    if (markerPos) return [markerPos.lat, markerPos.lng];
    if (data.stations.length > 0) {
      const withCoords = data.stations.filter((s) => s.latitude && s.longitude);
      if (withCoords.length > 0) {
        const avg = withCoords.reduce((acc, s) => [acc[0] + Number(s.latitude), acc[1] + Number(s.longitude)], [0, 0]);
        return [avg[0] / withCoords.length, avg[1] / withCoords.length];
      }
    }
    return [33.9716, 3.5886];
  }, [markerPos, data.stations]);

  if (splash) {
    const styles = {
      wrap: {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: 'radial-gradient(ellipse at 50% 40%, #1a0a0a 0%, #0d0505 50%, #050202 100%)',
        zIndex: 9999, overflow: 'hidden',
      },
      glow: {
        position: 'absolute', width: 500, height: 500, borderRadius: '50%',
        top: '10%', left: '50%', transform: 'translateX(-50%)',
        background: 'radial-gradient(circle, rgba(229,57,53,0.08) 0%, transparent 65%)',
        pointerEvents: 'none',
        animation: 'splashGlow 4s ease-in-out infinite alternate',
      },
      glass: {
        position: 'relative', zIndex: 2,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '48px 64px',
        background: 'rgba(10,5,5,0.6)',
        border: '1px solid rgba(229,57,53,0.15)',
        borderRadius: 24,
        backdropFilter: 'blur(24px)',
        animation: 'splashBorderGlow 4s ease-in-out infinite alternate',
      },
      logo: {
        width: 72, height: 72, marginBottom: 28,
        background: 'linear-gradient(135deg, #fff 20%, #E53935 100%)',
        mask: 'url(/NAVEXlogo.png) center/contain no-repeat',
        WebkitMask: 'url(/NAVEXlogo.png) center/contain no-repeat',
        animation: 'splashLogoAnim 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        opacity: 0, transform: 'scale(0.6)',
      },
      title: {
        fontSize: 32, fontWeight: 900, letterSpacing: 2,
        margin: '0 0 8px',
        background: 'linear-gradient(135deg, #fff 20%, #E53935 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
      },
      beta: {
        display: 'inline-block',
        fontSize: 11, fontWeight: 700, letterSpacing: 4, textTransform: 'uppercase',
        color: 'rgba(229,57,53,0.8)', border: '1px solid rgba(229,57,53,0.25)',
        borderRadius: 20, padding: '4px 18px',
        animation: 'splashPulse 2.5s ease-in-out infinite',
      },
      barTrack: {
        width: 200, height: 2, background: 'rgba(229,57,53,0.1)',
        borderRadius: 2, overflow: 'hidden',
      },
      barFill: {
        height: '100%', width: 0, borderRadius: 2,
        background: '#E53935',
        animation: 'splashBar 6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
      },
    };

    return (
      <div style={styles.wrap}>
        <style>{`
          @keyframes splashLogoAnim {
            0% { opacity: 0; transform: scale(0.6) translateY(30px); filter: blur(12px); }
            100% { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); }
          }
          @keyframes splashGlow {
            0% { opacity: 0.4; transform: translateX(-50%) scale(1); }
            100% { opacity: 1; transform: translateX(-50%) scale(1.3); }
          }
          @keyframes splashBorderGlow {
            0% { box-shadow: 0 0 20px rgba(229,57,53,0.03), 0 0 60px rgba(229,57,53,0.02); border-color: rgba(229,57,53,0.12); }
            100% { box-shadow: 0 0 40px rgba(229,57,53,0.08), 0 0 80px rgba(229,57,53,0.04); border-color: rgba(229,57,53,0.25); }
          }
          @keyframes splashPulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(229,57,53,0.15); }
            50% { box-shadow: 0 0 24px 4px rgba(229,57,53,0.08); }
          }
          @keyframes splashBar {
            0% { width: 0; }
            40% { width: 55%; }
            75% { width: 80%; }
            100% { width: 100%; }
          }
        `}</style>
        <div style={styles.glow} />
        <div style={styles.glass}>
          <div style={styles.logo} />
          <div style={{ textAlign: 'center' }}>
            <h1 style={styles.title}>NAVEX ZONING</h1>
            <span style={styles.beta}>beta</span>
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: 40, zIndex: 2 }}>
          <div style={styles.barTrack}>
            <div style={styles.barFill} />
          </div>
        </div>
      </div>
    );
  }

  if (loading) return <div className="loading">جاري تحميل الخريطة...</div>;

  return (
    <div className="sm-page">
      <div className="sm-sidebar">
        <div className="sm-sidebar-header">
          <h2>خريطة الجزائر</h2>
          <button className="btn btn-sm btn-primary" onClick={openCreate}>+ محطة</button>
        </div>
        <div className="sm-sidebar-tabs">
          <button className={`sm-sidebar-tab ${sidebarTab === 'stations' ? 'active' : ''}`} onClick={() => setSidebarTab('stations')}>
            المحطات ({data.stations.length})
          </button>
          <button className={`sm-sidebar-tab ${sidebarTab === 'drivers' ? 'active' : ''}`} onClick={() => setSidebarTab('drivers')}>
            السائقين ({filteredDrivers.length})
          </button>
        </div>
        {sidebarTab === 'drivers' && (
          <div className="sm-filter">
            <select value={filterStation} onChange={(e) => setFilterStation(e.target.value)} className="form-input" style={{ fontSize: 12 }}>
              <option value="">جميع المحطات</option>
              {data.stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
        {sidebarTab === 'stations' && (
          <div className="sm-filter">
            <button className={`btn btn-sm ${showAllCoverage ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => { setShowAllCoverage(!showAllCoverage); setSelectedStationId(null); }}
              style={{ width: '100%', fontSize: 12 }}>
              {showAllCoverage ? 'إخفاء التغطية' : 'عرض تغطية جميع المحطات'}
            </button>
          </div>
        )}
        <div className="sm-sidebar-list">
          {sidebarTab === 'stations' && data.stations.map((s, idx) => {
            const color = getStationColor(idx);
            const isSelected = selectedStationId === s.id;
            return (
              <div key={s.id} className={`sm-sidebar-item ${isSelected ? 'active' : ''}`}
                onClick={() => { handleStationClick(s); openEdit(s); }}>
                <div className="sm-sidebar-item-icon" style={{ background: `${color}18`, color }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block' }}></span>
                </div>
                <div className="sm-sidebar-item-info">
                  <div className="sm-sidebar-item-name">{s.name}</div>
                  <div className="sm-sidebar-item-meta">{s.code} {s.commune_name ? `· ${s.commune_name}` : ''}</div>
                  {s.coverage_communes && (
                    <div className="sm-sidebar-item-meta" style={{ color: 'var(--nx-primary)', fontSize: 10 }}>
                      {s.coverage_communes.split(',').length} بلدية
                    </div>
                  )}
                </div>
                <div className="sm-sidebar-item-status">
                  {s.latitude ? <span className="badge badge-success">📍</span> : <span className="badge badge-warning">?</span>}
                </div>
              </div>
            );
          })}
          {sidebarTab === 'drivers' && filteredDrivers.map((d) => (
            <div key={d.id} className="sm-sidebar-item">
              <div className="sm-sidebar-item-icon" style={{ background: '#3B82F620', color: '#3B82F6' }}>🚗</div>
              <div className="sm-sidebar-item-info">
                <div className="sm-sidebar-item-name">{d.full_name}</div>
                <div className="sm-sidebar-item-meta">{d.commune_name || d.wilaya_name || 'بدون عنوان'} {d.station_name ? `· ${d.station_name}` : ''}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="sm-map-area">
          <MapContainer center={mapCenter} zoom={6} scrollWheelZoom style={{ width: '100%', height: '100%', background: '#1a1a2e' }}>
          <MapCenterer center={mapCenter} zoom={markerPos ? 14 : undefined} />
          <ZoomWatcher onZoom={setZoom} />

          {editStation && <ClickMarker position={markerPos} onClick={handleMapClick} />}

          {algeriaOutline && <GeoJSON data={algeriaOutline} style={algeriaOutlineStyle} />}
          {boundaryData.length > 0 && <GeoJSON data={{ type: 'FeatureCollection', features: boundaryData }} style={communeBoundaryStyle} />}

          {communes.length > 0 && zoom >= 8 && (
            <GeoJSON
              data={{
                type: 'FeatureCollection',
                features: communes
                  .filter((c) => c.lat && c.lng && c.name_fr)
                  .map((c) => ({
                    type: 'Feature',
                    properties: { name: c.name_fr },
                    geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
                  })),
              }}
              pointToLayer={(feature, latlng) =>
                L.marker(latlng, {
                  icon: L.divIcon({
                    className: 'commune-label-icon',
                    html: `<span style="font-size:8px;color:#666;text-shadow:0 0 2px #fff,0 0 2px #fff,0 0 2px #fff;white-space:nowrap;pointer-events:none;font-weight:500;letter-spacing:-0.3px">${feature.properties.name}</span>`,
                    iconSize: [0, 0],
                    iconAnchor: [0, 0],
                  }),
                })
              }
            />
          )}

          {data.stations.filter((s) => s.latitude && s.longitude).map((s, idx) => {
            const color = getStationColor(data.stations.indexOf(s));
            return (
              <Marker key={`s-${s.id}`} position={[Number(s.latitude), Number(s.longitude)]}
                icon={makeStationIcon(color)}
                eventHandlers={{ click: () => { handleStationClick(s); openEdit(s); } }}>
                <Popup>
                  <strong>{s.name}</strong><br />{s.code}<br />
                  {s.commune_name && <>{s.commune_name}<br /></>}
                  {s.coverage_communes && <span style={{ fontSize: 12, color: '#666' }}>التغطية: {s.coverage_communes.split(',').length} بلدية</span>}
                </Popup>
              </Marker>
            );
          })}

          {filteredDrivers.filter((d) => d.latitude && d.longitude).map((d) => (
            <Marker key={`d-${d.id}`} position={[Number(d.latitude), Number(d.longitude)]} icon={driverIcon}>
              <Popup>
                <strong>{d.full_name}</strong><br />{d.commune_name || d.wilaya_name || ''}<br />
                {d.station_name && <span style={{ fontSize: 12, color: '#E53935' }}>المحطة: {d.station_name}</span>}
              </Popup>
            </Marker>
          ))}

          <CoverageLayer stations={data.stations} selectedStationId={selectedStationId}
            showAll={showAllCoverage} boundaries={boundaryData} allCommunes={communes} />
        </MapContainer>

        <div className="sm-legend">
          <div className="sm-legend-item"><span className="sm-legend-dot" style={{ background: '#E53935' }}></span> المحطة</div>
          <div className="sm-legend-item"><span className="sm-legend-dot" style={{ background: '#3B82F6' }}></span> السائق</div>
          <div className="sm-legend-item"><span className="sm-legend-dot" style={{ background: '#888', width: 14, height: 10, borderRadius: 2, opacity: 0.5 }}></span> منطقة التغطية</div>
        </div>
      </div>

      {editStation && (
        <div className="sm-edit-panel">
          <div className="sm-edit-header">
            <h3>{editStation._new ? 'محطة جديدة' : `تعديل: ${editStation.name}`}</h3>
            <button className="modal-close" onClick={() => setEditStation(null)}>✕</button>
          </div>
          <div className="sm-edit-body">
            <div className="form-group">
              <label className="form-label">اسم المحطة</label>
              <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">الرمز</label>
              <input className="form-input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">البلدية</label>
              <input className="form-input" value={form.commune_name} onChange={(e) => setForm({ ...form, commune_name: e.target.value })} placeholder="اسم البلدية..." />
            </div>
            <div className="sm-coords-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">خط العرض</label>
                <input className="form-input" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder="33.97..." />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">خط الطول</label>
                <input className="form-input" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder="3.58..." />
              </div>
            </div>
            <div className="sm-map-hint">
              {markerPos ? '📍 تم تحديد الموقع — اضغط على الخريطة لتحديده' : 'اضغط على الخريطة لتحديد موقع المحطة'}
            </div>
            <div className="form-group">
              <label className="form-label">منطقة التغطية</label>
              <textarea className="form-input" value={form.coverage_communes} onChange={(e) => setForm({ ...form, coverage_communes: e.target.value })}
                placeholder="أسماء البلديات مفصولة بفاصلة..." rows={3} style={{ fontSize: 12 }} />
              <small style={{ color: '#888', fontSize: 11 }}>أسماء البلديات مفصولة بفاصلة (مثال: بئر خادم, زرالدة, أولاد هداج)</small>
            </div>
            <div className="sm-edit-actions">
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.name || !form.code}>
                {saving ? 'جاري الحفظ...' : editStation._new ? 'إنشاء' : 'حفظ'}
              </button>
              <button className="btn btn-outline" onClick={() => setEditStation(null)}>إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
