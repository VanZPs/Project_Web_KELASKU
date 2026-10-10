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

  // Simpan mata pelajaran yang dipilih agar saat kembali dari Kelola Tugas,
  // halaman langsung menampilkan pilihan kelas pada mata pelajaran tersebut.
  const TASK_SUBJECT_STORAGE_KEY = 'kelasku_tugas_selected_subject_id';

  const [selectedSubjectId, setSelectedSubjectId] =
    useState<number | null>(() => {
      try {
        const storedSubjectId = sessionStorage.getItem(
          TASK_SUBJECT_STORAGE_KEY,
        );
        if (!storedSubjectId) return null;

        const parsedSubjectId = Number(storedSubjectId);
        return Number.isFinite(parsedSubjectId) && parsedSubjectId > 0
          ? parsedSubjectId
          : null;
      } catch {
        return null;
      }
    });

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
  | SUBJECTS AND CLASSES
  |--------------------------------------------------------------------------
  | Mata pelajaran diambil dari jadwal mengajar dan relasi jadwal pada tugas.
  | Kelas dikelompokkan berdasarkan mata pelajaran + kelas agar tidak berulang
  | jika ada lebih dari satu slot jadwal untuk kelas yang sama.
  */
  const subjectCards = useMemo(() => {
    const subjectMap = new Map<
      number,
      {
        id: number;
        name: string;
        schedules: Schedule[];
        classKeys: Set<string>;
        assignments: Assignment[];
      }
    >();

    const allSchedules: Schedule[] = [...schedules];
    assignments.forEach((assignment) => {
      getAssignmentSchedules(assignment).forEach((schedule) => {
        allSchedules.push(schedule);
      });
    });

    allSchedules.forEach((schedule) => {
      const subjectId = Number(schedule.subject_id ?? schedule.subject?.id);
      const subjectName = schedule.subject?.name?.trim();

      if (!Number.isFinite(subjectId) || subjectId <= 0 || !subjectName) {
        return;
      }

      if (!subjectMap.has(subjectId)) {
        subjectMap.set(subjectId, {
          id: subjectId,
          name: subjectName,
          schedules: [],
          classKeys: new Set<string>(),
          assignments: [],
        });
      }

      const subject = subjectMap.get(subjectId)!;
      const classroomId = Number(schedule.classroom_id ?? schedule.classroom?.id);
      const classKey = Number.isFinite(classroomId) && classroomId > 0
        ? String(classroomId)
        : `schedule-${schedule.id}`;

      subject.classKeys.add(classKey);

      if (
        schedule.id &&
        !subject.schedules.some((item) => item.id === schedule.id)
      ) {
        subject.schedules.push(schedule);
      }
    });

    assignments.forEach((assignment) => {
      const assignmentSchedules = getAssignmentSchedules(assignment);
      const subjectIds = new Set(
        assignmentSchedules
          .map((schedule) => Number(schedule.subject_id ?? schedule.subject?.id))
          .filter((id) => Number.isFinite(id) && id > 0),
      );

      subjectIds.forEach((subjectId) => {
        const subject = subjectMap.get(subjectId);
        if (
          subject &&
          !subject.assignments.some((item) => item.id === assignment.id)
        ) {
          subject.assignments.push(assignment);
        }
      });
    });

    return [...subjectMap.values()].sort((a, b) =>
      a.name.localeCompare(b.name, 'id'),
    );
  }, [schedules, assignments]);

  const visibleSubjectCards = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return subjectCards.filter((subject) =>
      subject.name.toLowerCase().includes(keyword),
    );
  }, [subjectCards, search]);

  const selectedSubject = subjectCards.find(
    (subject) => subject.id === selectedSubjectId,
  );

  useEffect(() => {
    if (
      selectedSubjectId === null ||
      subjectCards.length === 0 ||
      subjectCards.some((subject) => subject.id === selectedSubjectId)
    ) {
      return;
    }

    setSelectedSubjectId(null);
    try {
      sessionStorage.removeItem(TASK_SUBJECT_STORAGE_KEY);
    } catch {
      // Abaikan jika sessionStorage tidak tersedia.
    }
  }, [selectedSubjectId, subjectCards]);

  const subjectClassCards = useMemo(() => {
    if (selectedSubjectId === null) return [];

    const allSchedules: Schedule[] = [...schedules];
    assignments.forEach((assignment) => {
      getAssignmentSchedules(assignment).forEach((schedule) => {
        allSchedules.push(schedule);
      });
    });

    const classMap = new Map<
      string,
      { key: string; schedule: Schedule; assignments: Assignment[] }
    >();

    allSchedules.forEach((schedule) => {
      const subjectId = Number(schedule.subject_id ?? schedule.subject?.id);
      if (subjectId !== selectedSubjectId) return;

      const classroomId = Number(schedule.classroom_id ?? schedule.classroom?.id);
      const key = Number.isFinite(classroomId) && classroomId > 0
        ? `${subjectId}-${classroomId}`
        : `${subjectId}-schedule-${schedule.id}`;

      if (!classMap.has(key)) {
        classMap.set(key, { key, schedule, assignments: [] });
      } else {
        // Prioritaskan jadwal yang memiliki informasi kelas dan jadwal paling lengkap.
        const current = classMap.get(key)!;
        if (
          (!current.schedule.classroom && schedule.classroom) ||
          (!current.schedule.start_time && schedule.start_time)
        ) {
          current.schedule = schedule;
        }
      }
    });

    assignments.forEach((assignment) => {
      const assignmentSchedules = getAssignmentSchedules(assignment);
      const belongsToSubject = assignmentSchedules.some(
        (schedule) =>
          Number(schedule.subject_id ?? schedule.subject?.id) === selectedSubjectId,
      );

      if (belongsToSubject) {
        assignmentSchedules.forEach((schedule) => {
          const subjectId = Number(schedule.subject_id ?? schedule.subject?.id);
          if (subjectId !== selectedSubjectId) return;

          const classroomId = Number(schedule.classroom_id ?? schedule.classroom?.id);
          const key = Number.isFinite(classroomId) && classroomId > 0
            ? `${subjectId}-${classroomId}`
            : `${subjectId}-schedule-${schedule.id}`;
          const card = classMap.get(key);

          if (card && !card.assignments.some((item) => item.id === assignment.id)) {
            card.assignments.push(assignment);
          }
        });
        return;
      }

      // Fallback untuk respons API yang hanya menyertakan schedule_id.
      if (assignment.schedule_id) {
        const matching = [...classMap.values()].find(
          (card) => card.schedule.id === assignment.schedule_id,
        );
        if (matching && !matching.assignments.some((item) => item.id === assignment.id)) {
          matching.assignments.push(assignment);
        }
      }
    });

    const keyword = search.trim().toLowerCase();
    return [...classMap.values()]
      .filter((card) =>
        !keyword ||
        card.schedule.classroom?.name?.toLowerCase().includes(keyword),
      )
      .sort((a, b) =>
        (a.schedule.classroom?.name ?? '').localeCompare(
          b.schedule.classroom?.name ?? '',
          'id',
        ),
      );
  }, [schedules, assignments, selectedSubjectId, search]);

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
              {selectedSubject && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSubjectId(null);
                    setSearch('');
                    try {
                      sessionStorage.removeItem(TASK_SUBJECT_STORAGE_KEY);
                    } catch {
                      // Abaikan jika sessionStorage tidak tersedia.
                    }
                  }}
                  className="mb-4 inline-flex items-center gap-2 rounded-lg border border-[#DCD2C1] bg-[#FFFDF8] px-3.5 py-2 text-sm font-semibold text-[#344563] transition hover:border-[#C5A45D] hover:bg-white"
                >
                  <ArrowRight size={15} className="rotate-180" />
                  Kembali ke mata pelajaran
                </button>
              )}

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
                {selectedSubject
                  ? `Pilih kelas untuk mengelola tugas mata pelajaran ${selectedSubject.name}.`
                  : 'Pilih mata pelajaran untuk melihat dan mengelola tugas di setiap kelas yang Anda ajar.'}
              </p>
              {selectedSubject && (
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#E5ECF5] px-3 py-1 text-xs font-bold text-[#3E6BAE]">
                  <BookOpen size={13} />
                  {selectedSubject.name}
                </div>
              )}
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
                  placeholder={selectedSubject ? "Cari kelas..." : "Cari mata pelajaran..."}
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
                    selectedSubject
                      ? subjectClassCards.length
                      : subjectCards.length
                  }
                </div>

                <div
                  className="mt-[3px] text-[11.5px]"
                  style={{
                    color:
                      '#6B7080',
                  }}
                >
                  {selectedSubject ? 'Kelas diajar' : 'Mata pelajaran'}
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
              PILIH MATA PELAJARAN / PILIH KELAS
          ====================================================== */}
          {loading ? (
            <div className="grid grid-cols-1 gap-[18px] xl:grid-cols-2">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="h-[235px] animate-pulse rounded-[14px] border"
                  style={{ backgroundColor: '#FFFDF8', borderColor: '#E3DACB' }} />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-[14px] border px-6 py-16 text-center"
              style={{ backgroundColor: '#FFFDF8', borderColor: '#E3DACB' }}>
              <AlertCircle className="mx-auto text-[#A8503B]" size={25} />
              <h2 className="mt-3 text-lg font-semibold text-[#141C30]">Data tugas gagal dimuat</h2>
              <p className="mt-2 text-sm text-[#6B7080]">{error}</p>
              <button type="button" onClick={() => { loadAssignments(); loadSchedules(); }}
                className="mt-4 rounded-[10px] bg-[#1E2A47] px-4 py-2.5 text-sm font-bold text-white">
                Coba lagi
              </button>
            </div>
          ) : !selectedSubject ? (
            visibleSubjectCards.length === 0 ? (
              <div className="rounded-[14px] border px-6 py-16 text-center"
                style={{ backgroundColor: '#FFFDF8', borderColor: '#E3DACB' }}>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[12px] bg-[#E7ECF4] text-[#1E2A47]">
                  <BookOpen size={21} />
                </div>
                <h2 className="mt-4 text-[19px] font-semibold text-[#141C30]">
                  {search ? 'Mata pelajaran tidak ditemukan' : 'Belum ada mata pelajaran'}
                </h2>
                <p className="mx-auto mt-2 max-w-[430px] text-[13px] leading-6 text-[#6B7080]">
                  {search ? 'Tidak ada mata pelajaran yang sesuai dengan pencarian.' : 'Mata pelajaran akan muncul setelah jadwal mengajar tersedia.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-[18px] xl:grid-cols-2">
                {visibleSubjectCards.map((subject) => {
                  const subjectNeedGrading = subject.assignments.reduce(
                    (total, assignment) => total + getUngradedCount(assignment), 0);
                  const subjectRunning = subject.assignments.filter(isAssignmentRunning).length;
                  const classroomIds = [...new Set(subject.schedules.map(
                    (schedule) => Number(schedule.classroom?.id ?? schedule.classroom_id))
                    .filter((id) => Number.isFinite(id) && id > 0))];
                  const studentCount = classroomIds.reduce((total, classroomId) => {
                    const schedule = subject.schedules.find(
                      (item) => Number(item.classroom?.id ?? item.classroom_id) === classroomId);
                    return total + getStudentCount(schedule, classroomStudentCounts);
                  }, 0);

                  return (
                    <div key={subject.id} className="flex flex-col overflow-hidden rounded-[14px] border shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                      style={{ backgroundColor: '#FFFDF8', borderColor: '#E3DACB' }}>
                      <div className="flex items-start gap-3.5 border-b border-[#E3DACB] px-[22px] pb-5 pt-5">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[11px] bg-[#E5ECF5] text-[#3E6BAE]">
                          <BookOpen size={20} strokeWidth={1.8} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h2 className="font-['Fraunces',serif] text-[20px] font-semibold text-[#141C30]">{subject.name}</h2>
                          <p className="mt-1.5 text-[12px] text-[#6B7080]">{subject.classKeys.size} kelas diajar</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 px-[22px] py-4">
                        <div className="rounded-[10px] border border-[#E3DACB] bg-[#FBF9F3] p-3">
                          <div className="font-['Fraunces',serif] text-xl font-semibold text-[#141C30]">{subject.assignments.length}</div>
                          <p className="mt-1 text-[11.5px] text-[#6B7080]">Total tugas dibuat</p>
                        </div>
                        <div className="rounded-[10px] border border-[#E3DACB] bg-[#FBF9F3] p-3">
                          <div className="font-['Fraunces',serif] text-xl font-semibold text-[#141C30]">{studentCount}</div>
                          <p className="mt-1 text-[11.5px] text-[#6B7080]">Total siswa</p>
                        </div>
                      </div>
                      <div className="px-[22px] pb-1">
                        {subjectNeedGrading > 0 ? (
                          <div className="flex items-center gap-2.5 rounded-[10px] border border-[#E4BCA9] bg-[#F6E1D9] px-[13px] py-[11px] text-[13px] text-[#A8503B]">
                            <span className="h-[9px] w-[9px] shrink-0 rounded-full bg-[#A8503B]" />
                            <span><b>{subjectNeedGrading} tugas</b> perlu dinilai</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2.5 rounded-[10px] border border-[#C7DBCC] bg-[#E7F0EA] px-[13px] py-[11px] text-[13px] text-[#4C7A5E]">
                            <span className="h-[9px] w-[9px] shrink-0 rounded-full bg-[#4C7A5E]" />
                            <span className="font-bold">Semua tugas sudah dinilai</span>
                          </div>
                        )}
                        <div className="mt-2.5 flex items-center gap-2.5 rounded-[10px] border border-[#E3DACB] bg-[#FBF9F3] px-[13px] py-[11px] text-[13px] text-[#23283A]">
                          <span className="h-[9px] w-[9px] shrink-0 rounded-full bg-[#B9791F]" />
                          <span><b>{subjectRunning} tugas</b> sedang berjalan</span>
                        </div>
                      </div>
                      <div className="mt-auto px-[22px] pb-5 pt-5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSubjectId(subject.id);
                            setSearch('');
                            try {
                              sessionStorage.setItem(
                                TASK_SUBJECT_STORAGE_KEY,
                                String(subject.id),
                              );
                            } catch {
                              // Navigasi tetap berfungsi meski penyimpanan sesi tidak tersedia.
                            }
                          }}
                          className="flex w-full items-center justify-center gap-2 rounded-[10px] border px-0 py-3 text-[13.5px] font-bold text-white transition hover:opacity-90"
                          style={{ backgroundColor: '#1E2A47', borderColor: '#1E2A47' }}>
                          Lihat kelas <ArrowRight size={15} strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : subjectClassCards.length === 0 ? (
            <div className="rounded-[14px] border px-6 py-16 text-center"
              style={{ backgroundColor: '#FFFDF8', borderColor: '#E3DACB' }}>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[12px] bg-[#E7ECF4] text-[#1E2A47]"><BookOpen size={21} /></div>
              <h2 className="mt-4 text-[19px] font-semibold text-[#141C30]">
                {search ? 'Kelas tidak ditemukan' : 'Belum ada kelas untuk mata pelajaran ini'}
              </h2>
              <p className="mx-auto mt-2 max-w-[430px] text-[13px] leading-6 text-[#6B7080]">
                {search ? 'Tidak ada kelas yang sesuai dengan pencarian.' : 'Kelas akan muncul setelah jadwal mengajar untuk mata pelajaran ini tersedia.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-[18px] xl:grid-cols-2">
              {subjectClassCards.map((group) => {
                const schedule = group.schedule;
                const className = schedule.classroom?.name ?? 'Kelas';
                const studentCount = getStudentCount(schedule, classroomStudentCounts);
                return (
                  <div key={group.key} className="flex flex-col overflow-hidden rounded-[14px] border shadow-sm"
                    style={{ backgroundColor: '#FFFDF8', borderColor: '#E3DACB' }}>
                    <div className="flex items-start gap-3.5 border-b border-[#E3DACB] px-[22px] pb-4 pt-5">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[11px] bg-[#E5ECF5] text-[#3E6BAE]">
                        <BookOpen size={20} strokeWidth={1.8} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="font-['Fraunces',serif] text-[19px] font-semibold text-[#141C30]">
                          {selectedSubject.name} — {className}
                        </h2>
                        <div className="mt-2 flex flex-wrap gap-x-3.5 gap-y-2">
                          <span className="flex items-center gap-1.5 text-[12px] text-[#6B7080]"><Users size={14} opacity={0.75} />{studentCount} siswa</span>
                        </div>
                        <div className="mt-2 flex items-center gap-1.5 text-[11.5px] text-[#8A806F]">
                          <Calendar size={13} strokeWidth={1.9} /><span>{schedule.day ?? 'Jadwal'}</span>
                          <span className="h-1 w-1 rounded-full bg-[#C7C0AC]" />
                          <Clock3 size={13} strokeWidth={1.9} />
                          <span>{schedule.start_time ? schedule.start_time.slice(0, 5) : '--:--'}{' – '}{schedule.end_time ? schedule.end_time.slice(0, 5) : '--:--'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="px-[22px] pb-1 pt-4">{renderCardStatus(group.assignments)}</div>
                    <div className="mt-auto px-[22px] pb-5">
                      <button type="button" onClick={() => navigate(`/guru/tugas/kelola/${schedule.id}`)}
                        disabled={!schedule.id}
                        className="flex w-full items-center justify-center gap-2 rounded-[10px] border px-0 py-3 text-[13.5px] font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                        style={{ backgroundColor: '#1E2A47', borderColor: '#1E2A47' }}>
                        Kelola tugas <ArrowRight size={15} strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                );
              })}
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