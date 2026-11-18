import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { DashboardLayout } from '../../layouts/Guru/DashboardLayout';
import LoadingScreen from '../../components/common/LoadingScreen';

interface GuruData {
  nama: string;
  mata_pelajaran: string;
}

interface StatistikData {
  kelas_diajar: number;
  total_siswa: number;
  tugas_menunggu: number;
  kehadiran_hari_ini: string;
}

interface JadwalItem {
  id: number;
  jam_ke: number;
  waktu: string;
  kelas: string;
  topik: string;
  status: 'selesai' | 'berlangsung' | 'belum';
}

interface JurnalItem {
  id: number;
  tanggal: string;
  kelas_mapel: string;
  topik: string;
  meta: string;
  status: 'terisi' | 'belum';
}

interface TugasItem {
  id: number;
  judul: string;
  kelas: string;
  terkumpul: number;
}

interface RataKelas {
  kelas: string;
  nilai: number;
}

interface DashboardData {
  guru: GuruData;
  statistik: StatistikData;
  jadwal_hari_ini: JadwalItem[];
  jurnal_terbaru: JurnalItem[];
  tugas_menunggu_dinilai: TugasItem[];
  rata_rata_kelas: RataKelas[];
}

// ---------- Kartu Rata-rata Nilai Kelas ----------
const KKM = 75; // Batas ketuntasan minimal, sesuaikan dengan kebijakan sekolah

const getTone = (nilai: number) => {
  if (nilai >= 85) return { label: 'Sangat baik', bar: 'from-[#3F6B52] to-[#6FA085]', text: 'text-[#3F6B52]', chip: 'bg-[#E7F0EA] text-[#3F6B52]', hex: '#4C7A5E' };
  if (nilai >= KKM) return { label: 'Baik', bar: 'from-[#B98A3E] to-[#E0B968]', text: 'text-[#7A5A20]', chip: 'bg-[#F3E6C8] text-[#7A5A20]', hex: '#B98A3E' };
  return { label: 'Perlu perhatian', bar: 'from-[#AE5A3E] to-[#D98466]', text: 'text-[#AE5A3E]', chip: 'bg-[#F5E6DF] text-[#AE5A3E]', hex: '#AE5A3E' };
};

