import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import api from '../../api/axios';
import { KelasSayaLayout } from '../../layouts/Guru/KelasSayaLayout';


/*
|--------------------------------------------------------------------------
| TYPES
|--------------------------------------------------------------------------
*/

type AttendanceStatus =
  | 'hadir'
  | 'izin'
  | 'sakit'
  | 'dispen'
  | 'alpa';

type StudentTab =
  | 'Semua kelas'
  | 'Perlu perhatian';

interface GuruData {
  nama: string;
  mata_pelajaran: string;
}

interface StudentSummary {
  hadir: number;
  izin: number;
  sakit: number;
  dispen: number;
  alpa: number;
  persentase: number;
}

interface StudentItem {
  id: number;
  nama: string;
  email: string;
  jenis_kelamin?: 'laki-laki' | 'perempuan' | string | null;
  summary: StudentSummary;
}

interface AttendanceItem {
  id: number;
  tanggal: string;
  status: AttendanceStatus;
  keterangan?: string | null;
  schedule_id?: number;
  mata_pelajaran?: string | null;
}

interface StudentDetail {
  id: number;
  nama: string;
  email: string;
  jenis_kelamin?: 'laki-laki' | 'perempuan' | string | null;
  summary: StudentSummary;
  history: AttendanceItem[];
}

interface ClassItem {
  id: number;
  nama: string;
  mata_pelajaran: string[];
  jumlah_siswa: number;
  rata_rata_kehadiran: number;
  perlu_perhatian: number;
  siswa: StudentItem[];
}

interface StudentPageSummary {
  jumlah_kelas: number;
  jumlah_siswa: number;
  rata_rata_kehadiran: number;
  rata_kehadiran?: number;
  perlu_perhatian: number;
}

interface StudentPageResponse {
  summary?: StudentPageSummary;
  kelas?: ClassItem[];
}

interface ApiResponse<T> {
  success?: boolean;
  message?: string;
  data: T;
}

interface AttendanceEditData {
  studentId: number;
  attendanceId: number;
  tanggal: string;
  status: AttendanceStatus;
  keterangan: string;
}


/*
|--------------------------------------------------------------------------
| CONSTANTS
|--------------------------------------------------------------------------
*/

const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  hadir: 'Hadir',
  izin: 'Izin',
  sakit: 'Sakit',
  dispen: 'Dispen',
  alpa: 'Alpa',
};

const ATTENDANCE_CLASS: Record<AttendanceStatus, string> = {
  hadir:
    'bg-[#EAF4EC] text-[#3D7650] border-[#D3E8D8]',
  izin:
    'bg-[#EEF2F8] text-[#4E6386] border-[#D9E0EC]',
  sakit:
    'bg-[#FFF4E5] text-[#9A6826] border-[#F0DEC1]',
  dispen:
    'bg-[#F1ECF7] text-[#73548D] border-[#DED2EB]',
  alpa:
    'bg-[#F8EAE6] text-[#AE5A3E] border-[#ECD2CA]',
};

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

const getStoredGuru = (): GuruData => {
  const userData = localStorage.getItem('user');

  if (!userData) {
    return {
      nama: 'Guru',
      mata_pelajaran: 'Guru',
    };
  }

  try {
    const user = JSON.parse(userData);

    return {
      nama:
        user?.name ??
        user?.nama ??
        'Guru',

      mata_pelajaran:
        user?.mata_pelajaran ??
        user?.mapel ??
        'Guru',
    };
  } catch {
    return {
      nama: 'Guru',
      mata_pelajaran: 'Guru',
    };
  }
};


const getInitials = (name: string): string => {
  if (!name) {
    return 'G';
  }

  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 1) {
    return words[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return (
    words[0][0] +
    words[words.length - 1][0]
  ).toUpperCase();
};


const formatDate = (dateString: string): string => {
  if (!dateString) {
    return '-';
  }

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return new Intl.DateTimeFormat(
    'id-ID',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }
  ).format(date);
};


const normalizePercentage = (
  value: unknown
): number => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(100, number)
  );
};


const normalizeSummary = (
  summary?: Partial<StudentSummary> | null
): StudentSummary => {
  return {
    hadir: Number(summary?.hadir ?? 0),
    izin: Number(summary?.izin ?? 0),
    sakit: Number(summary?.sakit ?? 0),
    dispen: Number(summary?.dispen ?? 0),
    alpa: Number(summary?.alpa ?? 0),
    persentase: normalizePercentage(
      summary?.persentase ?? 0
    ),
  };
};


const normalizeStudent = (
  student: any
): StudentItem => {
  return {
    id: Number(student?.id),
    nama:
      student?.nama ??
      student?.name ??
      'Siswa',

    email:
      student?.email ??
      '-',

    jenis_kelamin:
      student?.jenis_kelamin ??
      null,

    summary:
      normalizeSummary(
        student?.summary ??
        student?.rekap ??
        student?.attendance_summary
      ),
  };
};


const normalizeClass = (
  kelas: any
): ClassItem => {
  const students = Array.isArray(
    kelas?.siswa
  )
    ? kelas.siswa.map(normalizeStudent)
    : [];

  const subjects = Array.isArray(
    kelas?.mata_pelajaran
  )
    ? kelas.mata_pelajaran
    : kelas?.mata_pelajaran
      ? [kelas.mata_pelajaran]
      : [];

  return {
    id: Number(kelas?.id),

    nama:
      kelas?.nama ??
      kelas?.nama_kelas ??
      'Kelas',

    mata_pelajaran:
      subjects.map(
        (subject: any) =>
          typeof subject === 'string'
            ? subject
            : subject?.nama ??
              subject?.name ??
              ''
      ).filter(Boolean),

    jumlah_siswa:
      Number(
        kelas?.jumlah_siswa ??
        students.length
      ),

    rata_rata_kehadiran:
      normalizePercentage(
        kelas?.rata_rata_kehadiran ??
        kelas?.rata_kehadiran ??
        kelas?.persentase_kehadiran ??
        0
      ),

    perlu_perhatian:
      Number(
        kelas?.perlu_perhatian ??
        0
      ),

    siswa: students,
  };
};


/*
|--------------------------------------------------------------------------
| COMPONENT
|--------------------------------------------------------------------------
*/

