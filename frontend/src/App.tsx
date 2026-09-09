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

import EditProfile from './pages/Guru/EditProfile';

import JurnalKelas from './pages/Guru/JurnalKelas';


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

  /*
   * Jika sudah login,
   * arahkan sesuai role.
   */
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
            GURU
            ================================================== */}

        {/* Dashboard Guru */}

        <Route
          path="/guru"
          element={
            <ProtectedRoute
              allowedRole="guru"
            >
              <DashboardGuru />
            </ProtectedRoute>
          }
        />


        {/* Dashboard Guru - URL alternatif */}

        <Route
          path="/guru/dashboard"
          element={
            <ProtectedRoute
              allowedRole="guru"
            >
              <DashboardGuru />
            </ProtectedRoute>
          }
        />


        {/* Kelas Saya */}

        <Route
          path="/guru/kelas-saya"
          element={
            <ProtectedRoute
              allowedRole="guru"
            >
              <KelasSaya />
            </ProtectedRoute>
          }
        />


        {/* Tambah Kelas */}

        <Route
          path="/guru/kelas-saya/tambah"
          element={
            <ProtectedRoute
              allowedRole="guru"
            >
              <TambahKelas />
            </ProtectedRoute>
          }
        />


        {/* Jurnal Mengajar */}

        <Route
          path="/guru/jurnal"
          element={
            <ProtectedRoute
              allowedRole="guru"
            >
              <JurnalKelas />
            </ProtectedRoute>
          }
        />


        {/* Edit Profile */}

        <Route
          path="/guru/profil"
          element={
            <ProtectedRoute
              allowedRole="guru"
            >
              <EditProfile />
            </ProtectedRoute>
          }
        />


        {/* ==================================================
            SISWA
            ================================================== */}

        <Route
          path="/siswa/*"
          element={
            <ProtectedRoute
              allowedRole="siswa"
            >

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
            <div className="flex h-screen items-center justify-center font-['Fraunces',serif] text-3xl font-bold text-[#AE5A3E]">
              404 - Halaman Tidak Ditemukan
            </div>
          }
        />

      </Routes>

    </Router>
  );
}