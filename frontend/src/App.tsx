// frontend/src/App.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import { Dashboard as DashboardGuru } from './pages/Guru/Dashboard';
import KelasSaya from './pages/Guru/KelasSaya'; // <-- Impor halaman Kelas Saya

interface GuardProps {
  children: React.ReactNode;
}

interface ProtectedProps extends GuardProps {
  allowedRole: string;
}

// --------------------------------------------------
// 1. GUEST GUARD (Mencegah user yang sudah login mengakses halaman login/register)
// --------------------------------------------------
const GuestRoute: React.FC<GuardProps> = ({ children }) => {
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!) : null;

  if (token && user) {
    // Arahkan ke dashboard masing-masing sesuai role jika sudah login
    return <Navigate to={user.role === 'guru' ? '/guru' : '/siswa'} replace />;
  }
  return <>{children}</>;
};

// --------------------------------------------------
// 2. PROTECTED GUARD (Melindungi dashboard berdasarkan hak akses role)
// --------------------------------------------------
const ProtectedRoute: React.FC<ProtectedProps> = ({ children, allowedRole }) => {
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!) : null;

  // Jika tidak ada token atau data user, tendang ke login
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  // Jika role tidak sesuai (misal siswa mencoba akses rute guru), tendang ke dashboard aslinya
  if (allowedRole && user.role !== allowedRole) {
    return <Navigate to={user.role === 'guru' ? '/guru' : '/siswa'} replace />;
  }

  return <>{children}</>;
};

// --------------------------------------------------
// 3. MAIN APP ROUTER
// --------------------------------------------------
export default function App() {
  return (
    <Router>
      <Routes>
        {/* Redirect root ke halaman login */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Halaman Login */}
        <Route 
          path="/login" 
          element={
            <GuestRoute>
              <Login />
            </GuestRoute>
          } 
        />

        {/* Halaman Register */}
        <Route 
          path="/register" 
          element={
            <GuestRoute>
              <Register />
            </GuestRoute>
          } 
        />

        {/* Dashboard Utama Guru */}
        <Route 
          path="/guru" 
          element={
            <ProtectedRoute allowedRole="guru">
              <DashboardGuru />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/guru/dashboard" 
          element={
            <ProtectedRoute allowedRole="guru">
              <DashboardGuru />
            </ProtectedRoute>
          } 
        />

        {/* Halaman Kelas Saya Guru */}
        <Route 
          path="/guru/kelas-saya" 
          element={
            <ProtectedRoute allowedRole="guru">
              <KelasSaya />
            </ProtectedRoute>
          } 
        />

        {/* Dashboard Siswa */}
        <Route 
          path="/siswa/*" 
          element={
            <ProtectedRoute allowedRole="siswa">
              <div className="p-8">
                <h1 className="text-2xl font-bold text-indigo-600">Dashboard Siswa - KELASKU</h1>
                <p className="mt-2 text-gray-600">SMA Kesatrian 1 Semarang</p>
              </div>
            </ProtectedRoute>
          } 
        />

        {/* Halaman 404 */}
        <Route 
          path="*" 
          element={
            <div className="flex h-screen items-center justify-center text-[#AE5A3E] font-bold text-3xl font-['Fraunces',serif]">
              404 - Halaman Tidak Ditemukan
            </div>
          } 
        />
      </Routes>
    </Router>
  );
}