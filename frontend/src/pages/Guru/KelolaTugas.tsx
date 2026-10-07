import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Info,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  Send,
  UploadCloud,
  X,
} from 'lucide-react';

import {
  useNavigate,
  useParams,
} from 'react-router-dom';

import api from '../../api/axios';
import BuatTugasModal from '../../components/Guru/BuatTugasModal';
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

type AssignmentStatus =
  | 'active'
  | 'scheduled'
  | 'closed'
  | 'draft';

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
  option_text?: string;
  order?: number;
  is_correct?: boolean;
}

interface AssignmentQuestion {
  id?: number;
  assignment_id?: number;
  type: AssignmentType;
  question?: string;
  order?: number;
  is_required?: boolean;
  correct_answer?: string | null;
  options?: AssignmentOption[];
}

interface SubmissionAnswerOption {
  id?: number;
  option_id?: number;
  option?: AssignmentOption;
}

interface SubmissionAnswer {
  id?: number;
  submission_id?: number;
  assignment_question_id?: number;
  question_id?: number;
  answer?: string | null;
  text_answer?: string | null;
  answer_text?: string | null;
  is_correct?: boolean | null;
  points?: number | string | null;
  selected_options?: SubmissionAnswerOption[];
  selectedOptions?: SubmissionAnswerOption[];
  question?: AssignmentQuestion;
}

interface SubmissionFile {
  id?: number;
  submission_id?: number;
  file_path?: string | null;
  original_name?: string | null;
  file_name?: string | null;
  filename?: string | null;
  size?: number | null;
  mime_type?: string | null;
  created_at?: string | null;
}

interface SubmissionStudent {
  id?: number;
  name?: string;
  user?: UserData;
}

interface Submission {
  id: number;
  student_id?: number;
  student?: SubmissionStudent;
  grade?: number | string | null;
  teacher_feedback?: string | null;
  student_note?: string | null;
  created_at?: string;
  updated_at?: string;
  answers?: SubmissionAnswer[];
  selectedOptions?: SubmissionAnswerOption[];
  files?: SubmissionFile[];
}

interface TaskCommentUser {
  id?: number;
  name?: string;
  email?: string;
  role?: string;
}

interface TaskComment {
  id: number;
  assignment_id?: number;
  classroom_id?: number;
  user_id?: number;
  comment: string;
  created_at?: string;
  updated_at?: string;
  user?: TaskCommentUser;
}

interface AssignmentFile {
  id?: number;
  assignment_id?: number;
  file_path?: string;
  original_name?: string;
  file_name?: string;
  filename?: string;
  size?: number;
  mime_type?: string;
}

interface Assignment {
  id: number;
  title: string;
  description?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  submission_mode?: SubmissionMode;
  status?: AssignmentStatus | string;
  schedule_id?: number | null;

  schedule?: Schedule;
  schedules?: Schedule[];

  questions?: AssignmentQuestion[];
  submissions?: Submission[];
  files?: AssignmentFile[];
  comments?: TaskComment[];
}

interface ManageResponse {
  schedule?: Schedule;
  assignments?: Assignment[];
  data?: Assignment[] | {
    schedule?: Schedule;
    assignments?: Assignment[];
  };
  message?: string;
}


/*
|--------------------------------------------------------------------------
| CONSTANTS
|--------------------------------------------------------------------------
*/

const COLORS = {
  bg: '#F5F1E7',
  paper: '#FFFDF8',
  navy: '#1E2A47',
  navyDeep: '#141C30',
  navySoft: '#2C3B5E',
  gold: '#B98A3E',
  goldSoft: '#E7D3A8',
  ink: '#23283A',
  inkSoft: '#6B7080',
  green: '#4C7A5E',
  greenBg: '#E7F0EA',
  rust: '#A8503B',
  rustBg: '#F6E1D9',
  rustLine: '#E4BCA9',
  amber: '#B9791F',
  amberBg: '#F4E4C8',
  blue: '#3E6BAE',
  blueBg: '#E5ECF5',
  plum: '#7A4C6E',
  plumBg: '#EFE2EC',
  line: '#E3DACB',
};

const TYPE_META: Record<
  AssignmentType,
  {
    label: string;
    color: 'blue' | 'green' | 'gold' | 'plum';
  }
> = {
  short: {
    label: 'Jawaban singkat',
    color: 'blue',
  },
  paragraph: {
    label: 'Paragraf',
    color: 'blue',
  },
  multiple: {
    label: 'Pilihan ganda',
    color: 'green',
  },
  checkbox: {
    label: 'Kotak centang',
    color: 'green',
  },
  upload: {
    label: 'Upload file',
    color: 'gold',
  },
  info: {
    label: 'Catatan informasi',
    color: 'plum',
  },
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

function formatTime(
  value?: string | null,
) {
  if (!value) {
    return '-';
  }

  return value.slice(0, 5);
}

function formatDate(
  value?: string | null,
) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(
    'id-ID',
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    },
  );
}