export default function DaftarSiswa() {
  /*
   * ---------------------------------------------------------------
   * GURU
   * ---------------------------------------------------------------
   */

  const guru = useMemo(
    () => getStoredGuru(),
    []
  );


  /*
   * ---------------------------------------------------------------
   * PAGE STATE
   * ---------------------------------------------------------------
   */

  const [
    classes,
    setClasses,
  ] = useState<ClassItem[]>([]);

  const [
    summary,
    setSummary,
  ] = useState<StudentPageSummary>({
    jumlah_kelas: 0,
    jumlah_siswa: 0,
    rata_rata_kehadiran: 0,
    perlu_perhatian: 0,
  });

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState('');


  /*
   * ---------------------------------------------------------------
   * FILTER STATE
   * ---------------------------------------------------------------
   */

  const [
    activeTab,
    setActiveTab,
  ] = useState<StudentTab>(
    'Semua kelas'
  );

  const [
    search,
    setSearch,
  ] = useState('');


  /*
   * ---------------------------------------------------------------
   * MODAL STATE
   * ---------------------------------------------------------------
   */

  const [
    selectedClass,
    setSelectedClass,
  ] = useState<ClassItem | null>(
    null
  );

  const [
    selectedStudent,
    setSelectedStudent,
  ] = useState<StudentDetail | null>(
    null
  );

  const [
    loadingStudent,
    setLoadingStudent,
  ] = useState(false);

  const [
    studentError,
    setStudentError,
  ] = useState('');

  const [
    attendanceFilter,
    setAttendanceFilter,
  ] = useState<
    'semua' | AttendanceStatus
  >('semua');

  const [
    attendanceEdit,
    setAttendanceEdit,
  ] = useState<AttendanceEditData | null>(
    null
  );

  const [
    savingAttendance,
    setSavingAttendance,
  ] = useState(false);

  const [
    attendanceError,
    setAttendanceError,
  ] = useState('');


  /*
   * ---------------------------------------------------------------
   * LOAD DATA
   * ---------------------------------------------------------------
   */

  const loadStudents = async () => {
    try {
      setLoading(true);
      setError('');

      const response =
        await api.get<ApiResponse<StudentPageResponse>>(
          '/guru/siswa'
        );

      const data = response.data?.data ?? {
        summary: undefined,
        kelas: [],
      };

      const normalizedClasses =
        Array.isArray(data?.kelas)
          ? data.kelas.map(normalizeClass)
          : [];

      setClasses(
        normalizedClasses
      );

      setSummary({
        jumlah_kelas:
          Number(
            data?.summary?.jumlah_kelas ??
            normalizedClasses.length
          ),

        jumlah_siswa:
          Number(
            data?.summary?.jumlah_siswa ??
            new Set(
              normalizedClasses.flatMap(
                (kelas) =>
                  kelas.siswa.map(
                    (student) =>
                      student.id
                  )
              )
            ).size
          ),

        rata_rata_kehadiran:
          normalizePercentage(
            data?.summary?.rata_rata_kehadiran ??
            data?.summary?.rata_kehadiran ??
            0
          ),

        perlu_perhatian:
          Number(
            data?.summary?.perlu_perhatian ??
            normalizedClasses.reduce(
              (total, kelas) =>
                total +
                kelas.perlu_perhatian,
              0
            )
          ),
      });
    } catch (err: any) {
      console.error(
        'Gagal mengambil daftar siswa:',
        err
      );

      setError(
        err?.response?.data?.message ??
        'Data daftar siswa gagal dimuat.'
      );
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    loadStudents();
  }, []);


  /*
   * ---------------------------------------------------------------
   * FILTERED CLASSES
   * ---------------------------------------------------------------
   */

  const filteredClasses =
    useMemo(() => {
      const keyword =
        search
          .trim()
          .toLowerCase();

      return classes.filter(
        (kelas) => {
          if (
            activeTab ===
              'Perlu perhatian' &&
            kelas.perlu_perhatian <= 0
          ) {
            return false;
          }

          if (!keyword) {
            return true;
          }

          const classMatch =
            kelas.nama
              .toLowerCase()
              .includes(keyword);

          const subjectMatch =
            kelas.mata_pelajaran.some(
              (subject) =>
                subject
                  .toLowerCase()
                  .includes(keyword)
            );

          const studentMatch =
            kelas.siswa.some(
              (student) =>
                student.nama
                  .toLowerCase()
                  .includes(keyword)
            );

          return (
            classMatch ||
            subjectMatch ||
            studentMatch
          );
        }
      );
    }, [
      classes,
      activeTab,
      search,
    ]);


  /*
   * ---------------------------------------------------------------
   * OPEN STUDENT DETAIL
   * ---------------------------------------------------------------
   */

  const openStudentDetail = async (
    student: StudentItem
  ) => {
    try {
      setLoadingStudent(true);
      setStudentError('');

      const response =
        await api.get<
          ApiResponse<{
            student?: {
              id?: number;
              nama?: string;
              name?: string;
              email?: string;
              jenis_kelamin?: string | null;
            };
            summary?: Partial<StudentSummary>;
            rekap?: Partial<StudentSummary>;
            history?: any[];
            riwayat?: any[];
            riwayat_presensi?: any[];
          }>
        >(
          `/guru/siswa/${student.id}`
        );

      const data = response.data?.data ?? {};
      const studentData = data.student ?? {};

      const history =
        Array.isArray(
          data?.history
        )
          ? data.history
          : Array.isArray(
              data?.riwayat
            )
            ? data.riwayat
            : Array.isArray(
                data?.riwayat_presensi
              )
              ? data.riwayat_presensi
              : [];

      const normalizedHistory:
        AttendanceItem[] =
        history.map(
          (item: any) => ({
            id: Number(
              item?.id
            ),

            tanggal:
              item?.tanggal ??
              item?.date ??
              '',

            status:
              item?.status ??
              'alpa',

            keterangan:
              item?.keterangan ??
              item?.notes ??
              null,

            schedule_id:
              item?.schedule_id ??
              null,

            mata_pelajaran:
              item?.mata_pelajaran ??
              item?.subject ??
              null,
          })
        );

      setSelectedStudent({
        id: Number(
          studentData?.id ??
          student.id
        ),

        nama:
          studentData?.nama ??
          studentData?.name ??
          student.nama,

        email:
          studentData?.email ??
          student.email,

        jenis_kelamin:
          studentData?.jenis_kelamin ??
          student.jenis_kelamin ??
          null,

        summary:
          normalizeSummary(
            data?.summary ??
            data?.rekap ??
            student.summary
          ),

        history:
          normalizedHistory,
      });
    } catch (err: any) {
      console.error(
        'Gagal mengambil detail siswa:',
        err
      );

      setStudentError(
        err?.response?.data?.message ??
        'Detail siswa gagal dimuat.'
      );
    } finally {
      setLoadingStudent(false);
    }
  };


  /*
   * ---------------------------------------------------------------
   * OPEN CLASS STUDENT LIST
   * ---------------------------------------------------------------
   */

  const openClass = (
    kelas: ClassItem
  ) => {
    setSelectedClass(kelas);
  };


  /*
   * ---------------------------------------------------------------
   * OPEN EDIT ATTENDANCE
   * ---------------------------------------------------------------
   */

  const openAttendanceEdit = (
    attendance: AttendanceItem
  ) => {
    if (!selectedStudent) {
      return;
    }

    setAttendanceError('');

    setAttendanceEdit({
      studentId:
        selectedStudent.id,

      attendanceId:
        attendance.id,

      tanggal:
        attendance.tanggal,

      status:
        attendance.status,

      keterangan:
        attendance.keterangan ??
        '',
    });
  };


  /*
   * ---------------------------------------------------------------
   * SAVE ATTENDANCE
   * ---------------------------------------------------------------
   */

  const saveAttendance =
    async () => {
      if (
        !attendanceEdit ||
        !selectedStudent
      ) {
        return;
      }

      try {
        setSavingAttendance(true);
        setAttendanceError('');

        await api.put(
          `/guru/siswa/${attendanceEdit.studentId}/presensi/${attendanceEdit.attendanceId}`,
          {
            status:
              attendanceEdit.status,

            notes:
              attendanceEdit.keterangan
                .trim() || null,
          }
        );

        /*
         * Update data riwayat secara lokal
         * agar modal langsung berubah tanpa
         * perlu reload seluruh halaman.
         */
        setSelectedStudent(
          (current) => {
            if (!current) {
              return current;
            }

            const oldAttendance =
              current.history.find(
                (item) =>
                  item.id ===
                  attendanceEdit.attendanceId
              );

            if (!oldAttendance) {
              return current;
            }

            const oldStatus =
              oldAttendance.status;

            const newStatus =
              attendanceEdit.status;

            const newHistory =
              current.history.map(
                (item) =>
                  item.id ===
                  attendanceEdit.attendanceId
                    ? {
                        ...item,
                        status:
                          newStatus,
                        keterangan:
                          attendanceEdit.keterangan
                            .trim() ||
                          null,
                      }
                    : item
              );

            const nextSummary = {
              ...current.summary,
            };

            if (
              oldStatus in
                nextSummary
            ) {
              nextSummary[
                oldStatus
              ] = Math.max(
                0,
                nextSummary[
                  oldStatus
                ] - 1
              );
            }

            if (
              newStatus in
                nextSummary
            ) {
              nextSummary[
                newStatus
              ] += 1;
            }

            const total =
              nextSummary.hadir +
              nextSummary.izin +
              nextSummary.sakit +
              nextSummary.dispen +
              nextSummary.alpa;

            nextSummary.persentase =
              total > 0
                ? Number(
                    (
                      (nextSummary.hadir /
                        total) *
                      100
                    ).toFixed(1)
                  )
                : 0;

            return {
              ...current,
              history:
                newHistory,
              summary:
                nextSummary,
            };
          }
        );

        setAttendanceEdit(
          null
        );
      } catch (err: any) {
        console.error(
          'Gagal mengubah presensi:',
          err
        );

        setAttendanceError(
          err?.response?.data?.message ??
          'Presensi gagal diperbarui.'
        );
      } finally {
        setSavingAttendance(false);
      }
    };


  /*
   * ---------------------------------------------------------------
   * FILTERED ATTENDANCE HISTORY
   * ---------------------------------------------------------------
   */

  const filteredHistory =
    useMemo(() => {
      if (
        !selectedStudent
      ) {
        return [];
      }

      if (
        attendanceFilter ===
        'semua'
      ) {
        return selectedStudent.history;
      }

      return selectedStudent.history.filter(
        (item) =>
          item.status ===
          attendanceFilter
      );
    }, [
      selectedStudent,
      attendanceFilter,
    ]);


  /*
   * ---------------------------------------------------------------
   * RENDER
   * ---------------------------------------------------------------
   */

  return (
    <KelasSayaLayout
      namaGuru={guru.nama}
      mapelGuru={guru.mata_pelajaran}
      getInitials={getInitials}
    >
      <div className="min-h-full">

        {/* ======================================================
            HEADER
            ====================================================== */}

        <div className="mb-6">
          <div className="text-[11px] uppercase tracking-[0.16em] font-bold text-[#B98A3E] mb-2">
            Semester ganjil 2026/2027
          </div>

          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <h1 className="font-['Fraunces',serif] text-[32px] md:text-[38px] leading-[1.05] font-semibold text-[#1E2A47]">
                Daftar siswa
              </h1>

              <p className="mt-2 text-[13.5px] md:text-[14px] leading-6 text-[#6B7080] max-w-[700px]">
                Lihat identitas lengkap dan data presensi siswa dari setiap kelas yang Anda ajar.
              </p>
            </div>

            <div className="inline-flex items-center gap-2 self-start lg:self-auto rounded-full border border-[#E3DACB] bg-[#FFFDF8] px-3.5 py-2 text-[12px] font-semibold text-[#596075] shadow-sm">
              <svg
                className="w-4 h-4 text-[#B98A3E]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <rect
                  x="3"
                  y="4"
                  width="18"
                  height="18"
                  rx="2"
                />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>

              2026/2027 · Ganjil
            </div>
          </div>
        </div>


        {/* ======================================================
            ERROR
            ====================================================== */}

        {error && (
          <div className="mb-5 rounded-xl border border-[#ECD2CA] bg-[#F8EAE6] px-4 py-3 text-[13px] text-[#AE5A3E] flex items-start gap-3">
            <svg
              className="w-5 h-5 shrink-0 mt-0.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <circle
                cx="12"
                cy="12"
                r="9"
              />
              <path d="M12 8v4M12 16h.01" />
            </svg>

            <div className="flex-1">
              {error}
            </div>

            <button
              type="button"
              onClick={loadStudents}
              className="font-semibold underline underline-offset-2 hover:no-underline"
            >
              Coba lagi
            </button>
          </div>
        )}


        {/* ======================================================
            TOOLBAR
            ====================================================== */}

        <div className="bg-[#FFFDF8] border border-[#E3DACB] rounded-[14px] p-3.5 md:p-4 mb-5 shadow-[0_8px_24px_rgba(30,42,71,0.035)]">
          <div className="flex flex-col xl:flex-row gap-3 xl:items-center xl:justify-between">

            <div className="flex items-center gap-1 rounded-[10px] bg-[#F5F1E7] p-1 w-full xl:w-auto">
              <button
                type="button"
                onClick={() =>
                  setActiveTab(
                    'Semua kelas'
                  )
                }
                className={`flex-1 xl:flex-none px-4 py-2 rounded-[8px] text-[12.5px] font-semibold transition-all ${
                  activeTab ===
                  'Semua kelas'
                    ? 'bg-[#1E2A47] text-white shadow-sm'
                    : 'text-[#6B7080] hover:text-[#1E2A47]'
                }`}
              >
                Semua kelas
              </button>

              <button
                type="button"
                onClick={() =>
                  setActiveTab(
                    'Perlu perhatian'
                  )
                }
                className={`flex-1 xl:flex-none px-4 py-2 rounded-[8px] text-[12.5px] font-semibold transition-all ${
                  activeTab ===
                  'Perlu perhatian'
                    ? 'bg-[#1E2A47] text-white shadow-sm'
                    : 'text-[#6B7080] hover:text-[#1E2A47]'
                }`}
              >
                Perlu perhatian

                {summary.perlu_perhatian >
                  0 && (
                  <span
                    className={`ml-1.5 inline-flex min-w-[19px] h-[19px] px-1 items-center justify-center rounded-full text-[10px] ${
                      activeTab ===
                      'Perlu perhatian'
                        ? 'bg-white/15 text-white'
                        : 'bg-[#F8EAE6] text-[#AE5A3E]'
                    }`}
                  >
                    {summary.perlu_perhatian}
                  </span>
                )}
              </button>
            </div>


            <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto">

              <div className="relative flex-1 sm:w-[310px]">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-[17px] h-[17px] text-[#8C91A0]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <circle
                    cx="11"
                    cy="11"
                    r="7"
                  />
                  <path d="m20 20-4-4" />
                </svg>

                <input
                  type="text"
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                  placeholder="Cari nama siswa atau kelas..."
                  className="w-full h-[40px] pl-9 pr-3 rounded-[9px] border border-[#E3DACB] bg-[#FFFDF8] text-[12.5px] text-[#23283A] outline-none placeholder:text-[#A3A5AE] focus:border-[#B98A3E] focus:ring-2 focus:ring-[#B98A3E]/10"
                />
              </div>

              <div className="h-[40px] px-3.5 rounded-[9px] border border-[#E3DACB] bg-[#F8F5EE] flex items-center gap-2 text-[12px] font-semibold text-[#687083] shrink-0">
                <svg
                  className="w-4 h-4 text-[#B98A3E]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <rect
                    x="3"
                    y="4"
                    width="18"
                    height="18"
                    rx="2"
                  />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>

                Ganjil 2026/2027
              </div>

            </div>
          </div>
        </div>


        {/* ======================================================
            SUMMARY
            ====================================================== */}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">

          <SummaryCard
            label="Kelas yang diajar"
            value={
              loading
                ? '-'
                : summary.jumlah_kelas
            }
            icon={
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="w-5 h-5"
              >
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            }
          />

          <SummaryCard
            label="Total siswa"
            value={
              loading
                ? '-'
                : summary.jumlah_siswa
            }
            icon={
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="w-5 h-5"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle
                  cx="9"
                  cy="7"
                  r="4"
                />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            }
          />

          <SummaryCard
            label="Rata-rata kehadiran"
            value={
              loading
                ? '-'
                : `${summary.rata_rata_kehadiran}%`
            }
            icon={
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="w-5 h-5"
              >
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            }
          />

          <SummaryCard
            label="Perlu perhatian"
            value={
              loading
                ? '-'
                : summary.perlu_perhatian
            }
            icon={
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="w-5 h-5"
              >
                <path d="M10.3 3.3 2.8 16a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0Z" />
                <path d="M12 9v4M12 16h.01" />
              </svg>
            }
            danger
          />

        </div>


        {/* ======================================================
            CLASS LIST
            ====================================================== */}

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(
              (item) => (
                <div
                  key={item}
                  className="h-[245px] rounded-[14px] border border-[#E3DACB] bg-[#FFFDF8] animate-pulse"
                />
              )
            )}
          </div>
        ) : filteredClasses.length ===
          0 ? (
          <EmptyState
            attention={
              activeTab ===
              'Perlu perhatian'
            }
            search={search}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {filteredClasses.map(
              (kelas) => (
                <ClassCard
                  key={kelas.id}
                  kelas={kelas}
                  onOpen={() =>
                    openClass(
                      kelas
                    )
                  }
                />
              )
            )}

          </div>
        )}

      </div>


      {/* ========================================================
          CLASS STUDENT LIST MODAL
          ======================================================== */}

      {selectedClass && (
        <ClassStudentModal
          kelas={
            selectedClass
          }
          onClose={() =>
            setSelectedClass(
              null
            )
          }
          onOpenStudent={
            openStudentDetail
          }
        />
      )}


      {/* ========================================================
          STUDENT DETAIL MODAL
          ======================================================== */}

      {selectedStudent && (
        <StudentDetailModal
          student={
            selectedStudent
          }
          loading={
            loadingStudent
          }
          error={
            studentError
          }
          attendanceFilter={
            attendanceFilter
          }
          setAttendanceFilter={
            setAttendanceFilter
          }
          filteredHistory={
            filteredHistory
          }
          onClose={() => {
            setSelectedStudent(
              null
            );
            setAttendanceFilter(
              'semua'
            );
            setStudentError('');
          }}
          onBack={() => {
            setSelectedStudent(
              null
            );
            setAttendanceFilter(
              'semua'
            );
            setStudentError('');
          }}
          onEditAttendance={
            openAttendanceEdit
          }
        />
      )}


      {/* ========================================================
          EDIT ATTENDANCE MODAL
          ======================================================== */}

      {attendanceEdit && (
        <AttendanceEditModal
          data={
            attendanceEdit
          }
          saving={
            savingAttendance
          }
          error={
            attendanceError
          }
          onChange={
            setAttendanceEdit
          }
          onClose={() => {
            if (
              !savingAttendance
            ) {
              setAttendanceEdit(
                null
              );
              setAttendanceError(
                ''
              );
            }
          }}
          onSave={
            saveAttendance
          }
        />
      )}

    </KelasSayaLayout>
  );
}


