import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import logoKesatrian from '../../assets/Logo-Kesatrian.jpeg';

interface SidebarProps {
  namaSiswa: string;
  kelasSiswa: string;
}

const navigation = [
  { label: 'Dashboard', to: '/siswa/dashboard', icon: '▦' },
  { label: 'Jadwal', to: '/siswa/jadwal', icon: '▣' },
  { label: 'Nilai', to: '/siswa/nilai', icon: '▥' },
  { label: 'Tugas', to: '/siswa/tugas', icon: '☑' },
  { label: 'Jurnal pembelajaran', to: '/siswa/jurnal', icon: '▤' },
  { label: 'Kehadiran', to: '/siswa/kehadiran', icon: '✓' },
];

export const SidebarSiswa: React.FC<SidebarProps> = ({ namaSiswa, kelasSiswa }) => {
  const location = useLocation();
  const navigate = useNavigate();

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

  const initials = namaSiswa.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'SW';

  return (
    <aside
      className="relative flex h-auto shrink-0 flex-row items-center gap-5 overflow-x-auto p-4 text-[#EDEFF5] md:sticky md:top-0 md:h-screen md:flex-col md:items-stretch md:gap-7 md:p-[28px_20px_20px] md:overflow-visible"
      style={{
        background: 'repeating-linear-gradient(128deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 34px), linear-gradient(190deg, #1E2A47 0%, #141C30 100%)',
      }}
    >
      <div className="flex shrink-0 items-center gap-2.5 px-1">
        <img src={logoKesatrian} alt="Logo SMA Kesatrian 1 Semarang" className="h-[40px] w-[40px] rounded-full border border-white/10 object-cover" />
        <div>
          <div className="font-['Fraunces',serif] text-[19px] font-semibold leading-tight text-white">KELASKU</div>
          <div className="mt-0.5 text-[11px] text-[#9BA6C4]">SMA Kesatrian 1 Semarang</div>
        </div>
      </div>

      <div className="hidden items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.06] p-3 md:flex">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#C9A55E] to-[#8F6423] text-sm font-bold text-[#141C30]">
          {initials}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-white">{namaSiswa}</div>
          <div className="truncate text-[11.5px] text-[#9BA6C4]">Siswa{kelasSiswa ? ` · ${kelasSiswa}` : ''}</div>
        </div>
      </div>

      <nav className="flex flex-1 flex-row gap-1 md:flex-col">
        {navigation.map((item) => {
          const active = location.pathname === item.to || (item.to === '/siswa/dashboard' && location.pathname === '/siswa');
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex shrink-0 items-center gap-[11px] rounded-[9px] px-[11px] py-[9px] text-[13px] transition-colors md:text-[14px] ${active ? 'bg-white/10 font-semibold text-white shadow-[inset_3px_0_0_#B98A3E]' : 'text-[#C6CCDE] hover:bg-white/5 hover:text-white'}`}
            >
              <span className="flex h-[18px] w-[18px] items-center justify-center text-base opacity-90" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-l border-white/10 pl-3 md:border-l-0 md:border-t md:pl-0 md:pt-3.5">
        <button type="button" onClick={handleLogout} className="flex w-full shrink-0 items-center gap-[11px] rounded-[9px] px-[11px] py-[9px] text-left text-[14px] text-[#C6CCDE] transition-colors hover:bg-white/5 hover:text-white">
          <span className="text-base" aria-hidden="true">↪</span>
          Keluar
        </button>
      </div>
    </aside>
  );
};
