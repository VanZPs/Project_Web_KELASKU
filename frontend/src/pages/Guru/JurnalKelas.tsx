import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  History,
  Play,
  Search,
  TriangleAlert,
  UserCheck,
  X,
} from 'lucide-react';

import api from '../../api/axios';
import { JurnalMengajarLayout } from '../../layouts/Guru/JurnalMengajarLayout';

interface StoredUser {
  name?: string;
}

interface JurnalTerakhir {
  id: number;
  tanggal: string;
  topic: string;
  description: string | null;
}

interface Presensi {
  hadir: number;
  izin: number;
  sakit: number;
  dispen: number;
  alpa: number;
}

interface JurnalItem {
  id: number;
  kelas: string;
  mata_pelajaran: string;
  hari: string;
  waktu: string;
  jurnal_terakhir: JurnalTerakhir | null;
  jumlah_jurnal: number;
  presensi: Presensi;
  status: 'lengkap' | 'menunggu';
}

type FilterTab =
  | 'semua'
  | 'menunggu'
  | 'lengkap';

type AttendanceStatus =
  | 'hadir'
  | 'izin'
  | 'sakit'
  | 'dispen'
  | 'alpa';

interface StudentItem {
  id: number;
  nama: string;
  email: string;
  status: AttendanceStatus;
}

interface ScheduleDetail {
  schedule: {
    id: number;
    kelas: string;
    mata_pelajaran: string;
    hari: string;
    waktu: string;
  };
  students: StudentItem[];
  journals: {
    id: number;
    tanggal: string;
    topic: string;
    description: string | null;
  }[];
}

interface HistoryItem {
  id: number;
  tanggal: string;
  topic: string;
  description: string | null;
  kelas: string;
  mata_pelajaran: string;
}

