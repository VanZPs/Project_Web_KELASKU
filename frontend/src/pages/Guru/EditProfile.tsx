import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ArrowLeft,
  BookOpen,
  Check,
  Loader2,
  Plus,
  Trash2,
  User,
} from 'lucide-react';

import {
  useNavigate,
} from 'react-router-dom';

import api from '../../api/axios';


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

  const [addingSubject, setAddingSubject] =
    useState(false);

  const [deletingSubjectId, setDeletingSubjectId] =
    useState<number | null>(null);

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

        /*
         * Ambil user dari localStorage.
         */
        const storedUser =
          localStorage.getItem('user');

        if (storedUser) {

          try {

            setUser(
              JSON.parse(storedUser)
            );

          } catch {

            setUser(null);

          }
        }


        /*
         * Ambil data profile dari API.
         *
         * Jika endpoint /me mengembalikan
         * informasi teacher, kita gunakan.
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

            /*
             * Beberapa struktur API mungkin
             * mengembalikan teacher sebagai object.
             */
            if (meData.teacher) {

              setTeacher(
                meData.teacher
              );

            }

          }

        } catch {
          /*
           * Tidak menghentikan halaman apabila
           * /me gagal. Data localStorage tetap digunakan.
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
         * Normalisasi is_primary.
         *
         * Backend saat ini mengirim boolean,
         * tetapi kita juga mendukung 0/1
         * atau string "0"/"1".
         */
        const normalizedSubjects =
          subjectData.map(
            (subject: any) => ({
              ...subject,
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

        /*
         * Endpoint /subjects berisi seluruh
         * mata pelajaran sekolah.
         */
        const response =
          await api.get(
            '/subjects'
          );

        const allSubjects =
          response.data?.data ?? [];


        /*
         * ID mata pelajaran yang sudah
         * dimiliki oleh guru.
         */
        const ownedSubjectIds =
          new Set(
            subjects.map(
              (subject) =>
                subject.id
            )
          );


        /*
         * Hanya tampilkan mata pelajaran
         * yang belum dimiliki guru.
         */
        const available =
          allSubjects.filter(
            (subject: any) =>
              !ownedSubjectIds.has(
                Number(subject.id)
              )
          );


        setAvailableSubjects(
          available
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


        /*
         * Data subject baru dari backend.
         */
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
   * DELETE SUBJECT
   * ==========================================================
   */

  const handleDeleteSubject =
    async (
      subject: Subject
    ) => {

      /*
       * Pengamanan tambahan.
       *
       * Mata pelajaran utama tidak boleh
       * dihapus.
       */
      if (subject.is_primary) {

        return;

      }


      const confirmed =
        window.confirm(
          `Hapus mata pelajaran "${subject.name}" dari profil Anda?`
        );

      if (!confirmed) {

        return;

      }


      try {

        setDeletingSubjectId(
          subject.id
        );

        setError('');

        setSuccess('');


        await api.delete(
          `/guru/mata-pelajaran/${subject.id}`
        );


        setSubjects(
          (current) =>
            current.filter(
              (item) =>
                item.id !== subject.id
            )
        );


        setSuccess(
          'Mata pelajaran tambahan berhasil dihapus.'
        );

      } catch (err: any) {

        console.error(
          'Gagal menghapus mata pelajaran:',
          err
        );

        setError(
          err?.response?.data?.message ||
          'Gagal menghapus mata pelajaran.'
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
      <div className="min-h-screen bg-[#F8F5F0]">

        <div className="flex min-h-screen items-center justify-center">

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

      </div>
    );

  }


  /*
   * ==========================================================
   * RENDER
   * ==========================================================
   */

  return (

    <div className="min-h-screen bg-[#F8F5F0]">

      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">


        {/* ==================================================
            HEADER
            ================================================== */}

        <div className="mb-6">

          <button
            type="button"
            onClick={() => navigate('/guru')}
            className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-[#6B4F3A] transition hover:text-[#AE5A3E]"
          >

            <ArrowLeft size={18} />

            Kembali ke Dashboard

          </button>


          <div>

            <h1 className="text-3xl font-bold text-[#3F3027]">
              Edit Profile
            </h1>

            <p className="mt-1 text-sm text-[#7B6B60]">
              Kelola informasi profil dan mata pelajaran Anda.
            </p>

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


              {/* Nama */}

              <div>

                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#8A7A70]">
                  Nama
                </label>

                <div className="rounded-xl border border-[#E7DED6] bg-[#FAF8F5] px-4 py-3 text-sm text-[#3F3027]">

                  {user?.name || '-'}

                </div>

              </div>


              {/* Email */}

              <div>

                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#8A7A70]">
                  Email
                </label>

                <div className="break-all rounded-xl border border-[#E7DED6] bg-[#FAF8F5] px-4 py-3 text-sm text-[#3F3027]">

                  {user?.email || '-'}

                </div>

              </div>


              {/* NIPY */}

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
                    onClick={handleAddSubject}
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
                    onClick={handleCancelAddSubject}
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
                            handleDeleteSubject(
                              subject
                            )
                          }
                          disabled={
                            deletingSubjectId ===
                            subject.id
                          }
                          className="ml-4 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-red-500 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                          title="Hapus mata pelajaran"
                        >

                          {deletingSubjectId ===
                          subject.id ? (

                            <Loader2
                              size={17}
                              className="animate-spin"
                            />

                          ) : (

                            <Trash2
                              size={17}
                            />

                          )}

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

  );
};


export default EditProfile;