/*
|--------------------------------------------------------------------------
| SUMMARY CARD
|--------------------------------------------------------------------------
*/

interface SummaryCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  danger?: boolean;
}

function SummaryCard({
  label,
  value,
  icon,
  danger = false,
}: SummaryCardProps) {
  return (
    <div className="bg-[#FFFDF8] border border-[#E3DACB] rounded-[14px] p-4 shadow-[0_8px_24px_rgba(30,42,71,0.035)]">
      <div className="flex items-start justify-between gap-3">

        <div>
          <div className="text-[11px] font-semibold text-[#8A8E9A] mb-1.5">
            {label}
          </div>

          <div
            className={`font-['Fraunces',serif] text-[25px] leading-none font-semibold ${
              danger
                ? 'text-[#AE5A3E]'
                : 'text-[#1E2A47]'
            }`}
          >
            {value}
          </div>
        </div>

        <div
          className={`w-9 h-9 rounded-[9px] flex items-center justify-center ${
            danger
              ? 'bg-[#F8EAE6] text-[#AE5A3E]'
              : 'bg-[#F5F1E7] text-[#B98A3E]'
          }`}
        >
          {icon}
        </div>

      </div>
    </div>
  );
}


/*
|--------------------------------------------------------------------------
| CLASS CARD
|--------------------------------------------------------------------------
*/

