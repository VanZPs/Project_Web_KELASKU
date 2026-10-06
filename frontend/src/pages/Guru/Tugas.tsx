import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock3,
  Plus,
  Search,
  Users,
} from 'lucide-react';

import api from '../../api/axios';
import { GuruLayout } from '../../layouts/Guru/GuruLayout';
import { useNavigate } from 'react-router-dom';
import BuatTugasModal from '../../components/Guru/BuatTugasModal';


/*
|--------------------------------------------------------------------------
| TYPES
|--------------------------------------------------------------------------
*/
type AssignmentType =
  | 'short'
  | 'paragraph'
  | 'multiple'
  | 'checkbox'
  | 'upload'
  | 'info';

type FilterTab =
  | 'all'
  | 'grading';

type SubmissionMode =
  | 'once'
  | 'multiple';

interface UserData {
  id?: number;
  name?: string;
  email?: string;
  role?: string;
}

interface Classroom {
  id: number;
  name: string;
  students_count?: number;
}

interface Subject {
  id: number;
  name: string;
}

interface Schedule {
  id: number;
  classroom_id?: number;
  subject_id?: number;
  day?: string;
  start_time?: string;
  end_time?: string;
  classroom?: Classroom;
  subject?: Subject;
}

interface AssignmentOption {
  id?: number;
  assignment_question_id?: number;
  option_text: string;
  order: number;
  is_correct?: boolean;
}

interface AssignmentQuestion {
  id?: number;
  assignment_id?: number;
  type: AssignmentType;
  question: string;
  order: number;
  is_required: boolean;
  options?: AssignmentOption[];
}

interface SubmissionStudent {
  id?: number;
  name?: string;
  user?: {
    id?: number;
    name?: string;
    email?: string;
  };
}

interface Submission {
  id: number;
  student_id?: number;
  student?: SubmissionStudent;
  grade?: number | string | null;
  teacher_feedback?: string | null;
  created_at?: string;
}

interface Assignment {
  id: number;
  schedule_id?: number;
  title: string;
  description?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  submission_mode?: SubmissionMode;
  schedule?: Schedule;
  schedules?: Schedule[];
  questions?: AssignmentQuestion[];
  submissions?: Submission[];
  files?: unknown[];
}

// interface QuestionDraft {
//   type: AssignmentType;
//   question: string;
//   order: number;
//   is_required: boolean;
//   options: {
//     option_text: string;
//     order: number;
//     is_correct: boolean;
//   }[];
//   correct_answer: string;
// }

// interface TaskForm {
//   classroomIds: number[];
//   title: string;
//   description: string;
//   type: AssignmentType | null;
//   questionCount: string;
//   startDate: string;
//   dueDate: string;
//   submissionMode: SubmissionMode;
// }


/*
|--------------------------------------------------------------------------
| CONSTANTS
|--------------------------------------------------------------------------
*/
// const TYPE_LABELS: Record<
//   AssignmentType,
//   string
// > = {
//   short: 'Jawaban singkat',
//   paragraph: 'Paragraf',
//   multiple: 'Pilihan ganda',
//   checkbox: 'Kotak centang',
//   upload: 'Upload file',
//   info: 'Catatan informasi',
// };

// const TYPE_ICONS: Record<
//   AssignmentType,
//   typeof FileText
// > = {
//   short: FileText,
//   paragraph: FileText,
//   multiple: CheckCircle2,
//   checkbox: Check,
//   upload: UploadCloud,
//   info: Info,
// };


/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/
function getInitials(name?: string) {
  if (!name) {
    return 'G';
  }

  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 1) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return `${parts[0][0]}${parts[1][0]}`
    .toUpperCase();
}

function getStudentCount(
  schedule?: Schedule,
  classroomStudentCounts?: Record<number, number>,
) {
  if (!schedule?.classroom) {
    return 0;
  }

  const classroomId = schedule.classroom.id;

  if (
    classroomStudentCounts &&
    Object.prototype.hasOwnProperty.call(
      classroomStudentCounts,
      classroomId,
    )
  ) {
    return classroomStudentCounts[classroomId];
  }

  return schedule.classroom.students_count ?? 0;
}

function getAssignmentSubmissions(
  assignment: Assignment,
) {
  return assignment.submissions ?? [];
}

