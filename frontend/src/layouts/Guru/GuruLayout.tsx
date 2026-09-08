import React, { type ReactNode } from 'react';
import { Sidebar } from '../../components/Guru/Sidebar';

interface GuruLayoutProps {
  children: ReactNode;
  namaGuru: string;
  mapelGuru: string;
  getInitials: (name: string) => string;
  mainClassName?: string;
}

export const GuruLayout: React.FC<GuruLayoutProps> = ({
  children,
  namaGuru,
  mapelGuru,
  getInitials,
  mainClassName = 'p-5 md:p-[26px_34px_60px]',
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[264px_1fr] min-h-screen bg-[#F5F1E7] text-[#23283A] font-['Plus_Jakarta_Sans',sans-serif] antialiased">
      <Sidebar
        namaGuru={namaGuru}
        mapelGuru={mapelGuru}
        getInitials={getInitials}
      />

      <main className={mainClassName}>
        {children}
      </main>
    </div>
  );
};