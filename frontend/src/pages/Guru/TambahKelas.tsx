import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import type {
  FormEvent,
  MouseEvent,
} from 'react';

import {
  useNavigate,
} from 'react-router-dom';

import api from '../../api/axios';

import {
  KelasSayaLayout,
} from '../../layouts/Guru/KelasSayaLayout';

interface Classroom {
  id: number;
  name: string;
  archived: boolean;
}

interface Subject {
  id: number;
  name: string;
}

interface ScheduleSelection {
  day: string;
  start_time: string;
  end_time: string;
}

interface OccupiedSchedule {
  id?: number;
  teacher_id: number;
  classroom_id: number;
  subject_id?: number;
  day: string;
  start_time: string;
  end_time: string;
  is_mine?: boolean;
}

const DAYS = [
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
];

const SCHOOL_START_HOUR = 7;
const SCHOOL_END_HOUR = 16;
const SLOT_MINUTES = 45;

const generateTimeSlots = (): string[] => {
  const slots: string[] = [];

  const startMinutes =
    SCHOOL_START_HOUR * 60;

  const endMinutes =
    SCHOOL_END_HOUR * 60;

  for (
    let minutes = startMinutes;
    minutes < endMinutes;
    minutes += SLOT_MINUTES
  ) {
    const hour =
      Math.floor(minutes / 60);

    const minute =
      minutes % 60;

    slots.push(
      `${String(hour).padStart(2, '0')}:${String(
        minute
      ).padStart(2, '0')}`
    );
  }

  return slots;
};

const TIME_SLOTS =
  generateTimeSlots();

const timeToMinutes = (
  time: string
): number => {
  const [
    hour,
    minute,
  ] = time
    .slice(0, 5)
    .split(':')
    .map(Number);

  return hour * 60 + minute;
};

const minutesToTime = (
  minutes: number
): string => {
  const hour =
    Math.floor(minutes / 60);

  const minute =
    minutes % 60;

  return `${String(hour).padStart(
    2,
    '0'
  )}:${String(minute).padStart(
    2,
    '0'
  )}`;
};

const getEndTime = (
  startTime: string,
  slotCount: number
): string => {
  return minutesToTime(
    timeToMinutes(startTime) +
      slotCount * SLOT_MINUTES
  );
};

const formatTime = (
  time: string
): string => {
  return time.slice(0, 5);
};

