import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { DashboardLayout } from '../../layouts/DashboardLayout';

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

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const storedUser = localStorage.getItem('user');
  const user = storedUser ? JSON.parse(storedUser) : { name: 'Guru' };

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

  const todayStr = "Selasa, 1 September 2026";

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#F5F1E7]">Memuat...</div>;
  }

  const stat = data?.statistik || { kelas_diajar: 0, total_siswa: 0, tugas_menunggu: 0, kehadiran_hari_ini: '0%' };
  const jadwal = data?.jadwal_hari_ini || [];
  const jurnal = data?.jurnal_terbaru || [];
  const tugasMenunggu = data?.tugas_menunggu_dinilai || [];
  const rataKelas = data?.rata_rata_kelas || [];
  const namaGuru = data?.guru?.nama || user.name;
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
           <div className="bg-[#FFFDF8] border border-[#E3DACB] rounded-[14px] shadow-[0_1px_2px_rgba(30,25,15,0.04),0_8px_24px_-12px_rgba(30,25,15,0.10)] overflow-hidden">
              <div className="flex justify-between items-center p-[18px_20px_14px] border-b border-[#E3DACB]">
               <h3 className="font-['Fraunces',serif] font-semibold text-[16px] text-[#141C30]">Rata-rata nilai kelas</h3>
              </div>
              <div className="p-[8px_0_14px]">
                {rataKelas.length > 0 ? (
                  rataKelas.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 p-[11px_20px]">
                      <div className="w-[76px] text-[12.5px] font-semibold shrink-0">{item.kelas}</div>
                      <div className="flex-1 h-[7px] bg-[#EFE9DB] rounded-full overflow-hidden">
                         <div className="h-full rounded-full bg-gradient-to-r from-[#1E2A47] to-[#2C3B5E]" style={{width: `${item.nilai}%`}}></div>
                      </div>
                      <div className="w-[36px] text-right text-[12px] text-[#6B7080] shrink-0">{item.nilai}</div>
                    </div>
                  ))
                ) : (
                 <div className="text-[13px] text-[#6B7080] italic p-4 text-center">Belum ada data nilai rata-rata.</div>
                )}
              </div>
           </div>
        </div>
      </section>
    </DashboardLayout>
  );
}