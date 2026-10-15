import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import logoKesatrian from '../../assets/Logo-Kesatrian.jpeg';

interface SidebarProps {
  namaGuru: string;
  mapelGuru: string;
  getInitials: (name: string) => string;
  onEditProfile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  namaGuru,
  mapelGuru,
  getInitials,
  onEditProfile,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const profilePhotoUrlRef = useRef<string | null>(null);

  const clearProfilePhoto = useCallback(() => {
    if (profilePhotoUrlRef.current) {
      URL.revokeObjectURL(profilePhotoUrlRef.current);
      profilePhotoUrlRef.current = null;
    }
    setProfilePhotoUrl(null);
  }, []);

  const loadProfilePhoto = useCallback(async () => {
    let nextObjectUrl: string | null = null;

    try {
      const response = await api.get('/me/profile-photo', {
        responseType: 'blob',
        headers: { 'Cache-Control': 'no-cache' },
      });

      // Backend dapat mengembalikan 204 bila pengguna belum memiliki foto.
      if (response.status === 204 || !response.data || response.data.size === 0) {
        clearProfilePhoto();
        return;
      }

      nextObjectUrl = URL.createObjectURL(response.data as Blob);
      if (profilePhotoUrlRef.current) {
        URL.revokeObjectURL(profilePhotoUrlRef.current);
      }
      profilePhotoUrlRef.current = nextObjectUrl;
      setProfilePhotoUrl(nextObjectUrl);
    } catch (error) {
      clearProfilePhoto();

      // Hindari menganggap 204/404 sebagai error yang perlu ditampilkan.
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status !== 404 && status !== 204) {
        console.error('Gagal memuat foto profil:', error);
      }
    }
  }, [clearProfilePhoto]);

  useEffect(() => {
    void loadProfilePhoto();

    // EditProfileModal mengirim event ini setelah foto berhasil diganti/dihapus.
    const handleProfilePhotoUpdated = () => {
      void loadProfilePhoto();
    };

    window.addEventListener('profile-photo-updated', handleProfilePhotoUpdated);
    return () => {
      window.removeEventListener('profile-photo-updated', handleProfilePhotoUpdated);
      clearProfilePhoto();
    };
  }, [loadProfilePhoto, clearProfilePhoto]);

  const handleLogout = async () => {
    try {
      await api.post('/logout');
    } catch (error) {
      console.error('Logout gagal:', error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/login', { replace: true });
    }
  };

  const navLinkClass = (isActive: boolean) =>
    `flex items-center gap-[11px] p-[9px_11px] rounded-[9px] text-[14px] transition-colors shrink-0 ${
      isActive
        ? 'text-white bg-white/10 shadow-[inset_3px_0_0_#B98A3E]'
        : 'text-[#C6CCDE] hover:bg-white/5 hover:text-white'
    }`;

  const isDashboardActive =
    location.pathname === '/guru/dashboard' || location.pathname === '/guru';

  return (
    <aside
      className="relative flex h-auto shrink-0 flex-row items-center gap-7 overflow-x-auto p-[28px_20px_20px] text-[#EDEFF5] md:sticky md:top-0 md:h-screen md:flex-col md:items-stretch md:overflow-visible"
      style={{
        background:
          'repeating-linear-gradient(128deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 34px), linear-gradient(190deg, #1E2A47 0%, #141C30 100%)',
      }}
    >
      <div className="flex shrink-0 items-center gap-[12px] px-1">
        <img
          src={logoKesatrian}
          alt="Logo SMA Kesatrian 1 Semarang"
          className="h-[42px] w-[42px] shrink-0 rounded-full border border-white/10 object-cover"
        />
        <div>
          <div className="font-['Fraunces',serif] text-[19px] font-semibold leading-[1.1] text-white">
            KELASKU
          </div>
          <div className="mt-0.5 text-[11.5px] text-[#9BA6C4]">
            SMA Kesatrian 1 Semarang
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onEditProfile}
        aria-label={`Edit profil ${namaGuru}`}
        className="group hidden w-full shrink-0 cursor-pointer items-center gap-[10px] rounded-xl border border-white/10 bg-white/5 p-[12px_13px] text-left transition-colors hover:border-white/20 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A55E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1E2A47] md:flex"
      >
        <div className="flex h-[44px] w-[44px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-gradient-to-br from-[#C9A55E] to-[#8F6423] text-[14px] font-bold text-[#141C30]">
          {profilePhotoUrl ? (
            <img
              src={profilePhotoUrl}
              alt={`Foto profil ${namaGuru}`}
              className="h-full w-full object-cover"
              onError={() => setProfilePhotoUrl(null)}
            />
          ) : (
            getInitials(namaGuru)
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-semibold leading-[1.3] text-white">
            {namaGuru}
          </div>
          <div className="mt-px truncate text-[11.5px] text-[#9BA6C4]">
            {mapelGuru}
          </div>
        </div>
      </button>

      <nav className="flex shrink-0 flex-1 flex-row gap-0.5 md:flex-col">
        <Link to="/guru/dashboard" className={navLinkClass(isDashboardActive)}>
          <svg className="h-[18px] w-[18px] shrink-0 opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>
          Dashboard
        </Link>

        <Link to="/guru/kelas-saya" className={navLinkClass(location.pathname === '/guru/kelas-saya')}>
          <svg className="h-[18px] w-[18px] shrink-0 opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          Kelas saya
        </Link>

        <Link to="/guru/siswa" className={navLinkClass(location.pathname === '/guru/siswa')}>
          <svg className="h-[18px] w-[18px] shrink-0 opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          Daftar siswa
        </Link>

        <Link to="/guru/jurnal" className={navLinkClass(location.pathname === '/guru/jurnal')}>
          <svg className="h-[18px] w-[18px] shrink-0 opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 15h6M9 11h3"/></svg>
          Jurnal mengajar
        </Link>

        <Link to="/guru/nilai" className={navLinkClass(location.pathname === '/guru/nilai')}>
          <svg className="h-[18px] w-[18px] shrink-0 opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 20V10M18 20V4M6 20v-4"/></svg>
          Nilai
        </Link>

        <Link to="/guru/tugas" className={navLinkClass(location.pathname === '/guru/tugas')}>
          <svg className="h-[18px] w-[18px] shrink-0 opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M9 16l2 2 4-4"/></svg>
          Tugas
        </Link>
      </nav>

      <div className="ml-1.5 flex shrink-0 flex-row gap-0.5 border-l border-white/10 pl-3 md:ml-0 md:flex-col md:border-l-0 md:border-t md:pt-3.5 md:pl-0">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full shrink-0 cursor-pointer items-center gap-[11px] rounded-[9px] border-none bg-transparent p-[9px_11px] text-left text-[14px] text-[#C6CCDE] transition-colors hover:bg-white/5 hover:text-white"
        >
          <svg className="h-[18px] w-[18px] shrink-0 opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>
          Keluar
        </button>
      </div>
    </aside>
  );
};
