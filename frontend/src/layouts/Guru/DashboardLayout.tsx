import React, { type ReactNode } from 'react';
import { GuruLayout } from './GuruLayout';

interface DashboardLayoutProps {
  children: ReactNode;
  namaGuru: string;
  mapelGuru: string;
  getInitials: (name: string) => string;
  todayStr: string;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  namaGuru,
  mapelGuru,
  getInitials,
  todayStr,
}) => {
  return (
    <GuruLayout
      namaGuru={namaGuru}
      mapelGuru={mapelGuru}
      getInitials={getInitials}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-[26px] gap-5">
        <div className="flex flex-col gap-1.5">
          <div className="inline-flex items-center gap-2 self-start px-3 py-1 bg-[#FFFDF8] border border-[#E3DACB] rounded-full text-[12.5px] font-medium text-[#6B7080] shadow-[0_1px_2px_rgba(30,25,15,0.02)]">
            <svg
              className="w-3.5 h-3.5 text-[#B98A3E]"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>

            <span>{todayStr}</span>
          </div>

          <h1 className="font-['Fraunces',serif] font-semibold text-[26px] md:text-[28px] tracking-[-0.01em] text-[#141C30]">
            Selamat pagi, {namaGuru.split(' ')[0]} ✨
          </h1>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-[#FFFDF8] border border-[#E3DACB] rounded-[10px] p-[9px_13px] min-w-[230px] flex-1 md:flex-none shadow-sm">
            <svg
              className="shrink-0 opacity-50"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>

            <input
              type="text"
              placeholder="Cari siswa, kelas, atau tugas"
              className="border-none outline-none bg-transparent font-inherit text-[13.5px] text-[#23283A] w-full"
            />
          </div>

          <button
            type="button"
            className="w-[38px] h-[38px] flex items-center justify-center bg-[#FFFDF8] border border-[#E3DACB] rounded-[10px] relative text-[#23283A] shrink-0 cursor-pointer shadow-sm hover:bg-[#FAF6EC] transition-colors"
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </button>

          <div className="w-[38px] h-[38px] rounded-[10px] bg-gradient-to-br from-[#C9A55E] to-[#8F6423] flex items-center justify-center font-bold text-[14px] text-[#141C30] shrink-0 shadow-sm">
            {getInitials(namaGuru)}
          </div>
        </div>
      </div>

      {children}
    </GuruLayout>
  );
};