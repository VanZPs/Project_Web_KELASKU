import React, { type ReactNode } from 'react';
import { Sidebar } from '../../components/Guru/Sidebar';

interface KelasSayaLayoutProps {
  children: ReactNode;
  namaGuru: string;
  mapelGuru: string;
  getInitials: (name: string) => string;
}

export const KelasSayaLayout: React.FC<KelasSayaLayoutProps> = ({ 
  children, 
  namaGuru, 
  mapelGuru, 
  getInitials
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[264px_1fr] min-h-screen bg-[#F5F1E7] text-[#23283A] font-['Plus_Jakarta_Sans',sans-serif] antialiased">
      {/* Sidebar Guru */}
      <Sidebar namaGuru={namaGuru} mapelGuru={mapelGuru} getInitials={getInitials} />

      {/* Main Content Area khusus Kelas Saya */}
      <main className="p-5 md:p-[26px_34px_60px] overflow-hidden">
        {children}
      </main>
    </div>
  );
};