import {
  type ReactNode,
} from 'react';

import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';

import Login from './pages/Login';
import Register from './pages/Register';

import {
  Dashboard as DashboardGuru,
} from './pages/Guru/Dashboard';

import KelasSaya from './pages/Guru/KelasSaya';
import TambahKelas from './pages/Guru/TambahKelas';
import JurnalKelas from './pages/Guru/JurnalKelas';
import DaftarSiswa from './pages/Guru/DaftarSiswa';
import Tugas from './pages/Guru/Tugas';
import KelolaTugas from './pages/Guru/KelolaTugas';
import Nilai from './pages/Guru/Nilai';
import { GuruLayout } from './layouts/Guru/GuruLayout';
import { DashboardSiswa } from './pages/Siswa/Dashboard';
import SiswaPagePlaceholder from './pages/Siswa/SiswaPagePlaceholder';
import JadwalSiswa from './pages/Siswa/Jadwal';


/*
|--------------------------------------------------------------------------
| TYPES
|--------------------------------------------------------------------------
*/
interface GuardProps {
  children: ReactNode;
}

interface ProtectedProps
  extends GuardProps {
  allowedRole:
    | 'guru'
    | 'siswa';
}


/*
|--------------------------------------------------------------------------
| GET STORED USER
|--------------------------------------------------------------------------
*/
const getStoredUser = () => {

  const userData =
    localStorage.getItem(
      'user'
    );

  if (!userData) {
    return null;
  }

  try {
    return JSON.parse(
      userData
    );

  } catch {
    localStorage.removeItem(
      'user'
    );
    return null;
  }
};


/*
|--------------------------------------------------------------------------
| CLEAR AUTH
|--------------------------------------------------------------------------
*/
const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'GR';
  return parts.slice(0, 2).map((part) => part[0].toUpperCase()).join('');
};

const clearAuth = () => {
  localStorage.removeItem(
    'token'
  );

  localStorage.removeItem(
    'user'
  );
};


/*
|--------------------------------------------------------------------------
| GUEST ROUTE
|--------------------------------------------------------------------------
*/
const GuestRoute = ({
  children,
}: GuardProps) => {

  const token =
    localStorage.getItem(
      'token'
    );

  const user =
    getStoredUser();

  if (
    token &&
    user
  ) {
    return (
      <Navigate
        to={
          user.role === 'guru'
            ? '/guru'
            : '/siswa'
        }
        replace
      />
    );
  }

  return (
    <>
      {children}
    </>
  );
};


/*
|--------------------------------------------------------------------------
| PROTECTED ROUTE
|--------------------------------------------------------------------------
*/
const ProtectedRoute = ({
  children,
  allowedRole,
}: ProtectedProps) => {

  const token =
    localStorage.getItem(
      'token'
    );

  const user =
    getStoredUser();

  /*
   * Belum login.
   */
  if (
    !token ||
    !user
  ) {
    clearAuth();

    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  /*
   * Role tidak valid.
   */
  if (
    user.role !== 'guru' &&
    user.role !== 'siswa'
  ) {
    clearAuth();

    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  /*
   * Role tidak sesuai.
   */
  if (
    user.role !== allowedRole
  ) {
    return (
      <Navigate
        to={
          user.role === 'guru'
            ? '/guru'
            : '/siswa'
        }
        replace
      />
    );
  }

  return (
    <>
      {children}
    </>
  );
};


/*
|--------------------------------------------------------------------------
| APP
|--------------------------------------------------------------------------
*/
export default function App() {

  return (
    <Router>
      <Routes>

        {/* ==================================================
            ROOT
            ================================================== */}

        <Route
          path="/"
          element={
            <Navigate
              to="/login"
              replace
            />
          }
        />


        {/* ==================================================
            AUTHENTICATION
            ================================================== */}

        <Route
          path="/login"
          element={
            <GuestRoute>
              <Login />
            </GuestRoute>
          }
        />

        <Route
          path="/register"
          element={
            <GuestRoute>
              <Register />
            </GuestRoute>
          }
        />


                {/* ==================================================
            GURU - SHARED PERSISTENT LAYOUT
            ================================================== */}

        <Route
          path="/guru"
          element={
            <ProtectedRoute allowedRole="guru">
              <GuruLayout getInitials={getInitials} />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardGuru />} />
          <Route path="dashboard" element={<DashboardGuru />} />
          <Route path="kelas-saya" element={<KelasSaya />} />
          <Route path="kelas-saya/tambah" element={<TambahKelas />} />
          <Route path="siswa" element={<DaftarSiswa />} />
          <Route path="jurnal" element={<JurnalKelas />} />
          <Route path="tugas" element={<Tugas />} />
          <Route path="tugas/kelola/:scheduleId" element={<KelolaTugas />} />
          <Route path="nilai" element={<Nilai />} />
          <Route
            path="profil"
            element={<Navigate to="/guru/dashboard" replace />}
          />
        </Route>

        {/* ==================================================
            SISWA
            ================================================== */}

        <Route
          path="/siswa"
          element={
            <ProtectedRoute allowedRole="siswa">
              <Navigate to="/siswa/dashboard" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/siswa/dashboard"
          element={
            <ProtectedRoute allowedRole="siswa">
              <DashboardSiswa />
            </ProtectedRoute>
          }
        />
        <Route path="/siswa/jadwal" element={<ProtectedRoute allowedRole="siswa"><JadwalSiswa /></ProtectedRoute>} />
        <Route path="/siswa/nilai" element={<ProtectedRoute allowedRole="siswa"><SiswaPagePlaceholder title="Nilai" /></ProtectedRoute>} />
        <Route path="/siswa/tugas" element={<ProtectedRoute allowedRole="siswa"><SiswaPagePlaceholder title="Tugas" /></ProtectedRoute>} />
        <Route path="/siswa/jurnal" element={<ProtectedRoute allowedRole="siswa"><SiswaPagePlaceholder title="Jurnal Pembelajaran" /></ProtectedRoute>} />
        <Route path="/siswa/kehadiran" element={<ProtectedRoute allowedRole="siswa"><SiswaPagePlaceholder title="Kehadiran" /></ProtectedRoute>} />


        {/* ==================================================
            404
            ================================================== */}

        <Route
          path="*"
          element={
            <div className="flex h-screen items-center justify-center font-['Fraunces',serif] text-3xl font-bold text-[#AE5A3E]">
              404 - Halaman Tidak Ditemukan
            </div>
          }
        />

      </Routes>
    </Router>
  );
}