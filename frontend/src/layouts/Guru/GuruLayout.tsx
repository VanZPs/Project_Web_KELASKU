import React, { useEffect, useState, type ReactNode } from 'react';
import { Sidebar } from '../../components/Guru/Sidebar';
import EditProfileModal from '../../components/Guru/EditProfileModal';

interface GuruLayoutProps {
  children: ReactNode;
  namaGuru: string;
  mapelGuru: string;
  getInitials: (name: string) => string;
  mainClassName?: string;
}

interface UpdatedProfileUser {
  name?: string;
}

export const GuruLayout: React.FC<GuruLayoutProps> = ({
  children,
  namaGuru,
  mapelGuru,
  getInitials,
  mainClassName = 'p-5 md:p-[26px_34px_60px]',
}) => {
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [displayName, setDisplayName] = useState(namaGuru);

  // Sinkronkan nama dari halaman induk apabila nilainya berubah.
  useEffect(() => {
    setDisplayName(namaGuru);
  }, [namaGuru]);

  // Callback ini hanya membutuhkan nama untuk memperbarui sidebar.
  const handleProfileUpdated = (updatedUser: UpdatedProfileUser) => {
    if (updatedUser.name) {
      setDisplayName(updatedUser.name);
    }
  };

  return (
    <div className="grid min-h-screen grid-cols-1 bg-[#F5F1E7] font-['Plus_Jakarta_Sans',sans-serif] text-[#23283A] antialiased md:grid-cols-[264px_1fr]">
      <Sidebar
        namaGuru={displayName}
        mapelGuru={mapelGuru}
        getInitials={getInitials}
        onEditProfile={() => setIsEditProfileOpen(true)}
      />

      <main className={mainClassName}>{children}</main>

      <EditProfileModal
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
        onProfileUpdated={handleProfileUpdated}
      />
    </div>
  );
};