function getUngradedCount(
  assignment: Assignment,
) {
  return getAssignmentSubmissions(
    assignment,
  ).filter(
    (submission) =>
      submission.grade === null ||
      submission.grade === undefined ||
      submission.grade === '',
  ).length;
}

function isAssignmentRunning(
  assignment: Assignment,
) {
  const now = new Date();

  if (
    assignment.start_date &&
    new Date(
      assignment.start_date,
    ).getTime() > now.getTime()
  ) {
    return false;
  }

  if (
    assignment.due_date &&
    new Date(
      assignment.due_date,
    ).getTime() < now.getTime()
  ) {
    return false;
  }
  return true;
}

function getClassKey(
  schedule?: Schedule,
  scheduleId?: number,
) {
  return String(
    scheduleId ??
      schedule?.id ??
      `${schedule?.classroom?.id ?? 'class'}-${schedule?.subject?.id ?? 'subject'}`,
  );
}

function getAssignmentSchedules(
  assignment: Assignment,
): Schedule[] {
  if (
    Array.isArray(assignment.schedules) &&
    assignment.schedules.length > 0
  ) {
    return assignment.schedules;
  }

  if (assignment.schedule) {
    return [assignment.schedule];
  }

  return [];
}

function getErrorMessage(
  error: any,
) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    'Terjadi kesalahan. Silakan coba lagi.'
  );
}

// function buildInitialQuestion(
//   index: number,
//   type: AssignmentType,
// ): QuestionDraft {
//   if (
//     type === 'multiple' ||
//     type === 'checkbox'
//   ) {
//     return {
//       type,
//       question: '',
//       order: index,
//       is_required: true,
//       options: [
//         {
//           option_text: 'Opsi 1',
//           order: 1,
//           is_correct:
//             type === 'multiple',
//         },
//         {
//           option_text: 'Opsi 2',
//           order: 2,
//           is_correct: false,
//         },
//       ],
//       correct_answer: '',
//     };
//   }

//   return {
//     type,
//     question: '',
//     order: index,
//     is_required: type !== 'info',
//     options: [],
//     correct_answer: '',
//   };
// }


/*
|--------------------------------------------------------------------------
| TYPE ICON
|--------------------------------------------------------------------------
*/
// function TypeIcon({
//   type,
//   size = 18,
// }: {
//   type: AssignmentType;
//   size?: number;
// }) {
//   const Icon = TYPE_ICONS[type];

//   return (
//     <Icon
//       size={size}
//       strokeWidth={1.8}
//     />
//   );
// }


