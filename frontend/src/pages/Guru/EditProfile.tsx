import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  AlertTriangle,
  ArrowLeft,
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

import {
  useNavigate,
} from 'react-router-dom';

import api from '../../api/axios';

import { GuruLayout } from '../../layouts/Guru/GuruLayout';


/*
|--------------------------------------------------------------------------
| TYPES
|--------------------------------------------------------------------------
*/
interface UserData {
  id?: number;
  name?: string;
  email?: string;
  role?: string;
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


/*
|--------------------------------------------------------------------------
| EDIT PROFILE
|--------------------------------------------------------------------------
*/
const EditProfile = () => {

  const navigate = useNavigate();


  /*
   * ==========================================================
   * STATE
   * ==========================================================
   */
  const [user, setUser] =
    useState<UserData | null>(null);

  const [teacher, setTeacher] =
    useState<TeacherData | null>(null);

  const [subjects, setSubjects] =
    useState<Subject[]>([]);

  const [loading, setLoading] =
    useState(true);

  /*
   * Status saat menyimpan nama.
   */
  const [savingName, setSavingName] =
    useState(false);

  /*
   * Nama yang sedang ditampilkan / diedit.
   */
  const [name, setName] =
    useState('');

  /*
   * Menentukan apakah user sedang
   * berada dalam mode edit nama.
   */
  const [editingName, setEditingName] =
    useState(false);

  const [addingSubject, setAddingSubject] =
    useState(false);

  const [deletingSubjectId, setDeletingSubjectId] =
    useState<number | null>(null);

  const [subjectToDelete, setSubjectToDelete] =
    useState<Subject | null>(null);

  const [selectedSubjectId, setSelectedSubjectId] =
    useState('');

  const [availableSubjects, setAvailableSubjects] =
    useState<Subject[]>([]);

  const [loadingAvailableSubjects, setLoadingAvailableSubjects] =
    useState(false);

  const [error, setError] =
    useState('');

  const [success, setSuccess] =
    useState('');


  /*
   * ==========================================================
   * LOAD PROFILE
   * ==========================================================
   */
  useEffect(() => {

    const loadProfile = async () => {

      try {

        setLoading(true);
        setError('');

        const storedUser =
          localStorage.getItem('user');

        if (storedUser) {

          try {

            const parsedUser =
              JSON.parse(storedUser);

            setUser(parsedUser);

            setName(
              parsedUser?.name || ''
            );

          } catch {

            setUser(null);

            setName('');

          }

        }


        /*
         * Ambil data profile dari API.
         */
        try {

          const meResponse =
            await api.get('/me');

          const meData =
            meResponse.data?.data ??
            meResponse.data;

          if (meData) {

            setUser(
              meData
            );

            setName(
              meData.name || ''
            );

            if (meData.teacher) {

              setTeacher(
                meData.teacher
              );

            }


            /*
             * Sinkronkan data user terbaru
             * ke localStorage.
             */
            localStorage.setItem(
              'user',
              JSON.stringify(meData)
            );

          }

        } catch {

          /*
           * Jika endpoint /me gagal,
           * data dari localStorage tetap digunakan.
           */

        }


        /*
         * Ambil mata pelajaran guru.
         */
        const subjectResponse =
          await api.get(
            '/guru/mata-pelajaran'
          );

        const subjectData =
          subjectResponse.data?.data ?? [];


        /*
         * Normalisasi data subject.
         */
        const normalizedSubjects =
          subjectData.map(
            (subject: any) => ({
              ...subject,
              id: Number(subject.id),
              is_primary:
                subject.is_primary === true ||
                subject.is_primary === 1 ||
                subject.is_primary === '1',
            })
          );


        setSubjects(
          normalizedSubjects
        );

      } catch (err: any) {

        console.error(
          'Gagal memuat profile:',
          err
        );

        setError(
          err?.response?.data?.message ||
          'Gagal memuat data profile.'
        );

      } finally {

        setLoading(false);

      }

    };


    loadProfile();

  }, []);


  /*
   * ==========================================================
   * MAIN SUBJECT
   * ==========================================================
   */
  const mainSubject =
    useMemo(
      () =>
        subjects.find(
          (subject) =>
            subject.is_primary
        ) ?? null,
      [subjects]
    );


  /*
   * ==========================================================
   * ADDITIONAL SUBJECTS
   * ==========================================================
   */
  const additionalSubjects =
    useMemo(
      () =>
        subjects.filter(
          (subject) =>
            !subject.is_primary
        ),
      [subjects]
    );


  /*
   * ==========================================================
   * GURU SIDEBAR DATA
   * ==========================================================
   */
  const namaGuru =
    user?.name || name || 'Guru';

  const mapelGuru =
    mainSubject?.name || 'Guru';


  const getInitials =
    (name: string) => {

      const words =
        name
          .trim()
          .split(/\s+/)
          .filter(Boolean);

      if (words.length === 0) {
        return 'G';
      }

      if (words.length === 1) {

        return words[0]
          .substring(0, 2)
          .toUpperCase();

      }

      return (
        words[0][0] +
        words[1][0]
      ).toUpperCase();

    };


  /*
   * ==========================================================
   * OPEN EDIT NAME
   * ==========================================================
   */
  const handleEditName =
    () => {

      /*
       * Pastikan nilai input dimulai
       * dari nama yang tersimpan.
       */
      setName(
        user?.name || ''
      );

      setError('');
      setSuccess('');

      setEditingName(true);

    };


  /*
   * ==========================================================
   * CANCEL EDIT NAME
   * ==========================================================
   */
  const handleCancelEditName =
    () => {

      /*
       * Kembalikan nama ke data terakhir
       * yang tersimpan di user state.
       */
      setName(
        user?.name || ''
      );

      setError('');
      setSuccess('');

      setEditingName(false);

    };


  /*
   * ==========================================================
   * SAVE NAME
   * ==========================================================
   */
  const handleSaveName =
    async () => {

      const trimmedName =
        name.trim();


      /*
       * Validasi nama.
       */
      if (!trimmedName) {

        setError(
          'Nama tidak boleh kosong.'
        );

        setSuccess('');

        return;

      }


      /*
       * Tidak perlu request jika nama
       * tidak mengalami perubahan.
       */
      if (
        trimmedName ===
        (user?.name || '').trim()
      ) {

        setEditingName(false);

        setSuccess(
          'Nama tidak mengalami perubahan.'
        );

        setError('');

        return;

      }


      try {

        setSavingName(true);

        setError('');

        setSuccess('');


        /*
         * Kirim nama baru ke backend.
         */
        const response =
          await api.put(
            '/me',
            {
              name: trimmedName,
            }
          );


        const updatedUser =
          response.data?.data ??
          response.data?.user ??
          null;


        /*
         * Gunakan data user dari backend
         * jika tersedia.
         */
        const newUser: UserData = {
          ...(user ?? {}),
          ...(updatedUser ?? {}),
          name:
            updatedUser?.name ??
            trimmedName,
        };


        /*
         * Update state.
         */
        setUser(
          newUser
        );

        setName(
          newUser.name || trimmedName
        );


        /*
         * Update localStorage.
         *
         * Hal ini penting agar nama baru
         * tetap digunakan ketika halaman
         * lain dibuka atau browser di-refresh.
         */
        localStorage.setItem(
          'user',
          JSON.stringify(newUser)
        );


        /*
         * Kembali ke mode view setelah
         * penyimpanan berhasil.
         */
        setEditingName(false);


        setSuccess(
          'Nama berhasil diperbarui.'
        );

      } catch (err: any) {

        console.error(
          'Gagal memperbarui nama:',
          err
        );

        setError(
          err?.response?.data?.message ||
          'Gagal memperbarui nama.'
        );

      } finally {

        setSavingName(false);

      }

    };


  /*
   * ==========================================================
   * LOAD AVAILABLE SUBJECTS
   * ==========================================================
   */
  const loadAvailableSubjects =
    async () => {

      try {

        setLoadingAvailableSubjects(
          true
        );

        setError('');


        const response =
          await api.get(
            '/subjects'
          );

        const allSubjects =
          response.data?.data ?? [];


        /*
         * ID mata pelajaran yang sudah dimiliki guru.
         */
        const ownedSubjectIds =
          new Set(
            subjects.map(
              (subject) =>
                subject.id
            )
          );


        /*
         * Hanya tampilkan subject yang belum dimiliki.
         */
        const available =
          allSubjects.filter(
            (subject: any) =>
              !ownedSubjectIds.has(
                Number(subject.id)
              )
          );


        setAvailableSubjects(
          available.map(
            (subject: any) => ({
              ...subject,
              id: Number(subject.id),
              is_primary:
                subject.is_primary === true ||
                subject.is_primary === 1 ||
                subject.is_primary === '1',
            })
          )
        );

      } catch (err: any) {

        console.error(
          'Gagal memuat daftar mata pelajaran:',
          err
        );

        setError(
          err?.response?.data?.message ||
          'Gagal memuat daftar mata pelajaran.'
        );

      } finally {

        setLoadingAvailableSubjects(
          false
        );

      }

    };


  /*
   * ==========================================================
   * OPEN ADD SUBJECT
   * ==========================================================
   */
  const handleOpenAddSubject =
    async () => {

      setAddingSubject(true);

      setSelectedSubjectId('');

      setSuccess('');

      await loadAvailableSubjects();

    };


  /*
   * ==========================================================
   * CANCEL ADD SUBJECT
   * ==========================================================
   */
  const handleCancelAddSubject =
    () => {

      setAddingSubject(false);

      setSelectedSubjectId('');

      setAvailableSubjects([]);

    };


  /*
   * ==========================================================
   * ADD SUBJECT
   * ==========================================================
   */
  const handleAddSubject =
    async () => {

      if (!selectedSubjectId) {

        setError(
          'Silakan pilih mata pelajaran terlebih dahulu.'
        );

        return;

      }


      try {

        setLoadingAvailableSubjects(
          true
        );

        setError('');

        setSuccess('');


        const response =
          await api.post(
            '/guru/mata-pelajaran',
            {
              subject_id:
                Number(
                  selectedSubjectId
                ),
            }
          );


        const newSubject =
          response.data?.data;


        if (newSubject) {

          setSubjects(
            (current) => [
              ...current,
              {
                id: Number(
                  newSubject.id
                ),
                name:
                  newSubject.name,
                is_primary:
                  newSubject.is_primary === true ||
                  newSubject.is_primary === 1 ||
                  newSubject.is_primary === '1',
              },
            ]
          );

        } else {

          /*
           * Fallback apabila backend
           * tidak mengembalikan data subject.
           */
          const subject =
            availableSubjects.find(
              (item) =>
                Number(item.id) ===
                Number(selectedSubjectId)
            );


          if (subject) {

            setSubjects(
              (current) => [
                ...current,
                {
                  ...subject,
                  id: Number(
                    subject.id
                  ),
                  is_primary: false,
                },
              ]
            );

          }

        }


        setSuccess(
          'Mata pelajaran tambahan berhasil ditambahkan.'
        );

        setSelectedSubjectId('');

        setAddingSubject(false);

        setAvailableSubjects([]);

      } catch (err: any) {

        console.error(
          'Gagal menambahkan mata pelajaran:',
          err
        );

        setError(
          err?.response?.data?.message ||
          'Gagal menambahkan mata pelajaran.'
        );

      } finally {

        setLoadingAvailableSubjects(
          false
        );

      }

    };


  /*
   * ==========================================================
   * OPEN DELETE SUBJECT CONFIRMATION
   * ==========================================================
   */
  const handleOpenDeleteSubject =
    (subject: Subject) => {

      /*
       * Mata pelajaran utama tidak boleh dihapus.
       */
      if (subject.is_primary) {
        return;
      }


      setError('');

      setSuccess('');

      setSubjectToDelete(
        subject
      );

    };


  /*
   * ==========================================================
   * CANCEL DELETE SUBJECT
   * ==========================================================
   */
  const handleCancelDeleteSubject =
    () => {

      if (deletingSubjectId !== null) {
        return;
      }

      setSubjectToDelete(
        null
      );

    };


  /*
   * ==========================================================
   * DELETE SUBJECT
   * ==========================================================
   */
  const handleDeleteSubject =
    async () => {

      if (!subjectToDelete) {
        return;
      }


      /*
       * Mata pelajaran utama tidak boleh dihapus.
       */
      if (subjectToDelete.is_primary) {

        setSubjectToDelete(null);

        return;

      }


      const subjectId =
        subjectToDelete.id;


      try {

        setDeletingSubjectId(
          subjectId
        );

        setError('');

        setSuccess('');


        /*
         * Backend akan menghapus:
         * 1. Jadwal terkait.
         * 2. Relasi mata pelajaran guru.
         */
        await api.delete(
          `/guru/mata-pelajaran/${subjectId}`
        );


        /*
         * Update state frontend.
         */
        setSubjects(
          (current) =>
            current.filter(
              (item) =>
                item.id !== subjectId
            )
        );


        setSubjectToDelete(
          null
        );


        setSuccess(
          `Mata pelajaran "${subjectToDelete.name}" dan jadwal terkait berhasil dihapus.`
        );

      } catch (err: any) {

        console.error(
          'Gagal menghapus mata pelajaran:',
          err
        );

        setError(
          err?.response?.data?.message ||
          'Gagal menghapus mata pelajaran dan jadwal terkait.'
        );

      } finally {

        setDeletingSubjectId(
          null
        );

      }

    };


  /*
   * ==========================================================
   * LOADING
   * ==========================================================
   */
  if (loading) {

    return (

      <GuruLayout
        namaGuru={namaGuru}
        mapelGuru={mapelGuru}
        getInitials={getInitials}
      >

        <div className="flex min-h-[calc(100vh-48px)] items-center justify-center">

          <div className="flex items-center gap-3 text-[#6B4F3A]">

            <Loader2
              size={22}
              className="animate-spin"
            />

            <span className="text-sm font-medium">
              Memuat profil...
            </span>

          </div>

        </div>

      </GuruLayout>

    );

  }


  /*
   * ==========================================================
   * RENDER
   * ==========================================================
   */
  return (

    <GuruLayout
      namaGuru={namaGuru}
      mapelGuru={mapelGuru}
      getInitials={getInitials}
    >

      <div className="min-h-screen bg-[#F8F5F0]">

        <div className="w-full py-6">


          {/* ==================================================
              MODERN HEADER
              ================================================== */}
          <div className="mb-7">

            <button
              type="button"
              onClick={() => navigate('/guru')}
              className="group mb-5 inline-flex items-center gap-2 rounded-xl border border-[#E7DED6] bg-white px-3 py-2 text-sm font-medium text-[#6B4F3A] shadow-sm transition-all duration-200 hover:border-[#DCCFC5] hover:text-[#AE5A3E] hover:shadow-md"
            >

              <ArrowLeft
                size={17}
                className="transition-transform duration-200 group-hover:-translate-x-1"
              />

              Kembali ke Dashboard

            </button>


            <div className="relative overflow-hidden rounded-3xl border border-[#E7DED6] bg-white px-6 py-7 shadow-[0_8px_30px_rgba(63,48,39,0.06)] sm:px-8 sm:py-8">

              <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-[#F1E4D7]/70 blur-3xl" />

              <div className="pointer-events-none absolute -bottom-20 left-1/3 h-36 w-36 rounded-full bg-[#F7EEE6]/80 blur-3xl" />


              <div className="relative flex items-start gap-4 sm:gap-5">

                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F3E8DF] text-[#AE5A3E] shadow-sm sm:h-14 sm:w-14">

                  <User
                    size={24}
                    strokeWidth={1.8}
                  />

                </div>


                <div className="min-w-0">

                  <div className="mb-1.5 flex items-center gap-2">

                    <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#AE5A3E]">
                      Profil Guru
                    </span>

                    <span className="h-1 w-1 rounded-full bg-[#D5B7A5]" />

                    <span className="text-[11px] font-medium text-[#A18F84]">
                      KELASKU
                    </span>

                  </div>


                  <h1 className="text-3xl font-bold tracking-tight text-[#3F3027] sm:text-4xl">
                    Edit Profile
                  </h1>


                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[#7B6B60] sm:text-base">
                    Kelola informasi profil dan mata pelajaran
                    Anda dengan mudah.
                  </p>

                </div>

              </div>

            </div>

          </div>


          {/* ==================================================
              ALERT ERROR
              ================================================== */}
          {error && (

            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>

          )}


          {/* ==================================================
              ALERT SUCCESS
              ================================================== */}
          {success && (

            <div className="mb-5 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">

              <Check size={18} />

              {success}

            </div>

          )}


          <div className="grid gap-6 lg:grid-cols-3">


            {/* ==================================================
                PROFILE INFORMATION
                ================================================== */}
            <section className="rounded-2xl border border-[#E7DED6] bg-white p-6 shadow-sm lg:col-span-1">

              <div className="mb-6 flex items-center gap-3">

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F3E8DF] text-[#AE5A3E]">

                  <User size={21} />

                </div>

                <div>

                  <h2 className="font-bold text-[#3F3027]">
                    Informasi Profil
                  </h2>

                  <p className="text-xs text-[#8A7A70]">
                    Informasi akun guru
                  </p>

                </div>

              </div>


              <div className="space-y-5">


                {/* ==================================================
                    NAMA
                    ================================================== */}
                <div>

                  <label
                    htmlFor="nama-guru"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#8A7A70]"
                  >
                    Nama
                  </label>


                  <div className="flex items-center gap-2">

                    <input
                      id="nama-guru"
                      type="text"
                      value={name}
                      onChange={(event) =>
                        setName(
                          event.target.value
                        )
                      }
                      disabled={
                        !editingName ||
                        savingName
                      }
                      readOnly={
                        !editingName
                      }
                      placeholder="Masukkan nama lengkap"
                      maxLength={255}
                      className={`min-w-0 flex-1 rounded-xl border px-4 py-3 text-sm text-[#3F3027] outline-none transition placeholder:text-[#B4A49A] ${
                        editingName
                          ? 'border-[#DCCFC5] bg-white focus:border-[#AE5A3E] focus:ring-2 focus:ring-[#AE5A3E]/10'
                          : 'cursor-default border-[#E7DED6] bg-[#FAF8F5]'
                      } disabled:cursor-not-allowed disabled:bg-gray-100`}
                    />


                    {/* Tombol Edit */}
                    {!editingName && (

                      <button
                        type="button"
                        onClick={
                          handleEditName
                        }
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#DCCFC5] bg-white text-[#6B4F3A] shadow-sm transition hover:border-[#AE5A3E] hover:bg-[#FDF8F4] hover:text-[#AE5A3E]"
                        title="Edit nama"
                        aria-label="Edit nama"
                      >

                        <Pencil size={17} />

                      </button>

                    )}

                  </div>


                  <p className="mt-1.5 text-xs text-[#9A8A80]">
                    Nama ini akan ditampilkan pada profil dan sidebar guru.
                  </p>

                </div>


                {/* ==================================================
                    TOMBOL AKSI EDIT NAMA
                    ================================================== */}
                {editingName && (

                  <div className="flex flex-col gap-2 sm:flex-row">

                    {/* Simpan */}
                    <button
                      type="button"
                      onClick={
                        handleSaveName
                      }
                      disabled={
                        savingName ||
                        !name.trim()
                      }
                      className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#AE5A3E] px-5 text-sm font-semibold text-white transition hover:bg-[#934A32] disabled:cursor-not-allowed disabled:opacity-50"
                    >

                      {savingName ? (

                        <>

                          <Loader2
                            size={17}
                            className="animate-spin"
                          />

                          Menyimpan...

                        </>

                      ) : (

                        <>

                          <Save size={17} />

                          Simpan Perubahan

                        </>

                      )}

                    </button>


                    {/* Batal */}
                    <button
                      type="button"
                      onClick={
                        handleCancelEditName
                      }
                      disabled={
                        savingName
                      }
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#DCCFC5] bg-white px-5 text-sm font-semibold text-[#6B5A4F] transition hover:bg-[#F5F0EB] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
                    >

                      <X size={17} />

                      Batal

                    </button>

                  </div>

                )}


                {/* ==================================================
                    EMAIL
                    ================================================== */}
                <div>

                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#8A7A70]">
                    Email
                  </label>

                  <div className="break-all rounded-xl border border-[#E7DED6] bg-[#FAF8F5] px-4 py-3 text-sm text-[#3F3027]">
                    {user?.email || '-'}
                  </div>

                </div>


                {/* ==================================================
                    NIPY
                    ================================================== */}
                <div>

                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#8A7A70]">
                    NIPY
                  </label>

                  <div className="rounded-xl border border-[#E7DED6] bg-[#FAF8F5] px-4 py-3 text-sm text-[#3F3027]">
                    {teacher?.nipy || '-'}
                  </div>

                </div>

              </div>

            </section>


            {/* ==================================================
                SUBJECT MANAGEMENT
                ================================================== */}
            <section className="rounded-2xl border border-[#E7DED6] bg-white p-6 shadow-sm lg:col-span-2">


              {/* Header */}
              <div className="mb-6 flex items-start justify-between gap-4">

                <div className="flex items-start gap-3">

                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F3E8DF] text-[#AE5A3E]">

                    <BookOpen size={21} />

                  </div>

                  <div>

                    <h2 className="font-bold text-[#3F3027]">
                      Mata Pelajaran
                    </h2>

                    <p className="mt-1 text-xs leading-5 text-[#8A7A70]">
                      Atur mata pelajaran utama dan tambahan yang Anda ajarkan.
                    </p>

                  </div>

                </div>


                {!addingSubject && (

                  <button
                    type="button"
                    onClick={handleOpenAddSubject}
                    className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#AE5A3E] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#934A32]"
                  >

                    <Plus size={17} />

                    Tambah

                  </button>

                )}

              </div>


              {/* ==================================================
                  ADD SUBJECT FORM
                  ================================================== */}
              {addingSubject && (

                <div className="mb-6 rounded-xl border border-[#E7DED6] bg-[#FAF8F5] p-4">

                  <div className="mb-3">

                    <h3 className="text-sm font-bold text-[#3F3027]">
                      Tambah Mata Pelajaran
                    </h3>

                    <p className="mt-1 text-xs text-[#8A7A70]">
                      Mata pelajaran yang ditambahkan akan menjadi mata pelajaran tambahan.
                    </p>

                  </div>


                  <div className="flex flex-col gap-3 sm:flex-row">

                    <select
                      value={selectedSubjectId}
                      onChange={(event) =>
                        setSelectedSubjectId(
                          event.target.value
                        )
                      }
                      disabled={
                        loadingAvailableSubjects
                      }
                      className="min-h-11 flex-1 rounded-xl border border-[#DCCFC5] bg-white px-4 text-sm text-[#3F3027] outline-none transition focus:border-[#AE5A3E] focus:ring-2 focus:ring-[#AE5A3E]/10 disabled:cursor-not-allowed disabled:bg-gray-100"
                    >

                      <option value="">
                        {loadingAvailableSubjects
                          ? 'Memuat mata pelajaran...'
                          : availableSubjects.length === 0
                            ? 'Semua mata pelajaran sudah ditambahkan'
                            : 'Pilih mata pelajaran'}
                      </option>


                      {availableSubjects.map(
                        (subject) => (

                          <option
                            key={subject.id}
                            value={subject.id}
                          >
                            {subject.name}
                          </option>

                        )
                      )}

                    </select>


                    <button
                      type="button"
                      onClick={
                        handleAddSubject
                      }
                      disabled={
                        !selectedSubjectId ||
                        loadingAvailableSubjects
                      }
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#AE5A3E] px-5 text-sm font-semibold text-white transition hover:bg-[#934A32] disabled:cursor-not-allowed disabled:opacity-50"
                    >

                      {loadingAvailableSubjects ? (

                        <Loader2
                          size={17}
                          className="animate-spin"
                        />

                      ) : (

                        <Check size={17} />

                      )}

                      Tambahkan

                    </button>


                    <button
                      type="button"
                      onClick={
                        handleCancelAddSubject
                      }
                      className="min-h-11 rounded-xl border border-[#DCCFC5] bg-white px-5 text-sm font-semibold text-[#6B5A4F] transition hover:bg-[#F5F0EB]"
                    >
                      Batal
                    </button>

                  </div>

                </div>

              )}


              {/* ==================================================
                  MAIN SUBJECT
                  ================================================== */}
              <div className="mb-5">

                <div className="mb-3 flex items-center justify-between">

                  <h3 className="text-sm font-bold text-[#3F3027]">
                    Mata Pelajaran Utama
                  </h3>

                  <span className="rounded-full bg-[#F3E8DF] px-3 py-1 text-xs font-semibold text-[#AE5A3E]">
                    Utama
                  </span>

                </div>


                {mainSubject ? (

                  <div className="flex items-center justify-between rounded-xl border border-[#E7DED6] bg-[#FAF8F5] p-4">

                    <div className="flex items-center gap-3">

                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-[#AE5A3E] shadow-sm">

                        <BookOpen size={18} />

                      </div>

                      <div>

                        <p className="font-semibold text-[#3F3027]">
                          {mainSubject.name}
                        </p>

                        <p className="mt-0.5 text-xs text-[#8A7A70]">
                          Mata pelajaran utama
                        </p>

                      </div>

                    </div>


                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600">

                      <Check size={16} />

                    </div>

                  </div>

                ) : (

                  <div className="rounded-xl border border-dashed border-[#DCCFC5] px-4 py-5 text-center text-sm text-[#8A7A70]">
                    Mata pelajaran utama belum tersedia.
                  </div>

                )}

              </div>


              {/* ==================================================
                  ADDITIONAL SUBJECTS
                  ================================================== */}
              <div>

                <div className="mb-3 flex items-center justify-between">

                  <div>

                    <h3 className="text-sm font-bold text-[#3F3027]">
                      Mata Pelajaran Tambahan
                    </h3>

                    <p className="mt-1 text-xs text-[#8A7A70]">
                      Digunakan ketika membuat kelas tambahan.
                    </p>

                  </div>


                  <span className="rounded-full bg-[#F1EEE9] px-3 py-1 text-xs font-semibold text-[#6B5A4F]">
                    {additionalSubjects.length}
                  </span>

                </div>


                {additionalSubjects.length > 0 ? (

                  <div className="space-y-3">

                    {additionalSubjects.map(
                      (subject) => (

                        <div
                          key={subject.id}
                          className="flex items-center justify-between rounded-xl border border-[#E7DED6] bg-white p-4 transition hover:bg-[#FCFAF8]"
                        >

                          <div className="flex min-w-0 items-center gap-3">

                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F8F1EB] text-[#AE5A3E]">

                              <BookOpen size={18} />

                            </div>

                            <div className="min-w-0">

                              <p className="truncate font-semibold text-[#3F3027]">
                                {subject.name}
                              </p>

                              <p className="mt-0.5 text-xs text-[#8A7A70]">
                                Mata pelajaran tambahan
                              </p>

                            </div>

                          </div>


                          <button
                            type="button"
                            onClick={() =>
                              handleOpenDeleteSubject(
                                subject
                              )
                            }
                            disabled={
                              deletingSubjectId !== null
                            }
                            className="ml-4 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-red-500 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Hapus mata pelajaran"
                          >

                            <Trash2 size={17} />

                          </button>

                        </div>

                      )
                    )}

                  </div>

                ) : (

                  <div className="rounded-xl border border-dashed border-[#DCCFC5] bg-[#FAF8F5] px-5 py-8 text-center">

                    <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#F3E8DF] text-[#AE5A3E]">

                      <BookOpen size={20} />

                    </div>

                    <p className="text-sm font-semibold text-[#5C4B40]">
                      Belum ada mata pelajaran tambahan
                    </p>

                    <p className="mt-1 text-xs text-[#8A7A70]">
                      Tambahkan mata pelajaran untuk menggunakannya pada Kelas Tambahan.
                    </p>

                  </div>

                )}

              </div>


              {/* ==================================================
                  INFORMATION
                  ================================================== */}
              <div className="mt-6 rounded-xl border border-[#E7DED6] bg-[#FAF8F5] px-4 py-3">

                <p className="text-xs leading-5 text-[#7B6B60]">

                  <span className="font-semibold text-[#5C4B40]">
                    Catatan:
                  </span>{' '}

                  Mata pelajaran utama ditentukan oleh sekolah.
                  Mata pelajaran tambahan dapat Anda kelola sendiri
                  melalui halaman profil ini.

                </p>

              </div>

            </section>

          </div>

        </div>

      </div>


      {/* ======================================================
          DELETE SUBJECT CONFIRMATION MODAL
          ====================================================== */}
      {subjectToDelete && (

        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-[2px]"
          onMouseDown={(event) => {

            if (
              event.target === event.currentTarget &&
              deletingSubjectId === null
            ) {

              handleCancelDeleteSubject();

            }

          }}
        >

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-subject-title"
            aria-describedby="delete-subject-description"
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
          >


            {/* ==================================================
                MODAL HEADER
                ================================================== */}
            <div className="flex items-start justify-between border-b border-[#E7DED6] px-5 py-4">

              <div className="flex items-center gap-3">

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-500">

                  <AlertTriangle size={22} />

                </div>

                <div>

                  <h2
                    id="delete-subject-title"
                    className="font-bold text-[#3F3027]"
                  >
                    Hapus Mata Pelajaran?
                  </h2>

                  <p className="mt-0.5 text-xs text-[#8A7A70]">
                    Konfirmasi penghapusan
                  </p>

                </div>

              </div>


              <button
                type="button"
                onClick={
                  handleCancelDeleteSubject
                }
                disabled={
                  deletingSubjectId !== null
                }
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8A7A70] transition hover:bg-[#F5F0EB] hover:text-[#5C4B40] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Tutup modal"
              >

                <X size={18} />

              </button>

            </div>


            {/* ==================================================
                MODAL CONTENT
                ================================================== */}
            <div className="px-5 py-5">

              <div
                id="delete-subject-description"
                className="space-y-4"
              >

                <p className="text-sm leading-6 text-[#5C4B40]">

                  Apakah Anda yakin ingin menghapus
                  mata pelajaran{' '}

                  <span className="font-bold text-[#3F3027]">
                    "{subjectToDelete.name}"
                  </span>{' '}

                  dari profil Anda?

                </p>


                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">

                  <div className="flex items-start gap-3">

                    <AlertTriangle
                      size={18}
                      className="mt-0.5 shrink-0 text-red-500"
                    />

                    <div>

                      <p className="text-sm font-semibold text-red-700">
                        Perhatian
                      </p>

                      <p className="mt-1 text-xs leading-5 text-red-600">

                        Jika mata pelajaran ini dihapus,
                        seluruh jadwal pelajaran yang menggunakan
                        mata pelajaran tersebut di{' '}

                        <span className="font-semibold">
                          Kelas Saya
                        </span>{' '}

                        juga akan ikut dihapus.

                      </p>

                    </div>

                  </div>

                </div>


                <div className="rounded-xl border border-[#E7DED6] bg-[#FAF8F5] px-4 py-3">

                  <p className="text-xs leading-5 text-[#7B6B60]">

                    <span className="font-semibold text-[#5C4B40]">
                      Yang akan dihapus:
                    </span>

                  </p>


                  <ul className="mt-2 space-y-1.5 text-xs text-[#7B6B60]">

                    <li className="flex items-start gap-2">

                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#AE5A3E]" />

                      Mata pelajaran tambahan{' '}

                      <span className="font-semibold text-[#5C4B40]">
                        "{subjectToDelete.name}"
                      </span>

                    </li>


                    <li className="flex items-start gap-2">

                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#AE5A3E]" />

                      Seluruh jadwal terkait mata pelajaran tersebut

                    </li>


                    <li className="flex items-start gap-2">

                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#AE5A3E]" />

                      Data pembelajaran yang bergantung pada jadwal tersebut

                    </li>

                  </ul>

                </div>


                <p className="text-xs leading-5 text-[#8A7A70]">

                  Tindakan ini tidak dapat dibatalkan setelah
                  penghapusan berhasil dilakukan.

                </p>

              </div>

            </div>


            {/* ==================================================
                MODAL FOOTER
                ================================================== */}
            <div className="flex flex-col-reverse gap-3 border-t border-[#E7DED6] bg-[#FAF8F5] px-5 py-4 sm:flex-row sm:justify-end">

              <button
                type="button"
                onClick={
                  handleCancelDeleteSubject
                }
                disabled={
                  deletingSubjectId !== null
                }
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#DCCFC5] bg-white px-5 text-sm font-semibold text-[#6B5A4F] transition hover:bg-[#F5F0EB] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Batal
              </button>


              <button
                type="button"
                onClick={
                  handleDeleteSubject
                }
                disabled={
                  deletingSubjectId !== null
                }
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-500 px-5 text-sm font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
              >

                {deletingSubjectId !== null ? (

                  <>

                    <Loader2
                      size={17}
                      className="animate-spin"
                    />

                    Menghapus...

                  </>

                ) : (

                  <>

                    <Trash2 size={17} />

                    Hapus Mata Pelajaran

                  </>

                )}

              </button>

            </div>

          </div>

        </div>

      )}

    </GuruLayout>

  );

};

export default EditProfile;