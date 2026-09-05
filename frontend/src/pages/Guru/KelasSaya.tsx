import { useEffect, useState } from 'react';
import api from '../../api/axios';
import { KelasSayaLayout } from '../../layouts/Guru/KelasSayaLayout';

interface GuruData {
  nama: string;
  mata_pelajaran: string;
}

interface SiswaItem {
  id: number;
  nama: string;
  email: string;
}

interface JadwalItem {
  id: number;
  hari: string;
  waktu: string;
  mata_pelajaran: string;
}

interface KelasItem {
  id: number;
  nama: string;
  jumlah_siswa: number;
  mata_pelajaran: string[];
  jumlah_jadwal: number;
  siswa: SiswaItem[];
  jadwal: JadwalItem[];
}

export default function KelasSaya() {
  const [activeTab, setActiveTab] = useState<string>('Semua kelas');
  const [guruData, setGuruData] = useState<GuruData | null>(null);
  const [kelasList, setKelasList] = useState<KelasItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const storedUser = localStorage.getItem('user');

  let user: { name?: string } = {
    name: 'Guru',
  };

  if (storedUser) {
    try {
      user = JSON.parse(storedUser);
    } catch {
      user = {
        name: 'Guru',
      };
    }
  }

  useEffect(() => {
    const fetchKelasData = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await api.get('/guru/kelas-saya');

        if (!response.data.success) {
          throw new Error(
            response.data.message || 'Gagal mengambil data kelas.'
          );
        }

        const kelasData: KelasItem[] = response.data.data || [];

        setKelasList(kelasData);

        /*
         * Data guru diambil dari localStorage.
         * Mata pelajaran guru juga dapat dibentuk dari
         * seluruh mata pelajaran yang terdapat pada kelas.
         */
        const semuaMapel = kelasData
          .flatMap((kelas) => kelas.mata_pelajaran)
          .filter(Boolean)
          .filter(
            (mapel, index, array) =>
              array.indexOf(mapel) === index
          );

        setGuruData({
          nama: user.name || 'Guru',
          mata_pelajaran:
            semuaMapel.length > 0
              ? semuaMapel.join(', ')
              : 'Guru Mata Pelajaran',
        });
      } catch (err: any) {
        console.error(
          'Gagal mengambil data kelas saya:',
          err
        );

        setError(
          err.response?.data?.message ||
            err.message ||
            'Gagal mengambil data kelas.'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchKelasData();
  }, []);

  const getInitials = (name: string) => {
    if (!name) return 'GR';

    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const namaGuru = guruData?.nama || user.name || 'Guru';

  const mapelGuru =
    guruData?.mata_pelajaran ||
    'Guru Mata Pelajaran';

  /*
   * Menentukan hari sekarang.
   * Digunakan untuk tab "Berlangsung".
   */
  const getHariSekarang = () => {
    const hari = new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
    }).format(new Date());

    return hari;
  };

  const hariSekarang = getHariSekarang();

  /*
   * Filter berdasarkan pencarian.
   */
  const searchedKelas = kelasList.filter((kelas) => {
    const search = searchTerm.toLowerCase().trim();

    if (!search) {
      return true;
    }

    const namaKelasMatch = kelas.nama
      .toLowerCase()
      .includes(search);

    const mataPelajaranMatch = kelas.mata_pelajaran.some(
      (mapel) =>
        mapel.toLowerCase().includes(search)
    );

    return namaKelasMatch || mataPelajaranMatch;
  });

  /*
   * Filter berdasarkan tab.
   *
   * Semua kelas:
   * Menampilkan seluruh kelas guru.
   *
   * Berlangsung:
   * Menampilkan kelas yang memiliki jadwal hari ini.
   *
   * Arsip:
   * Untuk sekarang kosong karena backend belum memiliki
   * konsep kelas yang diarsipkan.
   */
  const filteredKelas = searchedKelas.filter((kelas) => {
    if (activeTab === 'Semua kelas') {
      return true;
    }

    if (activeTab === 'Berlangsung') {
      return kelas.jadwal.some(
        (jadwal) =>
          jadwal.hari.toLowerCase() ===
          hariSekarang.toLowerCase()
      );
    }

    if (activeTab === 'Arsip') {
      return false;
    }

    return true;
  });

  /*
   * Statistik yang dapat dihitung langsung dari response API.
   *
   * Total siswa menggunakan Set agar satu siswa tidak
   * dihitung dua kali jika suatu saat berada di lebih
   * dari satu kelas.
   */
  const totalSiswa = Array.from(
    new Map(
      kelasList
        .flatMap((kelas) => kelas.siswa)
        .map((siswa) => [siswa.id, siswa])
    ).values()
  ).length;

  const jumlahKelas = kelasList.length;

  /*
   * API kelas-saya saat ini belum mengirim data kehadiran
   * dan tugas. Jangan menampilkan angka palsu.
   */
  const rataRataKehadiran = '-';
  const tugasMenunggu = '-';

  if (loading) {
    return (
      <KelasSayaLayout
        namaGuru={namaGuru}
        mapelGuru={mapelGuru}
        getInitials={getInitials}
      >
        <div className="flex h-[60vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[#E3DACB] border-t-[#1E2A47]" />

            <div className="font-semibold text-[#1E2A47]">
              Memuat data kelas...
            </div>
          </div>
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
            <div className="text-[13px] text-[#6B7080]">
              Semester ganjil 2026/2027
            </div>

            <h1 className="font-['Fraunces',serif] font-semibold text-[26px] text-[#141C30] tracking-[-0.01em] mt-0.5">
              Kelas saya
            </h1>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-5 rounded-[12px] border border-[#E8B8AA] bg-[#FFF4F0] px-4 py-3 text-[13px] text-[#AE5A3E]">
            <div className="font-semibold">
              Gagal memuat data kelas
            </div>

            <div className="mt-1">
              {error}
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3.5 my-[22px]">
          <div className="flex bg-[#FFFDF8] border border-[#E3DACB] rounded-[11px] p-1">
            {[
              'Semua kelas',
              'Berlangsung',
              'Arsip',
            ].map((tab) => (
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

              <svg
                className="opacity-55"
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>

            <div className="flex items-center gap-2 bg-[#FFFDF8] border border-[#E3DACB] rounded-[10px] p-[9px_13px] min-w-[220px]">
              <svg
                className="flex-shrink-0 opacity-50"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>

              <input
                type="text"
                placeholder="Cari kelas..."
                value={searchTerm}
                onChange={(e) =>
                  setSearchTerm(e.target.value)
                }
                className="border-none outline-none bg-transparent font-inherit text-[13.5px] text-[#23283A] w-full"
              />
            </div>
          </div>
        </div>

        {/* Ringkasan Statistik */}
        <div className="flex flex-wrap lg:flex-nowrap gap-[14px] lg:gap-[22px] bg-[#FFFDF8] border border-[#E3DACB] rounded-[14px] shadow-[0_1px_2px_rgba(30,25,15,0.04),0_8px_24px_-12px_rgba(30,25,15,0.10)] p-4 lg:p-[16px_22px] mb-[22px]">
          {/* Kelas */}
          <div className="flex items-center gap-[11px] lg:pr-[22px] lg:border-r border-[#E3DACB] w-full lg:w-auto">
            <div className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center flex-shrink-0 bg-[#E7ECF4] text-[#1E2A47]">
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
              >
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            </div>

            <div>
              <div className="font-['Fraunces',serif] font-semibold text-[19px] text-[#141C30] leading-none">
                {jumlahKelas}
              </div>

              <div className="text-[11.5px] text-[#6B7080] mt-1">
                Kelas diajar
              </div>
            </div>
          </div>

          {/* Siswa */}
          <div className="flex items-center gap-[11px] lg:pr-[22px] lg:border-r border-[#E3DACB] w-full lg:w-auto">
            <div className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center flex-shrink-0 bg-[#E7D3A8] text-[#7A5A20]">
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
            </div>

            <div>
              <div className="font-['Fraunces',serif] font-semibold text-[19px] text-[#141C30] leading-none">
                {totalSiswa}
              </div>

              <div className="text-[11.5px] text-[#6B7080] mt-1">
                Total siswa
              </div>
            </div>
          </div>

          {/* Kehadiran */}
          <div className="flex items-center gap-[11px] lg:pr-[22px] lg:border-r border-[#E3DACB] w-full lg:w-auto">
            <div className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center flex-shrink-0 bg-[#E7F0EA] text-[#4C7A5E]">
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <path d="M22 4 12 14.01l-3-3" />
              </svg>
            </div>

            <div>
              <div className="font-['Fraunces',serif] font-semibold text-[19px] text-[#141C30] leading-none">
                {rataRataKehadiran}
              </div>

              <div className="text-[11.5px] text-[#6B7080] mt-1">
                Rata-rata kehadiran
              </div>
            </div>
          </div>

          {/* Tugas */}
          <div className="flex items-center gap-[11px] w-full lg:w-auto">
            <div className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center flex-shrink-0 bg-[#F5E6DF] text-[#AE5A3E]">
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
              >
                <rect
                  x="3"
                  y="4"
                  width="18"
                  height="18"
                  rx="2"
                />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            </div>

            <div>
              <div className="font-['Fraunces',serif] font-semibold text-[19px] text-[#141C30] leading-none">
                {tugasMenunggu}
              </div>

              <div className="text-[11.5px] text-[#6B7080] mt-1">
                Tugas menunggu dinilai
              </div>
            </div>
          </div>
        </div>

        {/* Daftar Kelas */}
        {filteredKelas.length > 0 ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-[18px]">
            {filteredKelas.map((kelas) => (
              <div
                key={kelas.id}
                className="bg-[#FFFDF8] border border-[#E3DACB] rounded-[14px] p-5 shadow-[0_1px_2px_rgba(30,25,15,0.04),0_8px_24px_-12px_rgba(30,25,15,0.08)]"
              >
                {/* Header Card */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-['Fraunces',serif] font-semibold text-[21px] text-[#141C30]">
                      {kelas.nama}
                    </h2>

                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {kelas.mata_pelajaran.map(
                        (mapel) => (
                          <span
                            key={mapel}
                            className="inline-flex items-center rounded-full bg-[#E7ECF4] px-2.5 py-1 text-[11px] font-semibold text-[#1E2A47]"
                          >
                            {mapel}
                          </span>
                        )
                      )}
                    </div>
                  </div>

                  <div className="flex-shrink-0 rounded-[9px] bg-[#F5E6DF] px-3 py-1.5 text-[11px] font-semibold text-[#AE5A3E]">
                    {kelas.jumlah_siswa} siswa
                  </div>
                </div>

                {/* Jadwal */}
                <div className="mt-5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#8A8F9D]">
                    Jadwal
                  </div>

                  {kelas.jadwal.length > 0 ? (
                    <div className="mt-2 space-y-2">
                      {kelas.jadwal.map((jadwal) => (
                        <div
                          key={jadwal.id}
                          className="flex items-center gap-3 rounded-[10px] border border-[#EDE5D9] bg-[#FCFAF5] px-3 py-2.5"
                        >
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[8px] bg-[#E7ECF4] text-[#1E2A47]">
                            <svg
                              width="15"
                              height="15"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.9"
                            >
                              <circle
                                cx="12"
                                cy="12"
                                r="9"
                              />
                              <path d="M12 7v5l3 2" />
                            </svg>
                          </div>

                          <div className="min-w-0">
                            <div className="text-[12.5px] font-semibold text-[#23283A]">
                              {jadwal.hari}
                            </div>

                            <div className="text-[11.5px] text-[#6B7080]">
                              {jadwal.waktu}
                              {' · '}
                              {jadwal.mata_pelajaran}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 text-[12px] text-[#8A8F9D]">
                      Belum ada jadwal.
                    </div>
                  )}
                </div>

                {/* Daftar Siswa */}
                <div className="mt-5">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#8A8F9D]">
                      Daftar siswa
                    </div>

                    <div className="text-[11px] font-semibold text-[#6B7080]">
                      {kelas.jumlah_siswa} siswa
                    </div>
                  </div>

                  {kelas.siswa.length > 0 ? (
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {kelas.siswa.map((siswa) => (
                        <div
                          key={siswa.id}
                          className="flex items-center gap-2.5 rounded-[10px] border border-[#EDE5D9] bg-[#FCFAF5] px-3 py-2"
                        >
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#E7ECF4] text-[11px] font-bold text-[#1E2A47]">
                            {getInitials(siswa.nama)}
                          </div>

                          <div className="min-w-0">
                            <div className="truncate text-[12px] font-semibold text-[#23283A]">
                              {siswa.nama}
                            </div>

                            <div className="truncate text-[10.5px] text-[#8A8F9D]">
                              {siswa.email}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 text-[12px] text-[#8A8F9D]">
                      Belum ada siswa di kelas ini.
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-[#FFFDF8] border border-[#E3DACB] rounded-[14px] p-12 text-center shadow-[0_1px_2px_rgba(30,25,15,0.04)]">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#E5ECF5] text-[#3E6BAE] flex items-center justify-center">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            </div>

            <h3 className="font-['Fraunces',serif] font-semibold text-lg text-[#141C30]">
              {activeTab === 'Arsip'
                ? 'Belum ada kelas arsip'
                : searchTerm
                  ? 'Kelas tidak ditemukan'
                  : 'Belum ada kelas'}
            </h3>

            <p className="text-sm text-[#6B7080] mt-1">
              {activeTab === 'Arsip'
                ? 'Belum ada kelas yang diarsipkan.'
                : searchTerm
                  ? `Tidak ada kelas yang cocok dengan "${searchTerm}".`
                  : 'Belum ada kelas yang terdaftar atau ditugaskan kepada Anda pada semester ini.'}
            </p>
          </div>
        )}
      </div>
    </KelasSayaLayout>
  );
}