import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import logoKesatrian from '../assets/Logo-Kesatrian.jpeg';

interface SidebarProps {
  namaGuru: string;
  mapelGuru: string;
  getInitials: (name: string) => string;
}

export const Sidebar: React.FC<SidebarProps> = ({ namaGuru, mapelGuru, getInitials }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await api.post('/logout');
    } catch (error) {
      console.error("Logout gagal:", error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/login', { replace: true });
    }
  };

  return (
    <aside 
      className="text-[#EDEFF5] p-[28px_20px_20px] flex flex-row md:flex-col gap-7 md:sticky md:top-0 h-auto md:h-screen overflow-x-auto md:overflow-visible items-center md:items-stretch relative shrink-0"
      style={{
        background: `repeating-linear-gradient(128deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 34px), linear-gradient(190deg, #1E2A47 0%, #141C30 100%)`
      }}
    >
      <div className="flex items-center gap-[12px] px-1 shrink-0">
        <img 
          src={logoKesatrian} 
          alt="Logo SMA Kesatrian 1 Semarang" 
          className="w-[42px] h-[42px] rounded-full object-cover shrink-0 border border-white/10" 
        />
        <div>
          <div className="font-['Fraunces',serif] font-semibold text-[19px] text-white leading-[1.1]">KELASKU</div>
          <div className="text-[11.5px] text-[#9BA6C4] mt-0.5">SMA Kesatrian 1 Semarang</div>
        </div>
      </div>

      <div className="hidden md:flex bg-white/5 border border-white/10 rounded-xl p-[12px_13px] items-center gap-[10px]">
        <div className="w-[38px] h-[38px] rounded-[10px] bg-gradient-to-br from-[#C9A55E] to-[#8F6423] flex items-center justify-center font-bold text-[14px] text-[#141C30] shrink-0">
          {getInitials(namaGuru)}
        </div>
        <div>
          <div className="text-[13.5px] font-semibold text-white leading-[1.3]">{namaGuru}</div>
          <div className="text-[11.5px] text-[#9BA6C4] mt-px">{mapelGuru}</div>
        </div>
      </div>

      <nav className="flex-1 flex flex-row md:flex-col gap-0.5 shrink-0">
        <Link 
          to="/guru/dashboard" 
          className={`flex items-center gap-[11px] p-[9px_11px] rounded-[9px] text-[14px] font-semibold transition-colors shrink-0 ${
            location.pathname === '/guru/dashboard' || location.pathname === '/guru' 
              ? 'text-white bg-white/10 shadow-[inset_3px_0_0_#B98A3E]' 
              : 'text-[#C6CCDE] hover:bg-white/5 hover:text-white'
          }`}
        >
          <svg className="w-[18px] h-[18px] shrink-0 opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>
          Dashboard
        </Link>
        <Link 
          to="/guru/kelas" 
          className={`flex items-center gap-[11px] p-[9px_11px] rounded-[9px] text-[14px] transition-colors shrink-0 ${
            location.pathname === '/guru/kelas' 
              ? 'text-white bg-white/10 shadow-[inset_3px_0_0_#B98A3E]' 
              : 'text-[#C6CCDE] hover:bg-white/5 hover:text-white'
          }`}
        >
          <svg className="w-[18px] h-[18px] shrink-0 opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          Kelas saya
        </Link>
        <Link 
          to="/guru/siswa" 
          className={`flex items-center gap-[11px] p-[9px_11px] rounded-[9px] text-[14px] transition-colors shrink-0 ${
            location.pathname === '/guru/siswa' 
              ? 'text-white bg-white/10 shadow-[inset_3px_0_0_#B98A3E]' 
              : 'text-[#C6CCDE] hover:bg-white/5 hover:text-white'
          }`}
        >
          <svg className="w-[18px] h-[18px] shrink-0 opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          Daftar siswa
        </Link>
        <Link 
          to="/guru/jurnal" 
          className={`flex items-center gap-[11px] p-[9px_11px] rounded-[9px] text-[14px] transition-colors shrink-0 ${
            location.pathname === '/guru/jurnal' 
              ? 'text-white bg-white/10 shadow-[inset_3px_0_0_#B98A3E]' 
              : 'text-[#C6CCDE] hover:bg-white/5 hover:text-white'
          }`}
        >
          <svg className="w-[18px] h-[18px] shrink-0 opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 15h6M9 11h3"/></svg>
          Jurnal mengajar
        </Link>
        <Link 
          to="/guru/nilai" 
          className={`flex items-center gap-[11px] p-[9px_11px] rounded-[9px] text-[14px] transition-colors shrink-0 ${
            location.pathname === '/guru/nilai' 
              ? 'text-white bg-white/10 shadow-[inset_3px_0_0_#B98A3E]' 
              : 'text-[#C6CCDE] hover:bg-white/5 hover:text-white'
          }`}
        >
           <svg className="w-[18px] h-[18px] shrink-0 opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 20V10M18 20V4M6 20v-4"/></svg>
          Nilai
        </Link>
        <Link 
          to="/guru/tugas" 
          className={`flex items-center gap-[11px] p-[9px_11px] rounded-[9px] text-[14px] transition-colors shrink-0 ${
            location.pathname === '/guru/tugas' 
              ? 'text-white bg-white/10 shadow-[inset_3px_0_0_#B98A3E]' 
              : 'text-[#C6CCDE] hover:bg-white/5 hover:text-white'
          }`}
        >
          <svg className="w-[18px] h-[18px] shrink-0 opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M9 16l2 2 4-4"/></svg>
          Tugas
        </Link>
      </nav>

      <div className="flex md:flex-col flex-row gap-0.5 md:border-t border-l md:border-l-0 border-white/10 md:pt-3.5 pl-3 md:pl-0 ml-1.5 md:ml-0 shrink-0">
        <Link to="/guru/profil" className="flex items-center gap-[11px] p-[9px_11px] rounded-[9px] text-[14px] text-[#C6CCDE] hover:bg-white/5 hover:text-white transition-colors shrink-0">
          <svg className="w-[18px] h-[18px] shrink-0 opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.5-7 8-7s8 3 8 7"/></svg>
          Edit profil
        </Link>
        <button onClick={handleLogout} className="flex w-full items-center gap-[11px] p-[9px_11px] rounded-[9px] text-[14px] text-[#C6CCDE] hover:bg-white/5 hover:text-white transition-colors shrink-0 text-left bg-transparent border-none cursor-pointer">
          <svg className="w-[18px] h-[18px] shrink-0 opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>
          Keluar
        </button>
      </div>
    </aside>
  );
};