function formatDateTime(
  value?: string | null,
) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${date.toLocaleDateString(
    'id-ID',
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    },
  )} ${date.toLocaleTimeString(
    'id-ID',
    {
      hour: '2-digit',
      minute: '2-digit',
    },
  )}`;
}

function formatRelativeTime(
  value?: string | null,
) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const diff =
    Date.now() -
    date.getTime();

  const seconds =
    Math.floor(diff / 1000);

  if (seconds < 60) {
    return 'Baru saja';
  }

  const minutes =
    Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes} menit lalu`;
  }

  const hours =
    Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} jam lalu`;
  }

  const days =
    Math.floor(hours / 24);

  if (days < 7) {
    return `${days} hari lalu`;
  }

  return formatDate(value);
}

function getErrorMessage(
  error: unknown,
) {
  const response =
    (
      error as {
        response?: {
          data?: {
            message?: string;
            error?: string;
          };
        };
      }
    )?.response?.data;

  return (
    response?.message ||
    response?.error ||
    'Terjadi kesalahan. Silakan coba lagi.'
  );
}

function getAssignmentType(
  assignment: Assignment,
): AssignmentType {
  const type =
    assignment.questions?.[0]?.type;

  if (
    type === 'short' ||
    type === 'paragraph' ||
    type === 'multiple' ||
    type === 'checkbox' ||
    type === 'upload' ||
    type === 'info'
  ) {
    return type;
  }

  if (
    assignment.files &&
    assignment.files.length > 0
  ) {
    return 'upload';
  }

  return 'info';
}

function getTypeMeta(
  assignment: Assignment,
) {
  return TYPE_META[
    getAssignmentType(
      assignment,
    )
  ];
}

function getTypeIcon(
  type: AssignmentType,
) {
  switch (type) {
    case 'multiple':
      return CheckCircle2;

    case 'checkbox':
      return Check;

    case 'upload':
      return UploadCloud;

    case 'info':
      return Info;

    case 'paragraph':
    case 'short':
    default:
      return FileText;
  }
}

function getTypeColors(
  color:
    | 'blue'
    | 'green'
    | 'gold'
    | 'plum',
) {
  switch (color) {
    case 'green':
      return {
        bg: COLORS.greenBg,
        fg: COLORS.green,
      };

    case 'gold':
      return {
        bg: COLORS.goldSoft,
        fg: '#7A5A20',
      };

    case 'plum':
      return {
        bg: COLORS.plumBg,
        fg: COLORS.plum,
      };

    case 'blue':
    default:
      return {
        bg: COLORS.blueBg,
        fg: COLORS.blue,
      };
  }
}

function getAssignmentSchedules(
  assignment: Assignment,
): Schedule[] {
  if (
    Array.isArray(
      assignment.schedules,
    ) &&
    assignment.schedules.length > 0
  ) {
    return assignment.schedules;
  }

  if (assignment.schedule) {
    return [assignment.schedule];
  }

  return [];
}

function getStudentName(
  submission: Submission,
) {
  return (
    submission.student?.user?.name ||
    submission.student?.name ||
    'Siswa'
  );
}

function getSubmissionGrade(
  submission: Submission,
) {
  if (
    submission.grade === null ||
    submission.grade === undefined ||
    submission.grade === ''
  ) {
    return null;
  }

  const grade =
    Number(submission.grade);

  return Number.isFinite(grade)
    ? grade
    : null;
}

function getSubmissionAnswers(
  submission: Submission,
) {
  return (
    submission.answers ?? []
  );
}

function getSelectedOptions(
  answer: SubmissionAnswer,
) {
  return (
    answer.selected_options ||
    answer.selectedOptions ||
    []
  );
}

function getAnswerText(
  answer: SubmissionAnswer,
) {
  return (
    answer.answer ??
    answer.text_answer ??
    answer.answer_text ??
    ''
  );
}

// function getQuestionLabel(
//   question: AssignmentQuestion,
//   index: number,
// ) {
//   if (
//     question.question &&
//     question.question.trim()
//   ) {
//     return question.question;
//   }

//   return `Soal ${index + 1}`;
// }

function getAssignmentStatus(
  assignment: Assignment,
): AssignmentStatus {
  if (
    assignment.status === 'draft'
  ) {
    return 'draft';
  }

  const now =
    Date.now();

  const start =
    assignment.start_date
      ? new Date(
          assignment.start_date,
        ).getTime()
      : null;

  const due =
    assignment.due_date
      ? new Date(
          assignment.due_date,
        ).getTime()
      : null;

  if (
    start !== null &&
    start > now
  ) {
    return 'scheduled';
  }

  if (
    due !== null &&
    due < now
  ) {
    return 'closed';
  }

  return 'active';
}

function getStatusLabel(
  status: AssignmentStatus,
) {
  switch (status) {
    case 'scheduled':
      return 'Terjadwal';

    case 'closed':
      return 'Selesai';

    case 'draft':
      return 'Draft';

    case 'active':
    default:
      return 'Aktif';
  }
}

function getStatusClasses(
  status: AssignmentStatus,
) {
  switch (status) {
    case 'scheduled':
      return {
        backgroundColor:
          COLORS.amberBg,
        color: COLORS.amber,
      };

    case 'closed':
      return {
        backgroundColor:
          '#E7ECF4',
        color: COLORS.navy,
      };

    case 'draft':
      return {
        backgroundColor:
          '#EFE9DB',
        color: COLORS.inkSoft,
      };

    case 'active':
    default:
      return {
        backgroundColor:
          COLORS.greenBg,
        color: COLORS.green,
      };
  }
}

function getSubmissionCount(
  assignment: Assignment,
) {
  return (
    assignment.submissions?.length ??
    0
  );
}

function getUngradedCount(
  assignment: Assignment,
) {
  return (
    assignment.submissions ?? []
  ).filter(
    (submission) =>
      getSubmissionGrade(
        submission,
      ) === null,
  ).length;
}

function getTotalStudents(
  assignment: Assignment,
  schedule?: Schedule,
) {
  if (
    schedule?.classroom?.students_count !==
    undefined
  ) {
    return (
      schedule.classroom.students_count
    );
  }

  return getSubmissionCount(
    assignment,
  );
}

function getSemesterLabel() {
  const now =
    new Date();

  const month =
    now.getMonth();

  const year =
    now.getFullYear();

  if (
    month >= 6
  ) {
    return `Semester ganjil ${year}/${year + 1}`;
  }

  return `Semester genap ${year - 1}/${year}`;
}

function getScheduleLabel(
  schedule?: Schedule,
) {
  if (!schedule) {
    return '-';
  }

  const day =
    schedule.day || '';

  const start =
    formatTime(
      schedule.start_time,
    );

  const end =
    formatTime(
      schedule.end_time,
    );

  if (
    day &&
    start !== '-' &&
    end !== '-'
  ) {
    return `${day}, ${start}–${end}`;
  }

  if (
    start !== '-' &&
    end !== '-'
  ) {
    return `${start}–${end}`;
  }

  return day || '-';
}

function getFileName(
  file: SubmissionFile,
) {
  return (
    file.original_name ||
    file.file_name ||
    file.filename ||
    file.file_path ||
    'File tugas'
  );
}


/*
|--------------------------------------------------------------------------
| SMALL UI COMPONENTS
|--------------------------------------------------------------------------
*/

function SummaryItem({
  icon,
  value,
  label,
  danger = false,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  danger?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-[10px]"
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px]"
        style={{
          backgroundColor:
            danger
              ? COLORS.rustBg
              : '#E7ECF4',
          color:
            danger
              ? COLORS.rust
              : COLORS.navy,
        }}
      >
        {icon}
      </div>

      <div>
        <div
          className="text-[18px] font-semibold leading-none"
          style={{
            color:
              danger
                ? COLORS.rust
                : COLORS.navyDeep,
            fontFamily:
              '"Fraunces", serif',
          }}
        >
          {value}
        </div>

        <div
          className="mt-[3px] text-[11px]"
          style={{
            color:
              COLORS.inkSoft,
          }}
        >
          {label}
        </div>
      </div>
    </div>
  );
}

function ModalShell({
  children,
  onClose,
  maxWidth = '760px',
}: {
  children: React.ReactNode;
  onClose: () => void;
  maxWidth?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{
        backgroundColor:
          'rgba(20,17,10,0.48)',
      }}
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div
        className="flex w-full flex-col overflow-hidden rounded-[18px]"
        style={{
          maxWidth,
          maxHeight:
            'calc(100vh - 32px)',
          backgroundColor:
            COLORS.paper,
          boxShadow:
            '0 24px 60px -20px rgba(20,17,10,0.45)',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function CommentRow({
  comment,
}: {
  comment: TaskComment;
}) {
  const name =
    comment.user?.name ||
    'Pengguna';

  const role =
    comment.user?.role ===
    'guru'
      ? 'Guru'
      : 'Siswa';

  return (
    <div
      className="flex gap-3 border-b py-3 last:border-b-0"
      style={{
        borderColor:
          COLORS.line,
      }}
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
        style={{
          backgroundColor:
            role === 'Guru'
              ? COLORS.navy
              : COLORS.goldSoft,
          color:
            role === 'Guru'
              ? '#fff'
              : '#7A5A20',
        }}
      >
        {getInitials(name)}
      </div>

      <div
        className="min-w-0 flex-1"
      >
        <div
          className="flex flex-wrap items-center gap-1.5"
        >
          <span
            className="text-[12.5px] font-bold"
            style={{
              color:
                COLORS.navyDeep,
            }}
          >
            {name}
          </span>

          <span
            className="rounded-full px-1.5 py-[2px] text-[9px] font-bold"
            style={{
              backgroundColor:
                role === 'Guru'
                  ? COLORS.blueBg
                  : COLORS.goldSoft,
              color:
                role === 'Guru'
                  ? COLORS.blue
                  : '#7A5A20',
            }}
          >
            {role}
          </span>

          <span
            className="text-[10.5px]"
            style={{
              color:
                COLORS.inkSoft,
            }}
          >
            {formatRelativeTime(
              comment.created_at,
            )}
          </span>
        </div>

        <div
          className="mt-1 text-[12.5px] leading-[1.6]"
          style={{
            color:
              COLORS.ink,
          }}
        >
          {comment.comment}
        </div>
      </div>
    </div>
  );
}


/*
|--------------------------------------------------------------------------
| TASK CARD
|--------------------------------------------------------------------------
*/

function TaskCard({
  assignment,
  schedule,
  onOpen,
}: {
  assignment: Assignment;
  schedule?: Schedule;
  onOpen: () => void;
}) {
  const type =
    getAssignmentType(
      assignment,
    );

  const meta =
    getTypeMeta(
      assignment,
    );

  const Icon =
    getTypeIcon(type);

  const colors =
    getTypeColors(
      meta.color,
    );

  const status =
    getAssignmentStatus(
      assignment,
    );

  const statusStyle =
    getStatusClasses(
      status,
    );

  const submissions =
    getSubmissionCount(
      assignment,
    );

  const totalStudents =
    getTotalStudents(
      assignment,
      schedule,
    );

  const ungraded =
    getUngradedCount(
      assignment,
    );

  const comments =
    assignment.comments ??
    [];

  const visibleComments =
    comments.slice(-2);

  const hiddenCommentCount =
    Math.max(
      0,
      comments.length - 2,
    );

  const [
    showPreviousComments,
    setShowPreviousComments,
  ] = useState(false);

  const commentsToRender =
    showPreviousComments
      ? comments
      : visibleComments;

  return (
    <div
      className="overflow-hidden rounded-[14px] border"
      style={{
        backgroundColor:
          COLORS.paper,
        borderColor:
          status === 'draft'
            ? '#CFC6AE'
            : COLORS.line,
        borderStyle:
          status === 'draft'
            ? 'dashed'
            : 'solid',
        boxShadow:
          '0 1px 2px rgba(30,25,15,0.04), 0 8px 24px -12px rgba(30,25,15,0.10)',
      }}
    >
      <button
        type="button"
        onClick={onOpen}
        className="group w-full cursor-pointer px-5 py-[18px] text-left transition"
        style={{
          backgroundColor:
            'transparent',
        }}
        onMouseEnter={(
          event,
        ) => {
          event.currentTarget.style.backgroundColor =
            '#FBF8EF';
        }}
        onMouseLeave={(
          event,
        ) => {
          event.currentTarget.style.backgroundColor =
            'transparent';
        }}
      >
        <div
          className="flex items-start gap-[13px]"
        >
          <div
            className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px]"
            style={{
              backgroundColor:
                colors.bg,
              color:
                colors.fg,
            }}
          >
            <Icon
              size={18}
              strokeWidth={1.8}
            />
          </div>

          <div
            className="min-w-0 flex-1"
          >
            <div
              className="flex flex-wrap items-center gap-[9px]"
            >
              <span
                className="text-[15.5px] font-bold"
                style={{
                  color:
                    COLORS.navyDeep,
                }}
              >
                {assignment.title}
              </span>

              <span
                className="rounded-full px-[9px] py-[2px] text-[10.5px] font-bold"
                style={statusStyle}
              >
                {getStatusLabel(
                  status,
                )}
              </span>
            </div>

            <div
              className="mt-1 text-[11.5px]"
              style={{
                color:
                  COLORS.inkSoft,
              }}
            >
              {meta.label}

              {assignment.questions &&
                assignment.questions.length >
                  0 &&
                type !== 'upload' &&
                type !== 'info' && (
                  <>
                    {' · '}
                    {
                      assignment.questions
                        .length
                    }{' '}
                    soal
                  </>
                )}
            </div>

            {type !== 'info' && (
              <div
                className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11.5px]"
                style={{
                  color:
                    COLORS.inkSoft,
                }}
              >
                {status ===
                'draft' ? (
                  <span>
                    Belum dipublikasikan ke
                    siswa
                  </span>
                ) : (
                  <>
                    <span>
                      Mulai{' '}
                      {formatDate(
                        assignment.start_date,
                      )}
                    </span>

                    <span>
                      Tenggat{' '}
                      {formatDate(
                        assignment.due_date,
                      )}
                    </span>

                    <span>
                      {submissions}/
                      {totalStudents}{' '}
                      mengumpulkan
                    </span>

                    {ungraded > 0 ? (
                      <span
                        className="flex items-center gap-1 font-bold"
                        style={{
                          color:
                            COLORS.rust,
                        }}
                      >
                        <AlertCircle
                          size={12}
                        />
                        {ungraded}{' '}
                        perlu dinilai
                      </span>
                    ) : (
                      <span
                        className="font-bold"
                        style={{
                          color:
                            COLORS.green,
                        }}
                      >
                        Semua sudah
                        dinilai
                      </span>
                    )}
                  </>
                )}
              </div>
            )}

            {type === 'info' &&
              (() => {
                const infoContent =
                  assignment.questions
                    ?.find(
                      (question) =>
                        question.type === 'info',
                    )
                    ?.question
                    ?.trim() ||
                  assignment.description
                    ?.trim() ||
                  '';

                if (!infoContent) {
                  return null;
                }

                return (
                  <div
                    className="mt-3 rounded-[10px] border px-3.5 py-3"
                    style={{
                      backgroundColor:
                        '#FAF4F8',
                      borderColor:
                        '#E4D3DF',
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px]"
                        style={{
                          backgroundColor:
                            COLORS.plumBg,
                          color:
                            COLORS.plum,
                        }}
                      >
                        <Info
                          size={14}
                          strokeWidth={2}
                        />
                      </div>

                      <p
                        className="line-clamp-3 min-w-0 text-[12px] leading-[1.6]"
                        style={{
                          color:
                            COLORS.ink,
                        }}
                      >
                        {infoContent}
                      </p>
                    </div>
                  </div>
                );
              })()}
          </div>

          <ChevronRight
            size={17}
            className="mt-1 shrink-0"
            style={{
              color:
                COLORS.inkSoft,
            }}
          />
        </div>
      </button>

      {visibleComments.length >
        0 && (
        <div
          className="border-t px-5"
          style={{
            borderColor:
              COLORS.line,
          }}
        >
          <div
            className="flex items-center gap-1.5 pt-3 text-[11.5px] font-bold"
            style={{
              color:
                COLORS.navy,
            }}
          >
            <MessageCircle
              size={14}
            />
            Diskusi tugas ini (
            {comments.length})
          </div>

          {hiddenCommentCount >
            0 && (
            <button
              type="button"
              onClick={() =>
                setShowPreviousComments(
                  (current) => !current,
                )
              }
              className="block py-2 text-left text-[11px] font-semibold transition hover:underline"
              style={{
                color:
                  COLORS.gold,
              }}
            >
              {showPreviousComments
                ? 'Sembunyikan komentar sebelumnya'
                : `Lihat ${hiddenCommentCount} komentar sebelumnya`}
            </button>
          )}

          <div className="pb-1">
            {commentsToRender.map(
              (comment) => (
                <CommentRow
                  key={
                    comment.id
                  }
                  comment={
                    comment
                  }
                />
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}


/*
|--------------------------------------------------------------------------
| ANSWER BLOCK
|--------------------------------------------------------------------------
*/

function AnswerBlock({
  question,
  answer,
  index,
}: {
  question?: AssignmentQuestion;
  answer?: SubmissionAnswer;
  index: number;
}) {
  const answerText =
    answer
      ? getAnswerText(
          answer,
        )
      : '';

  const selectedOptions =
    answer
      ? getSelectedOptions(
          answer,
        )
      : [];

  const selectedLabels =
    selectedOptions
      .map(
        (
          selected,
        ) =>
          selected.option
            ?.option_text ||
          '',
      )
      .filter(Boolean);

  const isCorrect =
    answer?.is_correct;

  return (
    <div
      className="rounded-[11px] border p-3.5"
      style={{
        borderColor:
          COLORS.line,
        backgroundColor:
          '#FBF8EF',
      }}
    >
      <div
        className="mb-2 text-[11px] font-bold uppercase tracking-[0.04em]"
        style={{
          color:
            COLORS.gold,
        }}
      >
        Soal {index + 1}
      </div>

      <div
        className="text-[13px] font-bold leading-[1.5]"
        style={{
          color:
            COLORS.navyDeep,
        }}
      >
        {question?.question ||
          `Soal ${index + 1}`}
      </div>

      <div
        className="mt-3 rounded-[9px] border px-3 py-2.5 text-[12.5px] leading-[1.6]"
        style={{
          borderColor:
            COLORS.line,
          backgroundColor:
            COLORS.paper,
          color:
            COLORS.ink,
        }}
      >
        {selectedLabels.length >
        0 ? (
          <div className="space-y-1">
            {selectedLabels.map(
              (
                label,
                optionIndex,
              ) => (
                <div
                  key={
                    optionIndex
                  }
                >
                  {label}
                </div>
              ),
            )}
          </div>
        ) : answerText ? (
          answerText
        ) : (
          <span
            style={{
              color:
                COLORS.inkSoft,
              fontStyle:
                'italic',
            }}
          >
            Tidak ada jawaban
          </span>
        )}
      </div>

      {answer &&
        isCorrect !==
          null &&
        isCorrect !==
          undefined && (
          <div
            className="mt-2 flex items-center gap-1.5 text-[11px] font-bold"
            style={{
              color:
                isCorrect
                  ? COLORS.green
                  : COLORS.rust,
            }}
          >
            {isCorrect ? (
              <CheckCircle2
                size={13}
              />
            ) : (
              <AlertCircle
                size={13}
              />
            )}

            {isCorrect
              ? 'Jawaban benar'
              : 'Jawaban salah'}
          </div>
        )}
    </div>
  );
}


/*
|--------------------------------------------------------------------------
| STUDENT ANSWER DETAIL
|--------------------------------------------------------------------------
*/

function StudentAnswerDetail({
  submission,
  assignment,
  onEditGrade,
}: {
  submission: Submission;
  assignment: Assignment;
  onEditGrade: () => void;
}) {
  const questions =
    assignment.questions ??
    [];

  const answers =
    getSubmissionAnswers(
      submission,
    );

  const grade =
    getSubmissionGrade(
      submission,
    );

  const files =
    submission.files ??
    [];

  return (
    <div className="space-y-5">
      <div
        className="rounded-[12px] border p-4"
        style={{
          backgroundColor:
            '#FBF8EF',
          borderColor:
            COLORS.line,
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div
              className="text-[14px] font-bold"
              style={{
                color:
                  COLORS.navyDeep,
              }}
            >
              {getStudentName(
                submission,
              )}
            </div>

            <div
              className="mt-1 text-[11.5px]"
              style={{
                color:
                  COLORS.inkSoft,
              }}
            >
              Dikumpulkan{' '}
              {formatDateTime(
                submission.created_at,
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div
              className="rounded-[9px] px-3 py-2 text-center"
              style={{
                backgroundColor:
                  grade === null
                    ? COLORS.rustBg
                    : COLORS.greenBg,
                color:
                  grade === null
                    ? COLORS.rust
                    : COLORS.green,
              }}
            >
              <div
                className="text-[18px] font-bold"
                style={{
                  fontFamily:
                    '"Fraunces", serif',
                }}
              >
                {grade === null
                  ? '-'
                  : grade}
              </div>

              <div className="text-[9px] font-bold uppercase">
                Nilai
              </div>
            </div>

            {grade !== null && (
              <button
                type="button"
                onClick={
                  onEditGrade
                }
                className="flex items-center gap-1.5 rounded-[9px] border px-3 py-2 text-[11.5px] font-bold"
                style={{
                  borderColor:
                    COLORS.line,
                  backgroundColor:
                    COLORS.paper,
                  color:
                    COLORS.navy,
                }}
              >
                <Pencil
                  size={13}
                />
                Ubah nilai
              </button>
            )}
          </div>
        </div>
      </div>

      {questions.length >
        0 && (
        <div>
          <div
            className="mb-3 text-[13px] font-bold"
            style={{
              color:
                COLORS.navyDeep,
            }}
          >
            Jawaban siswa
          </div>

          <div className="space-y-3">
            {questions.map(
              (
                question,
                index,
              ) => {
                const answer =
                  answers.find(
                    (
                      item,
                    ) =>
                      item.assignment_question_id ===
                        question.id ||
                      item.question_id ===
                        question.id,
                  );

                return (
                  <AnswerBlock
                    key={
                      question.id ??
                      index
                    }
                    question={
                      question
                    }
                    answer={
                      answer
                    }
                    index={
                      index
                    }
                  />
                );
              },
            )}
          </div>
        </div>
      )}

      {files.length >
        0 && (
        <div>
          <div
            className="mb-3 text-[13px] font-bold"
            style={{
              color:
                COLORS.navyDeep,
            }}
          >
            File yang dikumpulkan
          </div>

          <div className="space-y-2">
            {files.map(
              (
                file,
                index,
              ) => (
                <div
                  key={
                    file.id ??
                    index
                  }
                  className="flex items-center gap-3 rounded-[10px] border p-3"
                  style={{
                    borderColor:
                      COLORS.line,
                    backgroundColor:
                      COLORS.paper,
                  }}
                >
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-[9px]"
                    style={{
                      backgroundColor:
                        COLORS.blueBg,
                      color:
                        COLORS.blue,
                    }}
                  >
                    <UploadCloud
                      size={17}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div
                      className="break-all text-[12px] font-bold"
                      style={{
                        color:
                          COLORS.navyDeep,
                      }}
                    >
                      {getFileName(
                        file,
                      )}
                    </div>

                    {file.mime_type && (
                      <div
                        className="mt-0.5 text-[10.5px]"
                        style={{
                          color:
                            COLORS.inkSoft,
                        }}
                      >
                        {
                          file.mime_type
                        }
                      </div>
                    )}
                  </div>
                </div>
              ),
            )}
          </div>
        </div>
      )}

      {submission.student_note && (
        <div>
          <div
            className="mb-2 text-[13px] font-bold"
            style={{
              color:
                COLORS.navyDeep,
            }}
          >
            Catatan siswa
          </div>

          <div
            className="rounded-[10px] border px-3.5 py-3 text-[12.5px] leading-[1.6]"
            style={{
              borderColor:
                COLORS.line,
              backgroundColor:
                '#FBF8EF',
              color:
                COLORS.ink,
            }}
          >
            {
              submission.student_note
            }
          </div>
        </div>
      )}

      {submission.teacher_feedback && (
        <div>
          <div
            className="mb-2 text-[13px] font-bold"
            style={{
              color:
                COLORS.navyDeep,
            }}
          >
            Feedback guru
          </div>

          <div
            className="rounded-[10px] border px-3.5 py-3 text-[12.5px] leading-[1.6]"
            style={{
              borderColor:
                COLORS.line,
              backgroundColor:
                COLORS.greenBg,
              color:
                COLORS.ink,
            }}
          >
            {
              submission.teacher_feedback
            }
          </div>
        </div>
      )}
    </div>
  );
}


/*
|--------------------------------------------------------------------------
| ROSTER
|--------------------------------------------------------------------------
*/

function RosterSearch({
  submissions,
  search,
  onSearchChange,
  onSelect,
}: {
  submissions: Submission[];
  search: string;
  onSearchChange: (
    value: string,
  ) => void;
  onSelect: (
    submission: Submission,
  ) => void;
}) {
  const filtered =
    submissions.filter(
      (submission) =>
        getStudentName(
          submission,
        )
          .toLowerCase()
          .includes(
            search
              .trim()
              .toLowerCase(),
          ),
    );

  return (
    <div>
      <div
        className="mb-3 flex items-center gap-2 rounded-[10px] border px-3 py-2.5"
        style={{
          borderColor:
            COLORS.line,
          backgroundColor:
            COLORS.paper,
        }}
      >
        <Search
          size={15}
          style={{
            color:
              COLORS.inkSoft,
          }}
        />

        <input
          value={search}
          onChange={(
            event,
          ) =>
            onSearchChange(
              event.target.value,
            )
          }
          placeholder="Cari nama siswa..."
          className="w-full border-none bg-transparent text-[12.5px] outline-none"
          style={{
            color:
              COLORS.ink,
          }}
        />
      </div>

      <div
        className="overflow-hidden rounded-[11px] border"
        style={{
          borderColor:
            COLORS.line,
        }}
      >
        {filtered.length ===
        0 ? (
          <div
            className="px-4 py-8 text-center text-[12px]"
            style={{
              color:
                COLORS.inkSoft,
            }}
          >
            Tidak ada siswa yang
            cocok.
          </div>
        ) : (
          filtered.map(
            (
              submission,
            ) => {
              const grade =
                getSubmissionGrade(
                  submission,
                );

              return (
                <button
                  key={
                    submission.id
                  }
                  type="button"
                  onClick={() =>
                    onSelect(
                      submission,
                    )
                  }
                  className="flex w-full items-center gap-3 border-b px-3.5 py-3 text-left last:border-b-0"
                  style={{
                    borderColor:
                      COLORS.line,
                    backgroundColor:
                      COLORS.paper,
                  }}
                  onMouseEnter={(
                    event,
                  ) => {
                    event.currentTarget.style.backgroundColor =
                      '#FBF8EF';
                  }}
                  onMouseLeave={(
                    event,
                  ) => {
                    event.currentTarget.style.backgroundColor =
                      COLORS.paper;
                  }}
                >
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                    style={{
                      backgroundColor:
                        COLORS.navy,
                      color:
                        '#fff',
                    }}
                  >
                    {getInitials(
                      getStudentName(
                        submission,
                      ),
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div
                      className="truncate text-[12.5px] font-bold"
                      style={{
                        color:
                          COLORS.navyDeep,
                      }}
                    >
                      {getStudentName(
                        submission,
                      )}
                    </div>

                    <div
                      className="mt-0.5 text-[10.5px]"
                      style={{
                        color:
                          COLORS.inkSoft,
                      }}
                    >
                      {submission.created_at
                        ? formatRelativeTime(
                            submission.created_at,
                          )
                        : 'Belum ada waktu'}
                    </div>
                  </div>

                  <div
                    className="rounded-full px-2.5 py-1 text-[10px] font-bold"
                    style={{
                      backgroundColor:
                        grade ===
                        null
                          ? COLORS.rustBg
                          : COLORS.greenBg,
                      color:
                        grade ===
                        null
                          ? COLORS.rust
                          : COLORS.green,
                    }}
                  >
                    {grade ===
                    null
                      ? 'Belum dinilai'
                      : grade}
                  </div>

                  <ChevronRight
                    size={15}
                    style={{
                      color:
                        COLORS.inkSoft,
                    }}
                  />
                </button>
              );
            },
          )
        )}
      </div>
    </div>
  );
}


/*
|--------------------------------------------------------------------------
| MAIN COMPONENT
|--------------------------------------------------------------------------
*/

export default function KelolaTugas() {
  const navigate =
    useNavigate();

  const {
    scheduleId,
  } = useParams<{
    scheduleId: string;
  }>();

  const numericScheduleId =
    Number(scheduleId);

  const [user, setUser] =
    useState<UserData | null>(
      null,
    );

  const [schedule, setSchedule] =
    useState<Schedule | null>(
      null,
    );

  const [assignments, setAssignments] =
    useState<Assignment[]>(
      [],
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  const [activeFilter, setActiveFilter] =
    useState<
      'all' | 'draft'
    >('all');

  const [createTaskModalOpen, setCreateTaskModalOpen] = useState(false);

  const [search, setSearch] =
    useState('');

  const [selectedAssignment, setSelectedAssignment] =
    useState<Assignment | null>(
      null,
    );

  const [selectedSubmission, setSelectedSubmission] =
    useState<Submission | null>(
      null,
    );

  const [rosterSearch, setRosterSearch] =
    useState('');

  const [commentText, setCommentText] =
    useState('');

  const [sendingComment, setSendingComment] =
    useState(false);

  const [savingScore, setSavingScore] =
    useState(false);

  const [scoreModalOpen, setScoreModalOpen] =
    useState(false);

  const [scoreValue, setScoreValue] =
    useState('');

  const [
    editingAnswerKeyQuestionId,
    setEditingAnswerKeyQuestionId,
  ] = useState<number | null>(null);

  const [
    answerKeyShortValue,
    setAnswerKeyShortValue,
  ] = useState('');

  const [
    answerKeyOptionIds,
    setAnswerKeyOptionIds,
  ] = useState<number[]>([]);

  const [savingAnswerKey, setSavingAnswerKey] =
    useState(false);

  const [toast, setToast] =
    useState<{
      type:
        | 'success'
        | 'error';
      message: string;
    } | null>(null);

  /*
  |--------------------------------------------------------------------------
  | LOAD USER
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    const storedUser =
      localStorage.getItem(
        'user',
      );

    if (!storedUser) {
      return;
    }

    try {
      setUser(
        JSON.parse(
          storedUser,
        ) as UserData,
      );
    } catch {
      setUser(null);
    }
  }, []);


  /*
  |--------------------------------------------------------------------------
  | LOAD PAGE DATA
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (
      !Number.isFinite(
        numericScheduleId,
      ) ||
      numericScheduleId <= 0
    ) {
      setError(
        'ID jadwal tidak valid.',
      );
      setLoading(false);
      return;
    }

    loadManageData(
      numericScheduleId,
    );
  }, [
    numericScheduleId,
  ]);


  /*
  |--------------------------------------------------------------------------
  | ESCAPE KEY
  |--------------------------------------------------------------------------
  |
  | PENTING:
  | Jangan gunakan KeyboardEvent dari React untuk document.addEventListener.
  | Gunakan globalThis.KeyboardEvent karena ini adalah native DOM event.
  |
  */

  useEffect(() => {
    function handleKeyDown(
      event: globalThis.KeyboardEvent,
    ) {
      if (
        event.key !== 'Escape'
      ) {
        return;
      }

      if (scoreModalOpen) {
        closeScoreEdit();
        return;
      }

      if (
        selectedAssignment
      ) {
        closeTaskModal();
      }
    }

    document.addEventListener(
      'keydown',
      handleKeyDown,
    );

    return () => {
      document.removeEventListener(
        'keydown',
        handleKeyDown,
      );
    };
  }, [
    scoreModalOpen,
    selectedAssignment,
  ]);


  /*
  |--------------------------------------------------------------------------
  | LOAD MANAGE DATA
  |--------------------------------------------------------------------------
  */

  async function loadManageData(
    id: number,
  ) {
    try {
      setLoading(true);
      setError('');

      const response =
        await api.get(
          `/guru/tugas/kelola/${id}`,
        );

      const payload =
        response.data as ManageResponse;

      let loadedAssignments: Assignment[] =
        [];

      let loadedSchedule:
        | Schedule
        | undefined;

      if (
        Array.isArray(
          payload,
        )
      ) {
        loadedAssignments =
          payload;
      } else if (
        Array.isArray(
          payload?.assignments,
        )
      ) {
        loadedAssignments =
          payload.assignments;

        loadedSchedule =
          payload.schedule;
      } else if (
        Array.isArray(
          payload?.data,
        )
      ) {
        loadedAssignments =
          payload.data;
      } else if (
        payload?.data &&
        !Array.isArray(
          payload.data,
        )
      ) {
        loadedAssignments =
          payload.data
            ?.assignments ??
          [];

        loadedSchedule =
          payload.data
            ?.schedule;
      }

      setAssignments(
        loadedAssignments,
      );

      if (loadedSchedule) {
        setSchedule(
          loadedSchedule,
        );
      } else {
        const firstSchedule =
          loadedAssignments[0]
            ?.schedules?.find(
              (item) =>
                item.id ===
                id,
            ) ||
          loadedAssignments[0]
            ?.schedule;

        if (firstSchedule) {
          setSchedule(
            firstSchedule,
          );
        }
      }
    } catch (err) {
      setAssignments([]);

      setError(
        getErrorMessage(err),
      );
    } finally {
      setLoading(false);
    }
  }


  /*
  |--------------------------------------------------------------------------
  | TEACHER INFORMATION
  |--------------------------------------------------------------------------
  */

  const namaGuru =
    user?.name ??
    'Guru';

  const subjectName =
    schedule?.subject?.name ||
    assignments[0]
      ?.schedules?.find(
        (item) =>
          item.id ===
          numericScheduleId,
      )?.subject?.name ||
    assignments[0]
      ?.schedule?.subject
      ?.name ||
    'Mata pelajaran';


  const currentClassroomId =
    schedule?.classroom_id ??
    schedule?.classroom?.id ??
    assignments[0]
      ?.schedules?.find(
        (item) =>
          item.id ===
          numericScheduleId,
      )?.classroom_id ??
    null;


  /*
  |--------------------------------------------------------------------------
  | FILTER
  |--------------------------------------------------------------------------
  */

  const draftCount =
    assignments.filter(
      (assignment) =>
        getAssignmentStatus(
          assignment,
        ) === 'draft',
    ).length;

  const filteredAssignments =
    useMemo(() => {
      const keyword =
        search
          .trim()
          .toLowerCase();

      return assignments.filter(
        (assignment) => {
          const status =
            getAssignmentStatus(
              assignment,
            );

          if (
            activeFilter ===
              'draft' &&
            status !== 'draft'
          ) {
            return false;
          }

          if (
            activeFilter ===
              'all' &&
            status === 'draft'
          ) {
            return false;
          }

          if (!keyword) {
            return true;
          }

          const schedules =
            getAssignmentSchedules(
              assignment,
            );

          const scheduleText =
            schedules
              .map(
                (
                  item,
                ) =>
                  `${item.classroom?.name ?? ''} ${item.subject?.name ?? ''}`,
              )
              .join(' ')
              .toLowerCase();

          return (
            assignment.title
              .toLowerCase()
              .includes(keyword) ||
            (
              assignment.description ??
              ''
            )
              .toLowerCase()
              .includes(keyword) ||
            scheduleText.includes(
              keyword,
            )
          );
        },
      );
    }, [
      assignments,
      activeFilter,
      search,
    ]);


  /*
  |--------------------------------------------------------------------------
  | SUMMARY
  |--------------------------------------------------------------------------
  */

  const activeCount =
    assignments.filter(
      (assignment) =>
        getAssignmentStatus(
          assignment,
        ) === 'active',
    ).length;

  const needGrading =
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


  /*
  |--------------------------------------------------------------------------
  | TOTAL STUDENTS
  |--------------------------------------------------------------------------
  */

  const totalStudents =
    schedule?.classroom
      ?.students_count ??
    Math.max(
      ...assignments.map(
        (assignment) =>
          getSubmissionCount(
            assignment,
          ),
      ),
      0,
    );


  /*
  |--------------------------------------------------------------------------
  | COMMENTS
  |--------------------------------------------------------------------------
  */

  async function submitComment() {
    if (
      !selectedAssignment ||
      !commentText.trim() ||
      currentClassroomId === null
    ) {
      return;
    }

    try {
      setSendingComment(
        true,
      );

      const response =
        await api.post(
          `/guru/tugas/${selectedAssignment.id}/komentar`,
          {
            classroom_id:
              currentClassroomId,
            comment:
              commentText.trim(),
          },
        );

      const createdComment =
        response.data?.data as
          | TaskComment
          | undefined;

      if (createdComment) {
        setSelectedAssignment(
          (current) => {
            if (!current) {
              return current;
            }

            return {
              ...current,
              comments: [
                ...(current.comments ?? []),
                createdComment,
              ],
            };
          },
        );
      }

      setCommentText('');

      await loadManageData(
        numericScheduleId,
      );

      showToast(
        'success',
        'Komentar berhasil dikirim.',
      );
    } catch (err) {
      showToast(
        'error',
        getErrorMessage(err),
      );
    } finally {
      setSendingComment(
        false,
      );
    }
  }


  /*
  |--------------------------------------------------------------------------
  | SAVE AS DRAFT
  |--------------------------------------------------------------------------
  */

  async function saveAssignmentAsDraft() {
    if (!selectedAssignment) {
      return;
    }

    const submissions =
      selectedAssignment.submissions ?? [];

    if (submissions.length > 0) {
      showToast(
        'error',
        'Tugas yang sudah memiliki pengumpulan siswa tidak dapat dipindahkan ke draft.',
      );
      return;
    }

    if (
      getAssignmentStatus(
        selectedAssignment,
      ) === 'draft'
    ) {
      return;
    }

    try {
      await api.put(
        `/guru/tugas/${selectedAssignment.id}`,
        {
          status: 'draft',
        },
      );

      showToast(
        'success',
        'Tugas berhasil disimpan sebagai draft.',
      );

      closeTaskModal();

      await loadManageData(
        numericScheduleId,
      );

      setActiveFilter('draft');
    } catch (err) {
      showToast(
        'error',
        getErrorMessage(err),
      );
    }
  }


  /*
  |--------------------------------------------------------------------------
  | RESTORE FROM DRAFT
  |--------------------------------------------------------------------------
  */

  async function restoreAssignmentFromDraft() {
    if (!selectedAssignment) {
      return;
    }

    if (
      getAssignmentStatus(
        selectedAssignment,
      ) !== 'draft'
    ) {
      return;
    }

    try {
      await api.put(
        `/guru/tugas/${selectedAssignment.id}`,
        {
          status: 'active',
        },
      );

      showToast(
        'success',
        'Tugas berhasil dipulihkan dari draft.',
      );

      closeTaskModal();

      await loadManageData(
        numericScheduleId,
      );

      setActiveFilter('all');
    } catch (err) {
      showToast(
        'error',
        getErrorMessage(err),
      );
    }
  }


  /*
  |--------------------------------------------------------------------------
  | ANSWER KEY
  |--------------------------------------------------------------------------
  */

  function isAutoGradingType(
    type?: AssignmentType,
  ) {
    return (
      type === 'short' ||
      type === 'multiple' ||
      type === 'checkbox'
    );
  }

  function startEditAnswerKey(
    question: AssignmentQuestion,
  ) {
    if (!question.id) {
      return;
    }

    setEditingAnswerKeyQuestionId(
      question.id,
    );

    if (question.type === 'short') {
      setAnswerKeyShortValue(
        question.correct_answer ?? '',
      );
      setAnswerKeyOptionIds([]);
      return;
    }

    setAnswerKeyShortValue('');
    setAnswerKeyOptionIds(
      (question.options ?? [])
        .filter(
          (option) =>
            option.is_correct === true &&
            option.id !== undefined,
        )
        .map((option) => option.id as number),
    );
  }

  function cancelEditAnswerKey() {
    setEditingAnswerKeyQuestionId(null);
    setAnswerKeyShortValue('');
    setAnswerKeyOptionIds([]);
  }

  function toggleAnswerKeyOption(
    optionId: number,
    checked: boolean,
  ) {
    setAnswerKeyOptionIds((current) => {
      if (checked) {
        if (current.includes(optionId)) {
          return current;
        }

        return [...current, optionId];
      }

      return current.filter(
        (id) => id !== optionId,
      );
    });
  }

  async function saveAnswerKey(
    question: AssignmentQuestion,
  ) {
    if (
      !selectedAssignment ||
      !question.id ||
      savingAnswerKey
    ) {
      return;
    }

    if (
      !isAutoGradingType(question.type)
    ) {
      return;
    }

    if (
      question.type === 'short' &&
      !answerKeyShortValue.trim()
    ) {
      showToast(
        'error',
        'Kunci jawaban wajib diisi.',
      );
      return;
    }

    if (
      question.type === 'multiple' &&
      answerKeyOptionIds.length !== 1
    ) {
      showToast(
        'error',
        'Pilihan ganda harus memiliki tepat satu kunci jawaban.',
      );
      return;
    }

    if (
      question.type === 'checkbox' &&
      answerKeyOptionIds.length < 1
    ) {
      showToast(
        'error',
        'Kotak centang harus memiliki minimal satu kunci jawaban.',
      );
      return;
    }

    const gradedSubmissionExists = (
      selectedAssignment.submissions ?? []
    ).some(
      (submission) =>
        getSubmissionGrade(
          submission,
        ) !== null,
    );

    if (gradedSubmissionExists) {
      const confirmed =
        window.confirm(
          'Tugas ini sudah memiliki siswa yang nilainya telah keluar. Jika kunci jawaban diubah, seluruh nilai submission akan dihitung ulang otomatis menggunakan kunci jawaban baru. Lanjutkan?',
        );

      if (!confirmed) {
        return;
      }
    }

    try {
      setSavingAnswerKey(true);

      const payload =
        question.type === 'short'
          ? {
              question_id:
                question.id,
              correct_answer:
                answerKeyShortValue.trim(),
              correct_option_ids: [],
            }
          : {
              question_id:
                question.id,
              correct_answer: '',
              correct_option_ids:
                answerKeyOptionIds,
            };

      const response =
        await api.put(
          `/guru/tugas/${selectedAssignment.id}/kunci-jawaban`,
          payload,
        );

      const updatedAssignment =
        response.data?.data as
          | Assignment
          | undefined;

      if (updatedAssignment) {
        setSelectedAssignment(
          updatedAssignment,
        );
      }

      cancelEditAnswerKey();

      await loadManageData(
        numericScheduleId,
      );

      showToast(
        'success',
        response.data?.message ||
          'Kunci jawaban berhasil diperbarui dan nilai siswa telah dihitung ulang.',
      );
    } catch (err) {
      showToast(
        'error',
        getErrorMessage(err),
      );
    } finally {
      setSavingAnswerKey(false);
    }
  }


  /*
  |--------------------------------------------------------------------------
  | OPEN / CLOSE MODAL
  |--------------------------------------------------------------------------
  */

  function openTaskModal(
    assignment: Assignment,
  ) {
    setSelectedAssignment(
      assignment,
    );
    setSelectedSubmission(
      null,
    );
    setRosterSearch('');
    setCommentText('');
    cancelEditAnswerKey();
  }

  function closeTaskModal() {
    if (savingScore) {
      return;
    }

    setSelectedAssignment(
      null,
    );
    setSelectedSubmission(
      null,
    );
    setRosterSearch('');
    setCommentText('');
    setScoreModalOpen(false);
    cancelEditAnswerKey();
  }


  /*
  |--------------------------------------------------------------------------
  | SELECT SUBMISSION
  |--------------------------------------------------------------------------
  */

  function openSubmission(
    submission: Submission,
  ) {
    setSelectedSubmission(
      submission,
    );
  }

  function backToRoster() {
    setSelectedSubmission(
      null,
    );
  }


  /*
  |--------------------------------------------------------------------------
  | SCORE
  |--------------------------------------------------------------------------
  */

  function openScoreEdit() {
    if (
      !selectedSubmission
    ) {
      return;
    }

    const current =
      getSubmissionGrade(
        selectedSubmission,
      );

    setScoreValue(
      current === null
        ? ''
        : String(current),
    );

    setScoreModalOpen(true);
  }

  function closeScoreEdit() {
    if (savingScore) {
      return;
    }

    setScoreModalOpen(
      false,
    );
    setScoreValue('');
  }

  async function saveScore() {
    if (
      !selectedAssignment ||
      !selectedSubmission
    ) {
      return;
    }

    const numericScore =
      Number(scoreValue);

    if (
      !Number.isFinite(
        numericScore,
      ) ||
      numericScore < 0 ||
      numericScore > 100
    ) {
      showToast(
        'error',
        'Nilai harus berada di antara 0 sampai 100.',
      );
      return;
    }

    try {
      setSavingScore(true);

      await api.put(
        `/guru/tugas/${selectedAssignment.id}/submission/${selectedSubmission.id}/nilai`,
        {
          grade:
            numericScore,
        },
      );

      const updatedSubmission: Submission =
        {
          ...selectedSubmission,
          grade:
            numericScore,
        };

      setSelectedSubmission(
        updatedSubmission,
      );

      setSelectedAssignment(
        (current) => {
          if (!current) {
            return current;
          }

          return {
            ...current,
            submissions:
              (
                current.submissions ??
                []
              ).map(
                (
                  submission,
                ) =>
                  submission.id ===
                  selectedSubmission.id
                    ? {
                        ...submission,
                        grade:
                          numericScore,
                      }
                    : submission,
              ),
          };
        },
      );

      setScoreModalOpen(
        false,
      );
      setScoreValue('');

      await loadManageData(
        numericScheduleId,
      );

      showToast(
        'success',
        'Nilai berhasil diperbarui.',
      );
    } catch (err) {
      showToast(
        'error',
        getErrorMessage(err),
      );
    } finally {
      setSavingScore(
        false,
      );
    }
  }


  /*
  |--------------------------------------------------------------------------
  | TOAST
  |--------------------------------------------------------------------------
  */

  function showToast(
    type:
      | 'success'
      | 'error',
    message: string,
  ) {
    setToast({
      type,
      message,
    });

    window.setTimeout(
      () => {
        setToast(null);
      },
      3500,
    );
  }


  /*
  |--------------------------------------------------------------------------
  | LOADING
  |--------------------------------------------------------------------------
  */

  if (loading) {
    return (
      <GuruLayout
        namaGuru={
          namaGuru
        }
        mapelGuru={
          subjectName
        }
        getInitials={
          getInitials
        }
      mainClassName="overflow-hidden">
        <div
          className="min-h-screen"
          style={{
            backgroundColor:
              COLORS.bg,
          }}
        >
          <div className="mx-auto w-full max-w-[1248px] px-[34px] pb-[60px] pt-[26px]">
            <div
              className="flex min-h-[420px] items-center justify-center"
            >
              <div className="text-center">
                <div
                  className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
                  style={{
                    borderColor:
                      COLORS.navy,
                    borderTopColor:
                      'transparent',
                  }}
                />

                <div
                  className="text-[13px]"
                  style={{
                    color:
                      COLORS.inkSoft,
                  }}
                >
                  Memuat halaman
                  Kelola Tugas...
                </div>
              </div>
            </div>
          </div>
        </div>
      </GuruLayout>
    );
  }


  /*
  |--------------------------------------------------------------------------
  | MAIN RENDER
  |--------------------------------------------------------------------------
  */

  return (
    <GuruLayout
      namaGuru={
        namaGuru
      }
      mapelGuru={
        subjectName
      }
      getInitials={
        getInitials
      }
    mainClassName="overflow-hidden">
      <div
        className="min-h-screen"
        style={{
          backgroundColor:
            COLORS.bg,
          color:
            COLORS.ink,
        }}
      >
        <div
          className="mx-auto w-full max-w-[1248px] px-[34px] pb-[60px] pt-[26px]"
        >

          {/* =====================================================
              BACK
          ====================================================== */}

          <button
            type="button"
            onClick={() =>
              navigate(
                '/guru/tugas',
              )
            }
            className="mb-4 inline-flex items-center gap-[7px] text-[13.5px] font-semibold transition"
            style={{
              color:
                COLORS.inkSoft,
            }}
            onMouseEnter={(
              event,
            ) => {
              event.currentTarget.style.color =
                COLORS.navy;
            }}
            onMouseLeave={(
              event,
            ) => {
              event.currentTarget.style.color =
                COLORS.inkSoft;
            }}
          >
            <ArrowLeft
              size={15}
            />
            Kembali ke Daftar
            Tugas
          </button>


          {/* =====================================================
              HEADER
          ====================================================== */}

          <div
            className="mb-6 flex items-start justify-between gap-5"
          >
            <div>
              <div
                className="mb-1 text-[11px] font-bold uppercase tracking-[0.05em]"
                style={{
                  color:
                    COLORS.gold,
                }}
              >
                {getSemesterLabel()}
              </div>

              <h1
                className="text-[32px] font-semibold tracking-[-0.02em]"
                style={{
                  color:
                    COLORS.navyDeep,
                  fontFamily:
                    '"Fraunces", serif',
                }}
              >
                {schedule?.classroom?.name ||
                  'Kelas'}
              </h1>

              <div
                className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px]"
                style={{
                  color:
                    COLORS.inkSoft,
                }}
              >
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold"
                  style={{
                    backgroundColor:
                      COLORS.goldSoft,
                    color:
                      '#7A5A20',
                  }}
                >
                  <BookOpen
                    size={13}
                  />
                  {subjectName}
                </span>

                <span>
                  {totalStudents}{' '}
                  siswa
                </span>

                {schedule && (
                  <>
                    <span>
                      ·
                    </span>

                    <span>
                      {getScheduleLabel(
                        schedule,
                      )}
                    </span>
                  </>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setCreateTaskModalOpen(
                  true,
                )
              }
              className="mt-[66px] flex shrink-0 items-center gap-2 rounded-[10px] border px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:opacity-90"
              style={{
                backgroundColor:
                  COLORS.navy,
                borderColor:
                  COLORS.navy,
              }}
            >
              <Plus
                size={15}
              />
              Tugas baru
            </button>
          </div>


          {/* =====================================================
              ERROR
          ====================================================== */}

          {error && (
            <div
              className="mb-5 flex items-start gap-2.5 rounded-[11px] border px-4 py-3 text-[12.5px]"
              style={{
                backgroundColor:
                  COLORS.rustBg,
                borderColor:
                  COLORS.rustLine,
                color:
                  COLORS.rust,
              }}
            >
              <AlertCircle
                size={16}
                className="mt-0.5 shrink-0"
              />

              <div className="flex-1">
                {error}
              </div>

              <button
                type="button"
                onClick={() =>
                  loadManageData(
                    numericScheduleId,
                  )
                }
                className="font-bold underline"
              >
                Coba lagi
              </button>
            </div>
          )}


          {/* =====================================================
              TOOLBAR
          ====================================================== */}

          <div
            className="mb-5 flex flex-wrap items-center justify-between gap-3.5"
          >
            <div
              className="flex rounded-[11px] border p-1"
              style={{
                backgroundColor:
                  COLORS.paper,
                borderColor:
                  COLORS.line,
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setActiveFilter(
                    'all',
                  )
                }
                className="flex items-center gap-1.5 rounded-[8px] px-4 py-2 text-[13px] font-semibold"
                style={{
                  backgroundColor:
                    activeFilter ===
                    'all'
                      ? COLORS.navy
                      : 'transparent',
                  color:
                    activeFilter ===
                    'all'
                      ? '#fff'
                      : COLORS.inkSoft,
                }}
              >
                Semua tugas
              </button>

              <button
                type="button"
                onClick={() =>
                  setActiveFilter(
                    'draft',
                  )
                }
                className="flex items-center gap-1.5 rounded-[8px] px-4 py-2 text-[13px] font-semibold"
                style={{
                  backgroundColor:
                    activeFilter ===
                    'draft'
                      ? COLORS.navy
                      : 'transparent',
                  color:
                    activeFilter ===
                    'draft'
                      ? '#fff'
                      : COLORS.inkSoft,
                }}
              >
                Draft

                {draftCount >
                  0 && (
                  <span
                    className="rounded-full px-1.5 py-[1px] text-[10.5px] font-bold"
                    style={{
                      backgroundColor:
                        activeFilter ===
                        'draft'
                          ? 'rgba(255,255,255,0.18)'
                          : COLORS.goldSoft,
                      color:
                        activeFilter ===
                        'draft'
                          ? '#fff'
                          : '#7A5A20',
                    }}
                  >
                    {
                      draftCount
                    }
                  </span>
                )}
              </button>
            </div>

            <div
              className="flex min-w-[210px] items-center gap-2 rounded-[10px] border px-3 py-[9px]"
              style={{
                backgroundColor:
                  COLORS.paper,
                borderColor:
                  COLORS.line,
              }}
            >
              <Search
                size={16}
                style={{
                  color:
                    COLORS.inkSoft,
                  opacity:
                    0.7,
                }}
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
                placeholder="Cari tugas..."
                className="w-full border-none bg-transparent text-[13.5px] outline-none"
                style={{
                  color:
                    COLORS.ink,
                }}
              />

              {search && (
                <button
                  type="button"
                  onClick={() =>
                    setSearch(
                      '',
                    )
                  }
                  className="shrink-0"
                >
                  <X
                    size={14}
                    style={{
                      color:
                        COLORS.inkSoft,
                    }}
                  />
                </button>
              )}
            </div>
          </div>


          {/* =====================================================
              SUMMARY
          ====================================================== */}

          <div
            className="mb-[22px] flex flex-wrap gap-5 rounded-[14px] border px-5 py-[15px]"
            style={{
              backgroundColor:
                COLORS.paper,
              borderColor:
                COLORS.line,
              boxShadow:
                '0 1px 2px rgba(30,25,15,0.04), 0 8px 24px -12px rgba(30,25,15,0.10)',
            }}
          >
            <SummaryItem
              icon={
                <FileText
                  size={16}
                  strokeWidth={
                    1.9
                  }
                />
              }
              value={
                assignments.length
              }
              label="Total tugas"
            />

            <div
              className="hidden h-8 border-r sm:block"
              style={{
                borderColor:
                  COLORS.line,
              }}
            />

            <SummaryItem
              icon={
                <CheckCircle2
                  size={16}
                  strokeWidth={
                    1.9
                  }
                />
              }
              value={
                activeCount
              }
              label="Tugas aktif"
            />

            <div
              className="hidden h-8 border-r sm:block"
              style={{
                borderColor:
                  COLORS.line,
              }}
            />

            <SummaryItem
              icon={
                <AlertCircle
                  size={16}
                  strokeWidth={
                    1.9
                  }
                />
              }
              value={
                needGrading
              }
              label="Perlu dinilai"
              danger={
                needGrading >
                0
              }
            />

            <div
              className="hidden h-8 border-r sm:block"
              style={{
                borderColor:
                  COLORS.line,
              }}
            />

            <SummaryItem
              icon={
                <FileText
                  size={16}
                  strokeWidth={
                    1.9
                  }
                />
              }
              value={
                draftCount
              }
              label="Draft"
            />
          </div>


          {/* =====================================================
              TASK LIST
          ====================================================== */}

          <div className="flex flex-col gap-4">
            {filteredAssignments.map(
              (assignment) => {
                const assignmentSchedule =
                  getAssignmentSchedules(
                    assignment,
                  ).find(
                    (
                      item,
                    ) =>
                      item.id ===
                      numericScheduleId,
                  ) ||
                  schedule ||
                  getAssignmentSchedules(
                    assignment,
                  )[0];

                return (
                  <TaskCard
                    key={
                      assignment.id
                    }
                    assignment={
                      assignment
                    }
                    schedule={
                      assignmentSchedule
                    }
                    onOpen={() =>
                      openTaskModal(
                        assignment,
                      )
                    }
                  />
                );
              },
            )}

            {filteredAssignments.length ===
              0 && (
              <div
                className="rounded-[14px] border px-5 py-14 text-center"
                style={{
                  backgroundColor:
                    COLORS.paper,
                  borderColor:
                    COLORS.line,
                }}
              >
                <div
                  className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
                  style={{
                    backgroundColor:
                      COLORS.goldSoft,
                    color:
                      '#7A5A20',
                  }}
                >
                  <Search
                    size={20}
                  />
                </div>

                <div
                  className="text-[15px] font-bold"
                  style={{
                    color:
                      COLORS.navyDeep,
                  }}
                >
                  Tidak ada tugas
                </div>

                <div
                  className="mt-1.5 text-[12px]"
                  style={{
                    color:
                      COLORS.inkSoft,
                  }}
                >
                  {search
                    ? 'Tidak ditemukan tugas yang sesuai dengan pencarian.'
                    : activeFilter ===
                        'draft'
                      ? 'Belum ada tugas draft.'
                      : 'Belum ada tugas untuk kelas ini.'}
                </div>
              </div>
            )}
          </div>
        </div>


        {/* =======================================================
            TASK DETAIL MODAL
        ======================================================== */}

        {selectedAssignment && (
          <ModalShell
            onClose={
              closeTaskModal
            }
            maxWidth="760px"
          >
            <div
              className="flex shrink-0 items-start justify-between gap-4 border-b px-6 pb-4 pt-5"
              style={{
                borderColor:
                  COLORS.line,
              }}
            >
              <div className="flex min-w-0 items-start gap-3">
                {selectedSubmission && (
                  <button
                    type="button"
                    onClick={
                      backToRoster
                    }
                    className="mt-0.5 flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] border"
                    style={{
                      borderColor:
                        COLORS.line,
                      backgroundColor:
                        COLORS.paper,
                      color:
                        COLORS.inkSoft,
                    }}
                    title="Kembali"
                  >
                    <ChevronLeft
                      size={16}
                    />
                  </button>
                )}

                <div className="min-w-0">
                  <h2
                    className="truncate text-[19px] font-semibold"
                    style={{
                      color:
                        COLORS.navyDeep,
                      fontFamily:
                        '"Fraunces", serif',
                    }}
                  >
                    {selectedSubmission
                      ? getStudentName(
                          selectedSubmission,
                        )
                      : selectedAssignment.title}
                  </h2>

                  <p
                    className="mt-1 text-[12px]"
                    style={{
                      color:
                        COLORS.inkSoft,
                    }}
                  >
                    {selectedSubmission
                      ? 'Detail jawaban siswa'
                      : `${getTypeMeta(selectedAssignment).label} · ${
                          schedule?.classroom
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
                    COLORS.line,
                  backgroundColor:
                    COLORS.paper,
                  color:
                    COLORS.inkSoft,
                }}
                title="Tutup"
              >
                <X
                  size={15}
                />
              </button>
            </div>


            {/* ===================================================
                MODAL BODY
            ==================================================== */}

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {!selectedSubmission ? (
                <div className="space-y-5">

                  {/* TASK INFO */}

                  {getAssignmentType(
                    selectedAssignment,
                  ) !== 'info' && (
                  <div
                    className="rounded-[12px] border p-4"
                    style={{
                      backgroundColor:
                        '#FBF8EF',
                      borderColor:
                        COLORS.line,
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]"
                        style={{
                          backgroundColor:
                            getTypeColors(
                              getTypeMeta(
                                selectedAssignment,
                              ).color,
                            ).bg,
                          color:
                            getTypeColors(
                              getTypeMeta(
                                selectedAssignment,
                              ).color,
                            ).fg,
                        }}
                      >
                        {(() => {
                          const Icon =
                            getTypeIcon(
                              getAssignmentType(
                                selectedAssignment,
                              ),
                            );

                          return (
                            <Icon
                              size={19}
                            />
                          );
                        })()}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div
                          className="text-[13px] font-bold"
                          style={{
                            color:
                              COLORS.navyDeep,
                          }}
                        >
                          {selectedAssignment.title}
                        </div>

                        <div
                          className="mt-1 text-[11.5px]"
                          style={{
                            color:
                              COLORS.inkSoft,
                          }}
                        >
                          {getTypeMeta(
                            selectedAssignment,
                          ).label}
                        </div>

                        {selectedAssignment.description && (
                          <div
                            className="mt-3 text-[12.5px] leading-[1.6]"
                            style={{
                              color:
                                COLORS.ink,
                            }}
                          >
                            {
                              selectedAssignment.description
                            }
                          </div>
                        )}
                      </div>

                      <span
                        className="shrink-0 rounded-full px-[9px] py-[3px] text-[10.5px] font-bold"
                        style={getStatusClasses(
                          getAssignmentStatus(
                            selectedAssignment,
                          ),
                        )}
                      >
                        {getStatusLabel(
                          getAssignmentStatus(
                            selectedAssignment,
                          ),
                        )}
                      </span>
                    </div>
                  </div>
                  )}

                  {/* QUESTIONS */}

                  {selectedAssignment.questions &&
                    selectedAssignment.questions.length > 0 && (
                      <div>
                        <div
                          className="mb-3 text-[13px] font-bold"
                          style={{
                            color:
                              COLORS.navyDeep,
                          }}
                        >
                          {getAssignmentType(
                            selectedAssignment,
                          ) === 'info'
                            ? 'Info'
                            : `Soal (${selectedAssignment.questions.length})`}
                        </div>

                        <div className="space-y-2">
                          {selectedAssignment.questions.map(
                            (
                              question,
                              index,
                            ) => {
                              const autoGrading =
                                isAutoGradingType(
                                  question.type,
                                );

                              const isEditing =
                                editingAnswerKeyQuestionId ===
                                question.id;

                              const correctOptions =
                                (question.options ?? [])
                                  .filter(
                                    (option) =>
                                      option.is_correct === true,
                                  );

                              return (
                                <div
                                  key={
                                    question.id ??
                                    index
                                  }
                                  className={
                                    getAssignmentType(
                                      selectedAssignment,
                                    ) === 'info'
                                      ? 'rounded-[13px] border px-5 py-5'
                                      : 'rounded-[10px] border px-3.5 py-3'
                                  }
                                  style={{
                                    borderColor:
                                      getAssignmentType(
                                        selectedAssignment,
                                      ) === 'info'
                                        ? '#D9C38E'
                                        : COLORS.line,
                                    backgroundColor:
                                      getAssignmentType(
                                        selectedAssignment,
                                      ) === 'info'
                                        ? '#FBF4DF'
                                        : COLORS.paper,
                                    boxShadow:
                                      getAssignmentType(
                                        selectedAssignment,
                                      ) === 'info'
                                        ? '0 4px 14px -8px rgba(122,90,32,0.24)'
                                        : undefined,
                                  }}
                                >
                                  {getAssignmentType(
                                    selectedAssignment,
                                  ) === 'info' ? (
                                    <div className="flex items-center gap-3">
                                      <div
                                        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
                                        style={{
                                          backgroundColor:
                                            COLORS.goldSoft,
                                          color:
                                            '#7A5A20',
                                        }}
                                      >
                                        <Info
                                          size={18}
                                          strokeWidth={2}
                                        />
                                      </div>

                                      <div
                                        className="min-w-0 flex-1 text-[13.5px] font-semibold leading-[1.75]"
                                        style={{
                                          color:
                                            COLORS.navyDeep,
                                        }}
                                      >
                                        {question.question ||
                                          'Tidak ada informasi.'}
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                          <div
                                            className="mb-1 text-[10px] font-bold uppercase"
                                            style={{
                                              color:
                                                COLORS.gold,
                                            }}
                                          >
                                            Soal{' '}
                                            {index + 1}
                                          </div>

                                          <div
                                            className="text-[12.5px] font-semibold leading-[1.5]"
                                            style={{
                                              color:
                                                COLORS.navyDeep,
                                            }}
                                          >
                                            {question.question ||
                                              `Soal ${index + 1}`}
                                          </div>
                                        </div>

                                        {autoGrading && (
                                          <span
                                            className="shrink-0 rounded-full px-2.5 py-1 text-[9.5px] font-bold"
                                            style={{
                                              backgroundColor:
                                                COLORS.greenBg,
                                              color:
                                                COLORS.green,
                                            }}
                                          >
                                            Auto Grading
                                          </span>
                                        )}
                                      </div>

                                      {autoGrading && (
                                        <div
                                          className="mt-3 rounded-[10px] border px-3.5 py-3"
                                          style={{
                                            borderColor:
                                              '#D9E3D5',
                                            backgroundColor:
                                              '#F7FAF5',
                                          }}
                                        >
                                          <div className="flex items-center justify-between gap-3">
                                            <div className="text-[11px] font-bold">
                                              <span
                                                style={{
                                                  color:
                                                    COLORS.green,
                                                }}
                                              >
                                                Kunci jawaban
                                              </span>
                                            </div>

                                            {!isEditing && (
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  startEditAnswerKey(
                                                    question,
                                                  )
                                                }
                                                className="flex items-center gap-1.5 rounded-[8px] border px-2.5 py-1.5 text-[10.5px] font-bold"
                                                style={{
                                                  borderColor:
                                                    COLORS.line,
                                                  backgroundColor:
                                                    COLORS.paper,
                                                  color:
                                                    COLORS.navy,
                                                }}
                                              >
                                                <Pencil
                                                  size={12}
                                                />
                                                Edit
                                              </button>
                                            )}
                                          </div>

                                          {!isEditing ? (
                                            <div className="mt-2">
                                              {question.type ===
                                              'short' ? (
                                                <div
                                                  className="rounded-[8px] border px-3 py-2 text-[12px]"
                                                  style={{
                                                    borderColor:
                                                      COLORS.line,
                                                    backgroundColor:
                                                      COLORS.paper,
                                                    color:
                                                      question.correct_answer
                                                        ? COLORS.ink
                                                        : COLORS.inkSoft,
                                                  }}
                                                >
                                                  {question.correct_answer?.trim() ||
                                                    'Belum ada kunci jawaban.'}
                                                </div>
                                              ) : correctOptions.length >
                                                0 ? (
                                                <div className="space-y-1.5">
                                                  {correctOptions.map(
                                                    (
                                                      option,
                                                      optionIndex,
                                                    ) => (
                                                      <div
                                                        key={
                                                          option.id ??
                                                          optionIndex
                                                        }
                                                        className="flex items-center gap-2 rounded-[8px] border px-3 py-2 text-[12px]"
                                                        style={{
                                                          borderColor:
                                                            '#D9E3D5',
                                                          backgroundColor:
                                                            COLORS.paper,
                                                          color:
                                                            COLORS.ink,
                                                        }}
                                                      >
                                                        <CheckCircle2
                                                          size={13}
                                                          style={{
                                                            color:
                                                              COLORS.green,
                                                          }}
                                                        />
                                                        <span>
                                                          {option.option_text ||
                                                            `Pilihan ${optionIndex + 1}`}
                                                        </span>
                                                      </div>
                                                    ),
                                                  )}
                                                </div>
                                              ) : (
                                                <div
                                                  className="text-[11.5px] italic"
                                                  style={{
                                                    color:
                                                      COLORS.inkSoft,
                                                  }}
                                                >
                                                  Belum ada kunci jawaban.
                                                </div>
                                              )}
                                            </div>
                                          ) : (
                                            <div className="mt-3 space-y-3">
                                              {question.type ===
                                              'short' ? (
                                                <input
                                                  type="text"
                                                  value={
                                                    answerKeyShortValue
                                                  }
                                                  onChange={(
                                                    event,
                                                  ) =>
                                                    setAnswerKeyShortValue(
                                                      event.target
                                                        .value,
                                                    )
                                                  }
                                                  placeholder="Masukkan kunci jawaban..."
                                                  className="w-full rounded-[8px] border px-3 py-2.5 text-[12px] outline-none"
                                                  style={{
                                                    borderColor:
                                                      COLORS.line,
                                                    backgroundColor:
                                                      COLORS.paper,
                                                    color:
                                                      COLORS.ink,
                                                  }}
                                                  disabled={
                                                    savingAnswerKey
                                                  }
                                                />
                                              ) : (
                                                <div className="space-y-2">
                                                  {(question.options ??
                                                    []).map(
                                                    (
                                                      option,
                                                      optionIndex,
                                                    ) => {
                                                      const optionId =
                                                        option.id;

                                                      if (
                                                        optionId ===
                                                        undefined
                                                      ) {
                                                        return null;
                                                      }

                                                      const checked =
                                                        answerKeyOptionIds.includes(
                                                          optionId,
                                                        );

                                                      return (
                                                        <label
                                                          key={
                                                            optionId ??
                                                            optionIndex
                                                          }
                                                          className="flex cursor-pointer items-center gap-2.5 rounded-[8px] border px-3 py-2.5"
                                                          style={{
                                                            borderColor:
                                                              checked
                                                                ? '#B8D0B8'
                                                                : COLORS.line,
                                                            backgroundColor:
                                                              checked
                                                                ? COLORS.greenBg
                                                                : COLORS.paper,
                                                          }}
                                                        >
                                                          <input
                                                            type={
                                                              question.type ===
                                                              'multiple'
                                                                ? 'radio'
                                                                : 'checkbox'
                                                            }
                                                            name={`answer-key-${question.id}`}
                                                            checked={
                                                              checked
                                                            }
                                                            onChange={(
                                                              event,
                                                            ) => {
                                                              if (
                                                                question.type ===
                                                                'multiple'
                                                              ) {
                                                                setAnswerKeyOptionIds(
                                                                  event.target
                                                                    .checked
                                                                    ? [
                                                                        optionId,
                                                                      ]
                                                                    : [],
                                                                );
                                                              } else {
                                                                toggleAnswerKeyOption(
                                                                  optionId,
                                                                  event.target
                                                                    .checked,
                                                                );
                                                              }
                                                            }}
                                                            className="h-3.5 w-3.5"
                                                            disabled={
                                                              savingAnswerKey
                                                            }
                                                          />
                                                          <span
                                                            className="text-[12px]"
                                                            style={{
                                                              color:
                                                                COLORS.ink,
                                                            }}
                                                          >
                                                            {option.option_text ||
                                                              `Pilihan ${optionIndex + 1}`}
                                                          </span>
                                                        </label>
                                                      );
                                                    },
                                                  )}
                                                </div>
                                              )}

                                              <div className="flex items-center justify-end gap-2">
                                                <button
                                                  type="button"
                                                  onClick={
                                                    cancelEditAnswerKey
                                                  }
                                                  disabled={
                                                    savingAnswerKey
                                                  }
                                                  className="rounded-[8px] border px-3 py-2 text-[10.5px] font-bold"
                                                  style={{
                                                    borderColor:
                                                      COLORS.line,
                                                    backgroundColor:
                                                      COLORS.paper,
                                                    color:
                                                      COLORS.ink,
                                                  }}
                                                >
                                                  Batal
                                                </button>

                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    saveAnswerKey(
                                                      question,
                                                    )
                                                  }
                                                  disabled={
                                                    savingAnswerKey
                                                  }
                                                  className="rounded-[8px] px-3 py-2 text-[10.5px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                                                  style={{
                                                    backgroundColor:
                                                      COLORS.navy,
                                                  }}
                                                >
                                                  {savingAnswerKey
                                                    ? 'Menyimpan...'
                                                    : 'Simpan Kunci'}
                                                </button>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              );
                            },
                          )}
                        </div>
                      </div>
                    )}

                  {/* ROSTER */}

                  {getAssignmentType(
                    selectedAssignment,
                  ) !== 'info' && (
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <div
                        className="text-[13px] font-bold"
                        style={{
                          color:
                            COLORS.navyDeep,
                        }}
                      >
                        Daftar pengumpulan
                      </div>

                      <div
                        className="text-[11px]"
                        style={{
                          color:
                            COLORS.inkSoft,
                        }}
                      >
                        {
                          selectedAssignment
                            .submissions
                            ?.length ??
                          0
                        }{' '}
                        pengumpulan
                      </div>
                    </div>

                    <RosterSearch
                      submissions={
                        selectedAssignment.submissions ??
                        []
                      }
                      search={
                        rosterSearch
                      }
                      onSearchChange={
                        setRosterSearch
                      }
                      onSelect={
                        openSubmission
                      }
                    />
                  </div>
                  )}

                  {/* COMMENTS */}

                  <div>
                    <div
                      className="mb-3 flex items-center gap-1.5 text-[13px] font-bold"
                      style={{
                        color:
                          COLORS.navyDeep,
                      }}
                    >
                      <MessageCircle
                        size={15}
                      />
                      Diskusi tugas ini (
                      {
                        selectedAssignment
                          .comments
                          ?.length ??
                        0
                      })
                    </div>

                    <div
                      className="rounded-[11px] border px-3.5"
                      style={{
                        borderColor:
                          COLORS.line,
                        backgroundColor:
                          COLORS.paper,
                      }}
                    >
                      {(selectedAssignment.comments ??
                        []
                      ).length ===
                      0 ? (
                        <div
                          className="py-5 text-center text-[11.5px]"
                          style={{
                            color:
                              COLORS.inkSoft,
                          }}
                        >
                          Belum ada
                          komentar.
                        </div>
                      ) : (
                        (
                          selectedAssignment.comments ??
                          []
                        )
                          .slice(
                            -2,
                          )
                          .map(
                            (
                              comment,
                            ) => (
                              <CommentRow
                                key={
                                  comment.id
                                }
                                comment={
                                  comment
                                }
                              />
                            ),
                          )
                      )}
                    </div>

                    <div
                      className="mt-3 flex items-end gap-2"
                    >
                      <textarea
                        value={
                          commentText
                        }
                        onChange={(
                          event,
                        ) =>
                          setCommentText(
                            event
                              .target
                              .value,
                          )
                        }
                        placeholder="Tulis komentar untuk kelas ini..."
                        rows={2}
                        maxLength={2000}
                        className="min-h-[70px] flex-1 resize-none rounded-[10px] border px-3 py-2.5 text-[12.5px] outline-none"
                        style={{
                          borderColor:
                            COLORS.line,
                          backgroundColor:
                            COLORS.paper,
                          color:
                            COLORS.ink,
                        }}
                      />

                      <button
                        type="button"
                        disabled={
                          sendingComment ||
                          !commentText.trim()
                        }
                        onClick={
                          submitComment
                        }
                        className="flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-[10px] px-3.5 text-[12px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                        style={{
                          backgroundColor:
                            COLORS.navy,
                        }}
                      >
                        {sendingComment ? (
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : (
                          <Send
                            size={14}
                          />
                        )}

                        Kirim
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <StudentAnswerDetail
                  submission={
                    selectedSubmission
                  }
                  assignment={
                    selectedAssignment
                  }
                  onEditGrade={
                    openScoreEdit
                  }
                />
              )}
            </div>


            {/* ===================================================
                MODAL FOOTER
            ==================================================== */}

            <div
              className="flex shrink-0 items-center justify-between gap-3 border-t px-6 py-4"
              style={{
                borderColor:
                  COLORS.line,
              }}
            >
              <div
                className="text-[11.5px]"
                style={{
                  color:
                    COLORS.inkSoft,
                }}
              >
                {selectedSubmission
                  ? 'Detail jawaban siswa'
                  : getAssignmentType(
                        selectedAssignment,
                      ) === 'info'
                    ? 'Catatan informasi'
                    : `${
                        selectedAssignment.submissions?.length ??
                        0
                      } siswa mengumpulkan`}
              </div>

              <div className="flex items-center gap-2.5">
                {!selectedSubmission &&
                  getAssignmentStatus(
                    selectedAssignment,
                  ) === 'draft' && (
                    <button
                      type="button"
                      onClick={
                        restoreAssignmentFromDraft
                      }
                      className="rounded-[10px] border px-5 py-[10px] text-[13px] font-bold transition"
                      style={{
                        backgroundColor:
                          COLORS.navy,
                        borderColor:
                          COLORS.navy,
                        color:
                          '#FFFFFF',
                      }}
                      title="Pulihkan tugas dari draft"
                    >
                      Pulihkan Draft
                    </button>
                  )}

                {!selectedSubmission &&
                  getAssignmentStatus(
                    selectedAssignment,
                  ) !== 'draft' && (
                    <button
                      type="button"
                      onClick={
                        saveAssignmentAsDraft
                      }
                      disabled={
                        (
                          selectedAssignment.submissions ??
                          []
                        ).length > 0
                      }
                      className="rounded-[10px] border px-5 py-[10px] text-[13px] font-bold transition disabled:cursor-not-allowed disabled:opacity-50"
                      style={{
                        backgroundColor:
                          '#EFE9DB',
                        borderColor:
                          COLORS.goldSoft,
                        color:
                          '#7A5A20',
                      }}
                      title={
                        (
                          selectedAssignment.submissions ??
                          []
                        ).length > 0
                          ? 'Tugas yang sudah memiliki pengumpulan tidak dapat dipindahkan ke draft.'
                          : 'Simpan tugas sebagai draft'
                      }
                    >
                      Simpan Draft
                    </button>
                  )}

                <button
                  type="button"
                  onClick={
                    closeTaskModal
                  }
                  className="rounded-[10px] border px-5 py-[10px] text-[13px] font-bold"
                  style={{
                    backgroundColor:
                      COLORS.paper,
                    borderColor:
                      COLORS.line,
                    color:
                      COLORS.ink,
                  }}
                >
                  Tutup
                </button>
              </div>
            </div>
          </ModalShell>
        )}


        {/* =======================================================
            SCORE EDIT MODAL
        ======================================================== */}

        {scoreModalOpen &&
          selectedSubmission && (
            <div
              className="fixed inset-0 z-[130] flex items-center justify-center p-4"
              style={{
                backgroundColor:
                  'rgba(20,17,10,0.42)',
              }}
              onMouseDown={(
                event,
              ) => {
                if (
                  event.target ===
                  event.currentTarget
                ) {
                  closeScoreEdit();
                }
              }}
            >
              <div
                className="w-full max-w-[400px] rounded-[16px] border p-5"
                style={{
                  backgroundColor:
                    COLORS.paper,
                  borderColor:
                    COLORS.line,
                  boxShadow:
                    '0 24px 60px -20px rgba(20,17,10,0.45)',
                }}
              >
                <div
                  className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
                  style={{
                    backgroundColor:
                      COLORS.goldSoft,
                    color:
                      '#7A5A20',
                  }}
                >
                  <Pencil
                    size={20}
                    strokeWidth={1.8}
                  />
                </div>

                <h3
                  className="text-center text-[18px] font-semibold"
                  style={{
                    color:
                      COLORS.navyDeep,
                    fontFamily:
                      '"Fraunces", serif',
                  }}
                >
                  Ubah nilai tugas?
                </h3>

                <p
                  className="mt-1.5 text-center text-[12px] leading-[1.6]"
                  style={{
                    color:
                      COLORS.inkSoft,
                  }}
                >
                  Anda akan mengubah
                  nilai yang sudah
                  diberikan untuk siswa
                  ini.
                </p>

                <div className="mt-5">
                  <label
                    className="mb-2 block text-[12px] font-bold"
                    style={{
                      color:
                        COLORS.navyDeep,
                    }}
                  >
                    Nilai baru
                  </label>

                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={
                      scoreValue
                    }
                    onChange={(
                      event,
                    ) =>
                      setScoreValue(
                        event.target
                          .value,
                      )
                    }
                    autoFocus
                    placeholder="0"
                    className="w-full rounded-[10px] border px-3.5 py-3 text-[15px] font-bold outline-none"
                    style={{
                      borderColor:
                        COLORS.line,
                      backgroundColor:
                        COLORS.paper,
                      color:
                        COLORS.navyDeep,
                    }}
                  />

                  <div
                    className="mt-1.5 text-[10.5px]"
                    style={{
                      color:
                        COLORS.inkSoft,
                    }}
                  >
                    Masukkan nilai
                    antara 0 sampai
                    100.
                  </div>
                </div>

                <div className="mt-5 flex justify-end gap-2.5">
                  <button
                    type="button"
                    disabled={
                      savingScore
                    }
                    onClick={
                      closeScoreEdit
                    }
                    className="rounded-[10px] border px-5 py-[10px] text-[13px] font-bold"
                    style={{
                      borderColor:
                        COLORS.line,
                      backgroundColor:
                        COLORS.paper,
                      color:
                        COLORS.ink,
                    }}
                  >
                    Batal
                  </button>

                  <button
                    type="button"
                    disabled={
                      savingScore
                    }
                    onClick={
                      saveScore
                    }
                    className="flex items-center gap-2 rounded-[10px] border px-5 py-[10px] text-[13px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    style={{
                      backgroundColor:
                        COLORS.navy,
                      borderColor:
                        COLORS.navy,
                    }}
                  >
                    {savingScore ? (
                      <>
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Menyimpan...
                      </>
                    ) : (
                      <>
                        <Check
                          size={14}
                        />
                        Simpan
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}


        {/* =======================================================
            TOAST
        ======================================================== */}

        {toast && (
          <div
            className="fixed bottom-5 right-5 z-[200] flex max-w-[380px] items-start gap-2.5 rounded-[12px] border px-4 py-3 text-[13px] shadow-lg"
            style={{
              backgroundColor:
                toast.type ===
                'success'
                  ? COLORS.greenBg
                  : COLORS.rustBg,
              borderColor:
                toast.type ===
                'success'
                  ? '#C7DBCC'
                  : COLORS.rustLine,
              color:
                toast.type ===
                'success'
                  ? COLORS.green
                  : COLORS.rust,
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
      <BuatTugasModal
        open={createTaskModalOpen}
        initialScheduleId={
          numericScheduleId
        }
        initialClassroomId={
          schedule?.classroom?.id ??
          schedule?.classroom_id ??
          null
        }
        initialClassroomName={
          schedule?.classroom?.name ??
          ''
        }
        initialSubjectName={
          subjectName
        }
        onClose={() =>
          setCreateTaskModalOpen(false)
        }
        onCreated={() => {
          setCreateTaskModalOpen(false);
          void loadManageData(
            numericScheduleId,
          );
        }}
      />

    </GuruLayout>
  );
}