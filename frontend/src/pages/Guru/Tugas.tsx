import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  GraduationCap,
  Info,
  Plus,
  Save,
  Search,
  UploadCloud,
  Users,
  X,
} from 'lucide-react';

import api from '../../api/axios';
import { GuruLayout } from '../../layouts/Guru/GuruLayout';


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
  schedule_id: number;
  title: string;
  description?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  schedule?: Schedule;
  questions?: AssignmentQuestion[];
  submissions?: Submission[];
  files?: unknown[];
}

interface QuestionDraft {
  type: AssignmentType;
  question: string;
  order: number;
  is_required: boolean;
  options: {
    option_text: string;
    order: number;
    is_correct: boolean;
  }[];
  correct_answer: string;
}

interface TaskForm {
  scheduleId: string;
  title: string;
  description: string;
  type: AssignmentType | null;
  questionCount: string;
  startDate: string;
  dueDate: string;
}


/*
|--------------------------------------------------------------------------
| CONSTANTS
|--------------------------------------------------------------------------
*/
const TYPE_LABELS: Record<
  AssignmentType,
  string
> = {
  short: 'Jawaban singkat',
  paragraph: 'Paragraf',
  multiple: 'Pilihan ganda',
  checkbox: 'Kotak centang',
  upload: 'Upload file',
  info: 'Catatan informasi',
};

const TYPE_ICONS: Record<
  AssignmentType,
  typeof FileText
> = {
  short: FileText,
  paragraph: FileText,
  multiple: CheckCircle2,
  checkbox: Check,
  upload: UploadCloud,
  info: Info,
};


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

function getErrorMessage(
  error: any,
) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    'Terjadi kesalahan. Silakan coba lagi.'
  );
}

function buildInitialQuestion(
  index: number,
  type: AssignmentType,
): QuestionDraft {
  if (
    type === 'multiple' ||
    type === 'checkbox'
  ) {
    return {
      type,
      question: '',
      order: index,
      is_required: true,
      options: [
        {
          option_text: 'Opsi 1',
          order: 1,
          is_correct:
            type === 'multiple',
        },
        {
          option_text: 'Opsi 2',
          order: 2,
          is_correct: false,
        },
      ],
      correct_answer: '',
    };
  }

  return {
    type,
    question: '',
    order: index,
    is_required: type !== 'info',
    options: [],
    correct_answer: '',
  };
}


/*
|--------------------------------------------------------------------------
| TYPE ICON
|--------------------------------------------------------------------------
*/
function TypeIcon({
  type,
  size = 18,
}: {
  type: AssignmentType;
  size?: number;
}) {
  const Icon = TYPE_ICONS[type];

  return (
    <Icon
      size={size}
      strokeWidth={1.8}
    />
  );
}


