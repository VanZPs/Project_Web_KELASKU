import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Info,
  TrendingUp,
} from 'lucide-react';
import api from '../../api/axios';
import { DashboardLayout } from '../../layouts/Siswa/DashboardLayout';

interface DashboardData {
  siswa: { nama: string; kelas: string };
  statistik: {
    mata_pelajaran_hari_ini: number;
    rata_rata_nilai: number | null;
    tugas_belum_dikumpulkan: number;
    kehadiran: number | null;
  };
  jadwal_hari_ini: Array<{
    id: number;
    jam_ke: number | null;
    waktu: string;
    mata_pelajaran: string;
    topik?: string | null;
    guru?: string | null;
    status: 'selesai' | 'berlangsung' | 'belum';
  }>;
  tugas_belum_dikumpulkan: Array<{
    id: number;
    judul: string;
    mata_pelajaran: string;
    tipe: string;
    tenggat: string | null;
  }>;
  pengumuman: Array<{
    id: number;
    judul: string;
    mata_pelajaran?: string;
    guru?: string;
    tanggal?: string;
    baru: boolean;
  }>;
  aktivitas_terbaru: Array<{
    id: number;
    tanggal: string;
    mata_pelajaran: string;
    deskripsi: string;
    meta?: string;
    status?: string;
  }>;
  nilai_terbaru: Array<{
    id: number;
    judul: string;
    mata_pelajaran: string;
    tipe: string;
    nilai: number;
  }>;
  nilai_per_mapel: Array<{ mata_pelajaran: string; rata_rata: number }>;
}

const cardClass = 'overflow-hidden rounded-[14px] border border-[#E3DACB] bg-[#FFFDF8] shadow-[0_1px_2px_rgba(30,25,15,0.04),0_8px_24px_-12px_rgba(30,25,15,0.10)]';
const panelTitle = "font-['Fraunces',serif] text-[16px] font-semibold text-[#141C30]";