export default function TambahKelas() {
  const navigate = useNavigate();

  const [
    classrooms,
    setClassrooms,
  ] = useState<Classroom[]>([]);

  const [
    subjects,
    setSubjects,
  ] = useState<Subject[]>([]);

  const [
    occupiedSchedules,
    setOccupiedSchedules,
  ] = useState<OccupiedSchedule[]>([]);

  const [
    classroomId,
    setClassroomId,
  ] = useState('');

  const [
    selectedSubjectId,
    setSelectedSubjectId,
  ] = useState('');

  const [
    isAdditionalClass,
    setIsAdditionalClass,
  ] = useState(false);

  const [
    selectedSlots,
    setSelectedSlots,
  ] = useState<
    Record<string, string[]>
  >({});

  const [
    loadingData,
    setLoadingData,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState('');

  const [
    success,
    setSuccess,
  ] = useState('');

  const [
    hoveredOccupiedSlot,
    setHoveredOccupiedSlot,
  ] = useState<{
    day: string;
    time: string;
    type: 'own' | 'other';
  } | null>(null);

  const [
    mousePosition,
    setMousePosition,
  ] = useState({
    x: 0,
    y: 0,
  });

  /*
   * ============================================================
   * DATA GURU
   * ============================================================
   */

  const storedUser =
    localStorage.getItem('user');

  let user: {
    id?: number;
    name?: string;
  } = {
    name: 'Guru',
  };

  if (storedUser) {
    try {
      user = JSON.parse(
        storedUser
      );
    } catch {
      user = {
        name: 'Guru',
      };
    }
  }

  const currentUserId =
    Number(user.id || 0);

  const namaGuru =
    user.name || 'Guru';

  const getInitials = (
    name: string
  ) => {
    if (!name) return 'GR';

    return name
      .split(' ')
      .map((item) => item[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  /*
   * ============================================================
   * LOAD DATA
   * ============================================================
   */

  useEffect(() => {
    const loadData =
      async () => {
        try {
          setLoadingData(true);
          setError('');

          const [
            classroomResponse,
            subjectResponse,
            occupiedResponse,
          ] = await Promise.all([
            api.get('/classrooms'),

            api.get(
              '/guru/mata-pelajaran'
            ),

            api.get(
              '/guru/jadwal-terpakai'
            ),
          ]);

          setClassrooms(
            classroomResponse.data.data ||
              []
          );

          setSubjects(
            subjectResponse.data.data ||
              []
          );

          setOccupiedSchedules(
            occupiedResponse.data.data ||
              []
          );
        } catch (err: any) {
          console.error(err);

          setError(
            err?.response?.data?.message ||
              'Gagal memuat data kelas dan jadwal.'
          );
        } finally {
          setLoadingData(false);
        }
      };

    loadData();
  }, []);

  /*
   * ============================================================
   * KELAS AKTIF
   * ============================================================
   *
   * Kelas yang sudah diarsipkan tidak boleh digunakan
   * untuk membuat jadwal baru.
   */

  const activeClassrooms =
    useMemo(() => {
      return classrooms.filter(
        (classroom) =>
          classroom.archived !== true
      );
    }, [classrooms]);

  /*
   * ============================================================
   * MATA PELAJARAN UTAMA
   * ============================================================
   */

  const mainSubject =
    subjects.length > 0
      ? subjects[0]
      : null;

  /*
   * ============================================================
   * MATA PELAJARAN TAMBAHAN
   * ============================================================
   */

  const additionalSubjects =
    useMemo(() => {
      if (!mainSubject) {
        return subjects;
      }

      return subjects.filter(
        (subject) =>
          subject.id !==
          mainSubject.id
      );
    }, [
      subjects,
      mainSubject,
    ]);

  /*
   * ============================================================
   * RESET SAAT MODE BERUBAH
   * ============================================================
   */

  useEffect(() => {
    setSelectedSlots({});

    if (isAdditionalClass) {
      setSelectedSubjectId('');
    } else {
      setSelectedSubjectId(
        mainSubject
          ? String(mainSubject.id)
          : ''
      );
    }
  }, [
    isAdditionalClass,
    mainSubject,
  ]);

  /*
   * ============================================================
   * CARI JADWAL YANG BERTABRAKAN DENGAN SLOT
   * ============================================================
   *
   * Logika:
   *
   * 1. Jadwal guru sendiri:
   *    selalu dianggap terpakai.
   *
   * 2. Jadwal guru lain:
   *    hanya dianggap terpakai apabila
   *    berada di kelas yang sedang dipilih.
   *
   * Jadi guru lain yang sedang mengajar
   * kelas berbeda pada jam yang sama tidak
   * membuat slot menjadi merah.
   */

  const getOccupiedSchedule = (
    day: string,
    time: string
  ): OccupiedSchedule | null => {
    const slotStart =
      timeToMinutes(time);

    const slotEnd =
      slotStart + SLOT_MINUTES;

    const selectedClassroomId =
      Number(classroomId);

    const schedule =
      occupiedSchedules.find(
        (item) => {
          if (
            item.day !== day
          ) {
            return false;
          }

          const scheduleStart =
            timeToMinutes(
              item.start_time
            );

          const scheduleEnd =
            timeToMinutes(
              item.end_time
            );

          const overlaps =
            scheduleStart < slotEnd &&
            scheduleEnd > slotStart;

          if (!overlaps) {
            return false;
          }

          /*
           * Jadwal guru sendiri.
           */
          if (
            Number(item.teacher_id) ===
            currentUserId
          ) {
            return true;
          }

          /*
           * Jadwal guru lain.
           *
           * Hanya blokir jika kelasnya
           * sama dengan kelas yang dipilih.
           */
          return (
            Number(item.classroom_id) ===
            selectedClassroomId
          );
        }
      );

    return schedule || null;
  };

  /*
   * ============================================================
   * CEK JADWAL TERPAKAI
   * ============================================================
   */

  const isSlotOccupied = (
    day: string,
    time: string
  ): boolean => {
    return (
      getOccupiedSchedule(
        day,
        time
      ) !== null
    );
  };

  /*
   * ============================================================
   * CEK JADWAL MILIK GURU SENDIRI
   * ============================================================
   */

  const isOwnSchedule = (
    day: string,
    time: string
  ): boolean => {
    const schedule =
      getOccupiedSchedule(
        day,
        time
      );

    if (!schedule) {
      return false;
    }

    return (
      Number(schedule.teacher_id) ===
      currentUserId
    );
  };

  /*
   * ============================================================
   * CEK JADWAL GURU LAIN
   * ============================================================
   */

  const isOtherTeacherSchedule = (
    day: string,
    time: string
  ): boolean => {
    const schedule =
      getOccupiedSchedule(
        day,
        time
      );

    if (!schedule) {
      return false;
    }

    return (
      Number(schedule.teacher_id) !==
      currentUserId
    );
  };

  /*
   * ============================================================
   * CEK SLOT TERPILIH
   * ============================================================
   */

  const isSlotSelected = (
    day: string,
    time: string
  ): boolean => {
    return (
      selectedSlots[day]?.includes(
        time
      ) ?? false
    );
  };

  /*
   * ============================================================
   * PILIH / BATAL SLOT
   * ============================================================
   */

  const toggleSlot = (
    day: string,
    time: string
  ) => {
    /*
     * Slot yang sudah terpakai
     * tidak dapat dipilih.
     */
    if (
      isSlotOccupied(
        day,
        time
      )
    ) {
      return;
    }

    setError('');
    setSuccess('');

    setSelectedSlots(
      (previous) => {
        const current =
          previous[day] || [];

        const exists =
          current.includes(time);

        if (exists) {
          return {
            ...previous,
            [day]: current.filter(
              (item) =>
                item !== time
            ),
          };
        }

        return {
          ...previous,
          [day]: [
            ...current,
            time,
          ].sort(
            (a, b) =>
              timeToMinutes(a) -
              timeToMinutes(b)
          ),
        };
      }
    );
  };

  /*
   * ============================================================
   * GABUNGKAN SLOT MENJADI BLOK JADWAL
   * ============================================================
   */

  const buildSchedules =
    (): ScheduleSelection[] => {
      const schedules:
        ScheduleSelection[] = [];

      DAYS.forEach((day) => {
        const slots =
          selectedSlots[day] || [];

        if (
          slots.length === 0
        ) {
          return;
        }

        const sortedSlots =
          [...slots].sort(
            (a, b) =>
              timeToMinutes(a) -
              timeToMinutes(b)
          );

        let blockStart =
          sortedSlots[0];

        let previousStart =
          timeToMinutes(
            sortedSlots[0]
          );

        for (
          let i = 1;
          i < sortedSlots.length;
          i++
        ) {
          const currentStart =
            timeToMinutes(
              sortedSlots[i]
            );

          const expectedNext =
            previousStart +
            SLOT_MINUTES;

          if (
            currentStart ===
            expectedNext
          ) {
            previousStart =
              currentStart;

            continue;
          }

          schedules.push({
            day,
            start_time:
              blockStart,
            end_time:
              minutesToTime(
                previousStart +
                  SLOT_MINUTES
              ),
          });

          blockStart =
            sortedSlots[i];

          previousStart =
            currentStart;
        }

        schedules.push({
          day,
          start_time:
            blockStart,
          end_time:
            minutesToTime(
              previousStart +
                SLOT_MINUTES
            ),
        });
      });

      return schedules;
    };

  const schedules =
    useMemo(
      () => buildSchedules(),
      [selectedSlots]
    );

  /*
   * ============================================================
   * TOTAL JP
   * ============================================================
   */

  const selectedSlotCount =
    Object.values(
      selectedSlots
    ).reduce(
      (total, slots) =>
        total + slots.length,
      0
    );

  /*
   * ============================================================
   * KELAS YANG DIPILIH
   * ============================================================
   */

  const selectedClassroom =
    classrooms.find(
      (classroom) =>
        String(classroom.id) ===
        classroomId
    );

  /*
   * ============================================================
   * SUBJECT AKTIF
   * ============================================================
   */

  const selectedSubject =
    subjects.find(
      (subject) =>
        String(subject.id) ===
        selectedSubjectId
    );

  /*
   * ============================================================
   * SUBMIT
   * ============================================================
   */

  const handleSubmit = async (
    event: FormEvent
  ) => {
    event.preventDefault();

    setError('');
    setSuccess('');

    /*
     * Validasi kelas.
     */
    if (!classroomId) {
      setError(
        'Silakan pilih kelas terlebih dahulu.'
      );

      return;
    }

    /*
     * Pastikan kelas benar-benar tersedia.
     */
    const classroom =
      classrooms.find(
        (item) =>
          String(item.id) ===
          classroomId
      );

    if (!classroom) {
      setError(
        'Kelas yang dipilih tidak ditemukan.'
      );

      return;
    }

    /*
     * Kelas arsip tidak boleh digunakan.
     */
    if (classroom.archived) {
      setError(
        'Kelas tersebut sudah diarsipkan. Silakan pulihkan kelas terlebih dahulu.'
      );

      return;
    }

    /*
     * Pastikan kelas masih termasuk
     * kelas aktif.
     */
    const isActiveClassroom =
      activeClassrooms.some(
        (item) =>
          item.id ===
          classroom.id
      );

    if (!isActiveClassroom) {
      setError(
        'Kelas yang dipilih tidak dapat digunakan.'
      );

      return;
    }

    /*
     * Validasi mata pelajaran.
     */
    if (!selectedSubjectId) {
      setError(
        'Silakan pilih mata pelajaran.'
      );

      return;
    }

    /*
     * Validasi jadwal.
     */
    if (
      schedules.length === 0
    ) {
      setError(
        'Silakan pilih minimal satu jam pelajaran.'
      );

      return;
    }

    /*
     * Cek ulang slot yang terpakai.
     */
    const hasOccupiedSelection =
      Object.entries(
        selectedSlots
      ).some(
        ([day, slots]) =>
          slots.some(
            (time) =>
              isSlotOccupied(
                day,
                time
              )
          )
      );

    if (
      hasOccupiedSelection
    ) {
      setError(
        'Ada jam yang sudah digunakan. Silakan pilih jam lain.'
      );

      return;
    }

    try {
      setSaving(true);

      const payload: {
        classroom_id: number;
        schedules: ScheduleSelection[];
        subject_id?: number;
      } = {
        classroom_id:
          Number(classroomId),

        schedules,
      };

      /*
       * Jika mode kelas tambahan,
       * kirim subject_id yang dipilih.
       *
       * Jika mode utama, backend akan
       * menggunakan mata pelajaran utama.
       */
      if (
        isAdditionalClass
      ) {
        payload.subject_id =
          Number(
            selectedSubjectId
          );
      }

      await api.post(
        '/guru/kelas',
        payload
      );

      setSuccess(
        'Jadwal kelas berhasil ditambahkan.'
      );

      setTimeout(() => {
        navigate(
          '/guru/kelas-saya'
        );
      }, 800);
    } catch (err: any) {
      console.error(err);

      setError(
        err?.response?.data?.message ||
          'Gagal menambahkan jadwal kelas.'
      );
    } finally {
      setSaving(false);
    }
  };

  /*
   * ============================================================
   * TOOLTIP
   * ============================================================
   */

  const handleOccupiedMouseEnter = (
    event: MouseEvent,
    day: string,
    time: string
  ) => {
    const own =
      isOwnSchedule(
        day,
        time
      );

    setHoveredOccupiedSlot({
      day,
      time,
      type: own
        ? 'own'
        : 'other',
    });

    setMousePosition({
      x: event.clientX,
      y: event.clientY,
    });
  };

  const handleOccupiedMouseMove = (
    event: MouseEvent
  ) => {
    setMousePosition({
      x: event.clientX,
      y: event.clientY,
    });
  };

  const handleOccupiedMouseLeave =
    () => {
      setHoveredOccupiedSlot(
        null
      );
    };

  /*
   * ============================================================
   * LOADING
   * ============================================================
   */

  if (loadingData) {
    return (
      <KelasSayaLayout
        namaGuru={namaGuru}
        mapelGuru={
          mainSubject?.name ||
          'Guru Mata Pelajaran'
        }
        getInitials={getInitials}
      >
        <div className="flex min-h-[65vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[#E3DACB] border-t-[#1E2A47]" />

            <div className="font-semibold text-[#1E2A47]">
              Memuat data jadwal...
            </div>

            <div className="mt-1 text-[12px] text-[#8A8F9D]">
              Menyiapkan kelas dan kalender
              mengajar Anda.
            </div>
          </div>
        </div>
      </KelasSayaLayout>
    );
  }

  /*
   * ============================================================
   * MAIN
   * ============================================================
   */

  return (
    <KelasSayaLayout
      namaGuru={namaGuru}
      mapelGuru={
        mainSubject?.name ||
        'Guru Mata Pelajaran'
      }
      getInitials={getInitials}
    >
      <div className="animate-[rise_0.5s_ease_both]">

        {/* =====================================================
            HEADER
            ===================================================== */}

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <button
              type="button"
              onClick={() =>
                navigate(
                  '/guru/kelas-saya'
                )
              }
              className="mb-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#777B88] transition hover:text-[#1E2A47]"
            >
              <span className="text-[15px]">
                ←
              </span>

              Kembali ke Kelas Saya
            </button>

            <div className="text-[13px] text-[#6B7080]">
              Semester ganjil 2026/2027
            </div>

            <h1 className="mt-0.5 font-['Fraunces',serif] text-[27px] font-semibold tracking-[-0.01em] text-[#141C30]">
              Tambah kelas
            </h1>

            <p className="mt-1 max-w-[680px] text-[13px] leading-6 text-[#777B88]">
              Atur kelas dan jadwal mengajar
              Anda untuk semester ini.
            </p>
          </div>

          {/* TOTAL JP */}

          <div className="flex items-center gap-3 rounded-[13px] border border-[#E3DACB] bg-[#FFFDF8] px-4 py-3 shadow-[0_1px_2px_rgba(30,25,15,0.04)]">
            <div className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-[#E7ECF4] text-[#1E2A47]">
              <svg
                width="17"
                height="17"
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

                <path d="M12 7v5l3 2" />
              </svg>
            </div>

            <div>
              <div className="text-[10.5px] text-[#8A8F9D]">
                Jam dipilih
              </div>

              <div className="font-['Fraunces',serif] text-[20px] font-semibold leading-none text-[#141C30]">
                {selectedSlotCount}{' '}

                <span className="font-sans text-[11px] font-semibold text-[#6B7080]">
                  JP
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* =====================================================
            ERROR
            ===================================================== */}

        {error && (
          <div className="mb-5 flex gap-3 rounded-[12px] border border-[#E8B8AA] bg-[#FFF4F0] px-4 py-3">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#F5E6DF] text-[13px]">
              ⚠
            </div>

            <div>
              <div className="text-[12px] font-semibold text-[#AE5A3E]">
                Perhatian
              </div>

              <div className="mt-0.5 text-[12px] leading-5 text-[#8D5A50]">
                {error}
              </div>
            </div>
          </div>
        )}

        {/* =====================================================
            SUCCESS
            ===================================================== */}

        {success && (
          <div className="mb-5 flex gap-3 rounded-[12px] border border-[#BFD8C4] bg-[#F2F9F3] px-4 py-3">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#E2F0E5] text-[13px]">
              ✓
            </div>

            <div>
              <div className="text-[12px] font-semibold text-[#477653]">
                Berhasil
              </div>

              <div className="mt-0.5 text-[12px] leading-5 text-[#5B7660]">
                {success}
              </div>
            </div>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
        >

          {/* =====================================================
              INFORMASI KELAS
              ===================================================== */}

          <section className="mb-5 rounded-[14px] border border-[#E3DACB] bg-[#FFFDF8] p-5 shadow-[0_1px_2px_rgba(30,25,15,0.04),0_8px_24px_-12px_rgba(30,25,15,0.08)]">

            <div className="mb-5 flex items-start gap-3">

              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[9px] bg-[#E7ECF4] text-[#1E2A47]">
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v18H6.5A2.5 2.5 0 0 1 4 18.5v-13z" />

                  <path d="M8 7h8M8 11h8M8 15h5" />
                </svg>
              </div>

              <div>
                <h2 className="font-['Fraunces',serif] text-[18px] font-semibold text-[#141C30]">
                  Informasi kelas
                </h2>

                <p className="mt-0.5 text-[11.5px] leading-5 text-[#8A8F9D]">
                  Tentukan kelas dan mata
                  pelajaran yang akan Anda
                  ajarkan.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

              {/* KELAS */}

              <div>
                <label className="mb-2 block text-[11.5px] font-semibold uppercase tracking-[0.04em] text-[#6B7080]">
                  Kelas
                </label>

                {activeClassrooms.length ===
                0 ? (
                  <div className="rounded-[10px] border border-[#E8B8AA] bg-[#FFF4F0] px-3.5 py-3">
                    <div className="text-[12px] font-semibold text-[#AE5A3E]">
                      Belum ada kelas aktif
                    </div>

                    <div className="mt-0.5 text-[10.5px] leading-4 text-[#8D5A50]">
                      Semua kelas Anda saat ini
                      berada di arsip. Pulihkan
                      kelas terlebih dahulu melalui
                      halaman Kelas Saya.
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <select
                      value={
                        classroomId
                      }
                      onChange={(
                        event
                      ) => {
                        setClassroomId(
                          event.target.value
                        );

                        setError('');
                        setSuccess('');

                        /*
                         * Jadwal yang dipilih sebelumnya
                         * tidak relevan jika kelas berubah.
                         */
                        setSelectedSlots({});
                      }}
                      className="w-full appearance-none rounded-[10px] border border-[#DED7CC] bg-[#FCFAF5] px-3.5 py-3 pr-10 text-[13px] font-semibold text-[#23283A] outline-none transition hover:border-[#C9B99F] focus:border-[#1E2A47] focus:bg-white focus:ring-2 focus:ring-[#1E2A47]/10"
                    >
                      <option value="">
                        Pilih kelas
                      </option>

                      {activeClassrooms.map(
                        (
                          classroom
                        ) => (
                          <option
                            key={
                              classroom.id
                            }
                            value={
                              classroom.id
                            }
                          >
                            {
                              classroom.name
                            }
                          </option>
                        )
                      )}
                    </select>

                    <svg
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#7E8290]"
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </div>
                )}

                {selectedClassroom &&
                  !selectedClassroom.archived && (
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-[#7B7F8B]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#4C7A5E]" />

                      Kelas{' '}

                      <span className="font-semibold text-[#303646]">
                        {
                          selectedClassroom.name
                        }
                      </span>{' '}

                      dipilih
                    </div>
                  )}
              </div>

              {/* SUBJECT */}

              <div>
                <label className="mb-2 block text-[11.5px] font-semibold uppercase tracking-[0.04em] text-[#6B7080]">
                  Mata pelajaran
                </label>

                {!isAdditionalClass ? (
                  <div className="flex min-h-[48px] items-center justify-between gap-3 rounded-[10px] border border-[#D8E0EE] bg-[#F5F7FB] px-3.5 py-2.5">

                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold text-[#1E2A47]">
                        {mainSubject
                          ? mainSubject.name
                          : 'Belum tersedia'}
                      </div>

                      <div className="mt-0.5 text-[10.5px] text-[#7D8699]">
                        Mata pelajaran utama
                      </div>
                    </div>

                    <span className="flex-shrink-0 rounded-full bg-[#E7ECF4] px-2.5 py-1 text-[10px] font-semibold text-[#1E2A47]">
                      Utama
                    </span>
                  </div>
                ) : (
                  <div className="relative">
                    <select
                      value={
                        selectedSubjectId
                      }
                      onChange={(
                        event
                      ) =>
                        setSelectedSubjectId(
                          event.target.value
                        )
                      }
                      className="w-full appearance-none rounded-[10px] border border-[#DED7CC] bg-[#FCFAF5] px-3.5 py-3 pr-10 text-[13px] font-semibold text-[#23283A] outline-none transition hover:border-[#C9B99F] focus:border-[#1E2A47] focus:bg-white focus:ring-2 focus:ring-[#1E2A47]/10"
                    >
                      <option value="">
                        Pilih mata pelajaran
                      </option>

                      {additionalSubjects.map(
                        (
                          subject
                        ) => (
                          <option
                            key={
                              subject.id
                            }
                            value={
                              subject.id
                            }
                          >
                            {
                              subject.name
                            }
                          </option>
                        )
                      )}
                    </select>

                    <svg
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#7E8290]"
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </div>
                )}
              </div>
            </div>

            {/* MODE */}

            <div className="mt-5 border-t border-[#EDE5D9] pt-5">

              <div className="mb-2.5 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-[#6B7080]">
                Jenis pengajaran
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">

                {/* UTAMA */}

                <button
                  type="button"
                  onClick={() => {
                    setIsAdditionalClass(
                      false
                    );

                    setError('');
                    setSuccess('');
                  }}
                  className={`group rounded-[11px] border p-3.5 text-left transition-all ${
                    !isAdditionalClass
                      ? 'border-[#1E2A47] bg-[#F3F5F9] shadow-[0_2px_8px_rgba(30,42,71,0.08)]'
                      : 'border-[#E3DACB] bg-[#FCFAF5] hover:border-[#C9B99F] hover:bg-white'
                  }`}
                >
                  <div className="flex items-start gap-3">

                    <div
                      className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[9px] ${
                        !isAdditionalClass
                          ? 'bg-[#1E2A47] text-white'
                          : 'bg-[#E7ECF4] text-[#1E2A47]'
                      }`}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v18H6.5A2.5 2.5 0 0 1 4 18.5v-13z" />

                        <path d="M8 8h8M8 12h8M8 16h5" />
                      </svg>
                    </div>

                    <div className="min-w-0 flex-1">

                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12.5px] font-semibold text-[#303646]">
                          Mata pelajaran utama
                        </span>

                        {!isAdditionalClass && (
                          <span className="text-[13px] font-bold text-[#1E2A47]">
                            ✓
                          </span>
                        )}
                      </div>

                      <div className="mt-0.5 text-[10.5px] leading-4 text-[#8A8F9D]">
                        Gunakan mata pelajaran
                        utama Anda.
                      </div>
                    </div>
                  </div>
                </button>

                {/* TAMBAHAN */}

                <button
                  type="button"
                  onClick={() => {
                    setIsAdditionalClass(
                      true
                    );

                    setError('');
                    setSuccess('');
                  }}
                  className={`group rounded-[11px] border p-3.5 text-left transition-all ${
                    isAdditionalClass
                      ? 'border-[#1E2A47] bg-[#F3F5F9] shadow-[0_2px_8px_rgba(30,42,71,0.08)]'
                      : 'border-[#E3DACB] bg-[#FCFAF5] hover:border-[#C9B99F] hover:bg-white'
                  }`}
                >
                  <div className="flex items-start gap-3">

                    <div
                      className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[9px] ${
                        isAdditionalClass
                          ? 'bg-[#1E2A47] text-white'
                          : 'bg-[#F5E6DF] text-[#AE5A3E]'
                      }`}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </div>

                    <div className="min-w-0 flex-1">

                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12.5px] font-semibold text-[#303646]">
                          Kelas tambahan
                        </span>

                        {isAdditionalClass && (
                          <span className="text-[13px] font-bold text-[#1E2A47]">
                            ✓
                          </span>
                        )}
                      </div>

                      <div className="mt-0.5 text-[10.5px] leading-4 text-[#8A8F9D]">
                        Pilih mata pelajaran
                        lain yang Anda ajarkan.
                      </div>
                    </div>
                  </div>
                </button>
              </div>

              {isAdditionalClass &&
                selectedSubject && (
                  <div className="mt-3 flex items-center gap-2 rounded-[10px] border border-[#D8E0EE] bg-[#F5F7FB] px-3.5 py-2.5">

                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#E7ECF4] text-[11px] font-bold text-[#1E2A47]">
                      ✓
                    </span>

                    <div className="text-[11px] text-[#6E778A]">
                      Mata pelajaran tambahan:{' '}

                      <span className="font-semibold text-[#35415A]">
                        {
                          selectedSubject.name
                        }
                      </span>
                    </div>
                  </div>
                )}
            </div>
          </section>

          {/* =====================================================
              CALENDAR
              ===================================================== */}

          <section className="rounded-[14px] border border-[#E3DACB] bg-[#FFFDF8] shadow-[0_1px_2px_rgba(30,25,15,0.04),0_8px_24px_-12px_rgba(30,25,15,0.08)]">

            {/* CALENDAR HEADER */}

            <div className="flex flex-col gap-4 border-b border-[#EDE5D9] p-5 sm:flex-row sm:items-center sm:justify-between">

              <div className="flex items-start gap-3">

                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[9px] bg-[#E7D3A8] text-[#7A5A20]">
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <rect
                      x="3"
                      y="4"
                      width="18"
                      height="17"
                      rx="2"
                    />

                    <path d="M8 2v4M16 2v4M3 10h18" />

                    <path d="M8 14h2M14 14h2M8 18h2" />
                  </svg>
                </div>

                <div>
                  <h2 className="font-['Fraunces',serif] text-[18px] font-semibold text-[#141C30]">
                    Jadwal mengajar
                  </h2>

                  <p className="mt-0.5 text-[11.5px] leading-5 text-[#8A8F9D]">
                    Pilih satu atau beberapa slot
                    waktu pada kalender.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start rounded-[10px] border border-[#E3DACB] bg-[#FCFAF5] px-3 py-2 sm:self-auto">

                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="text-[#6B7080]"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                  />

                  <path d="M12 7v5l3 2" />
                </svg>

                <div>
                  <div className="text-[9.5px] uppercase tracking-[0.05em] text-[#8A8F9D]">
                    Jam sekolah
                  </div>

                  <div className="text-[11.5px] font-semibold text-[#303646]">
                    07:00 — 16:00
                  </div>
                </div>
              </div>
            </div>

            {/* CALENDAR */}

            <div className="p-5">

              <div className="overflow-x-auto rounded-[12px] border border-[#E3DACB] bg-[#FCFAF5]">

                <div className="min-w-[1030px]">

                  {/* HEADER */}

                  <div
                    className="grid"
                    style={{
                      gridTemplateColumns:
                        '122px repeat(6, minmax(0, 1fr))',
                    }}
                  >

                    {/* HEADER WAKTU */}

                    <div className="flex items-center justify-center border-b border-r border-[#E3DACB] bg-[#F3EFE7] px-3 py-3">

                      <div className="text-center">

                        <div className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-[#8A8F9D]">
                          Jam Pelajaran
                        </div>

                        <div className="mt-0.5 text-[8.5px] text-[#A3A5AC]">
                          1 JP = 45 menit
                        </div>
                      </div>
                    </div>

                    {/* HEADER HARI */}

                    {DAYS.map(
                      (
                        day,
                        index
                      ) => (
                        <div
                          key={day}
                          className={`border-b border-[#E3DACB] bg-[#F3EFE7] px-2 py-3 text-center ${
                            index <
                            DAYS.length - 1
                              ? 'border-r'
                              : ''
                          }`}
                        >

                          <div className="text-[11.5px] font-semibold text-[#303646]">
                            {day}
                          </div>

                          <div className="mx-auto mt-1 h-0.5 w-5 rounded-full bg-[#D6CBB9]" />
                        </div>
                      )
                    )}
                  </div>

                  {/* ROWS */}

                  {TIME_SLOTS.map(
                    (
                      time,
                      slotIndex
                    ) => (
                      <div
                        key={time}
                        className="grid"
                        style={{
                          gridTemplateColumns:
                            '122px repeat(6, minmax(0, 1fr))',
                        }}
                      >

                        {/* JAM */}

                        <div className="flex min-h-[58px] items-center border-b border-r border-[#E8E1D6] bg-[#FBFAF7] px-3">

                          <div className="flex w-full items-center gap-2">

                            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[7px] bg-[#E7ECF4] text-[10px] font-bold text-[#1E2A47]">
                              {slotIndex + 1}
                            </div>

                            <div className="min-w-0">

                              <div className="text-[10.5px] font-bold leading-4 text-[#555A68]">
                                Jam ke-
                                {slotIndex + 1}
                              </div>

                              <div className="mt-0.5 whitespace-nowrap text-[9.5px] font-medium text-[#92959D]">
                                {formatTime(
                                  time
                                )}{' '}
                                —{' '}
                                {getEndTime(
                                  time,
                                  1
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* DAYS */}

                        {DAYS.map(
                          (
                            day,
                            dayIndex
                          ) => {

                            const selected =
                              isSlotSelected(
                                day,
                                time
                              );

                            const occupied =
                              isSlotOccupied(
                                day,
                                time
                              );

                            const ownSchedule =
                              isOwnSchedule(
                                day,
                                time
                              );

                            const otherTeacher =
                              isOtherTeacherSchedule(
                                day,
                                time
                              );

                            /*
                             * Warna background.
                             */
                            let slotClass =
                              'bg-[#FFFDF8] hover:bg-[#F5F1E9]';

                            if (
                              selected
                            ) {
                              slotClass =
                                'bg-[#1E2A47] hover:bg-[#141C30]';
                            } else if (
                              ownSchedule
                            ) {
                              slotClass =
                                'bg-[#DCEBFA]';
                            } else if (
                              otherTeacher
                            ) {
                              slotClass =
                                'bg-[#F9D8D4]';
                            }

                            return (
                              <div
                                key={`${day}-${time}`}
                                className={`relative border-b border-[#E8E1D6] ${
                                  dayIndex <
                                  DAYS.length - 1
                                    ? 'border-r'
                                    : ''
                                }`}
                              >

                                <button
                                  type="button"
                                  disabled={
                                    occupied
                                  }
                                  aria-label={
                                    ownSchedule
                                      ? `${day} ${time}, jadwal Anda`
                                      : otherTeacher
                                        ? `${day} ${time}, digunakan guru lain`
                                        : `${day} ${time}`
                                  }
                                  aria-pressed={
                                    selected
                                  }
                                  onClick={() =>
                                    toggleSlot(
                                      day,
                                      time
                                    )
                                  }
                                  onMouseEnter={(
                                    event
                                  ) => {

                                    if (
                                      occupied
                                    ) {
                                      handleOccupiedMouseEnter(
                                        event,
                                        day,
                                        time
                                      );
                                    }
                                  }}
                                  onMouseMove={(
                                    event
                                  ) => {

                                    if (
                                      occupied
                                    ) {
                                      handleOccupiedMouseMove(
                                        event
                                      );
                                    }
                                  }}
                                  onMouseLeave={() => {

                                    if (
                                      occupied
                                    ) {
                                      handleOccupiedMouseLeave();
                                    }
                                  }}
                                  className={`group relative flex min-h-[58px] w-full items-center justify-center overflow-hidden transition-all ${slotClass}`}
                                >

                                  {/* =================================================
                                      SLOT TERPILIH
                                      ================================================= */}

                                  {selected && (
                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15">

                                      <svg
                                        width="13"
                                        height="13"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="white"
                                        strokeWidth="2.5"
                                      >
                                        <path d="m5 12 4 4L19 6" />
                                      </svg>

                                    </span>
                                  )}

                                  {/* =================================================
                                      JADWAL GURU SENDIRI
                                      ================================================= */}

                                  {!selected &&
                                    ownSchedule && (
                                      <div className="flex flex-col items-center gap-1">

                                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#BFD9F2]">

                                          <svg
                                            width="12"
                                            height="12"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="#356A9F"
                                            strokeWidth="2.4"
                                          >
                                            <path d="m5 12 4 4L19 6" />
                                          </svg>

                                        </span>

                                        <span className="text-[8.5px] font-bold uppercase tracking-[0.04em] text-[#356A9F]">
                                          Jadwal Anda
                                        </span>
                                      </div>
                                    )}

                                  {/* =================================================
                                      JADWAL GURU LAIN
                                      ================================================= */}

                                  {!selected &&
                                    otherTeacher && (
                                      <div className="flex flex-col items-center gap-1">

                                        <span className="h-1.5 w-1.5 rounded-full bg-[#B94A48]" />

                                        <span className="text-[8.5px] font-bold uppercase tracking-[0.04em] text-[#B94A48]">
                                          Terpakai
                                        </span>
                                      </div>
                                    )}

                                  {/* =================================================
                                      TERSEDIA
                                      ================================================= */}

                                  {!selected &&
                                    !occupied && (
                                      <span className="h-1.5 w-1.5 rounded-full bg-[#DDD5C8] opacity-0 transition-opacity group-hover:opacity-100" />
                                    )}

                                </button>
                              </div>
                            );
                          }
                        )}
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* =================================================
                  LEGEND
                  ================================================= */}

              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2.5 border-b border-[#EDE5D9] pb-4">

                {/* DIPILIH */}

                <div className="flex items-center gap-2 text-[10.5px] text-[#6B7080]">

                  <span className="flex h-4 w-4 items-center justify-center rounded-[4px] bg-[#1E2A47]">

                    <svg
                      width="9"
                      height="9"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="3"
                    >
                      <path d="m5 12 4 4L19 6" />
                    </svg>

                  </span>

                  Jam dipilih
                </div>

                {/* JADWAL SENDIRI */}

                <div className="flex items-center gap-2 text-[10.5px] text-[#6B7080]">

                  <span className="h-4 w-4 rounded-[4px] border border-[#BFD9F2] bg-[#DCEBFA]" />

                  Jadwal Anda
                </div>

                {/* JADWAL GURU LAIN */}

                <div className="flex items-center gap-2 text-[10.5px] text-[#6B7080]">

                  <span className="h-4 w-4 rounded-[4px] border border-[#E8B8AA] bg-[#F9D8D4]" />

                  Digunakan guru lain
                </div>

                {/* TERSEDIA */}

                <div className="flex items-center gap-2 text-[10.5px] text-[#6B7080]">

                  <span className="h-4 w-4 rounded-[4px] border border-[#E3DACB] bg-[#FFFDF8]" />

                  Tersedia
                </div>

                <div className="ml-auto flex items-center gap-2 rounded-full bg-[#F3EFE7] px-3 py-1.5 text-[10px] font-medium text-[#6B7080]">

                  <span className="font-bold text-[#1E2A47]">
                    1 JP
                  </span>

                  = 45 menit
                </div>
              </div>

              {/* =================================================
                  SUMMARY
                  ================================================= */}

              <div className="mt-5">

                <div className="mb-3 flex items-center justify-between">

                  <div>

                    <h3 className="font-['Fraunces',serif] text-[17px] font-semibold text-[#141C30]">
                      Ringkasan jadwal
                    </h3>

                    <p className="mt-0.5 text-[10.5px] text-[#8A8F9D]">
                      {selectedSlotCount >
                      0
                        ? `${selectedSlotCount} JP dipilih dalam ${schedules.length} blok jadwal.`
                        : 'Belum ada jam yang dipilih.'}
                    </p>
                  </div>

                  {selectedSlotCount >
                    0 && (
                    <div className="rounded-full bg-[#E7ECF4] px-3 py-1.5 text-[10.5px] font-bold text-[#1E2A47]">
                      {
                        selectedSlotCount
                      }{' '}
                      JP
                    </div>
                  )}
                </div>

                {schedules.length >
                0 ? (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">

                    {schedules.map(
                      (
                        schedule,
                        index
                      ) => {

                        const duration =
                          timeToMinutes(
                            schedule.end_time
                          ) -
                          timeToMinutes(
                            schedule.start_time
                          );

                        const periods =
                          duration /
                          SLOT_MINUTES;

                        return (
                          <div
                            key={`${schedule.day}-${schedule.start_time}-${index}`}
                            className="group rounded-[11px] border border-[#E3DACB] bg-[#FCFAF5] p-3.5 transition hover:border-[#C9B99F] hover:bg-white"
                          >

                            <div className="flex items-start justify-between gap-3">

                              <div>

                                <div className="text-[11.5px] font-bold text-[#303646]">
                                  {
                                    schedule.day
                                  }
                                </div>

                                <div className="mt-1 flex items-center gap-1.5 text-[12px] font-semibold text-[#1E2A47]">

                                  <svg
                                    width="13"
                                    height="13"
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

                                    <path d="M12 7v5l3 2" />
                                  </svg>

                                  {
                                    formatTime(
                                      schedule.start_time
                                    )
                                  }{' '}
                                  —{' '}

                                  {
                                    formatTime(
                                      schedule.end_time
                                    )
                                  }
                                </div>
                              </div>

                              <span className="rounded-[7px] bg-[#E7ECF4] px-2 py-1 text-[9.5px] font-bold text-[#1E2A47]">
                                {
                                  periods
                                }{' '}
                                JP
                              </span>
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                ) : (
                  <div className="rounded-[11px] border border-dashed border-[#D9CFBF] bg-[#FCFAF5] px-5 py-7 text-center">

                    <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-[#F1ECE4] text-[#8A8F9D]">

                      <svg
                        width="17"
                        height="17"
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

                        <path d="M12 7v5l3 2" />
                      </svg>
                    </div>

                    <div className="mt-2 text-[11.5px] font-semibold text-[#6B7080]">
                      Belum ada jadwal
                      dipilih
                    </div>

                    <div className="mt-0.5 text-[10.5px] text-[#9A9DA6]">
                      Klik slot pada kalender
                      untuk menambahkan jam
                      mengajar.
                    </div>
                  </div>
                )}
              </div>

              {/* =================================================
                  ACTION
                  ================================================= */}

              <div className="mt-6 flex flex-col-reverse gap-2.5 border-t border-[#EDE5D9] pt-5 sm:flex-row sm:items-center sm:justify-end">

                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      '/guru/kelas-saya'
                    )
                  }
                  className="rounded-[10px] border border-[#DED7CC] bg-[#FFFDF8] px-5 py-2.5 text-[12px] font-semibold text-[#666B78] transition hover:border-[#C9B99F] hover:bg-[#F8F6F1] hover:text-[#303646]"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={
                    saving ||
                    loadingData ||
                    activeClassrooms.length ===
                      0
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-[#1E2A47] px-5 py-2.5 text-[12px] font-semibold text-white shadow-[0_4px_12px_rgba(30,42,71,0.15)] transition hover:bg-[#141C30] hover:shadow-[0_6px_16px_rgba(30,42,71,0.20)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />

                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />

                        <path d="M17 21v-8H7v8M7 3v5h8" />
                      </svg>

                      Simpan jadwal
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>
        </form>
      </div>

      {/* ========================================================
          OCCUPIED TOOLTIP
          ======================================================== */}

      {hoveredOccupiedSlot && (
        <div
          className={`pointer-events-none fixed z-[9999] w-[225px] -translate-x-1/2 -translate-y-[115%] rounded-[11px] px-3.5 py-3 text-left shadow-[0_12px_30px_-10px_rgba(20,28,48,0.25)] ${
            hoveredOccupiedSlot.type ===
            'own'
              ? 'border border-[#BFD9F2] bg-[#F7FBFF]'
              : 'border border-[#E8B8AA] bg-[#FFFDF8]'
          }`}
          style={{
            left: mousePosition.x,
            top: mousePosition.y,
          }}
        >

          <div className="flex items-center gap-2">

            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${
                hoveredOccupiedSlot.type ===
                'own'
                  ? 'bg-[#DCEBFA] text-[#356A9F]'
                  : 'bg-[#F5E6DF] text-[#AE5A3E]'
              }`}
            >
              {hoveredOccupiedSlot.type ===
              'own'
                ? '✓'
                : '⚠'}
            </span>

            <div>

              <div
                className={`text-[11.5px] font-bold ${
                  hoveredOccupiedSlot.type ===
                  'own'
                    ? 'text-[#356A9F]'
                    : 'text-[#AE5A3E]'
                }`}
              >
                {hoveredOccupiedSlot.type ===
                'own'
                  ? 'Jadwal Anda'
                  : 'Jam telah dipakai'}
              </div>

              <div className="text-[9.5px] text-[#7D8492]">
                {
                  hoveredOccupiedSlot.day
                }{' '}
                ·{' '}
                {
                  hoveredOccupiedSlot.time
                }
              </div>
            </div>
          </div>

          <div
            className={`mt-2 border-t pt-2 text-[10.5px] leading-4 ${
              hoveredOccupiedSlot.type ===
              'own'
                ? 'border-[#D8E8F7] text-[#6C8197]'
                : 'border-[#F0D8D1] text-[#8A8F9D]'
            }`}
          >
            {hoveredOccupiedSlot.type ===
            'own'
              ? 'Anda sudah memiliki jadwal pada waktu ini.'
              : 'Jam ini sudah digunakan guru lain pada kelas yang dipilih. Silakan pilih slot waktu lain.'}
          </div>
        </div>
      )}
    </KelasSayaLayout>
  );
}