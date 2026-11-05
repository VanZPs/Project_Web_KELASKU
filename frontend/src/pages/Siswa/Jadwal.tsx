import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays, ChevronLeft, ChevronRight,
} from 'lucide-react';
import api from '../../api/axios';
import { JadwalLayout } from '../../layouts/Siswa/JadwalLayout';

type Schedule = {
  id: number;
  day: string;
  start_time: string;
  end_time: string;
  classroom?: { id: number; name: string };
  subject?: { id: number; name: string };
  teacher?: { id: number; name: string };
};
type AssignmentEvent = {
  id: number;
  title: string;
  due_date: string | null;
  subject: string | null;
};
type JadwalResponse = {
  student: { name: string; classroom: string };
  schedules: Schedule[];
  assignments: AssignmentEvent[];
};
type CalendarEvent = {
  id: string;
  date: Date;
  start: string;
  end: string;
  title: string;
  subtitle: string;
  type: 'lesson' | 'task';
};

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const DAY_INDEX: Record<string, number> = Object.fromEntries(DAYS.map((day, index) => [day, index]));
const PERIODS = [
  ['07:00', '07:45'], ['07:45', '08:30'], ['08:30', '09:15'],
  ['09:30', '10:15'], ['10:15', '11:00'], ['11:00', '11:45'],
  ['12:30', '13:10'], ['13:10', '13:50'], ['13:50', '14:30'], ['14:30', '15:15'],
];
const CARD = 'rounded-2xl border border-[#E3DACB] bg-[#FFFDF8] shadow-[0_1px_2px_rgba(30,25,15,0.04),0_8px_24px_-12px_rgba(30,25,15,0.10)]';
const clock = (value?: string | null) => value ? value.slice(0, 5) : '';
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const sameDay = (a: Date, b: Date) => dateKey(a) === dateKey(b);
const parseDate = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
};
const initialsName = (name?: string) => name?.trim().split(/\s+/).slice(0, 2).join(' ') || 'Guru';

