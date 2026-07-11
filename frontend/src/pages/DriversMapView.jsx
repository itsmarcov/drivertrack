import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { drivers } from '../api';
import LoadingScreen from '../components/LoadingScreen';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function DriversMapView() {
  const [driverList, setDriverList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    drivers.list().then(data => {
      setDriverList(data.filter(d => d.latitude && d.longitude));
    }).catch(err => setError(err.message)).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingScreen message="جاري تحميل بيانات السائقين..." />;

  const defaultCenter = driverList.length > 0
    ? [Number(driverList[0].latitude), Number(driverList[0].longitude)]
    : [28.0339, 1.6596];

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-content">
          <h2>خريطة السائقين</h2>
          <p>{driverList.length} سائق مع عنوان محدد</p>
        </div>
      </div>
      {error && <div className="alert alert-error" onClick={() => setError('')}>{error}</div>}
      {driverList.length === 0 ? (
        <div className="nx-empty">
          <div className="nx-empty-icon">🗺️</div>
          <h3>لا توجد مواقع محددة</h3>
          <p>سائق واحد على الأقل بحاجة لتحديد عنوان سكنه لظهوره على الخريطة</p>
        </div>
      ) : (
        <div className="mv-map-wrap">
          <MapContainer center={defaultCenter} zoom={6} scrollWheelZoom style={{ width: '100%', height: '100%', borderRadius: 12, zIndex: 0 }}>
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {driverList.map(d => (
              <Marker key={d.id} position={[Number(d.latitude), Number(d.longitude)]}>
                <Popup>
                  <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                    <strong>{d.full_name}</strong><br />
                    {d.wilaya_name && <span>{d.wilaya_name}{d.commune_name ? ` · ${d.commune_name}` : ''}<br /></span>}
                    {d.phone && <span style={{ color: '#888' }}>{d.phone}</span>}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}
    </div>
  );
}