/*
|--------------------------------------------------------------------------
| COMPONENT
|--------------------------------------------------------------------------
*/
export default function Tugas() {
  const navigate = useNavigate();

  /*
  |--------------------------------------------------------------------------
  | STATE
  |--------------------------------------------------------------------------
  */
  const [user, setUser] =
    useState<UserData | null>(null);

  const [assignments, setAssignments] =
    useState<Assignment[]>([]);

  const [schedules, setSchedules] =
    useState<Schedule[]>([]);

  const [classroomStudentCounts, setClassroomStudentCounts] =
    useState<Record<number, number>>({});

  const [loading, setLoading] =
    useState(true);

  const [, setScheduleLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  const [activeFilter, setActiveFilter] =
    useState<FilterTab>('all');

  const [search, setSearch] =
    useState('');

  const [createTaskModalOpen, setCreateTaskModalOpen] =
    useState(false);



  /*
  |--------------------------------------------------------------------------
  | LOAD STORED USER
  |--------------------------------------------------------------------------
  */
  useEffect(() => {
    const storedUser =
      localStorage.getItem('user');

    if (!storedUser) {
      return;
    }

    try {
      setUser(
        JSON.parse(storedUser),
      );
    } catch {
      setUser(null);
    }
  }, []);


  /*
  |--------------------------------------------------------------------------
  | INITIAL LOAD
  |--------------------------------------------------------------------------
  */
  useEffect(() => {
    loadAssignments();
    loadSchedules();
    loadClassroomStudentCounts();
  }, []);




  /*
  |--------------------------------------------------------------------------
  | TOAST AUTO CLOSE
  |--------------------------------------------------------------------------
  */

  /*
  |--------------------------------------------------------------------------
  | LOAD ASSIGNMENTS
  |--------------------------------------------------------------------------
  */
  async function loadAssignments() {
    try {
      setLoading(true);
      setError('');

      const response =
        await api.get('/guru/tugas');

      const payload =
        response.data;

      if (
        Array.isArray(payload)
      ) {
        setAssignments(payload);
      } else if (
        Array.isArray(
          payload?.data,
        )
      ) {
        setAssignments(
          payload.data,
        );
      } else if (
        Array.isArray(
          payload?.assignments,
        )
      ) {
        setAssignments(
          payload.assignments,
        );
      } else {
        setAssignments([]);
      }

    } catch (err: any) {
      setError(
        getErrorMessage(err),
      );
      setAssignments([]);

    } finally {
      setLoading(false);
    }
  }


  /*
  |--------------------------------------------------------------------------
  | LOAD SCHEDULES
  |--------------------------------------------------------------------------
  */
  async function loadSchedules() {
    try {
      setScheduleLoading(true);

      const response =
        await api.get('/schedules');

      const payload =
        response.data;

      let result: Schedule[] =
        [];

      if (
        Array.isArray(payload)
      ) {
        result = payload;
      } else if (
        Array.isArray(
          payload?.data,
        )
      ) {
        result = payload.data;
      } else if (
        Array.isArray(
          payload?.schedules,
        )
      ) {
        result =
          payload.schedules;
      }
      setSchedules(result);

    } catch {
      setSchedules([]);

    } finally {
      setScheduleLoading(false);
    }
  }


  /*
  |--------------------------------------------------------------------------
  | LOAD CLASSROOM STUDENT COUNTS
  |--------------------------------------------------------------------------
  |
  | Endpoint /schedules hanya digunakan untuk mengambil jadwal mengajar.
  | Jumlah siswa yang menjadi anggota kelas tersedia secara eksplisit pada
  | endpoint /guru/kelas-saya melalui field jumlah_siswa.
  |
  | Data ini dipetakan berdasarkan classroom ID agar jumlah siswa pada card
  | Tugas selalu mengikuti data membership siswa yang sama dengan halaman
  | Kelas Saya.
  */
  async function loadClassroomStudentCounts() {
    try {
      const response =
        await api.get('/guru/kelas-saya');

      const payload = response.data;
      const kelasList =
        Array.isArray(payload?.data?.kelas)
          ? payload.data.kelas
          : Array.isArray(payload?.kelas)
            ? payload.kelas
            : Array.isArray(payload?.data)
              ? payload.data
              : [];

      const counts: Record<number, number> = {};

      kelasList.forEach((kelas: any) => {
        const classroomId = Number(kelas?.id);
        const studentCount = Number(kelas?.jumlah_siswa);

        if (
          Number.isFinite(classroomId) &&
          classroomId > 0 &&
          Number.isFinite(studentCount)
        ) {
          counts[classroomId] = studentCount;
        }
      });

      setClassroomStudentCounts(counts);
    } catch (err) {
      console.error(
        'Gagal mengambil jumlah siswa setiap kelas:',
        err,
      );
    }
  }


  /*
  |--------------------------------------------------------------------------
  | TEACHER DATA
  |--------------------------------------------------------------------------
  */
  const teacherName =
    user?.name ?? 'Guru';


  const teacherSubject =
    useMemo(() => {

      const subjectNames =
        schedules
          .map(
            (schedule) =>
              schedule.subject?.name,
          )
          .filter(
            Boolean,
          ) as string[];

      const uniqueSubjects =
        [
          ...new Set(
            subjectNames,
          ),
        ];

      if (
        uniqueSubjects.length ===
        1
      ) {
        return uniqueSubjects[0];
      }
      return 'Guru';
    }, [schedules]);


  /*
  |--------------------------------------------------------------------------
  | UNIQUE CLASSROOMS
  |--------------------------------------------------------------------------
  */
  const uniqueClassrooms =
    useMemo(() => {

      const map =
        new Map<
          number,
          Classroom
        >();

      schedules.forEach(
        (schedule) => {
          if (
            schedule.classroom
          ) {
            map.set(
              schedule.classroom.id,
              schedule.classroom,
            );
          }
        },
      );

      assignments.forEach(
        (assignment) => {
          getAssignmentSchedules(
            assignment,
          ).forEach(
            (schedule) => {
              if (schedule.classroom) {
                map.set(
                  schedule.classroom.id,
                  schedule.classroom,
                );
              }
            },
          );
        },
      );
      return [
        ...map.values(),
      ];
    }, [
      schedules,
      assignments,
    ]);


  /*
  |--------------------------------------------------------------------------
  | SUMMARY
  |--------------------------------------------------------------------------
  */
  const totalAssignments =
    assignments.length;

  const totalNeedGrading =
    assignments.reduce(
      (
        total,
        assignment,
      ) =>
        total +
        getUngradedCount(
          assignment,
        ),
      0,
    );

  const totalRunning =
    assignments.filter(
      isAssignmentRunning,
    ).length;


  /*
  |--------------------------------------------------------------------------
  | FILTER ASSIGNMENTS
  |--------------------------------------------------------------------------
  */
  const filteredAssignments =
    useMemo(() => {

      const keyword =
        search
          .trim()
          .toLowerCase();

      return assignments.filter(
        (assignment) => {

          const assignmentSchedules =
            getAssignmentSchedules(
              assignment,
            );

          const matchesScheduleSearch =
            assignmentSchedules.some(
              (schedule) =>
                schedule.classroom?.name
                  ?.toLowerCase()
                  .includes(keyword) ||
                schedule.subject?.name
                  ?.toLowerCase()
                  .includes(keyword),
            );

          const matchesSearch =
            !keyword ||
            assignment.title
              .toLowerCase()
              .includes(keyword) ||
            matchesScheduleSearch;

          const matchesFilter =
            activeFilter ===
              'all' ||
            getUngradedCount(
              assignment,
            ) > 0;

          return (
            matchesSearch &&
            matchesFilter
          );
        },
      );
    }, [
      assignments,
      search,
      activeFilter,
    ]);


  /*
  |--------------------------------------------------------------------------
  | GROUP ASSIGNMENTS
  |--------------------------------------------------------------------------
  */
  const groupedCards =
    useMemo(() => {
      const groups =
        new Map<
          string,
          {
            key: string;
            schedule?: Schedule;
            assignments: Assignment[];
          }
        >();

      filteredAssignments.forEach(
        (assignment) => {
          const assignmentSchedules =
            getAssignmentSchedules(
              assignment,
            );

          if (
            assignmentSchedules.length === 0
          ) {
            const key = getClassKey(
              assignment.schedule,
              assignment.schedule_id,
            );

            if (!groups.has(key)) {
              groups.set(key, {
                key,
                schedule:
                  assignment.schedule,
                assignments: [],
              });
            }

            groups
              .get(key)!
              .assignments.push(
                assignment,
              );
            return;
          }

          assignmentSchedules.forEach(
            (schedule) => {
              const key = getClassKey(
                schedule,
                schedule.id,
              );

              if (!groups.has(key)) {
                groups.set(key, {
                  key,
                  schedule,
                  assignments: [],
                });
              }

              groups
                .get(key)!
                .assignments.push(
                  assignment,
                );
            },
          );
        },
      );

      return [
        ...groups.values(),
      ];
    }, [
      filteredAssignments,
    ]);

  /*
  |--------------------------------------------------------------------------
  | SUBJECT ICON
  |--------------------------------------------------------------------------
  */
  function renderSubjectIcon(
    group: {
      schedule?: Schedule;
      assignments: Assignment[];
    },
  ) {

    const subjectName =
      group.schedule?.subject?.name
        ?.toLowerCase() ?? '';

    let background =
      '#E5ECF5';

    let color =
      '#3E6BAE';

    if (
      subjectName.includes(
        'matematika',
      ) ||
      subjectName.includes(
        'fisika',
      ) ||
      subjectName.includes(
        'kimia',
      )
    ) {

      background =
        '#E5ECF5';

      color =
        '#3E6BAE';

    } else if (
      subjectName.includes(
        'bahasa',
      ) ||
      subjectName.includes(
        'seni',
      )
    ) {

      background =
        '#E7D3A8';

      color =
        '#7A5A20';
    }


    return (
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[11px]"
        style={{
          backgroundColor:
            background,
          color,
        }}
      >
        <BookOpen
          size={20}
          strokeWidth={1.8}
        />
      </div>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | CARD STATUS
  |--------------------------------------------------------------------------
  */
  function renderCardStatus(
    cardAssignments: Assignment[],
  ) {

    const needGrading =
      cardAssignments.reduce(
        (
          total,
          assignment,
        ) =>
          total +
          getUngradedCount(
            assignment,
          ),
        0,
      );

    const running =
      cardAssignments.filter(
        isAssignmentRunning,
      ).length;


    return (
      <div className="mb-[18px] flex flex-col gap-2.5">
        {needGrading > 0 ? (
          <div
            className="flex items-center gap-2.5 rounded-[10px] border px-[13px] py-[11px] text-[13px]"
            style={{
              backgroundColor:
                '#F6E1D9',
              borderColor:
                '#E4BCA9',
            }}
          >

            <span
              className="h-[9px] w-[9px] shrink-0 rounded-full"
              style={{
                backgroundColor:
                  '#A8503B',
              }}
            />

            <span
              className="flex-1"
              style={{
                color:
                  '#23283A',
              }}
            >
              <b
                style={{
                  color:
                    '#A8503B',
                }}
              >
                {needGrading}{' '}
                tugas
              </b>{' '}
              perlu dinilai
            </span>
          </div>

        ) : (
          <div
            className="flex items-center gap-2.5 rounded-[10px] border px-[13px] py-[11px] text-[13px]"
            style={{
              backgroundColor:
                '#E7F0EA',
              borderColor:
                '#C7DBCC',
            }}
          >

            <span
              className="h-[9px] w-[9px] shrink-0 rounded-full"
              style={{
                backgroundColor:
                  '#4C7A5E',
              }}
            />

            <span
              className="flex-1 font-bold"
              style={{
                color:
                  '#4C7A5E',
              }}
            >
              Semua tugas sudah
              dinilai
            </span>
          </div>
        )}

        {running > 0 ? (
          <div
            className="flex items-center gap-2.5 rounded-[10px] border px-[13px] py-[11px] text-[13px]"
            style={{
              backgroundColor:
                '#FBF9F3',
              borderColor:
                '#E3DACB',
            }}
          >

            <span
              className="h-[9px] w-[9px] shrink-0 rounded-full"
              style={{
                backgroundColor:
                  '#B9791F',
              }}
            />

            <span
              className="flex-1"
              style={{
                color:
                  '#23283A',
              }}
            >
              <b
                style={{
                  color:
                    '#141C30',
                }}
              >
                {running} tugas
              </b>{' '}
              sedang berjalan
            </span>
          </div>
        ) : (
          <div
            className="flex items-center gap-2.5 rounded-[10px] border px-[13px] py-[11px] text-[13px]"
            style={{
              backgroundColor:
                '#FBF9F3',
              borderColor:
                '#E3DACB',
            }}
          >

            <span
              className="h-[9px] w-[9px] shrink-0 rounded-full"
              style={{
                backgroundColor:
                  '#C7C0AC',
              }}
            />

            <span
              className="flex-1"
              style={{
                color:
                  '#23283A',
              }}
            >
              Belum ada tugas
              berjalan
            </span>
          </div>
        )}
      </div>
    );
  }


  /*
  |--------------------------------------------------------------------------
  | QUESTION BLOCK
  |--------------------------------------------------------------------------
  */


  /*
  |--------------------------------------------------------------------------
  | RENDER
  |--------------------------------------------------------------------------
  */
  return (
    <GuruLayout
      namaGuru={teacherName}
      mapelGuru={teacherSubject}
      getInitials={getInitials}
      mainClassName="overflow-hidden"
    >
      <div
        className="min-h-screen"
        style={{
          backgroundColor:
            '#F5F1E7',
          color:
            '#23283A',
          fontFamily:
            '"Plus Jakarta Sans", sans-serif',
        }}
      >
        <main className="mx-auto w-full max-w-[1248px] px-[34px] pb-[60px] pt-[26px]">

        {/* =====================================================
            HEADER
        ===================================================== */}
        <div className="mb-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2">

                <span className="h-1.5 w-1.5 rounded-full bg-[#C49A5A]" />

                <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#8A806F]">
                  Semester ganjil 2026/2027
                </span>
              </div>

              <h1 className="font-['Fraunces',serif] text-[32px] font-semibold leading-[1.1] tracking-[-0.02em] text-[#141C30] sm:text-[36px]">
                Daftar tugas
              </h1>

              <p className="mt-2 max-w-[520px] text-[13px] leading-5 text-[#6B7080]">
                Kelola tugas untuk setiap kelas yang Anda ajar, mulai dari membuat
                tugas baru hingga menilai yang sudah dikumpulkan.
              </p>
            </div>
          </div>
        </div>

          {/* =====================================================
              TOOLBAR
          ====================================================== */}
          <div className="my-[22px] flex flex-wrap items-center justify-between gap-3.5">
            <div
              className="flex rounded-[11px] border p-1"
              style={{
                backgroundColor:
                  '#FFFDF8',
                borderColor:
                  '#E3DACB',
              }}
            >

              <button
                type="button"
                onClick={() =>
                  setActiveFilter(
                    'all',
                  )
                }
                className="flex items-center gap-[7px] rounded-[8px] px-4 py-2 text-[13px] font-semibold transition"
                style={
                  activeFilter ===
                  'all'
                    ? {
                        backgroundColor:
                          '#1E2A47',
                        color:
                          '#fff',
                      }
                    : {
                        backgroundColor:
                          'transparent',
                        color:
                          '#6B7080',
                      }
                }
              >
                Semua kelas
              </button>

              <button
                type="button"
                onClick={() =>
                  setActiveFilter(
                    'grading',
                  )
                }
                className="flex items-center gap-[7px] rounded-[8px] px-4 py-2 text-[13px] font-semibold transition"
                style={
                  activeFilter ===
                  'grading'
                    ? {
                        backgroundColor:
                          '#1E2A47',
                        color:
                          '#fff',
                      }
                    : {
                        backgroundColor:
                          'transparent',
                        color:
                          '#6B7080',
                      }
                }
              >
                Perlu dinilai
                <span
                  className="rounded-full px-1.5 py-[1px] text-[10.5px] font-bold"
                  style={
                    activeFilter ===
                    'grading'
                      ? {
                          backgroundColor:
                            'rgba(255,255,255,0.18)',
                          color:
                            '#fff',
                        }
                      : {
                          backgroundColor:
                            '#F6E1D9',
                          color:
                            '#A8503B',
                        }
                  }
                >
                  {
                    totalNeedGrading
                  }
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2.5">
              <div
                className="flex min-w-[210px] items-center gap-2 rounded-[10px] border px-[13px] py-[9px]"
                style={{
                  backgroundColor:
                    '#FFFDF8',
                  borderColor:
                    '#E3DACB',
                }}
              >

                <Search
                  size={16}
                  style={{
                    opacity: 0.5,
                  }}
                  strokeWidth={2}
                />

                <input
                  type="text"
                  value={search}
                  onChange={(
                    event,
                  ) =>
                    setSearch(
                      event.target
                        .value,
                    )
                  }
                  placeholder="Cari tugas atau kelas..."
                  className="w-full border-none bg-transparent text-[13.5px] outline-none"
                  style={{
                    color:
                      '#23283A',
                  }}
                />
              </div>

              <button
                type="button"
                onClick={() =>
                  setCreateTaskModalOpen(true)
                }
                className="flex items-center gap-2 whitespace-nowrap rounded-[10px] border px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:opacity-90"
                style={{
                  backgroundColor:
                    '#1E2A47',
                  borderColor:
                    '#1E2A47',
                }}
              >
                <Plus
                  size={15}
                  strokeWidth={2}
                />
                Tugas baru
              </button>
            </div>
          </div>

          {/* =====================================================
              SUMMARY
          ====================================================== */}
          <div
            className="mb-[22px] flex gap-[22px] rounded-[14px] border px-[22px] py-4 shadow-sm"
            style={{
              backgroundColor:
                '#FFFDF8',
              borderColor:
                '#E3DACB',
            }}
          >

            <div className="flex items-center gap-[11px] border-r border-[#E3DACB] pr-[22px]">
              <div
                className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px]"
                style={{
                  backgroundColor:
                    '#E7ECF4',
                  color:
                    '#1E2A47',
                }}
              >
                <BookOpen
                  size={17}
                  strokeWidth={1.9}
                />
              </div>

              <div>
                <div
                  className="text-[19px] font-semibold leading-none"
                  style={{
                    color:
                      '#141C30',
                    fontFamily:
                      '"Fraunces", serif',
                  }}
                >
                  {
                    uniqueClassrooms.length
                  }
                </div>

                <div
                  className="mt-[3px] text-[11.5px]"
                  style={{
                    color:
                      '#6B7080',
                  }}
                >
                  Kelas diajar
                </div>
              </div>
            </div>

            <div className="flex items-center gap-[11px] border-r border-[#E3DACB] pr-[22px]">
              <div
                className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px]"
                style={{
                  backgroundColor:
                    '#E7D3A8',
                  color:
                    '#7A5A20',
                }}
              >
                <Calendar
                  size={17}
                  strokeWidth={1.9}
                />
              </div>

              <div>
                <div
                  className="text-[19px] font-semibold leading-none"
                  style={{
                    color:
                      '#141C30',
                    fontFamily:
                      '"Fraunces", serif',
                  }}
                >
                  {
                    totalAssignments
                  }
                </div>

                <div
                  className="mt-[3px] text-[11.5px]"
                  style={{
                    color:
                      '#6B7080',
                  }}
                >
                  Total tugas dibuat
                </div>
              </div>
            </div>

            <div className="flex items-center gap-[11px] border-r border-[#E3DACB] pr-[22px]">
              <div
                className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px]"
                style={{
                  backgroundColor:
                    '#F6E1D9',
                  color:
                    '#A8503B',
                }}
              >
                <CheckCircle2
                  size={17}
                  strokeWidth={1.9}
                />
              </div>

              <div>
                <div
                  className="text-[19px] font-semibold leading-none"
                  style={{
                    color:
                      '#A8503B',
                    fontFamily:
                      '"Fraunces", serif',
                  }}
                >
                  {
                    totalNeedGrading
                  }
                </div>

                <div
                  className="mt-[3px] text-[11.5px]"
                  style={{
                    color:
                      '#6B7080',
                  }}
                >
                  Tugas perlu dinilai
                </div>
              </div>
            </div>

            <div className="flex items-center gap-[11px]">
              <div
                className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px]"
                style={{
                  backgroundColor:
                    '#F4E4C8',
                  color:
                    '#B9791F',
                }}
              >
                <Clock3
                  size={17}
                  strokeWidth={1.9}
                />
              </div>

              <div>
                <div
                  className="text-[19px] font-semibold leading-none"
                  style={{
                    color:
                      '#141C30',
                    fontFamily:
                      '"Fraunces", serif',
                  }}
                >
                  {
                    totalRunning
                  }
                </div>

                <div
                  className="mt-[3px] text-[11.5px]"
                  style={{
                    color:
                      '#6B7080',
                  }}
                >
                  Tugas sedang berjalan
                </div>
              </div>
            </div>
          </div>

          {/* =====================================================
              ERROR
          ====================================================== */}
          {error && (
            <div
              className="mb-[18px] flex items-center gap-2.5 rounded-[10px] border px-[13px] py-3 text-[13px]"
              style={{
                backgroundColor:
                  '#F6E1D9',
                borderColor:
                  '#E4BCA9',
                color:
                  '#A8503B',
              }}
            >

              <AlertCircle
                size={16}
              />

              <span>
                {error}
              </span>

              <button
                type="button"
                onClick={
                  loadAssignments
                }
                className="ml-auto font-bold underline"
              >
                Coba lagi
              </button>
            </div>
          )}


          {/* =====================================================
              GRID KARTU
          ====================================================== */}
          {loading ? (
            <div className="grid grid-cols-1 gap-[18px] xl:grid-cols-2">
              {[1, 2, 3, 4].map(
                (item) => (
                  <div
                    key={item}
                    className="h-[235px] animate-pulse rounded-[14px] border"
                    style={{
                      backgroundColor:
                        '#FFFDF8',
                      borderColor:
                        '#E3DACB',
                    }}
                  />
                ),
              )}
            </div>

          ) : groupedCards.length ===
            0 ? (
            <div
              className="rounded-[14px] border px-6 py-16 text-center"
              style={{
                backgroundColor:
                  '#FFFDF8',
                borderColor:
                  '#E3DACB',
              }}
            >

              <div
                className="mx-auto flex h-12 w-12 items-center justify-center rounded-[12px]"
                style={{
                  backgroundColor:
                    '#E7ECF4',
                  color:
                    '#1E2A47',
                }}
              >
                <BookOpen
                  size={21}
                />
              </div>

              <h2
                className="mt-4 text-[19px] font-semibold"
                style={{
                  color:
                    '#141C30',
                  fontFamily:
                    '"Fraunces", serif',
                }}
              >
                {search ||
                activeFilter ===
                  'grading'
                  ? 'Tugas tidak ditemukan'
                  : 'Belum ada tugas'}
              </h2>

              <p
                className="mx-auto mt-2 max-w-[430px] text-[13px] leading-6"
                style={{
                  color:
                    '#6B7080',
                }}
              >
                {search ||
                activeFilter ===
                  'grading'
                  ? 'Tidak ada tugas yang sesuai dengan filter atau pencarian saat ini.'
                  : 'Buat tugas pertama untuk mulai memberikan tugas kepada siswa.'}
              </p>

              {!search &&
                activeFilter ===
                  'all' && (
                  <button
                    type="button"
                    onClick={() =>
                      setCreateTaskModalOpen(true)
                    }
                    className="mx-auto mt-5 flex items-center gap-2 rounded-[10px] px-4 py-2.5 text-[13.5px] font-bold text-white"
                    style={{
                      backgroundColor:
                        '#1E2A47',
                    }}
                  >
                    <Plus
                      size={15}
                    />
                    Tugas baru
                  </button>
                )}
            </div>
          ) : (

            <div className="grid grid-cols-1 gap-[18px] xl:grid-cols-2">
              {groupedCards.map(
                (group) => {

                  const schedule =
                    group.schedule;

                  const className =
                    schedule?.subject
                      ?.name &&
                    schedule?.classroom
                      ?.name
                      ? `${schedule.subject.name} — ${schedule.classroom.name}`
                      : schedule
                          ?.classroom
                          ?.name ??
                        'Kelas';

                  const studentCount =
                    getStudentCount(
                      schedule,
                      classroomStudentCounts,
                    );

                  return (
                    <div
                      key={group.key}
                      className="flex flex-col overflow-hidden rounded-[14px] border shadow-sm"
                      style={{
                        backgroundColor:
                          '#FFFDF8',
                        borderColor:
                          '#E3DACB',
                      }}
                    >
                      <div className="flex items-start gap-3.5 border-b px-[22px] pb-4 pt-5">
                        {renderSubjectIcon(
                          group,
                        )}
                        <div className="min-w-0 flex-1">
                          <div
                            className="text-[17px] leading-[1.3]"
                            style={{
                              color:
                                '#141C30',
                              fontFamily:
                                '"Fraunces", serif',
                              fontWeight: 600,
                            }}
                          >
                            {className}
                          </div>

                          <div className="mt-2 flex flex-wrap gap-x-3.5 gap-y-2">
                            <span
                              className="flex items-center gap-1.5 text-[12px]"
                              style={{
                                color:
                                  '#6B7080',
                              }}
                            >
                              <Users
                                size={14}
                                opacity={
                                  0.75
                                }
                              />

                              {
                                studentCount
                              }{' '}
                              siswa
                            </span>
                          </div>

                          <div
                            className="mt-2 flex items-center gap-1.5 text-[11.5px]"
                            style={{
                              color:
                                '#8A806F',
                            }}
                          >
                            <Calendar
                              size={13}
                              strokeWidth={1.9}
                            />

                            <span>
                              {schedule?.day ??
                                'Jadwal'}
                            </span>

                            <span
                              className="h-1 w-1 rounded-full"
                              style={{
                                backgroundColor:
                                  '#C7C0AC',
                              }}
                            />

                            <Clock3
                              size={13}
                              strokeWidth={1.9}
                            />

                            <span>
                              {schedule?.start_time
                                ? schedule.start_time.slice(0, 5)
                                : '--:--'}
                              {' – '}
                              {schedule?.end_time
                                ? schedule.end_time.slice(0, 5)
                                : '--:--'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="px-[22px] pb-1 pt-4">
                        {renderCardStatus(
                          group.assignments,
                        )}
                      </div>

                      <div className="mt-auto px-[22px] pb-5">
                        <button
                          type="button"
                          onClick={() => {
                            if (group.schedule?.id) {
                              navigate(
                                `/guru/tugas/kelola/${group.schedule.id}`,
                              );
                            }
                          }}
                          disabled={!group.schedule?.id}
                          className="flex w-full items-center justify-center gap-2 rounded-[10px] border px-0 py-3 text-[13.5px] font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                          style={{
                            backgroundColor:
                              '#1E2A47',
                            borderColor:
                              '#1E2A47',
                          }}
                        >
                          Kelola tugas
                          <ArrowRight
                            size={15}
                            strokeWidth={2}
                          />
                        </button>
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          )}
        </main>

        {/* =========================================================
            MODAL
        ========================================================== */}
        <BuatTugasModal
          open={createTaskModalOpen}
          onClose={() =>
            setCreateTaskModalOpen(false)
          }
          onCreated={() => {
            loadAssignments();
          }}
        />
      </div>
    </GuruLayout>
  );
}