import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { KelasSayaLayout } from '../../layouts/Guru/KelasSayaLayout';

interface GuruData {
  nama: string;
  mata_pelajaran: string;
}

interface KelasItem {
  id: number;
  nama_kelas: string;
  mata_pelajaran: string;
  wali_kelas: string;
  jumlah_siswa: number;
  jadwal: string;
  rata_rata_nilai: number;
  kehadiran: string;
  pertemuan_saat_ini: number;
  total_pertemuan: number;
  progres_persen: string;
  tipe: 'peminatan' | 'wajib';
}

interface StatistikKelas {
  kelas_diajar: number;
  total_siswa: number;
  rata_rata_kehadiran: string;
  tugas_menunggu: number;
}

export default function KelasSaya() {
  const [activeTab, setActiveTab] = useState<string>('Semua kelas');
  const [guruData, setGuruData] = useState<GuruData | null>(null);
  const [statistik, setStatistik] = useState<StatistikKelas | null>(null);
  const [kelasList, setKelasList] = useState<KelasItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const storedUser = localStorage.getItem('user');
  const user = storedUser ? JSON.parse(storedUser) : { name: 'Guru' };

  useEffect(() => {
    const fetchKelasData = async () => {
      try {
        setLoading(true);
        const response = await api.get('/guru/kelas-saya');
        if (response.data.success) {
          setGuruData(response.data.data.guru);
          setStatistik(response.data.data.statistik);
          setKelasList(response.data.data.kelas);
        }
      } catch (error) {
        console.error("Gagal mengambil data kelas saya:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchKelasData();
  }, []);

  const getInitials = (name: string) => {
    if (!name) return 'GR';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const namaGuru = guruData?.nama || user.name;
  const mapelGuru = guruData?.mata_pelajaran || 'Guru Mata Pelajaran';

  const filteredKelas = kelasList.filter(cls => 
    cls.nama_kelas.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cls.mata_pelajaran.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <KelasSayaLayout namaGuru={namaGuru} mapelGuru={mapelGuru} getInitials={getInitials}>
        <div className="flex h-[60vh] items-center justify-center text-[#1E2A47] font-semibold">
          Memuat data kelas...
        </div>
      </KelasSayaLayout>
    );
  }

  return (
    <KelasSayaLayout 
      namaGuru={namaGuru} 
      mapelGuru={mapelGuru} 
      getInitials={getInitials}
    >
      <div className="animate-[rise_0.5s_ease_both]">
        {/* Header Halaman */}
        <div className="flex items-start justify-between mb-1.5 gap-5">
          <div>
            <div className="text-[13px] text-[#6B7080]">Semester ganjil 2026/2027</div>
            <h1 className="font-['Fraunces',serif] font-semibold text-[26px] text-[#141C30] tracking-[-0.01em] mt-0.5">Kelas saya</h1>
          </div>
        </div>

        {/* Toolbar: filter & pencarian */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3.5 my-[22px]">
          <div className="flex bg-[#FFFDF8] border border-[#E3DACB] rounded-[11px] p-1">
            {['Semua kelas', 'Berlangsung', 'Arsip'].map((tab) => (
              <button
                key={tab}
                className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-[13px] font-semibold transition-colors ${
                  activeTab === tab
                    ? 'bg-[#1E2A47] text-white'
                    : 'text-[#6B7080] bg-transparent hover:bg-gray-100'
                }`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
            <div className="flex items-center gap-[7px] bg-[#FFFDF8] border border-[#E3DACB] rounded-[10px] p-[9px_12px] text-[13px] text-[#23283A] font-semibold">
              Semester ganjil 2026/2027
              <svg className="opacity-55" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
            </div>
            <div className="flex items-center gap-2 bg-[#FFFDF8] border border-[#E3DACB] rounded-[10px] p-[9px_13px] min-w-[220px]">
              <svg className="flex-shrink-0 opacity-50" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
              <input 
                type="text" 
                placeholder="Cari kelas..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border-none outline-none bg-transparent font-inherit text-[13.5px] text-[#23283A] w-full" 
              />
            </div>
          </div>
        </div>

        {/* Ringkasan Statistik Kosong (0) */}
        <div className="flex flex-wrap lg:flex-nowrap gap-[14px] lg:gap-[22px] bg-[#FFFDF8] border border-[#E3DACB] rounded-[14px] shadow-[0_1px_2px_rgba(30,25,15,0.04),0_8px_24px_-12px_rgba(30,25,15,0.10)] p-4 lg:p-[16px_22px] mb-[22px]">
          <div className="flex items-center gap-[11px] lg:pr-[22px] lg:border-r border-[#E3DACB] w-full lg:w-auto">
            <div className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center flex-shrink-0 bg-[#E7ECF4] text-[#1E2A47]">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            </div>
            <div>
              <div className="font-['Fraunces',serif] font-semibold text-[19px] text-[#141C30] leading-none">{statistik?.kelas_diajar || 0}</div>
              <div className="text-[11.5px] text-[#6B7080] mt-1">Kelas diajar</div>
            </div>
          </div>
          <div className="flex items-center gap-[11px] lg:pr-[22px] lg:border-r border-[#E3DACB] w-full lg:w-auto">
            <div className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center flex-shrink-0 bg-[#E7D3A8] text-[#7A5A20]">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            </div>
            <div>
              <div className="font-['Fraunces',serif] font-semibold text-[19px] text-[#141C30] leading-none">{statistik?.total_siswa || 0}</div>
              <div className="text-[11.5px] text-[#6B7080] mt-1">Total siswa</div>
            </div>
          </div>
          <div className="flex items-center gap-[11px] lg:pr-[22px] lg:border-r border-[#E3DACB] w-full lg:w-auto">
            <div className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center flex-shrink-0 bg-[#E7F0EA] text-[#4C7A5E]">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4 12 14.01l-3-3"/></svg>
            </div>
            <div>
              <div className="font-['Fraunces',serif] font-semibold text-[19px] text-[#141C30] leading-none">{statistik?.rata_rata_kehadiran || '0%'}</div>
              <div className="text-[11.5px] text-[#6B7080] mt-1">Rata-rata kehadiran</div>
            </div>
          </div>
          <div className="flex items-center gap-[11px] w-full lg:w-auto">
            <div className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center flex-shrink-0 bg-[#F5E6DF] text-[#AE5A3E]">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            </div>
            <div>
              <div className="font-['Fraunces',serif] font-semibold text-[19px] text-[#141C30] leading-none">{statistik?.tugas_menunggu || 0}</div>
              <div className="text-[11.5px] text-[#6B7080] mt-1">Tugas menunggu dinilai</div>
            </div>
          </div>
        </div>

        {/* Tampilan Kondisional Jika Kelas Kosong */}
        {filteredKelas.length > 0 ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-[18px]">
            {/* Pemetaan kartu kelas jika data tersedia */}
          </div>
        ) : (
          <div className="bg-[#FFFDF8] border border-[#E3DACB] rounded-[14px] p-12 text-center shadow-[0_1px_2px_rgba(30,25,15,0.04)]">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#E5ECF5] text-[#3E6BAE] flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            </div>
            <h3 className="font-['Fraunces',serif] font-semibold text-lg text-[#141C30]">Belum ada kelas</h3>
            <p className="text-sm text-[#6B7080] mt-1">Belum ada kelas yang terdaftar atau ditugaskan kepada Anda pada semester ini.</p>
          </div>
        )}
      </div>
    </KelasSayaLayout>
  );
}