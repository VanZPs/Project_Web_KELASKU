import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  Download,
  FileSpreadsheet,
  GraduationCap,
  LoaderCircle,
  Pencil,
  Search,
  Users,
  X,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

import api from '../../api/axios';
import { GuruLayout } from '../../layouts/Guru/GuruLayout';

const KKM = 75;

const palette = {
  blueBg: '#E5ECF5',
  goldSoft: '#E7D3A8',
  green: '#4C7A5E',
  greenBg: '#E7F0EA',
  navy: '#1E2A47',
};

type GradeValue = number | null;

interface Task {
  id: number;
  title: string;
  type: string;
}

interface Student {
  id: number;
  name: string;
  email: string;
  gender: string;
  scores: Record<number, GradeValue>;
}

interface ClassSummary {
  id: number;
  name: string;
  subjectId: number;
  subjectName: string;
  studentCount: number;
  taskCount: number;
  average: number | null;
  taskAverages: (number | null)[];
  taskIds: (number | null)[];
  taskTitles: string[];
  taskTypes: string[];
}

interface SubjectSummary {
  id: number;
  name: string;
  classes: ClassSummary[];
}

interface LedgerData {
  classroomName: string;
  subjectName: string;
  students: Student[];
  tasks: Task[];
}

interface AssignmentDetail {
  id: number;
  title: string;
  description?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  status?: string | null;
  submission_mode?: string | null;
  questions?: Array<{
    id?: number;
    type?: string;
    question?: string | null;
    options?: Array<{ id?: number; option_text?: string; text?: string; label?: string }>;
  }>;
  files?: Array<{
    id: number;
    original_name?: string;
    file_name?: string;
    filename?: string;
    file_path?: string;
    mime_type?: string;
    size?: number;
  }>;
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function firstValue<T = unknown>(
  object: Record<string, any>,
  keys: string[],
  fallback: T,
): T {
  for (const key of keys) {
    if (object?.[key] !== undefined && object[key] !== null) {
      return object[key] as T;
    }
  }
  return fallback;
}

function getInitials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || 'S'
  );
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
}

function getSemesterLabel() {
  const now = new Date();
  const year = now.getFullYear();
  return now.getMonth() >= 6
    ? `Semester ganjil ${year}/${year + 1}`
    : `Semester genap ${year - 1}/${year}`;
}

