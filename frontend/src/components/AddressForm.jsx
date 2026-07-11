import { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { drivers } from '../api';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

let algeriaData = null;
async function getAlgeriaData() {
  if (algeriaData) return algeriaData;
  const res = await fetch('/data/algeria.json');
  algeriaData = await res.json();
  return algeriaData;
}

function DraggableMarker({ position, onMove }) {
  const markerRef = useRef(null);
  const eventHandlers = useMemo(() => ({
    dragend() {
      const m = markerRef.current;
      if (m) {
        const p = m.getLatLng();
        onMove({ lat: p.lat.toFixed(6), lng: p.lng.toFixed(6) });
      }
    },
  }), [onMove]);
  return <Marker ref={markerRef} draggable position={position} eventHandlers={eventHandlers} />;
}

function ClickHandler({ onClick }) {
  useMapEvents({ click(e) { onClick({ lat: e.latlng.lat.toFixed(6), lng: e.latlng.lng.toFixed(6) }); } });
  return null;
}

function MapCenterer({ center }) {
  const map = useMap();
  useEffect(() => { if (center) map.setView(center, 13); }, [center, map]);
  return null;
}

// Arabic numeral helpers
const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
function toArabicNum(n) {
  return String(n).replace(/\d/g, d => arabicDigits[parseInt(d)]);
}

export default function AddressForm({ driverId, onSaved, compact }) {
  const [step, setStep] = useState(1);
  const [wilayas, setWilayas] = useState([]);
  const [communes, setCommunes] = useState([]);
  const [wilayaSearch, setWilayaSearch] = useState('');
  const [communeSearch, setCommuneSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    wilaya_code: null,
    wilaya_name: '',
    commune_code: null,
    commune_name: '',
    address_line: '',
    latitude: null,
    longitude: null,
  });

  const [hasExisting, setHasExisting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await getAlgeriaData();
        setWilayas(data.wilayas || []);
        setCommunes(data.communes || []);
        const addr = await drivers.getAddress(driverId);
        if (addr && addr.wilaya_code != null) {
          setForm({
            wilaya_code: addr.wilaya_code,
            wilaya_name: addr.wilaya_name || '',
            commune_code: addr.commune_code,
            commune_name: addr.commune_name || '',
            address_line: addr.address_line || '',
            latitude: addr.latitude != null ? Number(addr.latitude) : null,
            longitude: addr.longitude != null ? Number(addr.longitude) : null,
          });
          setHasExisting(true);
          if (addr.wilaya_code && addr.commune_code) setStep(3);
          else if (addr.wilaya_code) setStep(2);
        }
      } catch (e) { setError('فشل تحميل البيانات'); }
      setLoading(false);
    })();
  }, [driverId]);

  const filteredWilayas = wilayaSearch
    ? wilayas.filter(w => w.name_ar.includes(wilayaSearch) || w.name_fr.toLowerCase().includes(wilayaSearch.toLowerCase()))
    : wilayas;

  const filteredCommunes = (form.wilaya_code
    ? communes.filter(c => c.wilaya_code === form.wilaya_code && (
      !communeSearch || c.name_ar.includes(communeSearch) || c.name_fr.toLowerCase().includes(communeSearch.toLowerCase())
    ))
    : []
  ).sort((a, b) => a.name_ar.localeCompare(b.name_ar, 'ar'));

  const selectedCommune = useMemo(() => {
    if (!form.commune_code) return null;
    return communes.find(c => c.code === form.commune_code) || null;
  }, [form.commune_code, communes]);

  const mapCenter = form.latitude && form.longitude
    ? [form.latitude, form.longitude]
    : selectedCommune
      ? [selectedCommune.lat, selectedCommune.lng]
      : [28.0339, 1.6596];

  const handleWilayaSelect = (w) => {
    setForm(prev => ({ ...prev, wilaya_code: w.code, wilaya_name: w.name_ar, commune_code: null, commune_name: '' }));
    setCommuneSearch('');
    setStep(2);
  };

  const handleCommuneSelect = (c) => {
    setForm(prev => ({
      ...prev, commune_code: c.code, commune_name: c.name_ar,
      latitude: Number(c.lat.toFixed(6)), longitude: Number(c.lng.toFixed(6)),
    }));
    setStep(3);
  };

  const handleMapMove = ({ lat, lng }) => {
    setForm(prev => ({ ...prev, latitude: Number(lat), longitude: Number(lng) }));
  };

  const handleSave = async () => {
    if (!form.wilaya_code) { setError('يرجى اختيار الولاية'); return; }
    if (!form.commune_code) { setError('يرجى اختيار البلدية'); return; }
    if (!form.latitude || !form.longitude) { setError('يرجى تحديد الموقع على الخريطة'); return; }
    setSaving(true);
    setError('');
    try {
      await drivers.updateAddress(driverId, {
        wilaya_code: form.wilaya_code,
        wilaya_name: form.wilaya_name,
        commune_code: form.commune_code,
        commune_name: form.commune_name,
        address_line: form.address_line,
        latitude: form.latitude,
        longitude: form.longitude,
      });
      setHasExisting(true);
      onSaved?.();
    } catch (e) {
      setError(e.message || 'فشل الحفظ');
    }
    setSaving(false);
  };

  if (loading) return <div className="nx-loading-dots"><span></span><span></span><span></span></div>;

  const stepClass = (s) => `af-step ${step === s ? 'active' : step > s ? 'done' : ''}`;

  return (
    <div className={`address-form ${compact ? 'af-compact' : ''}`}>
      <div className="af-progress">
        {[
          { num: 1, label: 'الولاية' },
          { num: 2, label: 'البلدية' },
          { num: 3, label: 'الموقع' },
        ].map(s => (
          <div key={s.num} className={stepClass(s.num)}>
            <div className="af-step-circle">{s.num}</div>
            <div className="af-step-label">{s.label}</div>
          </div>
        ))}
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 12 }} onClick={() => setError('')}>{error}</div>}

      {step === 1 && (
        <div className="af-panel">
          <div className="af-search-wrap">
            <input className="af-search" placeholder="ابحث عن ولاية..." value={wilayaSearch} onChange={e => setWilayaSearch(e.target.value)} autoFocus />
          </div>
          <div className="af-list">
            {filteredWilayas.map(w => (
              <div key={w.code} className={`af-list-item ${form.wilaya_code === w.code ? 'selected' : ''}`}
                onClick={() => handleWilayaSelect(w)}>
                <span className="af-item-name">{w.name_ar}</span>
                <span className="af-item-sub">{w.name_fr} · {toArabicNum(w.code)}</span>
              </div>
            ))}
            {filteredWilayas.length === 0 && <div className="af-empty">لا توجد ولايات مطابقة</div>}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="af-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <button className="btn btn-sm btn-outline" onClick={() => setStep(1)}>→ رجوع</button>
            <span style={{ fontSize: 13, color: '#E53935', fontWeight: 600 }}>{form.wilaya_name}</span>
          </div>
          <div className="af-search-wrap">
            <input className="af-search" placeholder="ابحث عن بلدية..." value={communeSearch} onChange={e => setCommuneSearch(e.target.value)} autoFocus />
          </div>
          <div className="af-list">
            {filteredCommunes.map(c => (
              <div key={c.code} className={`af-list-item ${form.commune_code === c.code ? 'selected' : ''}`}
                onClick={() => handleCommuneSelect(c)}>
                <span className="af-item-name">{c.name_ar}</span>
                <span className="af-item-sub">{c.name_fr}</span>
              </div>
            ))}
            {filteredCommunes.length === 0 && <div className="af-empty">لا توجد بلديات مطابقة</div>}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="af-panel">
          <div className="af-selected-info">
            <span style={{ fontSize: 13, color: '#888' }}>{form.wilaya_name} · {form.commune_name}</span>
            <button className="btn btn-sm btn-outline" onClick={() => setStep(2)}>→ تعديل</button>
          </div>
          <div className="af-map-wrap" style={{ height: compact ? 260 : 320 }}>
            <MapContainer center={mapCenter} zoom={13} scrollWheelZoom style={{ width: '100%', height: '100%', borderRadius: 12, zIndex: 0 }} key={`${form.latitude || ''}-${form.longitude || ''}`}>
              <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <ClickHandler onClick={handleMapMove} />
              <DraggableMarker position={mapCenter} onMove={handleMapMove} />
              <MapCenterer center={mapCenter} />
            </MapContainer>
          </div>
          <div className="af-coords">
            <span>العرض: {form.latitude}</span>
            <span>الطول: {form.longitude}</span>
          </div>
          <input className="af-address-line" placeholder="تفاصيل العنوان (اختياري) — مثل: شارع، رقم البناية، الطابق..."
            value={form.address_line} onChange={e => setForm(prev => ({ ...prev, address_line: e.target.value }))} />
          <button className="btn btn-primary af-save" onClick={handleSave} disabled={saving}>
            {saving ? 'جاري الحفظ...' : hasExisting ? 'تحديث العنوان' : 'حفظ العنوان'}
          </button>
        </div>
      )}
    </div>
  );
}
