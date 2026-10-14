import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Check,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  User,
  X,
} from 'lucide-react';
import api from '../../api/axios';

interface UserData {
  id?: number;
  name?: string;
  email?: string;
  role?: string;
  teacher?: TeacherData;
}

interface TeacherData {
  id?: number;
  user_id?: number;
  nipy?: string;
}

interface Subject {
  id: number;
  name: string;
  is_primary: boolean;
}

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated?: (user: UserData) => void;
}

const normalizeSubject = (subject: any): Subject => ({
  ...subject,
  id: Number(subject.id),
  is_primary:
    subject.is_primary === true ||
    subject.is_primary === 1 ||
    subject.is_primary === '1',
});

export default function EditProfileModal({
  isOpen,
  onClose,
  onProfileUpdated,
}: EditProfileModalProps) {
  const [user, setUser] = useState<UserData | null>(null);
  const [teacher, setTeacher] = useState<TeacherData | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [name, setName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [addingSubject, setAddingSubject] = useState(false);
  const [deletingSubjectId, setDeletingSubjectId] = useState<number | null>(null);
  const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [availableSubjects, setAvailableSubjects] = useState<Subject[]>([]);
  const [loadingAvailableSubjects, setLoadingAvailableSubjects] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    const loadProfile = async () => {
      setLoading(true);
      setError('');
      setSuccess('');

      try {
        const storedUser = localStorage.getItem('user');
        let currentUser: UserData | null = null;

        if (storedUser) {
          try {
            currentUser = JSON.parse(storedUser);
          } catch {
            currentUser = null;
          }
        }

        if (!cancelled && currentUser) {
          setUser(currentUser);
          setName(currentUser.name || '');
        }

        try {
          const response = await api.get('/me');
          const data = response.data?.data ?? response.data;
          if (!cancelled && data) {
            currentUser = data;
            setUser(data);
            setName(data.name || '');
            if (data.teacher) setTeacher(data.teacher);
            localStorage.setItem('user', JSON.stringify(data));
          }
        } catch {
          // Gunakan data localStorage jika endpoint /me tidak tersedia.
        }

        const subjectResponse = await api.get('/guru/mata-pelajaran');
        const subjectData = subjectResponse.data?.data ?? [];
        if (!cancelled) {
          setSubjects(subjectData.map(normalizeSubject));
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error('Gagal memuat profile:', err);
          setError(err?.response?.data?.message || 'Gagal memuat data profile.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !subjectToDelete && deletingSubjectId === null) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose, subjectToDelete, deletingSubjectId]);

  const mainSubject = useMemo(
    () => subjects.find((subject) => subject.is_primary) ?? null,
    [subjects],
  );
  const additionalSubjects = useMemo(
    () => subjects.filter((subject) => !subject.is_primary),
    [subjects],
  );

  if (!isOpen) return null;

  const handleEditName = () => {
    setName(user?.name || '');
    setError('');
    setSuccess('');
    setEditingName(true);
  };

  const handleCancelEditName = () => {
    setName(user?.name || '');
    setError('');
    setSuccess('');
    setEditingName(false);
  };

  const handleSaveName = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Nama tidak boleh kosong.');
      setSuccess('');
      return;
    }

    if (trimmedName === (user?.name || '').trim()) {
      setEditingName(false);
      setSuccess('Nama tidak mengalami perubahan.');
      setError('');
      return;
    }

    try {
      setSavingName(true);
      setError('');
      setSuccess('');
      const response = await api.put('/me', { name: trimmedName });
      const updatedUser = response.data?.data ?? response.data?.user ?? null;
      const newUser: UserData = {
        ...(user ?? {}),
        ...(updatedUser ?? {}),
        name: updatedUser?.name ?? trimmedName,
      };

      setUser(newUser);
      setName(newUser.name || trimmedName);
      localStorage.setItem('user', JSON.stringify(newUser));
      setEditingName(false);
      setSuccess('Nama berhasil diperbarui.');
      onProfileUpdated?.(newUser);
    } catch (err: any) {
      console.error('Gagal memperbarui nama:', err);
      setError(err?.response?.data?.message || 'Gagal memperbarui nama.');
    } finally {
      setSavingName(false);
    }
  };

  const loadAvailableSubjects = async () => {
    try {
      setLoadingAvailableSubjects(true);
      setError('');
      const response = await api.get('/subjects');
      const allSubjects = response.data?.data ?? [];
      const ownedIds = new Set(subjects.map((subject) => subject.id));
      setAvailableSubjects(
        allSubjects
          .filter((subject: any) => !ownedIds.has(Number(subject.id)))
          .map(normalizeSubject),
      );
    } catch (err: any) {
      console.error('Gagal memuat daftar mata pelajaran:', err);
      setError(err?.response?.data?.message || 'Gagal memuat daftar mata pelajaran.');
    } finally {
      setLoadingAvailableSubjects(false);
    }
  };

  const handleOpenAddSubject = async () => {
    setAddingSubject(true);
    setSelectedSubjectId('');
    setSuccess('');
    await loadAvailableSubjects();
  };

  const handleCancelAddSubject = () => {
    setAddingSubject(false);
    setSelectedSubjectId('');
    setAvailableSubjects([]);
  };

  const handleAddSubject = async () => {
    if (!selectedSubjectId) {
      setError('Silakan pilih mata pelajaran terlebih dahulu.');
      return;
    }

    try {
      setLoadingAvailableSubjects(true);
      setError('');
      setSuccess('');
      const response = await api.post('/guru/mata-pelajaran', {
        subject_id: Number(selectedSubjectId),
      });
      const newSubject = response.data?.data;

      if (newSubject) {
        setSubjects((current) => [...current, normalizeSubject(newSubject)]);
      } else {
        const subject = availableSubjects.find(
          (item) => Number(item.id) === Number(selectedSubjectId),
        );
        if (subject) {
          setSubjects((current) => [
            ...current,
            { ...subject, id: Number(subject.id), is_primary: false },
          ]);
        }
      }

      setSuccess('Mata pelajaran tambahan berhasil ditambahkan.');
      setSelectedSubjectId('');
      setAddingSubject(false);
      setAvailableSubjects([]);
    } catch (err: any) {
      console.error('Gagal menambahkan mata pelajaran:', err);
      setError(err?.response?.data?.message || 'Gagal menambahkan mata pelajaran.');
    } finally {
      setLoadingAvailableSubjects(false);
    }
  };

  const handleDeleteSubject = async () => {
    if (!subjectToDelete || subjectToDelete.is_primary) return;
    const subjectId = subjectToDelete.id;

    try {
      setDeletingSubjectId(subjectId);
      setError('');
      setSuccess('');
      await api.delete(`/guru/mata-pelajaran/${subjectId}`);
      setSubjects((current) => current.filter((item) => item.id !== subjectId));
      setSubjectToDelete(null);
      setSuccess(
        `Mata pelajaran "${subjectToDelete.name}" dan jadwal terkait berhasil dihapus.`,
      );
    } catch (err: any) {
      console.error('Gagal menghapus mata pelajaran:', err);
      setError(
        err?.response?.data?.message ||
          'Gagal menghapus mata pelajaran dan jadwal terkait.',
      );
    } finally {
      setDeletingSubjectId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !subjectToDelete && !savingName) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-profile-modal-title"
        className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[#E7DED6] bg-[#F8F5F0] shadow-2xl"
      >
        <header className="flex shrink-0 items-start justify-between border-b border-[#E7DED6] bg-white px-5 py-4 sm:px-7">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F3E8DF] text-[#AE5A3E]">
              <User size={22} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#AE5A3E]">KELASKU</p>
              <h2 id="edit-profile-modal-title" className="text-xl font-bold text-[#3F3027]">
                Edit Profil
              </h2>
              <p className="mt-1 text-xs text-[#8A7A70]">
                Kelola informasi profil dan mata pelajaran Anda.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={savingName || deletingSubjectId !== null}
            aria-label="Tutup edit profil"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#8A7A70] transition hover:bg-[#F5F0EB] hover:text-[#5C4B40] disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-7">
          {error && (
            <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div role="status" className="mb-4 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              <Check size={17} /> {success}
            </div>
          )}

          {loading ? (
            <div className="flex min-h-56 items-center justify-center gap-3 text-[#6B4F3A]">
              <Loader2 size={22} className="animate-spin" /> Memuat profil...
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-5">
              <section className="rounded-2xl border border-[#E7DED6] bg-white p-5 lg:col-span-2">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F3E8DF] text-[#AE5A3E]">
                    <User size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#3F3027]">Informasi Profil</h3>
                    <p className="text-xs text-[#8A7A70]">Informasi akun guru</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="edit-profile-name" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#8A7A70]">Nama</label>
                    <div className="flex gap-2">
                      <input
                        id="edit-profile-name"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        disabled={!editingName || savingName}
                        readOnly={!editingName}
                        maxLength={255}
                        placeholder="Masukkan nama lengkap"
                        className={`min-w-0 flex-1 rounded-xl border px-3 py-2.5 text-sm text-[#3F3027] outline-none ${editingName ? 'border-[#DCCFC5] bg-white focus:border-[#AE5A3E] focus:ring-2 focus:ring-[#AE5A3E]/10' : 'cursor-default border-[#E7DED6] bg-[#FAF8F5]'}`}
                      />
                      {!editingName && (
                        <button type="button" onClick={handleEditName} title="Edit nama" aria-label="Edit nama" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#DCCFC5] text-[#6B4F3A] hover:bg-[#FDF8F4] hover:text-[#AE5A3E]">
                          <Pencil size={16} />
                        </button>
                      )}
                    </div>
                  </div>

                  {editingName && (
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={handleSaveName} disabled={savingName || !name.trim()} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#AE5A3E] px-4 text-sm font-semibold text-white hover:bg-[#934A32] disabled:opacity-50">
                        {savingName ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        {savingName ? 'Menyimpan...' : 'Simpan'}
                      </button>
                      <button type="button" onClick={handleCancelEditName} disabled={savingName} className="min-h-10 rounded-xl border border-[#DCCFC5] px-4 text-sm font-semibold text-[#6B5A4F] hover:bg-[#F5F0EB] disabled:opacity-50">
                        Batal
                      </button>
                    </div>
                  )}

                  <p className="text-xs leading-5 text-[#9A8A80]">Nama ini ditampilkan pada profil dan sidebar guru.</p>

                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[#8A7A70]">Email</p>
                    <div className="break-all rounded-xl border border-[#E7DED6] bg-[#FAF8F5] px-3 py-2.5 text-sm text-[#3F3027]">{user?.email || '-'}</div>
                  </div>
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[#8A7A70]">NIPY</p>
                    <div className="rounded-xl border border-[#E7DED6] bg-[#FAF8F5] px-3 py-2.5 text-sm text-[#3F3027]">{teacher?.nipy || user?.teacher?.nipy || '-'}</div>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-[#E7DED6] bg-white p-5 lg:col-span-3">
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F3E8DF] text-[#AE5A3E]"><BookOpen size={20} /></div>
                    <div>
                      <h3 className="font-bold text-[#3F3027]">Mata Pelajaran</h3>
                      <p className="mt-1 text-xs leading-5 text-[#8A7A70]">Atur mata pelajaran utama dan tambahan.</p>
                    </div>
                  </div>
                  {!addingSubject && (
                    <button type="button" onClick={handleOpenAddSubject} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#AE5A3E] px-3 py-2 text-sm font-semibold text-white hover:bg-[#934A32]">
                      <Plus size={16} /> Tambah
                    </button>
                  )}
                </div>

                {addingSubject && (
                  <div className="mb-5 rounded-xl border border-[#E7DED6] bg-[#FAF8F5] p-4">
                    <h4 className="text-sm font-bold text-[#3F3027]">Tambah Mata Pelajaran</h4>
                    <p className="mt-1 text-xs text-[#8A7A70]">Mata pelajaran yang ditambahkan akan menjadi mata pelajaran tambahan.</p>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <select value={selectedSubjectId} onChange={(event) => setSelectedSubjectId(event.target.value)} disabled={loadingAvailableSubjects} className="min-h-10 min-w-0 flex-1 rounded-xl border border-[#DCCFC5] bg-white px-3 text-sm text-[#3F3027] outline-none focus:border-[#AE5A3E] disabled:bg-gray-100">
                        <option value="">{loadingAvailableSubjects ? 'Memuat mata pelajaran...' : availableSubjects.length === 0 ? 'Semua mata pelajaran sudah ditambahkan' : 'Pilih mata pelajaran'}</option>
                        {availableSubjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                      </select>
                      <button type="button" onClick={handleAddSubject} disabled={!selectedSubjectId || loadingAvailableSubjects} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#AE5A3E] px-4 text-sm font-semibold text-white hover:bg-[#934A32] disabled:opacity-50">
                        {loadingAvailableSubjects ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Tambahkan
                      </button>
                      <button type="button" onClick={handleCancelAddSubject} className="min-h-10 rounded-xl border border-[#DCCFC5] bg-white px-4 text-sm font-semibold text-[#6B5A4F] hover:bg-[#F5F0EB]">Batal</button>
                    </div>
                  </div>
                )}

                <div className="mb-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-sm font-bold text-[#3F3027]">Mata Pelajaran Utama</h4>
                    <span className="rounded-full bg-[#F3E8DF] px-3 py-1 text-xs font-semibold text-[#AE5A3E]">Utama</span>
                  </div>
                  {mainSubject ? (
                    <div className="flex items-center justify-between rounded-xl border border-[#E7DED6] bg-[#FAF8F5] p-3">
                      <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[#AE5A3E]"><BookOpen size={17} /></div><div><p className="text-sm font-semibold text-[#3F3027]">{mainSubject.name}</p><p className="text-xs text-[#8A7A70]">Mata pelajaran utama</p></div></div>
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-100 text-green-600"><Check size={15} /></span>
                    </div>
                  ) : <div className="rounded-xl border border-dashed border-[#DCCFC5] px-4 py-5 text-center text-sm text-[#8A7A70]">Mata pelajaran utama belum tersedia.</div>}
                </div>

                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <div><h4 className="text-sm font-bold text-[#3F3027]">Mata Pelajaran Tambahan</h4><p className="mt-1 text-xs text-[#8A7A70]">Digunakan ketika membuat kelas tambahan.</p></div>
                    <span className="rounded-full bg-[#F1EEE9] px-3 py-1 text-xs font-semibold text-[#6B5A4F]">{additionalSubjects.length}</span>
                  </div>
                  {additionalSubjects.length ? (
                    <div className="space-y-2">
                      {additionalSubjects.map((subject) => (
                        <div key={subject.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#E7DED6] p-3 hover:bg-[#FCFAF8]">
                          <div className="flex min-w-0 items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F8F1EB] text-[#AE5A3E]"><BookOpen size={17} /></div><div className="min-w-0"><p className="truncate text-sm font-semibold text-[#3F3027]">{subject.name}</p><p className="text-xs text-[#8A7A70]">Mata pelajaran tambahan</p></div></div>
                          <button type="button" onClick={() => setSubjectToDelete(subject)} disabled={deletingSubjectId !== null} title="Hapus mata pelajaran" aria-label={`Hapus ${subject.name}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-50"><Trash2 size={16} /></button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-[#DCCFC5] bg-[#FAF8F5] px-4 py-7 text-center">
                      <BookOpen size={20} className="mx-auto mb-2 text-[#AE5A3E]" />
                      <p className="text-sm font-semibold text-[#5C4B40]">Belum ada mata pelajaran tambahan</p>
                      <p className="mt-1 text-xs text-[#8A7A70]">Tambahkan mata pelajaran untuk menggunakannya pada Kelas Tambahan.</p>
                    </div>
                  )}
                </div>

                <div className="mt-5 rounded-xl border border-[#E7DED6] bg-[#FAF8F5] px-4 py-3 text-xs leading-5 text-[#7B6B60]">
                  <strong className="text-[#5C4B40]">Catatan:</strong> Mata pelajaran utama ditentukan oleh sekolah. Mata pelajaran tambahan dapat Anda kelola sendiri.
                </div>
              </section>
            </div>
          )}
        </div>
      </div>

      {subjectToDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && deletingSubjectId === null) setSubjectToDelete(null); }}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="delete-subject-title" className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#E7DED6] px-5 py-4">
              <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-500"><AlertTriangle size={21} /></div><div><h3 id="delete-subject-title" className="font-bold text-[#3F3027]">Hapus Mata Pelajaran?</h3><p className="text-xs text-[#8A7A70]">Konfirmasi penghapusan</p></div></div>
              <button type="button" onClick={() => setSubjectToDelete(null)} disabled={deletingSubjectId !== null} aria-label="Tutup konfirmasi" className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8A7A70] hover:bg-[#F5F0EB] disabled:opacity-50"><X size={17} /></button>
            </div>
            <div className="space-y-4 px-5 py-5">
              <p className="text-sm leading-6 text-[#5C4B40]">Apakah Anda yakin ingin menghapus mata pelajaran <strong>"{subjectToDelete.name}"</strong> dari profil Anda?</p>
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs leading-5 text-red-700"><strong>Perhatian:</strong> seluruh jadwal yang menggunakan mata pelajaran ini juga akan ikut dihapus. Tindakan ini tidak dapat dibatalkan.</div>
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-[#E7DED6] bg-[#FAF8F5] px-5 py-4 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setSubjectToDelete(null)} disabled={deletingSubjectId !== null} className="min-h-10 rounded-xl border border-[#DCCFC5] bg-white px-4 text-sm font-semibold text-[#6B5A4F] hover:bg-[#F5F0EB] disabled:opacity-50">Batal</button>
              <button type="button" onClick={handleDeleteSubject} disabled={deletingSubjectId !== null} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-red-500 px-4 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60">
                {deletingSubjectId !== null ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                {deletingSubjectId !== null ? 'Menghapus...' : 'Hapus Mata Pelajaran'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}