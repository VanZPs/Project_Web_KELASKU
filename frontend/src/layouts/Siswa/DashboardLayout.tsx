import React, { type ReactNode } from 'react';
import { SidebarSiswa } from '../../components/Siswa/Sidebar';
import LoadingScreen from '../../components/common/LoadingScreen';

interface DashboardLayoutProps {
  children: ReactNode;
  namaSiswa: string;
  kelasSiswa?: string;
  todayStr: string;
  loading?: boolean;
  showHeader?: boolean;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  namaSiswa,
  kelasSiswa = '',
  todayStr,
  loading = false,
  showHeader = true,
}) => {
  const initials = namaSiswa.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'SW';

  return (
    <div className="grid min-h-screen grid-cols-1 bg-[#F5F1E7] font-['Plus_Jakarta_Sans',sans-serif] text-[#23283A] antialiased md:grid-cols-[264px_minmax(0,1fr)]">
      <SidebarSiswa namaSiswa={namaSiswa} kelasSiswa={kelasSiswa} />
      <main className="relative min-h-screen min-w-0 p-5 md:p-[26px_34px_60px]">
        {showHeader && <header className="mb-[22px] flex flex-col justify-between gap-5 md:flex-row md:items-start">
          <div className="flex flex-col gap-1.5">
            <div className="inline-flex items-center gap-2 self-start rounded-full border border-[#E3DACB] bg-[#FFFDF8] px-3 py-1 text-[12.5px] font-medium text-[#6B7080] shadow-[0_1px_2px_rgba(30,25,15,0.02)]">
              <svg
                className="h-3.5 w-3.5 text-[#B98A3E]"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
              <span>{todayStr}</span>
            </div>
            <h1 className="font-['Fraunces',serif] text-[26px] font-semibold tracking-[-0.01em] text-[#141C30] md:text-[28px]">
              Selamat datang, {namaSiswa.split(' ')[0] || 'Siswa'} ✨
            </h1>
          </div>
          <div className="flex w-full items-center gap-3 md:w-auto">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-[10px] border border-[#E3DACB] bg-[#FFFDF8] p-[9px_13px] md:min-w-[230px] md:flex-none">
              <svg className="shrink-0 opacity-50" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
              <input type="search" placeholder="Cari tugas atau mata pelajaran" className="w-full border-none bg-transparent text-[13.5px] text-[#23283A] outline-none" />
            </label>
            <button type="button" aria-label="Notifikasi" className="relative flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] border border-[#E3DACB] bg-[#FFFDF8] text-[#23283A]">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
              <span className="absolute right-2 top-2 h-[7px] w-[7px] rounded-full border-[1.5px] border-[#FFFDF8] bg-[#AE5A3E]" />
            </button>
            <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#C9A55E] to-[#8F6423] text-[14px] font-bold text-[#141C30]">{initials}</div>
          </div>
        </header>}
        {children}
        {loading && (
          <div className="fixed inset-0 z-[100] flex h-dvh items-center justify-center overflow-hidden bg-[#F5F1E7]/95 px-5 backdrop-blur-[2px] md:left-[264px]" role="status" aria-live="polite">
            <LoadingScreen
              text="Memuat dashboard"
              subtitle="Menyiapkan jadwal, tugas, dan perkembangan belajar Anda."
              className="h-full min-h-0"
            />
          </div>
        )}
      </main>
    </div>
  );
};