/*
|--------------------------------------------------------------------------
| COMPONENT
|--------------------------------------------------------------------------
*/
export default function Tugas() {

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

  const [scheduleLoading, setScheduleLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  const [activeFilter, setActiveFilter] =
    useState<FilterTab>('all');

  const [search, setSearch] =
    useState('');

  const [modalOpen, setModalOpen] =
    useState(false);

  const [modalStep, setModalStep] =
    useState<
      'detail' | 'questions'
    >('detail');

  const [typeMenuOpen, setTypeMenuOpen] =
    useState(false);

  const [classMenuOpen, setClassMenuOpen] =
    useState(false);

  const classDropdownRef =
    useRef<HTMLDivElement | null>(null);

  const [taskForm, setTaskForm] =
    useState<TaskForm>({
      scheduleId: '',
      title: '',
      description: '',
      type: null,
      questionCount: '',
      startDate: '',
      dueDate: '',
    });

  const [questions, setQuestions] =
    useState<QuestionDraft[]>([]);

  const [taskFiles, setTaskFiles] =
    useState<File[]>([]);

  const taskFileInputRef =
    useRef<HTMLInputElement | null>(null);

  const [saving, setSaving] =
    useState(false);

  const [toast, setToast] =
    useState<{
      type: 'success' | 'error';
      message: string;
    } | null>(null);


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

  useEffect(() => {
    if (!modalOpen) {
      return;
    }

    function handleDocumentMouseDown(event: MouseEvent) {
      if (
        classDropdownRef.current &&
        !classDropdownRef.current.contains(
          event.target as Node,
        )
      ) {
        setClassMenuOpen(false);
      }
    }

    function handleDocumentKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setClassMenuOpen(false);
      }
    }

    document.addEventListener(
      'mousedown',
      handleDocumentMouseDown,
    );
    document.addEventListener(
      'keydown',
      handleDocumentKeyDown,
    );

    return () => {
      document.removeEventListener(
        'mousedown',
        handleDocumentMouseDown,
      );
      document.removeEventListener(
        'keydown',
        handleDocumentKeyDown,
      );
    };
  }, [modalOpen]);


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
          if (
            assignment.schedule
              ?.classroom
          ) {
            map.set(
              assignment.schedule
                .classroom.id,
              assignment.schedule
                .classroom,
            );
          }

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

          const schedule =
            assignment.schedule;

          const matchesSearch =
            !keyword ||
            assignment.title
              .toLowerCase()
              .includes(
                keyword,
              ) ||
            schedule?.classroom?.name
              ?.toLowerCase()
              .includes(
                keyword,
              ) ||
            schedule?.subject?.name
              ?.toLowerCase()
              .includes(
                keyword,
              );

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
          const schedule =
            assignment.schedule;

          const key =
            getClassKey(
              schedule,
              assignment.schedule_id,
            );

          if (
            !groups.has(key)
          ) {
            groups.set(
              key,
              {
                key,
                schedule,
                assignments: [],
              },
            );
          }

          groups
            .get(key)!
            .assignments.push(
              assignment,
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
  | SELECTED SCHEDULE
  |--------------------------------------------------------------------------
  */
  const selectedSchedule =
    useMemo(() => {

      return schedules.find(
        (schedule) =>
          String(
            schedule.id,
          ) ===
          taskForm.scheduleId,
      );
    }, [
      schedules,
      taskForm.scheduleId,
    ]);


  /*
  |--------------------------------------------------------------------------
  | DATE VALIDATION
  |--------------------------------------------------------------------------
  */
  const dateRangeInvalid =
    Boolean(
      taskForm.startDate,
    ) &&
    Boolean(
      taskForm.dueDate,
    ) &&
    new Date(
      taskForm.startDate,
    ).getTime() >
      new Date(
        taskForm.dueDate,
      ).getTime();

  /*
  |--------------------------------------------------------------------------
  | STEP 1 VALIDATION
  |--------------------------------------------------------------------------
  */
  const detailReady =
    useMemo(() => {
      if (
        !taskForm.scheduleId ||
        !taskForm.title.trim() ||
        !taskForm.type
      ) {
        return false;
      }

      if (
        taskForm.type !==
          'upload' &&
        taskForm.type !==
          'info'
      ) {

        const count =
          Number(
            taskForm.questionCount,
          );

        if (
          !count ||
          count < 1 ||
          count > 50
        ) {
          return false;
        }
      }

      if (
        dateRangeInvalid
      ) {
        return false;
      }
      return true;
    }, [
      taskForm,
      dateRangeInvalid,
    ]);


  /*
  |--------------------------------------------------------------------------
  | RESET FORM
  |--------------------------------------------------------------------------
  */
  function resetTaskForm() {
    setTaskForm({
      scheduleId: '',
      title: '',
      description: '',
      type: null,
      questionCount: '',
      startDate: '',
      dueDate: '',
    });
    setQuestions([]);
    setTaskFiles([]);

    if (taskFileInputRef.current) {
      taskFileInputRef.current.value = '';
    }

    setTypeMenuOpen(false);
    setModalStep(
      'detail',
    );
  }


  /*
  |--------------------------------------------------------------------------
  | OPEN MODAL
  |--------------------------------------------------------------------------
  */
  function openTaskModal() {
    resetTaskForm();
    setModalOpen(true);
  }

  /*
  |--------------------------------------------------------------------------
  | CLOSE MODAL
  |--------------------------------------------------------------------------
  */
  function closeTaskModal() {
    if (saving) {
      return;
    }
    setModalOpen(false);
    resetTaskForm();
  }


  /*
  |--------------------------------------------------------------------------
  | BACK TO STEP 1
  |--------------------------------------------------------------------------
  */
  function goBackToDetail() {
    if (saving) {
      return;
    }

    setModalStep(
      'detail',
    );
  }


  /*
  |--------------------------------------------------------------------------
  | SELECT ASSIGNMENT TYPE
  |--------------------------------------------------------------------------
  */
  function handleTypeSelect(
    type: AssignmentType,
  ) {
    setTaskForm(
      (current) => ({
        ...current,
        type,
        questionCount:
          type === 'upload' ||
          type === 'info'
            ? ''
            : current.questionCount,

        startDate:
          type === 'info'
            ? ''
            : current.startDate,

        dueDate:
          type === 'info'
            ? ''
            : current.dueDate,
      }),
    );
    setTypeMenuOpen(false);
  }


  /*
  |--------------------------------------------------------------------------
  | NEXT STEP
  |--------------------------------------------------------------------------
  */
  function handleNextStep() {
    if (
      !detailReady ||
      !taskForm.type
    ) {
      return;
    }

    let nextQuestions:
      QuestionDraft[] = [];

    if (
      taskForm.type ===
      'upload'
    ) {
      nextQuestions = [
        {
          type: 'upload',
          question: '',
          order: 1,
          is_required: true,
          options: [],
          correct_answer: '',
        },
      ];
    } else if (
      taskForm.type ===
      'info'
    ) {
      nextQuestions = [
        {
          type: 'info',
          question: '',
          order: 1,
          is_required: false,
          options: [],
          correct_answer: '',
        },
      ];

    } else {
      const count =
        Math.min(
          Math.max(
            Number(
              taskForm.questionCount,
            ) || 1,
            1,
          ),
          50,
        );

      nextQuestions =
        Array.from(
          {
            length: count,
          },
          (_, index) =>
            buildInitialQuestion(
              index + 1,
              taskForm.type!,
            ),
        );
    }

    setQuestions(
      nextQuestions,
    );

    setModalStep(
      'questions',
    );
  }


  /*
  |--------------------------------------------------------------------------
  | UPDATE QUESTION
  |--------------------------------------------------------------------------
  */
  function updateQuestion(
    questionIndex: number,
    changes: Partial<QuestionDraft>,
  ) {
    setQuestions(
      (current) =>
        current.map(
          (
            question,
            index,
          ) =>
            index ===
            questionIndex
              ? {
                  ...question,
                  ...changes,
                }
              : question,
        ),
    );
  }


  /*
  |--------------------------------------------------------------------------
  | UPDATE QUESTION TEXT
  |--------------------------------------------------------------------------
  */
  function updateQuestionText(
    questionIndex: number,
    value: string,
  ) {

    updateQuestion(
      questionIndex,
      {
        question: value,
      },
    );
  }


  /*
  |--------------------------------------------------------------------------
  | UPDATE OPTION TEXT
  |--------------------------------------------------------------------------
  */
  function updateOptionText(
    questionIndex: number,
    optionIndex: number,
    value: string,
  ) {
    setQuestions(
      (current) =>
        current.map(
          (
            question,
            qIndex,
          ) => {

            if (
              qIndex !==
              questionIndex
            ) {
              return question;
            }

            return {
              ...question,

              options:
                question.options.map(
                  (
                    option,
                    oIndex,
                  ) =>
                    oIndex ===
                    optionIndex
                      ? {
                          ...option,
                          option_text:
                            value,
                        }
                      : option,
                ),
            };
          },
        ),
    );
  }


  /*
  |--------------------------------------------------------------------------
  | TOGGLE CORRECT OPTION
  |--------------------------------------------------------------------------
  */
  function toggleCorrectOption(
    questionIndex: number,
    optionIndex: number,
  ) {
    setQuestions(
      (current) =>
        current.map(
          (
            question,
            qIndex,
          ) => {

            if (
              qIndex !==
              questionIndex
            ) {
              return question;
            }

            if (
              question.type !==
                'multiple' &&
              question.type !==
                'checkbox'
            ) {
              return question;
            }

            if (
              question.type ===
              'multiple'
            ) {

              return {
                ...question,

                options:
                  question.options.map(
                    (
                      option,
                      oIndex,
                    ) => ({
                      ...option,
                      is_correct:
                        oIndex ===
                        optionIndex,
                    }),
                  ),
              };
            }

            return {
              ...question,

              options:
                question.options.map(
                  (
                    option,
                    oIndex,
                  ) =>
                    oIndex ===
                    optionIndex
                      ? {
                          ...option,
                          is_correct:
                            !option.is_correct,
                        }
                      : option,
                ),
            };
          },
        ),
    );
  }


  /*
  |--------------------------------------------------------------------------
  | ADD OPTION
  |--------------------------------------------------------------------------
  */
  function addOption(
    questionIndex: number,
  ) {
    setQuestions(
      (current) =>
        current.map(
          (
            question,
            qIndex,
          ) => {

            if (
              qIndex !==
              questionIndex
            ) {
              return question;
            }

            const nextOrder =
              question.options
                .length + 1;

            return {
              ...question,

              options: [
                ...question.options,

                {
                  option_text:
                    `Opsi ${nextOrder}`,
                  order:
                    nextOrder,
                  is_correct:
                    false,
                },
              ],
            };
          },
        ),
    );
  }


  /*
  |--------------------------------------------------------------------------
  | REMOVE OPTION
  |--------------------------------------------------------------------------
  */
  function removeOption(
    questionIndex: number,
    optionIndex: number,
  ) {
    setQuestions(
      (current) =>
        current.map(
          (
            question,
            qIndex,
          ) => {

            if (
              qIndex !==
              questionIndex
            ) {
              return question;
            }

            if (
              question.options
                .length <= 1
            ) {
              return question;
            }

            const options =
              question.options
                .filter(
                  (
                    _,
                    index,
                  ) =>
                    index !==
                    optionIndex,
                )
                .map(
                  (
                    option,
                    index,
                  ) => ({
                    ...option,
                    order:
                      index + 1,
                  }),
                );

            if (
              question.type ===
                'multiple' &&
              !options.some(
                (
                  option,
                ) =>
                  option.is_correct,
              )
            ) {
              options[0].is_correct =
                true;
            }
            return {
              ...question,
              options,
            };
          },
        ),
    );
  }

  /*
  |--------------------------------------------------------------------------
  | TASK MATERIAL FILES
  |--------------------------------------------------------------------------
  */
  function handleTaskFilesSelect(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    if (taskForm.type !== 'info') {
      return;
    }

    const selectedFiles =
      Array.from(
        event.target.files ?? [],
      );

    if (
      selectedFiles.length === 0
    ) {
      return;
    }

    const availableSlots =
      10 - taskFiles.length;

    if (availableSlots <= 0) {
      setToast({
        type: 'error',
        message:
          'Maksimal 10 file materi dapat dilampirkan.',
      });

      if (taskFileInputRef.current) {
        taskFileInputRef.current.value = '';
      }

      return;
    }

    const filesToAdd =
      selectedFiles.slice(
        0,
        availableSlots,
      );

    if (
      selectedFiles.length >
      availableSlots
    ) {
      setToast({
        type: 'error',
        message:
          `Hanya ${availableSlots} file yang dapat ditambahkan. Maksimal 10 file.`,
      });
    }

    setTaskFiles(
      (current) => [
        ...current,
        ...filesToAdd,
      ],
    );

    if (taskFileInputRef.current) {
      taskFileInputRef.current.value = '';
    }
  }

  function removeTaskFile(
    fileIndex: number,
  ) {
    setTaskFiles(
      (current) =>
        current.filter(
          (_, index) =>
            index !== fileIndex,
        ),
    );
  }

  function formatFileSize(
    bytes: number,
  ) {
    if (bytes === 0) {
      return '0 B';
    }

    const units = [
      'B',
      'KB',
      'MB',
      'GB',
    ];

    const unitIndex = Math.floor(
      Math.log(bytes) /
        Math.log(1024),
    );

    const size =
      bytes /
      Math.pow(
        1024,
        unitIndex,
      );

    return `${size.toFixed(
      unitIndex === 0 ? 0 : 1,
    )} ${units[unitIndex]}`;
  }


  /*
  |--------------------------------------------------------------------------
  | VALIDATE QUESTIONS
  |--------------------------------------------------------------------------
  */
  function validateQuestions() {
    if (!taskForm.type) {
      return 'Jenis tugas belum dipilih.';
    }

    if (
      taskForm.type ===
      'info'
    ) {

      if (
        !questions[0]?.question.trim()
      ) {
        return 'Isi catatan informasi terlebih dahulu.';
      }
      return null;
    }

    if (
      taskForm.type ===
      'upload'
    ) {

      if (
        !questions[0]?.question.trim()
      ) {
        return 'Isi instruksi tugas terlebih dahulu.';
      }

      return null;
    }

    for (
      let index = 0;
      index < questions.length;
      index += 1
    ) {

      const question =
        questions[index];

      if (
        !question.question.trim()
      ) {
        return `Pertanyaan soal ${
          index + 1
        } belum diisi.`;
      }

      if (question.type === 'short') {
        if (!question.correct_answer.trim()) {
          return `Kunci jawaban soal ${index + 1} belum diisi.`;
        }
      }

      if (
        question.type ===
          'multiple' ||
        question.type ===
          'checkbox'
      ) {

        if (
          question.options
            .length < 2
        ) {
          return `Soal ${
            index + 1
          } minimal memiliki 2 opsi.`;
        }

        const emptyOption =
          question.options.some(
            (option) =>
              !option.option_text.trim(),
          );

        if (
          emptyOption
        ) {
          return `Masih ada opsi kosong pada soal ${
            index + 1
          }.`;
        }

        const correctCount =
          question.options.filter(
            (option) =>
              option.is_correct,
          ).length;

        if (
          question.type ===
            'multiple' &&
          correctCount !== 1
        ) {
          return `Soal ${
            index + 1
          } harus memiliki tepat 1 jawaban benar.`;
        }

        if (
          question.type ===
            'checkbox' &&
          correctCount < 1
        ) {
          return `Soal ${
            index + 1
          } minimal memiliki 1 jawaban benar.`;
        }
      }
    }
    return null;
  }


  /*
  |--------------------------------------------------------------------------
  | CREATE ASSIGNMENT
  |--------------------------------------------------------------------------
  */
  async function createAssignment() {

    const validationError =
      validateQuestions();

    if (
      validationError
    ) {
      setToast({
        type: 'error',
        message:
          validationError,
      });
      return;
    }

    if (
      !taskForm.scheduleId ||
      !taskForm.type
    ) {
      return;
    }

    try {
      setSaving(true);

      const formData =
        new FormData();

      formData.append(
        'schedule_id',
        String(
          Number(
            taskForm.scheduleId,
          ),
        ),
      );

      formData.append(
        'title',
        taskForm.title.trim(),
      );

      formData.append(
        'description',
        taskForm.description.trim(),
      );

      if (
        taskForm.type !== 'info'
      ) {
        if (taskForm.startDate) {
          formData.append(
            'start_date',
            taskForm.startDate,
          );
        }

        if (taskForm.dueDate) {
          formData.append(
            'due_date',
            taskForm.dueDate,
          );
        }
      }

      questions.forEach(
        (
          question,
          index,
        ) => {
          formData.append(
            `questions[${index}][type]`,
            question.type,
          );

          formData.append(
            `questions[${index}][question]`,
            question.question.trim(),
          );

          formData.append(
            `questions[${index}][order]`,
            String(index + 1),
          );

          formData.append(
            `questions[${index}][is_required]`,
            question.is_required
              ? '1'
              : '0',
          );

          formData.append(
            `questions[${index}][correct_answer]`,
            question.type === 'short'
              ? question.correct_answer.trim()
              : '',
          );

          if (
            question.type ===
              'multiple' ||
            question.type ===
              'checkbox'
          ) {
            question.options.forEach(
              (
                option,
                optionIndex,
              ) => {
                formData.append(
                  `questions[${index}][options][${optionIndex}][option_text]`,
                  option.option_text.trim(),
                );

                formData.append(
                  `questions[${index}][options][${optionIndex}][order]`,
                  String(
                    optionIndex + 1,
                  ),
                );

                formData.append(
                  `questions[${index}][options][${optionIndex}][is_correct]`,
                  option.is_correct
                    ? '1'
                    : '0',
                );
              },
            );
          }
        },
      );

      if (
        taskForm.type === 'info'
      ) {
        taskFiles.forEach(
          (file) => {
            formData.append(
              'files[]',
              file,
            );
          },
        );
      }

      await api.post(
        '/guru/tugas',
        formData,
      );

      setToast({
        type: 'success',
        message:
          taskForm.type === 'info'
            ? taskFiles.length > 0
              ? 'Catatan informasi dan materi berhasil dikirim.'
              : 'Catatan informasi berhasil dikirim.'
            : 'Tugas berhasil dibuat.',
      });

      setModalOpen(false);
      resetTaskForm();
      await loadAssignments();
    } catch (err: any) {
      setToast({
        type: 'error',
        message:
          getErrorMessage(err),
      });
    } finally {
      setSaving(false);
    }
  }

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
  function renderQuestionBlock(
    question: QuestionDraft,
    index: number,
  ) {
    const isChoice =
      question.type ===
        'multiple' ||
      question.type ===
        'checkbox';

    return (
      <div
        key={index}
        className="mb-3.5 rounded-[12px] border px-[18px] pb-[18px] pt-4"
        style={{
          borderColor:
            '#E3DACB',
          backgroundColor:
            '#FFFDF8',
        }}
      >

        <div className="mb-3">
          <span
            className="text-[11px] font-bold uppercase tracking-[0.03em]"
            style={{
              color:
                '#6B7080',
            }}
          >
            Soal {index + 1}
          </span>
        </div>

        <div
          className="mb-3.5 flex items-center gap-[9px] rounded-[10px] border px-[13px]"
          style={{
            borderColor:
              '#E3DACB',
            backgroundColor:
              '#FFFDF8',
          }}
        >

          <input
            type="text"
            value={
              question.question
            }
            onChange={(
              event,
            ) =>
              updateQuestionText(
                index,
                event.target.value,
              )
            }
            placeholder={`Tulis pertanyaan soal ${
              index + 1
            }...`}
            className="w-full border-none bg-transparent py-[11px] text-[13.5px] outline-none"
            style={{
              color:
                '#23283A',
            }}
          />
        </div>

        {question.type ===
          'short' && (
          <div className="mt-3 rounded-[10px] border px-3.5 py-3" style={{ borderColor: '#E3DACB', backgroundColor: '#FBF9F3' }}>
            <label className="mb-2 block text-[11.5px] font-bold uppercase tracking-[0.03em]" style={{ color: '#6B7080' }}>
              Kunci jawaban
            </label>
            <input
              type="text"
              value={question.correct_answer}
              onChange={(event) =>
                updateQuestion(index, {
                  correct_answer: event.target.value,
                })
              }
              placeholder="Masukkan jawaban yang benar..."
              className="w-full rounded-[8px] border bg-[#FFFDF8] px-3 py-2.5 text-[13px] outline-none"
              style={{
                borderColor: '#E3DACB',
                color: '#23283A',
              }}
            />
            <div className="mt-1.5 text-[10.5px]" style={{ color: '#8A806F' }}>
              Jawaban ini akan digunakan sebagai kunci untuk penilaian otomatis.
            </div>
          </div>
        )}

        {question.type ===
          'paragraph' && (
          <div
            className="min-h-[70px] rounded-[9px] border border-dashed px-[14px] py-3 text-[12.5px] italic"
            style={{
              borderColor:
                '#E3DACB',
              backgroundColor:
                '#FBF9F3',
              color:
                '#6B7080',
            }}
          >
            Kolom jawaban
            paragraf siswa
          </div>
        )}

        {isChoice && (
          <>
            <div className="mb-0.5">
              {question.options.map(
                (
                  option,
                  optionIndex,
                ) => (

                  <div
                    key={optionIndex}
                    className={`mb-[9px] flex items-center gap-2.5 ${
                      option.is_correct
                        ? 'rounded-[9px] px-1.5 py-1'
                        : ''
                    }`}
                    style={
                      option.is_correct
                        ? {
                            backgroundColor:
                              '#E7F0EA',
                            marginLeft:
                              '-6px',
                            marginRight:
                              '-6px',
                          }
                        : undefined
                    }
                  >

                    <span
                      className={`h-[17px] w-[17px] shrink-0 border-[1.5px] ${
                        question.type ===
                        'multiple'
                          ? 'rounded-full'
                          : 'rounded-[4px]'
                      }`}
                      style={{
                        borderColor:
                          '#6B7080',
                      }}
                    />

                    <input
                      type="text"
                      value={
                        option.option_text
                      }
                      onChange={(
                        event,
                      ) =>
                        updateOptionText(
                          index,
                          optionIndex,
                          event
                            .target
                            .value,
                        )
                      }
                      className="flex-1 border-0 border-b bg-transparent px-0.5 py-[7px] text-[13px] outline-none"
                      style={{
                        borderBottomColor:
                          '#E3DACB',
                        color:
                          '#23283A',
                      }}
                    />

                    <button
                      type="button"
                      onClick={() =>
                        toggleCorrectOption(
                          index,
                          optionIndex,
                        )
                      }
                      title="Tandai sebagai jawaban benar"
                      className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] border-[1.5px] transition"
                      style={{
                        backgroundColor:
                          option.is_correct
                            ? '#4C7A5E'
                            : '#FFFDF8',
                        borderColor:
                          option.is_correct
                            ? '#4C7A5E'
                            : '#E3DACB',
                        color:
                          option.is_correct
                            ? '#fff'
                            : '#6B7080',
                      }}
                    >
                      <Check
                        size={13}
                        strokeWidth={
                          2.6
                        }
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        removeOption(
                          index,
                          optionIndex,
                        )
                      }
                      className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] border-0 bg-transparent"
                      style={{
                        color:
                          '#6B7080',
                      }}
                      title="Hapus opsi"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ),
              )}
            </div>

            <button
              type="button"
              onClick={() =>
                addOption(index)
              }
              className="flex items-center gap-2.5 border-0 bg-transparent px-0.5 py-1 text-[12.5px] font-semibold"
              style={{
                color:
                  '#6B7080',
              }}
            >

              <span
                className="flex h-[17px] w-[17px] items-center justify-center rounded-full border-[1.5px] border-dashed"
                style={{
                  borderColor:
                    '#6B7080',
                }}
              >
                <Plus size={10} />
              </span>
              Tambah opsi
            </button>

            <div
              className="mt-2 text-[11.5px] italic"
              style={{
                color:
                  '#6B7080',
              }}
            >
              {question.type ===
              'multiple'
                ? 'Siswa hanya dapat memilih satu opsi.'
                : 'Siswa dapat memilih lebih dari satu opsi.'}
            </div>

          </>
        )}

      </div>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | SPECIAL QUESTION
  |--------------------------------------------------------------------------
  */
  function renderSpecialQuestion() {

    if (!taskForm.type) {
      return null;
    }


    /*
    | INFO
    */
    if (
      taskForm.type ===
      'info'
    ) {

      return (
        <div
          className="rounded-[12px] border px-[18px] pb-[18px] pt-4"
          style={{
            borderColor:
              '#E3DACB',
            backgroundColor:
              '#FFFDF8',
          }}
        >

          <div className="mb-3">
            <span
              className="text-[11px] font-bold uppercase tracking-[0.03em]"
              style={{
                color:
                  '#6B7080',
              }}
            >
              Isi catatan
              informasi
            </span>
          </div>

          <div
            className="mb-4 rounded-[10px] border"
            style={{
              borderColor:
                '#E3DACB',
              backgroundColor:
                '#FFFDF8',
            }}
          >

            <textarea
              value={
                questions[0]
                  ?.question ?? ''
              }
              onChange={(
                event,
              ) =>
                updateQuestion(
                  0,
                  {
                    question:
                      event.target
                        .value,
                  },
                )
              }
              rows={6}
              placeholder="Tulis catatan, pengumuman, atau informasi untuk siswa di sini..."
              className="w-full resize-none border-none bg-transparent px-[13px] py-[11px] text-[13.5px] outline-none"
              style={{
                color:
                  '#23283A',
              }}
            />
          </div>

          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <div
                className="text-[11px] font-bold uppercase tracking-[0.03em]"
                style={{
                  color:
                    '#6B7080',
                }}
              >
                Materi
                pembelajaran
                <span
                  className="ml-1 normal-case font-normal tracking-normal"
                  style={{
                    color:
                      '#8A806F',
                  }}
                >
                  (opsional)
                </span>
              </div>

              <div
                className="mt-1 text-[11.5px] leading-[1.5]"
                style={{
                  color:
                    '#8A806F',
                }}
              >
                Lampirkan materi
                pembelajaran jika
                diperlukan. Siswa
                dapat melihat dan
                mengunduh file yang
                Anda lampirkan.
              </div>
            </div>

            <span
              className="shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold"
              style={{
                backgroundColor:
                  '#F5F1E7',
                color:
                  '#6B7080',
              }}
            >
              {taskFiles.length}/10
              {' '}file
            </span>
          </div>

          <input
            ref={taskFileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={
              handleTaskFilesSelect
            }
          />

          <button
            type="button"
            onClick={() =>
              taskFileInputRef.current?.click()
            }
            disabled={
              taskFiles.length >= 10 ||
              saving
            }
            className="mb-3.5 flex w-full items-center justify-center gap-2 rounded-[10px] border border-dashed px-4 py-3 text-[12.5px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              borderColor:
                '#D5CBB8',
              backgroundColor:
                '#FBF9F3',
              color:
                '#7A5A20',
            }}
          >
            <UploadCloud
              size={16}
              strokeWidth={1.8}
            />
            Tambahkan materi
          </button>

          {taskFiles.length > 0 && (
            <div className="mb-3.5 flex flex-col gap-2">
              {taskFiles.map(
                (
                  file,
                  index,
                ) => (
                  <div
                    key={`${file.name}-${file.size}-${index}`}
                    className="flex items-center gap-3 rounded-[10px] border px-3 py-2.5"
                    style={{
                      borderColor:
                        '#E3DACB',
                      backgroundColor:
                        '#FFFDF8',
                    }}
                  >
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px]"
                      style={{
                        backgroundColor:
                          '#E5ECF5',
                        color:
                          '#3E6BAE',
                      }}
                    >
                      <FileText
                        size={17}
                        strokeWidth={1.8}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div
                        className="truncate text-[12px] font-semibold"
                        style={{
                          color:
                            '#23283A',
                        }}
                        title={
                          file.name
                        }
                      >
                        {file.name}
                      </div>

                      <div
                        className="mt-0.5 text-[10.5px]"
                        style={{
                          color:
                            '#8A806F',
                        }}
                      >
                        {formatFileSize(
                          file.size,
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        removeTaskFile(
                          index,
                        )
                      }
                      disabled={saving}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] border-0 bg-transparent transition disabled:cursor-not-allowed disabled:opacity-50"
                      style={{
                        color:
                          '#6B7080',
                      }}
                      title="Hapus materi"
                    >
                      <X
                        size={14}
                      />
                    </button>
                  </div>
                ),
              )}
            </div>
          )}

          <div
            className="flex items-start gap-[9px] rounded-[10px] border px-[13px] py-[11px] text-[12px] leading-[1.5]"
            style={{
              backgroundColor:
                '#E5ECF5',
              borderColor:
                '#CBDAEC',
              color:
                '#3E6BAE',
            }}
          >

            <Info
              size={14}
              className="mt-0.5 shrink-0"
              strokeWidth={1.9}
            />

            <span>
              Catatan ini hanya
              digunakan untuk
              memberikan informasi
              kepada siswa. Siswa
              tidak perlu mengirimkan
              submission. File materi
              yang dilampirkan dapat
              dilihat dan diunduh oleh
              siswa.
            </span>
          </div>
        </div>
      );
    }

    /*
    | UPLOAD
    */
    return (
      <div
        className="rounded-[12px] border px-[18px] pb-[18px] pt-4"
        style={{
          borderColor:
            '#E3DACB',
          backgroundColor:
            '#FFFDF8',
        }}
      >

        <div className="mb-3">
          <span
            className="text-[11px] font-bold uppercase tracking-[0.03em]"
            style={{
              color:
                '#6B7080',
            }}
          >
            Instruksi tugas
          </span>
        </div>

        <div
          className="mb-3.5 rounded-[10px] border"
          style={{
            borderColor:
              '#E3DACB',
            backgroundColor:
              '#FFFDF8',
          }}
        >

          <input
            type="text"
            value={
              questions[0]
                ?.question ?? ''
            }
            onChange={(
              event,
            ) =>
              updateQuestion(
                0,
                {
                  question:
                    event.target
                      .value,
                },
              )
            }
            placeholder="Contoh: Kumpulkan hasil pekerjaan dalam format PDF"
            className="w-full border-none bg-transparent px-[13px] py-[11px] text-[13.5px] outline-none"
            style={{
              color:
                '#23283A',
            }}
          />
        </div>

        <div
          className="rounded-[12px] border-2 border-dashed px-5 py-[30px] text-center"
          style={{
            borderColor:
              '#E3DACB',
            backgroundColor:
              '#FBF9F3',
            color:
              '#6B7080',
          }}
        >
          <UploadCloud
            size={26}
            className="mx-auto mb-2.5"
            style={{
              color:
                '#B98A3E',
            }}
            strokeWidth={1.7}
          />

          <div
            className="text-[13px] font-semibold"
            style={{
              color:
                '#141C30',
            }}
          >
            Kotak unggah file
          </div>

          <div className="mt-1 text-[11.5px]">
            Siswa akan
            mengunggah file
            tugasnya di sini
          </div>
        </div>
      </div>
    );
  }


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
                onClick={
                  openTaskModal
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
                    onClick={
                      openTaskModal
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
                          className="flex w-full items-center justify-center gap-2 rounded-[10px] border px-0 py-3 text-[13.5px] font-bold text-white transition hover:opacity-90"
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
        {modalOpen && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-6"
            style={{
              backgroundColor:
                'rgba(20,17,10,0.5)',
            }}
            onMouseDown={(
              event,
            ) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                closeTaskModal();
              }
            }}
          >

            {/* ===================================================
                STEP 1
            ==================================================== */}
            {modalStep ===
              'detail' && (
              <div
                className="flex w-full max-w-[640px] flex-col overflow-hidden rounded-[18px]"
                style={{
                  maxHeight:
                    '88vh',
                  backgroundColor:
                    '#FFFDF8',
                  boxShadow:
                    '0 24px 60px -20px rgba(20,17,10,0.45)',
                }}
              >
                <div className="flex shrink-0 items-start justify-between border-b px-6 pb-4 pt-[22px]">
                  <div>

                    <span
                      className="mb-2 inline-block rounded-full px-[9px] py-[3px] text-[10.5px] font-bold uppercase tracking-[0.03em]"
                      style={{
                        color:
                          '#B98A3E',
                        backgroundColor:
                          '#E7D3A8',
                      }}
                    >
                      Langkah 1
                      dari 2
                    </span>

                    <h2
                      className="text-[19px] font-semibold"
                      style={{
                        color:
                          '#141C30',
                        fontFamily:
                          '"Fraunces", serif',
                      }}
                    >
                      Buat tugas baru
                    </h2>

                    <p
                      className="mt-1 text-[12.5px]"
                      style={{
                        color:
                          '#6B7080',
                      }}
                    >
                      Isi detail tugas
                      yang akan
                      diberikan kepada
                      siswa.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={
                      closeTaskModal
                    }
                    className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] border"
                    style={{
                      borderColor:
                        '#E3DACB',
                      backgroundColor:
                        '#FFFDF8',
                      color:
                        '#6B7080',
                    }}
                    title="Tutup"
                  >
                    <X size={15} />
                  </button>
                </div>


                <div className="flex-1 overflow-y-auto px-6 pb-1 pt-5">

                  {/* KELAS */}
                  <div className="mb-[18px]">
                    <label
                      className="mb-2 block text-[13px] font-bold"
                      style={{
                        color:
                          '#141C30',
                      }}
                    >
                      Kelas{' '}
                      <span
                        style={{
                          color:
                            '#A8503B',
                        }}
                      >
                        *
                      </span>
                    </label>

                    <div
                      ref={classDropdownRef}
                      className="relative"
                    >

                      <button
                        type="button"
                        disabled={scheduleLoading}
                        onClick={() =>
                          setClassMenuOpen(
                            (current) => !current,
                          )
                        }
                        className="group flex w-full items-center gap-3 rounded-[12px] border px-[13px] py-[10px] text-left transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-70"
                        style={{
                          borderColor:
                            classMenuOpen
                              ? '#2C3B5E'
                              : '#E3DACB',
                          backgroundColor:
                            '#FFFDF8',
                          boxShadow:
                            classMenuOpen
                              ? '0 0 0 3px rgba(44,59,94,0.10), 0 10px 25px -18px rgba(20,28,48,0.45)'
                              : '0 4px 12px -10px rgba(20,28,48,0.18)',
                        }}
                        aria-haspopup="listbox"
                        aria-expanded={
                          classMenuOpen
                        }
                      >

                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] transition-colors duration-150"
                          style={{
                            backgroundColor:
                              taskForm.scheduleId
                                ? '#E7ECF4'
                                : '#F5F1E7',
                            color:
                              taskForm.scheduleId
                                ? '#1E2A47'
                                : '#8A806F',
                          }}
                        >
                          <GraduationCap
                            size={17}
                            strokeWidth={1.8}
                          />
                        </span>

                        <span className="min-w-0 flex-1">
                          {selectedSchedule ? (
                            <>
                              <span
                                className="block truncate text-[13px] font-bold"
                                style={{
                                  color:
                                    '#141C30',
                                }}
                              >
                                {selectedSchedule
                                  .classroom
                                  ?.name ??
                                  'Kelas'}
                              </span>

                              <span
                                className="mt-0.5 flex items-center gap-1.5 truncate text-[11px]"
                                style={{
                                  color:
                                    '#6B7080',
                                }}
                              >
                                <span className="truncate">
                                  {selectedSchedule
                                    .subject
                                    ?.name ??
                                    'Mata pelajaran'}
                                </span>

                                <span
                                  className="h-1 w-1 shrink-0 rounded-full"
                                  style={{
                                    backgroundColor:
                                      '#C7C0AC',
                                  }}
                                />

                                <span className="shrink-0">
                                  {selectedSchedule.day ??
                                    'Jadwal'}
                                  {selectedSchedule.start_time
                                    ? ` · ${selectedSchedule.start_time.slice(0, 5)}`
                                    : ''}
                                </span>
                              </span>
                            </>
                          ) : (
                            <span
                              className="block text-[13.5px] font-semibold"
                              style={{
                                color:
                                  '#B3AE9C',
                              }}
                            >
                              {scheduleLoading
                                ? 'Memuat daftar kelas...'
                                : 'Pilih kelas yang akan diberi tugas'}
                            </span>
                          )}
                        </span>

                        <ChevronDown
                          size={16}
                          style={{
                            color:
                              '#6B7080',
                            transform:
                              classMenuOpen
                                ? 'rotate(180deg)'
                                : 'rotate(0deg)',
                            transition:
                              'transform 0.18s ease',
                          }}
                        />

                      </button>


                      {classMenuOpen && (
                        <div
                          className="absolute left-0 top-[calc(100%+7px)] z-[40] w-full overflow-hidden rounded-[15px] border"
                          style={{
                            backgroundColor:
                              '#FFFDF8',
                            borderColor:
                              '#E3DACB',
                            boxShadow:
                              '0 20px 45px -18px rgba(20,28,48,0.32), 0 6px 18px -10px rgba(20,28,48,0.16)',
                          }}
                          role="listbox"
                          aria-label="Pilih kelas"
                        >

                          <div
                            className="border-b px-3.5 py-3"
                            style={{
                              backgroundColor:
                                '#FBF9F3',
                              borderColor:
                                '#E3DACB',
                            }}
                          >
                            <div className="flex items-center gap-2.5">
                              <span
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px]"
                                style={{
                                  backgroundColor:
                                    '#E7D3A8',
                                  color:
                                    '#7A5A20',
                                }}
                              >
                                <BookOpen
                                  size={15}
                                  strokeWidth={1.9}
                                />
                              </span>

                              <div className="min-w-0">
                                <div
                                  className="text-[11px] font-bold uppercase tracking-[0.08em]"
                                  style={{
                                    color:
                                      '#8A806F',
                                  }}
                                >
                                  Pilih kelas
                                </div>

                                <div
                                  className="mt-0.5 text-[12px]"
                                  style={{
                                    color:
                                      '#6B7080',
                                  }}
                                >
                                  Pilih jadwal mengajar yang akan diberi tugas.
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="max-h-[255px] overflow-y-auto p-1.5">
                            {schedules.length > 0 ? (
                              schedules.map(
                                (
                                  schedule,
                                ) => {
                                  const isSelected =
                                    String(
                                      schedule.id,
                                    ) ===
                                    taskForm.scheduleId;

                                  return (
                                    <button
                                      key={
                                        schedule.id
                                      }
                                      type="button"
                                      role="option"
                                      aria-selected={
                                        isSelected
                                      }
                                      onClick={() => {
                                        setTaskForm(
                                          (
                                            current,
                                          ) => ({
                                            ...current,
                                            scheduleId:
                                              String(
                                                schedule.id,
                                              ),
                                          }),
                                        );
                                        setClassMenuOpen(
                                          false,
                                        );
                                      }}
                                      className="group mb-1 flex w-full items-center gap-3 rounded-[11px] px-2.5 py-2.5 text-left transition-all duration-150 last:mb-0"
                                      style={{
                                        backgroundColor:
                                          isSelected
                                            ? '#EAF0F7'
                                            : 'transparent',
                                      }}
                                      onMouseEnter={(
                                        event,
                                      ) => {
                                        if (!isSelected) {
                                          event.currentTarget.style.backgroundColor =
                                            '#F5F1E7';
                                        }
                                      }}
                                      onMouseLeave={(
                                        event,
                                      ) => {
                                        if (!isSelected) {
                                          event.currentTarget.style.backgroundColor =
                                            'transparent';
                                        }
                                      }}
                                    >

                                      <span
                                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-[10.5px] font-bold"
                                        style={{
                                          backgroundColor:
                                            isSelected
                                              ? '#DCE6F2'
                                              : '#F5F1E7',
                                          color:
                                            isSelected
                                              ? '#1E2A47'
                                              : '#6B7080',
                                        }}
                                      >
                                        {schedule.classroom?.name
                                          ? schedule.classroom.name
                                              .replace(/\s+/g, '')
                                              .slice(0, 4)
                                              .toUpperCase()
                                          : 'KLS'}
                                      </span>

                                      <span className="min-w-0 flex-1">
                                        <span
                                          className="block truncate text-[13px] font-bold"
                                          style={{
                                            color:
                                              '#141C30',
                                          }}
                                        >
                                          {schedule
                                            .classroom
                                            ?.name ??
                                            'Kelas'}
                                        </span>

                                        <span
                                          className="mt-0.5 block truncate text-[11.5px]"
                                          style={{
                                            color:
                                              '#6B7080',
                                          }}
                                        >
                                          {schedule
                                            .subject
                                            ?.name ??
                                            'Mata pelajaran'}
                                        </span>

                                        <span
                                          className="mt-1 flex items-center gap-1.5 text-[10.5px]"
                                          style={{
                                            color:
                                              '#8A806F',
                                          }}
                                        >
                                          <Calendar
                                            size={11}
                                            strokeWidth={1.9}
                                          />
                                          <span>
                                            {schedule.day ??
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
                                            size={11}
                                            strokeWidth={1.9}
                                          />
                                          <span>
                                            {schedule.start_time
                                              ? schedule.start_time.slice(0, 5)
                                              : '--:--'}
                                            {' – '}
                                            {schedule.end_time
                                              ? schedule.end_time.slice(0, 5)
                                              : '--:--'}
                                          </span>
                                        </span>
                                      </span>

                                      <span
                                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all duration-150"
                                        style={{
                                          backgroundColor:
                                            isSelected
                                              ? '#1E2A47'
                                              : '#F5F1E7',
                                          color:
                                            isSelected
                                              ? '#FFFFFF'
                                              : 'transparent',
                                        }}
                                      >
                                        <Check
                                          size={13}
                                          strokeWidth={2.6}
                                        />
                                      </span>

                                    </button>
                                  );
                                },
                              )
                            ) : (
                              <div className="px-4 py-8 text-center">
                                <span
                                  className="mx-auto flex h-10 w-10 items-center justify-center rounded-[10px]"
                                  style={{
                                    backgroundColor:
                                      '#F6E1D9',
                                    color:
                                      '#A8503B',
                                  }}
                                >
                                  <Calendar
                                    size={17}
                                  />
                                </span>

                                <div
                                  className="mt-2 text-[12.5px] font-semibold"
                                  style={{
                                    color:
                                      '#141C30',
                                  }}
                                >
                                  Belum ada jadwal mengajar
                                </div>

                                <div
                                  className="mt-1 text-[11px] leading-[1.5]"
                                  style={{
                                    color:
                                      '#6B7080',
                                  }}
                                >
                                  Jadwal kelas Anda belum tersedia untuk dipilih.
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {scheduleLoading && (
                      <div
                        className="mt-1.5 flex items-center gap-1.5 text-[11.5px]"
                        style={{
                          color:
                            '#6B7080',
                        }}
                      >
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#D9BE86] border-t-transparent" />
                        Memuat daftar kelas...
                      </div>
                    )}

                    {!scheduleLoading &&
                      schedules.length ===
                        0 && (
                        <div
                          className="mt-1.5 text-[11.5px]"
                          style={{
                            color:
                              '#A8503B',
                          }}
                        >
                          Belum ada jadwal mengajar yang tersedia.
                        </div>
                      )}
                  </div>

                  {/* JUDUL */}
                  <div className="mb-[18px]">
                    <label
                      className="mb-2 block text-[13px] font-bold"
                      style={{
                        color:
                          '#141C30',
                      }}
                    >
                      Judul tugas{' '}
                      <span
                        style={{
                          color:
                            '#A8503B',
                        }}
                      >
                        *
                      </span>
                    </label>

                    <div
                      className="flex items-center gap-[9px] rounded-[10px] border px-[13px]"
                      style={{
                        borderColor:
                          '#E3DACB',
                        backgroundColor:
                          '#FFFDF8',
                      }}
                    >

                      <FileText
                        size={16}
                        style={{
                          color:
                            '#6B7080',
                        }}
                      />

                      <input
                        type="text"
                        value={
                          taskForm.title
                        }
                        onChange={(
                          event,
                        ) =>
                          setTaskForm(
                            (
                              current,
                            ) => ({
                              ...current,
                              title:
                                event
                                  .target
                                  .value,
                            }),
                          )
                        }
                        placeholder="Masukkan judul tugas"
                        className="w-full border-none bg-transparent py-[11px] text-[13.5px] outline-none"
                        style={{
                          color:
                            '#23283A',
                        }}
                      />
                    </div>
                  </div>

                  {/* DESKRIPSI */}
                  <div className="mb-[18px]">
                    <label
                      className="mb-2 block text-[13px] font-bold"
                      style={{
                        color:
                          '#141C30',
                      }}
                    >
                      Deskripsi{' '}
                      <span
                        className="ml-1 text-[11.5px] font-medium"
                        style={{
                          color:
                            '#6B7080',
                        }}
                      >
                        (opsional)
                      </span>
                    </label>

                    <div
                      className="rounded-[10px] border"
                      style={{
                        borderColor:
                          '#E3DACB',
                        backgroundColor:
                          '#FFFDF8',
                      }}
                    >

                      <textarea
                        value={
                          taskForm.description
                        }
                        onChange={(
                          event,
                        ) =>
                          setTaskForm(
                            (
                              current,
                            ) => ({
                              ...current,
                              description:
                                event
                                  .target
                                  .value,
                            }),
                          )
                        }
                        placeholder="Jelaskan instruksi pengerjaan tugas ini..."
                        className="min-h-[64px] w-full resize-none border-none bg-transparent px-[13px] py-[11px] text-[13.5px] outline-none"
                        style={{
                          color:
                            '#23283A',
                        }}
                      />
                    </div>
                  </div>

                  {/* JENIS TUGAS */}
                  <div className="mb-[18px]">
                    <label
                      className="mb-2 block text-[13px] font-bold"
                      style={{
                        color:
                          '#141C30',
                      }}
                    >
                      Jenis tugas{' '}
                      <span
                        style={{
                          color:
                            '#A8503B',
                        }}
                      >
                        *
                      </span>
                    </label>


                    <div className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setTypeMenuOpen(
                            (
                              current,
                            ) =>
                              !current,
                          )
                        }
                        className="flex w-full items-center gap-2.5 rounded-[10px] border px-[13px] py-[11px] text-left text-[13.5px]"
                        style={{
                          borderColor:
                            typeMenuOpen
                              ? '#2C3B5E'
                              : '#E3DACB',
                          backgroundColor:
                            '#FFFDF8',
                          boxShadow:
                            typeMenuOpen
                              ? '0 0 0 3px rgba(44,59,94,0.12)'
                              : undefined,
                        }}
                      >
                        <span
                          className="flex h-5 w-5 shrink-0 items-center justify-center"
                          style={{
                            color:
                              '#6B7080',
                          }}
                        >
                          {taskForm.type ? (

                            <TypeIcon
                              type={
                                taskForm.type
                              }
                            />
                          ) : (
                            <FileText
                              size={18}
                              strokeWidth={
                                1.8
                              }
                            />
                          )}
                        </span>

                        <span
                          className="flex-1 font-semibold"
                          style={{
                            color:
                              taskForm.type
                                ? '#141C30'
                                : '#B3AE9C',
                          }}
                        >
                          {taskForm.type
                            ? TYPE_LABELS[
                                taskForm.type
                              ]
                            : 'Pilih jenis tugas'}
                        </span>

                        <ChevronDown
                          size={13}
                          style={{
                            color:
                              '#6B7080',
                            transform:
                              typeMenuOpen
                                ? 'rotate(180deg)'
                                : undefined,
                            transition:
                              'transform 0.15s ease',
                          }}
                        />
                      </button>

                      {typeMenuOpen && (
                        <div
                          className="absolute left-0 top-[calc(100%+6px)] z-[30] w-full rounded-[12px] border p-1.5"
                          style={{
                            backgroundColor:
                              '#FFFDF8',
                            borderColor:
                              '#E3DACB',
                            boxShadow:
                              '0 14px 34px -10px rgba(20,17,10,0.25)',
                          }}
                        >
                          {(
                            [
                              'short',
                              'paragraph',
                              'multiple',
                              'checkbox',
                              'upload',
                              'info',
                            ] as AssignmentType[]
                          ).map(
                            (
                              type,
                              index,
                            ) => (

                              <div
                                key={
                                  type
                                }
                              >
                                {(
                                  index ===
                                    2 ||
                                  index ===
                                    4 ||
                                  index ===
                                    5
                                ) && (

                                  <div
                                    className="my-1.5 h-px"
                                    style={{
                                      backgroundColor:
                                        '#E3DACB',
                                    }}
                                  />
                                )}

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleTypeSelect(
                                      type,
                                    )
                                  }
                                  className="flex w-full items-center gap-3 rounded-[8px] px-3 py-2.5 text-left text-[13.5px]"
                                  style={{
                                    backgroundColor:
                                      taskForm.type ===
                                      type
                                        ? '#E5ECF5'
                                        : 'transparent',
                                    color:
                                      taskForm.type ===
                                      type
                                        ? '#3E6BAE'
                                        : '#23283A',
                                  }}
                                >

                                  <TypeIcon
                                    type={
                                      type
                                    }
                                    size={
                                      18
                                    }
                                  />

                                  <span className="flex-1">
                                    {
                                      TYPE_LABELS[
                                        type
                                      ]
                                    }
                                  </span>
                                </button>
                              </div>
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* JUMLAH SOAL */}
                  {taskForm.type &&
                    taskForm.type !==
                      'upload' &&
                    taskForm.type !==
                      'info' && (

                      <div className="mb-[18px]">
                        <label
                          className="mb-2 block text-[13px] font-bold"
                          style={{
                            color:
                              '#141C30',
                          }}
                        >
                          Jumlah soal{' '}
                          <span
                            style={{
                              color:
                                '#A8503B',
                            }}
                          >
                            *
                          </span>
                        </label>

                        <div
                          className="flex items-center gap-[9px] rounded-[10px] border px-[13px]"
                          style={{
                            borderColor:
                              '#E3DACB',
                            backgroundColor:
                              '#FFFDF8',
                          }}
                        >

                          <FileText
                            size={16}
                            style={{
                              color:
                                '#6B7080',
                            }}
                          />

                          <input
                            type="number"
                            min={1}
                            max={50}
                            value={
                              taskForm.questionCount
                            }
                            onChange={(
                              event,
                            ) =>
                              setTaskForm(
                                (
                                  current,
                                ) => ({
                                  ...current,
                                  questionCount:
                                    event
                                      .target
                                      .value,
                                }),
                              )
                            }
                            placeholder="Contoh: 5"
                            className="w-full border-none bg-transparent py-[11px] text-[13.5px] outline-none"
                            style={{
                              color:
                                '#23283A',
                            }}
                          />
                        </div>

                        <div
                          className="mt-1.5 text-[11.5px] leading-[1.5]"
                          style={{
                            color:
                              '#6B7080',
                          }}
                        >
                          Anda akan membuat
                          soal sebanyak
                          jumlah ini pada
                          langkah berikutnya.
                        </div>
                      </div>
                    )}

                  {/* TANGGAL */}
                  {taskForm.type !==
                    'info' &&
                    taskForm.type && (
                      <>
                        <div className="mb-[18px]">
                          <label
                            className="mb-2 block text-[13px] font-bold"
                            style={{
                              color:
                                '#141C30',
                            }}
                          >
                            Tanggal mulai
                            dikerjakan{' '}

                            <span
                              className="ml-1 text-[11.5px] font-medium"
                              style={{
                                color:
                                  '#6B7080',
                              }}
                            >
                              (opsional)
                            </span>
                          </label>

                          <div
                            className="flex items-center gap-[9px] rounded-[10px] border px-[13px]"
                            style={{
                              borderColor:
                                '#E3DACB',
                              backgroundColor:
                                '#FFFDF8',
                            }}
                          >

                            <Calendar
                              size={16}
                              style={{
                                color:
                                  '#6B7080',
                              }}
                            />

                            <input
                              type="datetime-local"
                              value={
                                taskForm.startDate
                              }
                              onChange={(
                                event,
                              ) =>
                                setTaskForm(
                                  (
                                    current,
                                  ) => ({
                                    ...current,
                                    startDate:
                                      event
                                        .target
                                        .value,
                                  }),
                                )
                              }
                              className="w-full border-none bg-transparent py-[11px] text-[13.5px] outline-none"
                              style={{
                                color:
                                  '#23283A',
                              }}
                            />
                          </div>

                          <div
                            className="mt-1.5 text-[11.5px] leading-[1.5]"
                            style={{
                              color:
                                '#6B7080',
                            }}
                          >
                            Tugas baru bisa
                            dibuka dan
                            dikerjakan siswa
                            mulai waktu ini.
                          </div>
                        </div>

                        <div className="mb-[18px]">
                          <label
                            className="mb-2 block text-[13px] font-bold"
                            style={{
                              color:
                                '#141C30',
                            }}
                          >
                            Tenggat
                            pengumpulan{' '}

                            <span
                              className="ml-1 text-[11.5px] font-medium"
                              style={{
                                color:
                                  '#6B7080',
                              }}
                            >
                              (opsional)
                            </span>
                          </label>

                          <div
                            className="flex items-center gap-[9px] rounded-[10px] border px-[13px]"
                            style={{
                              borderColor:
                                dateRangeInvalid
                                  ? '#E4BCA9'
                                  : '#E3DACB',
                              backgroundColor:
                                '#FFFDF8',
                            }}
                          >

                            <Calendar
                              size={16}
                              style={{
                                color:
                                  '#6B7080',
                              }}
                            />

                            <input
                              type="datetime-local"
                              value={
                                taskForm.dueDate
                              }
                              onChange={(
                                event,
                              ) =>
                                setTaskForm(
                                  (
                                    current,
                                  ) => ({
                                    ...current,
                                    dueDate:
                                      event
                                        .target
                                        .value,
                                  }),
                                )
                              }
                              className="w-full border-none bg-transparent py-[11px] text-[13.5px] outline-none"
                              style={{
                                color:
                                  '#23283A',
                              }}
                            />
                          </div>

                          {dateRangeInvalid && (
                            <div
                              className="mt-2 flex items-start gap-1.5 text-[11.5px] leading-[1.5]"
                              style={{
                                color:
                                  '#A8503B',
                              }}
                            >

                              <AlertCircle
                                size={14}
                                className="mt-0.5 shrink-0"
                              />

                              <span>
                                Tanggal mulai
                                tidak boleh
                                melewati tenggat
                                pengumpulan.
                              </span>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                  {/* SELECTED SCHEDULE */}
                  {selectedSchedule && (
                    <div
                      className="mb-[18px] rounded-[10px] border px-[13px] py-[11px] text-[12px]"
                      style={{
                        backgroundColor:
                          '#E5ECF5',
                        borderColor:
                          '#CBDAEC',
                        color:
                          '#3E6BAE',
                      }}
                    >

                      <b>
                        {selectedSchedule
                          .subject
                          ?.name ??
                          'Mata pelajaran'}
                      </b>{' '}
                      ·{' '}
                      {selectedSchedule
                        .classroom
                        ?.name ??
                        'Kelas'}
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 justify-end gap-2.5 border-t px-6 py-4">
                  <button
                    type="button"
                    onClick={
                      closeTaskModal
                    }
                    className="rounded-[10px] border px-[22px] py-[11px] text-[13.5px] font-bold"
                    style={{
                      borderColor:
                        '#E3DACB',
                      backgroundColor:
                        '#FFFDF8',
                      color:
                        '#23283A',
                    }}
                  >
                    Batal
                  </button>

                  <button
                    type="button"
                    disabled={
                      !detailReady
                    }
                    onClick={
                      handleNextStep
                    }
                    className="flex items-center gap-2 rounded-[10px] border px-[22px] py-[11px] text-[13.5px] font-bold text-white disabled:cursor-not-allowed"
                    style={{
                      backgroundColor:
                        detailReady
                          ? '#1E2A47'
                          : '#C7C0AC',
                      borderColor:
                        detailReady
                          ? '#1E2A47'
                          : '#C7C0AC',
                    }}
                  >
                    Lanjutkan
                    <ArrowRight
                      size={14}
                      strokeWidth={2}
                    />
                  </button>
                </div>
              </div>
            )}


            {/* ===================================================
                STEP 2
            ==================================================== */}
            {modalStep ===
              'questions' && (
              <div
                className="flex w-full max-w-[640px] flex-col overflow-hidden rounded-[18px]"
                style={{
                  maxHeight:
                    '88vh',
                  backgroundColor:
                    '#FFFDF8',
                  boxShadow:
                    '0 24px 60px -20px rgba(20,17,10,0.45)',
                }}
              >

                <div className="flex shrink-0 items-start justify-between border-b px-6 pb-4 pt-[22px]">
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={
                        goBackToDetail
                      }
                      className="mt-[22px] flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] border"
                      style={{
                        borderColor:
                          '#E3DACB',
                        backgroundColor:
                          '#FFFDF8',
                        color:
                          '#6B7080',
                      }}
                      title="Kembali"
                    >
                      <ArrowLeft
                        size={15}
                      />
                    </button>

                    <div>
                      <span
                        className="mb-2 inline-block rounded-full px-[9px] py-[3px] text-[10.5px] font-bold uppercase tracking-[0.03em]"
                        style={{
                          color:
                            '#B98A3E',
                          backgroundColor:
                            '#E7D3A8',
                        }}
                      >
                        Langkah 2
                        dari 2
                      </span>

                      <h2
                        className="text-[19px] font-semibold"
                        style={{
                          color:
                            '#141C30',
                          fontFamily:
                            '"Fraunces", serif',
                        }}
                      >
                        {taskForm.title ||
                          'Buat soal'}
                      </h2>

                      <p
                        className="mt-1 text-[12.5px]"
                        style={{
                          color:
                            '#6B7080',
                        }}
                      >
                        {taskForm.type
                          ? TYPE_LABELS[
                              taskForm.type
                            ]
                          : '-'}{' '}
                        ·{' '}

                        {taskForm.type ===
                          'upload' ||
                        taskForm.type ===
                          'info'
                          ? selectedSchedule
                              ?.classroom
                              ?.name ??
                            'Kelas'
                          : `${questions.length} soal · ${
                              selectedSchedule
                                ?.classroom
                                ?.name ??
                              'Kelas'
                            }`}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={
                      closeTaskModal
                    }
                    className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] border"
                    style={{
                      borderColor:
                        '#E3DACB',
                      backgroundColor:
                        '#FFFDF8',
                      color:
                        '#6B7080',
                    }}
                    title="Tutup"
                  >
                    <X size={15} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 pb-1 pt-5">

                  {taskForm.type ===
                  'upload' ? (

                    renderSpecialQuestion()

                  ) : taskForm.type ===
                    'info' ? (

                    renderSpecialQuestion()

                  ) : (

                    questions.map(
                      (
                        question,
                        index,
                      ) =>
                        renderQuestionBlock(
                          question,
                          index,
                        ),
                    )
                  )}
                </div>

                <div className="flex shrink-0 flex-wrap items-center justify-between gap-2.5 border-t px-6 py-4">
                  <button
                    type="button"
                    onClick={
                      goBackToDetail
                    }
                    className="rounded-[10px] border px-[22px] py-[11px] text-[13.5px] font-bold"
                    style={{
                      borderColor:
                        '#E3DACB',
                      backgroundColor:
                        '#FFFDF8',
                      color:
                        '#23283A',
                    }}
                  >
                    Kembali
                  </button>

                  <div className="flex flex-wrap gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setToast({
                          type: 'success',
                          message:
                            'Fitur simpan draft akan dihubungkan ke status draft pada tahap berikutnya.',
                        });
                      }}
                      className="flex items-center gap-2 rounded-[10px] border px-5 py-[11px] text-[13.5px] font-bold"
                      style={{
                        backgroundColor:
                          '#E7D3A8',
                        borderColor:
                          '#D9BE86',
                        color:
                          '#7A5A20',
                      }}
                    >
                      <Save
                        size={14}
                        strokeWidth={
                          1.9
                        }
                      />
                      Simpan draft
                    </button>

                    <button
                      type="button"
                      disabled={saving}
                      onClick={
                        createAssignment
                      }
                      className="flex items-center gap-2 rounded-[10px] border px-[22px] py-[11px] text-[13.5px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-70"
                      style={{
                        backgroundColor:
                          '#1E2A47',
                        borderColor:
                          '#1E2A47',
                      }}
                    >
                      {saving ? (
                        <>
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          Menyimpan...
                        </>
                      ) : (

                        <>
                          <CheckCircle2
                            size={14}
                            strokeWidth={
                              2
                            }
                          />

                          {taskForm.type ===
                          'info'
                            ? 'Kirim informasi'
                            : 'Buat tugas'}

                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================
            TOAST
        ========================================================== */}
        {toast && (
          <div
            className="fixed bottom-5 right-5 z-[150] flex max-w-[380px] items-start gap-2.5 rounded-[12px] border px-4 py-3 text-[13px] shadow-lg"
            style={{
              backgroundColor:
                toast.type ===
                'success'
                  ? '#E7F0EA'
                  : '#F6E1D9',

              borderColor:
                toast.type ===
                'success'
                  ? '#C7DBCC'
                  : '#E4BCA9',

              color:
                toast.type ===
                'success'
                  ? '#4C7A5E'
                  : '#A8503B',
            }}
          >

            {toast.type ===
            'success' ? (

              <CheckCircle2
                size={17}
                className="mt-0.5 shrink-0"
              />
            ) : (

              <AlertCircle
                size={17}
                className="mt-0.5 shrink-0"
              />
            )}

            <span className="flex-1">
              {toast.message}
            </span>

            <button
              type="button"
              onClick={() =>
                setToast(null)
              }
              className="shrink-0"
            >
              <X size={15} />
            </button>
          </div>
        )}
      </div>
    </GuruLayout>
  );
}