interface ClassCardProps {
  kelas: ClassItem;
  onOpen: () => void;
}

function ClassCard({
  kelas,
  onOpen,
}: ClassCardProps) {
  const students =
    kelas.siswa.slice(0, 5);

  return (
    <div className="bg-[#FFFDF8] border border-[#E3DACB] rounded-[14px] p-5 shadow-[0_8px_24px_rgba(30,42,71,0.035)] hover:shadow-[0_12px_30px_rgba(30,42,71,0.07)] transition-shadow">

      <div className="flex items-start justify-between gap-4">

        <div className="min-w-0">
          <h2 className="font-['Fraunces',serif] text-[22px] font-semibold text-[#1E2A47] leading-tight">
            {kelas.nama}
          </h2>

          <div className="flex flex-wrap gap-1.5 mt-2">
            {kelas.mata_pelajaran.map(
              (subject) => (
                <span
                  key={subject}
                  className="inline-flex items-center rounded-full bg-[#F5F1E7] border border-[#E3DACB] px-2.5 py-1 text-[10.5px] font-semibold text-[#75654A]"
                >
                  {subject}
                </span>
              )
            )}
          </div>
        </div>

        {kelas.perlu_perhatian >
          0 && (
          <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-[#F8EAE6] border border-[#ECD2CA] px-2.5 py-1 text-[10.5px] font-bold text-[#AE5A3E]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#AE5A3E]" />
            {kelas.perlu_perhatian}{' '}
            perlu perhatian
          </span>
        )}

      </div>


      <div className="mt-5 flex items-center justify-between gap-4">

        <div className="flex items-center">

          {students.map(
            (student, index) => (
              <div
                key={student.id}
                title={student.nama}
                className={`w-8 h-8 rounded-full bg-[#1E2A47] text-white border-2 border-[#FFFDF8] flex items-center justify-center text-[9.5px] font-bold ${
                  index > 0
                    ? '-ml-2'
                    : ''
                }`}
              >
                {getInitials(
                  student.nama
                )}
              </div>
            )
          )}

          {kelas.jumlah_siswa >
            students.length && (
            <div className="-ml-2 w-8 h-8 rounded-full bg-[#F5F1E7] text-[#6B7080] border-2 border-[#FFFDF8] flex items-center justify-center text-[9.5px] font-bold">
              +
              {kelas.jumlah_siswa -
                students.length}
            </div>
          )}

        </div>


        <div className="text-right">
          <div className="text-[10.5px] text-[#8A8E9A]">
            Jumlah siswa
          </div>

          <div className="text-[13px] font-bold text-[#23283A]">
            {kelas.jumlah_siswa}{' '}
            siswa
          </div>
        </div>

      </div>


      <div className="mt-4 pt-4 border-t border-[#E9E1D5] flex items-center justify-between gap-4">

        <div>
          <div className="text-[10.5px] text-[#8A8E9A] mb-1">
            Rata-rata kehadiran
          </div>

          <div className="flex items-center gap-2">
            <div className="w-[90px] h-1.5 bg-[#EEE9DE] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#5C8668] rounded-full"
                style={{
                  width: `${kelas.rata_rata_kehadiran}%`,
                }}
              />
            </div>

            <span className="text-[11.5px] font-bold text-[#3D7650]">
              {kelas.rata_rata_kehadiran}%
            </span>
          </div>
        </div>


        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[8px] bg-[#1E2A47] text-white text-[11.5px] font-semibold hover:bg-[#141C30] transition-colors"
        >
          Lihat daftar siswa

          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>

      </div>

    </div>
  );
}


/*
|--------------------------------------------------------------------------
| EMPTY STATE
|--------------------------------------------------------------------------
*/

interface EmptyStateProps {
  attention: boolean;
  search: string;
}

function EmptyState({
  attention,
  search,
}: EmptyStateProps) {
  return (
    <div className="bg-[#FFFDF8] border border-[#E3DACB] rounded-[14px] py-16 px-6 text-center">

      <div className="mx-auto w-12 h-12 rounded-full bg-[#F5F1E7] text-[#B98A3E] flex items-center justify-center mb-4">
        <svg
          className="w-6 h-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          {search ? (
            <>
              <circle
                cx="11"
                cy="11"
                r="7"
              />
              <path d="m20 20-4-4" />
            </>
          ) : (
            <>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle
                cx="9"
                cy="7"
                r="4"
              />
            </>
          )}
        </svg>
      </div>

      <h3 className="font-['Fraunces',serif] text-[20px] font-semibold text-[#1E2A47]">
        {search
          ? 'Siswa tidak ditemukan'
          : attention
            ? 'Tidak ada siswa yang perlu perhatian'
            : 'Belum ada kelas'}
      </h3>

      <p className="mt-2 text-[12.5px] text-[#777C89] max-w-[430px] mx-auto leading-5">
        {search
          ? 'Coba gunakan kata kunci lain untuk mencari nama siswa atau kelas.'
          : attention
            ? 'Semua kelas yang Anda ajar saat ini tidak memiliki siswa dengan kehadiran di bawah batas perhatian.'
            : 'Belum terdapat kelas yang dapat ditampilkan pada daftar siswa.'}
      </p>

    </div>
  );
}


