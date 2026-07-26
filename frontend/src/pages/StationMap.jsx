import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { stations } from '../api';
import { playSuccess, playError } from '../utils/sounds';
import { fetchCommuneBoundaries } from '../utils/communeBoundaries';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconIconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const stationIcon = new L.DivIcon({
  className: 'map-station-icon',
  html: '<div style="background:#E53935;color:#fff;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;box-shadow:0 2px 8px rgba(229,57,53,0.5);border:2px solid #fff;">📌</div>',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -36],
});

const driverIcon = new L.DivIcon({
  className: 'map-driver-icon',
  html: '<div style="background:#3B82F6;color:#fff;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;box-shadow:0 2px 6px rgba(59,130,246,0.4);border:2px solid #fff;">🚗</div>',
  iconSize: [26, 26],
  iconAnchor: [13, 26],
  popupAnchor: [0, -30],
});

let algeriaData = null;
async function getAlgeriaData() {
  if (algeriaData) return algeriaData;
  const res = await fetch('/data/algeria.json');
  algeriaData = await res.json();
  return algeriaData;
}

function MapCenterer({ center, zoom }) {
  const map = useMap();
  useEffect(() => { if (center) map.setView(center, zoom || map.getZoom()); }, [center, zoom, map]);
  return null;
}

function ClickMarker({ position, onClick }) {
  useMapEvents({ click(e) { onClick({ lat: e.latlng.lat, lng: e.latlng.lng }); } });
  if (!position) return null;
  return <Marker position={[position.lat, position.lng]} />;
}

function CommuneBoundaryLayer({ communesList, algeriaCommunes }) {
  const [features, setFeatures] = useState([]);

  useEffect(() => {
    if (communesList.length === 0) { setFeatures([]); return; }
    let cancelled = false;
    (async () => {
      const results = await fetchCommuneBoundaries(communesList);
      if (!cancelled) setFeatures(results.filter(Boolean));
    })();
    return () => { cancelled = true; };
  }, [communesList.join(',')]);

  if (features.length === 0) return null;
  return (
    <>
      {features.map((f) => (
        <GeoJSON
          key={`boundary-${f.properties.name}`}
          data={f}
          style={{ color: '#E53935', fillColor: '#E53935', fillOpacity: 0.1, weight: 2, dashArray: '5 5' }}
        />
      ))}
    </>
  );
}