function RataNilaiCard({ data }: { data: RataKelas[] }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const items = data.map((d) => ({ ...d, nilai: Math.max(0, Math.min(100, Number(d.nilai) || 0)) }));
  const hasData = items.length > 0;
  const avg = hasData ? items.reduce((a, b) => a + b.nilai, 0) / items.length : 0;
  const best = hasData ? items.reduce((a, b) => (b.nilai > a.nilai ? b : a)) : null;
  const worst = hasData ? items.reduce((a, b) => (b.nilai < a.nilai ? b : a)) : null;
  const avgTone = getTone(avg);

  // Gauge setengah lingkaran
  const R = 48;
  const arcLen = Math.PI * R;
  const arcOffset = arcLen * (1 - (mounted ? avg : 0) / 100);

  return (
    <div className="bg-[#FFFDF8] border border-[#E3DACB] rounded-[14px] shadow-[0_1px_2px_rgba(30,25,15,0.04),0_8px_24px_-12px_rgba(30,25,15,0.10)] overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-start p-[18px_20px_14px] border-b border-[#E3DACB]">
        <div>
          <h3 className="font-['Fraunces',serif] font-semibold text-[16px] text-[#141C30]">Rata-rata nilai kelas</h3>
          <p className="text-[11.5px] text-[#6B7080] mt-0.5">Perbandingan capaian tiap kelas</p>
        </div>
        {hasData && (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#6B7080] bg-[#F5F1E7] border border-[#E3DACB] rounded-full px-2.5 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#141C30]" />
            KKM {KKM}
          </span>
        )}
      </div>

      {hasData ? (
        <div className="p-[18px_20px_20px]">
          {/* Ringkasan: gauge + tertinggi/terendah */}
          <div className="flex items-center gap-5 mb-6 p-4 rounded-[12px] bg-gradient-to-br from-[#F8F3E6] to-[#F2ECDC] border border-[#EADFC8]">
            <div className="relative w-[120px] h-[68px] shrink-0">
              <svg viewBox="0 0 120 68" className="w-full h-full overflow-visible">
                <path d="M12 62 A48 48 0 0 1 108 62" fill="none" stroke="#E3DACB" strokeWidth="10" strokeLinecap="round" />
                <path
                  d="M12 62 A48 48 0 0 1 108 62"
                  fill="none"
                  stroke={avgTone.hex}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={arcLen}
                  strokeDashoffset={arcOffset}
                  style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.22,1,.36,1)' }}
                />
              </svg>
              <div className="absolute inset-x-0 bottom-0 text-center leading-none">
                <div className="font-['Fraunces',serif] font-semibold text-[24px] text-[#141C30]">{avg.toFixed(1)}</div>
              </div>
            </div>

            <div className="flex-1 min-w-0 space-y-2.5">
              <div>
                <div className="text-[10.5px] uppercase tracking-[0.08em] text-[#6B7080] font-semibold">Rata-rata keseluruhan</div>
                <span className={`inline-block mt-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${avgTone.chip}`}>{avgTone.label}</span>
              </div>
              {items.length > 1 && best && worst && (
                <div className="flex gap-4 text-[11.5px]">
                  <div>
                    <div className="text-[#6B7080]">Tertinggi</div>
                    <div className="font-bold text-[#3F6B52]">{best.kelas} · {best.nilai}</div>
                  </div>
                  <div>
                    <div className="text-[#6B7080]">Terendah</div>
                    <div className="font-bold text-[#AE5A3E]">{worst.kelas} · {worst.nilai}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bar per kelas */}
          <div className="space-y-[18px]">
            {items.map((item, i) => {
              const tone = getTone(item.nilai);
              return (
                <div key={i} className="group">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-6 h-6 rounded-[7px] bg-[#1E2A47] text-white text-[10.5px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                      <span className="text-[13px] font-bold text-[#141C30] truncate">{item.kelas}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`hidden sm:inline-block text-[10.5px] font-semibold px-2 py-0.5 rounded-full ${tone.chip}`}>{tone.label}</span>
                      <span className={`font-['Fraunces',serif] font-semibold text-[17px] leading-none ${tone.text}`}>{item.nilai}</span>
                    </div>
                  </div>

                  <div className="relative h-[12px] bg-[#EFE9DB] rounded-full">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${tone.bar} shadow-[inset_0_-1px_0_rgba(0,0,0,0.12),0_2px_6px_-2px_rgba(30,25,15,0.35)] relative`}
                      style={{
                        width: mounted ? `${item.nilai}%` : '0%',
                        transition: `width 1s cubic-bezier(.22,1,.36,1) ${i * 90}ms`,
                      }}
                    >
                      <span className="absolute right-[3px] top-1/2 -translate-y-1/2 w-[6px] h-[6px] rounded-full bg-white/90" />
                    </div>
                    {/* Penanda KKM */}
                    <span
                      className="absolute -top-[3px] -bottom-[3px] w-px bg-[#141C30]/40"
                      style={{ left: `${KKM}%` }}
                      title={`KKM ${KKM}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Skala & legenda */}
          <div className="relative mt-3 h-3 text-[10px] text-[#9A9AA5]">
            <span className="absolute left-0">0</span>
            <span className="absolute -translate-x-1/2 font-semibold text-[#6B7080]" style={{ left: `${KKM}%` }}>KKM</span>
            <span className="absolute right-0">100</span>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-4 pt-4 border-t border-dashed border-[#E3DACB] text-[11px] text-[#6B7080]">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#4C7A5E]" />≥ 85</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#B98A3E]" />{KKM}–84</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#AE5A3E]" />&lt; {KKM}</span>
          </div>
        </div>
      ) : (
        <div className="text-[13px] text-[#6B7080] italic p-6 text-center">Belum ada data nilai rata-rata.</div>
      )}
    </div>
  );
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const user = (() => {
    try {
      const storedUser = localStorage.getItem('user');
      return storedUser ? JSON.parse(storedUser) : { name: 'Guru' };
    } catch (error) {
      console.error('Gagal membaca data profil dari localStorage:', error);
      return { name: 'Guru' };
    }
  })();

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await api.get('/guru/dashboard');
        if (response.data.success) {
          setData(response.data.data);
        }
      } catch (error) {
        console.error("Gagal mengambil data dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const getInitials = (name: string) => {
    if (!name) return 'GR';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  // Diubah menjadi dinamis menggunakan lokal Indonesia (id-ID)
  const todayStr = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  if (loading) {
    return (
      <DashboardLayout
        namaGuru={user.name || user.nama || 'Guru'}
        getInitials={getInitials}
        todayStr={todayStr}
        hideHeader
      >
        <div className="flex min-h-[calc(100vh-52px)] items-center justify-center bg-[#F5F1E7]">
          <LoadingScreen
            text="Memuat dashboard"
            subtitle="Menyiapkan data dashboard Anda."
            className="min-h-[calc(100vh-52px)]"
          />
        </div>
      </DashboardLayout>
    );
  }

  const stat = data?.statistik || { kelas_diajar: 0, total_siswa: 0, tugas_menunggu: 0, kehadiran_hari_ini: '0%' };
  const jadwal = data?.jadwal_hari_ini || [];
  const jurnal = data?.jurnal_terbaru || [];
  const tugasMenunggu = data?.tugas_menunggu_dinilai || [];
  const rataKelas = data?.rata_rata_kelas || [];
  const namaGuru = data?.guru?.nama || user.name || user.nama || 'Guru';
  const mapelGuru = data?.guru?.mata_pelajaran || 'Guru Mata Pelajaran';

  return (
    <DashboardLayout 
      namaGuru={namaGuru} 
      mapelGuru={mapelGuru} 
      getInitials={getInitials} 
      todayStr={todayStr}
    >
      {/* HERO: Jadwal hari ini */}
      <section className="bg-[#FFFDF8] border border-[#E3DACB] rounded-[18px] p-[22px_24px_20px] mb-5 shadow-[0_1px_2px_rgba(30,25,15,0.04),0_8px_24px_-12px_rgba(30,25,15,0.10)] animate-[rise_0.5s_ease_both]">
         <div className="flex justify-between items-baseline mb-[18px]">
          <h2 className="font-['Fraunces',serif] font-semibold text-[18px] text-[#141C30] tracking-[-0.01em]">Jadwal mengajar hari ini</h2>
          <div className="text-[13px] text-[#6B7080]">{jadwal.length} kelas</div>
         </div>
         <div className="flex gap-0 overflow-x-auto pb-1">
           {jadwal.length > 0 ? (
               jadwal.map((item) => (
                <div key={item.id} className="flex-1 basis-[190px] shrink-0 relative pr-[18px] after:content-[''] after:absolute after:top-[15px] after:right-0 after:w-[18px] after:h-px after:bg-[#E3DACB] last:after:hidden">
                  <div className={`w-[30px] h-[30px] rounded-[9px] font-['Fraunces',serif] font-semibold text-[13px] flex items-center justify-center mb-2.5 ${item.status === 'selesai' ? 'bg-[#E7F0EA] text-[#4C7A5E] border border-[#4C7A5E]' : item.status === 'berlangsung' ? 'bg-[#B98A3E] text-[#141C30]' : 'bg-[#1E2A47] text-white'}`}>
                    {item.jam_ke}
                  </div>
                  <div className="text-[11.5px] text-[#6B7080] mb-[3px]">{item.waktu}</div>
                  <div className="text-[14.5px] font-bold text-[#141C30]">{item.kelas}</div>
                  <div className="text-[12.5px] text-[#6B7080] mt-0.5 leading-[1.4]">{item.topik}</div>
                   <span className={`inline-block mt-2 text-[11px] font-semibold px-[9px] py-[2px] rounded-full ${item.status === 'selesai' ? 'bg-[#E7F0EA] text-[#4C7A5E]' : item.status === 'berlangsung' ? 'bg-[#E7D3A8] text-[#7A5A20]' : 'bg-[#F5E6DF] text-[#AE5A3E]'}`}>
                     {item.status === 'selesai' ? 'Jurnal terisi' : item.status === 'berlangsung' ? 'Sedang berlangsung' : 'Belum dimulai'}
                   </span>
                </div>
               ))
           ) : (
            <div className="text-[13px] text-[#6B7080] italic py-4">Belum ada data jadwal hari ini.</div>
           )}
         </div>
      </section>

      {/* STATS */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
           <div className="bg-[#FFFDF8] border border-[#E3DACB] rounded-[14px] p-[18px_18px_16px] shadow-[0_1px_2px_rgba(30,25,15,0.04),0_8px_24px_-12px_rgba(30,25,15,0.10)]">
              <div className="flex justify-between items-start mb-[14px]">
                <div className="w-[34px] h-[34px] rounded-[9px] bg-[#E7ECF4] text-[#1E2A47] flex items-center justify-center">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                </div>
              </div>
              <div className="font-['Fraunces',serif] text-[30px] font-semibold text-[#141C30] leading-none">{stat.kelas_diajar}</div>
              <div className="text-[13px] text-[#6B7080] mt-1.5">Kelas yang diajar</div>
           </div>
           <div className="bg-[#FFFDF8] border border-[#E3DACB] rounded-[14px] p-[18px_18px_16px] shadow-[0_1px_2px_rgba(30,25,15,0.04),0_8px_24px_-12px_rgba(30,25,15,0.10)]">
              <div className="flex justify-between items-start mb-[14px]">
                <div className="w-[34px] h-[34px] rounded-[9px] bg-[#E7D3A8] text-[#7A5A20] flex items-center justify-center">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                </div>
              </div>
              <div className="font-['Fraunces',serif] text-[30px] font-semibold text-[#141C30] leading-none">{stat.total_siswa}</div>
              <div className="text-[13px] text-[#6B7080] mt-1.5">Total siswa</div>
           </div>
           <div className="bg-[#FFFDF8] border border-[#E3DACB] rounded-[14px] p-[18px_18px_16px] shadow-[0_1px_2px_rgba(30,25,15,0.04),0_8px_24px_-12px_rgba(30,25,15,0.10)]">
              <div className="flex justify-between items-start mb-[14px]">
                <div className="w-[34px] h-[34px] rounded-[9px] bg-[#F5E6DF] text-[#AE5A3E] flex items-center justify-center">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                </div>
              </div>
              <div className="font-['Fraunces',serif] text-[30px] font-semibold text-[#141C30] leading-none">{stat.tugas_menunggu}</div>
              <div className="text-[13px] text-[#6B7080] mt-1.5">Tugas menunggu dinilai</div>
           </div>
           <div className="bg-[#FFFDF8] border border-[#E3DACB] rounded-[14px] p-[18px_18px_16px] shadow-[0_1px_2px_rgba(30,25,15,0.04),0_8px_24px_-12px_rgba(30,25,15,0.10)]">
              <div className="flex justify-between items-start mb-[14px]">
                <div className="w-[34px] h-[34px] rounded-[9px] bg-[#E7F0EA] text-[#4C7A5E] flex items-center justify-center">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4 12 14.01l-3-3"/></svg>
                </div>
              </div>
              <div className="font-['Fraunces',serif] text-[30px] font-semibold text-[#141C30] leading-none">{stat.kehadiran_hari_ini}</div>
              <div className="text-[13px] text-[#6B7080] mt-1.5">Kehadiran hari ini</div>
           </div>
      </section>

      {/* CONTENT GRID */}
      <section className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-[18px] items-start">
        
        {/* Left column */}
        <div className="bg-[#FFFDF8] border border-[#E3DACB] rounded-[14px] shadow-[0_1px_2px_rgba(30,25,15,0.04),0_8px_24px_-12px_rgba(30,25,15,0.10)] overflow-hidden">
           <div className="flex justify-between items-center p-[18px_20px_14px] border-b border-[#E3DACB]">
             <h3 className="font-['Fraunces',serif] font-semibold text-[16px] text-[#141C30]">Jurnal mengajar terbaru</h3>
             <a href="#" className="text-[12.5px] text-[#1E2A47] font-semibold">Lihat semua</a>
           </div>
           <div className="p-[6px_8px_10px]">
              {jurnal.length > 0 ? (
                jurnal.map((item) => (
                  <div key={item.id} className="flex gap-3.5 p-[14px_12px] rounded-[10px] hover:bg-[#FAF6EC] transition-colors">
                    <div className="w-[46px] shrink-0 text-center bg-[#F0EBDB] rounded-[9px] py-1.5 pb-1">
                       <div className="font-['Fraunces',serif] font-bold text-[17px] text-[#141C30] leading-none">{item.tanggal.split(' ')[0]}</div>
                       <div className="text-[10px] text-[#6B7080] mt-0.5 lowercase">{item.tanggal.split(' ')[1]}</div>
                    </div>
                    <div className="flex-1">
                       <div className="text-[13px] font-bold text-[#141C30]">{item.kelas_mapel}</div>
                       <div className="text-[13px] text-[#23283A] mt-0.5 leading-[1.45]">{item.topik}</div>
                       <div className="text-[11.5px] text-[#6B7080] mt-1.5">{item.meta}</div>
                    </div>
                    <span className={`self-center text-[11px] font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap ${item.status === 'terisi' ? 'bg-[#E7F0EA] text-[#4C7A5E]' : 'bg-[#F5E6DF] text-[#AE5A3E]'}`}>
                      {item.status === 'terisi' ? 'Terisi' : 'Belum diisi'}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-[13px] text-[#6B7080] italic p-4 text-center">Belum ada entri jurnal.</div>
              )}
           </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-[18px]">
           
           {/* Menunggu dinilai */}
           <div className="bg-[#FFFDF8] border border-[#E3DACB] rounded-[14px] shadow-[0_1px_2px_rgba(30,25,15,0.04),0_8px_24px_-12px_rgba(30,25,15,0.10)] overflow-hidden">
              <div className="flex justify-between items-center p-[18px_20px_14px] border-b border-[#E3DACB]">
                <h3 className="font-['Fraunces',serif] font-semibold text-[16px] text-[#141C30]">Menunggu dinilai</h3>
              </div>
              <div className="p-[6px_8px_10px]">
               {tugasMenunggu.length > 0 ? (
                  tugasMenunggu.map(item => (
                     <div key={item.id} className="flex items-center gap-3 p-3 rounded-[10px] hover:bg-[#FAF6EC] transition-colors">
                        <div className="w-[36px] h-[36px] rounded-[9px] bg-[#E7ECF4] text-[#1E2A47] flex items-center justify-center shrink-0">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                        </div>
                        <div>
                           <div className="text-[13px] font-bold text-[#141C30]">{item.judul}</div>
                           <div className="text-[11.5px] text-[#6B7080] mt-0.5">{item.kelas}</div>
                        </div>
                        <div className="ml-auto text-right font-['Fraunces',serif] font-semibold text-[16px] text-[#AE5A3E] shrink-0">
                           {item.terkumpul}<span className="block font-['Plus_Jakarta_Sans',sans-serif] font-medium text-[10px] text-[#6B7080]">terkumpul</span>
                        </div>
                     </div>
                  ))
               ) : (
                  <div className="text-[13px] text-[#6B7080] italic p-4 text-center">Tidak ada tugas menunggu dinilai.</div>
               )}
              </div>
           </div>

           {/* Rata-rata nilai kelas */}
           <RataNilaiCard data={rataKelas} />
        </div>
      </section>
    </DashboardLayout>
  );
}