const formatDate = (value?: string | null) => {
  if (!value) return 'Belum ditentukan';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatValue = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : Number.isInteger(value) ? String(value) : value.toFixed(1);

function EmptyState({ children }: { children: string }) {
  return <div className="p-5 text-center text-[12.5px] italic text-[#6B7080]">{children}</div>;
}

function PanelHeader({ title, to }: { title: string; to?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#E3DACB] p-[18px_20px_14px]">
      <h3 className={panelTitle}>{title}</h3>
      {to && <Link to={to} className="shrink-0 text-[12px] font-semibold text-[#1E2A47] hover:text-[#B98A3E]">Lihat semua <ArrowUpRight className="ml-0.5 inline h-3.5 w-3.5" /></Link>}
    </div>
  );
}

export function DashboardSiswa() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const storedUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}') as {
        name?: string;
        nama?: string;
        classrooms?: Array<{ name?: string }>;
      };
    } catch {
      return {};
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadDashboard = async () => {
      try {
        const response = await api.get('/siswa/dashboard');
        if (!mounted) return;
        if (response.data?.success && response.data?.data) {
          setData(response.data.data as DashboardData);
          setError('');
        } else {
          setError(response.data?.message || 'Data dashboard siswa belum tersedia.');
        }
      } catch (requestError) {
        if (!mounted) return;
        console.error('Gagal memuat dashboard siswa:', requestError);
        setError('Dashboard belum dapat mengambil data dari server. Periksa koneksi backend dan endpoint siswa.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void loadDashboard();
    return () => { mounted = false; };
  }, []);

  const namaSiswa = data?.siswa?.nama || storedUser.name || storedUser.nama || 'Siswa';
  const kelasSiswa = data?.siswa?.kelas || storedUser.classrooms?.map((item) => item.name).filter(Boolean).join(', ') || '';
  const todayStr = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const stats = [
    { label: 'Mata pelajaran hari ini', value: formatValue(data?.statistik.mata_pelajaran_hari_ini), note: 'Hari ini', icon: BookOpen, tone: 'bg-[#E7ECF4] text-[#1E2A47]' },
    { label: 'Rata-rata nilai', value: formatValue(data?.statistik.rata_rata_nilai), note: 'Dari tugas yang dinilai', icon: TrendingUp, tone: 'bg-[#E7D3A8] text-[#7A5A20]' },
    { label: 'Tugas belum dikumpulkan', value: formatValue(data?.statistik.tugas_belum_dikumpulkan), note: 'Perlu dikerjakan', icon: ClipboardCheck, tone: 'bg-[#F5E6DF] text-[#AE5A3E]' },
    { label: 'Kehadiran', value: data?.statistik.kehadiran == null ? '—' : `${formatValue(data.statistik.kehadiran)}%`, note: 'Berdasarkan presensi tercatat', icon: CheckCircle2, tone: 'bg-[#E7F0EA] text-[#4C7A5E]' },
  ];

  const calendarDate = new Date();
  const firstWeekday = (new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1).getDay() + 6) % 7;
  const daysInMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0).getDate();
  const deadlineDays = new Set((data?.tugas_belum_dikumpulkan || []).flatMap((task) => {
    if (!task.tenggat) return [];
    const date = new Date(task.tenggat);
    return date.getFullYear() === calendarDate.getFullYear() && date.getMonth() === calendarDate.getMonth() ? [date.getDate()] : [];
  }));
  const calendarCells = [...Array.from({ length: firstWeekday }, () => null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)];

  return (
    <DashboardLayout namaSiswa={namaSiswa} kelasSiswa={kelasSiswa} todayStr={todayStr} loading={loading}>
      {error && <div role="alert" className="mb-4 rounded-xl border border-[#E8C9BE] bg-[#F5E6DF] px-4 py-3 text-[13px] text-[#8E452F]">{error}</div>}

      <section className={`${cardClass} mb-5 rounded-[18px] p-[22px_24px_20px]`}>
        <div className="mb-[18px] flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-['Fraunces',serif] text-[18px] font-semibold text-[#141C30]">Jadwal pelajaran hari ini</h2>
          <span className="text-[13px] text-[#6B7080]">{data?.jadwal_hari_ini.length ?? 0} mata pelajaran</span>
        </div>
        {data?.jadwal_hari_ini.length ? (
          <div className="flex gap-0 overflow-x-auto pb-1">
            {data.jadwal_hari_ini.map((item) => (
              <div key={item.id} className="relative min-w-[190px] flex-1 basis-[190px] pr-[18px]">
                <div className={`mb-2.5 flex h-[30px] w-[30px] items-center justify-center rounded-[9px] font-['Fraunces',serif] text-[13px] font-semibold ${item.status === 'selesai' ? 'border border-[#4C7A5E] bg-[#E7F0EA] text-[#4C7A5E]' : item.status === 'berlangsung' ? 'bg-[#B98A3E] text-[#141C30]' : 'bg-[#1E2A47] text-white'}`}>{item.jam_ke ?? '•'}</div>
                <div className="mb-[3px] text-[11.5px] text-[#6B7080]">{item.waktu}</div>
                <div className="text-[14px] font-bold text-[#141C30]">{item.mata_pelajaran}</div>
                {item.topik && <div className="mt-0.5 text-[12px] leading-snug text-[#6B7080]">{item.topik}</div>}
                {item.guru && <div className="mt-1 text-[11.5px] text-[#6B7080]">{item.guru}</div>}
                <span className={`mt-2 inline-block rounded-full px-[9px] py-[2px] text-[11px] font-semibold ${item.status === 'selesai' ? 'bg-[#E7F0EA] text-[#4C7A5E]' : item.status === 'berlangsung' ? 'bg-[#E7D3A8] text-[#7A5A20]' : 'bg-[#EFE9DB] text-[#6B7080]'}`}>
                  {item.status === 'selesai' ? 'Selesai' : item.status === 'berlangsung' ? 'Sedang berlangsung' : 'Belum dimulai'}
                </span>
              </div>
            ))}
          </div>
        ) : <EmptyState>Belum ada jadwal pelajaran untuk hari ini.</EmptyState>}
      </section>

      <section className="mb-5 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.map(({ label, value, note, icon: Icon, tone }) => (
          <div key={label} className={`${cardClass} p-[18px]`}>
            <div className="mb-[14px] flex items-start justify-between">
              <div className={`flex h-[34px] w-[34px] items-center justify-center rounded-[9px] ${tone}`}><Icon size={17} strokeWidth={1.9} /></div>
              <span className="text-right text-[10px] text-[#8B8B91]">{note}</span>
            </div>
            <div className="font-['Fraunces',serif] text-[30px] font-semibold leading-none text-[#141C30]">{value}</div>
            <div className="mt-1.5 text-[12px] text-[#6B7080]">{label}</div>
          </div>
        ))}
      </section>

      <section className={`${cardClass} mb-5 p-5`}>
        <div className="mb-3 flex items-center gap-2 text-[#1E2A47]"><CalendarDays size={17} /><h3 className={panelTitle}>Akses cepat</h3></div>
        <div className="grid grid-cols-2 gap-2 sm:max-w-[520px]">
          <Link to="/siswa/jadwal" className="rounded-[10px] border border-[#E3DACB] bg-[#FFFDF8] p-3 text-[12px] font-semibold text-[#1E2A47] transition-colors hover:bg-[#FAF6EC]">Jadwal pelajaran <ArrowUpRight className="ml-1 inline h-3.5 w-3.5" /></Link>
          <Link to="/siswa/tugas" className="rounded-[10px] border border-[#E3DACB] bg-[#FFFDF8] p-3 text-[12px] font-semibold text-[#1E2A47] transition-colors hover:bg-[#FAF6EC]">Daftar tugas <ArrowUpRight className="ml-1 inline h-3.5 w-3.5" /></Link>
        </div>
      </section>

      <section className="grid grid-cols-1 items-stretch gap-[18px] lg:grid-cols-2">
        <div className={`${cardClass} flex h-full flex-col`}>
          <PanelHeader title="Tugas yang perlu dikerjakan" to="/siswa/tugas" />
          <div className="flex-1 p-[6px_8px_10px]">
            {data?.tugas_belum_dikumpulkan.length ? data.tugas_belum_dikumpulkan.map((item) => (
              <div key={item.id} className="flex items-center gap-3.5 rounded-[10px] p-[14px_12px] transition-colors hover:bg-[#FAF6EC]">
                <div className="flex h-[46px] w-[46px] shrink-0 flex-col items-center justify-center rounded-[9px] bg-[#F0EBDB] text-[#AE5A3E]"><FileText size={17} /><span className="mt-0.5 text-[9px] font-semibold">TUGAS</span></div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold text-[#141C30]">{item.judul}</div>
                  <div className="mt-0.5 text-[12px] text-[#6B7080]">{item.mata_pelajaran}{item.tipe ? ` · ${item.tipe}` : ''}</div>
                  <div className="mt-1.5 text-[11.5px] text-[#6B7080]">Tenggat: <span className="font-semibold text-[#AE5A3E]">{formatDate(item.tenggat)}</span></div>
                </div>
                <Link to="/siswa/tugas" className="shrink-0 rounded-[9px] border border-[#E3DACB] px-3 py-2 text-[11px] font-bold text-[#1E2A47] hover:bg-[#1E2A47] hover:text-white">Kerjakan</Link>
              </div>
            )) : <EmptyState>Tidak ada tugas yang perlu dikumpulkan saat ini.</EmptyState>}
          </div>
        </div>

        <div className={`${cardClass} flex h-full flex-col`}>
          <PanelHeader title="Nilai terbaru" to="/siswa/nilai" />
          <div className="flex-1 p-[6px_8px_10px]">
            {data?.nilai_terbaru.length ? data.nilai_terbaru.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-[10px] p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-[#E7F0EA] text-[#4C7A5E]"><TrendingUp size={17} /></div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-bold text-[#141C30]">{item.judul}</div>
                  <div className="mt-0.5 text-[11.5px] text-[#6B7080]">{item.mata_pelajaran}{item.tipe ? ` · ${item.tipe}` : ''}</div>
                </div>
                <div className="font-['Fraunces',serif] text-[19px] font-semibold text-[#4C7A5E]">{formatValue(item.nilai)}</div>
              </div>
            )) : <EmptyState>Belum ada nilai yang dipublikasikan.</EmptyState>}
          </div>
        </div>

        <div className={`${cardClass} flex h-full flex-col`}>
          <PanelHeader title="Pengumuman" />
          <div className="flex-1 p-[6px_8px_10px]">
            {data?.pengumuman.length ? data.pengumuman.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-[10px] p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-[#EFE2EC] text-[#7A4C6E]"><Info size={17} /></div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold text-[#141C30]">{item.judul}</div>
                  <div className="mt-0.5 text-[11.5px] text-[#6B7080]">{[item.mata_pelajaran, item.guru, formatDate(item.tanggal)].filter(Boolean).join(' · ')}</div>
                </div>
                {item.baru && <span className="rounded-full bg-[#E7D3A8] px-2.5 py-1 text-[10px] font-semibold text-[#7A5A20]">Baru</span>}
              </div>
            )) : <EmptyState>Belum ada pengumuman.</EmptyState>}
          </div>
        </div>

        <div className={`${cardClass} flex h-full flex-col`}>
          <PanelHeader title={calendarDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })} />
          <div className="flex-1 p-4">
            <div className="grid grid-cols-7 gap-1 text-center">
              {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((day) => (
                <div key={day} className="pb-2 text-[10px] font-semibold text-[#8A8790]">{day}</div>
              ))}
              {calendarCells.map((day, index) => (
                <div key={day ?? `blank-${index}`} className={`relative flex aspect-square items-center justify-center rounded-[8px] text-[11px] ${day === calendarDate.getDate() ? 'bg-[#1E2A47] font-bold text-white' : 'text-[#23283A]'}`}>
                  {day}
                  {day && deadlineDays.has(day) && <span className={`absolute bottom-1 h-[3px] w-[12px] rounded-full ${day === calendarDate.getDate() ? 'bg-[#E7D3A8]' : 'bg-[#B98A3E]'}`} />}
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 text-[10.5px] text-[#6B7080]"><span className="h-[3px] w-[14px] rounded-full bg-[#B98A3E]" /> Tenggat pengumpulan tugas</div>
          </div>
        </div>

        <div className={`${cardClass} flex h-full flex-col`}>
          <PanelHeader title="Aktivitas pembelajaran terbaru" to="/siswa/kehadiran" />
          <div className="flex-1 p-[6px_8px_10px]">
            {data?.aktivitas_terbaru.length ? data.aktivitas_terbaru.map((item) => (
              <div key={item.id} className="flex gap-3.5 rounded-[10px] p-[14px_12px]">
                <div className="flex w-[54px] shrink-0 items-center justify-center rounded-[9px] bg-[#F0EBDB] px-1 py-2 text-center text-[10px] text-[#6B7080]">{formatDate(item.tanggal)}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold text-[#141C30]">{item.mata_pelajaran}</div>
                  <div className="mt-0.5 text-[12.5px] leading-relaxed text-[#23283A]">{item.deskripsi}</div>
                  {item.meta && <div className="mt-1.5 text-[11.5px] text-[#6B7080]">{item.meta}</div>}
                </div>
                {item.status && <span className="self-center rounded-full bg-[#E7F0EA] px-2.5 py-1 text-[10px] font-semibold text-[#4C7A5E]">{item.status}</span>}
              </div>
            )) : <EmptyState>Belum ada aktivitas pembelajaran terbaru.</EmptyState>}
          </div>
        </div>

        <div className={`${cardClass} flex h-full flex-col`}>
          <PanelHeader title="Nilai per mata pelajaran" to="/siswa/nilai" />
          <div className="flex-1 py-2">
            {data?.nilai_per_mapel.length ? data.nilai_per_mapel.map((item) => (
              <div key={item.mata_pelajaran} className="flex items-center gap-3 px-5 py-[11px]">
                <div className="w-[86px] shrink-0 truncate text-[12px] font-semibold text-[#23283A]">{item.mata_pelajaran}</div>
                <div className="h-[7px] flex-1 overflow-hidden rounded-full bg-[#EFE9DB]"><div className="h-full rounded-full bg-gradient-to-r from-[#1E2A47] to-[#2C3B5E]" style={{ width: `${Math.max(0, Math.min(100, item.rata_rata))}%` }} /></div>
                <div className="w-8 text-right text-[12px] text-[#6B7080]">{formatValue(item.rata_rata)}</div>
              </div>
            )) : <EmptyState>Rata-rata nilai per mata pelajaran belum tersedia.</EmptyState>}
          </div>
        </div>

      </section>
    </DashboardLayout>
  );
}
