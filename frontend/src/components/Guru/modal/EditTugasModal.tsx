import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Calendar, CheckCircle2, ChevronDown, FileText, GraduationCap, X } from 'lucide-react';
import api from '../../../api/axios';

type SubmissionMode = 'once' | 'multiple';
type AssignmentType = 'short' | 'paragraph' | 'multiple' | 'checkbox' | 'upload' | 'info';

interface Classroom { id: number; name: string; students_count?: number; }
interface Subject { id: number; name: string; }
interface Schedule { id: number; classroom_id?: number; subject_id?: number; classroom?: Classroom; subject?: Subject; }
interface Question { id?: number; type: AssignmentType; question?: string; }
interface Assignment {
  id: number; title: string; description?: string | null; start_date?: string | null; due_date?: string | null;
  submission_mode?: SubmissionMode; is_published?: boolean; questions?: Question[]; schedules?: Schedule[]; schedule?: Schedule;
}
interface EditTugasModalProps {
  open: boolean;
  assignment: Assignment;
  onClose: () => void;
  onSaved: (assignment: Assignment) => void;
}

const colors = {
  paper: '#FFFDF8', navy: '#1E2A47', navyDeep: '#141C30', ink: '#23283A', muted: '#6B7080',
  line: '#E3DACB', gold: '#B98A3E', goldSoft: '#E7D3A8', green: '#4C7A5E', greenBg: '#E7F0EA',
};

function getErrorMessage(error: any) {
  const validation = error?.response?.data?.errors;
  if (validation && typeof validation === 'object') {
    const first = Object.values(validation).flat()[0];
    if (typeof first === 'string') return first;
  }
  return error?.response?.data?.message || error?.response?.data?.error || 'Terjadi kesalahan. Silakan coba lagi.';
}

function toLocalDateTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const pad = (number: number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function EditTugasModal({ open, assignment, onClose, onSaved }: EditTugasModalProps) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [selectedClassroomIds, setSelectedClassroomIds] = useState<number[]>([]);
  const [title, setTitle] = useState(assignment.title || '');
  const [description, setDescription] = useState(assignment.description || '');
  const [submissionMode, setSubmissionMode] = useState<SubmissionMode>(assignment.submission_mode || 'once');
  const [isPublished, setIsPublished] = useState<boolean>(assignment.is_published ?? true);
  const [startDate, setStartDate] = useState(toLocalDateTime(assignment.start_date));
  const [dueDate, setDueDate] = useState(toLocalDateTime(assignment.due_date));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const assignmentSchedules = assignment.schedules ?? (assignment.schedule ? [assignment.schedule] : []);
  const subjectIds = useMemo(() => new Set(
    assignmentSchedules.map(item => Number(item.subject_id ?? item.subject?.id)).filter(Number.isFinite),
  ), [assignmentSchedules]);
  const assignmentType = assignment.questions?.[0]?.type ?? 'short';
  const typeLabels: Record<AssignmentType, string> = {
    short: 'Jawaban singkat', paragraph: 'Paragraf', multiple: 'Pilihan ganda', checkbox: 'Kotak centang', upload: 'Upload file', info: 'Catatan informasi',
  };

  useEffect(() => {
    if (!open) return;
    setTitle(assignment.title || '');
    setDescription(assignment.description || '');
    setSubmissionMode(assignment.submission_mode || 'once');
    setIsPublished(assignment.is_published ?? true);
    setStartDate(toLocalDateTime(assignment.start_date));
    setDueDate(toLocalDateTime(assignment.due_date));
    setSelectedClassroomIds([...new Set(assignmentSchedules.map(item => Number(item.classroom_id ?? item.classroom?.id)).filter(id => Number.isFinite(id) && id > 0))]);
    setError('');

    let cancelled = false;
    async function loadSchedules() {
      setLoadingSchedules(true);
      try {
        const response = await api.get('/schedules');
        const payload = response.data;
        const list: Schedule[] = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.schedules) ? payload.schedules : [];
        if (!cancelled) setSchedules(list);
      } catch (loadError) {
        if (!cancelled) setError(getErrorMessage(loadError));
      } finally {
        if (!cancelled) setLoadingSchedules(false);
      }
    }
    void loadSchedules();
    return () => { cancelled = true; };
  // Assignment is intentionally refreshed whenever the modal opens or the assignment changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, assignment.id]);

  const eligibleSchedules = useMemo(() => {
    if (!subjectIds.size) return schedules;
    return schedules.filter(item => subjectIds.has(Number(item.subject_id ?? item.subject?.id)));
  }, [schedules, subjectIds]);

  const classroomOptions = useMemo(() => {
    const map = new Map<number, Classroom>();
    eligibleSchedules.forEach(item => {
      const classroom = item.classroom;
      const id = Number(item.classroom_id ?? classroom?.id);
      if (classroom && Number.isFinite(id)) map.set(id, { ...classroom, id });
    });
    assignmentSchedules.forEach(item => {
      const classroom = item.classroom;
      const id = Number(item.classroom_id ?? classroom?.id);
      if (classroom && Number.isFinite(id) && !map.has(id)) map.set(id, { ...classroom, id });
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'id', { numeric: true }));
  }, [eligibleSchedules, assignmentSchedules]);

  const selectedScheduleIds = useMemo(() => eligibleSchedules
    .filter(item => selectedClassroomIds.includes(Number(item.classroom_id ?? item.classroom?.id)))
    .map(item => Number(item.id))
    .filter(id => Number.isFinite(id) && id > 0), [eligibleSchedules, selectedClassroomIds]);

  function toggleClassroom(id: number) {
    setSelectedClassroomIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  }

  async function saveChanges() {
    setError('');
    if (!title.trim()) { setError('Judul tugas wajib diisi.'); return; }
    if (!selectedClassroomIds.length || !selectedScheduleIds.length) { setError('Pilih minimal satu kelas.'); return; }
    if (startDate && dueDate && new Date(startDate).getTime() > new Date(dueDate).getTime()) {
      setError('Tanggal mulai tidak boleh setelah tenggat pengumpulan.'); return;
    }

    try {
      setSaving(true);
      const response = await api.put(`/guru/tugas/${assignment.id}`, {
        title: title.trim(),
        description: description.trim() || null,
        submission_mode: submissionMode,
        is_published: isPublished,
        start_date: startDate || null,
        due_date: dueDate || null,
        schedule_ids: selectedScheduleIds,
      });
      const updated = (response.data?.data ?? response.data) as Assignment;
      onSaved(updated);
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(20,17,10,0.55)' }} onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="edit-task-title" className="flex w-full max-w-[720px] flex-col overflow-hidden rounded-[18px] border" style={{ maxHeight: 'calc(100vh - 32px)', backgroundColor: colors.paper, borderColor: colors.line, boxShadow: '0 28px 80px -24px rgba(20,17,10,0.5)' }}>
        <div className="flex shrink-0 items-start justify-between gap-4 border-b px-6 py-5" style={{ borderColor: colors.line }}>
          <div>
            <div className="mb-2 inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide" style={{ backgroundColor: '#F4E4C8', color: '#94651F' }}>Edit tugas</div>
            <h2 id="edit-task-title" className="text-[21px] font-semibold" style={{ color: colors.navyDeep, fontFamily: '"Fraunces", serif' }}>Edit Tugas</h2>
            <p className="mt-1 text-[12.5px]" style={{ color: colors.muted }}>Perbarui detail tugas tanpa mengubah soal yang sudah dibuat.</p>
          </div>
          <button type="button" aria-label="Tutup modal edit tugas" onClick={onClose} disabled={saving} className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[10px] border disabled:opacity-50" style={{ borderColor: colors.line, color: colors.muted }}><X size={17} /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {error && <div className="flex items-start gap-2 rounded-[10px] border px-3.5 py-3 text-[12px]" style={{ backgroundColor: '#F6E1D9', borderColor: '#E4BCA9', color: '#A8503B' }}><AlertCircle size={16} className="mt-0.5 shrink-0" /><span>{error}</span></div>}

          <div>
            <label className="mb-2 block text-[12.5px] font-bold" style={{ color: colors.ink }}>Kelas <span style={{ color: '#A8503B' }}>*</span></label>
            <div className="space-y-2 rounded-[11px] border p-3" style={{ borderColor: colors.line, backgroundColor: '#FBF8EF' }}>
              {loadingSchedules ? <div className="py-2 text-[12px]" style={{ color: colors.muted }}>Memuat daftar kelas...</div> : classroomOptions.length ? classroomOptions.map(classroom => {
                const checked = selectedClassroomIds.includes(classroom.id);
                const classSchedule = eligibleSchedules.find(item => Number(item.classroom_id ?? item.classroom?.id) === classroom.id);
                return <label key={classroom.id} className="flex cursor-pointer items-center gap-3 rounded-[9px] border px-3 py-2.5" style={{ borderColor: checked ? colors.gold : colors.line, backgroundColor: checked ? '#FBF4DF' : colors.paper }}>
                  <input type="checkbox" checked={checked} onChange={() => toggleClassroom(classroom.id)} disabled={saving} className="h-4 w-4 accent-[#1E2A47]" />
                  <GraduationCap size={17} style={{ color: colors.navy }} />
                  <span className="min-w-0 flex-1 text-[13px] font-semibold" style={{ color: colors.ink }}>{classroom.name}</span>
                  <span className="text-[10.5px]" style={{ color: colors.muted }}>{classSchedule?.subject?.name ?? ''}</span>
                </label>;
              }) : <div className="text-[12px]" style={{ color: colors.muted }}>Daftar kelas tidak tersedia.</div>}
              <p className="text-[10.5px] leading-relaxed" style={{ color: colors.muted }}>Pilih kelas yang menerima tugas ini. Pilihan dibatasi pada jadwal mata pelajaran terkait.</p>
            </div>
          </div>

          <div>
            <label htmlFor="edit-task-title-input" className="mb-2 block text-[12.5px] font-bold" style={{ color: colors.ink }}>Judul Tugas <span style={{ color: '#A8503B' }}>*</span></label>
            <div className="flex items-center gap-2.5 rounded-[10px] border px-3.5" style={{ borderColor: colors.line, backgroundColor: colors.paper }}><FileText size={16} style={{ color: colors.muted }} /><input id="edit-task-title-input" value={title} onChange={event => setTitle(event.target.value)} maxLength={255} disabled={saving} className="w-full bg-transparent py-3 text-[13px] outline-none" style={{ color: colors.ink }} placeholder="Masukkan judul tugas" /></div>
          </div>

          <div>
            <label htmlFor="edit-task-description" className="mb-2 block text-[12.5px] font-bold" style={{ color: colors.ink }}>Deskripsi <span className="font-normal" style={{ color: colors.muted }}>(opsional)</span></label>
            <textarea id="edit-task-description" value={description} onChange={event => setDescription(event.target.value)} rows={3} disabled={saving} className="w-full resize-y rounded-[10px] border px-3.5 py-3 text-[13px] outline-none focus:ring-2 focus:ring-amber-200" style={{ borderColor: colors.line, backgroundColor: colors.paper, color: colors.ink }} placeholder="Jelaskan instruksi pengerjaan tugas ini..." />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-[12.5px] font-bold" style={{ color: colors.ink }}>Jenis Tugas</label>
              <div className="flex min-h-[46px] items-center justify-between rounded-[10px] border px-3.5" style={{ borderColor: colors.line, backgroundColor: '#F1EEE6', color: colors.muted }}><span className="text-[12.5px]">{typeLabels[assignmentType]}</span><span className="text-[10px] font-semibold">Tidak dapat diubah</span></div>
            </div>
            <div>
              <label className="mb-2 block text-[12.5px] font-bold" style={{ color: colors.ink }}>Jumlah Soal</label>
              <div className="flex min-h-[46px] items-center justify-between rounded-[10px] border px-3.5" style={{ borderColor: colors.line, backgroundColor: '#F1EEE6', color: colors.muted }}><span className="text-[12.5px]">{assignment.questions?.length ?? 0} soal</span><span className="text-[10px] font-semibold">Tidak dapat diubah</span></div>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-[12.5px] font-bold" style={{ color: colors.ink }}>Mode Pengerjaan <span style={{ color: '#A8503B' }}>*</span></label>
            <div className="relative"><select value={submissionMode} onChange={event => setSubmissionMode(event.target.value as SubmissionMode)} disabled={saving} className="w-full appearance-none rounded-[10px] border px-3.5 py-3 pr-10 text-[13px] outline-none focus:ring-2 focus:ring-amber-200" style={{ borderColor: colors.line, backgroundColor: colors.paper, color: colors.ink }}><option value="once">Sekali (Once) — siswa hanya dapat mengirim satu kali</option><option value="multiple">Berkali-kali (Multiple) — siswa dapat memperbarui pengumpulan</option></select><ChevronDown size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" style={{ color: colors.muted }} /></div>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-[12px] border px-4 py-3.5" style={{ borderColor: isPublished ? '#C9DCCF' : colors.line, backgroundColor: isPublished ? '#F0F7F1' : '#FBF9F3' }}>
            <div className="min-w-0">
              <div className="text-[13px] font-bold" style={{ color: colors.navyDeep }}>Tampilkan kepada siswa</div>
              <p className="mt-1 text-[11.5px] leading-[1.5]" style={{ color: colors.muted }}>
                {isPublished ? 'Tugas terlihat di halaman siswa.' : 'Tugas disembunyikan dari halaman siswa.'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isPublished}
              aria-label="Tampilkan tugas kepada siswa"
              onClick={() => setIsPublished(value => !value)}
              disabled={saving}
              className="relative h-[26px] w-[46px] shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              style={{ backgroundColor: isPublished ? colors.green : '#B8B4AA' }}
            >
              <span className="absolute top-[3px] h-5 w-5 rounded-full bg-white shadow-sm transition-transform" style={{ left: isPublished ? '23px' : '3px' }} />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="edit-task-start" className="mb-2 block text-[12.5px] font-bold" style={{ color: colors.ink }}>Tanggal Mulai Dikerjakan <span className="font-normal" style={{ color: colors.muted }}>(opsional)</span></label>
              <div className="flex items-center gap-2 rounded-[10px] border px-3" style={{ borderColor: colors.line, backgroundColor: colors.paper }}><Calendar size={15} style={{ color: colors.muted }} /><input id="edit-task-start" type="datetime-local" value={startDate} onChange={event => setStartDate(event.target.value)} disabled={saving} className="min-w-0 w-full bg-transparent py-3 text-[11.5px] outline-none" style={{ color: colors.ink }} /></div>
            </div>
            <div>
              <label htmlFor="edit-task-due" className="mb-2 block text-[12.5px] font-bold" style={{ color: colors.ink }}>Tenggat Pengumpulan <span className="font-normal" style={{ color: colors.muted }}>(opsional)</span></label>
              <div className="flex items-center gap-2 rounded-[10px] border px-3" style={{ borderColor: colors.line, backgroundColor: colors.paper }}><Calendar size={15} style={{ color: colors.muted }} /><input id="edit-task-due" type="datetime-local" value={dueDate} onChange={event => setDueDate(event.target.value)} disabled={saving} className="min-w-0 w-full bg-transparent py-3 text-[11.5px] outline-none" style={{ color: colors.ink }} /></div>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2.5 border-t px-6 py-4" style={{ borderColor: colors.line }}>
          <button type="button" onClick={onClose} disabled={saving} className="rounded-[10px] border px-5 py-2.5 text-[12.5px] font-bold disabled:opacity-50" style={{ borderColor: colors.line, backgroundColor: colors.paper, color: colors.ink }}>Batal</button>
          <button type="button" onClick={() => void saveChanges()} disabled={saving || loadingSchedules} className="flex items-center gap-2 rounded-[10px] px-5 py-2.5 text-[12.5px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-60" style={{ backgroundColor: colors.navy }}>
            {saving ? <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" /> Menyimpan...</> : <><CheckCircle2 size={15} /> Simpan Perubahan</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EditTugasModal;
