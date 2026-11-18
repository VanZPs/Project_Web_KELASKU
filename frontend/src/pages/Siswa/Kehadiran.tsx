import { useEffect, useMemo, useRef, useState } from 'react';
import jsQR from 'jsqr';
import {
  CalendarDays, Check, CheckCircle2, ChevronDown, FilePenLine,
  HeartPulse, Info, QrCode, RefreshCw, ScanLine, ShieldCheck, X,
} from 'lucide-react';
import api from '../../api/axios';
import { JadwalLayout } from '../../layouts/Siswa/JadwalLayout';

type Status = 'hadir' | 'izin' | 'sakit' | 'dispen' | 'alpa';
type AttendanceRow = {
  id: number;
  date: string;
  status: Status;
  notes: string | null;
  method: 'qr' | 'guru' | string;
  start_time: string | null;
  end_time: string | null;
  day: string | null;
  subject: string;
  teacher: string;
  schedule_id: number;
};
type DailyRow = { id: number; date: string; status: Status; source_schedule_id: number | null };
type CurrentSession = {
  schedule_id: number;
  subject: string;
  teacher: string;
  start_time: string;
  end_time: string;
  day: string;
};
type KehadiranResponse = {
  student: { name: string; classroom: string };
  history: AttendanceRow[];
  daily_history: DailyRow[];
  current_session: CurrentSession | null;
  period: { start_date: string | null; end_date: string };
};

const STATUS: { key: Status; label: string; color: string; bg: string; dot: string }[] = [
  { key: 'hadir', label: 'Hadir', color: '#4C7A5E', bg: '#E7F0EA', dot: '#4C7A5E' },
  { key: 'izin', label: 'Izin', color: '#3E6BAE', bg: '#E5ECF5', dot: '#3E6BAE' },
  { key: 'sakit', label: 'Sakit', color: '#8A6425', bg: '#F3E8C9', dot: '#B98A3E' },
  { key: 'dispen', label: 'Dispen', color: '#7A4C6E', bg: '#EFE2EC', dot: '#7A4C6E' },
  { key: 'alpa', label: 'Alpa', color: '#AE5A3E', bg: '#F5E6DF', dot: '#AE5A3E' },
];
const CARD = 'rounded-[14px] border border-[#E3DACB] bg-[#FFFDF8] shadow-[0_1px_2px_rgba(30,25,15,0.04),0_8px_24px_-12px_rgba(30,25,15,0.10)]';
const clock = (value?: string | null) => value ? value.slice(0, 5) : '--:--';
const dateKey = (value: string) => value.slice(0, 10);
const dateLabel = (value: string) => new Date(`${dateKey(value)}T00:00:00`).toLocaleDateString('id-ID', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});
const statusInfo = (key: Status) => STATUS.find((item) => item.key === key) || STATUS[0];

