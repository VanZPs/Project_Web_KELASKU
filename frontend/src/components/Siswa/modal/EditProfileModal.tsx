import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Camera, Check, Loader2, Pencil, Save, User, X } from 'lucide-react';
import api from '../../../api/axios';

interface UserData {
  id?: number;
  name?: string;
  email?: string;
  role?: string;
  student?: { id?: number; nis?: string; nisn?: string };
}

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated?: (user: UserData) => void;
}

export default function EditProfileModal({ isOpen, onClose, onProfileUpdated }: EditProfileModalProps) {
  const [user, setUser] = useState<UserData | null>(null);
  const [name, setName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    let photoObjectUrl: string | null = null;

    const loadProfile = async () => {
      setLoading(true);
      setError('');
      setSuccess('');
      try {
        const response = await api.get('/me');
        const data = response.data?.data ?? response.data;
        if (!cancelled && data) {
          setUser(data);
          setName(data.name || '');
          localStorage.setItem('user', JSON.stringify(data));
        }
      } catch (err: any) {
        if (!cancelled) {
          const stored = localStorage.getItem('user');
          if (stored) {
            try {
              const data = JSON.parse(stored);
              setUser(data);
              setName(data.name || '');
            } catch { /* Abaikan data lokal yang tidak valid. */ }
          }
          setError(err?.response?.data?.message || 'Gagal memuat data profil.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }

      try {
        const response = await api.get('/me/profile-photo', { responseType: 'blob' });
        if (response.data && response.data.size > 0) {
          photoObjectUrl = URL.createObjectURL(response.data);
          if (!cancelled) setProfilePhotoUrl(photoObjectUrl);
          else URL.revokeObjectURL(photoObjectUrl);
        }
      } catch {
        if (!cancelled) setProfilePhotoUrl(null);
      }
    };

    void loadProfile();
    return () => {
      cancelled = true;
      if (photoObjectUrl) URL.revokeObjectURL(photoObjectUrl);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !savingName && !uploadingPhoto) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, savingName, uploadingPhoto]);

  useEffect(() => () => {
    if (previewPhotoUrl) URL.revokeObjectURL(previewPhotoUrl);
  }, [previewPhotoUrl]);

  const handleChoosePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Format foto harus JPG, PNG, atau WebP.');
      setSuccess('');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Ukuran foto maksimal 2 MB.');
      setSuccess('');
      return;
    }
    setPreviewPhotoUrl(URL.createObjectURL(file));
    setSelectedPhoto(file);
    setError('');
    setSuccess('');
  };

  const handleUploadPhoto = async () => {
    if (!selectedPhoto) return;
    const formData = new FormData();
    formData.append('photo', selectedPhoto);
    try {
      setUploadingPhoto(true);
      setError('');
      await api.post('/me/profile-photo', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setProfilePhotoUrl(URL.createObjectURL(selectedPhoto));
      if (previewPhotoUrl) URL.revokeObjectURL(previewPhotoUrl);
      setPreviewPhotoUrl(null);
      setSelectedPhoto(null);
      setSuccess('Foto profil berhasil diperbarui.');
      window.dispatchEvent(new Event('profile-photo-updated'));
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Gagal mengunggah foto profil.');
    } finally {
      setUploadingPhoto(false);
    }
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
      return;
    }
    try {
      setSavingName(true);
      setError('');
      const response = await api.put('/me', { name: trimmedName });
      const updatedUser = response.data?.data ?? response.data?.user ?? { ...user, name: trimmedName };
      const nextUser = { ...(user || {}), ...updatedUser, name: updatedUser.name || trimmedName };
      setUser(nextUser);
      setName(nextUser.name || trimmedName);
      localStorage.setItem('user', JSON.stringify(nextUser));
      setEditingName(false);
      setSuccess('Nama berhasil diperbarui.');
      onProfileUpdated?.(nextUser);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Gagal memperbarui nama.');
    } finally {
      setSavingName(false);
    }
  };

  if (!isOpen) return null;
  const displayedPhoto = previewPhotoUrl || profilePhotoUrl;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm sm:p-6" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !savingName && !uploadingPhoto) onClose();
    }}>
      <div role="dialog" aria-modal="true" aria-labelledby="student-edit-profile-title" className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#E7DED6] bg-[#F8F5F0] shadow-2xl">
        <header className="flex shrink-0 items-start justify-between border-b border-[#E7DED6] bg-white px-5 py-4 sm:px-7">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F3E8DF] text-[#AE5A3E]"><User size={22} /></div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#AE5A3E]">KELASKU</p>
              <h2 id="student-edit-profile-title" className="text-xl font-bold text-[#3F3027]">Edit Profil</h2>
              <p className="mt-1 text-xs text-[#8A7A70]">Kelola foto profil dan nama akun Anda.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={savingName || uploadingPhoto} aria-label="Tutup edit profil" className="flex h-9 w-9 items-center justify-center rounded-lg text-[#8A7A70] transition hover:bg-[#F5F0EB] disabled:opacity-50"><X size={20} /></button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-7">
          {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          {success && <div role="status" className="mb-4 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"><Check size={17} />{success}</div>}
          {loading ? (
            <div className="flex min-h-64 items-center justify-center gap-3 text-[#6B4F3A]"><Loader2 size={22} className="animate-spin" />Memuat profil...</div>
          ) : (
            <section className="rounded-2xl border border-[#E7DED6] bg-white p-5 sm:p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F3E8DF] text-[#AE5A3E]"><User size={20} /></div>
                <div><h3 className="font-bold text-[#3F3027]">Informasi Profil</h3><p className="text-xs text-[#8A7A70]">Informasi akun siswa</p></div>
              </div>

              <div className="mb-6 flex flex-col gap-4 rounded-xl border border-[#E7DED6] bg-[#FAF8F5] p-4 sm:flex-row sm:items-center">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[#E7DED6] bg-[#F3E8DF] text-[#AE5A3E]">
                  {displayedPhoto ? <img src={displayedPhoto} alt="Foto profil siswa" className="h-full w-full object-cover" /> : <User size={38} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[#3F3027]">Foto Profil</p>
                  <p className="mt-1 text-xs leading-5 text-[#8A7A70]">Gunakan foto JPG, PNG, atau WebP dengan ukuran maksimal 2 MB.</p>
                  <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleChoosePhoto} className="hidden" />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => photoInputRef.current?.click()} disabled={uploadingPhoto} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-[#AE5A3E] px-3 py-2 text-xs font-semibold text-white hover:bg-[#934A32] disabled:opacity-50"><Camera size={15} />{displayedPhoto ? 'Ganti Foto' : 'Pilih Foto'}</button>
                    {selectedPhoto && <>
                      <button type="button" onClick={handleUploadPhoto} disabled={uploadingPhoto} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-[#263451] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{uploadingPhoto ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}{uploadingPhoto ? 'Mengunggah...' : 'Simpan Foto'}</button>
                      <button type="button" onClick={() => { if (previewPhotoUrl) URL.revokeObjectURL(previewPhotoUrl); setPreviewPhotoUrl(null); setSelectedPhoto(null); }} disabled={uploadingPhoto} className="min-h-9 rounded-lg border border-[#DCCFC5] px-3 py-2 text-xs font-semibold text-[#6B5A4F]">Batal</button>
                    </>}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="student-edit-profile-name" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#8A7A70]">Nama</label>
                  <div className="flex gap-2">
                    <input id="student-edit-profile-name" value={name} onChange={(event) => setName(event.target.value)} disabled={!editingName || savingName} readOnly={!editingName} maxLength={255} placeholder="Masukkan nama lengkap" className={`min-w-0 flex-1 rounded-xl border px-3 py-2.5 text-sm text-[#3F3027] outline-none ${editingName ? 'border-[#DCCFC5] bg-white focus:border-[#AE5A3E] focus:ring-2 focus:ring-[#AE5A3E]/10' : 'cursor-default border-[#E7DED6] bg-[#FAF8F5]'}`} />
                    {!editingName && <button type="button" onClick={() => { setName(user?.name || ''); setEditingName(true); setError(''); setSuccess(''); }} title="Edit nama" aria-label="Edit nama" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#DCCFC5] text-[#6B4F3A] hover:bg-[#FDF8F4] hover:text-[#AE5A3E]"><Pencil size={16} /></button>}
                  </div>
                </div>
                {editingName && <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={handleSaveName} disabled={savingName || !name.trim()} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#AE5A3E] px-4 text-sm font-semibold text-white hover:bg-[#934A32] disabled:opacity-50">{savingName ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}{savingName ? 'Menyimpan...' : 'Simpan'}</button>
                  <button type="button" onClick={() => { setName(user?.name || ''); setEditingName(false); setError(''); }} disabled={savingName} className="min-h-10 rounded-xl border border-[#DCCFC5] px-4 text-sm font-semibold text-[#6B5A4F] hover:bg-[#F5F0EB]">Batal</button>
                </div>}
                <p className="text-xs leading-5 text-[#9A8A80]">Nama ini akan ditampilkan pada profil dan sidebar akun siswa.</p>
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[#8A7A70]">Email</p>
                  <div className="break-all rounded-xl border border-[#E7DED6] bg-[#FAF8F5] px-3 py-2.5 text-sm text-[#3F3027]">{user?.email || '-'}</div>
                  <p className="mt-1.5 text-xs text-[#9A8A80]">Email tidak dapat diubah melalui halaman ini.</p>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