export default function JadwalSiswa() {
  const [data, setData] = useState<JadwalResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<'weekly' | 'calendar'>('weekly');
  const [calendarMode, setCalendarMode] = useState<'month' | 'week'>('month');
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  useEffect(() => {
    let active = true;
    api.get('/siswa/jadwal')
      .then((response) => {
        if (!active) return;
        if (response.data?.success && response.data?.data) {
          setData(response.data.data as JadwalResponse);
          setError('');
        } else {
          setError(response.data?.message || 'Data jadwal belum tersedia.');
        }
      })
      .catch((requestError) => {
        console.error('Gagal memuat jadwal siswa:', requestError);
        if (active) setError('Jadwal belum dapat dimuat. Periksa koneksi backend.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const today = new Date();
  const studentName = data?.student?.name || (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}').name || 'Siswa'; }
    catch { return 'Siswa'; }
  })();
  const className = data?.student?.classroom || '';

  const events = useMemo<CalendarEvent[]>(() => {
    if (!data) return [];
    const result: CalendarEvent[] = [];
    const rangeStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    rangeStart.setDate(rangeStart.getDate() - 45);
    const rangeEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    rangeEnd.setDate(rangeEnd.getDate() + 45);
    data.schedules.forEach((schedule) => {
      const targetDay = DAY_INDEX[schedule.day];
      if (targetDay === undefined) return;
      for (const date = new Date(rangeStart); date <= rangeEnd; date.setDate(date.getDate() + 1)) {
        if ((date.getDay() + 6) % 7 !== targetDay) continue;
        result.push({
          id: `lesson-${schedule.id}-${dateKey(date)}`,
          date: new Date(date),
          start: clock(schedule.start_time),
          end: clock(schedule.end_time),
          title: schedule.subject?.name || 'Mata pelajaran',
          subtitle: initialsName(schedule.teacher?.name),
          type: 'lesson',
        });
      }
    });
    data.assignments.forEach((assignment) => {
      if (!assignment.due_date) return;
      const date = parseDate(assignment.due_date);
      result.push({
        id: `task-${assignment.id}`,
        date,
        start: clock(assignment.due_date.slice(11, 16)) || '23:59',
        end: clock(assignment.due_date.slice(11, 16)) || '23:59',
        title: assignment.title,
        subtitle: assignment.subject || 'Tenggat pengumpulan',
        type: 'task',
      });
    });
    return result;
  }, [data, cursor]);

  const selectedEvents = events
    .filter((event) => sameDay(event.date, selectedDate))
    .sort((a, b) => a.start.localeCompare(b.start));

  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(1 - ((monthStart.getDay() + 6) % 7));
  const monthCellCount = Math.ceil((((monthStart.getDay() + 6) % 7) + new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()) / 7) * 7;
  const monthCells = Array.from({ length: monthCellCount }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
  const weekStart = new Date(cursor);
  weekStart.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));
  const weekCells = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    return date;
  });

  const changeMonth = (amount: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + amount, 1));
  const goToday = () => { setCursor(new Date()); setSelectedDate(new Date()); };

  return (
    <JadwalLayout namaSiswa={studentName} kelasSiswa={className} loading={loading}>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.12em] text-[#6B7080]">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#C69A4B]" />
            <span>Semester ganjil 2026/2027</span>
          </div>
          <h1 className="font-['Fraunces',serif] text-[32px] font-semibold leading-[1.1] tracking-[-0.02em] text-[#141C30] sm:text-[36px]">
            Jadwal
          </h1>
          <p className="mt-2 max-w-[680px] text-[13px] leading-6 text-[#777B88]">
            Lihat jadwal pelajaran mingguan kelasmu beserta kalender tenggat tugas.
          </p>
        </div>
        <div className="flex shrink-0 rounded-xl border border-[#E3DACB] bg-[#FFFDF8] p-1 self-start sm:self-auto">
          <button type="button" onClick={() => setView('weekly')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${view === 'weekly' ? 'bg-[#1E2A47] text-white' : 'text-[#6B7080]'}`}>Jadwal mingguan</button>
          <button type="button" onClick={() => setView('calendar')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${view === 'calendar' ? 'bg-[#1E2A47] text-white' : 'text-[#6B7080]'}`}>Kalender</button>
        </div>
      </div>

      {error && <div role="alert" className="mb-4 rounded-xl border border-[#E8C9BE] bg-[#F5E6DF] px-4 py-3 text-sm text-[#8E452F]">{error}</div>}

      {view === 'weekly' ? (
        <section className={`${CARD} overflow-hidden`}>
          <div className="flex flex-col gap-4 border-b border-[#EDE5D9] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-[#E7D3A8] text-[#7A5A20]">
                <CalendarDays size={17} strokeWidth={1.8} />
              </div>
              <div>
                <h3 className="font-['Fraunces',serif] text-[18px] font-semibold text-[#141C30]">
                  Jadwal pelajaran mingguan
                </h3>
                <p className="mt-0.5 text-[11.5px] leading-5 text-[#8A8F9D]">
                  Lihat jadwal pelajaran dan jam belajar kelasmu setiap minggu.
                </p>
              </div>
            </div>
            <span className="self-start rounded-full bg-[#E7ECF4] px-3 py-1 text-[11px] font-bold text-[#1E2A47] sm:self-center">
              {className || 'Kelas siswa'}
            </span>
          </div>
          <div className="mx-4 my-3 flex items-start gap-3 rounded-xl border border-[#E3DACB] bg-[#FBF8EF] px-3 py-2.5 text-[11px] leading-relaxed text-[#6B7080] sm:mx-[18px] sm:my-4 sm:px-3.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#E7D3A8] font-['Fraunces',serif] text-[13px] font-bold text-[#7A5A20]">i</span>
            <span><b className="text-[#141C30]">Jadwal sekolah:</b> JP 1–6 masing-masing 45 menit, JP 7–9 masing-masing 40 menit, dan JP 10 selama 45 menit.</span>
          </div>
          {data?.schedules.length ? (() => {
            const palette = [
              ['#E5ECF5', '#3E6BAE', '#2F548C'], ['#EFE2EC', '#7A4C6E', '#6A3F5E'],
              ['#DFEFEC', '#2F8078', '#256861'], ['#E7F0EA', '#4C7A5E', '#3C6249'],
              ['#F4E4C8', '#B9791F', '#8A5A12'], ['#F6E1D9', '#A8503B', '#8C3F2C'],
              ['#EFE9DB', '#8A7A45', '#6B5D31'], ['#E7ECF4', '#1E2A47', '#1E2A47'],
              ['#EAEFDD', '#6B7B2E', '#55631F'], ['#F8E6D2', '#CC7A2B', '#9A5A1A'],
              ['#F6E3EA', '#B04C70', '#8F3A58'], ['#E6E6F5', '#5555A8', '#43438C'],
            ];
            const names = Array.from(new Set(data.schedules.map((item) => item.subject?.name || 'Mata pelajaran')));
            const colors = new Map(names.map((name, index) => [name, palette[index % palette.length]]));
            const breakAfter = new Set([2, 5]);
            const dayBlocks = DAYS.map((day) => {
              const daySchedules = data.schedules.filter((item) => item.day === day);
              const blocks: Array<{ from: number; to: number; schedule: Schedule }> = [];
              PERIODS.forEach((slot, index) => {
                const current = daySchedules.find((item) => clock(item.start_time) < slot[1] && clock(item.end_time) > slot[0]);
                if (!current) return;
                const previous = blocks[blocks.length - 1];
                const same = previous && previous.schedule.subject?.name === current.subject?.name && previous.schedule.teacher?.name === current.teacher?.name;
                if (same && !breakAfter.has(previous.to) && previous.to + 1 === index) previous.to = index;
                else blocks.push({ from: index, to: index, schedule: current });
              });
              return { starts: new Map(blocks.map((block) => [block.from, block])), skipped: new Set(blocks.flatMap((block) => Array.from({ length: block.to - block.from }, (_, i) => block.from + i + 1))) };
            });
            return (
              <div className="mx-3 mb-4 overflow-hidden rounded-xl border border-[#E3DACB] sm:mx-[18px]">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] table-fixed border-collapse text-left">
                    <thead><tr className="bg-[#FBF8EF]">
                      <th className="w-[142px] border-b border-r border-[#E3DACB] px-2 py-2.5 text-center"><span className="block text-[9.5px] font-bold uppercase tracking-[.06em] text-[#8A8F9D]">Jam pelajaran</span><span className="mt-0.5 block text-[9px] font-medium text-[#A0A3AD]">10 JP</span></th>
                      {DAYS.map((day) => <th key={day} className={`border-b border-r border-[#E3DACB] px-1 py-2.5 text-center text-[11px] font-bold text-[#141C30] ${day === DAYS[(today.getDay() + 6) % 7] ? 'bg-[#FDF5E0]' : ''}`}>{day}<span className={`mx-auto mt-1 block h-0.5 w-5 rounded-full ${day === DAYS[(today.getDay() + 6) % 7] ? 'w-[30px] bg-[#B98A3E]' : 'bg-[#D9D2C0]'}`} /></th>)}
                    </tr></thead>
                    <tbody>
                      {PERIODS.map((slot, periodIndex) => (
                        <Fragment key={`period-group-${periodIndex}`}>
                          <tr>
                            <td className="h-[58px] border-b border-r border-[#E3DACB] bg-[#FBF8EF] px-2 py-1.5">
                              <div className="flex items-center gap-2">
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[#E7ECF4] text-[11px] font-bold text-[#1E2A47]">{periodIndex + 1}</span>
                                <span className="min-w-0">
                                  <b className="block whitespace-nowrap text-[10.5px] font-semibold leading-[1.35] text-[#303646] sm:text-[11px]">Jam ke-{periodIndex + 1}</b>
                                  <span className="block whitespace-nowrap text-[10px] leading-[1.35] text-[#7D8699]">{slot[0]} – {slot[1]}</span>
                                  <small className="block text-[9px] leading-[1.35] text-[#A0A3AD]">{periodIndex < 6 || periodIndex === 9 ? 45 : 40} menit</small>
                                </span>
                              </div>
                            </td>
                            {DAYS.map((day, dayIndex) => {
                              const map = dayBlocks[dayIndex];
                              if (map.skipped.has(periodIndex)) return null;
                              const block = map.starts.get(periodIndex);
                              if (!block) return <td key={day} className="h-[58px] border-b border-l border-[#F0EADA] bg-[#FFFDF8]" />;
                              const subject = block.schedule.subject?.name || 'Mata pelajaran';
                              const teacher = block.schedule.teacher?.name || 'Guru';
                              const [bg, bar, fg] = colors.get(subject) || palette[0];
                              const span = block.to - block.from + 1;
                              return <td key={day} rowSpan={span} className="border-2 border-[#FFFDF8] p-0 align-top" style={{ backgroundColor: bg, boxShadow: `inset 3px 0 0 ${bar}` }}><div title={`${subject} · ${teacher} · JP ${block.from + 1}${span > 1 ? `–${block.to + 1}` : ''} · ${clock(block.schedule.start_time)}–${clock(block.schedule.end_time)}`} className="min-h-[56px] px-2 py-2 sm:px-2.5"><b className="block text-[10.5px] font-bold leading-[1.3] sm:text-[11px]" style={{ color: fg }}>{subject}</b><span className="mt-1 block text-[9.5px] text-[#6B7080] sm:text-[10px]">{teacher}</span></div></td>;
                            })}
                          </tr>
                          {periodIndex === 2 || periodIndex === 5 ? <tr><td className="border-y border-r border-[#E3DACB] bg-[#F3EFE6] px-2 py-1.5 text-center"><b className="block text-[9px] font-semibold uppercase tracking-wide text-[#8A8F9D]">Istirahat</b><span className="block text-[9px] leading-4 text-[#A0A3AD]">{periodIndex === 2 ? '09:15 – 09:30' : '11:45 – 12:30'}</span></td><td colSpan={6} className="border-y border-[#E3DACB] bg-[#F6F2E8] text-center text-[10px] text-[#A39A88]">•&nbsp; Waktu istirahat · {periodIndex === 2 ? 15 : 45} menit &nbsp;•</td></tr> : null}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })() : <div className="p-10 text-center text-sm text-[#6B7080]">Belum ada jadwal pelajaran untuk kelasmu.</div>}
        </section>
      ) : (
        <section className={`${CARD} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-[#E3DACB] px-5 py-4">
            <h3 className="font-['Fraunces',serif] text-base font-semibold text-[#141C30]">Kalender</h3>
            <span className="text-xs text-[#6B7080]">Klik tanggal untuk melihat agenda</span>
          </div>

          <div className="flex flex-col xl:flex-row">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 px-4 pb-3 pt-4 sm:px-5">
                <div className="flex gap-1">
                  <button type="button" onClick={() => calendarMode === 'month' ? changeMonth(-1) : setCursor(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 7))} aria-label="Sebelumnya" className="flex h-[34px] w-[34px] items-center justify-center rounded-lg bg-[#1E2A47] text-white hover:bg-[#141C30]"><ChevronLeft size={15} /></button>
                  <button type="button" onClick={() => calendarMode === 'month' ? changeMonth(1) : setCursor(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 7))} aria-label="Berikutnya" className="flex h-[34px] w-[34px] items-center justify-center rounded-lg bg-[#1E2A47] text-white hover:bg-[#141C30]"><ChevronRight size={15} /></button>
                </div>
                <button type="button" onClick={goToday} className="h-[34px] rounded-lg border border-[#E3DACB] bg-[#FFFDF8] px-3 text-xs font-bold text-[#1E2A47] hover:bg-[#F0EBDB]">Hari ini</button>
                <div className="min-w-[150px] flex-1 text-center font-['Fraunces',serif] text-lg font-semibold capitalize text-[#141C30]">
                  {calendarMode === 'month'
                    ? cursor.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
                    : `${weekCells[0].getDate()} ${weekCells[0].toLocaleDateString('id-ID', { month: 'short' })} – ${weekCells[6].getDate()} ${weekCells[6].toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })}`}
                </div>
                <div className="flex rounded-[10px] bg-[#EFEADB] p-[3px]">
                  <button type="button" onClick={() => { setCalendarMode('month'); setCursor(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)); }} className={`rounded-[7px] px-3 py-1.5 text-xs font-bold ${calendarMode === 'month' ? 'bg-[#1E2A47] text-white' : 'text-[#6B7080]'}`}>Bulan</button>
                  <button type="button" onClick={() => { setCalendarMode('week'); setCursor(new Date(selectedDate)); }} className={`rounded-[7px] px-3 py-1.5 text-xs font-bold ${calendarMode === 'week' ? 'bg-[#1E2A47] text-white' : 'text-[#6B7080]'}`}>Minggu</button>
                </div>
              </div>

              {calendarMode === 'month' ? (
                <>
                  <div className="mx-4 grid grid-cols-7 sm:mx-5">
                    {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((day, index) => <div key={day} className={`border border-[#E3DACB] border-r-0 bg-[#FBF8EF] py-2 text-center text-[11px] font-bold text-[#141C30] last:border-r ${index === 6 ? 'border-r' : ''}`}>{day}</div>)}
                  </div>
                  <div className="mx-4 mb-4 grid grid-cols-7 border-l border-[#E3DACB] sm:mx-5">
                    {monthCells.map((date) => {
                      const dayEvents = events.filter((event) => sameDay(event.date, date)).sort((a, b) => a.start.localeCompare(b.start));
                      const inMonth = date.getMonth() === cursor.getMonth();
                      const todayCell = sameDay(date, today);
                      const selected = sameDay(date, selectedDate);
                      const subjectPalette = [
                        ['#E5ECF5', '#3E6BAE'], ['#EFE2EC', '#7A4C6E'], ['#DFEFEC', '#2F8078'],
                        ['#E7F0EA', '#4C7A5E'], ['#F4E4C8', '#B9791F'], ['#F6E1D9', '#A8503B'],
                        ['#EFE9DB', '#8A7A45'], ['#E7ECF4', '#1E2A47'], ['#EAEFDD', '#6B7B2E'],
                        ['#F8E6D2', '#CC7A2B'], ['#F6E3EA', '#B04C70'], ['#E6E6F5', '#5555A8'],
                      ];
                      const subjectNames = Array.from(new Set(data?.schedules.map((item) => item.subject?.name || 'Mata pelajaran') || []));
                      return (
                        <button type="button" key={dateKey(date)} onClick={() => { setSelectedDate(new Date(date)); setCursor(new Date(date)); }} className={`relative min-h-[88px] border-b border-r border-[#E3DACB] p-1.5 text-left transition-colors sm:min-h-[108px] sm:p-2 ${todayCell ? 'bg-[#F6E7B8] hover:bg-[#F6E7B8]' : !inMonth ? 'bg-[#FAF7EF]' : date.getDay() === 0 ? 'bg-[#F1F4F8]' : 'bg-[#FFFDF8] hover:bg-[#FBF8EF]'} ${selected ? 'shadow-[inset_0_0_0_2px_#1E2A47] z-[1]' : ''}`}>
                          <span className={`absolute right-3 top-3 z-[2] flex items-center justify-center text-[11px] ${!inMonth ? 'text-[#C7C0AC]' : todayCell ? 'font-extrabold text-[#141C30]' : 'text-[#6B7080]'}`}>
                            {todayCell ? <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1E2A47] text-white">{date.getDate()}</span> : date.getDate()}
                          </span>
                          <span className="mt-7 block space-y-[3px]">
                            {dayEvents.slice(0, 3).map((event) => {
                              const subjectIndex = subjectNames.indexOf(event.title);
                              const [bg, fg] = event.type === 'task' ? ['#F4E4C8', '#8A5E14'] : subjectPalette[(subjectIndex < 0 ? 0 : subjectIndex) % subjectPalette.length];
                              return <span key={event.id} className="block truncate rounded-[5px] px-1.5 py-[3px] text-left text-[9px] font-bold leading-[1.25] sm:text-[10px]" style={{ backgroundColor: bg, color: fg }}>{event.type === 'task' ? '◆ ' : '• '}{event.type === 'lesson' ? event.title : event.title}</span>;
                            })}
                            {dayEvents.length > 3 && <span className="block px-1 text-[10px] font-bold text-[#6B7080]">+{dayEvents.length - 3} lagi</span>}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="mb-3">
                  {weekCells.map((date) => {
                    const dayEvents = events.filter((event) => sameDay(event.date, date)).sort((a, b) => a.start.localeCompare(b.start));
                    return (
                      <button type="button" key={dateKey(date)} onClick={() => { setSelectedDate(new Date(date)); setCursor(new Date(date)); }} className={`flex w-full gap-3 border-t border-[#E3DACB] px-4 py-3 text-left transition-colors hover:bg-[#FBF8EF] sm:px-5 ${sameDay(date, today) ? 'bg-[#FDF5E0]' : ''} ${sameDay(date, selectedDate) ? 'shadow-[inset_3px_0_0_#1E2A47]' : ''}`}>
                        <span className="w-11 shrink-0 text-center"><span className="block text-[10px] text-[#6B7080]">{date.toLocaleDateString('id-ID', { weekday: 'short' })}</span><b className="block font-['Fraunces',serif] text-xl leading-tight text-[#141C30]">{date.getDate()}</b></span>
                        <span className="min-w-0 flex-1">
                          {dayEvents.length ? dayEvents.map((event) => <span key={event.id} className="flex items-center gap-2 py-[3px]"><i className={`h-2 w-2 shrink-0 rounded-full ${event.type === 'lesson' ? 'bg-[#3E6BAE]' : 'bg-[#D9A441]'}`} /><span className="shrink-0 text-[10px] tabular-nums text-[#6B7080]">{event.start}{event.end && event.end !== event.start ? `–${event.end}` : ''}</span><b className="truncate text-xs font-semibold text-[#141C30]">{event.title}</b></span>) : <span className="block py-1 text-xs italic text-[#B3AE9C]">Tidak ada kegiatan</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex flex-wrap gap-4 px-4 pb-4 text-[10px] text-[#6B7080] sm:px-5">
                <span className="flex items-center gap-1.5"><i className="h-[9px] w-[9px] rounded-[3px] bg-[#3E6BAE]" />Pelajaran</span>
                <span className="flex items-center gap-1.5"><i className="h-[9px] w-[9px] rounded-[3px] bg-[#D9A441]" />Tenggat tugas</span>
                <span className="flex items-center gap-1.5"><i className="h-[9px] w-[9px] rounded-[3px] bg-[#AE5A3E]" />Ujian</span>
                <span className="flex items-center gap-1.5"><i className="h-[9px] w-[9px] rounded-[3px] bg-[#4C7A5E]" />Libur</span>
              </div>
            </div>

            {calendarMode === 'month' && (
              <aside className="w-full shrink-0 border-t border-[#E3DACB] px-5 py-5 xl:w-[340px] xl:border-l xl:border-t-0">
                <div className="mb-1 text-[10px] font-bold uppercase tracking-[.14em] text-[#B98A3E]">Agenda tanggal</div>
                <div className="mb-3 flex items-baseline justify-between gap-2">
                  <h3 className="font-['Fraunces',serif] text-base font-semibold capitalize text-[#141C30]">{selectedDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
                  <span className="shrink-0 text-[11px] text-[#6B7080]">{selectedEvents.length ? `${selectedEvents.length} kegiatan` : ''}</span>
                </div>
                {selectedEvents.length ? selectedEvents.map((event) => (
                  <div key={event.id} className="flex gap-3 border-b border-[#F0EADA] py-3 last:border-b-0">
                    <div className="w-[46px] shrink-0 text-[11px] leading-[1.4] text-[#6B7080]"><b className="block font-bold text-[#141C30]">{event.start || '—'}</b>{event.end && event.end !== event.start ? event.end : ''}</div>
                    <div className={`w-[3px] shrink-0 rounded-full ${event.type === 'lesson' ? 'bg-[#3E6BAE]' : 'bg-[#D9A441]'}`} />
                    <div className="min-w-0"><b className="block text-[13px] text-[#141C30]">{event.title}</b><span className="mt-0.5 block text-[11px] text-[#6B7080]">{event.subtitle}</span></div>
                  </div>
                )) : (
                  <div className="mt-5 rounded-xl bg-[#F6F2E8] px-4 py-5 text-center text-xs text-[#6B7080]"><CalendarDays className="mx-auto mb-2 text-[#B98A3E]" size={21} />Tidak ada agenda pada tanggal ini.</div>
                )}
              </aside>
            )}
          </div>
        </section>
      )}
      <div className="mt-4 text-[11px] text-[#8B806B]">Jadwal mengikuti kelas yang terhubung dengan akun siswa. Kalender menampilkan tenggat tugas yang telah dipublikasikan.</div>
    </JadwalLayout>
  );
}