export default function KehadiranSiswa() {
  const [data, setData] = useState<KehadiranResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'mapel' | 'harian'>('mapel');
  const [statusFilter, setStatusFilter] = useState<'all' | Status>('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [limit, setLimit] = useState(30);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanState, setScanState] = useState<'scanning' | 'success' | 'error'>('scanning');
  const [scanMessage, setScanMessage] = useState('');
  const [scanDetails, setScanDetails] = useState<{ subject?: string; time?: string } | null>(null);
  const [manualToken, setManualToken] = useState('');
  const [scanBusy, setScanBusy] = useState(false);
  const [scannerHint, setScannerHint] = useState('Arahkan kamera ke QR Code presensi yang ditampilkan guru.');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const scannedRef = useRef(false);

  const loadData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const response = await api.get('/siswa/kehadiran');
      if (response.data?.success && response.data?.data) {
        setData(response.data.data as KehadiranResponse);
        setError('');
      } else {
        setError(response.data?.message || 'Data kehadiran belum tersedia.');
      }
    } catch (requestError) {
      console.error('Gagal memuat kehadiran siswa:', requestError);
      setError('Data kehadiran belum dapat dimuat. Periksa koneksi backend.');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => { void loadData(); }, []);

  const studentName = data?.student?.name || (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}').name || 'Siswa'; }
    catch { return 'Siswa'; }
  })();
  const className = data?.student?.classroom || '';

  const counts = useMemo(() => {
    const source = mode === 'mapel' ? data?.history || [] : data?.daily_history || [];
    return STATUS.reduce((result, item) => {
      result[item.key] = source.filter((row) => row.status === item.key).length;
      return result;
    }, {} as Record<Status, number>);
  }, [data, mode]);

  const total = STATUS.reduce((sum, item) => sum + counts[item.key], 0);
  const present = counts.hadir;
  const percentage = total ? Math.round((present / total) * 100) : 0;

  const subjects = useMemo(() => {
    const names = Array.from(new Set((data?.history || []).map((row) => row.subject)));
    return names.sort((a, b) => a.localeCompare(b, 'id'));
  }, [data]);

  const filteredHistory = useMemo(() => (data?.history || []).filter((row) =>
    (statusFilter === 'all' || row.status === statusFilter)
    && (subjectFilter === 'all' || row.subject === subjectFilter)
  ), [data, statusFilter, subjectFilter]);

  const visibleHistory = filteredHistory.slice(0, limit);
  const groupedHistory = useMemo(() => {
    const groups: { date: string; rows: AttendanceRow[] }[] = [];
    visibleHistory.forEach((row) => {
      const key = dateKey(row.date);
      const last = groups[groups.length - 1];
      if (last?.date === key) last.rows.push(row);
      else groups.push({ date: key, rows: [row] });
    });
    return groups;
  }, [visibleHistory]);

  const periodLabel = useMemo(() => {
    const first = data?.period?.start_date;
    if (!first) return 'Belum ada data presensi';
    return `Sejak ${new Date(`${first}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  }, [data]);

  const stopCamera = () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const submitToken = async (rawToken: string) => {
    const token = rawToken.trim();
    if (!token) {
      setScanState('error');
      setScanMessage('QR Code belum terbaca. Silakan coba lagi.');
      return;
    }
    if (scannedRef.current || scanBusy) return;
    scannedRef.current = true;
    setScanBusy(true);
    stopCamera();
    try {
      const response = await api.post('/siswa/absensi/scan', { token });
      const payload = response.data?.data || {};
      setScanDetails({
        subject: payload.subject || data?.current_session?.subject,
        time: payload.scanned_at ? new Date(payload.scanned_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      });
      setScanState('success');
      setScanMessage(response.data?.message || 'Scan diterima. Menunggu guru menyimpan jurnal.');
      void loadData(false);
    } catch (requestError: unknown) {
      const message = (requestError as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setScanState('error');
      setScanMessage(message || 'QR Code tidak valid atau sudah kedaluwarsa. Minta guru menampilkan QR terbaru.');
    } finally {
      setScanBusy(false);
    }
  };

  useEffect(() => {
    if (!scanOpen || scanState !== 'scanning') return;
    let active = true;
    const detectorConstructor = (window as unknown as {
      BarcodeDetector?: new (options?: { formats: string[] }) => { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
    }).BarcodeDetector;

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setScannerHint('Browser tidak menyediakan akses kamera. Buka KELASKU melalui HTTPS atau localhost, atau masukkan token QR secara manual.');
        return;
      }
      try {
        // Kamera tetap dibuka terlebih dahulu. Sebelumnya, pengecekan BarcodeDetector
        // dilakukan sebelum getUserMedia sehingga kamera tidak pernah menyala di browser
        // yang belum mendukung API pemindai QR bawaan.
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', { willReadFrequently: true });
        const detector = detectorConstructor
          ? new detectorConstructor({ formats: ['qr_code'] })
          : null;

        const detect = async () => {
          if (!active || scannedRef.current || !videoRef.current) return;
          const video = videoRef.current;
          try {
            if (detector) {
              const codes = await detector.detect(video);
              if (codes[0]?.rawValue) {
                await submitToken(codes[0].rawValue);
                return;
              }
            } else if (context && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
              // Fallback untuk browser tanpa BarcodeDetector: ambil frame kamera,
              // lalu decode QR menggunakan jsQR.
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              context.drawImage(video, 0, 0, canvas.width, canvas.height);
              const frame = context.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(frame.data, frame.width, frame.height, {
                inversionAttempts: 'attemptBoth',
              });
              if (code?.data) {
                await submitToken(code.data);
                return;
              }
            }
          } catch {
            // Abaikan frame yang belum siap; pemindaian dilanjutkan pada frame berikutnya.
          }
          if (active && !scannedRef.current) {
            frameRef.current = requestAnimationFrame(() => { void detect(); });
          }
        };
        frameRef.current = requestAnimationFrame(() => { void detect(); });
        setScannerHint(detector
          ? 'Kamera aktif. Arahkan QR Code ke dalam bingkai.'
          : 'Kamera aktif. Arahkan QR Code ke dalam bingkai. (Alternatif)');
      } catch (cameraError) {
        console.warn('Kamera tidak dapat dibuka:', cameraError);
        setScannerHint('Izin kamera belum diberikan atau kamera sedang digunakan. Masukkan token QR secara manual.');
      }
    };
    void start();
    return () => {
      active = false;
      stopCamera();
    };
  }, [scanOpen, scanState]);

  const openScanner = () => {
    scannedRef.current = false;
    setManualToken('');
    setScanMessage('');
    setScanDetails(null);
    setScanState('scanning');
    setScannerHint('Arahkan kamera ke QR Code presensi yang ditampilkan guru.');
    setScanOpen(true);
  };
  const closeScanner = () => {
    stopCamera();
    setScanOpen(false);
  };
  const retryScanner = () => {
    scannedRef.current = false;
    setScanMessage('');
    setScanDetails(null);
    setScanState('scanning');
  };

  return (
    <JadwalLayout namaSiswa={studentName} kelasSiswa={className} loading={loading} loadingText="Memuat kehadiran" loadingSubtitle="Menyiapkan riwayat dan statistik presensi Anda.">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.12em] text-[#6B7080]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#B98A3E]" />
            Semester ganjil 2026/2027
          </div>
          <h1 className="font-['Fraunces',serif] text-[32px] font-semibold leading-tight tracking-[-0.02em] text-[#141C30] sm:text-[36px]">Kehadiran</h1>
          <p className="mt-2 max-w-[620px] text-[13.5px] leading-6 text-[#6B7080]">Pantau riwayat presensi dan jumlah kehadiranmu di setiap pelajaran.</p>
        </div>
        <button type="button" onClick={openScanner} className="inline-flex w-full shrink-0 items-center justify-center gap-3 rounded-xl bg-[#1E2A47] px-5 py-3 text-sm font-bold text-white shadow-[0_8px_20px_-8px_rgba(20,28,48,0.55)] transition hover:bg-[#141C30] sm:w-auto">
          <span className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-white/15"><QrCode size={18} /></span>
          Scan QR presensi
        </button>
      </div>

      {error && <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-[#E8C9BE] bg-[#F5E6DF] px-4 py-3 text-sm text-[#8E452F]">{error}<button type="button" onClick={() => void loadData()} className="inline-flex items-center gap-1 font-bold"><RefreshCw size={14} /> Coba lagi</button></div>}

      {data?.current_session && (
        <section className="mb-[18px] flex flex-wrap items-center gap-4 rounded-[14px] border border-[#E7D3A8] bg-[#FDF5E0] px-4 py-3.5 sm:px-[18px]">
          <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-[#B98A3E]" />
          <div className="min-w-[220px] flex-1">
            <div className="text-[11px] font-bold uppercase tracking-wide text-[#8A5E14]">Sedang berlangsung</div>
            <div className="mt-0.5 text-[14.5px] font-bold text-[#141C30]">{data.current_session.subject} · {clock(data.current_session.start_time)}–{clock(data.current_session.end_time)}</div>
            <div className="mt-1 text-xs leading-relaxed text-[#6B7080]">Presensimu untuk pelajaran ini belum tercatat. Scan QR yang ditampilkan oleh {data.current_session.teacher} sebelum pelajaran berakhir.</div>
          </div>
          <button type="button" onClick={openScanner} className="inline-flex items-center gap-2 rounded-[10px] bg-[#1E2A47] px-4 py-2.5 text-[13px] font-bold text-white hover:bg-[#141C30]"><ScanLine size={15} /> Scan sekarang</button>
        </section>
      )}

      <div className={`${CARD} mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4`}>
        <div className="min-w-0">
          <h2 className="font-['Fraunces',serif] text-[19px] font-semibold text-[#141C30]">Statistik kehadiran</h2>
          <p className="mt-1 text-[12.5px] text-[#6B7080]">{mode === 'mapel' ? 'Jumlah presensi di setiap pelajaran.' : 'Jumlah hari sekolah menurut presensi harian.'}</p>
        </div>
        <div className="inline-flex self-start rounded-[11px] bg-[#EFEADB] p-[3px] sm:self-auto" role="tablist" aria-label="Basis statistik">
          <button type="button" role="tab" aria-selected={mode === 'mapel'} onClick={() => setMode('mapel')} className={`rounded-lg px-3.5 py-2 text-[12.5px] font-bold transition ${mode === 'mapel' ? 'bg-[#1E2A47] text-white shadow-sm' : 'text-[#6B7080] hover:text-[#1E2A47]'}`}>Per mata pelajaran</button>
          <button type="button" role="tab" aria-selected={mode === 'harian'} onClick={() => setMode('harian')} className={`rounded-lg px-3.5 py-2 text-[12.5px] font-bold transition ${mode === 'harian' ? 'bg-[#1E2A47] text-white shadow-sm' : 'text-[#6B7080] hover:text-[#1E2A47]'}`}>Harian</button>
        </div>
      </div>

      <section className="mb-5 grid grid-cols-1 gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        <div className={`${CARD} flex flex-col items-center gap-4 p-5 sm:flex-row xl:flex-col xl:items-center xl:justify-center`}>
          <div className="relative h-[112px] w-[112px] shrink-0">
            <svg width="112" height="112" viewBox="0 0 112 112" className="-rotate-90">
              <circle cx="56" cy="56" r="46" fill="none" stroke="#EFE9DB" strokeWidth="10" />
              <circle cx="56" cy="56" r="46" fill="none" stroke="#4C7A5E" strokeWidth="10" strokeLinecap="round" strokeDasharray={2 * Math.PI * 46} strokeDashoffset={2 * Math.PI * 46 * (1 - percentage / 100)} className="transition-all duration-500" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center font-['Fraunces',serif] text-[27px] font-semibold leading-none text-[#141C30]">{percentage}%<span className="mt-1 font-['Plus_Jakarta_Sans',sans-serif] text-[9px] font-bold uppercase tracking-wider text-[#6B7080]">Hadir</span></div>
          </div>
          <div className="min-w-0 text-center sm:text-left xl:text-center">
            <div className="text-[13px] font-bold text-[#141C30]">Persentase kehadiran</div>
            <p className="mt-1.5 text-[12px] leading-5 text-[#6B7080]">{present} dari {total} {mode === 'mapel' ? 'pertemuan' : 'hari sekolah'} tercatat hadir.</p>
            <p className="mt-1 text-[11px] text-[#8A8F9D]">{periodLabel}</p>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {STATUS.map((item) => (
              <div key={item.key} className={`${CARD} min-w-0 p-3.5 sm:p-4`}>
                <div className="mb-3 flex h-[34px] w-[34px] items-center justify-center rounded-[9px]" style={{ backgroundColor: item.bg, color: item.color }}>
                  {item.key === 'hadir' ? <CheckCircle2 size={17} /> : item.key === 'izin' ? <FilePenLine size={17} /> : item.key === 'sakit' ? <HeartPulse size={17} /> : item.key === 'dispen' ? <ShieldCheck size={17} /> : <X size={17} />}
                </div>
                <div className="font-['Fraunces',serif] text-[27px] font-semibold leading-none text-[#141C30]">{counts[item.key]}<small className="ml-1 font-['Plus_Jakarta_Sans',sans-serif] text-[11px] font-semibold text-[#6B7080]">{mode === 'mapel' ? 'kali' : 'hari'}</small></div>
                <div className="mt-2 text-[12px] font-bold text-[#141C30]">{item.label}</div>
                <div className="mt-0.5 text-[10.5px] text-[#6B7080]">{total ? ((counts[item.key] / total) * 100).toFixed(1).replace('.', ',') : '0,0'}% dari total</div>
              </div>
            ))}
          </div>
          <div className="flex items-start gap-2.5 rounded-[11px] border border-[#E3DACB] bg-[#FBF8EF] px-3.5 py-3 text-[11.5px] leading-[1.6] text-[#6B7080]">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#E7D3A8] text-[#7A5A20]"><Info size={12} /></span>
            {mode === 'mapel'
              ? 'Statistik dihitung per pertemuan. Setiap mata pelajaran yang memiliki catatan presensi dihitung satu kali.'
              : 'Statistik harian menggunakan presensi utama sekolah. Status harian mengikuti pencatatan presensi awal dan aturan sinkronisasi kehadiran KELASKU.'}
          </div>
        </div>
      </section>

      <section className={`${CARD} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E3DACB] px-5 py-4">
          <h2 className="font-['Fraunces',serif] text-[17px] font-semibold text-[#141C30]">Riwayat presensi</h2>
          <span className="text-[11.5px] text-[#6B7080]">Menampilkan {visibleHistory.length} dari {filteredHistory.length} pertemuan</span>
        </div>
        <div className="flex flex-col justify-between gap-3 border-b border-[#E3DACB] px-4 py-3.5 sm:flex-row sm:items-center sm:px-5">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { setStatusFilter('all'); setLimit(30); }} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11.5px] font-bold ${statusFilter === 'all' ? 'border-[#1E2A47] bg-[#1E2A47] text-white' : 'border-[#E3DACB] bg-[#FFFDF8] text-[#6B7080]'}`}>Semua <span>{data?.history.length || 0}</span></button>
            {STATUS.map((item) => (
              <button key={item.key} type="button" onClick={() => { setStatusFilter(item.key); setLimit(30); }} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-bold ${statusFilter === item.key ? 'border-[#1E2A47] bg-[#1E2A47] text-white' : 'border-[#E3DACB] bg-[#FFFDF8] text-[#6B7080]'}`}>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.dot }} />{item.label}<span>{data?.history.filter((row) => row.status === item.key).length || 0}</span>
              </button>
            ))}
          </div>
          <label className="relative flex min-w-[200px] items-center">
            <select value={subjectFilter} onChange={(event) => { setSubjectFilter(event.target.value); setLimit(30); }} className="w-full appearance-none rounded-[10px] border border-[#E3DACB] bg-[#FFFDF8] px-3 py-2.5 pr-9 text-[12px] font-semibold text-[#23283A] outline-none focus:border-[#2C3B5E]">
              <option value="all">Semua mata pelajaran</option>
              {subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
            </select>
            <ChevronDown size={15} className="pointer-events-none absolute right-3 text-[#6B7080]" />
          </label>
        </div>
        <div className="hidden grid-cols-[78px_4px_minmax(190px,1.4fr)_108px_minmax(130px,1fr)_minmax(150px,1.2fr)] gap-3 border-b border-[#E3DACB] bg-[#FBF8EF] px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[#6B7080] lg:grid">
          <span>Jam</span><span /><span>Mata pelajaran</span><span>Status</span><span>Metode</span><span>Keterangan</span>
        </div>

        {groupedHistory.length ? groupedHistory.map((group) => (
          <div key={group.date}>
            <div className="flex items-center gap-2 border-b border-[#E3DACB] bg-[#F6F2E8] px-5 py-2.5 text-[12px] font-bold text-[#141C30]">
              <CalendarDays size={14} className="text-[#8A7A45]" />
              {dateLabel(group.date)}
              {group.date === new Date().toLocaleDateString('en-CA') && <span className="rounded-full bg-[#E7D3A8] px-2 py-0.5 text-[9px] font-bold text-[#7A5A20]">Hari ini</span>}
              <span className="ml-auto text-[10.5px] font-medium text-[#6B7080]">{group.rows.length} pelajaran</span>
            </div>
            {group.rows.map((row) => {
              const item = statusInfo(row.status);
              return (
                <div key={row.id} className="grid grid-cols-[66px_4px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-b border-[#F0EADA] px-4 py-3 transition hover:bg-[#FBF8EF] sm:px-5 lg:grid-cols-[78px_4px_minmax(190px,1.4fr)_108px_minmax(130px,1fr)_minmax(150px,1.2fr)]">
                  <div className="text-[11px] leading-5 text-[#6B7080]"><b className="block text-[12px] text-[#141C30]">{clock(row.start_time)}</b>{clock(row.end_time)}</div>
                  <div className="h-full min-h-10 w-1 rounded-full" style={{ backgroundColor: '#1E2A47' }} />
                  <div className="min-w-0">
                    <div className="truncate text-[12.5px] font-bold text-[#141C30]">{row.subject}</div>
                    <div className="mt-0.5 truncate text-[10.5px] text-[#6B7080]">{row.teacher} · {row.day || ''}</div>
                  </div>
                  <div><span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[10.5px] font-bold" style={{ backgroundColor: item.bg, color: item.color }}><span className="h-1.5 w-1.5 rounded-full bg-current" />{item.label}</span></div>
                  <div className="col-start-3 text-[10.5px] text-[#6B7080] lg:col-auto">{row.method === 'qr' ? <span className="inline-flex items-center gap-1.5"><QrCode size={12} /> Scan QR</span> : <span className="inline-flex items-center gap-1.5"><FilePenLine size={12} /> Diinput guru</span>}</div>
                  <div className="col-start-3 text-[11px] leading-5 text-[#23283A] lg:col-auto">{row.notes || <span className="text-[#C7C0AC]">—</span>}</div>
                </div>
              );
            })}
          </div>
        )) : (
          <div className="px-5 py-12 text-center text-[13px] text-[#6B7080]">Belum ada riwayat presensi yang cocok dengan filter ini.</div>
        )}

        {filteredHistory.length > visibleHistory.length && (
          <div className="flex justify-center p-4"><button type="button" onClick={() => setLimit((value) => value + 30)} className="rounded-[10px] border border-[#E3DACB] bg-[#FFFDF8] px-5 py-2.5 text-[12px] font-bold text-[#1E2A47] transition hover:border-[#B98A3E] hover:bg-[#F0EBDB]">Muat lebih banyak</button></div>
        )}
      </section>

      {scanOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[rgba(20,17,10,0.62)] p-4" role="dialog" aria-modal="true" aria-labelledby="scan-title" onMouseDown={(event) => { if (event.target === event.currentTarget) closeScanner(); }}>
          <div className="max-h-[94vh] w-full max-w-[440px] overflow-y-auto rounded-[20px] bg-[#FFFDF8] shadow-[0_24px_60px_-20px_rgba(20,17,10,0.5)]">
            <div className="flex items-center justify-between px-5 pb-1 pt-5">
              <h3 id="scan-title" className="font-['Fraunces',serif] text-[19px] font-semibold text-[#141C30]">{scanState === 'scanning' ? 'Scan QR presensi' : 'Hasil scan'}</h3>
              <button type="button" onClick={closeScanner} aria-label="Tutup" className="flex h-[34px] w-[34px] items-center justify-center rounded-lg text-[#6B7080] hover:bg-[#F5E6DF] hover:text-[#AE5A3E]"><X size={17} /></button>
            </div>
            <div className="px-5 pb-5 pt-3">
              {scanState === 'scanning' ? (
                <>
                  <div className="relative aspect-square overflow-hidden rounded-2xl bg-[#10182C]">
                    <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
                    <div className="pointer-events-none absolute inset-[17%]">
                      <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-xl border-l-4 border-t-4 border-[#D9B97A]" />
                      <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-xl border-r-4 border-t-4 border-[#D9B97A]" />
                      <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-xl border-b-4 border-l-4 border-[#D9B97A]" />
                      <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-xl border-b-4 border-r-4 border-[#D9B97A]" />
                    </div>
                    <div className="absolute inset-x-0 bottom-3 text-center text-xs font-semibold text-white/80">{scannerHint}</div>
                  </div>
                  <p className="my-4 text-center text-[13px] leading-6 text-[#6B7080]">Arahkan kamera ke QR Code presensi yang ditampilkan guru di kelas. Scan akan masuk sebagai presensi sementara sampai guru menyimpan jurnal.</p>
                  {data?.current_session && (
                    <div className="flex items-center gap-3 rounded-xl border border-[#E3DACB] bg-[#FBF8EF] p-3">
                      <span className="h-10 w-1 shrink-0 rounded-full bg-[#1E2A47]" />
                      <div className="min-w-0"><div className="text-[10px] font-bold uppercase text-[#6B7080]">Pelajaran berlangsung</div><div className="mt-0.5 truncate text-[13px] font-bold text-[#141C30]">{data.current_session.subject}</div><div className="mt-0.5 text-[11px] text-[#6B7080]">{clock(data.current_session.start_time)}–{clock(data.current_session.end_time)} · {data.current_session.teacher}</div></div>
                    </div>
                  )}
                  <div className="mt-4 rounded-xl border border-dashed border-[#D3CAB4] p-3">
                    <label htmlFor="manual-qr-token" className="mb-2 block text-[11px] font-bold text-[#6B7080]">Atau masukkan token QR secara manual</label>
                    <div className="flex gap-2">
                      <input id="manual-qr-token" value={manualToken} onChange={(event) => setManualToken(event.target.value)} placeholder="Token QR presensi" className="min-w-0 flex-1 rounded-lg border border-[#E3DACB] bg-white px-3 py-2 text-xs outline-none focus:border-[#1E2A47]" />
                      <button type="button" disabled={scanBusy || !manualToken.trim()} onClick={() => void submitToken(manualToken)} className="rounded-lg bg-[#1E2A47] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Kirim</button>
                    </div>
                  </div>
                  <button type="button" onClick={closeScanner} className="mt-4 w-full rounded-[11px] border border-[#E3DACB] bg-[#FFFDF8] py-3 text-[13px] font-bold text-[#23283A] hover:bg-[#F0EBDB]">Batal</button>
                </>
              ) : (
                <div className="py-3 text-center">
                  <div className={`mx-auto mb-4 flex h-[68px] w-[68px] items-center justify-center rounded-full ${scanState === 'success' ? 'bg-[#E7F0EA] text-[#4C7A5E]' : 'bg-[#F5E6DF] text-[#AE5A3E]'}`}>
                    {scanState === 'success' ? <Check size={34} strokeWidth={2.5} /> : <X size={34} strokeWidth={2.5} />}
                  </div>
                  <h4 className="font-['Fraunces',serif] text-[21px] font-semibold text-[#141C30]">{scanState === 'success' ? 'Scan berhasil diterima' : 'QR Code tidak valid'}</h4>
                  <p className="mx-2 mt-2 text-[13px] leading-6 text-[#6B7080]">{scanMessage}</p>
                  {scanState === 'success' && (
                    <div className="mt-5 overflow-hidden rounded-xl border border-[#E3DACB] text-left">
                      <div className="flex justify-between gap-3 border-b border-[#F0EADA] px-4 py-3 text-[12px]"><span className="text-[#6B7080]">Mata pelajaran</span><b className="text-right text-[#141C30]">{scanDetails?.subject || 'Sesi presensi'}</b></div>
                      <div className="flex justify-between gap-3 border-b border-[#F0EADA] px-4 py-3 text-[12px]"><span className="text-[#6B7080]">Dipindai pukul</span><b className="text-[#141C30]">{scanDetails?.time || '—'}</b></div>
                      <div className="flex justify-between gap-3 px-4 py-3 text-[12px]"><span className="text-[#6B7080]">Status</span><b className="text-[#4C7A5E]">Menunggu penyimpanan jurnal</b></div>
                    </div>
                  )}
                  <div className="mt-5 flex gap-2">
                    {scanState === 'error' && <button type="button" onClick={retryScanner} className="flex-1 rounded-[11px] border border-[#E3DACB] py-3 text-[13px] font-bold text-[#23283A] hover:bg-[#F0EBDB]">Coba lagi</button>}
                    <button type="button" onClick={closeScanner} className="flex-1 rounded-[11px] bg-[#1E2A47] py-3 text-[13px] font-bold text-white hover:bg-[#141C30]">{scanState === 'success' ? 'Selesai' : 'Tutup'}</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </JadwalLayout>
  );
}
