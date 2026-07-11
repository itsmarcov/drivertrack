import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import LoadingScreen from './components/LoadingScreen';
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
import ProfileSettings from './pages/ProfileSettings';
import JustificationsReview from './pages/JustificationsReview';
import DriverRegister from './pages/DriverRegister';
import PendingDrivers from './pages/PendingDrivers';
import AbsenceRequests from './pages/AbsenceRequests';
import AbsenceRequestsReview from './pages/AbsenceRequestsReview';
import ActivityLogs from './pages/ActivityLogs';
import DriversMapView from './pages/DriversMapView';


function HomeRedirect() {
  const { user } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!user) { navigate('/login', { replace: true }); return; }
    if (user.role === 'driver') { navigate('/driver', { replace: true }); return; }
    navigate('/admin', { replace: true });
  }, [user, navigate]);
  return (
<LoadingScreen message="جاري التوجيه..." />
  );
}

export default function App() {
  const { loading } = useAuth();
  if (loading) return (
<LoadingScreen message="جاري التحميل..." />
  );
  return (
    <div className="app">
      <Navbar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<DriverRegister />} />
          <Route path="/admin/pending-drivers" element={<ProtectedRoute roles={['admin', 'super_admin']}><PendingDrivers /></ProtectedRoute>} />
          <Route path="/driver" element={<ProtectedRoute roles={['driver']}><DriverDashboard /></ProtectedRoute>} />
          <Route path="/driver/attendance" element={<ProtectedRoute roles={['driver']}><AttendanceLogs /></ProtectedRoute>} />
          <Route path="/driver/absence-requests" element={<ProtectedRoute roles={['driver']}><AbsenceRequests /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute roles={['admin', 'ops', 'super_admin']}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/drivers" element={<ProtectedRoute roles={['admin', 'ops', 'super_admin']}><DriversManagement /></ProtectedRoute>} />
          <Route path="/admin/ops" element={<ProtectedRoute roles={['admin', 'super_admin']}><OpsManagement /></ProtectedRoute>} />
          <Route path="/admin/attendance" element={<ProtectedRoute roles={['admin', 'ops', 'super_admin']}><AttendanceLogs /></ProtectedRoute>} />
          <Route path="/admin/scan" element={<ProtectedRoute roles={['admin', 'ops', 'super_admin']}><ScanQR /></ProtectedRoute>} />
          <Route path="/admin/stations" element={<ProtectedRoute roles={['admin', 'super_admin']}><StationsManagement /></ProtectedRoute>} />
          <Route path="/admin/profile" element={<ProtectedRoute roles={['admin', 'ops', 'super_admin']}><ProfileSettings /></ProtectedRoute>} />
          <Route path="/admin/penalties" element={<ProtectedRoute roles={['admin', 'ops', 'super_admin']}><PenaltiesManagement /></ProtectedRoute>} />
          <Route path="/admin/settings" element={<ProtectedRoute roles={['admin', 'super_admin']}><SettingsManagement /></ProtectedRoute>} />
          <Route path="/admin/absences" element={<ProtectedRoute roles={['admin', 'ops', 'super_admin']}><AbsencesManagement /></ProtectedRoute>} />
          <Route path="/admin/justifications" element={<ProtectedRoute roles={['admin', 'super_admin']}><JustificationsReview /></ProtectedRoute>} />
          <Route path="/admin/absence-requests" element={<ProtectedRoute roles={['admin', 'ops', 'super_admin']}><AbsenceRequestsReview /></ProtectedRoute>} />
          <Route path="/admin/activity-logs" element={<ProtectedRoute roles={['admin', 'super_admin']}><ActivityLogs /></ProtectedRoute>} />
          <Route path="/admin/drivers-map" element={<ProtectedRoute roles={['admin', 'ops', 'super_admin']}><DriversMapView /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