const getStoredUser = (): StoredUser | null => {
  const userData = localStorage.getItem('user');

  if (!userData) {
    return null;
  }

  try {
    return JSON.parse(userData);
  } catch {
    return null;
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

const formatDate = (
  dateString: string
): {
  day: string;
  month: string;
  year: string;
} => {
  const date = new Date(
    `${dateString}T00:00:00`
  );

  if (Number.isNaN(date.getTime())) {
    return {
      day: '-',
      month: '-',
      year: '-',
    };
  }

  return {
    day: date
      .getDate()
      .toString()
      .padStart(2, '0'),

    month: date
      .toLocaleDateString('id-ID', {
        month: 'short',
      })
      .replace('.', ''),

    year: date
      .getFullYear()
      .toString(),
  };
};

const formatLongDate = (
  dateString: string
): string => {
  const date = new Date(
    `${dateString}T00:00:00`
  );

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return date.toLocaleDateString(
    'id-ID',
    {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }
  );
};

const getToday = (): string => {
  const now = new Date();

  const year =
    now.getFullYear();

  const month = String(
    now.getMonth() + 1
  ).padStart(2, '0');

  const day = String(
    now.getDate()
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const getSubjectTagClass = (
  subject: string
): string => {
  const lowerSubject =
    subject.toLowerCase();

  if (
    lowerSubject.includes('wajib') &&
    !lowerSubject.includes('peminatan')
  ) {
    return 'bg-[#E7D3A8] text-[#7A5A20]';
  }

  if (
    lowerSubject.includes('ppkn') ||
    lowerSubject.includes('agama') ||
    lowerSubject.includes('bahasa') ||
    lowerSubject.includes('sejarah')
  ) {
    return 'bg-[#E7D3A8] text-[#7A5A20]';
  }

  return 'bg-[#E5ECF5] text-[#3E6BAE]';
};

const getSubjectIconClass = (
  subject: string
): string => {
  const lowerSubject =
    subject.toLowerCase();

  if (
    lowerSubject.includes('wajib') &&
    !lowerSubject.includes('peminatan')
  ) {
    return 'bg-[#E7D3A8] text-[#7A5A20]';
  }

  return 'bg-[#E5ECF5] text-[#3E6BAE]';
};

export default function JurnalKelas() {
  const storedUser =
    getStoredUser();

  const namaGuru =
    storedUser?.name ||
    'Guru';

  const [
    jurnalList,
    setJurnalList,
  ] = useState<JurnalItem[]>([]);

  const [
    activeTab,
    setActiveTab,
  ] = useState<FilterTab>('semua');

  const [
    searchQuery,
    setSearchQuery,
  ] = useState('');

  const [
    period,
    setPeriod,
  ] = useState<
    'minggu_ini' | 'semua'
  >('minggu_ini');

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState('');

  const [
    selectedSchedule,
    setSelectedSchedule,
  ] = useState<JurnalItem | null>(
    null
  );

  const [
    scheduleDetail,
    setScheduleDetail,
  ] = useState<ScheduleDetail | null>(
    null
  );

  const [
    showStartModal,
    setShowStartModal,
  ] = useState(false);

  const [
    loadingDetail,
    setLoadingDetail,
  ] = useState(false);

  const [
    topic,
    setTopic,
  ] = useState('');

  const [
    description,
    setDescription,
  ] = useState('');

  const [
    journalDate,
    setJournalDate,
  ] = useState(getToday());

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    modalError,
    setModalError,
  ] = useState('');

  const [
    showHistoryModal,
    setShowHistoryModal,
  ] = useState(false);

  const [
    historyItems,
    setHistoryItems,
  ] = useState<HistoryItem[]>([]);

  const [
    historyClass,
    setHistoryClass,
  ] = useState<JurnalItem | null>(
    null
  );

  const [
    loadingHistory,
    setLoadingHistory,
  ] = useState(false);

  const [
    historyError,
    setHistoryError,
  ] = useState('');

  const mapelGuru = useMemo(() => {
    const semuaMapel =
      jurnalList
        .map(
          (item) =>
            item.mata_pelajaran
        )
        .filter(Boolean)
        .filter(
          (
            mapel,
            index,
            array
          ) =>
            array.indexOf(mapel) ===
            index
        );

    return semuaMapel.length > 0
      ? semuaMapel.join(', ')
      : 'Guru Mata Pelajaran';
  }, [jurnalList]);

  const fetchJurnal = async () => {
    try {
      setLoading(true);
      setError('');

      const response =
        await api.get(
          '/guru/jurnal'
        );

      if (
        response.data?.success ===
        false
      ) {
        throw new Error(
          response.data?.message ||
            'Gagal mengambil data jurnal.'
        );
      }

      setJurnalList(
        response.data?.data ?? []
      );
    } catch (err) {
      console.error(
        'Gagal mengambil data jurnal:',
        err
      );

      setError(
        'Data jurnal mengajar gagal dimuat. Silakan coba lagi.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJurnal();
  }, []);

  const filteredJurnal =
    useMemo(() => {
      let result = [
        ...jurnalList,
      ];

      if (
        activeTab === 'menunggu'
      ) {
        result =
          result.filter(
            (item) =>
              item.status ===
              'menunggu'
          );
      }

      if (
        activeTab === 'lengkap'
      ) {
        result =
          result.filter(
            (item) =>
              item.status ===
              'lengkap'
          );
      }

      const keyword =
        searchQuery
          .trim()
          .toLowerCase();

      if (keyword) {
        result =
          result.filter(
            (item) =>
              item.kelas
                .toLowerCase()
                .includes(keyword) ||
              item.mata_pelajaran
                .toLowerCase()
                .includes(keyword)
          );
      }

      void period;

      return result;
    }, [
      jurnalList,
      activeTab,
      searchQuery,
      period,
    ]);

  const jumlahKelas =
    jurnalList.length;

  const jumlahPertemuan =
    jurnalList.reduce(
      (
        total,
        item
      ) =>
        total +
        item.jumlah_jurnal,
      0
    );

  const jumlahLengkap =
    jurnalList.filter(
      (item) =>
        item.status ===
        'lengkap'
    ).length;

  const jumlahMenunggu =
    jurnalList.filter(
      (item) =>
        item.status ===
        'menunggu'
    ).length;

  const handleStartClass = async (
    item: JurnalItem
  ) => {
    setSelectedSchedule(item);
    setShowStartModal(true);

    setLoadingDetail(true);
    setModalError('');

    setTopic('');
    setDescription('');
    setJournalDate(getToday());

    try {
      const response =
        await api.get(
          `/guru/jurnal/${item.id}`
        );

      const detail =
        response.data?.data;

      if (!detail) {
        throw new Error(
          'Detail kelas tidak tersedia.'
        );
      }

      setScheduleDetail({
        ...detail,
        students:
          (
            detail.students ??
            []
          ).map(
            (
              student: StudentItem
            ) => ({
              ...student,
              status:
                student.status ??
                'hadir',
            })
          ),
      });
    } catch (err) {
      console.error(
        'Gagal mengambil detail kelas:',
        err
      );

      setModalError(
        'Detail kelas gagal dimuat.'
      );
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeStartModal = () => {
    if (saving) {
      return;
    }

    setShowStartModal(false);
    setSelectedSchedule(null);
    setScheduleDetail(null);

    setTopic('');
    setDescription('');
    setModalError('');
  };

  const changeAttendance = (
    studentId: number,
    status: AttendanceStatus
  ) => {
    setScheduleDetail(
      (current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,

          students:
            current.students.map(
              (student) =>
                student.id ===
                studentId
                  ? {
                      ...student,
                      status,
                    }
                  : student
            ),
        };
      }
    );
  };

  const handleSaveJournal =
    async () => {
      if (!selectedSchedule) {
        return;
      }

      if (!journalDate) {
        setModalError(
          'Tanggal pertemuan wajib diisi.'
        );
        return;
      }

      if (!topic.trim()) {
        setModalError(
          'Materi atau topik pembelajaran wajib diisi.'
        );
        return;
      }

      if (!scheduleDetail) {
        setModalError(
          'Data siswa belum tersedia.'
        );
        return;
      }

      if (
        scheduleDetail.students.length ===
        0
      ) {
        setModalError(
          'Kelas ini belum memiliki siswa.'
        );
        return;
      }

      try {
        setSaving(true);
        setModalError('');

        await api.post(
          `/guru/jurnal/${selectedSchedule.id}/mulai`,
          {
            date: journalDate,

            topic:
              topic.trim(),

            description:
              description.trim() ||
              null,

            attendances:
              scheduleDetail.students.map(
                (student) => ({
                  student_id:
                    student.id,

                  status:
                    student.status,

                  notes: null,
                })
              ),
          }
        );

        closeStartModal();

        await fetchJurnal();
      } catch (err: any) {
        console.error(
          'Gagal menyimpan jurnal:',
          err
        );

        const message =
          err?.response?.data
            ?.message;

        setModalError(
          message ||
            'Jurnal dan presensi gagal disimpan.'
        );
      } finally {
        setSaving(false);
      }
    };

  const handleOpenHistory =
    async (
      item: JurnalItem
    ) => {
      setHistoryClass(item);
      setShowHistoryModal(true);

      setLoadingHistory(true);
      setHistoryError('');

      try {
        const response =
          await api.get(
            `/guru/jurnal/riwayat/${item.id}`
          );

        setHistoryItems(
          response.data?.data ??
            []
        );
      } catch (err) {
        console.error(
          'Gagal mengambil riwayat jurnal:',
          err
        );

        setHistoryError(
          'Riwayat jurnal gagal dimuat.'
        );
      } finally {
        setLoadingHistory(false);
      }
    };

  const closeHistoryModal =
    () => {
      setShowHistoryModal(false);
      setHistoryClass(null);
      setHistoryItems([]);
      setHistoryError('');
    };

  return (
    <JurnalMengajarLayout
      namaGuru={namaGuru}
      mapelGuru={mapelGuru}
      getInitials={getInitials}
    >
      <div className="mx-auto w-full max-w-[1500px]">
        {/* =====================================================
            HEADER
        ====================================================== */}
        <div className="mb-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#C49A5A]" />
                <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#8A806F]">
                  Semester Ganjil 2026/2027
                </span>
              </div>

              <h1 className="font-['Fraunces',serif] text-[32px] font-semibold leading-[1.1] tracking-[-0.02em] text-[#141C30] sm:text-[36px]">
                Jurnal mengajar
              </h1>

              <p className="mt-2 max-w-[520px] text-[13px] leading-5 text-[#6B7080]">
                Catat kegiatan pembelajaran dan presensi siswa.
              </p>
            </div>
          </div>
        </div>

        <div className="my-[22px] flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex w-full overflow-x-auto rounded-[11px] border border-[#E3DACB] bg-[#FFFDF8] p-1 shadow-[0_1px_2px_rgba(30,25,15,0.04)] xl:w-auto">
            <button
              type="button"
              onClick={() =>
                setActiveTab('semua')
              }
              className={`flex shrink-0 items-center gap-1.5 rounded-lg border-none px-4 py-2 text-[13px] font-semibold transition-colors ${
                activeTab === 'semua'
                  ? 'bg-[#1E2A47] text-white'
                  : 'bg-transparent text-[#6B7080] hover:bg-[#F0EBDB] hover:text-[#23283A]'
              }`}
            >
              Semua kelas
            </button>

            <button
              type="button"
              onClick={() =>
                setActiveTab('menunggu')
              }
              className={`flex shrink-0 items-center gap-1.5 rounded-lg border-none px-4 py-2 text-[13px] font-semibold transition-colors ${
                activeTab === 'menunggu'
                  ? 'bg-[#1E2A47] text-white'
                  : 'bg-transparent text-[#6B7080] hover:bg-[#F0EBDB] hover:text-[#23283A]'
              }`}
            >
              Belum dimulai

              <span
                className={`rounded-full px-1.5 py-px text-[10.5px] font-bold ${
                  activeTab === 'menunggu'
                    ? 'bg-white/20 text-white'
                    : 'bg-[#F6E1D9] text-[#A8503B]'
                }`}
              >
                {jumlahMenunggu}
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                setActiveTab('lengkap')
              }
              className={`flex shrink-0 items-center gap-1.5 rounded-lg border-none px-4 py-2 text-[13px] font-semibold transition-colors ${
                activeTab === 'lengkap'
                  ? 'bg-[#1E2A47] text-white'
                  : 'bg-transparent text-[#6B7080] hover:bg-[#F0EBDB] hover:text-[#23283A]'
              }`}
            >
              Sudah lengkap

              <span
                className={`rounded-full px-1.5 py-px text-[10.5px] font-bold ${
                  activeTab === 'lengkap'
                    ? 'bg-white/20 text-white'
                    : 'bg-[#E7F0EA] text-[#4C7A5E]'
                }`}
              >
                {jumlahLengkap}
              </span>
            </button>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
            <div className="relative">
              <select
                value={period}
                onChange={(event) =>
                  setPeriod(
                    event.target.value as
                      | 'minggu_ini'
                      | 'semua'
                  )
                }
                className="h-[40px] w-full appearance-none rounded-[10px] border border-[#E3DACB] bg-[#FFFDF8] py-2 pl-3 pr-9 text-[13px] font-semibold text-[#23283A] outline-none transition focus:border-[#B98A3E] sm:w-[145px]"
              >
                <option value="minggu_ini">
                  Minggu ini
                </option>

                <option value="semua">
                  Semua waktu
                </option>
              </select>

              <ChevronDown
                size={14}
                strokeWidth={1.9}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7080]"
              />
            </div>

            <div className="flex h-[40px] w-full items-center gap-2 rounded-[10px] border border-[#E3DACB] bg-[#FFFDF8] px-3 sm:w-[240px]">
              <Search
                size={16}
                strokeWidth={1.9}
                className="shrink-0 text-[#6B7080] opacity-70"
              />

              <input
                type="text"
                value={searchQuery}
                onChange={(event) =>
                  setSearchQuery(
                    event.target.value
                  )
                }
                placeholder="Cari kelas..."
                className="w-full border-none bg-transparent text-[13.5px] text-[#23283A] outline-none placeholder:text-[#8A8E9A]"
              />
            </div>
          </div>
        </div>

        <div className="mb-[22px] flex flex-wrap gap-4 rounded-[14px] border border-[#E3DACB] bg-[#FFFDF8] px-5 py-4 shadow-[0_1px_2px_rgba(30,25,15,0.04),0_8px_24px_-12px_rgba(30,25,15,0.10)] md:gap-[22px]">
          <div className="flex items-center gap-[11px] border-[#E3DACB] pr-5 md:border-r">
            <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] bg-[#E7ECF4] text-[#1E2A47]">
              <BookOpen
                size={17}
                strokeWidth={1.9}
              />
            </div>

            <div>
              <div className="font-['Fraunces',serif] text-[19px] font-semibold leading-none text-[#141C30]">
                {jumlahKelas}
              </div>

              <div className="mt-[3px] text-[11.5px] text-[#6B7080]">
                Kelas diajar
              </div>
            </div>
          </div>

          <div className="flex items-center gap-[11px] border-[#E3DACB] pr-5 md:border-r">
            <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] bg-[#E7D3A8] text-[#7A5A20]">
              <FileText
                size={17}
                strokeWidth={1.9}
              />
            </div>

            <div>
              <div className="font-['Fraunces',serif] text-[19px] font-semibold leading-none text-[#141C30]">
                {jumlahPertemuan}
              </div>

              <div className="mt-[3px] text-[11.5px] text-[#6B7080]">
                Pertemuan tercatat
              </div>
            </div>
          </div>

          <div className="flex items-center gap-[11px] border-[#E3DACB] pr-5 md:border-r">
            <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] bg-[#E7F0EA] text-[#4C7A5E]">
              <Check
                size={17}
                strokeWidth={1.9}
              />
            </div>

            <div>
              <div className="font-['Fraunces',serif] text-[19px] font-semibold leading-none text-[#141C30]">
                {jumlahLengkap}
              </div>

              <div className="mt-[3px] text-[11.5px] text-[#6B7080]">
                Jurnal terisi
              </div>
            </div>
          </div>

          <div className="flex items-center gap-[11px]">
            <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] bg-[#F6E1D9] text-[#A8503B]">
              <Clock3
                size={17}
                strokeWidth={1.9}
              />
            </div>

            <div>
              <div
                className={`font-['Fraunces',serif] text-[19px] font-semibold leading-none ${
                  jumlahMenunggu > 0
                    ? 'text-[#A8503B]'
                    : 'text-[#141C30]'
                }`}
              >
                {jumlahMenunggu}
              </div>

              <div className="mt-[3px] text-[11.5px] text-[#6B7080]">
                Menunggu diisi
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-[#E4BCA9] bg-[#F6E1D9] px-4 py-3 text-[13px] text-[#A8503B]">
            <div className="flex items-center gap-2">
              <TriangleAlert
                size={17}
              />

              {error}
            </div>

            <button
              type="button"
              onClick={fetchJurnal}
              className="rounded-lg border border-[#E4BCA9] bg-white/60 px-3 py-1.5 text-[12px] font-bold hover:bg-white"
            >
              Coba lagi
            </button>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 gap-[18px] xl:grid-cols-2">
            {[1, 2, 3, 4].map(
              (item) => (
                <div
                  key={item}
                  className="overflow-hidden rounded-[14px] border border-[#E3DACB] bg-[#FFFDF8] p-5 shadow-[0_1px_2px_rgba(30,25,15,0.04)]"
                >
                  <div className="animate-pulse">
                    <div className="mb-3 h-5 w-32 rounded-full bg-[#EAE4D8]" />

                    <div className="h-7 w-40 rounded bg-[#EAE4D8]" />

                    <div className="mt-2 h-4 w-48 rounded bg-[#EAE4D8]" />

                    <div className="mt-5 grid grid-cols-3 gap-2">
                      {[1, 2, 3].map(
                        (stat) => (
                          <div
                            key={stat}
                            className="h-[68px] rounded-[10px] bg-[#F4F0E7]"
                          />
                        )
                      )}
                    </div>

                    <div className="mt-4 h-[105px] rounded-[11px] bg-[#F4F0E7]" />

                    <div className="mt-5 h-2 rounded-full bg-[#EAE4D8]" />

                    <div className="mt-5 h-10 rounded-lg bg-[#EAE4D8]" />
                  </div>
                </div>
              )
            )}
          </div>
        ) : filteredJurnal.length === 0 ? (
          <div className="rounded-[14px] border border-[#E3DACB] bg-[#FFFDF8] px-6 py-16 text-center shadow-[0_1px_2px_rgba(30,25,15,0.04),0_8px_24px_-12px_rgba(30,25,15,0.10)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#E7ECF4] text-[#1E2A47]">
              {searchQuery ? (
                <Search
                  size={24}
                  strokeWidth={1.7}
                />
              ) : (
                <FileText
                  size={24}
                  strokeWidth={1.7}
                />
              )}
            </div>

            <h2 className="mt-4 font-['Fraunces',serif] text-[20px] font-semibold text-[#141C30]">
              {searchQuery
                ? 'Kelas tidak ditemukan'
                : activeTab ===
                    'menunggu'
                  ? 'Tidak ada jurnal yang menunggu'
                  : activeTab ===
                      'lengkap'
                    ? 'Belum ada jurnal lengkap'
                    : 'Belum ada kelas'}
            </h2>

            <p className="mx-auto mt-2 max-w-[430px] text-[13px] leading-6 text-[#6B7080]">
              {searchQuery
                ? 'Coba gunakan kata kunci lain untuk mencari kelas atau mata pelajaran.'
                : 'Data jurnal mengajar akan muncul di halaman ini setelah jadwal kelas tersedia.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-[18px] xl:grid-cols-2">
            {filteredJurnal.map(
              (item) => {
                const isPending =
                  item.status ===
                  'menunggu';

                const filled =
                  item.jumlah_jurnal;

                const totalMeetings =
                  Math.max(
                    filled,
                    1
                  );

                const progress =
                  isPending
                    ? 0
                    : 100;

                const latestDate =
                  item.jurnal_terakhir
                    ? formatDate(
                        item
                          .jurnal_terakhir
                          .tanggal
                      )
                    : null;

                return (
                  <div
                    key={item.id}
                    className={`relative flex min-w-0 flex-col overflow-hidden rounded-[14px] border bg-[#FFFDF8] shadow-[0_1px_2px_rgba(30,25,15,0.04),0_8px_24px_-12px_rgba(30,25,15,0.10)] ${
                      isPending
                        ? 'border-[#E4BCA9]'
                        : 'border-[#E3DACB]'
                    }`}
                  >
                    <span
                      className={`absolute right-[18px] top-[18px] z-10 inline-flex items-center gap-[5px] rounded-full px-2.5 py-1 text-[10.5px] font-bold ${
                        isPending
                          ? 'bg-[#F6E1D9] text-[#A8503B]'
                          : 'bg-[#E7F0EA] text-[#4C7A5E]'
                      }`}
                    >
                      {isPending ? (
                        <TriangleAlert
                          size={11}
                          strokeWidth={2.2}
                        />
                      ) : (
                        <CheckCircle2
                          size={11}
                          strokeWidth={2.2}
                        />
                      )}

                      {isPending
                        ? 'Menunggu diisi'
                        : 'Lengkap'}
                    </span>

                    <div className="border-b border-[#E3DACB] px-[22px] pb-4 pt-5 pr-[90px]">
                      <span
                        className={`mb-2.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${getSubjectTagClass(
                          item.mata_pelajaran
                        )}`}
                      >
                        <span
                          className={`flex h-4 w-4 items-center justify-center rounded-full ${getSubjectIconClass(
                            item.mata_pelajaran
                          )}`}
                        >
                          <BookOpen
                            size={9}
                            strokeWidth={2}
                          />
                        </span>

                        {item.mata_pelajaran}
                      </span>

                      <div className="font-['Fraunces',serif] text-[21px] font-semibold tracking-[-0.01em] text-[#141C30]">
                        {item.kelas}
                      </div>

                      <div className="mt-[3px] flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[#6B7080]">
                        <span>
                          {item.hari}
                        </span>

                        <span>
                          •
                        </span>

                        <span>
                          {item.waktu}
                        </span>
                      </div>
                    </div>

                    <div className="px-[22px] pb-1 pt-4">
                      <div className="mb-4 grid grid-cols-3 gap-2.5">
                        <div className="rounded-[10px] border border-[#E3DACB] bg-[#FBF9F3] px-3 py-2.5 text-left">
                          <div className="font-['Fraunces',serif] text-[18px] font-semibold leading-none text-[#141C30]">
                            {totalMeetings}
                          </div>

                          <div className="mt-1 text-[10.5px] text-[#6B7080]">
                            Total pertemuan
                          </div>
                        </div>

                        <div className="rounded-[10px] border border-[#E3DACB] bg-[#FBF9F3] px-3 py-2.5 text-left">
                          <div className="font-['Fraunces',serif] text-[18px] font-semibold leading-none text-[#141C30]">
                            {filled}
                          </div>

                          <div className="mt-1 text-[10.5px] text-[#6B7080]">
                            Jurnal terisi
                          </div>
                        </div>

                        <div
                          className={`rounded-[10px] border px-3 py-2.5 text-left ${
                            isPending
                              ? 'border-[#E4BCA9] bg-[#F6E1D9]'
                              : 'border-[#E3DACB] bg-[#FBF9F3]'
                          }`}
                        >
                          <div
                            className={`font-['Fraunces',serif] text-[18px] font-semibold leading-none ${
                              isPending
                                ? 'text-[#A8503B]'
                                : 'text-[#141C30]'
                            }`}
                          >
                            {isPending
                              ? 1
                              : 0}
                          </div>

                          <div className="mt-1 text-[10.5px] text-[#6B7080]">
                            Belum diisi
                          </div>
                        </div>
                      </div>

                      <div
                        className={`mb-4 flex gap-[13px] rounded-[11px] border p-3.5 ${
                          isPending
                            ? 'border-[#E4BCA9] bg-[#F6E1D9]'
                            : 'border-[#E3DACB] bg-[#FBF9F3]'
                        }`}
                      >
                        <div
                          className={`w-11 shrink-0 self-start rounded-[9px] border bg-white px-0 py-[7px] text-center ${
                            isPending
                              ? 'border-[#E4BCA9]'
                              : 'border-[#E3DACB]'
                          }`}
                        >
                          {latestDate ? (
                            <>
                              <div className="font-['Fraunces',serif] text-[16px] font-bold leading-none text-[#141C30]">
                                {latestDate.day}
                              </div>

                              <div className="mt-0.5 text-[9.5px] lowercase text-[#6B7080]">
                                {latestDate.month}
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="font-['Fraunces',serif] text-[16px] font-bold leading-none text-[#A8503B]">
                                —
                              </div>

                              <div className="mt-0.5 text-[9.5px] text-[#A8503B]">
                                belum
                              </div>
                            </>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div
                            className={`mb-[3px] text-[10.5px] font-bold uppercase tracking-[0.03em] ${
                              isPending
                                ? 'text-[#A8503B]'
                                : 'text-[#6B7080]'
                            }`}
                          >
                            Pertemuan terakhir
                          </div>

                          {isPending ? (
                            <>
                              <div className="text-[13px] italic leading-[1.45] text-[#6B7080]">
                                Materi dan presensi belum diisi untuk pertemuan ini.
                              </div>

                              <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#A8503B]">
                                <Clock3
                                  size={12}
                                />

                                Menunggu diisi
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="line-clamp-3 text-[13px] leading-[1.45] text-[#23283A]">
                                {item
                                  .jurnal_terakhir
                                  ?.topic ??
                                  'Belum ada topik pembelajaran.'}
                              </div>

                              {item
                                .jurnal_terakhir
                                ?.description && (
                                <div className="mt-1.5 line-clamp-2 text-[11px] leading-[1.5] text-[#6B7080]">
                                  {
                                    item
                                      .jurnal_terakhir
                                      .description
                                  }
                                </div>
                              )}

                              <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#6B7080]">
                                <CalendarDays
                                  size={12}
                                />

                                {item
                                  .jurnal_terakhir
                                  ?.tanggal
                                  ? formatLongDate(
                                      item
                                        .jurnal_terakhir
                                        .tanggal
                                    )
                                  : '-'}
                              </div>

                              <div className="mt-[9px] flex flex-wrap gap-1.5">
                                <span className="inline-flex items-center gap-1 rounded-full bg-[#E7F0EA] px-2 py-[3px] text-[10.5px] font-bold text-[#4C7A5E]">
                                  <span className="font-['Fraunces',serif] font-bold">
                                    {
                                      item
                                        .presensi
                                        .hadir
                                    }
                                  </span>
                                  Hadir
                                </span>

                                <span className="inline-flex items-center gap-1 rounded-full bg-[#E5ECF5] px-2 py-[3px] text-[10.5px] font-bold text-[#3E6BAE]">
                                  <span className="font-['Fraunces',serif] font-bold">
                                    {
                                      item
                                        .presensi
                                        .izin
                                    }
                                  </span>
                                  Izin
                                </span>

                                <span className="inline-flex items-center gap-1 rounded-full bg-[#E7D3A8] px-2 py-[3px] text-[10.5px] font-bold text-[#7A5A20]">
                                  <span className="font-['Fraunces',serif] font-bold">
                                    {
                                      item
                                        .presensi
                                        .sakit
                                    }
                                  </span>
                                  Sakit
                                </span>

                                <span className="inline-flex items-center gap-1 rounded-full bg-[#EFE2EC] px-2 py-[3px] text-[10.5px] font-bold text-[#7A4C6E]">
                                  <span className="font-['Fraunces',serif] font-bold">
                                    {
                                      item
                                        .presensi
                                        .dispen
                                    }
                                  </span>
                                  Dispen
                                </span>

                                <span className="inline-flex items-center gap-1 rounded-full bg-[#F6E1D9] px-2 py-[3px] text-[10.5px] font-bold text-[#A8503B]">
                                  <span className="font-['Fraunces',serif] font-bold">
                                    {
                                      item
                                        .presensi
                                        .alpa
                                    }
                                  </span>
                                  Alpa
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="px-[22px] pb-1">
                      <div className="mb-1.5 flex items-center justify-between text-[11.5px] text-[#6B7080]">
                        <span>
                          Kelengkapan jurnal
                        </span>

                        <b className="font-bold text-[#141C30]">
                          {filled} /{' '}
                          {totalMeetings}{' '}
                          pertemuan
                        </b>
                      </div>

                      <div className="h-[7px] overflow-hidden rounded-full bg-[#EFE9DB]">
                        <div
                          className={`h-full rounded-full ${
                            isPending
                              ? 'bg-gradient-to-r from-[#A8503B] to-[#C46B4F]'
                              : 'bg-gradient-to-r from-[#1E2A47] to-[#2C3B5E]'
                          }`}
                          style={{
                            width: `${progress}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="mt-auto flex gap-2 px-[22px] pb-5 pt-[18px]">
                      <button
                        type="button"
                        onClick={() =>
                          handleOpenHistory(
                            item
                          )
                        }
                        className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[9px] border border-[#E3DACB] bg-[#FFFDF8] px-2 py-2.5 text-[12.5px] font-bold text-[#1E2A47] transition hover:border-[#B98A3E] hover:bg-[#F0EBDB]"
                      >
                        <History
                          size={14}
                          strokeWidth={1.9}
                        />

                        Riwayat jurnal
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleStartClass(
                            item
                          )
                        }
                        className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[9px] border px-2 py-2.5 text-[12.5px] font-bold text-white transition ${
                          isPending
                            ? 'border-[#A8503B] bg-[#A8503B] hover:bg-[#8F4331]'
                            : 'border-[#1E2A47] bg-[#1E2A47] hover:bg-[#141C30]'
                        }`}
                      >
                        <Play
                          size={14}
                          strokeWidth={1.9}
                          fill="currentColor"
                        />

                        {isPending
                          ? 'Mulai kelas sekarang'
                          : 'Mulai kelas'}
                      </button>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}
      </div>

      {showStartModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#141C30]/55 p-4 backdrop-blur-[2px]"
          onMouseDown={(
            event
          ) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeStartModal();
            }
          }}
        >
          <div className="flex max-h-[92vh] w-full max-w-[760px] flex-col overflow-hidden rounded-[16px] border border-[#E3DACB] bg-[#FFFDF8] shadow-[0_20px_60px_rgba(20,28,48,0.20)]">
            <div className="flex items-start justify-between border-b border-[#E3DACB] px-5 py-4 md:px-6">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#6B7080]">
                  Pertemuan baru
                </div>

                <h2 className="mt-1 font-['Fraunces',serif] text-[22px] font-semibold text-[#141C30]">
                  Mulai kelas
                </h2>

                {selectedSchedule && (
                  <div className="mt-1 text-[12.5px] text-[#6B7080]">
                    <span className="font-semibold text-[#23283A]">
                      {
                        selectedSchedule.mata_pelajaran
                      }
                    </span>

                    <span className="mx-1.5">
                      •
                    </span>

                    {
                      selectedSchedule.kelas
                    }

                    <span className="mx-1.5">
                      •
                    </span>

                    {
                      selectedSchedule.hari
                    }
                    ,{' '}
                    {
                      selectedSchedule.waktu
                    }
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={
                  closeStartModal
                }
                disabled={saving}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#6B7080] transition hover:bg-[#F0EBDB] hover:text-[#23283A] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-5 md:px-6">
              {modalError && (
                <div className="mb-4 flex items-start gap-2 rounded-xl border border-[#E4BCA9] bg-[#F6E1D9] px-3.5 py-3 text-[12.5px] leading-5 text-[#A8503B]">
                  <TriangleAlert
                    size={16}
                    className="mt-0.5 shrink-0"
                  />

                  <span>
                    {modalError}
                  </span>
                </div>
              )}

              {loadingDetail ? (
                <div className="space-y-4">
                  <div className="h-11 animate-pulse rounded-xl bg-[#F0EBE0]" />

                  <div className="h-11 animate-pulse rounded-xl bg-[#F0EBE0]" />

                  <div className="h-[100px] animate-pulse rounded-xl bg-[#F0EBE0]" />

                  <div className="h-[250px] animate-pulse rounded-xl bg-[#F0EBE0]" />
                </div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <label className="mb-1.5 block text-[12px] font-bold text-[#23283A]">
                      Tanggal pertemuan
                    </label>

                    <div className="relative">
                      <CalendarDays
                        size={16}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7080]"
                      />

                      <input
                        type="date"
                        value={
                          journalDate
                        }
                        onChange={(
                          event
                        ) =>
                          setJournalDate(
                            event
                              .target
                              .value
                          )
                        }
                        disabled={saving}
                        className="h-[42px] w-full rounded-[10px] border border-[#E3DACB] bg-[#FFFDF8] pl-10 pr-3 text-[13px] text-[#23283A] outline-none transition focus:border-[#B98A3E]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[12px] font-bold text-[#23283A]">
                      Materi / Topik pembelajaran
                      <span className="ml-1 text-[#A8503B]">
                        *
                      </span>
                    </label>

                    <input
                      type="text"
                      value={topic}
                      onChange={(
                        event
                      ) =>
                        setTopic(
                          event
                            .target
                            .value
                        )
                      }
                      disabled={saving}
                      placeholder="Contoh: Norma dan keadilan"
                      className="h-[42px] w-full rounded-[10px] border border-[#E3DACB] bg-[#FFFDF8] px-3 text-[13px] text-[#23283A] outline-none transition placeholder:text-[#9A9DA7] focus:border-[#B98A3E]"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[12px] font-bold text-[#23283A]">
                      Deskripsi kegiatan
                    </label>

                    <textarea
                      value={
                        description
                      }
                      onChange={(
                        event
                      ) =>
                        setDescription(
                          event
                            .target
                            .value
                        )
                      }
                      disabled={saving}
                      rows={3}
                      placeholder="Tuliskan ringkasan kegiatan pembelajaran, metode, atau catatan penting."
                      className="w-full resize-none rounded-[10px] border border-[#E3DACB] bg-[#FFFDF8] px-3 py-2.5 text-[13px] leading-5 text-[#23283A] outline-none transition placeholder:text-[#9A9DA7] focus:border-[#B98A3E]"
                    />
                  </div>

                  <div>
                    <div className="mb-2.5 flex items-center justify-between">
                      <div>
                        <div className="text-[13px] font-bold text-[#23283A]">
                          Presensi siswa
                        </div>

                        <div className="mt-0.5 text-[11.5px] text-[#6B7080]">
                          Tentukan status kehadiran setiap siswa.
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#6B7080]">
                        <UserCheck
                          size={14}
                        />

                        {
                          scheduleDetail
                            ?.students
                            .length ??
                          0
                        }{' '}
                        siswa
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-[#E3DACB]">
                      {scheduleDetail?.students
                        .length ? (
                        scheduleDetail.students.map(
                          (
                            student,
                            index
                          ) => (
                            <div
                              key={
                                student.id
                              }
                              className={`px-3.5 py-3 ${
                                index !==
                                scheduleDetail
                                  .students
                                  .length -
                                  1
                                  ? 'border-b border-[#E3DACB]'
                                  : ''
                              }`}
                            >
                              <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
                                <div className="flex min-w-0 items-center gap-2.5">
                                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E7ECF4] text-[10px] font-bold text-[#1E2A47]">
                                    {getInitials(
                                      student.nama
                                    )}
                                  </div>

                                  <div className="min-w-0">
                                    <div className="truncate text-[12.5px] font-bold text-[#23283A]">
                                      {
                                        student.nama
                                      }
                                    </div>

                                    <div className="truncate text-[10.5px] text-[#6B7080]">
                                      {
                                        student.email
                                      }
                                    </div>
                                  </div>
                                </div>

                                <div className="grid grid-cols-5 gap-1">
                                  {(
                                    [
                                      'hadir',
                                      'izin',
                                      'sakit',
                                      'dispen',
                                      'alpa',
                                    ] as AttendanceStatus[]
                                  ).map(
                                    (
                                      status
                                    ) => {
                                      const active =
                                        student.status ===
                                        status;

                                      const labels: Record<
                                        AttendanceStatus,
                                        string
                                      > = {
                                        hadir:
                                          'Hadir',
                                        izin:
                                          'Izin',
                                        sakit:
                                          'Sakit',
                                        dispen:
                                          'Dispen',
                                        alpa:
                                          'Alpa',
                                      };

                                      return (
                                        <button
                                          key={
                                            status
                                          }
                                          type="button"
                                          disabled={
                                            saving
                                          }
                                          onClick={() =>
                                            changeAttendance(
                                              student.id,
                                              status
                                            )
                                          }
                                          className={`rounded-full border px-2 py-1.5 text-[10px] font-bold transition ${
                                            active
                                              ? status ===
                                                'hadir'
                                                ? 'border-[#4C7A5E] bg-[#E7F0EA] text-[#4C7A5E]'
                                                : status ===
                                                  'izin'
                                                  ? 'border-[#3E6BAE] bg-[#E5ECF5] text-[#3E6BAE]'
                                                  : status ===
                                                    'sakit'
                                                    ? 'border-[#B98A3E] bg-[#E7D3A8] text-[#7A5A20]'
                                                    : status ===
                                                      'dispen'
                                                      ? 'border-[#7A4C6E] bg-[#EFE2EC] text-[#7A4C6E]'
                                                      : 'border-[#A8503B] bg-[#F6E1D9] text-[#A8503B]'
                                              : 'border-[#E3DACB] bg-[#FFFDF8] text-[#6B7080] hover:bg-[#F0EBDB]'
                                          }`}
                                        >
                                          {
                                            labels[
                                              status
                                            ]
                                          }
                                        </button>
                                      );
                                    }
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        )
                      ) : (
                        <div className="px-4 py-10 text-center text-[12px] text-[#6B7080]">
                          Belum ada siswa pada kelas ini.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-[#E3DACB] bg-[#FBF9F3] px-5 py-4 sm:flex-row sm:justify-end md:px-6">
              <button
                type="button"
                onClick={
                  closeStartModal
                }
                disabled={saving}
                className="rounded-[9px] border border-[#E3DACB] bg-[#FFFDF8] px-4 py-2.5 text-[12.5px] font-bold text-[#1E2A47] transition hover:border-[#B98A3E] hover:bg-[#F0EBDB] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={
                  handleSaveJournal
                }
                disabled={
                  saving ||
                  loadingDetail ||
                  !scheduleDetail
                }
                className="inline-flex items-center justify-center gap-2 rounded-[9px] border border-[#1E2A47] bg-[#1E2A47] px-5 py-2.5 text-[12.5px] font-bold text-white transition hover:bg-[#141C30] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Check
                      size={14}
                    />
                    Simpan pertemuan
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showHistoryModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#141C30]/55 p-4 backdrop-blur-[2px]"
          onMouseDown={(
            event
          ) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeHistoryModal();
            }
          }}
        >
          <div className="flex max-h-[88vh] w-full max-w-[680px] flex-col overflow-hidden rounded-[16px] border border-[#E3DACB] bg-[#FFFDF8] shadow-[0_20px_60px_rgba(20,28,48,0.20)]">
            <div className="flex items-start justify-between border-b border-[#E3DACB] px-5 py-4 md:px-6">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#6B7080]">
                  Riwayat pembelajaran
                </div>

                <h2 className="mt-1 font-['Fraunces',serif] text-[22px] font-semibold text-[#141C30]">
                  Riwayat jurnal
                </h2>

                {historyClass && (
                  <div className="mt-1 text-[12.5px] text-[#6B7080]">
                    <span className="font-semibold text-[#23283A]">
                      {
                        historyClass.mata_pelajaran
                      }
                    </span>

                    <span className="mx-1.5">
                      •
                    </span>

                    {
                      historyClass.kelas
                    }
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={
                  closeHistoryModal
                }
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#6B7080] transition hover:bg-[#F0EBDB] hover:text-[#23283A]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-5 md:px-6">
              {loadingHistory ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(
                    (item) => (
                      <div
                        key={item}
                        className="h-[100px] animate-pulse rounded-xl bg-[#F0EBE0]"
                      />
                    )
                  )}
                </div>
              ) : historyError ? (
                <div className="rounded-xl border border-[#E4BCA9] bg-[#F6E1D9] px-4 py-3 text-[12.5px] text-[#A8503B]">
                  {
                    historyError
                  }
                </div>
              ) : historyItems.length ===
                0 ? (
                <div className="py-12 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#E7ECF4] text-[#1E2A47]">
                    <History
                      size={22}
                    />
                  </div>

                  <h3 className="mt-3 font-['Fraunces',serif] text-[18px] font-semibold text-[#141C30]">
                    Belum ada riwayat
                  </h3>

                  <p className="mt-1.5 text-[12px] text-[#6B7080]">
                    Belum terdapat jurnal pembelajaran untuk kelas ini.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {historyItems.map(
                    (history) => {
                      const date =
                        formatDate(
                          history.tanggal
                        );

                      return (
                        <div
                          key={
                            history.id
                          }
                          className="flex gap-3 rounded-xl border border-[#E3DACB] bg-[#FBF9F3] p-3.5"
                        >
                          <div className="w-11 shrink-0 self-start rounded-[9px] border border-[#E3DACB] bg-white px-0 py-[7px] text-center">
                            <div className="font-['Fraunces',serif] text-[16px] font-bold leading-none text-[#141C30]">
                              {
                                date.day
                              }
                            </div>

                            <div className="mt-0.5 text-[9.5px] lowercase text-[#6B7080]">
                              {
                                date.month
                              }
                            </div>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="text-[10.5px] font-bold uppercase tracking-[0.03em] text-[#6B7080]">
                              {formatLongDate(
                                history.tanggal
                              )}
                            </div>

                            <div className="mt-1 text-[13px] font-semibold leading-5 text-[#23283A]">
                              {
                                history.topic
                              }
                            </div>

                            {history.description && (
                              <div className="mt-1.5 text-[11.5px] leading-5 text-[#6B7080]">
                                {
                                  history.description
                                }
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-[#E3DACB] bg-[#FBF9F3] px-5 py-4 md:px-6">
              <button
                type="button"
                onClick={
                  closeHistoryModal
                }
                className="rounded-[9px] border border-[#E3DACB] bg-[#FFFDF8] px-4 py-2.5 text-[12.5px] font-bold text-[#1E2A47] transition hover:border-[#B98A3E] hover:bg-[#F0EBDB]"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </JurnalMengajarLayout>
  );
}