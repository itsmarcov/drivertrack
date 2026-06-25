import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import DriverDashboard from './pages/DriverDashboard';
import AdminDashboard from './pages/AdminDashboard';
import DriversManagement from './pages/DriversManagement';
import OpsManagement from './pages/OpsManagement';
import AttendanceLogs from './pages/AttendanceLogs';
import ScanQR from './pages/ScanQR';
import StationsManagement from './pages/StationsManagement';
import PenaltiesManagement from './pages/PenaltiesManagement';
import SettingsManagement from './pages/SettingsManagement';
import AbsencesManagement from './pages/AbsencesManagement';

function HomeRedirect() {
  const { user } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!user) { navigate('/login', { replace: true }); return; }
    if (user.role === 'driver') { navigate('/driver', { replace: true }); return; }
    navigate('/admin', { replace: true });
  }, [user, navigate]);
  return (
    <div className="loading-screen" style={{ minHeight: '100vh' }}>
      <div className="nx-loader">
        <div className="nx-spinner"></div>
        <span className="nx-loader-label">جاري التوجيه...</span>
      </div>
    </div>
  );
}

export default function App() {
  const { loading } = useAuth();
  if (loading) return (
    <div className="loading-screen">
      <div className="nx-loader">
        <div className="nx-spinner"></div>
        <span className="nx-loader-label">جاري التحميل...</span>
      </div>
    </div>
  );
  return (
    <div className="app">
      <Navbar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/driver" element={<ProtectedRoute roles={['driver']}><DriverDashboard /></ProtectedRoute>} />
          <Route path="/driver/attendance" element={<ProtectedRoute roles={['driver']}><AttendanceLogs /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute roles={['admin', 'ops']}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/drivers" element={<ProtectedRoute roles={['admin', 'ops']}><DriversManagement /></ProtectedRoute>} />
          <Route path="/admin/ops" element={<ProtectedRoute roles={['admin']}><OpsManagement /></ProtectedRoute>} />
          <Route path="/admin/attendance" element={<ProtectedRoute roles={['admin', 'ops']}><AttendanceLogs /></ProtectedRoute>} />
          <Route path="/admin/scan" element={<ProtectedRoute roles={['admin', 'ops']}><ScanQR /></ProtectedRoute>} />
          <Route path="/admin/stations" element={<ProtectedRoute roles={['admin']}><StationsManagement /></ProtectedRoute>} />
          <Route path="/admin/penalties" element={<ProtectedRoute roles={['admin', 'ops']}><PenaltiesManagement /></ProtectedRoute>} />
          <Route path="/admin/settings" element={<ProtectedRoute roles={['admin']}><SettingsManagement /></ProtectedRoute>} />
          <Route path="/admin/absences" element={<ProtectedRoute roles={['admin', 'ops']}><AbsencesManagement /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
