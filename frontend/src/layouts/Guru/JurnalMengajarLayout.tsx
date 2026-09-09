import React, { type ReactNode } from 'react';
import { GuruLayout } from './GuruLayout';

interface JurnalMengajarLayoutProps {
  children: ReactNode;
  namaGuru: string;
  mapelGuru: string;
  getInitials: (name: string) => string;
}

export const JurnalMengajarLayout: React.FC<
  JurnalMengajarLayoutProps
> = ({
  children,
  namaGuru,
  mapelGuru,
  getInitials,
}) => {
  return (
    <GuruLayout
      namaGuru={namaGuru}
      mapelGuru={mapelGuru}
      getInitials={getInitials}
      mainClassName="p-5 md:p-[26px_34px_60px] overflow-hidden"
    >
      {children}
    </GuruLayout>
  );
};