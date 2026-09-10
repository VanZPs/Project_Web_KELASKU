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
  ChevronLeft,
  ChevronRight,
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
  is_holiday: boolean;
  holiday_name: string | null;
}

interface Presensi {
  hadir: number;
  izin: number;
  sakit: number;
  dispen: number;
  alpa: number;
}

interface JurnalSchedule {
  id: number;
  hari: string;
  waktu: string;
}

interface JurnalScheduleToday {
  id: number;
  hari: string;
  waktu: string;
}

interface JurnalItem {
  id: number;
  kelas: string;
  mata_pelajaran: string;
  hari: string;
  waktu: string;
  total_pertemuan: number;
  jumlah_sesi: number;
  jumlah_jurnal: number;
  jadwal: JurnalSchedule[];
  jadwal_hari_ini: JurnalScheduleToday | null;
  jurnal_terakhir: JurnalTerakhir | null;
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
  notes: string;
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
  is_holiday: boolean;
  holiday_name: string | null;
  kelas: string;
  mata_pelajaran: string;
}

interface HistoryWeek {
  weekNumber: number;
  startDate: string;
  endDate: string;
  items: HistoryItem[];
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

const getTodayName = (): string => {
  return new Intl.DateTimeFormat(
    'id-ID',
    {
      weekday: 'long',
    }
  ).format(new Date());
};

const normalizeDay = (
  day: string
): string => {
  return day
    .trim()
    .toLowerCase()
    .replace(/\./g, '');
};

const getDayOrder = (
  day: string
): number => {
  const normalized =
    normalizeDay(day);

  const dayOrder: Record<
    string,
    number
  > = {
    senin: 1,
    selasa: 2,
    rabu: 3,
    kamis: 4,
    jumat: 5,
    sabtu: 6,
    minggu: 7,
  };

  return dayOrder[
    normalized
  ] ?? 99;
};

const getStartTimeMinutes = (
  time: string
): number => {
  if (!time) {
    return Number.MAX_SAFE_INTEGER;
  }

  const match =
    time.match(
      /(\d{1,2})[.:](\d{2})/
    );

  if (!match) {
    return Number.MAX_SAFE_INTEGER;
  }

  const hour =
    Number(match[1]);

  const minute =
    Number(match[2]);

  return (
    hour * 60 +
    minute
  );
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

/*
 * ============================================================
 * HELPER RIWAYAT JURNAL
 * ============================================================
 */

/*
 * Format YYYY-MM-DD.
 */
const formatInputDate = (
  date: Date
): string => {
  const year =
    date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, '0');

  const day = String(
    date.getDate()
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

/*
 * Mengambil nama bulan dalam Bahasa Indonesia.
 */
const getMonthName = (
  month: number
): string => {
  const date = new Date(
    2026,
    month - 1,
    1
  );

  return date.toLocaleDateString(
    'id-ID',
    {
      month: 'long',
    }
  );
};

/*
 * Mengambil awal minggu (Senin)
 * dari sebuah tanggal.
 */
const getMonday = (
  date: Date
): Date => {
  const result =
    new Date(date);

  result.setHours(
    0,
    0,
    0,
    0
  );

  const day =
    result.getDay();

  /*
   * JavaScript:
   *
   * Minggu = 0
   * Senin = 1
   * ...
   * Sabtu = 6
   */
  const difference =
    day === 0
      ? -6
      : 1 - day;

  result.setDate(
    result.getDate() +
      difference
  );

  return result;
};

/*
 * Mengambil akhir minggu (Minggu)
 * dari sebuah tanggal.
 */
const getSunday = (
  date: Date
): Date => {
  const monday =
    getMonday(date);

  const result =
    new Date(monday);

  result.setDate(
    result.getDate() + 6
  );

  return result;
};

/*
 * Membuat daftar minggu dalam sebuah bulan.
 *
 * Contoh:
 *
 * September 2026
 *
 * Minggu 1
 * 31 Agustus - 6 September
 *
 * Minggu 2
 * 7 September - 13 September
 *
 * dst.
 *
 * Tetapi tanggal yang ditampilkan
 * akan dipotong mengikuti bulan yang dipilih.
 */
const getWeeksOfMonth = (
  year: number,
  month: number
): HistoryWeek[] => {
  const firstDay =
    new Date(
      year,
      month - 1,
      1
    );

  const lastDay =
    new Date(
      year,
      month,
      0
    );

  const firstMonday =
    getMonday(firstDay);

  const weeks: HistoryWeek[] =
    [];

  let currentMonday =
    new Date(firstMonday);

  let weekNumber = 1;

  while (
    currentMonday <= lastDay
  ) {
    const currentSunday =
      getSunday(
        currentMonday
      );

    /*
     * Awal minggu dipotong
     * agar tidak keluar dari bulan.
     */
    const visibleStart =
      currentMonday <
      firstDay
        ? new Date(firstDay)
        : new Date(
            currentMonday
          );

    /*
     * Akhir minggu dipotong
     * agar tidak keluar dari bulan.
     */
    const visibleEnd =
      currentSunday >
      lastDay
        ? new Date(lastDay)
        : new Date(
            currentSunday
          );

    weeks.push({
      weekNumber,
      startDate:
        formatInputDate(
          visibleStart
        ),
      endDate:
        formatInputDate(
          visibleEnd
        ),
      items: [],
    });

    currentMonday =
      new Date(currentMonday);

    currentMonday.setDate(
      currentMonday.getDate() +
        7
    );

    weekNumber += 1;
  }

  return weeks;
};

/*
 * Mengubah string tanggal
 * menjadi objek Date lokal.
 */
const parseLocalDate = (
  dateString: string
): Date => {
  return new Date(
    `${dateString}T00:00:00`
  );
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
    selectedScheduleId,
    setSelectedScheduleId,
  ] = useState<number | null>(
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

  /*
   * ============================================================
   * HISTORY STATE
   * ============================================================
   */

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

  /*
   * Bulan yang sedang ditampilkan
   * pada modal riwayat.
   *
   * Default:
   * bulan saat ini.
   */
  const now = new Date();

  const [
    historyMonth,
    setHistoryMonth,
  ] = useState(
    now.getMonth() + 1
  );

  /*
   * Tahun yang sedang ditampilkan
   * pada modal riwayat.
   *
   * Default:
   * tahun saat ini.
   */
  const [
    historyYear,
    setHistoryYear,
  ] = useState(
    now.getFullYear()
  );

  /*
   * Halaman minggu yang sedang dibuka.
   *
   * 0 = minggu pertama
   * 1 = minggu kedua
   * dst.
   */
  const [
    historyWeekPage,
    setHistoryWeekPage,
  ] = useState(0);

  /*
   * ID card yang menampilkan warning.
   */
  const [
    unavailableWarningId,
    setUnavailableWarningId,
  ] = useState<number | null>(
    null
  );

  const todayName =
    getTodayName();

  const normalizedToday =
    normalizeDay(todayName);

  /*
   * ============================================================
   * MAPEL GURU
   * ============================================================
   */

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

  /*
   * ============================================================
   * FETCH JURNAL
   * ============================================================
   */

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

  /*
   * ============================================================
   * TODAY SCHEDULE
   * ============================================================
   */

  const getTodaySchedule = (
    item: JurnalItem
  ): JurnalScheduleToday | null => {
    if (item.jadwal_hari_ini) {
      return item.jadwal_hari_ini;
    }

    const fallback =
      item.jadwal?.find(
        (schedule) =>
          normalizeDay(
            schedule.hari
          ) === normalizedToday
      );

    return fallback ?? null;
  };

  const isScheduleToday = (
    item: JurnalItem
  ): boolean => {
    return (
      getTodaySchedule(item) !== null
    );
  };

  /*
   * ============================================================
   * FILTER & SORT JURNAL
   * ============================================================
   */

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

      result.sort(
        (a, b) => {
          const aToday =
            isScheduleToday(a);

          const bToday =
            isScheduleToday(b);

          if (
            aToday &&
            !bToday
          ) {
            return -1;
          }

          if (
            !aToday &&
            bToday
          ) {
            return 1;
          }

          const aSchedules =
            [...(a.jadwal ?? [])].sort(
              (
                scheduleA,
                scheduleB
              ) => {
                const dayDifference =
                  getDayOrder(
                    scheduleA.hari
                  ) -
                  getDayOrder(
                    scheduleB.hari
                  );

                if (
                  dayDifference !== 0
                ) {
                  return dayDifference;
                }

                return (
                  getStartTimeMinutes(
                    scheduleA.waktu
                  ) -
                  getStartTimeMinutes(
                    scheduleB.waktu
                  )
                );
              }
            );

          const bSchedules =
            [...(b.jadwal ?? [])].sort(
              (
                scheduleA,
                scheduleB
              ) => {
                const dayDifference =
                  getDayOrder(
                    scheduleA.hari
                  ) -
                  getDayOrder(
                    scheduleB.hari
                  );

                if (
                  dayDifference !== 0
                ) {
                  return dayDifference;
                }

                return (
                  getStartTimeMinutes(
                    scheduleA.waktu
                  ) -
                  getStartTimeMinutes(
                    scheduleB.waktu
                  )
                );
              }
            );

          const aFirst =
            aSchedules[0];

          const bFirst =
            bSchedules[0];

          if (
            !aFirst &&
            !bFirst
          ) {
            return 0;
          }

          if (!aFirst) {
            return 1;
          }

          if (!bFirst) {
            return -1;
          }

          const dayDifference =
            getDayOrder(
              aFirst.hari
            ) -
            getDayOrder(
              bFirst.hari
            );

          if (
            dayDifference !== 0
          ) {
            return dayDifference;
          }

          return (
            getStartTimeMinutes(
              aFirst.waktu
            ) -
            getStartTimeMinutes(
              bFirst.waktu
            )
          );
        }
      );

      void period;

      return result;
    }, [
      jurnalList,
      activeTab,
      searchQuery,
      period,
      normalizedToday,
    ]);

  /*
   * ============================================================
   * STATISTICS
   * ============================================================
   */

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

  /*
   * ============================================================
   * MULAI KELAS
   * ============================================================
   */

  const handleStartClass = async (
    item: JurnalItem
  ) => {
    const todaySchedule =
      getTodaySchedule(item);

    if (!todaySchedule) {
      setUnavailableWarningId(
        item.id
      );

      return;
    }

    setUnavailableWarningId(null);

    setSelectedSchedule(item);

    setSelectedScheduleId(
      todaySchedule.id
    );

    setShowStartModal(true);

    setLoadingDetail(true);
    setModalError('');

    setTopic('');
    setDescription('');
    setJournalDate(getToday());

    try {
      const response =
        await api.get(
          `/guru/jurnal/${todaySchedule.id}`
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

              notes:
                student.notes ??
                '',
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

    setSelectedScheduleId(null);

    setScheduleDetail(null);

    setTopic('');

    setDescription('');

    setModalError('');
  };

  /*
   * ============================================================
   * ATTENDANCE
   * ============================================================
   */

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

  const changeAttendanceNotes = (
    studentId: number,
    notes: string
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
                      notes,
                    }
                  : student
            ),
        };
      }
    );
  };

  /*
   * ============================================================
   * SIMPAN JURNAL
   * ============================================================
   */

  const handleSaveJournal =
    async () => {
      if (
        !selectedSchedule ||
        !selectedScheduleId
      ) {
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
          `/guru/jurnal/${selectedScheduleId}/mulai`,
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

                  notes:
                    student.notes.trim() ||
                    null,
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

  /*
   * ============================================================
   * RIWAYAT JURNAL
   * ============================================================
   */

  const handleOpenHistory =
    async (
      item: JurnalItem
    ) => {
      setHistoryClass(item);

      /*
       * Saat modal baru dibuka,
       * gunakan bulan dan tahun sekarang.
       */
      const currentDate =
        new Date();

      setHistoryMonth(
        currentDate.getMonth() + 1
      );

      setHistoryYear(
        currentDate.getFullYear()
      );

      setHistoryWeekPage(0);

      setShowHistoryModal(true);

      setLoadingHistory(true);

      setHistoryError('');

      try {
        const response =
          await api.get(
            `/guru/jurnal/riwayat/${item.id}`
          );

        const data =
          response.data?.data ??
          [];

        /*
         * Urutkan dari jurnal
         * paling baru ke paling lama.
         */
        const sortedHistory =
          [...data].sort(
            (
              a: HistoryItem,
              b: HistoryItem
            ) =>
              b.tanggal.localeCompare(
                a.tanggal
              )
          );

        setHistoryItems(
          sortedHistory
        );

        /*
         * Jika bulan sekarang tidak mempunyai
         * riwayat, otomatis pilih bulan
         * paling baru yang mempunyai jurnal.
         *
         * Hal ini membuat modal lebih informatif
         * ketika guru membuka riwayat kelas lama.
         */
        if (
          sortedHistory.length > 0
        ) {
          const latest =
            parseLocalDate(
              sortedHistory[0]
                .tanggal
            );

          setHistoryMonth(
            latest.getMonth() + 1
          );

          setHistoryYear(
            latest.getFullYear()
          );
        }
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

      setHistoryWeekPage(0);
    };

  /*
   * ============================================================
   * DAFTAR TAHUN RIWAYAT
   * ============================================================
   *
   * Tahun dibuat berdasarkan:
   *
   * 1. Tahun saat ini
   * 2. Tahun dari data jurnal
   *
   * Jadi dropdown akan otomatis mengikuti
   * data yang memang tersedia.
   */
  const historyYears =
    useMemo(() => {
      const years =
        new Set<number>();

      years.add(
        new Date().getFullYear()
      );

      historyItems.forEach(
        (item) => {
          const date =
            parseLocalDate(
              item.tanggal
            );

          if (
            !Number.isNaN(
              date.getTime()
            )
          ) {
            years.add(
              date.getFullYear()
            );
          }
        }
      );

      return Array.from(
        years
      ).sort(
        (a, b) => b - a
      );
    }, [historyItems]);

  /*
   * ============================================================
   * FILTER RIWAYAT BULAN + TAHUN
   * ============================================================
   */

  const historyMonthItems =
    useMemo(() => {
      return historyItems
        .filter(
          (item) => {
            const date =
              parseLocalDate(
                item.tanggal
              );

            return (
              date.getFullYear() ===
                historyYear &&
              date.getMonth() + 1 ===
                historyMonth
            );
          }
        )
        .sort(
          (a, b) =>
            b.tanggal.localeCompare(
              a.tanggal
            )
        );
    }, [
      historyItems,
      historyMonth,
      historyYear,
    ]);

  /*
   * ============================================================
   * KELOMPOK MINGGU
   * ============================================================
   *
   * Setiap page mewakili satu minggu.
   */
  const historyWeeks =
    useMemo(() => {
      const weeks =
        getWeeksOfMonth(
          historyYear,
          historyMonth
        );

      weeks.forEach(
        (week) => {
          week.items =
            historyMonthItems
              .filter(
                (item) => {
                  return (
                    item.tanggal >=
                      week.startDate &&
                    item.tanggal <=
                      week.endDate
                  );
                }
              )
              .sort(
                (a, b) =>
                  b.tanggal.localeCompare(
                    a.tanggal
                  )
              );
        }
      );

      return weeks;
    }, [
      historyMonthItems,
      historyMonth,
      historyYear,
    ]);

  /*
   * Minggu aktif.
   */
  const activeHistoryWeek =
    historyWeeks[
      historyWeekPage
    ] ?? null;

  /*
   * Apakah halaman sebelumnya tersedia?
   */
  const canGoPreviousHistoryWeek =
    historyWeekPage > 0;

  /*
   * Apakah halaman berikutnya tersedia?
   */
  const canGoNextHistoryWeek =
    historyWeekPage <
    historyWeeks.length - 1;

  /*
   * Ketika bulan/tahun berubah,
   * kembali ke minggu pertama.
   */
  const handleHistoryMonthChange =
    (
      value: number
    ) => {
      setHistoryMonth(value);
      setHistoryWeekPage(0);
    };

  const handleHistoryYearChange =
    (
      value: number
    ) => {
      setHistoryYear(value);
      setHistoryWeekPage(0);
    };

  /*
   * Format range minggu.
   *
   * Contoh:
   *
   * 1–6 September
   * 7–13 September
   */
  const formatWeekRange = (
    week: HistoryWeek
  ): string => {
    const start =
      parseLocalDate(
        week.startDate
      );

    const end =
      parseLocalDate(
        week.endDate
      );

    const startDay =
      start.getDate();

    const endDay =
      end.getDate();

    const monthName =
      getMonthName(
        historyMonth
      );

    if (
      start.getMonth() ===
      end.getMonth()
    ) {
      return `${startDay}–${endDay} ${monthName}`;
    }

    const startMonth =
      start.toLocaleDateString(
        'id-ID',
        {
          month: 'short',
        }
      );

    const endMonth =
      end.toLocaleDateString(
        'id-ID',
        {
          month: 'short',
        }
      );

    return `${startDay} ${startMonth}–${endDay} ${endMonth}`;
  };

  /*
   * ============================================================
   * RETURN
   * ============================================================
   */

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

        {/* =====================================================
            FILTER
        ====================================================== */}

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

        {/* =====================================================
            STATISTICS
        ====================================================== */}

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

        {/* =====================================================
            ERROR
        ====================================================== */}

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

        {/* =====================================================
            CONTENT
        ====================================================== */}

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

                const isToday =
                  isScheduleToday(
                    item
                  );

                const showUnavailableWarning =
                  unavailableWarningId ===
                  item.id;

                const totalMeetings =
                  Math.max(
                    Number(
                      item.total_pertemuan ??
                        item.jumlah_sesi ??
                        item.jadwal?.length ??
                        1
                    ),
                    1
                  );

                const filled =
                  Math.min(
                    Math.max(
                      Number(
                        item.jumlah_jurnal ??
                          0
                      ),
                      0
                    ),
                    totalMeetings
                  );

                const remainingMeetings =
                  Math.max(
                    totalMeetings -
                      filled,
                    0
                  );

                const progress =
                  Math.min(
                    (
                      filled /
                      totalMeetings
                    ) * 100,
                    100
                  );

                const latestDate =
                  item.jurnal_terakhir
                    ? formatDate(
                        item
                          .jurnal_terakhir
                          .tanggal
                      )
                    : null;

                const sortedSchedules =
                  [...(item.jadwal ?? [])].sort(
                    (
                      scheduleA,
                      scheduleB
                    ) => {
                      const dayDifference =
                        getDayOrder(
                          scheduleA.hari
                        ) -
                        getDayOrder(
                          scheduleB.hari
                        );

                      if (
                        dayDifference !==
                        0
                      ) {
                        return dayDifference;
                      }

                      return (
                        getStartTimeMinutes(
                          scheduleA.waktu
                        ) -
                        getStartTimeMinutes(
                          scheduleB.waktu
                        )
                      );
                    }
                  );

                return (
                  <div
                    key={item.id}
                    className={`relative flex min-w-0 flex-col overflow-hidden rounded-[14px] border bg-[#FFFDF8] shadow-[0_1px_2px_rgba(30,25,15,0.04),0_8px_24px_-12px_rgba(30,25,15,0.10)] ${
                      isPending
                        ? 'border-[#E4BCA9]'
                        : 'border-[#E3DACB]'
                    }`}
                  >

                    {/* STATUS */}

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

                    {/* CARD HEADER */}

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

                        {
                          item.mata_pelajaran
                        }
                      </span>

                      <div className="font-['Fraunces',serif] text-[21px] font-semibold tracking-[-0.01em] text-[#141C30]">
                        {item.kelas}
                      </div>

                      <div className="mt-[7px] space-y-1.5">
                        {sortedSchedules.length >
                        0 ? (
                          sortedSchedules.map(
                            (
                              schedule
                            ) => {
                              const scheduleIsToday =
                                normalizeDay(
                                  schedule.hari
                                ) ===
                                normalizedToday;

                              return (
                                <div
                                  key={
                                    schedule.id
                                  }
                                  className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[#6B7080]"
                                >
                                  <span
                                    className={
                                      scheduleIsToday
                                        ? 'font-bold text-[#4C7A5E]'
                                        : ''
                                    }
                                  >
                                    {
                                      schedule.hari
                                    }
                                  </span>

                                  {scheduleIsToday && (
                                    <span className="rounded-full bg-[#E7F0EA] px-2 py-0.5 text-[9.5px] font-bold text-[#4C7A5E]">
                                      Hari ini
                                    </span>
                                  )}

                                  <span>
                                    •
                                  </span>

                                  <span>
                                    {
                                      schedule.waktu
                                    }
                                  </span>
                                </div>
                              );
                            }
                          )
                        ) : (
                          <div className="flex items-center gap-2 text-[12px] text-[#6B7080]">
                            <CalendarDays
                              size={13}
                            />

                            Jadwal belum tersedia
                          </div>
                        )}
                      </div>
                    </div>

                    {/* STAT CARD */}

                    <div className="px-[22px] pb-1 pt-4">
                      <div className="mb-4 grid grid-cols-3 gap-2.5">

                        <div className="rounded-[10px] border border-[#E3DACB] bg-[#FBF9F3] px-3 py-2.5 text-left">
                          <div className="font-['Fraunces',serif] text-[18px] font-semibold leading-none text-[#141C30]">
                            {
                              totalMeetings
                            }
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
                            remainingMeetings >
                            0
                              ? 'border-[#E4BCA9] bg-[#F6E1D9]'
                              : 'border-[#E3DACB] bg-[#FBF9F3]'
                          }`}
                        >
                          <div
                            className={`font-['Fraunces',serif] text-[18px] font-semibold leading-none ${
                              remainingMeetings >
                              0
                                ? 'text-[#A8503B]'
                                : 'text-[#141C30]'
                            }`}
                          >
                            {
                              remainingMeetings
                            }
                          </div>

                          <div className="mt-1 text-[10.5px] text-[#6B7080]">
                            Belum diisi
                          </div>
                        </div>
                      </div>

                      {/* PERTEMUAN TERAKHIR */}

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
                                {
                                  latestDate.day
                                }
                              </div>

                              <div className="mt-0.5 text-[9.5px] lowercase text-[#6B7080]">
                                {
                                  latestDate.month
                                }
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
                                {filled >
                                0
                                  ? 'Masih terdapat sesi yang belum memiliki jurnal pada minggu ini.'
                                  : 'Materi dan presensi belum diisi untuk pertemuan ini.'}
                              </div>

                              <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#A8503B]">
                                <Clock3
                                  size={12}
                                />

                                {
                                  remainingMeetings
                                }{' '}
                                sesi belum diisi
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

                    {/* PROGRESS */}

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

                    {/* WARNING */}

                    {showUnavailableWarning && (
                      <div className="mx-[22px] mt-[14px] flex items-start gap-2.5 rounded-[10px] border border-[#E3DACB] bg-[#F3F0E8] px-3.5 py-3 text-[11.5px] leading-5 text-[#6B7080]">
                        <TriangleAlert
                          size={15}
                          className="mt-0.5 shrink-0 text-[#A8503B]"
                        />

                        <div>
                          <div className="font-bold text-[#A8503B]">
                            Kelas belum dapat dimulai
                          </div>

                          <div className="mt-0.5">
                            Tombol mulai kelas hanya dapat digunakan pada hari sesuai jadwal mengajar, yaitu{' '}
                            <span className="font-bold text-[#23283A]">
                              {(
                                item.jadwal ??
                                []
                              )
                                .map(
                                  (
                                    schedule
                                  ) =>
                                    schedule.hari
                                )
                                .join(
                                  ' dan '
                                )}
                            </span>
                            .
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setUnavailableWarningId(
                              null
                            )
                          }
                          className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#6B7080] transition hover:bg-white hover:text-[#23283A]"
                          aria-label="Tutup peringatan"
                        >
                          <X
                            size={13}
                          />
                        </button>
                      </div>
                    )}

                    {/* BUTTONS */}

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
                        aria-disabled={
                          !isToday
                        }
                        className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[9px] border px-2 py-2.5 text-[12.5px] font-bold transition ${
                          !isToday
                            ? 'cursor-not-allowed border-[#D5D1C8] bg-[#D5D1C8] text-[#8A8E9A]'
                            : isPending
                              ? 'border-[#A8503B] bg-[#A8503B] text-white hover:bg-[#8F4331]'
                              : 'border-[#1E2A47] bg-[#1E2A47] text-white hover:bg-[#141C30]'
                        }`}
                      >
                        <Play
                          size={14}
                          strokeWidth={1.9}
                          fill="currentColor"
                        />

                        {!isToday
                          ? 'Belum waktunya'
                          : isPending
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

      {/* =========================================================
          MODAL MULAI KELAS
      ========================================================== */}

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

            {/* HEADER */}

            <div className="flex items-start justify-between border-b border-[#E3DACB] px-5 py-4 md:px-6">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#6B7080]">
                  Pertemuan baru
                </div>

                <h2 className="mt-1 font-['Fraunces',serif] text-[22px] font-semibold text-[#141C30]">
                  Mulai kelas
                </h2>

                {scheduleDetail?.schedule ? (
                  <div className="mt-1 text-[12.5px] text-[#6B7080]">
                    <span className="font-semibold text-[#23283A]">
                      {
                        scheduleDetail
                          .schedule
                          .mata_pelajaran
                      }
                    </span>

                    <span className="mx-1.5">
                      •
                    </span>

                    {
                      scheduleDetail
                        .schedule
                        .kelas
                    }

                    <span className="mx-1.5">
                      •
                    </span>

                    {
                      scheduleDetail
                        .schedule
                        .hari
                    }
                    ,{' '}
                    {
                      scheduleDetail
                        .schedule
                        .waktu
                    }
                  </div>
                ) : selectedSchedule ? (
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
                  </div>
                ) : null}
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

            {/* BODY */}

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

                  {/* TANGGAL */}

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

                  {/* TOPIK */}

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

                  {/* DESKRIPSI */}

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

                  {/* PRESENSI */}

                  <div>
                    <div className="mb-2.5 flex items-center justify-between">
                      <div>
                        <div className="text-[13px] font-bold text-[#23283A]">
                          Presensi siswa
                        </div>

                        <div className="mt-0.5 text-[11.5px] text-[#6B7080]">
                          Tentukan status kehadiran setiap siswa dan tambahkan keterangan bila diperlukan.
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
                              <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
                                <div className="flex min-w-0 items-center gap-2.5 xl:min-w-[180px]">
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

                                <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                                  <div className="grid shrink-0 grid-cols-5 gap-1">
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

                                  <input
                                    type="text"
                                    value={
                                      student.notes
                                    }
                                    onChange={(
                                      event
                                    ) =>
                                      changeAttendanceNotes(
                                        student.id,
                                        event
                                          .target
                                          .value
                                      )
                                    }
                                    disabled={
                                      saving
                                    }
                                    maxLength={
                                      255
                                    }
                                    placeholder="Masukkan keterangan..."
                                    aria-label={`Keterangan ${student.nama}`}
                                    className="h-[32px] min-w-0 flex-1 rounded-full border border-[#E3DACB] bg-[#FFFDF8] px-3 text-[10.5px] text-[#23283A] outline-none transition placeholder:text-[#9A9DA7] focus:border-[#B98A3E] sm:max-w-[190px]"
                                  />
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

            {/* FOOTER */}

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

      {/* =========================================================
          MODAL RIWAYAT JURNAL
      ========================================================== */}

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

            {/* =====================================================
                HISTORY HEADER
            ====================================================== */}

            <div className="border-b border-[#E3DACB] px-5 py-4 md:px-6">

              <div className="flex items-start justify-between">
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

              {/* =================================================
                  MONTH & YEAR FILTER
              ================================================== */}

              {!loadingHistory &&
                !historyError && (
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">

                    {/* BULAN */}

                    <div className="relative flex-1">
                      <CalendarDays
                        size={15}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7080]"
                      />

                      <select
                        value={
                          historyMonth
                        }
                        onChange={(
                          event
                        ) =>
                          handleHistoryMonthChange(
                            Number(
                              event
                                .target
                                .value
                            )
                          )
                        }
                        className="h-[40px] w-full appearance-none rounded-[10px] border border-[#E3DACB] bg-[#FFFDF8] py-2 pl-9 pr-9 text-[12.5px] font-semibold text-[#23283A] outline-none transition focus:border-[#B98A3E]"
                      >
                        {Array.from(
                          {
                            length: 12,
                          },
                          (
                            _,
                            index
                          ) => {
                            const month =
                              index +
                              1;

                            return (
                              <option
                                key={
                                  month
                                }
                                value={
                                  month
                                }
                              >
                                {getMonthName(
                                  month
                                )}
                              </option>
                            );
                          }
                        )}
                      </select>

                      <ChevronDown
                        size={14}
                        strokeWidth={1.9}
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7080]"
                      />
                    </div>

                    {/* TAHUN */}

                    <div className="relative flex-1">
                      <select
                        value={
                          historyYear
                        }
                        onChange={(
                          event
                        ) =>
                          handleHistoryYearChange(
                            Number(
                              event
                                .target
                                .value
                            )
                          )
                        }
                        className="h-[40px] w-full appearance-none rounded-[10px] border border-[#E3DACB] bg-[#FFFDF8] py-2 pl-3 pr-9 text-[12.5px] font-semibold text-[#23283A] outline-none transition focus:border-[#B98A3E]"
                      >
                        {historyYears.map(
                          (
                            year
                          ) => (
                            <option
                              key={
                                year
                              }
                              value={
                                year
                              }
                            >
                              {year}
                            </option>
                          )
                        )}
                      </select>

                      <ChevronDown
                        size={14}
                        strokeWidth={1.9}
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7080]"
                      />
                    </div>
                  </div>
                )}

              {/* =================================================
                  WEEK NAVIGATION HEADER
              ================================================== */}

              {!loadingHistory &&
                !historyError &&
                historyWeeks.length >
                  0 && (
                  <div className="mt-4 flex items-center justify-between rounded-[10px] border border-[#E3DACB] bg-[#FBF9F3] px-3.5 py-2.5">

                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.04em] text-[#6B7080]">
                        Minggu{' '}
                        {Math.min(
                          historyWeekPage +
                            1,
                          historyWeeks.length
                        )}
                      </div>

                      {activeHistoryWeek && (
                        <div className="mt-0.5 text-[12px] font-semibold text-[#23283A]">
                          {formatWeekRange(
                            activeHistoryWeek
                          )}
                        </div>
                      )}
                    </div>

                    <div className="rounded-full bg-[#E7ECF4] px-2.5 py-1 text-[10.5px] font-bold text-[#1E2A47]">
                      {getMonthName(
                        historyMonth
                      )}{' '}
                      {historyYear}
                    </div>
                  </div>
                )}
            </div>

            {/* =====================================================
                HISTORY BODY
            ====================================================== */}

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
              ) : historyMonthItems.length ===
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

                  <p className="mx-auto mt-1.5 max-w-[380px] text-[12px] leading-5 text-[#6B7080]">
                    Tidak terdapat jurnal pembelajaran pada{' '}
                    <span className="font-semibold text-[#23283A]">
                      {getMonthName(
                        historyMonth
                      )}{' '}
                      {historyYear}
                    </span>
                    .
                  </p>
                </div>
              ) : activeHistoryWeek &&
                activeHistoryWeek.items
                  .length === 0 ? (
                <div className="py-12 text-center">

                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#E7ECF4] text-[#1E2A47]">
                    <CalendarDays
                      size={22}
                    />
                  </div>

                  <h3 className="mt-3 font-['Fraunces',serif] text-[18px] font-semibold text-[#141C30]">
                    Belum ada jurnal minggu ini
                  </h3>

                  <p className="mx-auto mt-1.5 max-w-[380px] text-[12px] leading-5 text-[#6B7080]">
                    Tidak terdapat jurnal pada{' '}
                    <span className="font-semibold text-[#23283A]">
                      {formatWeekRange(
                        activeHistoryWeek
                      )}
                    </span>
                    .
                  </p>
                </div>
              ) : activeHistoryWeek ? (
                <div className="space-y-3">

                  {activeHistoryWeek.items.map(
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
                          className={`flex gap-3 rounded-xl border p-3.5 ${
                            history.is_holiday
                              ? 'border-[#E6C96A] bg-[#FFF4C7]'
                              : 'border-[#E3DACB] bg-[#FBF9F3]'
                          }`}
                        >

                          {/* DATE */}

                          <div
                            className={`w-11 shrink-0 self-start rounded-[9px] border px-0 py-[7px] text-center ${
                              history.is_holiday
                                ? 'border-[#E6C96A] bg-[#FFF9E6]'
                                : 'border-[#E3DACB] bg-white'
                            }`}
                          >
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

                          {/* CONTENT */}

                          <div className="min-w-0 flex-1">

                            <div
                              className={`text-[10.5px] font-bold uppercase tracking-[0.03em] ${
                                history.is_holiday
                                  ? 'text-[#9A7414]'
                                  : 'text-[#6B7080]'
                              }`}
                            >
                              {formatLongDate(
                                history.tanggal
                              )}
                            </div>

                            {history.is_holiday && (
                              <div className="mt-1.5 inline-flex items-center rounded-full border border-[#E6C96A] bg-[#FFF9E6] px-2 py-0.5 text-[9.5px] font-bold text-[#9A7414]">
                                Hari Libur Nasional
                              </div>
                            )}

                            <div className="mt-1 text-[13px] font-semibold leading-5 text-[#23283A]">
                              {history.is_holiday
                                ? 'Hari Libur Nasional'
                                : history.topic}
                            </div>

                            {(history.is_holiday
                              ? history.holiday_name || history.description
                              : history.description) && (
                              <div
                                className={`mt-1.5 text-[11.5px] leading-5 ${
                                  history.is_holiday
                                    ? 'font-medium text-[#7A6118]'
                                    : 'text-[#6B7080]'
                                }`}
                              >
                                {history.is_holiday
                                  ? history.holiday_name || history.description
                                  : history.description}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              ) : null}
            </div>

            {/* =====================================================
                HISTORY FOOTER
            ====================================================== */}

            <div className="border-t border-[#E3DACB] bg-[#FBF9F3] px-5 py-4 md:px-6">

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                {/* PAGINATION */}

                {!loadingHistory &&
                !historyError &&
                historyWeeks.length >
                  0 ? (
                  <div className="flex items-center gap-2">

                    <button
                      type="button"
                      onClick={() =>
                        setHistoryWeekPage(
                          (
                            current
                          ) =>
                            Math.max(
                              current -
                                1,
                              0
                            )
                        )
                      }
                      disabled={
                        !canGoPreviousHistoryWeek
                      }
                      className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-[#E3DACB] bg-[#FFFDF8] text-[#1E2A47] transition hover:border-[#B98A3E] hover:bg-[#F0EBDB] disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Minggu sebelumnya"
                    >
                      <ChevronLeft
                        size={16}
                        strokeWidth={2}
                      />
                    </button>

                    <div className="min-w-[120px] text-center">
                      <div className="text-[11px] font-bold text-[#6B7080]">
                        Minggu{' '}
                        {Math.min(
                          historyWeekPage +
                            1,
                          historyWeeks.length
                        )}
                      </div>

                      <div className="mt-0.5 text-[10px] text-[#8A8E9A]">
                        dari{' '}
                        {
                          historyWeeks.length
                        }
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setHistoryWeekPage(
                          (
                            current
                          ) =>
                            Math.min(
                              current +
                                1,
                              historyWeeks.length -
                                1
                            )
                        )
                      }
                      disabled={
                        !canGoNextHistoryWeek
                      }
                      className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-[#E3DACB] bg-[#FFFDF8] text-[#1E2A47] transition hover:border-[#B98A3E] hover:bg-[#F0EBDB] disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Minggu berikutnya"
                    >
                      <ChevronRight
                        size={16}
                        strokeWidth={2}
                      />
                    </button>
                  </div>
                ) : (
                  <div />
                )}

                {/* CLOSE */}

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
        </div>
      )}
    </JurnalMengajarLayout>
  );
}