/*
|--------------------------------------------------------------------------
| CLASS STUDENT MODAL
|--------------------------------------------------------------------------
*/

interface ClassStudentModalProps {
  kelas: ClassItem;
  onClose: () => void;
  onOpenStudent: (
    student: StudentItem
  ) => void;
}

function ClassStudentModal({
  kelas,
  onClose,
  onOpenStudent,
}: ClassStudentModalProps) {
  const [
    search,
    setSearch,
  ] = useState('');

  const [
    sort,
    setSort,
  ] = useState<
    'nama_asc' |
    'nama_desc' |
    'kehadiran_desc' |
    'kehadiran_asc'
  >('nama_asc');

  const students =
    useMemo(() => {
      const keyword =
        search
          .trim()
          .toLowerCase();

      let result =
        kelas.siswa.filter(
          (student) =>
            !keyword ||
            student.nama
              .toLowerCase()
              .includes(keyword) ||
            student.email
              .toLowerCase()
              .includes(keyword)
        );

      result = [
        ...result,
      ].sort(
        (a, b) => {
          if (
            sort ===
            'nama_desc'
          ) {
            return b.nama.localeCompare(
              a.nama
            );
          }

          if (
            sort ===
            'kehadiran_desc'
          ) {
            return (
              b.summary.persentase -
              a.summary.persentase
            );
          }

          if (
            sort ===
            'kehadiran_asc'
          ) {
            return (
              a.summary.persentase -
              b.summary.persentase
            );
          }

          return a.nama.localeCompare(
            b.nama
          );
        }
      );

      return result;
    }, [
      kelas.siswa,
      search,
      sort,
    ]);

  return (
    <ModalOverlay>
      <div className="w-full max-w-[1120px] max-h-[88vh] bg-[#FFFDF8] rounded-[16px] border border-[#E3DACB] shadow-[0_25px_80px_rgba(20,28,48,0.25)] overflow-hidden flex flex-col">

        {/* Header */}

        <div className="px-5 md:px-6 py-4 border-b border-[#E3DACB] flex items-center justify-between gap-4 shrink-0">

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-['Fraunces',serif] text-[23px] font-semibold text-[#1E2A47]">
                {kelas.nama}
              </h2>

              <span className="text-[10.5px] px-2.5 py-1 rounded-full bg-[#F5F1E7] text-[#75654A] font-semibold">
                {kelas.jumlah_siswa}{' '}
                siswa
              </span>
            </div>

            <p className="text-[11.5px] text-[#777C89] mt-1">
              Semester ganjil 2026/2027
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[#777C89] hover:bg-[#F5F1E7] hover:text-[#1E2A47] transition-colors"
            aria-label="Tutup"
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>

        </div>


        {/* Toolbar */}

        <div className="px-5 md:px-6 py-3.5 border-b border-[#E3DACB] flex flex-col md:flex-row gap-2.5 md:items-center md:justify-between shrink-0">

          <div className="relative flex-1 max-w-[460px]">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8C91A0]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <circle
                cx="11"
                cy="11"
                r="7"
              />
              <path d="m20 20-4-4" />
            </svg>

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Cari nama siswa atau email..."
              className="w-full h-[39px] pl-9 pr-3 rounded-[9px] border border-[#E3DACB] bg-[#FFFDF8] text-[12px] outline-none focus:border-[#B98A3E] focus:ring-2 focus:ring-[#B98A3E]/10 placeholder:text-[#A3A5AE]"
            />
          </div>


          <select
            value={sort}
            onChange={(event) =>
              setSort(
                event.target
                  .value as typeof sort
              )
            }
            className="h-[39px] px-3 rounded-[9px] border border-[#E3DACB] bg-[#FFFDF8] text-[12px] text-[#5F6574] outline-none focus:border-[#B98A3E]"
          >
            <option value="nama_asc">
              Nama A–Z
            </option>

            <option value="nama_desc">
              Nama Z–A
            </option>

            <option value="kehadiran_desc">
              Kehadiran tertinggi
            </option>

            <option value="kehadiran_asc">
              Kehadiran terendah
            </option>
          </select>

        </div>


        {/* Table */}

        <div className="overflow-auto flex-1">

          <table className="w-full min-w-[900px] border-collapse">

            <thead className="sticky top-0 z-10 bg-[#F8F5EE] border-b border-[#E3DACB]">
              <tr>
                <th className="w-[58px] px-4 py-3 text-left text-[10.5px] uppercase tracking-[0.08em] font-bold text-[#8A8E9A]">
                  No
                </th>

                <th className="px-4 py-3 text-left text-[10.5px] uppercase tracking-[0.08em] font-bold text-[#8A8E9A]">
                  Nama lengkap
                </th>

                <th className="px-4 py-3 text-left text-[10.5px] uppercase tracking-[0.08em] font-bold text-[#8A8E9A]">
                  Email
                </th>

                <th className="w-[70px] px-4 py-3 text-center text-[10.5px] uppercase tracking-[0.08em] font-bold text-[#8A8E9A]">
                  L/P
                </th>

                <th className="w-[62px] px-3 py-3 text-center text-[10.5px] uppercase tracking-[0.08em] font-bold text-[#8A8E9A]">
                  Hadir
                </th>

                <th className="w-[62px] px-3 py-3 text-center text-[10.5px] uppercase tracking-[0.08em] font-bold text-[#8A8E9A]">
                  Izin
                </th>

                <th className="w-[62px] px-3 py-3 text-center text-[10.5px] uppercase tracking-[0.08em] font-bold text-[#8A8E9A]">
                  Sakit
                </th>

                <th className="w-[65px] px-3 py-3 text-center text-[10.5px] uppercase tracking-[0.08em] font-bold text-[#8A8E9A]">
                  Dispen
                </th>

                <th className="w-[62px] px-3 py-3 text-center text-[10.5px] uppercase tracking-[0.08em] font-bold text-[#8A8E9A]">
                  Alpa
                </th>

                <th className="w-[105px] px-3 py-3 text-center text-[10.5px] uppercase tracking-[0.08em] font-bold text-[#8A8E9A]">
                  Kehadiran
                </th>
              </tr>
            </thead>

            <tbody>
              {students.length ===
              0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-6 py-14 text-center"
                  >
                    <div className="text-[13px] font-semibold text-[#5E6472]">
                      Siswa tidak ditemukan
                    </div>

                    <div className="text-[11.5px] text-[#8A8E9A] mt-1">
                      Coba gunakan kata kunci lain.
                    </div>
                  </td>
                </tr>
              ) : (
                students.map(
                  (
                    student,
                    index
                  ) => (
                    <tr
                      key={
                        student.id
                      }
                      onClick={() =>
                        onOpenStudent(
                          student
                        )
                      }
                      className="border-b border-[#EEE8DD] hover:bg-[#FBF8F1] cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 text-[11.5px] text-[#8A8E9A]">
                        {index + 1}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[#1E2A47] text-white flex items-center justify-center text-[9px] font-bold shrink-0">
                            {getInitials(
                              student.nama
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="text-[12px] font-bold text-[#23283A] truncate">
                              {student.nama}
                            </div>

                            <div className="text-[10px] text-[#8A8E9A]">
                              Lihat detail
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-[11.5px] text-[#666C7A]">
                        {student.email}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <GenderBadge
                          gender={
                            student.jenis_kelamin
                          }
                        />
                      </td>

                      <td className="px-3 py-3 text-center text-[11.5px] font-semibold text-[#3D7650]">
                        {
                          student
                            .summary
                            .hadir
                        }
                      </td>

                      <td className="px-3 py-3 text-center text-[11.5px] font-semibold text-[#4E6386]">
                        {
                          student
                            .summary
                            .izin
                        }
                      </td>

                      <td className="px-3 py-3 text-center text-[11.5px] font-semibold text-[#9A6826]">
                        {
                          student
                            .summary
                            .sakit
                        }
                      </td>

                      <td className="px-3 py-3 text-center text-[11.5px] font-semibold text-[#73548D]">
                        {
                          student
                            .summary
                            .dispen
                        }
                      </td>

                      <td className="px-3 py-3 text-center text-[11.5px] font-semibold text-[#AE5A3E]">
                        {
                          student
                            .summary
                            .alpa
                        }
                      </td>

                      <td className="px-3 py-3 text-center">
                        <span
                          className={`inline-flex items-center justify-center min-w-[58px] px-2 py-1 rounded-full text-[10.5px] font-bold ${
                            student.summary
                              .persentase >=
                            75
                              ? 'bg-[#EAF4EC] text-[#3D7650]'
                              : 'bg-[#F8EAE6] text-[#AE5A3E]'
                          }`}
                        >
                          {
                            student
                              .summary
                              .persentase
                          }%
                        </span>
                      </td>

                    </tr>
                  )
                )
              )}
            </tbody>

          </table>

        </div>


        {/* Footer */}

        <div className="px-5 md:px-6 py-3 border-t border-[#E3DACB] bg-[#FBF8F1] flex items-center justify-between gap-3 shrink-0">

          <div className="text-[11px] text-[#777C89]">
            Menampilkan{' '}
            <span className="font-bold text-[#4F5564]">
              {students.length}
            </span>{' '}
            dari{' '}
            <span className="font-bold text-[#4F5564]">
              {kelas.jumlah_siswa}
            </span>{' '}
            siswa
          </div>

          <div className="text-[10.5px] text-[#8A8E9A]">
            Klik siswa untuk melihat riwayat presensi
          </div>

        </div>

      </div>
    </ModalOverlay>
  );
}


/*
|--------------------------------------------------------------------------
| STUDENT DETAIL MODAL
|--------------------------------------------------------------------------
*/

interface StudentDetailModalProps {
  student: StudentDetail;
  loading: boolean;
  error: string;
  attendanceFilter:
    | 'semua'
    | AttendanceStatus;
  setAttendanceFilter: (
    value:
      | 'semua'
      | AttendanceStatus
  ) => void;
  filteredHistory: AttendanceItem[];
  onClose: () => void;
  onBack: () => void;
  onEditAttendance: (
    attendance: AttendanceItem
  ) => void;
}

function StudentDetailModal({
  student,
  loading,
  error,
  attendanceFilter,
  setAttendanceFilter,
  filteredHistory,
  onClose,
  onBack,
  onEditAttendance,
}: StudentDetailModalProps) {
  return (
    <ModalOverlay>
      <div className="w-full max-w-[1050px] max-h-[88vh] bg-[#FFFDF8] rounded-[16px] border border-[#E3DACB] shadow-[0_25px_80px_rgba(20,28,48,0.25)] overflow-hidden flex flex-col">

        {/* Header */}

        <div className="px-5 md:px-6 py-4 border-b border-[#E3DACB] flex items-center justify-between gap-4 shrink-0">

          <div className="flex items-center gap-3">

            <button
              type="button"
              onClick={onBack}
              className="w-9 h-9 rounded-full flex items-center justify-center text-[#6B7080] hover:bg-[#F5F1E7] hover:text-[#1E2A47] transition-colors"
              aria-label="Kembali"
            >
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>

            <div className="w-11 h-11 rounded-[11px] bg-[#1E2A47] text-white flex items-center justify-center font-bold text-[13px]">
              {getInitials(
                student.nama
              )}
            </div>

            <div>
              <h2 className="font-['Fraunces',serif] text-[22px] font-semibold text-[#1E2A47] leading-tight">
                {student.nama}
              </h2>

              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-[11px] text-[#777C89]">
                  {student.email}
                </span>

                <GenderBadge
                  gender={
                    student.jenis_kelamin
                  }
                />
              </div>
            </div>

          </div>


          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[#777C89] hover:bg-[#F5F1E7] hover:text-[#1E2A47] transition-colors"
            aria-label="Tutup"
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>

        </div>


        {/* Summary */}

        <div className="px-5 md:px-6 py-4 border-b border-[#E3DACB] bg-[#FBF8F1]">

          <div className="grid grid-cols-2 md:grid-cols-6 gap-2.5">

            <AttendanceSummaryChip
              label="Hadir"
              value={
                student.summary.hadir
              }
              status="hadir"
            />

            <AttendanceSummaryChip
              label="Izin"
              value={
                student.summary.izin
              }
              status="izin"
            />

            <AttendanceSummaryChip
              label="Sakit"
              value={
                student.summary.sakit
              }
              status="sakit"
            />

            <AttendanceSummaryChip
              label="Dispen"
              value={
                student.summary.dispen
              }
              status="dispen"
            />

            <AttendanceSummaryChip
              label="Alpa"
              value={
                student.summary.alpa
              }
              status="alpa"
            />

            <div className="rounded-[10px] border border-[#D3E8D8] bg-[#EAF4EC] px-3 py-2.5">
              <div className="text-[10px] font-semibold text-[#5D7D65]">
                Kehadiran
              </div>

              <div className="mt-0.5 text-[17px] font-bold text-[#3D7650]">
                {
                  student.summary
                    .persentase
                }%
              </div>
            </div>

          </div>

        </div>


        {/* Error */}

        {error && (
          <div className="mx-5 md:mx-6 mt-4 rounded-[10px] border border-[#ECD2CA] bg-[#F8EAE6] px-3.5 py-2.5 text-[11.5px] text-[#AE5A3E]">
            {error}
          </div>
        )}


        {/* History Toolbar */}

        <div className="px-5 md:px-6 py-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">

          <div>
            <h3 className="font-['Fraunces',serif] text-[18px] font-semibold text-[#1E2A47]">
              Riwayat presensi
            </h3>

            <p className="text-[10.5px] text-[#8A8E9A] mt-0.5">
              Data presensi siswa pada kelas yang Anda ajar.
            </p>
          </div>


          <select
            value={
              attendanceFilter
            }
            onChange={(event) =>
              setAttendanceFilter(
                event.target
                  .value as
                  | 'semua'
                  | AttendanceStatus
              )
            }
            className="h-[37px] px-3 rounded-[9px] border border-[#E3DACB] bg-[#FFFDF8] text-[11.5px] text-[#5F6574] outline-none focus:border-[#B98A3E]"
          >
            <option value="semua">
              Semua status
            </option>

            <option value="hadir">
              Hadir
            </option>

            <option value="izin">
              Izin
            </option>

            <option value="sakit">
              Sakit
            </option>

            <option value="dispen">
              Dispen
            </option>

            <option value="alpa">
              Alpa
            </option>
          </select>

        </div>


        {/* History */}

        <div className="overflow-auto flex-1">

          {loading ? (
            <div className="px-6 py-16 text-center">
              <div className="inline-flex items-center gap-2 text-[12px] text-[#777C89]">
                <span className="w-4 h-4 border-2 border-[#D9D1C2] border-t-[#B98A3E] rounded-full animate-spin" />
                Memuat detail siswa...
              </div>
            </div>
          ) : filteredHistory.length ===
            0 ? (
            <div className="px-6 py-16 text-center">
              <div className="font-['Fraunces',serif] text-[18px] font-semibold text-[#1E2A47]">
                Belum ada data presensi
              </div>

              <p className="mt-1 text-[11.5px] text-[#8A8E9A]">
                Tidak terdapat riwayat dengan filter yang dipilih.
              </p>
            </div>
          ) : (
            <table className="w-full min-w-[650px] border-collapse">

              <thead className="sticky top-0 z-10 bg-[#F8F5EE] border-y border-[#E3DACB]">
                <tr>
                  <th className="w-[58px] px-5 py-3 text-left text-[10px] uppercase tracking-[0.08em] font-bold text-[#8A8E9A]">
                    No
                  </th>

                  <th className="w-[150px] px-4 py-3 text-left text-[10px] uppercase tracking-[0.08em] font-bold text-[#8A8E9A]">
                    Tanggal
                  </th>

                  <th className="w-[155px] px-4 py-3 text-left text-[10px] uppercase tracking-[0.08em] font-bold text-[#8A8E9A]">
                    Status presensi
                  </th>

                  <th className="px-4 py-3 text-left text-[10px] uppercase tracking-[0.08em] font-bold text-[#8A8E9A]">
                    Keterangan
                  </th>

                  <th className="w-[70px] px-4 py-3 text-center text-[10px] uppercase tracking-[0.08em] font-bold text-[#8A8E9A]">
                    Aksi
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredHistory.map(
                  (
                    attendance,
                    index
                  ) => (
                    <tr
                      key={
                        attendance.id
                      }
                      className="border-b border-[#EEE8DD] hover:bg-[#FBF8F1] transition-colors"
                    >
                      <td className="px-5 py-3 text-[11px] text-[#8A8E9A]">
                        {index + 1}
                      </td>

                      <td className="px-4 py-3 text-[11.5px] font-semibold text-[#3E4555]">
                        {formatDate(
                          attendance.tanggal
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <AttendanceBadge
                          status={
                            attendance.status
                          }
                        />
                      </td>

                      <td className="px-4 py-3 text-[11.5px] text-[#6B7080]">
                        {attendance.keterangan ||
                          '—'}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            onEditAttendance(
                              attendance
                            )
                          }
                          className="w-8 h-8 rounded-[8px] inline-flex items-center justify-center text-[#7B8190] hover:bg-[#F5F1E7] hover:text-[#1E2A47] transition-colors"
                          title="Edit presensi"
                        >
                          <svg
                            className="w-4 h-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                          >
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
                          </svg>
                        </button>
                      </td>

                    </tr>
                  )
                )}
              </tbody>

            </table>
          )}

        </div>


        {/* Footer */}

        <div className="px-5 md:px-6 py-3 border-t border-[#E3DACB] bg-[#FBF8F1] shrink-0">
          <div className="text-[11px] text-[#777C89]">
            Menampilkan{' '}
            <span className="font-bold text-[#4F5564]">
              {filteredHistory.length}
            </span>{' '}
            riwayat presensi
          </div>
        </div>

      </div>
    </ModalOverlay>
  );
}


/*
|--------------------------------------------------------------------------
| ATTENDANCE EDIT MODAL
|--------------------------------------------------------------------------
*/

interface AttendanceEditModalProps {
  data: AttendanceEditData;
  saving: boolean;
  error: string;
  onChange: (
    value: AttendanceEditData
  ) => void;
  onClose: () => void;
  onSave: () => void;
}

function AttendanceEditModal({
  data,
  saving,
  error,
  onChange,
  onClose,
  onSave,
}: AttendanceEditModalProps) {
  return (
    <ModalOverlay zIndex="z-[70]">

      <div className="w-full max-w-[500px] bg-[#FFFDF8] rounded-[16px] border border-[#E3DACB] shadow-[0_25px_80px_rgba(20,28,48,0.28)] overflow-hidden">

        <div className="px-5 py-4 border-b border-[#E3DACB] flex items-center justify-between">

          <div>
            <h2 className="font-['Fraunces',serif] text-[21px] font-semibold text-[#1E2A47]">
              Edit presensi
            </h2>

            <p className="text-[11px] text-[#8A8E9A] mt-1">
              {formatDate(
                data.tanggal
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#777C89] hover:bg-[#F5F1E7] disabled:opacity-50"
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>

        </div>


        <div className="p-5">

          {error && (
            <div className="mb-4 rounded-[9px] border border-[#ECD2CA] bg-[#F8EAE6] px-3.5 py-2.5 text-[11.5px] text-[#AE5A3E]">
              {error}
            </div>
          )}


          <div>
            <label className="block text-[11.5px] font-bold text-[#4C5362] mb-2">
              Status presensi
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">

              {(
                Object.keys(
                  ATTENDANCE_LABEL
                ) as AttendanceStatus[]
              ).map(
                (status) => (
                  <button
                    key={status}
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      onChange({
                        ...data,
                        status,
                      })
                    }
                    className={`px-2 py-2.5 rounded-[9px] border text-[10.5px] font-bold transition-all ${
                      data.status ===
                      status
                        ? ATTENDANCE_CLASS[
                            status
                          ] +
                          ' ring-2 ring-[#B98A3E]/20'
                        : 'bg-[#FFFDF8] border-[#E3DACB] text-[#747987] hover:bg-[#F8F5EE]'
                    }`}
                  >
                    {ATTENDANCE_LABEL[
                      status
                    ]}
                  </button>
                )
              )}

            </div>
          </div>


          <div className="mt-5">

            <label className="block text-[11.5px] font-bold text-[#4C5362] mb-2">
              Keterangan
              <span className="font-normal text-[#9A9EAA]">
                {' '}
                (opsional)
              </span>
            </label>

            <textarea
              value={
                data.keterangan
              }
              onChange={(event) =>
                onChange({
                  ...data,
                  keterangan:
                    event.target
                      .value,
                })
              }
              disabled={saving}
              maxLength={255}
              rows={4}
              placeholder="Tambahkan keterangan presensi..."
              className="w-full resize-none rounded-[9px] border border-[#E3DACB] bg-[#FFFDF8] px-3 py-2.5 text-[12px] text-[#23283A] outline-none placeholder:text-[#A3A5AE] focus:border-[#B98A3E] focus:ring-2 focus:ring-[#B98A3E]/10 disabled:opacity-60"
            />

            <div className="text-right text-[10px] text-[#9A9EAA] mt-1">
              {data.keterangan.length}/255
            </div>

          </div>

        </div>


        <div className="px-5 py-3.5 border-t border-[#E3DACB] bg-[#FBF8F1] flex items-center justify-end gap-2.5">

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2.5 rounded-[9px] border border-[#DED6C9] bg-[#FFFDF8] text-[11.5px] font-semibold text-[#626978] hover:bg-[#F5F1E7] disabled:opacity-50"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="px-4 py-2.5 rounded-[9px] bg-[#1E2A47] text-white text-[11.5px] font-semibold hover:bg-[#141C30] disabled:opacity-60 inline-flex items-center gap-2"
          >
            {saving && (
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}

            {saving
              ? 'Menyimpan...'
              : 'Simpan'}
          </button>

        </div>

      </div>

    </ModalOverlay>
  );
}


/*
|--------------------------------------------------------------------------
| ATTENDANCE SUMMARY CHIP
|--------------------------------------------------------------------------
*/

interface AttendanceSummaryChipProps {
  label: string;
  value: number;
  status: AttendanceStatus;
}

function AttendanceSummaryChip({
  label,
  value,
  status,
}: AttendanceSummaryChipProps) {
  return (
    <div
      className={`rounded-[10px] border px-3 py-2.5 ${ATTENDANCE_CLASS[status]}`}
    >
      <div className="text-[10px] font-semibold opacity-75">
        {label}
      </div>

      <div className="mt-0.5 text-[17px] font-bold">
        {value}
      </div>
    </div>
  );
}


/*
|--------------------------------------------------------------------------
| ATTENDANCE BADGE
|--------------------------------------------------------------------------
*/

function AttendanceBadge({
  status,
}: {
  status: AttendanceStatus;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10.5px] font-bold ${
        ATTENDANCE_CLASS[
          status
        ] ??
        ATTENDANCE_CLASS.alpa
      }`}
    >
      {ATTENDANCE_LABEL[
        status
      ] ??
        status}
    </span>
  );
}


/*
|--------------------------------------------------------------------------
| GENDER BADGE
|--------------------------------------------------------------------------
*/

function GenderBadge({
  gender,
}: {
  gender?: string | null;
}) {
  if (!gender) {
    return (
      <span className="inline-flex items-center justify-center min-w-[28px] px-1.5 py-1 rounded-full bg-[#F5F1E7] border border-[#E3DACB] text-[10px] font-bold text-[#8A8E9A]">
        —
      </span>
    );
  }

  const isMale =
    gender.toLowerCase() ===
    'laki-laki';

  return (
    <span
      className={`inline-flex items-center justify-center min-w-[28px] px-1.5 py-1 rounded-full border text-[10px] font-bold ${
        isMale
          ? 'bg-[#EEF2F8] text-[#4E6386] border-[#D9E0EC]'
          : 'bg-[#F1ECF7] text-[#73548D] border-[#DED2EB]'
      }`}
    >
      {isMale
        ? 'L'
        : 'P'}
    </span>
  );
}


/*
|--------------------------------------------------------------------------
| MODAL OVERLAY
|--------------------------------------------------------------------------
*/

interface ModalOverlayProps {
  children: React.ReactNode;
  zIndex?: string;
}

function ModalOverlay({
  children,
  zIndex = 'z-[50]',
}: ModalOverlayProps) {
  return (
    <div
      className={`fixed inset-0 ${zIndex} bg-[#141C30]/55 backdrop-blur-[2px] p-3 md:p-6 flex items-center justify-center`}
    >
      {children}
    </div>
  );
}