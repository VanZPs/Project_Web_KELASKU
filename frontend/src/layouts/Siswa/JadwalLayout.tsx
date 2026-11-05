import React, { type ReactNode } from 'react';
import { SidebarSiswa } from '../../components/Siswa/Sidebar';
import LoadingScreen from '../../components/common/LoadingScreen';

interface JadwalLayoutProps {
  children: ReactNode;
  namaSiswa: string;
  kelasSiswa?: string;
  loading?: boolean;
}

/** Layout khusus halaman Jadwal: tanpa header dashboard, tanggal, sapaan, search, notifikasi, maupun avatar atas. */
export const JadwalLayout: React.FC<JadwalLayoutProps> = ({
  children,
  namaSiswa,
  kelasSiswa = '',
  loading = false,
}) => (
  <div className="grid min-h-screen grid-cols-1 bg-[#F5F1E7] font-['Plus_Jakarta_Sans',sans-serif] text-[#23283A] antialiased md:grid-cols-[264px_minmax(0,1fr)]">
    <SidebarSiswa namaSiswa={namaSiswa} kelasSiswa={kelasSiswa} />
    <main className="relative min-h-screen min-w-0 px-5 pb-10 pt-7 md:px-[34px] md:pb-[60px] md:pt-8">
      {children}
      {loading && (
        <div className="fixed inset-0 z-[100] flex h-dvh items-center justify-center overflow-hidden bg-[#F5F1E7]/95 px-5 backdrop-blur-[2px] md:left-[264px]" role="status" aria-live="polite">
          <LoadingScreen
            text="Memuat jadwal"
            subtitle="Menyiapkan jadwal pelajaran dan kalender tugas Anda."
            className="h-full min-h-0"
          />
        </div>
      )}
    </main>
  </div>
);