function formatScore(value: number | null | undefined) {
  if (value === null || value === undefined) return '–';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Belum ditentukan';

  // Tanggal YYYY-MM-DD diproses sebagai tanggal kalender lokal
  // agar tidak bergeser sehari akibat konversi zona waktu.
  const dateOnly = /^\\d{4}-\\d{2}-\\d{2}$/.test(value);
  const date = dateOnly
    ? new Date(`${value}T12:00:00`)
    : new Date(value);

  if (Number.isNaN(date.getTime())) return 'Tanggal tidak valid';

  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatType(type: string) {
  const labels: Record<string, string> = {
    short: 'Jawaban singkat',
    paragraph: 'Paragraf',
    multiple: 'Pilihan ganda',
    checkbox: 'Kotak centang',
    upload: 'Upload file',
  };
  return labels[type] || 'Tugas';
}

function average(values: (number | null | undefined)[]) {
  const valid = values.filter(
    (value): value is number =>
      value !== null && value !== undefined && Number.isFinite(value),
  );
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function normalizeOverview(response: any): SubjectSummary[] {
  const root = response?.data ?? response;
  const rawSubjects = root?.subjects ?? root?.data?.subjects ?? [];
  if (!Array.isArray(rawSubjects)) return [];

  return rawSubjects.map((rawSubject: any) => {
    const rawClasses = rawSubject.classes ?? rawSubject.classrooms ?? [];
    const classes: ClassSummary[] = (
      Array.isArray(rawClasses) ? rawClasses : []
    ).map((rawClass: any) => {
      const rawTaskAverages =
        rawClass.task_averages ??
        rawClass.taskAverages ??
        rawClass.tasks_average ??
        [];

      const taskAverages = Array.isArray(rawTaskAverages)
        ? rawTaskAverages.map((item: any) =>
            numberOrNull(
              typeof item === 'object'
                ? firstValue(
                    item,
                    ['average', 'avg', 'average_grade', 'grade'],
                    null,
                  )
                : item,
            ),
          )
        : [];

      const taskIds = Array.isArray(rawTaskAverages)
        ? rawTaskAverages.map((item: any) => {
            if (typeof item !== 'object' || item === null) return null;
            const id = Number(firstValue(item, ['assignment_id', 'task_id', 'id'], null));
            return Number.isInteger(id) && id > 0 ? id : null;
          })
        : [];

      const taskTitles = Array.isArray(rawTaskAverages)
        ? rawTaskAverages.map((item: any, index: number) =>
            typeof item === 'object' && item !== null
              ? String(
                  firstValue(
                    item,
                    ['title', 'assignment_title', 'name'],
                    `Tugas ${index + 1}`,
                  ),
                )
              : `Tugas ${index + 1}`,
          )
        : [];

      const taskTypes = Array.isArray(rawTaskAverages)
        ? rawTaskAverages.map((item: any) =>
            typeof item === 'object' && item !== null
              ? String(
                  firstValue(
                    item,
                    ['type_label', 'assignment_type_label', 'type', 'category'],
                    'Tugas',
                  ),
                )
              : 'Tugas',
          )
        : [];

      return {
        id: Number(firstValue(rawClass, ['classroom_id', 'id'], 0)),
        name: String(
          firstValue(
            rawClass,
            ['classroom_name', 'name', 'class_name'],
            'Kelas',
          ),
        ),
        subjectId: Number(
          firstValue(
            rawClass,
            ['subject_id'],
            rawSubject.id ?? rawSubject.subject_id ?? 0,
          ),
        ),
        subjectName: String(
          firstValue(
            rawClass,
            ['subject_name'],
            rawSubject.name ?? rawSubject.subject_name ?? 'Mata pelajaran',
          ),
        ),
        studentCount: Number(
          firstValue(
            rawClass,
            ['student_count', 'students_count', 'total_students'],
            0,
          ),
        ),
        taskCount: Number(
          firstValue(
            rawClass,
            ['task_count', 'tasks_count', 'total_tasks'],
            taskAverages.length,
          ),
        ),
        average: numberOrNull(
          firstValue(
            rawClass,
            ['average_grade', 'average', 'avg_grade', 'class_average'],
            null,
          ),
        ),
        taskAverages,
        taskIds,
        taskTitles,
        taskTypes,
      };
    });

    return {
      id: Number(rawSubject.id ?? rawSubject.subject_id ?? 0),
      name: String(rawSubject.name ?? rawSubject.subject_name ?? 'Mata pelajaran'),
      classes,
    };
  });
}

function normalizeLedger(
  response: any,
  fallbackClass: ClassSummary,
): LedgerData {
  const root = response?.data ?? response;
  const rawTasks = root?.tasks ?? root?.assignments ?? [];
  const rawStudents = root?.students ?? [];

  const tasks: Task[] = (Array.isArray(rawTasks) ? rawTasks : []).map(
    (task: any, index: number) => ({
      id: Number(task.id ?? task.assignment_id ?? index + 1),
      title: String(task.title ?? task.name ?? `Tugas ${index + 1}`),
      type: String(
        task.type ?? task.question_type ?? task.questions?.[0]?.type ?? 'short',
      ),
    }),
  );

  const students: Student[] = (
    Array.isArray(rawStudents) ? rawStudents : []
  ).map((rawStudent: any, index: number) => {
    const rawScores =
      rawStudent.scores ?? rawStudent.grades ?? rawStudent.task_scores ?? {};
    const scores: Record<number, GradeValue> = {};

    tasks.forEach((task, taskIndex) => {
      let value: unknown = null;

      if (Array.isArray(rawScores)) {
        const matchingScore = rawScores.find(
          (score: any) =>
            Number(score.assignment_id ?? score.task_id ?? score.id) === task.id,
        );

        if (matchingScore) {
          value = firstValue(
            matchingScore,
            ['grade', 'score', 'value', 'points'],
            null,
          );
        } else if (rawScores.length === tasks.length) {
          const item = rawScores[taskIndex];
          value =
            typeof item === 'object'
              ? firstValue(item, ['grade', 'score', 'value', 'points'], null)
              : item;
        }
      } else if (rawScores && typeof rawScores === 'object') {
        value = rawScores[task.id] ?? rawScores[String(task.id)] ?? null;
      }

      scores[task.id] = numberOrNull(value);
    });

    const gender = String(
      rawStudent.gender ??
        rawStudent.jenis_kelamin ??
        rawStudent.student?.jenis_kelamin ??
        '',
    ).toLowerCase();

    return {
      id: Number(rawStudent.id ?? rawStudent.student_id ?? index + 1),
      name: String(
        rawStudent.name ??
          rawStudent.student_name ??
          rawStudent.user?.name ??
          rawStudent.student?.user?.name ??
          'Siswa',
      ),
      email: String(
        rawStudent.email ??
          rawStudent.user?.email ??
          rawStudent.student?.user?.email ??
          '',
      ),
      gender:
        gender === 'laki-laki' || gender === 'l' || gender === 'male'
          ? 'L'
          : gender === 'perempuan' || gender === 'p' || gender === 'female'
            ? 'P'
            : '-',
      scores,
    };
  });

  return {
    classroomName: String(
      root?.classroom?.name ??
        root?.classroom_name ??
        root?.class?.name ??
        fallbackClass.name,
    ),
    subjectName: String(
      root?.subject?.name ??
        root?.subject_name ??
        fallbackClass.subjectName,
    ),
    students,
    tasks,
  };
}

const cardClass =
  'min-w-0 overflow-hidden rounded-2xl border border-[#E3DACB] bg-[#FFFDF8] shadow-[0_1px_2px_rgba(30,25,15,0.04),0_8px_24px_-12px_rgba(30,25,15,0.10)]';
const searchClass =
  'flex min-w-0 items-center gap-2 rounded-xl border border-[#E3DACB] bg-[#FFFDF8] px-3 py-2.5 text-[#23283A] transition focus-within:border-[#2C3B5E] focus-within:ring-4 focus-within:ring-[#2C3B5E]/10';
const primaryButtonClass =
  'flex w-full items-center justify-center gap-2 rounded-xl border border-[#1E2A47] bg-[#1E2A47] px-3 py-3 text-sm font-bold text-white transition hover:bg-[#141C30] focus:outline-none focus:ring-4 focus:ring-[#1E2A47]/20';

export default function Nilai() {
  const user = getStoredUser();
  const namaGuru = user.name ?? 'Guru';
  const mapelGuru =
    user.subject?.name ?? user.teacher?.subject?.name ?? user.mapel ?? 'Guru';

  const [subjects, setSubjects] = useState<SubjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [currentSubject, setCurrentSubject] = useState<SubjectSummary | null>(null);
  const [ledgerClass, setLedgerClass] = useState<ClassSummary | null>(null);
  const [ledger, setLedger] = useState<LedgerData | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState('');
  const [selectedTask, setSelectedTask] = useState<AssignmentDetail | null>(null);
  const [taskDetailLoading, setTaskDetailLoading] = useState(false);
  const [taskDetailError, setTaskDetailError] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<'az' | 'za'>('az');
  const [editingScore, setEditingScore] = useState<{
    studentId: number;
    studentName: string;
    taskId: number;
    taskTitle: string;
    currentScore: number | null;
  } | null>(null);
  const [editScoreValue, setEditScoreValue] = useState('');
  const [savingScore, setSavingScore] = useState(false);
  const [editScoreError, setEditScoreError] = useState('');
  const [tooltip, setTooltip] = useState<{
    title: string;
    subtitle: string;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    const fontLinkId = 'kelasku-nilai-google-fonts';
    let fontLink = document.getElementById(fontLinkId) as HTMLLinkElement | null;

    if (!fontLink) {
      fontLink = document.createElement('link');
      fontLink.id = fontLinkId;
      fontLink.rel = 'stylesheet';
      fontLink.href =
        'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap';
      document.head.appendChild(fontLink);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function loadGrades() {
      setLoading(true);
      setError('');
      try {
        const response = await api.get('/guru/nilai');
        if (active) setSubjects(normalizeOverview(response.data));
      } catch (err: any) {
        if (active) {
          setError(
            err?.response?.data?.message ??
              'Data nilai gagal dimuat. Pastikan API nilai sudah tersedia.',
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadGrades();
    return () => {
      active = false;
    };
  }, []);

  const visibleSubjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    return subjects.filter((subject) =>
      subject.name.toLowerCase().includes(query),
    );
  }, [subjects, search]);

  const visibleClasses = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!currentSubject) return [];
    return currentSubject.classes.filter((item) =>
      item.name.toLowerCase().includes(query),
    );
  }, [currentSubject, search]);

  const summaryClasses = currentSubject
    ? currentSubject.classes
    : subjects.flatMap((subject) => subject.classes);
  const summaryStudentCount = summaryClasses.reduce(
    (total, item) => total + item.studentCount,
    0,
  );
  const summaryAverage = average(summaryClasses.map((item) => item.average));
  const subjectAverage = (subject: SubjectSummary) =>
    average(subject.classes.map((item) => item.average));

  async function openLedger(item: ClassSummary) {
    setLedgerClass(item);
    setLedger(null);
    setLedgerError('');
    setLedgerLoading(true);
    setStudentSearch('');
    setSortOrder('az');
    setTooltip(null);

    try {
      const response = await api.get('/guru/nilai/leger', {
        params: {
          classroom_id: item.id,
          subject_id: item.subjectId,
        },
      });
      setLedger(normalizeLedger(response.data, item));
    } catch (err: any) {
      setLedgerError(
        err?.response?.data?.message ??
          'Leger nilai gagal dimuat. Periksa endpoint /guru/nilai/leger.',
      );
    } finally {
      setLedgerLoading(false);
    }
  }

  async function openTaskDetail(taskId: number | null, taskTitle: string) {
    if (!taskId) {
      setTaskDetailError('ID tugas tidak tersedia dari data ringkasan. Muat ulang halaman setelah API mengirim assignment_id.');
      setSelectedTask({
        id: 0,
        title: taskTitle,
      });
      return;
    }

    setSelectedTask(null);
    setTaskDetailError('');
    setTaskDetailLoading(true);

    try {
      // Endpoint show tugas guru sudah tersedia di backend dan memeriksa hak akses guru.
      const response = await api.get(`/guru/tugas/${taskId}`);
      const detail = response?.data?.data ?? response?.data?.assignment ?? response?.data;

      if (!detail || Number(detail.id) !== taskId) {
        throw new Error('Respons detail tugas tidak sesuai dengan tugas yang dipilih.');
      }

      setSelectedTask({
        ...detail,
        id: taskId,
        title: String(detail.title ?? taskTitle),
        questions: Array.isArray(detail.questions) ? detail.questions : [],
        files: Array.isArray(detail.files) ? detail.files : [],
      });
    } catch (err: any) {
      setTaskDetailError(
        err?.response?.data?.message ??
          err?.message ??
          'Detail tugas gagal dimuat. Silakan coba lagi.',
      );
      setSelectedTask({ id: taskId, title: taskTitle });
    } finally {
      setTaskDetailLoading(false);
    }
  }

  function closeTaskDetail() {
    setSelectedTask(null);
    setTaskDetailError('');
    setTaskDetailLoading(false);
  }

  function backToSubjects() {
    setCurrentSubject(null);
    setSearch('');
  }

  function closeLedger() {
    setLedgerClass(null);
    setLedger(null);
    setLedgerError('');
    setTooltip(null);
    setEditingScore(null);
    setEditScoreError('');
  }

  function openScoreEditor(student: Student, task: Task) {
    const score = student.scores[task.id];
    setEditingScore({
      studentId: student.id,
      studentName: student.name,
      taskId: task.id,
      taskTitle: task.title,
      currentScore: score,
    });
    setEditScoreValue(score === null || score === undefined ? '' : String(score));
    setEditScoreError('');
    setTooltip(null);
  }

  async function saveScore() {
    if (!editingScore || !ledgerClass || !ledger) return;

    const trimmed = editScoreValue.trim();
    const parsed = trimmed === '' ? null : Number(trimmed);
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0 || parsed > 100)) {
      setEditScoreError('Nilai harus berupa angka antara 0 sampai 100, atau kosongkan untuk menghapus nilai.');
      return;
    }

    setSavingScore(true);
    setEditScoreError('');
    try {
      await api.patch('/guru/nilai/leger/nilai', {
        classroom_id: ledgerClass.id,
        subject_id: ledgerClass.subjectId,
        student_id: editingScore.studentId,
        assignment_id: editingScore.taskId,
        grade: parsed,
      });

      setLedger({
        ...ledger,
        students: ledger.students.map((student) =>
          student.id === editingScore.studentId
            ? {
                ...student,
                scores: { ...student.scores, [editingScore.taskId]: parsed },
              }
            : student,
        ),
      });
      setEditingScore(null);
      setEditScoreValue('');
    } catch (err: any) {
      setEditScoreError(
        err?.response?.data?.message ??
          'Nilai gagal disimpan. Pastikan route PUT /guru/nilai/leger/nilai sudah tersedia di backend.',
      );
    } finally {
      setSavingScore(false);
    }
  }

  useEffect(() => {
    if (!ledgerClass) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeLedger();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [ledgerClass]);

  const visibleStudents = useMemo(() => {
    if (!ledger) return [];
    const query = studentSearch.trim().toLowerCase();
    const filtered = ledger.students.filter(
      (student) =>
        student.name.toLowerCase().includes(query) ||
        student.email.toLowerCase().includes(query),
    );
    return filtered.sort((a, b) =>
      sortOrder === 'az'
        ? a.name.localeCompare(b.name, 'id')
        : b.name.localeCompare(a.name, 'id'),
    );
  }, [ledger, studentSearch, sortOrder]);

  function getExportStudents(): Student[] {
    if (!ledger) return [];
    return [...ledger.students].sort((a, b) =>
      sortOrder === 'az' ? a.name.localeCompare(b.name, 'id') : b.name.localeCompare(a.name, 'id'),
    );
  }

  function getExportFilename(extension: 'pdf' | 'xlsx'): string {
    const safeName = (value: string) => value.normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const classroom = safeName(ledger?.classroomName ?? ledgerClass?.name ?? 'Kelas');
    const subject = safeName(ledger?.subjectName ?? ledgerClass?.subjectName ?? 'Mapel');
    const semester = safeName(getSemesterLabel());
    return `Leger_Nilai_${classroom}_${subject}_${semester}.${extension}`;
  }

  function downloadPDF() {
    if (!ledger || !ledgerClass) return;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const students = getExportStudents();

    doc.setFontSize(16);
    doc.text('LEGER NILAI SISWA', 14, 15);
    doc.setFontSize(10);
    doc.text(`Kelas: ${ledger.classroomName}`, 14, 22);
    doc.text(`Mata pelajaran: ${ledger.subjectName}`, 14, 27);
    doc.text(`Semester: ${getSemesterLabel()}`, 14, 32);

    autoTable(doc, {
      startY: 38,
      head: [['No', 'Email', 'Nama Lengkap', 'L/P', ...ledger.tasks.map((task) => task.title)]],
      body: students.map((student, index) => [
        index + 1, student.email || '–', student.name, student.gender || '–',
        ...ledger.tasks.map((task) => formatScore(student.scores[task.id])),
      ]),
      theme: 'grid',
      margin: { top: 12, right: 10, bottom: 15, left: 10 },
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 2, overflow: 'linebreak', valign: 'middle' },
      headStyles: { fillColor: [30, 42, 71], textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 42 },
        2: { cellWidth: 43 },
        3: { cellWidth: 12, halign: 'center' },
      },
      didDrawPage: () => {
        const pageNumber = doc.getCurrentPageInfo().pageNumber;
        doc.setFontSize(8);
        doc.text(`Halaman ${pageNumber}`, doc.internal.pageSize.getWidth() - 10,
          doc.internal.pageSize.getHeight() - 5, { align: 'right' });
      },
    });
    doc.save(getExportFilename('pdf'));
  }

  function downloadExcel() {
    if (!ledger || !ledgerClass) return;
    const students = getExportStudents();
    const rows: (string | number)[][] = [
      ['LEGER NILAI SISWA'],
      ['Kelas', ledger.classroomName],
      ['Mata pelajaran', ledger.subjectName],
      ['Semester', getSemesterLabel()],
      [],
      ['No', 'Email', 'Nama Lengkap', 'L/P', ...ledger.tasks.map((task) => task.title)],
      ...students.map((student, index) => [
        index + 1, student.email || '–', student.name, student.gender || '–',
        ...ledger.tasks.map((task) => {
          const score = student.scores[task.id];
          return score === null || score === undefined ? '' : score;
        }),
      ]),
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 6 }, { wch: 28 }, { wch: 28 }, { wch: 8 },
      ...ledger.tasks.map(() => ({ wch: 16 })),
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Leger Nilai');
    XLSX.writeFile(workbook, getExportFilename('xlsx'));
  }

  return (
    <GuruLayout
      namaGuru={namaGuru}
      mapelGuru={mapelGuru}
      getInitials={getInitials}
      mainClassName="min-w-0 px-5 py-6 pb-14 sm:px-8"
    >
      <div className={"mx-auto max-w-[1248px] min-w-0 font-['Plus_Jakarta_Sans',sans-serif] text-[#23283A] antialiased"}>
        <header className="mb-5">
          {currentSubject && (
            <button
              type="button"
              onClick={backToSubjects}
              className="group mb-4 inline-flex items-center gap-2 rounded-lg border border-[#DCD2C1] bg-[#FFFDF8] px-3.5 py-2 text-sm font-semibold text-[#344563] shadow-sm transition-all duration-200 hover:border-[#C5A45D] hover:bg-white hover:text-[#1E2A47] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#C5A45D]/40"
            >
              <ArrowLeft
                size={16}
                className="transition-transform duration-200 group-hover:-translate-x-0.5"
              />
              <span>Kembali ke mata pelajaran</span>
            </button>
          )}
          <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.12em] text-[#6B7080]">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#C69A4B]" />
            <span>{getSemesterLabel()}</span>
          </div>
          <h1 className="mt-2 font-['Fraunces',serif] text-3xl font-semibold leading-tight tracking-tight text-[#141C30] sm:text-4xl">
            Nilai
          </h1>
          {currentSubject && (
            <div className="mt-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E5ECF5] px-3 py-1 text-xs font-bold text-[#3E6BAE]">
                <BookOpen size={13} />
                {currentSubject.name}
              </span>
            </div>
          )}
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-[#6B7080]">
            {currentSubject
              ? 'Pilih kelas untuk melihat leger nilai tugas seluruh siswanya.'
              : 'Pilih mata pelajaran untuk melihat nilai siswa di setiap kelas yang Anda ajar.'}
          </p>
        </header>

        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className={`${searchClass} w-full sm:max-w-[420px]`}>
            <Search size={16} className="shrink-0 text-[#6B7080]/70" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={
                currentSubject ? 'Cari kelas...' : 'Cari mata pelajaran...'
              }
              className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-[#6B7080]/70"
            />
          </label>
          <div className="flex items-center gap-2 self-start rounded-xl border border-[#E3DACB] bg-[#FFFDF8] px-3 py-2.5 text-sm font-semibold text-[#23283A] sm:self-auto">
            {getSemesterLabel()}
            <ChevronDown size={14} className="opacity-60" />
          </div>
        </div>

        <section className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border border-[#E3DACB] bg-[#FFFDF8] px-5 py-4 shadow-sm sm:gap-6">
          <SummaryItem
            icon={<BookOpen size={17} />}
            iconBackground={palette.blueBg}
            iconColor={palette.navy}
            value={currentSubject ? currentSubject.classes.length : subjects.length}
            label={currentSubject ? 'Kelas diajar' : 'Mata pelajaran'}
          />
          <SummaryItem
            icon={<Users size={17} />}
            iconBackground={palette.goldSoft}
            iconColor="#7A5A20"
            value={summaryStudentCount}
            label="Total siswa"
          />
          <SummaryItem
            icon={<GraduationCap size={18} />}
            iconBackground={palette.greenBg}
            iconColor={palette.green}
            value={summaryAverage === null ? '–' : Math.round(summaryAverage)}
            label="Rata-rata nilai keseluruhan"
          />
        </section>

        {loading ? (
          <div className="col-span-full flex flex-col items-center justify-center gap-3 py-12 text-sm text-[#6B7080]">
            <LoaderCircle className="animate-spin text-[#1E2A47]" size={27} />
            <p>Memuat data nilai...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-sm text-[#A8503B]">
            <p>{error}</p>
            <button
              type="button"
              className="rounded-lg bg-[#1E2A47] px-4 py-2.5 font-semibold text-white hover:bg-[#141C30]"
              onClick={() => window.location.reload()}
            >
              Muat ulang
            </button>
          </div>
        ) : currentSubject ? (
          <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {visibleClasses.length === 0 ? (
              <EmptyState text="Tidak ada kelas yang cocok dengan pencarian." />
            ) : (
              visibleClasses.map((item) => (
                <ClassCard
                  key={`${item.subjectId}-${item.id}`}
                  item={item}
                  onOpen={() => openLedger(item)}
                  onTaskClick={(taskId, taskTitle) => void openTaskDetail(taskId, taskTitle)}
                />
              ))
            )}
          </section>
        ) : (
          <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {visibleSubjects.length === 0 ? (
              <EmptyState text="Tidak ada mata pelajaran yang cocok dengan pencarian." />
            ) : (
              visibleSubjects.map((subject) => (
                <SubjectCard
                  key={subject.id || subject.name}
                  subject={subject}
                  average={subjectAverage(subject)}
                  onOpen={() => {
                    setCurrentSubject(subject);
                    setSearch('');
                  }}
                />
              ))
            )}
          </section>
        )}

        {ledgerClass && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[#14110A]/60 p-0 sm:p-5 lg:p-7"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeLedger();
            }}
          >
            <section
              className="flex h-full max-h-[90vh] w-full max-w-[1320px] flex-col overflow-hidden rounded-none bg-[#FFFDF8] shadow-2xl sm:h-auto sm:rounded-[20px]"
              role="dialog"
              aria-modal="true"
              aria-label={`Leger nilai ${ledgerClass.name}`}
            >
              <header className="flex shrink-0 items-start justify-between gap-4 px-5 pb-4 pt-5 sm:px-8 sm:pb-5 sm:pt-6">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="font-['Fraunces',serif] text-2xl font-semibold tracking-tight text-[#141C30] sm:text-3xl">
                      {ledger?.classroomName ?? ledgerClass.name}
                    </h2>
                    <span className="rounded-full bg-[#F1EAD8] px-3 py-1.5 text-xs font-semibold text-[#23283A]">
                      {ledger?.students.length ?? ledgerClass.studentCount} siswa
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[#6B7080]">
                    {ledger?.subjectName ?? ledgerClass.subjectName}
                    {' · '}
                    {getSemesterLabel()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeLedger}
                  aria-label="Tutup leger nilai"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#6B7080] transition hover:bg-[#F6E1D9] hover:text-[#A8503B]"
                >
                  <X size={18} />
                </button>
              </header>

              <div className="flex shrink-0 flex-col gap-3 px-5 pb-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
                <label className={`${searchClass} w-full flex-1 sm:max-w-[580px]`}>
                  <Search size={17} className="shrink-0 text-[#6B7080]/70" />
                  <input
                    value={studentSearch}
                    onChange={(event) => setStudentSearch(event.target.value)}
                    placeholder="Cari nama siswa atau email..."
                    className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-[#6B7080]/70"
                  />
                </label>
                <select
                  className="min-h-11 w-full cursor-pointer rounded-xl border border-[#E3DACB] bg-[#FFFDF8] px-4 py-2.5 text-sm text-[#23283A] outline-none transition focus:border-[#2C3B5E] focus:ring-4 focus:ring-[#2C3B5E]/10 sm:w-52"
                  value={sortOrder}
                  onChange={(event) =>
                    setSortOrder(event.target.value as 'az' | 'za')
                  }
                >
                  <option value="az">Nama A–Z</option>
                  <option value="za">Nama Z–A</option>
                </select>
              </div>

              <div className="flex shrink-0 flex-wrap justify-end gap-2 px-5 pb-4 sm:px-8">
                <button type="button" onClick={downloadPDF}
                  disabled={ledgerLoading || !ledger || !!ledgerError}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#B93838] bg-[#C94040] px-4 py-2.5 text-sm font-semibold text-white transition hover:border-[#A92F2F] hover:bg-[#A92F2F] disabled:cursor-not-allowed disabled:opacity-50">
                  <Download size={16} /> Download PDF
                </button>
                <button type="button" onClick={downloadExcel}
                  disabled={ledgerLoading || !ledger || !!ledgerError}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#27804A] bg-[#2F8F55] px-4 py-2.5 text-sm font-semibold text-white transition hover:border-[#216B3D] hover:bg-[#216B3D] disabled:cursor-not-allowed disabled:opacity-50">
                  <FileSpreadsheet size={16} /> Download Excel
                </button>
              </div>

              {ledgerLoading ? (
                <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 text-sm text-[#6B7080]">
                  <LoaderCircle className="animate-spin text-[#1E2A47]" size={27} />
                  <p>Memuat leger nilai...</p>
                </div>
              ) : ledgerError ? (
                <div className="flex min-h-[220px] items-center justify-center px-6 text-center text-sm text-[#A8503B]">
                  {ledgerError}
                </div>
              ) : ledger ? (
                <>
                  <div className="min-h-0 flex-1 overflow-auto border-t border-[#E3DACB] text-left">
                    <table className="ml-0 mr-auto w-max min-w-0 border-separate border-spacing-0 text-left">
                      <colgroup>
                        <col style={{ width: 52 }} />
                        <col style={{ width: 214 }} />
                        <col style={{ width: 230 }} />
                        <col style={{ width: 60 }} />
                        {ledger.tasks.map((task) => (
                          <col key={task.id} style={{ width: 92 }} />
                        ))}
                      </colgroup>
                      <thead>
                        <tr>
                          <th className="sticky left-0 top-0 z-30 h-16 border-b border-[#E3DACB] bg-[#FBF8EF] px-3 text-center text-[11px] font-bold uppercase tracking-wide text-[#6B7080]">
                            No
                          </th>
                          <th className="sticky left-[52px] top-0 z-30 h-16 border-b border-[#E3DACB] bg-[#FBF8EF] px-3 text-center text-[11px] font-bold uppercase tracking-wide text-[#6B7080]">
                            Email
                          </th>
                          <th className="sticky left-[266px] top-0 z-30 h-16 border-b border-[#E3DACB] bg-[#FBF8EF] px-3 text-center text-[11px] font-bold uppercase tracking-wide text-[#6B7080]">
                            Nama lengkap
                          </th>
                          <th className="sticky left-[496px] top-0 z-30 h-16 border-b border-r border-[#E3DACB] bg-[#FBF8EF] px-2 text-center text-[11px] font-bold uppercase tracking-wide text-[#6B7080]">
                            L/P
                          </th>
                          {ledger.tasks.map((task, index) => (
                            <th
                              key={task.id}
                              className="sticky top-0 z-20 h-16 cursor-help border-b border-l border-[#D6E2D5] bg-[#EAF1EA] px-4 !text-left text-xs font-bold normal-case tracking-normal text-[#141C30] transition hover:bg-[#DDEADC]"
                              onMouseEnter={(event) => {
                                const rect = event.currentTarget.getBoundingClientRect();
                                setTooltip({
                                  title: task.title,
                                  subtitle: `Tugas ${index + 1} · ${formatType(task.type)}`,
                                  x: Math.max(
                                    8,
                                    Math.min(
                                      window.innerWidth - 268,
                                      rect.left + rect.width / 2 - 130,
                                    ),
                                  ),
                                  y: rect.bottom + 8,
                                });
                              }}
                              onMouseLeave={() => setTooltip(null)}
                              onFocus={(event) => {
                                const rect = event.currentTarget.getBoundingClientRect();
                                setTooltip({
                                  title: task.title,
                                  subtitle: `Tugas ${index + 1} · ${formatType(task.type)}`,
                                  x: Math.max(8, rect.left - 100),
                                  y: rect.bottom + 8,
                                });
                              }}
                              onBlur={() => setTooltip(null)}
                              tabIndex={0}
                            >
                              <span className="inline-block whitespace-nowrap px-1 py-2 text-left">
                                Tugas {index + 1}
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {visibleStudents.map((student, index) => (
                          <tr key={student.id} className="group">
                            <td className="sticky left-0 z-10 h-[54px] border-b border-[#F0EADA] bg-[#FFFDF8] px-3 text-center text-sm text-[#6B7080] group-hover:bg-[#FBF8EF]">
                              {index + 1}
                            </td>
                            <td
                              className="sticky left-[52px] z-10 h-[54px] max-w-0 overflow-hidden text-ellipsis whitespace-nowrap border-b border-[#F0EADA] bg-[#FFFDF8] px-3 text-center text-sm text-[#23283A] group-hover:bg-[#FBF8EF]"
                              title={student.email}
                            >
                              {student.email || '–'}
                            </td>
                            <td className="sticky left-[266px] z-10 h-[54px] border-b border-[#F0EADA] bg-[#FFFDF8] px-3 group-hover:bg-[#FBF8EF]">
                              <div className="flex min-w-0 items-center justify-center gap-3">
                                <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[#1E2A47] text-[11px] font-bold text-white">
                                  {getInitials(student.name)}
                                </span>
                                <span className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-bold text-[#141C30]">
                                  {student.name}
                                </span>
                              </div>
                            </td>
                            <td className="sticky left-[496px] z-10 h-[54px] border-b border-r border-[#E3DACB] bg-[#FFFDF8] px-2 text-center group-hover:bg-[#FBF8EF]">
                              <span
                                className={`inline-flex h-[26px] w-8 items-center justify-center rounded-full text-[11px] font-bold ${
                                  student.gender === 'L'
                                    ? 'bg-[#E5ECF5] text-[#1E2A47]'
                                    : student.gender === 'P'
                                      ? 'bg-[#EFE2EC] text-[#7A4C6E]'
                                      : 'bg-[#F1EAD8] text-[#23283A]'
                                }`}
                              >
                                {student.gender}
                              </span>
                            </td>
                            {ledger.tasks.map((task) => {
                              const score = student.scores[task.id];
                              return (
                                <td
                                  key={task.id}
                                  className="h-[54px] border-b border-l border-[#F3EEDF] p-0 text-center"
                                >
                                  <button
                                    type="button"
                                    onClick={() => openScoreEditor(student, task)}
                                    title={`Edit nilai ${task.title}`}
                                    aria-label={`Edit nilai ${task.title} milik ${student.name}`}
                                    className={`group/score relative flex h-[53px] w-full items-center justify-center gap-1.5 px-3 text-sm tabular-nums transition hover:bg-[#F7F3E8] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#C5A45D] ${
                                      score === null || score === undefined
                                        ? 'font-normal text-[#C7C0AC]'
                                        : score < KKM
                                          ? 'font-semibold text-[#A8503B]'
                                          : 'font-semibold text-[#23283A]'
                                    }`}
                                  >
                                    <span>{formatScore(score)}</span>
                                    <Pencil
                                      size={12}
                                      className="absolute right-2 opacity-0 transition-opacity group-hover/score:opacity-70 group-focus-visible/score:opacity-100"
                                    />
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                        {visibleStudents.length === 0 && (
                          <tr>
                            <td
                              colSpan={4 + ledger.tasks.length}
                              className="px-6 py-9 text-center text-sm text-[#6B7080]"
                            >
                              Tidak ada siswa yang cocok dengan pencarian.
                            </td>
                          </tr>
                        )}
                        {ledger.tasks.length === 0 && visibleStudents.length > 0 && (
                          <tr>
                            <td
                              colSpan={4}
                              className="px-6 py-9 text-center text-sm text-[#6B7080]"
                            >
                              Belum ada tugas bernilai untuk kelas ini.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <footer className="flex shrink-0 flex-col gap-3 border-t border-[#E3DACB] bg-[#FBF8EF] px-5 py-4 text-xs text-[#6B7080] sm:flex-row sm:items-center sm:justify-between sm:px-8">
                    <span>
                      Menampilkan <b className="text-[#23283A]">{visibleStudents.length}</b> dari{' '}
                      <b className="text-[#23283A]">{ledger.students.length}</b> siswa
                    </span>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-[#A8503B]" />
                        Nilai di bawah 75
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="font-bold text-[#B3AE9C]">–</span>
                        Belum ada nilai
                      </span>
                      <span>Arahkan kursor ke kolom tugas untuk melihat judulnya</span>
                    </div>
                  </footer>
                </>
              ) : null}
            </section>

            {editingScore && (
              <div
                className="fixed inset-0 z-[350] flex items-center justify-center bg-[#14110A]/35 p-4"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget && !savingScore) {
                    setEditingScore(null);
                    setEditScoreError('');
                  }
                }}
              >
                <section
                  role="dialog"
                  aria-modal="true"
                  aria-label="Edit nilai tugas"
                  className="w-full max-w-[400px] rounded-2xl border border-[#E3DACB] bg-[#FFFDF8] p-5 shadow-2xl sm:p-6"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-['Fraunces',serif] text-xl font-semibold text-[#141C30]">
                        Edit nilai
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-[#6B7080]">
                        {editingScore.studentName} · {editingScore.taskTitle}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={savingScore}
                      onClick={() => {
                        setEditingScore(null);
                        setEditScoreError('');
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-[#6B7080] transition hover:bg-[#F1EAD8] disabled:opacity-50"
                      aria-label="Tutup edit nilai"
                    >
                      <X size={17} />
                    </button>
                  </div>

                  <label className="mb-2 block text-sm font-semibold text-[#23283A]" htmlFor="nilai-manual">
                    Nilai (0–100)
                  </label>
                  <input
                    id="nilai-manual"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    autoFocus
                    value={editScoreValue}
                    onChange={(event) => setEditScoreValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !savingScore) void saveScore();
                      if (event.key === 'Escape' && !savingScore) {
                        setEditingScore(null);
                        setEditScoreError('');
                      }
                    }}
                    placeholder="Masukkan nilai"
                    className="min-h-11 w-full rounded-xl border border-[#DCD2C1] bg-white px-3 text-sm text-[#23283A] outline-none transition focus:border-[#C5A45D] focus:ring-4 focus:ring-[#C5A45D]/15"
                  />
                  <p className="mt-2 text-xs text-[#6B7080]">
                    Kosongkan nilai jika ingin menghapus nilai yang tersimpan.
                  </p>

                  {editScoreError && (
                    <p className="mt-3 rounded-lg border border-[#E9C9BE] bg-[#FBEEE9] px-3 py-2 text-xs leading-5 text-[#A8503B]">
                      {editScoreError}
                    </p>
                  )}

                  <div className="mt-5 flex justify-end gap-2">
                    <button
                      type="button"
                      disabled={savingScore}
                      onClick={() => {
                        setEditingScore(null);
                        setEditScoreError('');
                      }}
                      className="rounded-xl border border-[#E3DACB] bg-white px-4 py-2.5 text-sm font-semibold text-[#344563] transition hover:bg-[#FBF8EF] disabled:opacity-50"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      disabled={savingScore}
                      onClick={() => void saveScore()}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#1E2A47] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#141C30] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingScore && <LoaderCircle size={15} className="animate-spin" />}
                      {savingScore ? 'Menyimpan...' : 'Simpan nilai'}
                    </button>
                  </div>
                </section>
              </div>
            )}

            {tooltip && (
              <div
                className="pointer-events-none fixed z-[300] max-w-[260px] rounded-lg bg-[#141C30] px-3 py-2 text-white shadow-xl"
                style={{ left: tooltip.x, top: tooltip.y }}
              >
                <div className="text-xs font-bold leading-snug">{tooltip.title}</div>
                <div className="mt-1 text-[11px] text-[#B7C0D6]">
                  {tooltip.subtitle}
                </div>
              </div>
            )}
          </div>
        )}

            {(selectedTask || taskDetailLoading) && (
              <div
                className="fixed inset-0 z-[320] flex items-center justify-center bg-[#14110A]/45 p-4"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget && !taskDetailLoading) {
                    closeTaskDetail();
                  }
                }}
              >
                <section
                  role="dialog"
                  aria-modal="true"
                  aria-label="Detail tugas"
                  className="flex max-h-[calc(100vh-32px)] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl border border-[#E3DACB] bg-[#FFFDF8] shadow-2xl"
                >
                  <header className="flex items-start justify-between gap-3 border-b border-[#E3DACB] px-5 py-4 sm:px-6">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E5ECF5] text-[#1E2A47]">
                        <BookOpen size={19} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8A6A2B]">Detail tugas</p>
                        <h3 className="mt-1 break-words font-['Fraunces',serif] text-xl font-semibold text-[#141C30]">
                          {selectedTask?.title ?? 'Memuat detail tugas...'}
                        </h3>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={closeTaskDetail}
                      disabled={taskDetailLoading}
                      aria-label="Tutup detail tugas"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#6B7080] transition hover:bg-[#F1EAD8] disabled:opacity-50"
                    >
                      <X size={18} />
                    </button>
                  </header>

                  <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                    {taskDetailLoading ? (
                      <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#6B7080]">
                        <LoaderCircle size={18} className="animate-spin" />
                        Memuat detail tugas...
                      </div>
                    ) : taskDetailError ? (
                      <div className="rounded-xl border border-[#E9C9BE] bg-[#FBEEE9] px-4 py-3 text-sm leading-6 text-[#A8503B]">
                        {taskDetailError}
                        {selectedTask?.id ? (
                          <button
                            type="button"
                            onClick={() => void openTaskDetail(selectedTask.id, selectedTask.title)}
                            className="ml-2 font-bold underline underline-offset-2"
                          >
                            Coba lagi
                          </button>
                        ) : null}
                      </div>
                    ) : selectedTask ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                          <div className="rounded-xl border border-[#E3DACB] bg-white px-3.5 py-3">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#858273]">Jenis tugas</p>
                            <p className="mt-1 text-sm font-bold text-[#23283A]">
                              {[...new Set((selectedTask.questions ?? []).map((question) => question.type).filter(Boolean))]
                                .map((type) => ({
                                  short: 'Jawaban singkat',
                                  paragraph: 'Paragraf',
                                  multiple: 'Pilihan ganda',
                                  checkbox: 'Kotak centang',
                                  upload: 'Upload file',
                                  info: 'Catatan informasi',
                                } as Record<string, string>)[type!] ?? type)
                                .join(', ') || (selectedTask.files?.length ? 'Upload file' : 'Tugas')}
                            </p>
                          </div>
                          <div className="rounded-xl border border-[#E3DACB] bg-white px-3.5 py-3">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#858273]">Tanggal mulai</p>
                            <p className="mt-1 text-sm font-bold text-[#23283A]">{formatDate(selectedTask.start_date)}</p>
                          </div>
                          <div className="rounded-xl border border-[#E3DACB] bg-white px-3.5 py-3">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#858273]">Tenggat</p>
                            <p className="mt-1 text-sm font-bold text-[#23283A]">{formatDate(selectedTask.due_date)}</p>
                          </div>
                        </div>

                        <section className="rounded-xl border border-[#E3DACB] bg-white p-4">
                          <h4 className="text-sm font-extrabold text-[#141C30]">Deskripsi / materi</h4>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#52596A]">
                            {selectedTask.description?.trim() || 'Tidak ada deskripsi tambahan.'}
                          </p>
                        </section>

                        <section className="rounded-xl border border-[#E3DACB] bg-white p-4">
                          <div className="flex items-center justify-between gap-3">
                            <h4 className="text-sm font-extrabold text-[#141C30]">Soal tugas</h4>
                            <span className="rounded-full bg-[#E5ECF5] px-2.5 py-1 text-[10px] font-bold text-[#344563]">
                              {selectedTask.questions?.length ?? 0} soal
                            </span>
                          </div>
                          {selectedTask.questions?.length ? (
                            <div className="mt-3 space-y-3">
                              {selectedTask.questions.map((question, index) => (
                                <div key={question.id ?? index} className="rounded-lg border border-[#EEE8DC] bg-[#FBF9F3] p-3.5">
                                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#8A6A2B]">Soal {index + 1}</p>
                                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[#23283A]">
                                    {question.question?.trim() || 'Konten soal tidak tersedia.'}
                                  </p>
                                  {question.options?.length ? (
                                    <ul className="mt-2 space-y-1.5">
                                      {question.options.map((option, optionIndex) => (
                                        <li key={option.id ?? optionIndex} className="flex gap-2 text-xs leading-5 text-[#52596A]">
                                          <span className="font-bold">{String.fromCharCode(65 + optionIndex)}.</span>
                                          <span>{option.option_text ?? option.text ?? option.label ?? 'Pilihan'}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-2 text-sm text-[#6B7080]">Tugas ini tidak memiliki daftar soal terstruktur.</p>
                          )}
                        </section>

                        {selectedTask.files?.length ? (
                          <section className="rounded-xl border border-[#E3DACB] bg-white p-4">
                            <h4 className="text-sm font-extrabold text-[#141C30]">Lampiran materi</h4>
                            <ul className="mt-2 space-y-2">
                              {selectedTask.files.map((file, index) => (
                                <li key={file.id ?? index} className="flex items-start gap-2 rounded-lg bg-[#FBF9F3] px-3 py-2.5 text-sm text-[#344563]">
                                  <Download size={15} className="mt-0.5 shrink-0" />
                                  <span className="break-all">{file.original_name ?? file.file_name ?? file.filename ?? file.file_path ?? `Lampiran ${index + 1}`}</span>
                                </li>
                              ))}
                            </ul>
                          </section>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <footer className="flex justify-end border-t border-[#E3DACB] px-5 py-3.5 sm:px-6">
                    <button type="button" onClick={closeTaskDetail} className="rounded-xl border border-[#DCD2C1] bg-white px-4 py-2.5 text-sm font-bold text-[#344563] transition hover:bg-[#FBF8EF]">
                      Tutup
                    </button>
                  </footer>
                </section>
              </div>
            )}

      </div>
    </GuruLayout>
  );
}

function SummaryItem({
  icon,
  iconBackground,
  iconColor,
  value,
  label,
}: {
  icon: ReactNode;
  iconBackground: string;
  iconColor: string;
  value: string | number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 sm:pr-5 sm:[&:not(:last-child)]:border-r sm:[&:not(:last-child)]:border-[#E3DACB]">
      <div
        className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg"
        style={{ background: iconBackground, color: iconColor }}
      >
        {icon}
      </div>
      <div>
        <div className="font-['Fraunces',serif] text-xl font-semibold leading-none text-[#141C30]">
          {value}
        </div>
        <div className="mt-1 text-[11px] text-[#6B7080]">{label}</div>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="col-span-full px-5 py-10 text-center text-sm text-[#6B7080]">
      {text}
    </div>
  );
}

function SubjectCard({
  subject,
  average: subjectAvg,
  onOpen,
}: {
  subject: SubjectSummary;
  average: number | null;
  onOpen: () => void;
}) {
  const totalStudents = subject.classes.reduce(
    (total, item) => total + item.studentCount,
    0,
  );
  const isRequired = subject.name.toLowerCase().includes('wajib');

  return (
    <article className={`${cardClass} flex flex-col`}>
      <div className="flex items-center gap-3.5 border-b border-[#E3DACB] px-5 pb-4 pt-5 sm:px-6">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-[22px] ${
            isRequired
              ? 'bg-[#E7D3A8] text-[#7A5A20]'
              : 'bg-[#E5ECF5] text-[#3E6BAE]'
          }`}
        >
          {isRequired ? '📗' : '📘'}
        </div>
        <div className="min-w-0">
          <h2 className="font-['Fraunces',serif] text-xl font-semibold tracking-tight text-[#141C30]">
            {subject.name}
          </h2>
          <div className="mt-1 text-xs text-[#6B7080]">{getSemesterLabel()}</div>
        </div>
      </div>

      <div className="flex-1 px-5 pt-5 sm:px-6">
        <div className="mb-4 grid grid-cols-3 gap-2.5">
          <MiniStat value={subject.classes.length} label="Kelas diajar" />
          <MiniStat value={totalStudents} label="Total siswa" />
          <MiniStat
            value={subjectAvg === null ? '–' : Math.round(subjectAvg)}
            label="Rata-rata nilai"
          />
        </div>
        <div className="mb-4 rounded-xl border border-[#E3DACB] bg-[#FBF9F3] p-3.5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-[#141C30]">
                Rata-rata per kelas
              </div>
              <div className="mt-0.5 text-[11px] text-[#7B8190]">
                Ringkasan nilai setiap kelas
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-[#E5ECF5] px-2 py-1 text-[10px] font-bold text-[#355B91]">
              {subject.classes.length} kelas
            </span>
          </div>

          {subject.classes.length ? (
            <div className="grid grid-cols-2 gap-2">
              {subject.classes.map((item) => (
                <div
                  className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-[#E8DFD0] bg-[#FFFDF8] px-3 py-2.5 transition-colors hover:border-[#CDB783] hover:bg-white"
                  key={`${item.id}-${item.name}`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#EAF0F8] text-[10px] font-extrabold text-[#1E2A47]">
                      <BookOpen size={14} />
                    </span>
                    <span className="truncate text-xs font-bold text-[#23283A]" title={item.name}>
                      {item.name}
                    </span>
                  </div>
                  <span
                    className={`shrink-0 rounded-md px-2 py-1 font-['Fraunces',serif] text-sm font-semibold ${
                      item.average === null
                        ? 'bg-[#F1EEE6] text-[#858273]'
                        : item.average < 75
                          ? 'bg-[#F7E5DF] text-[#A8503B]'
                          : 'bg-[#E5F0E8] text-[#3F7558]'
                    }`}
                    title={item.average === null ? 'Belum ada nilai' : `Rata-rata ${item.name}: ${Math.round(item.average)}`}
                  >
                    {item.average === null ? '–' : Math.round(item.average)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[#DCD2C1] px-3 py-4 text-center text-xs text-[#6B7080]">
              Belum ada kelas untuk mata pelajaran ini.
            </div>
          )}
        </div>
      </div>

      <div className="mt-auto px-5 pb-5 sm:px-6">
        <button type="button" className={primaryButtonClass} onClick={onOpen}>
          Lihat kelas
          <ArrowRight size={15} />
        </button>
      </div>
    </article>
  );
}

function ClassCard({
  item,
  onOpen,
  onTaskClick,
}: {
  item: ClassSummary;
  onOpen: () => void;
  onTaskClick: (taskId: number | null, taskTitle: string) => void;
}) {
  const isRequired = item.subjectName.toLowerCase().includes('wajib');
  const bars = item.taskAverages;
  const [taskPage, setTaskPage] = useState(0);
  const tasksPerPage = 2;
  const taskPageCount = Math.max(1, Math.ceil(bars.length / tasksPerPage));
  const safeTaskPage = Math.min(taskPage, taskPageCount - 1);
  const visibleTaskBars = bars.slice(
    safeTaskPage * tasksPerPage,
    safeTaskPage * tasksPerPage + tasksPerPage,
  );

  return (
    <article className={`${cardClass} flex flex-col`}>
      <div className="border-b border-[#E3DACB] px-5 pb-4 pt-5 sm:px-6">
        <span
          className={`mb-2.5 inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${
            isRequired
              ? 'bg-[#E7D3A8] text-[#7A5A20]'
              : 'bg-[#E5ECF5] text-[#3E6BAE]'
          }`}
        >
          {item.subjectName}
        </span>
        <h2 className="font-['Fraunces',serif] text-xl font-semibold tracking-tight text-[#141C30]">
          {item.name}
        </h2>
      </div>

      <div className="flex-1 px-5 pt-5 sm:px-6">
        <div className="mb-4 grid grid-cols-3 gap-2.5">
          <MiniStat value={item.studentCount} label="Total siswa" />
          <MiniStat value={item.taskCount} label="Tugas bernilai" />
          <MiniStat
            value={item.average === null ? '–' : Math.round(item.average)}
            label="Rata-rata nilai"
          />
        </div>

        <div className="mb-4 overflow-hidden rounded-2xl border border-[#E3DACB] bg-gradient-to-br from-white to-[#F8F6EF] p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#E5ECF5] text-[#1E2A47]">
                  <GraduationCap size={16} />
                </span>
                <div>
                  <h3 className="text-sm font-extrabold text-[#141C30]">
                    Rata-rata per tugas
                  </h3>
                  <p className="mt-0.5 text-[11px] text-[#7B8190]">
                    Perbandingan nilai rata-rata setiap tugas
                  </p>
                </div>
              </div>
            </div>
            <span className="rounded-full border border-[#E3DACB] bg-white px-3 py-1.5 text-[11px] font-bold text-[#344563] shadow-sm">
              {bars.length ? `${bars.length} tugas` : 'Belum ada tugas'}
            </span>
          </div>

          {bars.length ? (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] font-medium text-[#6B7080]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#2F8F55]" />
                  Mencapai KKM (≥ {KKM})
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#C94040]" />
                  Di bawah KKM
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 border-l-2 border-dashed border-[#A17A2D]" />
                  Batas KKM
                </span>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setTaskPage((page) => Math.max(0, page - 1))}
                  disabled={safeTaskPage === 0}
                  aria-label="Lihat dua tugas sebelumnya"
                  title="Tugas sebelumnya"
                  className="flex h-9 w-8 shrink-0 items-center justify-center rounded-xl border border-[#E3DACB] bg-white text-[#344563] shadow-sm transition hover:border-[#C5A45D] hover:bg-[#FBF8EF] disabled:cursor-not-allowed disabled:opacity-30 sm:h-10 sm:w-9"
                >
                  <ArrowLeft size={17} />
                </button>

                <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2">
                {visibleTaskBars.map((score, visibleIndex) => {
                  const index = safeTaskPage * tasksPerPage + visibleIndex;
                  const hasScore = score !== null && Number.isFinite(score);
                  const normalizedScore = hasScore
                    ? Math.max(0, Math.min(100, score))
                    : 0;
                  const meetsKKM = hasScore && score >= KKM;
                  const taskName = item.taskTitles[index] ?? `Tugas ${index + 1}`;

                  return (
                    <button
                      type="button"
                      key={`${item.taskIds[index] ?? taskName}-${index}`}
                      onClick={() => onTaskClick(item.taskIds[index] ?? null, taskName)}
                      className="min-w-0 rounded-xl border border-[#ECE5D8] bg-white/90 px-3.5 py-3 text-left transition duration-200 hover:border-[#CDB783] hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[#C5A45D]/50"
                      title={`Klik untuk melihat detail: ${taskName} · ${item.taskTypes[index] ?? 'Tugas'}`}
                      aria-label={`Lihat detail tugas ${taskName}`}
                    >
                      <div className="mb-2 flex min-w-0 items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-[#23283A]" title={taskName}>
                            {`Tugas ${index + 1}`}
                          </p>
                          <p className="mt-0.5 truncate text-[10px] text-[#858273]" title={taskName}>
                            {taskName}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-lg px-2.5 py-1 text-sm font-extrabold tabular-nums ${
                            !hasScore
                              ? 'bg-[#F1EEE6] text-[#858273]'
                              : meetsKKM
                                ? 'bg-[#E5F2E9] text-[#287447]'
                                : 'bg-[#FBE9E4] text-[#B33C32]'
                          }`}
                        >
                          {hasScore ? Number(score.toFixed(1)).toString() : '–'}
                        </span>
                      </div>

                      <div
                        className="relative h-2.5 overflow-visible rounded-full bg-[#ECEAE3]"
                        role="progressbar"
                        aria-label={`Rata-rata ${taskName}`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={hasScore ? normalizedScore : 0}
                      >
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            !hasScore
                              ? 'bg-[#D8D4C8]'
                              : meetsKKM
                                ? 'bg-gradient-to-r from-[#4BA66D] to-[#287447]'
                                : 'bg-gradient-to-r from-[#E68A72] to-[#C94040]'
                          }`}
                          style={{ width: `${normalizedScore}%` }}
                        />
                        <span
                          className="pointer-events-none absolute -top-1 h-[18px] border-l-2 border-dashed border-[#A17A2D]"
                          style={{ left: `${KKM}%` }}
                          aria-hidden="true"
                        />
                      </div>
                      <div className="mt-1.5 flex justify-between text-[9px] tabular-nums text-[#929080]">
                        <span>0</span>
                        <span className="font-semibold text-[#8A6A2B]">KKM {KKM}</span>
                        <span>100</span>
                      </div>
                    </button>
                  );
                })}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setTaskPage((page) => Math.min(taskPageCount - 1, page + 1))
                  }
                  disabled={safeTaskPage >= taskPageCount - 1}
                  aria-label="Lihat dua tugas berikutnya"
                  title="Tugas berikutnya"
                  className="flex h-9 w-8 shrink-0 items-center justify-center rounded-xl border border-[#E3DACB] bg-white text-[#344563] shadow-sm transition hover:border-[#C5A45D] hover:bg-[#FBF8EF] disabled:cursor-not-allowed disabled:opacity-30 sm:h-10 sm:w-9"
                >
                  <ArrowRight size={17} />
                </button>
              </div>

              {taskPageCount > 1 && (
                <div className="mt-3 flex items-center justify-center gap-1.5">
                  {Array.from({ length: taskPageCount }, (_, pageIndex) => (
                    <button
                      key={pageIndex}
                      type="button"
                      onClick={() => setTaskPage(pageIndex)}
                      aria-label={`Tampilkan halaman tugas ${pageIndex + 1}`}
                      aria-current={safeTaskPage === pageIndex ? 'page' : undefined}
                      className={`h-1.5 rounded-full transition-all ${
                        safeTaskPage === pageIndex
                          ? 'w-5 bg-[#1E2A47]'
                          : 'w-1.5 bg-[#D8D4C8] hover:bg-[#A7A08F]'
                      }`}
                    />
                  ))}
                  <span className="ml-1 text-[10px] text-[#7B8190]">
                    {safeTaskPage * tasksPerPage + 1}–
                    {Math.min((safeTaskPage + 1) * tasksPerPage, bars.length)} dari {bars.length} tugas
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-[#DCD2C1] bg-white/70 px-4 py-7 text-center">
              <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#F1EEE6] text-[#858273]">
                <BookOpen size={18} />
              </span>
              <p className="mt-2 text-xs font-semibold text-[#344563]">
                Nilai tugas belum tersedia
              </p>
              <p className="mt-1 text-[11px] text-[#7B8190]">
                Grafik akan muncul setelah data nilai tugas tersedia.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-auto px-5 pb-5 sm:px-6">
        <button type="button" className={primaryButtonClass} onClick={onOpen}>
          <Check size={15} />
          Lihat leger nilai
        </button>
      </div>
    </article>
  );
}

function MiniStat({
  value,
  label,
}: {
  value: string | number;
  label: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-[#E3DACB] bg-[#FBF9F3] px-2.5 py-3 sm:px-3">
      <div className="font-['Fraunces',serif] text-lg font-semibold leading-none text-[#141C30]">
        {value}
      </div>
      <div className="mt-1.5 text-[10px] leading-snug text-[#6B7080] sm:text-[11px]">
        {label}
      </div>
    </div>
  );
}
