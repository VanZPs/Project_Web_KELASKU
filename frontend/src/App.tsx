// frontend/src/App.tsx
import { type ReactNode } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';

import Login from './pages/Login';
import Register from './pages/Register';
import { Dashboard as DashboardGuru } from './pages/Guru/Dashboard';
import KelasSaya from './pages/Guru/KelasSaya';

interface GuardProps {
  children: ReactNode;
}

interface ProtectedProps extends GuardProps {
  allowedRole: 'guru' | 'siswa';
}

/**
 * Mengambil data user dari localStorage dengan aman.
 *
 * Jika data user tidak ada atau JSON-nya rusak,
 * fungsi akan mengembalikan null daripada membuat aplikasi crash.
 */
const getStoredUser = () => {
  const userData = localStorage.getItem('user');

  if (!userData) {
    return null;
  }

  try {
    return JSON.parse(userData);
  } catch {
    // Hapus data user yang rusak
    localStorage.removeItem('user');
    return null;
  }
};

/**
 * Menghapus seluruh data autentikasi dari browser.
 */
const clearAuth = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

// --------------------------------------------------
// 1. GUEST GUARD
// Mencegah user yang sudah login mengakses Login/Register
// --------------------------------------------------
const GuestRoute = ({ children }: GuardProps) => {
  const token = localStorage.getItem('token');
  const user = getStoredUser();

  // Jika token dan user masih tersedia,
  // berarti user sudah login.
  if (token && user) {
    return (
      <Navigate
        to={user.role === 'guru' ? '/guru' : '/siswa'}
        replace
      />
    );
  }

  return <>{children}</>;
};

// --------------------------------------------------
// 2. PROTECTED GUARD
// Melindungi halaman berdasarkan role user
// --------------------------------------------------
const ProtectedRoute = ({
  children,
  allowedRole,
}: ProtectedProps) => {
  const token = localStorage.getItem('token');
  const user = getStoredUser();

  // Tidak memiliki token atau data user
  // berarti belum login.
  if (!token || !user) {
    clearAuth();
    return <Navigate to="/login" replace />;
  }

  // Pastikan role user valid.
  if (user.role !== 'guru' && user.role !== 'siswa') {
    clearAuth();
    return <Navigate to="/login" replace />;
  }

  // Jika role tidak sesuai dengan halaman yang ingin diakses,
  // arahkan ke dashboard sesuai role sebenarnya.
  if (user.role !== allowedRole) {
    return (
      <Navigate
        to={user.role === 'guru' ? '/guru' : '/siswa'}
        replace
      />
    );
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

        {/* ==================================================
            ROOT
            ================================================== */}
        <Route
          path="/"
          element={<Navigate to="/login" replace />}
        />

        {/* ==================================================
            AUTHENTICATION
            ================================================== */}

        {/* Login */}
        <Route
          path="/login"
          element={
            <GuestRoute>
              <Login />
            </GuestRoute>
          }
        />

        {/* Register */}
        <Route
          path="/register"
          element={
            <GuestRoute>
              <Register />
            </GuestRoute>
          }
        />

        {/* ==================================================
            GURU
            ================================================== */}

        {/* Dashboard Guru */}
        <Route
          path="/guru"
          element={
            <ProtectedRoute allowedRole="guru">
              <DashboardGuru />
            </ProtectedRoute>
          }
        />

        {/* Dashboard Guru - URL alternatif */}
        <Route
          path="/guru/dashboard"
          element={
            <ProtectedRoute allowedRole="guru">
              <DashboardGuru />
            </ProtectedRoute>
          }
        />

        {/* Kelas Saya */}
        <Route
          path="/guru/kelas-saya"
          element={
            <ProtectedRoute allowedRole="guru">
              <KelasSaya />
            </ProtectedRoute>
          }
        />

        {/* ==================================================
            SISWA
            ================================================== */}

        {/* Dashboard Siswa
            Sementara masih menggunakan placeholder.
            Nanti akan kita ganti dengan Dashboard Siswa.
        */}
        <Route
          path="/siswa/*"
          element={
            <ProtectedRoute allowedRole="siswa">
              <div className="p-8">
                <h1 className="text-2xl font-bold text-indigo-600">
                  Dashboard Siswa - KELASKU
                </h1>

                <p className="mt-2 text-gray-600">
                  SMA Kesatrian 1 Semarang
                </p>
              </div>
            </ProtectedRoute>
          }
        />

        {/* ==================================================
            404
            ================================================== */}
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