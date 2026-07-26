import { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import LoadingScreen from '../components/LoadingScreen';
import { stations } from '../api';
import { playSuccess, playError } from '../utils/sounds';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconIconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const pinIcon = new L.DivIcon({
  className: 'sm-pin-icon',
  html: '<div style="background:#E53935;color:#fff;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 2px 8px rgba(229,57,53,0.5);border:2px solid #fff;">📌</div>',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

function ClickMarker({ position, onPick }) {
  useMapEvents({ click(e) { onPick({ lat: e.latlng.lat, lng: e.latlng.lng }); } });
  if (!position) return null;
  return <Marker position={[position.lat, position.lng]} icon={pinIcon} />;
}

let algeriaData = null;
async function getAlgeriaData() {
  if (algeriaData) return algeriaData;
  const res = await fetch('/data/algeria.json');
  algeriaData = await res.json();
  return algeriaData;
}

export default function StationsManagement() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', code: '', wilaya_name: '', commune_name: '', latitude: '', longitude: '', coverage_communes: '' });
  const [error, setError] = useState('');
  const [wilayas, setWilayas] = useState([]);
  const [communes, setCommunes] = useState([]);
  const [communeSearch, setCommuneSearch] = useState('');
  const [showCommuneList, setShowCommuneList] = useState(false);
  const [coverageSearch, setCoverageSearch] = useState('');
  const [showCoverageList, setShowCoverageList] = useState(false);
  const [coverageWilaya, setCoverageWilaya] = useState('');
  const [markerPos, setMarkerPos] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const [data, algeria] = await Promise.all([stations.list(), getAlgeriaData()]);
      setList(data);
      setWilayas(algeria.wilayas || []);
      setCommunes(algeria.communes || []);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const selectedWilaya = useMemo(() => {
    if (!form.wilaya_name) return null;
    return wilayas.find((w) => w.name_ar === form.wilaya_name) || null;
  }, [form.wilaya_name, wilayas]);

  const stationCommunes = useMemo(() => {
    if (!selectedWilaya) return [];
    return communes.filter((c) => c.wilaya_code === selectedWilaya.code);
  }, [selectedWilaya, communes]);

  const filteredStationCommunes = useMemo(() => {
    if (!communeSearch) return stationCommunes.slice(0, 20);
    const q = communeSearch.toLowerCase();
    return stationCommunes.filter((c) => c.name_ar.includes(communeSearch) || c.name_fr.toLowerCase().includes(q)).slice(0, 15);
  }, [communeSearch, stationCommunes]);

  const coverageWilayaObj = useMemo(() => {
    if (!coverageWilaya) return selectedWilaya;
    return wilayas.find((w) => w.name_ar === coverageWilaya) || selectedWilaya;
  }, [coverageWilaya, selectedWilaya, wilayas]);

  const coverageCommunesPool = useMemo(() => {
    if (!coverageWilayaObj) return [];
    return communes.filter((c) => c.wilaya_code === coverageWilayaObj.code);
  }, [coverageWilayaObj, communes]);

  const filteredCoverageCommunes = useMemo(() => {
    if (!coverageSearch) return coverageCommunesPool.slice(0, 20);
    const q = coverageSearch.toLowerCase();
    return coverageCommunesPool.filter((c) => c.name_ar.includes(coverageSearch) || c.name_fr.toLowerCase().includes(q)).slice(0, 15);
  }, [coverageSearch, coverageCommunesPool]);

  const coverageList = useMemo(() => {
    if (!form.coverage_communes) return [];
    return form.coverage_communes.split(',').map((s) => s.trim()).filter(Boolean);
  }, [form.coverage_communes]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleWilayaChange = (wilayaName) => {
    setForm({ ...form, wilaya_name: wilayaName, commune_name: '' });
    setCommuneSearch('');
  };

  const addCommune = (commune) => {
    setForm({ ...form, commune_name: commune.name_ar });
    setCommuneSearch('');
    setShowCommuneList(false);
  };

  const addCoverageCommune = (commune) => {
    const current = form.coverage_communes ? form.coverage_communes.split(',').map((s) => s.trim()) : [];
    if (!current.includes(commune.name_ar)) {
      current.push(commune.name_ar);
      setForm({ ...form, coverage_communes: current.join(', ') });
    }
    setCoverageSearch('');
    setShowCoverageList(false);
  };

  const removeCoverageCommune = (name) => {
    const current = form.coverage_communes.split(',').map((s) => s.trim()).filter((s) => s && s !== name);
    setForm({ ...form, coverage_communes: current.join(', ') });
  };

  const handleMapPick = (pos) => {
    setMarkerPos(pos);
    setForm((prev) => ({ ...prev, latitude: pos.lat.toFixed(6), longitude: pos.lng.toFixed(6) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const payload = {
        name: form.name,
        code: form.code,
        wilaya_name: form.wilaya_name || null,
        commune_name: form.commune_name || null,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
        coverage_communes: form.coverage_communes || null,
      };
      if (editing) {
        await stations.update(editing.id, payload);
      } else {
        await stations.create(payload);
      }
      setShowForm(false);
      setEditing(null);
      setForm({ name: '', code: '', wilaya_name: '', commune_name: '', latitude: '', longitude: '', coverage_communes: '' });
      setMarkerPos(null);
      playSuccess();
      load();
    } catch (err) { playError(); setError(err.message); }
  };

  const handleEdit = (s) => {
    setEditing(s);
    setForm({
      name: s.name,
      code: s.code,
      wilaya_name: s.wilaya_name || '',
      commune_name: s.commune_name || '',
      latitude: s.latitude || '',
      longitude: s.longitude || '',
      coverage_communes: s.coverage_communes || '',
    });
    setMarkerPos(s.latitude && s.longitude ? { lat: Number(s.latitude), lng: Number(s.longitude) } : null);
    setCoverageWilaya('');
    setCommuneSearch('');
    setCoverageSearch('');
    setShowForm(true);
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`هل أنت متأكد من حذف المحطة "${name}"؟`)) return;
    try {
      await stations.delete(id);
      playSuccess();
      load();
    } catch (err) { playError(); setError(err.message); }
  };

  const mapCenter = useMemo(() => {
    if (markerPos) return [markerPos.lat, markerPos.lng];
    if (selectedWilaya) return [selectedWilaya.lat, selectedWilaya.lng];
    return [33.9716, 3.5886];
  }, [markerPos, selectedWilaya]);

  if (loading) return <LoadingScreen />;

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-content">
          <h2>إدارة المحطات</h2>
          <p>{list.length} محطة</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => {
            setEditing(null);
            setForm({ name: '', code: '', wilaya_name: '', commune_name: '', latitude: '', longitude: '', coverage_communes: '' });
            setMarkerPos(null);
            setCoverageWilaya('');
            setShowForm(true);
          }}>+ إضافة محطة</button>
        </div>
      </div>

      {error && <div className="alert alert-error" onClick={() => setError('')}>{error}</div>}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editing ? 'تعديل المحطة' : 'إضافة محطة جديدة'}</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="sf-row">
                <div className="form-group sf-grow">
                  <label className="form-label">اسم المحطة</label>
                  <input className="form-input" name="name" value={form.name} onChange={handleChange} placeholder="مثال: محطة الشارقة" required />
                </div>
                <div className="form-group sf-grow">
                  <label className="form-label">رمز المحطة</label>
                  <input className="form-input" name="code" value={form.code} onChange={handleChange} placeholder="مثال: SHJ-01" required />
                </div>
              </div>

              <div className="sf-row">
                <div className="form-group sf-grow">
                  <label className="form-label">الولاية</label>
                  <select className="form-input" value={form.wilaya_name} onChange={(e) => handleWilayaChange(e.target.value)}>
                    <option value="">اختر الولاية...</option>
                    {wilayas.map((w) => <option key={w.code} value={w.name_ar}>{w.name_ar} ({w.name_fr})</option>)}
                  </select>
                </div>
                <div className="form-group sf-grow">
                  <label className="form-label">البلدية</label>
                  <div className="sf-commune-input-wrap">
                    <input
                      className="form-input"
                      value={form.commune_name || communeSearch}
                      onChange={(e) => { setCommuneSearch(e.target.value); setForm({ ...form, commune_name: '' }); setShowCommuneList(true); }}
                      onFocus={() => setShowCommuneList(true)}
                      placeholder={!form.wilaya_name ? 'اختر الولاية أولاً...' : 'ابحث عن بلدية...'}
                      disabled={!form.wilaya_name}
                    />
                    {showCommuneList && filteredStationCommunes.length > 0 && (
                      <div className="sf-commune-dropdown">
                        {filteredStationCommunes.map((c) => (
                          <div key={c.code} className="sf-commune-option" onClick={() => addCommune(c)}>
                            <span>{c.name_ar}</span>
                            <span style={{ fontSize: 11, color: '#999' }}>{c.name_fr}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="sf-row">
                <div className="form-group sf-grow">
                  <label className="form-label">خط العرض</label>
                  <input className="form-input" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder="33.9716..." />
                </div>
                <div className="form-group sf-grow">
                  <label className="form-label">خط الطول</label>
                  <input className="form-input" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder="3.5886..." />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">موقع المحطة على الخريطة</label>
                <div className="sf-map-hint">
                  {markerPos ? '📍 الموقع محدد — اضغط على الخريطة لتحديده' : 'اضغط على الخريطة لتحديد موقع المحطة'}
                </div>
                <div className="sf-map-wrap">
                  <MapContainer center={mapCenter} zoom={selectedWilaya && !markerPos ? 10 : 6} scrollWheelZoom style={{ width: '100%', height: '220px', borderRadius: 'var(--nx-radius)', zIndex: 1 }}>
                    <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <ClickMarker position={markerPos} onPick={handleMapPick} />
                  </MapContainer>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">منطقة التغطية (البلديات التي تغطيها المحطة)</label>
                <div className="sf-coverage-wilaya-row">
                  <select className="form-input" value={coverageWilaya} onChange={(e) => { setCoverageWilaya(e.target.value); setCoverageSearch(''); }}>
                    <option value="">{form.wilaya_name || 'اختر الولاية أولاً'}</option>
                    {wilayas.map((w) => <option key={w.code} value={w.name_ar}>{w.name_ar} ({w.name_fr})</option>)}
                  </select>
                  <span className="sf-coverage-hint">اختر ولاية أخرى لإضافة بلديات خارج الولاية</span>
                </div>
                <div className="sf-commune-input-wrap">
                  <input
                    className="form-input"
                    value={coverageSearch}
                    onChange={(e) => { setCoverageSearch(e.target.value); setShowCoverageList(true); }}
                    onFocus={() => setShowCoverageList(true)}
                    placeholder={!coverageWilayaObj ? 'اختر الولاية أولاً...' : `ابحث عن بلدية في ${coverageWilayaObj.name_ar}...`}
                    disabled={!coverageWilayaObj}
                  />
                  {showCoverageList && filteredCoverageCommunes.length > 0 && (
                    <div className="sf-commune-dropdown">
                      {filteredCoverageCommunes.map((c) => (
                        <div key={c.code} className="sf-commune-option" onClick={() => addCoverageCommune(c)}>
                          <span>{c.name_ar}</span>
                          <span style={{ fontSize: 11, color: '#999' }}>{c.name_fr}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {coverageList.length > 0 && (
                  <div className="sf-coverage-tags">
                    {coverageList.map((name) => (
                      <span key={name} className="sf-coverage-tag">
                        {name}
                        <button type="button" onClick={() => removeCoverageCommune(name)}>✕</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-actions">
                <button type="submit" className="btn btn-primary">{editing ? 'حفظ' : 'إنشاء'}</button>
                <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="table-container">
        {list.length === 0 ? (
          <div className="nx-empty">
            <div className="nx-empty-icon">🏭</div>
            <h3>لا توجد محطات بعد</h3>
            <p>قم بإضافة أول محطة لتوزيع السائقين والمشغلين</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>الرمز</th>
                <th>الولاية / البلدية</th>
                <th>الموقع</th>
                <th>التغطية</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id}>
                  <td><strong>{s.name}</strong></td>
                  <td><code>{s.code}</code></td>
                  <td className="text-sm">
                    {s.wilaya_name && <div style={{ fontWeight: 600 }}>{s.wilaya_name}</div>}
                    {s.commune_name && <div className="text-muted">{s.commune_name}</div>}
                    {!s.wilaya_name && !s.commune_name && <span className="text-muted">—</span>}
                  </td>
                  <td className="text-sm">
                    {s.latitude && s.longitude ? (
                      <span className="badge badge-success">📍 {(Number(s.latitude)).toFixed(4)}, {(Number(s.longitude)).toFixed(4)}</span>
                    ) : <span className="text-muted">—</span>}
                  </td>
                  <td className="text-sm">
                    {s.coverage_communes ? (
                      <div className="sm-coverage-tags">
                        {s.coverage_communes.split(',').map((c) => c.trim()).filter(Boolean).slice(0, 3).map((c) => (
                          <span key={c} className="sm-coverage-tag">{c}</span>
                        ))}
                        {s.coverage_communes.split(',').length > 3 && (
                          <span className="sm-coverage-tag" style={{ background: 'var(--nx-bg-glass)', color: 'var(--nx-text-muted)' }}>
                            +{s.coverage_communes.split(',').length - 3}
                          </span>
                        )}
                      </div>
                    ) : <span className="text-muted">—</span>}
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn-sm btn-outline" onClick={() => handleEdit(s)}>تعديل</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(s.id, s.name)}>حذف</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