export default function StationMap() {
  const [data, setData] = useState({ stations: [], drivers: [] });
  const [loading, setLoading] = useState(true);
  const [editStation, setEditStation] = useState(null);
  const [form, setForm] = useState({ name: '', code: '', latitude: '', longitude: '', commune_name: '', coverage_communes: '' });
  const [communes, setCommunes] = useState([]);
  const [wilayas, setWilayas] = useState([]);
  const [coverageSearch, setCoverageSearch] = useState('');
  const [showCoverageList, setShowCoverageList] = useState(false);
  const [coverageWilaya, setCoverageWilaya] = useState('');
  const [markerPos, setMarkerPos] = useState(null);
  const [sidebarTab, setSidebarTab] = useState('stations');
  const [saving, setSaving] = useState(false);
  const [filterStation, setFilterStation] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      const [mapData, algeria] = await Promise.all([stations.mapData(), getAlgeriaData()]);
      setData(mapData);
      setCommunes(algeria.communes || []);
      setWilayas(algeria.wilayas || []);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filteredDrivers = useMemo(() => {
    if (!filterStation) return data.drivers;
    return data.drivers.filter((d) => String(d.station_id) === String(filterStation));
  }, [data.drivers, filterStation]);

  const coverageCommunesList = useMemo(() => {
    if (!form.coverage_communes) return [];
    return form.coverage_communes.split(',').map((s) => s.trim()).filter(Boolean);
  }, [form.coverage_communes]);

  const coverageWilayaObj = useMemo(() => {
    if (!coverageWilaya) return null;
    return wilayas.find((w) => w.name_ar === coverageWilaya) || null;
  }, [coverageWilaya, wilayas]);

  const coveragePool = useMemo(() => {
    if (!coverageWilayaObj) return communes;
    return communes.filter((c) => c.wilaya_code === coverageWilayaObj.code);
  }, [coverageWilayaObj, communes]);

  const filteredCommunes = useMemo(() => {
    const available = coveragePool.filter((c) => !coverageCommunesList.includes(c.name_ar));
    if (!coverageSearch) return available.slice(0, 15);
    const q = coverageSearch.toLowerCase();
    return available.filter((c) =>
      c.name_ar.includes(coverageSearch) || c.name_fr.toLowerCase().includes(q)
    ).slice(0, 15);
  }, [coverageSearch, coveragePool, coverageCommunesList]);

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
    setCoverageSearch('');
    setCoverageWilaya('');
    setShowCoverageList(false);
  };

  const openCreate = () => {
    setEditStation({ _new: true });
    setForm({ name: '', code: '', latitude: '', longitude: '', commune_name: '', coverage_communes: '' });
    setMarkerPos(null);
    setCoverageSearch('');
    setCoverageWilaya('');
  };

  const handleMapClick = (pos) => {
    if (!editStation) return;
    setMarkerPos(pos);
    setForm((prev) => ({ ...prev, latitude: pos.lat.toFixed(6), longitude: pos.lng.toFixed(6) }));
  };

  const addCoverageCommune = (commune) => {
    const current = form.coverage_communes ? form.coverage_communes.split(',').map((s) => s.trim()) : [];
    if (!current.includes(commune.name_ar)) {
      current.push(commune.name_ar);
      setForm((prev) => ({ ...prev, coverage_communes: current.join(', ') }));
    }
    setCoverageSearch('');
    setShowCoverageList(false);
  };

  const removeCoverageCommune = (name) => {
    const current = form.coverage_communes.split(',').map((s) => s.trim()).filter((s) => s && s !== name);
    setForm((prev) => ({ ...prev, coverage_communes: current.join(', ') }));
  };

  const handleSave = async () => {
    if (!form.name || !form.code) { return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        code: form.code,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
        commune_name: form.commune_name || null,
        coverage_communes: form.coverage_communes || null,
      };
      if (editStation._new) {
        await stations.create(payload);
      } else {
        await stations.update(editStation.id, payload);
      }
      playSuccess();
      setEditStation(null);
      load();
    } catch (err) { playError(); }
    setSaving(false);
  };

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

  if (loading) return <div className="loading">جاري تحميل الخريطة...</div>;

  return (
    <div className="sm-page">
      <div className="sm-sidebar">
        <div className="sm-sidebar-header">
          <h2>خريطة المحطات</h2>
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

        <div className="sm-sidebar-list">
          {sidebarTab === 'stations' && data.stations.map((s) => (
            <div key={s.id} className={`sm-sidebar-item ${editStation?.id === s.id ? 'active' : ''}`} onClick={() => openEdit(s)}>
              <div className="sm-sidebar-item-icon" style={{ background: '#E5393520', color: '#E53935' }}>📌</div>
              <div className="sm-sidebar-item-info">
                <div className="sm-sidebar-item-name">{s.name}</div>
                <div className="sm-sidebar-item-meta">{s.code} {s.commune_name ? `· ${s.commune_name}` : ''}</div>
              </div>
              <div className="sm-sidebar-item-status">
                {s.latitude ? <span className="badge badge-success">📍</span> : <span className="badge badge-warning">?</span>}
              </div>
            </div>
          ))}
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
        <MapContainer center={mapCenter} zoom={6} scrollWheelZoom style={{ width: '100%', height: '100%' }}>
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapCenterer center={mapCenter} zoom={markerPos ? 14 : undefined} />

          {editStation && <ClickMarker position={markerPos} onClick={handleMapClick} />}

          {data.stations.filter((s) => s.latitude && s.longitude).map((s) => (
            <Marker
              key={`s-${s.id}`}
              position={[Number(s.latitude), Number(s.longitude)]}
              icon={stationIcon}
              eventHandlers={{ click: () => openEdit(s) }}
            >
              <Popup>
                <strong>{s.name}</strong><br />
                {s.code}<br />
                {s.commune_name && <>{s.commune_name}<br /></>}
                {s.coverage_communes && <span style={{ fontSize: 12, color: '#666' }}>التغطية: {s.coverage_communes}</span>}
              </Popup>
            </Marker>
          ))}

          {filteredDrivers.filter((d) => d.latitude && d.longitude).map((d) => (
            <Marker
              key={`d-${d.id}`}
              position={[Number(d.latitude), Number(d.longitude)]}
              icon={driverIcon}
            >
              <Popup>
                <strong>{d.full_name}</strong><br />
                {d.commune_name || d.wilaya_name || ''}<br />
                {d.station_name && <span style={{ fontSize: 12, color: '#E53935' }}>المحطة: {d.station_name}</span>}
              </Popup>
            </Marker>
          ))}

          {coverageCommunesList.length > 0 && (
            <CommuneBoundaryLayer communesList={coverageCommunesList} algeriaCommunes={communes} />
          )}
        </MapContainer>

        {!editStation && (
          <div className="sm-legend">
            <div className="sm-legend-item"><span className="sm-legend-dot" style={{ background: '#E53935' }}></span> المحطة</div>
            <div className="sm-legend-item"><span className="sm-legend-dot" style={{ background: '#3B82F6' }}></span> السائق</div>
            <div className="sm-legend-item"><span className="sm-legend-dot" style={{ background: '#E53935', opacity: 0.3, border: '2px dashed #E53935' }}></span> منطقة التغطية</div>
          </div>
        )}
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
              <div className="sf-coverage-wilaya-row">
                <select className="form-input" value={coverageWilaya} onChange={(e) => { setCoverageWilaya(e.target.value); setCoverageSearch(''); }}>
                  <option value="">جميع الولايات</option>
                  {wilayas.map((w) => <option key={w.code} value={w.name_ar}>{w.name_ar}</option>)}
                </select>
                <span className="sf-coverage-hint">فلتر حسب الولاية أو ابحث في جميع الولايات</span>
              </div>
              <div className="sm-coverage-input-wrap">
                <input
                  className="form-input"
                  value={coverageSearch}
                  onChange={(e) => { setCoverageSearch(e.target.value); setShowCoverageList(true); }}
                  onFocus={() => setShowCoverageList(true)}
                  placeholder="ابحث عن بلدية..."
                />
                {showCoverageList && filteredCommunes.length > 0 && (
                  <div className="sm-coverage-dropdown">
                    {filteredCommunes.map((c) => {
                      const wilaya = wilayas.find((w) => w.code === c.wilaya_code);
                      return (
                        <div key={c.code} className="sm-coverage-option" onClick={() => addCoverageCommune(c)}>
                          <span>{c.name_ar}</span>
                          <span style={{ fontSize: 11, color: '#999' }}>{wilaya ? wilaya.name_ar : ''} · {c.name_fr}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {coverageCommunesList.length > 0 && (
                <div className="sm-coverage-tags">
                  {coverageCommunesList.map((name) => (
                    <span key={name} className="sm-coverage-tag">
                      {name}
                      <button onClick={() => removeCoverageCommune(name)}>✕</button>
                    </span>
                  ))}
                </div>
              )}
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
