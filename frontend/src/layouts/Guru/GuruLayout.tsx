import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../../components/Guru/Sidebar';
import EditProfileModal from '../../components/Guru/modal/EditProfileModal';

interface GuruLayoutProps {
  children?: ReactNode;
  namaGuru?: string;
  mapelGuru?: string;
  getInitials?: (name: string) => string;
  mainClassName?: string;
}

interface UpdatedProfileUser {
  name?: string;
}

interface StoredUser {
  name?: unknown;
  nama?: unknown;
  mata_pelajaran?: unknown;
  subject?: unknown;
  subject_name?: unknown;
  mapel?: unknown;
  teacher?: {
    subjects?: Array<{
      name?: unknown;
      pivot?: {
        is_primary?: unknown;
      };
    }>;
  };
}

interface GuruLayoutContextValue {
  isSharedLayout: true;
  updateProfile: (name: string, subject: string) => void;
}

const GuruLayoutContext = createContext<GuruLayoutContextValue | null>(null);

const isValidSubject = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.trim().length > 0 &&
  value.trim().toLowerCase() !== 'guru mata pelajaran';

const getStoredProfile = () => {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return { name: 'Guru', subject: 'Guru Mata Pelajaran' };

    const user = JSON.parse(raw) as StoredUser;
    const name =
      (typeof user.name === 'string' && user.name) ||
      (typeof user.nama === 'string' && user.nama) ||
      'Guru';

    const subjects = Array.isArray(user.teacher?.subjects)
      ? user.teacher.subjects
      : [];

    const primarySubject = subjects.find(
      (subject) =>
        subject.pivot?.is_primary === true ||
        subject.pivot?.is_primary === 1 ||
        subject.pivot?.is_primary === '1',
    );

    const nestedSubject = primarySubject?.name || subjects[0]?.name;

    const rootSubject = [
      user.mata_pelajaran,
      user.subject,
      user.subject_name,
      user.mapel,
    ].find(isValidSubject);

    const subject = isValidSubject(rootSubject)
      ? rootSubject.trim()
      : isValidSubject(nestedSubject)
        ? nestedSubject.trim()
        : 'Guru Mata Pelajaran';

    return { name, subject };
  } catch {
    return { name: 'Guru', subject: 'Guru Mata Pelajaran' };
  }
};

const defaultGetInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'GR';
  return parts.slice(0, 2).map((part) => part[0].toUpperCase()).join('');
};

export const GuruLayout: React.FC<GuruLayoutProps> = ({
  children,
  namaGuru,
  mapelGuru,
  getInitials = defaultGetInitials,
  mainClassName = 'p-5 md:p-[26px_34px_60px]',
}) => {
  const parentLayout = useContext(GuruLayoutContext);
  const storedProfile = useMemo(() => getStoredProfile(), []);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [displayName, setDisplayName] = useState(namaGuru || storedProfile.name);
  const [displaySubject, setDisplaySubject] = useState(
    mapelGuru && mapelGuru !== 'Guru Mata Pelajaran'
      ? mapelGuru
      : storedProfile.subject,
  );

  const updateProfile = useCallback((name: string, subject: string) => {
    if (name.trim()) {
      setDisplayName((current) => current === name ? current : name);
    }
    if (subject.trim() && subject !== 'Guru Mata Pelajaran') {
      setDisplaySubject((current) => current === subject ? current : subject);
    }
  }, []);

  // Wrapper halaman yang sudah ada menyuplai nama/mapel setelah data API tersedia.
  // Jangan timpa mapel dari profil lokal dengan teks fallback saat data API belum tersedia.
  useEffect(() => {
    if (parentLayout?.isSharedLayout && namaGuru && mapelGuru && mapelGuru !== 'Guru Mata Pelajaran') {
      parentLayout.updateProfile(namaGuru, mapelGuru);
    }
  }, [parentLayout, namaGuru, mapelGuru]);

  const handleProfileUpdated = useCallback((updatedUser: UpdatedProfileUser) => {
    if (updatedUser.name) {
      setDisplayName(updatedUser.name);
    }
  }, []);

  const contextValue = useMemo(
    () => ({ isSharedLayout: true as const, updateProfile }),
    [updateProfile],
  );

  if (parentLayout?.isSharedLayout) {
    return <main className={mainClassName}>{children}</main>;
  }

  return (
    <GuruLayoutContext.Provider value={contextValue}>
      <div className="grid min-h-screen grid-cols-1 bg-[#F5F1E7] font-['Plus_Jakarta_Sans',sans-serif] text-[#23283A] antialiased md:grid-cols-[264px_1fr]">
        <Sidebar
          namaGuru={displayName}
          mapelGuru={displaySubject}
          getInitials={getInitials}
          onEditProfile={() => setIsEditProfileOpen(true)}
        />

        <div className="min-w-0">{children ?? <Outlet />}</div>

        <EditProfileModal
          isOpen={isEditProfileOpen}
          onClose={() => setIsEditProfileOpen(false)}
          onProfileUpdated={handleProfileUpdated}
        />
      </div>
    </GuruLayoutContext.Provider>
  );
};
