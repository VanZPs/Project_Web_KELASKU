import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useNavigate } from 'react-router-dom';

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
  archived: boolean;
  jumlah_siswa: number;
  mata_pelajaran: string[];
  jumlah_jadwal: number;
  siswa: SiswaItem[];
  jadwal: JadwalItem[];
}

type TabType =
  | 'Semua kelas'
  | 'Berlangsung'
  | 'Arsip';

export default function KelasSaya() {
  /*
   * ==========================================================
   * NAVIGASI
   * ==========================================================
   */
  const navigate = useNavigate();

  const [activeTab, setActiveTab] =
    useState<TabType>('Semua kelas');

  const [guruData, setGuruData] =
    useState<GuruData | null>(null);

  const [kelasList, setKelasList] =
    useState<KelasItem[]>([]);

  const [loading, setLoading] =
    useState<boolean>(true);

  const [error, setError] =
    useState<string>('');

  const [searchTerm, setSearchTerm] =
    useState<string>('');

  const [selectedClass, setSelectedClass] =
    useState<KelasItem | null>(null);

  const [archiveTarget, setArchiveTarget] =
    useState<KelasItem | null>(null);

  const [restoreTarget, setRestoreTarget] =
    useState<KelasItem | null>(null);

  const [processingArchive, setProcessingArchive] =
    useState<boolean>(false);

  const storedUser =
    localStorage.getItem('user');

  let user: {
    name?: string;
  } = {
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

  /*
   * ==========================================================
   * AMBIL DATA KELAS
   * ==========================================================
   */
  const fetchKelasData = async () => {
    try {
      setLoading(true);
      setError('');

      const response =
        await api.get('/guru/kelas-saya');

      if (!response.data.success) {
        throw new Error(
          response.data.message ||
            'Gagal mengambil data kelas.'
        );
      }

      const kelasData: KelasItem[] =
        response.data.data || [];

      setKelasList(kelasData);

      /*
       * Bentuk daftar mata pelajaran guru
       * berdasarkan seluruh kelas.
       */
      const semuaMapel = kelasData
        .flatMap(
          (kelas) =>
            kelas.mata_pelajaran || []
        )
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

  useEffect(() => {
    fetchKelasData();
  }, []);

  /*
   * ==========================================================
   * INITIAL
   * ==========================================================
   */
  const getInitials = (name: string) => {
    if (!name) {
      return 'GR';
    }

    return name
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const namaGuru =
    guruData?.nama ||
    user.name ||
    'Guru';

  const mapelGuru =
    guruData?.mata_pelajaran ||
    'Guru Mata Pelajaran';

  /*
   * ==========================================================
   * HARI SEKARANG
   * ==========================================================
   */
  const hariSekarang =
    new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
    }).format(new Date());

  /*
   * ==========================================================
   * SEARCH
   * ==========================================================
   */
  const searchedKelas = useMemo(() => {
    const search =
      searchTerm
        .toLowerCase()
        .trim();

    if (!search) {
      return kelasList;
    }

    return kelasList.filter((kelas) => {
      const namaKelasMatch =
        kelas.nama
          .toLowerCase()
          .includes(search);

      const mataPelajaranMatch =
        kelas.mata_pelajaran.some(
          (mapel) =>
            mapel
              .toLowerCase()
              .includes(search)
        );

      return (
        namaKelasMatch ||
        mataPelajaranMatch
      );
    });
  }, [
    kelasList,
    searchTerm,
  ]);

  /*
   * ==========================================================
   * FILTER TAB
   * ==========================================================
   */
  const filteredKelas =
    searchedKelas.filter((kelas) => {
      /*
       * SEMUA KELAS
       */
      if (
        activeTab === 'Semua kelas'
      ) {
        return !kelas.archived;
      }

      /*
       * BERLANGSUNG
       */
      if (
        activeTab === 'Berlangsung'
      ) {
        if (kelas.archived) {
          return false;
        }

        return kelas.jadwal.some(
          (jadwal) =>
            jadwal.hari
              .toLowerCase() ===
            hariSekarang.toLowerCase()
        );
      }

      /*
       * ARSIP
       */
      if (
        activeTab === 'Arsip'
      ) {
        return kelas.archived;
      }

      return false;
    });

  /*
   * ==========================================================
   * STATISTIK
   * ==========================================================
   */
  const kelasAktif =
    kelasList.filter(
      (kelas) => !kelas.archived
    );

  const totalSiswa =
    Array.from(
      new Map(
        kelasAktif
          .flatMap(
            (kelas) => kelas.siswa
          )
          .map(
            (siswa) => [
              siswa.id,
              siswa,
            ]
          )
      ).values()
    ).length;

  const jumlahKelas =
    kelasAktif.length;

  const jumlahKelasArsip =
    kelasList.filter(
      (kelas) => kelas.archived
    ).length;

  /*
   * API kelas-saya belum mengirim data
   * kehadiran dan tugas.
   */
  const rataRataKehadiran = '-';
  const tugasMenunggu = '-';

  /*
   * ==========================================================
   * ARSIPKAN KELAS
   * ==========================================================
   */
  const handleArchiveClass =
    async () => {
      if (!archiveTarget) {
        return;
      }

      try {
        setProcessingArchive(true);

        await api.patch(
          `/guru/kelas/${archiveTarget.id}/arsip`
        );

        setKelasList(
          (currentClasses) =>
            currentClasses.map(
              (kelas) =>
                kelas.id ===
                archiveTarget.id
                  ? {
                      ...kelas,
                      archived: true,
                    }
                  : kelas
            )
        );

        if (
          selectedClass?.id ===
          archiveTarget.id
        ) {
          setSelectedClass(null);
        }

        setArchiveTarget(null);
      } catch (err: any) {
        console.error(
          'Gagal mengarsipkan kelas:',
          err
        );

        setError(
          err.response?.data?.message ||
            'Kelas gagal diarsipkan. Silakan coba lagi.'
        );
      } finally {
        setProcessingArchive(false);
      }
    };

  /*
   * ==========================================================
   * PULIHKAN KELAS
   * ==========================================================
   */
  const handleRestoreClass =
    async () => {
      if (!restoreTarget) {
        return;
      }

      try {
        setProcessingArchive(true);

        await api.patch(
          `/guru/kelas/${restoreTarget.id}/pulihkan`
        );

        setKelasList(
          (currentClasses) =>
            currentClasses.map(
              (kelas) =>
                kelas.id ===
                restoreTarget.id
                  ? {
                      ...kelas,
                      archived: false,
                    }
                  : kelas
            )
        );

        setRestoreTarget(null);
      } catch (err: any) {
        console.error(
          'Gagal memulihkan kelas:',
          err
        );

        setError(
          err.response?.data?.message ||
            'Kelas gagal dipulihkan. Silakan coba lagi.'
        );
      } finally {
        setProcessingArchive(false);
      }
    };

  /*
   * ==========================================================
   * LOADING
   * ==========================================================
   */
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

  /*
   * ==========================================================
   * RENDER
   * ==========================================================
   */
  return (
    <KelasSayaLayout
      namaGuru={namaGuru}
      mapelGuru={mapelGuru}
      getInitials={getInitials}
    >

      <div className="animate-[rise_0.5s_ease_both]">

        {/* =====================================================
            HEADER
        ====================================================== */}
        <div className="mb-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

            <div>
              {/* Label semester */}
              <div className="mb-2 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#C49A5A]" />

                <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#8A806F]">
                  Semester Ganjil 2026/2027
                </span>
              </div>

              {/* Judul */}
              <h1 className="font-['Fraunces',serif] text-[32px] font-semibold leading-[1.1] tracking-[-0.02em] text-[#141C30] sm:text-[36px]">
                Kelas saya
              </h1>

              {/* Deskripsi */}
              <p className="mt-2 max-w-[520px] text-[13px] leading-5 text-[#6B7080]">
                Kelola kelas yang Anda ajar dan pantau aktivitas
                pembelajaran dalam satu tempat.
              </p>
            </div>

            {/* =================================================
                HEADER ACTION
            ================================================== */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">

              {/* TOMBOL TAMBAH KELAS */}
              <button
                type="button"
                onClick={() =>
                  navigate(
                    '/guru/kelas-saya/tambah'
                  )
                }
                className="inline-flex items-center justify-center gap-2 rounded-[12px] bg-[#1E2A47] px-4 py-3 text-[12px] font-semibold text-white shadow-[0_4px_16px_-10px_rgba(30,25,15,0.3)] transition-all hover:bg-[#293754] hover:shadow-[0_8px_20px_-10px_rgba(30,25,15,0.35)] active:scale-[0.98]"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </svg>

                Tambah kelas
              </button>

              {/* SEMESTER BADGE */}
              <div className="flex items-center gap-3 rounded-[12px] border border-[#E3DACB] bg-[#FFFDF8] px-4 py-3 shadow-[0_4px_16px_-10px_rgba(30,25,15,0.2)]">

                <div className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-[#F1E8D8] text-[#7A5A20]">
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  >
                    <rect
                      x="3"
                      y="4"
                      width="18"
                      height="17"
                      rx="2"
                    />

                    <path d="M16 2v4" />

                    <path d="M8 2v4" />

                    <path d="M3 10h18" />
                  </svg>
                </div>

                <div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#8A8C94]">
                    Tahun ajaran
                  </div>

                  <div className="mt-0.5 text-[12px] font-semibold text-[#1E2A47]">
                    2026/2027 · Ganjil
                  </div>
                </div>

              </div>

            </div>

          </div>
        </div>


        {/* =====================================================
            ERROR
        ====================================================== */}
        {error && (
          <div className="mb-5 flex items-start justify-between gap-4 rounded-[12px] border border-[#E8B8AA] bg-[#FFF4F0] px-4 py-3 text-[13px] text-[#AE5A3E]">

            <div>

              <div className="font-semibold">
                Terjadi kesalahan
              </div>

              <div className="mt-1">
                {error}
              </div>

            </div>

            <button
              type="button"
              onClick={() =>
                setError('')
              }
              className="text-[#AE5A3E] hover:opacity-70"
            >
              ✕
            </button>

          </div>
        )}


        {/* =====================================================
            TOOLBAR
        ====================================================== */}
        <div className="my-[22px] flex flex-col items-stretch justify-between gap-3.5 md:flex-row md:items-center">

          {/* TABS */}
          <div className="flex rounded-[11px] border border-[#E3DACB] bg-[#FFFDF8] p-1">

            {[
              'Semua kelas',
              'Berlangsung',
              'Arsip',
            ].map((tab) => (

              <button
                key={tab}
                type="button"
                onClick={() =>
                  setActiveTab(
                    tab as TabType
                  )
                }
                className={`flex-1 rounded-lg px-4 py-2 text-[13px] font-semibold transition-colors md:flex-none ${
                  activeTab === tab
                    ? 'bg-[#1E2A47] text-white'
                    : 'bg-transparent text-[#6B7080] hover:bg-[#F5F1E9]'
                }`}
              >

                {tab}

                {tab === 'Arsip' &&
                  jumlahKelasArsip > 0 && (
                    <span
                      className={`ml-2 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full text-[10px] ${
                        activeTab === 'Arsip'
                          ? 'bg-white/15 text-white'
                          : 'bg-[#F1ECE3] text-[#6B7080]'
                      }`}
                    >
                      {jumlahKelasArsip}
                    </span>
                  )}

              </button>

            ))}

          </div>


          {/* FILTER + SEARCH */}
          <div className="flex flex-col items-stretch gap-2.5 md:flex-row md:items-center">

            <div className="flex items-center gap-[7px] rounded-[10px] border border-[#E3DACB] bg-[#FFFDF8] p-[9px_12px] text-[13px] font-semibold text-[#23283A]">

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


            <div className="flex min-w-[220px] items-center gap-2 rounded-[10px] border border-[#E3DACB] bg-[#FFFDF8] p-[9px_13px]">

              <svg
                className="flex-shrink-0 opacity-50"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle
                  cx="11"
                  cy="11"
                  r="7"
                />

                <path d="M21 21l-4.3-4.3" />
              </svg>

              <input
                type="text"
                placeholder="Cari kelas..."
                value={searchTerm}
                onChange={(e) =>
                  setSearchTerm(
                    e.target.value
                  )
                }
                className="w-full border-none bg-transparent font-inherit text-[13.5px] text-[#23283A] outline-none"
              />

            </div>

          </div>

        </div>


        {/* =====================================================
            STATISTIK
        ====================================================== */}
        <div className="mb-[22px] flex flex-wrap gap-[14px] rounded-[14px] border border-[#E3DACB] bg-[#FFFDF8] p-4 shadow-[0_1px_2px_rgba(30,25,15,0.04),0_8px_24px_-12px_rgba(30,25,15,0.10)] lg:flex-nowrap lg:gap-[22px] lg:p-[16px_22px]">

          {/* KELAS */}
          <div className="flex w-full items-center gap-[11px] lg:w-auto lg:border-r lg:border-[#E3DACB] lg:pr-[22px]">

            <div className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[9px] bg-[#E7ECF4] text-[#1E2A47]">

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

              <div className="font-['Fraunces',serif] text-[19px] font-semibold leading-none text-[#141C30]">
                {jumlahKelas}
              </div>

              <div className="mt-1 text-[11.5px] text-[#6B7080]">
                Kelas diajar
              </div>

            </div>

          </div>


          {/* SISWA */}
          <div className="flex w-full items-center gap-[11px] lg:w-auto lg:border-r lg:border-[#E3DACB] lg:pr-[22px]">

            <div className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[9px] bg-[#E7D3A8] text-[#7A5A20]">

              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />

                <circle
                  cx="9"
                  cy="7"
                  r="4"
                />
              </svg>

            </div>

            <div>

              <div className="font-['Fraunces',serif] text-[19px] font-semibold leading-none text-[#141C30]">
                {totalSiswa}
              </div>

              <div className="mt-1 text-[11.5px] text-[#6B7080]">
                Total siswa
              </div>

            </div>

          </div>


          {/* KEHADIRAN */}
          <div className="flex w-full items-center gap-[11px] lg:w-auto lg:border-r lg:border-[#E3DACB] lg:pr-[22px]">

            <div className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[9px] bg-[#E7F0EA] text-[#4C7A5E]">

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

              <div className="font-['Fraunces',serif] text-[19px] font-semibold leading-none text-[#141C30]">
                {rataRataKehadiran}
              </div>

              <div className="mt-1 text-[11.5px] text-[#6B7080]">
                Rata-rata kehadiran
              </div>

            </div>

          </div>


          {/* TUGAS */}
          <div className="flex w-full items-center gap-[11px] lg:w-auto">

            <div className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[9px] bg-[#F5E6DF] text-[#AE5A3E]">

              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />

                <path d="M14 2v6h6" />

                <path d="M8 13h8" />

                <path d="M8 17h5" />
              </svg>

            </div>

            <div>

              <div className="font-['Fraunces',serif] text-[19px] font-semibold leading-none text-[#141C30]">
                {tugasMenunggu}
              </div>

              <div className="mt-1 text-[11.5px] text-[#6B7080]">
                Tugas menunggu
              </div>

            </div>

          </div>

        </div>


        {/* =====================================================
            JUDUL LIST
        ====================================================== */}
        <div className="mb-3.5 flex items-center justify-between">

          <div>

            <h2 className="font-['Fraunces',serif] text-[19px] font-semibold text-[#141C30]">

              {activeTab === 'Arsip'
                ? 'Kelas diarsipkan'
                : activeTab === 'Berlangsung'
                  ? 'Kelas berlangsung'
                  : 'Daftar kelas'}

            </h2>

            <p className="mt-0.5 text-[12px] text-[#6B7080]">

              {activeTab === 'Arsip'
                ? 'Kelas yang sudah tidak aktif.'
                : 'Kelas yang sedang Anda ajar.'}

            </p>

          </div>

          <div className="text-[12px] text-[#6B7080]">
            {filteredKelas.length}{' '}
            kelas
          </div>

        </div>


        {/* =====================================================
            EMPTY STATE
        ====================================================== */}
        {filteredKelas.length === 0 ? (

          <div className="rounded-[14px] border border-[#E3DACB] bg-[#FFFDF8] px-6 py-12 text-center">

            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#F5F1E9] text-[#6B7080]">

              {activeTab === 'Arsip' ? (

                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                >
                  <path d="M3 6h18" />
                  <path d="M5 6l1 15h12l1-15" />
                  <path d="M9 6V3h6v3" />
                  <path d="M9 11h6" />
                </svg>

              ) : (

                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                >
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>

              )}

            </div>


            <div className="font-semibold text-[#1E2A47]">

              {searchTerm
                ? 'Kelas tidak ditemukan'
                : activeTab === 'Arsip'
                  ? 'Belum ada kelas diarsipkan'
                  : activeTab === 'Berlangsung'
                    ? 'Tidak ada kelas hari ini'
                    : 'Belum ada kelas'}

            </div>


            <div className="mt-1 text-[13px] text-[#6B7080]">

              {searchTerm
                ? 'Coba gunakan kata kunci pencarian yang lain.'
                : activeTab === 'Arsip'
                  ? 'Kelas yang Anda arsipkan akan muncul di sini.'
                  : 'Kelas yang Anda ajar akan muncul di sini.'}

            </div>

            {/* =================================================
                TOMBOL TAMBAH KELAS - EMPTY STATE
            ================================================== */}
            {!searchTerm &&
              activeTab === 'Semua kelas' && (
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      '/guru/kelas-saya/tambah'
                    )
                  }
                  className="mt-5 inline-flex items-center gap-2 rounded-[10px] bg-[#1E2A47] px-4 py-2.5 text-[12px] font-semibold text-white transition-all hover:bg-[#293754] active:scale-[0.98]"
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 5v14" />
                    <path d="M5 12h14" />
                  </svg>

                  Tambah kelas
                </button>
              )}

          </div>

        ) : (

          /* ===================================================
             CLASS CARDS
          ==================================================== */
          <div className="grid grid-cols-1 gap-[14px] xl:grid-cols-3">

            {filteredKelas.map(
              (kelas) => {

                /*
                 * Mata pelajaran utama yang
                 * ditampilkan pada bagian atas card.
                 */
                const mataPelajaranUtama =
                  kelas.mata_pelajaran?.[0] ||
                  'Belum ada mata pelajaran';

                /*
                 * Jumlah mata pelajaran tambahan.
                 */
                const jumlahMapelLainnya =
                  Math.max(
                    (kelas.mata_pelajaran?.length || 0) - 1,
                    0
                  );

                return (
                  <div
                    key={kelas.id}
                    className={`group rounded-[14px] border bg-[#FFFDF8] p-[18px] transition-all ${
                      kelas.archived
                        ? 'border-[#E3DACB] opacity-[0.9]'
                        : 'border-[#E3DACB] hover:border-[#CFC4B3] hover:shadow-[0_8px_25px_-15px_rgba(30,25,15,0.25)]'
                    }`}
                  >

                    {/* =========================================
                        CARD HEADER
                    ========================================== */}
                    <div className="flex items-start justify-between gap-4">

                      <div className="min-w-0">

                        <div className="flex flex-wrap items-center gap-2">

                          <h3 className="font-['Fraunces',serif] text-[22px] font-semibold tracking-[-0.01em] text-[#141C30]">
                            {kelas.nama}
                          </h3>

                          {kelas.archived && (
                            <span className="rounded-full bg-[#F1ECE3] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.04em] text-[#6B7080]">
                              Diarsipkan
                            </span>
                          )}

                        </div>


                        <div className="mt-1 text-[13px] font-semibold text-[#6B7080]">
                          {mataPelajaranUtama}
                        </div>

                      </div>


                      {/* DETAIL BUTTON */}
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedClass(
                            kelas
                          )
                        }
                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-[#6B7080] transition hover:bg-[#F5F1E9] hover:text-[#1E2A47]"
                        title="Lihat detail kelas"
                      >

                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <circle
                            cx="5"
                            cy="12"
                            r="1"
                          />

                          <circle
                            cx="12"
                            cy="12"
                            r="1"
                          />

                          <circle
                            cx="19"
                            cy="12"
                            r="1"
                          />
                        </svg>

                      </button>

                    </div>


                    {/* =========================================
                        STATISTIK CARD
                    ========================================== */}
                    <div className="mt-6 grid grid-cols-2 gap-4">

                      {/* JUMLAH SISWA */}
                      <div>

                        <div className="flex items-center gap-2.5">

                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[8px] bg-[#E7D3A8] text-[#7A5A20]">

                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                            >
                              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />

                              <circle
                                cx="9"
                                cy="7"
                                r="4"
                              />

                              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />

                              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>

                          </div>


                          <div>

                            <div className="text-[10px] uppercase tracking-[0.04em] text-[#8A8C94]">
                              Jumlah siswa
                            </div>

                            <div className="mt-0.5 font-['Fraunces',serif] text-[20px] font-semibold leading-tight text-[#141C30]">
                              {kelas.jumlah_siswa} siswa
                            </div>

                          </div>

                        </div>

                      </div>


                      {/* JUMLAH JADWAL */}
                      <div>

                        <div className="flex items-center gap-2.5">

                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[8px] bg-[#E7ECF4] text-[#1E2A47]">

                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                            >
                              <rect
                                x="3"
                                y="4"
                                width="18"
                                height="17"
                                rx="2"
                              />

                              <path d="M16 2v4" />

                              <path d="M8 2v4" />

                              <path d="M3 10h18" />
                            </svg>

                          </div>


                          <div>

                            <div className="text-[10px] uppercase tracking-[0.04em] text-[#8A8C94]">
                              Jumlah jadwal
                            </div>

                            <div className="mt-0.5 font-['Fraunces',serif] text-[20px] font-semibold leading-tight text-[#141C30]">
                              {kelas.jumlah_jadwal} jadwal
                            </div>

                          </div>

                        </div>

                      </div>

                    </div>


                    {/* =========================================
                        MATA PELAJARAN
                    ========================================== */}
                    <div className="mt-6 border-t border-[#E3DACB] pt-4">

                      <div className="text-[10px] uppercase tracking-[0.05em] text-[#8A8C94]">
                        Mata pelajaran
                      </div>


                      <div className="mt-1.5 flex items-center gap-2">

                        {kelas.mata_pelajaran.length > 0 ? (

                          <>
                            <span className="text-[14px] font-semibold text-[#1E2A47]">
                              {mataPelajaranUtama}
                            </span>

                            {jumlahMapelLainnya > 0 && (
                              <span className="text-[11px] text-[#6B7080]">
                                +{jumlahMapelLainnya} lainnya
                              </span>
                            )}
                          </>

                        ) : (

                          <span className="text-[12px] text-[#6B7080]">
                            Belum ada mata pelajaran
                          </span>

                        )}

                      </div>

                    </div>


                    {/* =========================================
                        FOOTER / ACTION
                    ========================================== */}
                    <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#E3DACB] pt-4">

                      <div className="flex items-center text-[11px] text-[#8A8C94]"></div>

                      <div className="flex items-center gap-2">

                        {/* DETAIL */}
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedClass(
                              kelas
                            )
                          }
                          className="rounded-[9px] border border-[#E3DACB] bg-[#FFFDF8] px-3 py-2 text-[11.5px] font-semibold text-[#1E2A47] transition hover:bg-[#F5F1E9]"
                        >
                          Lihat kelas
                        </button>


                        {/* ARSIP */}
                        {!kelas.archived && (
                          <button
                            type="button"
                            onClick={() =>
                              setArchiveTarget(
                                kelas
                              )
                            }
                            className="inline-flex items-center gap-1.5 rounded-[9px] border border-[#E3DACB] bg-[#FFFDF8] px-3 py-2 text-[11.5px] font-semibold text-[#6B7080] transition hover:border-[#E8B8AA] hover:bg-[#FFF4F0] hover:text-[#B94A48]"
                          >

                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                            >
                              <path d="M3 6h18" />

                              <path d="M5 6l1 15h12l1-15" />

                              <path d="M9 6V3h6v3" />

                              <path d="M9 11h6" />
                            </svg>

                            Arsip

                          </button>
                        )}


                        {/* PULIHKAN */}
                        {kelas.archived && (
                          <button
                            type="button"
                            onClick={() =>
                              setRestoreTarget(
                                kelas
                              )
                            }
                            className="inline-flex items-center gap-1.5 rounded-[9px] border border-[#BFD6C5] bg-[#F2F8F3] px-3 py-2 text-[11.5px] font-semibold text-[#4C7A5E] transition hover:bg-[#E7F0EA]"
                          >

                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                            >
                              <path d="M3 12a9 9 0 1 0 3-6.7" />

                              <path d="M3 4v6h6" />
                            </svg>

                            Pulihkan

                          </button>
                        )}

                      </div>

                    </div>

                  </div>
                );
              }
            )}

          </div>

        )}

      </div>


      {/* =======================================================
          MODAL DETAIL KELAS
      ======================================================== */}
      {selectedClass && (

        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#141C30]/40 px-4 backdrop-blur-[2px]"
          onClick={() =>
            setSelectedClass(null)
          }
        >

          <div
            className="max-h-[85vh] w-full max-w-[680px] overflow-hidden rounded-[16px] border border-[#E3DACB] bg-[#FFFDF8] shadow-[0_20px_60px_-20px_rgba(20,28,48,0.35)]"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            {/* HEADER */}
            <div className="flex items-start justify-between border-b border-[#E3DACB] px-5 py-4">

              <div>

                <div className="text-[11px] uppercase tracking-[0.08em] text-[#8A8C94]">
                  Detail kelas
                </div>

                <h2 className="mt-0.5 font-['Fraunces',serif] text-[22px] font-semibold text-[#141C30]">
                  {selectedClass.nama}
                </h2>

                <div className="mt-1 text-[12px] text-[#6B7080]">

                  {selectedClass.mata_pelajaran.length > 0
                    ? selectedClass.mata_pelajaran.join(
                        ' • '
                      )
                    : 'Belum ada mata pelajaran'}

                </div>

              </div>


              <button
                type="button"
                onClick={() =>
                  setSelectedClass(null)
                }
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#6B7080] hover:bg-[#F5F1E9]"
              >
                ✕
              </button>

            </div>


            {/* CONTENT */}
            <div className="max-h-[calc(85vh-80px)] overflow-y-auto p-5">

              {/* SUMMARY */}
              <div className="grid grid-cols-2 gap-3">

                <div className="rounded-[11px] border border-[#E3DACB] bg-[#F8F6F1] p-3.5">

                  <div className="text-[10px] uppercase tracking-[0.05em] text-[#8A8C94]">
                    Jumlah siswa
                  </div>

                  <div className="mt-1 font-['Fraunces',serif] text-[22px] font-semibold text-[#141C30]">
                    {selectedClass.jumlah_siswa} siswa
                  </div>

                </div>


                <div className="rounded-[11px] border border-[#E3DACB] bg-[#F8F6F1] p-3.5">

                  <div className="text-[10px] uppercase tracking-[0.05em] text-[#8A8C94]">
                    Jumlah jadwal
                  </div>

                  <div className="mt-1 font-['Fraunces',serif] text-[22px] font-semibold text-[#141C30]">
                    {selectedClass.jumlah_jadwal} jadwal
                  </div>

                </div>

              </div>


              {/* MATA PELAJARAN */}
              <div className="mt-6">

                <div className="mb-2.5 flex items-center justify-between">

                  <h3 className="font-['Fraunces',serif] text-[17px] font-semibold text-[#141C30]">
                    Mata pelajaran
                  </h3>

                  <span className="text-[11px] text-[#6B7080]">
                    {selectedClass.mata_pelajaran.length}{' '}
                    mata pelajaran
                  </span>

                </div>


                {selectedClass.mata_pelajaran.length === 0 ? (

                  <div className="rounded-[11px] border border-dashed border-[#E3DACB] px-4 py-6 text-center text-[12px] text-[#6B7080]">
                    Belum ada mata pelajaran.
                  </div>

                ) : (

                  <div className="flex flex-wrap gap-2">

                    {selectedClass.mata_pelajaran.map(
                      (mapel) => (

                        <div
                          key={mapel}
                          className="rounded-[10px] bg-[#E7ECF4] px-3 py-2 text-[12px] font-semibold text-[#1E2A47]"
                        >
                          {mapel}
                        </div>

                      )
                    )}

                  </div>

                )}

              </div>


              {/* JADWAL */}
              <div className="mt-6">

                <div className="mb-2.5 flex items-center justify-between">

                  <h3 className="font-['Fraunces',serif] text-[17px] font-semibold text-[#141C30]">
                    Jadwal mengajar
                  </h3>

                  <span className="text-[11px] text-[#6B7080]">
                    {selectedClass.jadwal.length}{' '}
                    jadwal
                  </span>

                </div>


                {selectedClass.jadwal.length === 0 ? (

                  <div className="rounded-[11px] border border-dashed border-[#E3DACB] px-4 py-6 text-center text-[12px] text-[#6B7080]">
                    Belum ada jadwal.
                  </div>

                ) : (

                  <div className="space-y-2">

                    {selectedClass.jadwal.map(
                      (jadwal) => (

                        <div
                          key={jadwal.id}
                          className="flex items-center justify-between gap-3 rounded-[10px] border border-[#E3DACB] bg-[#FFFDF8] px-3.5 py-3"
                        >

                          <div>

                            <div className="font-semibold text-[12.5px] text-[#1E2A47]">
                              {jadwal.hari}
                            </div>

                            <div className="mt-0.5 text-[11.5px] text-[#6B7080]">
                              {jadwal.waktu}
                            </div>

                          </div>


                          <div className="rounded-full bg-[#E7ECF4] px-2.5 py-1 text-[10.5px] font-semibold text-[#1E2A47]">
                            {jadwal.mata_pelajaran}
                          </div>

                        </div>

                      )
                    )}

                  </div>

                )}

              </div>


              {/* SISWA */}
              <div className="mt-6">

                <div className="mb-2.5 flex items-center justify-between">

                  <h3 className="font-['Fraunces',serif] text-[17px] font-semibold text-[#141C30]">
                    Siswa
                  </h3>

                  <span className="text-[11px] text-[#6B7080]">
                    {selectedClass.siswa.length}{' '}
                    siswa
                  </span>

                </div>


                {selectedClass.siswa.length === 0 ? (

                  <div className="rounded-[11px] border border-dashed border-[#E3DACB] px-4 py-6 text-center text-[12px] text-[#6B7080]">
                    Belum ada siswa di kelas ini.
                  </div>

                ) : (

                  <div className="max-h-[240px] overflow-y-auto rounded-[11px] border border-[#E3DACB]">

                    {selectedClass.siswa.map(
                      (siswa, index) => (

                        <div
                          key={siswa.id}
                          className={`flex items-center gap-3 px-3.5 py-3 ${
                            index !==
                            selectedClass
                              .siswa
                              .length -
                              1
                              ? 'border-b border-[#E3DACB]'
                              : ''
                          }`}
                        >

                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#E7D3A8] text-[10px] font-bold text-[#7A5A20]">
                            {getInitials(
                              siswa.nama
                            )}
                          </div>


                          <div className="min-w-0">

                            <div className="truncate text-[12.5px] font-semibold text-[#1E2A47]">
                              {siswa.nama}
                            </div>

                            <div className="truncate text-[11px] text-[#6B7080]">
                              {siswa.email}
                            </div>

                          </div>

                        </div>

                      )
                    )}

                  </div>

                )}

              </div>

            </div>

          </div>

        </div>

      )}


      {/* =======================================================
          MODAL KONFIRMASI ARSIP
      ======================================================== */}
      {archiveTarget && (

        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#141C30]/45 px-4 backdrop-blur-[2px]"
          onClick={() =>
            !processingArchive &&
            setArchiveTarget(null)
          }
        >

          <div
            className="w-full max-w-[420px] rounded-[16px] border border-[#E3DACB] bg-[#FFFDF8] p-6 shadow-[0_20px_60px_-20px_rgba(20,28,48,0.35)]"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            <div className="flex h-11 w-11 items-center justify-center rounded-[11px] bg-[#FFF0EC] text-[#B94A48]">

              <svg
                width="21"
                height="21"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M3 6h18" />
                <path d="M5 6l1 15h12l1-15" />
                <path d="M9 6V3h6v3" />
                <path d="M9 11h6" />
              </svg>

            </div>


            <h2 className="mt-4 font-['Fraunces',serif] text-[20px] font-semibold text-[#141C30]">
              Arsipkan kelas?
            </h2>


            <p className="mt-2 text-[13px] leading-6 text-[#6B7080]">

              Apakah Anda yakin ingin
              mengarsipkan kelas{' '}

              <span className="font-semibold text-[#1E2A47]">
                {archiveTarget.nama}
              </span>
              ?

            </p>


            <p className="mt-2 text-[12px] leading-5 text-[#8A8C94]">
              Kelas tidak akan dihapus.
              Data kelas dan riwayat
              pembelajaran tetap tersimpan.
            </p>


            <div className="mt-6 flex justify-end gap-2.5">

              <button
                type="button"
                disabled={
                  processingArchive
                }
                onClick={() =>
                  setArchiveTarget(null)
                }
                className="rounded-[9px] border border-[#E3DACB] bg-[#FFFDF8] px-4 py-2.5 text-[12px] font-semibold text-[#6B7080] transition hover:bg-[#F5F1E9] disabled:opacity-50"
              >
                Batal
              </button>


              <button
                type="button"
                disabled={
                  processingArchive
                }
                onClick={
                  handleArchiveClass
                }
                className="rounded-[9px] bg-[#B94A48] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#9F3F3D] disabled:cursor-not-allowed disabled:opacity-50"
              >

                {processingArchive
                  ? 'Mengarsipkan...'
                  : 'Ya, arsipkan'}

              </button>

            </div>

          </div>

        </div>

      )}


      {/* =======================================================
          MODAL KONFIRMASI PULIHKAN
      ======================================================== */}
      {restoreTarget && (

        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#141C30]/45 px-4 backdrop-blur-[2px]"
          onClick={() =>
            !processingArchive &&
            setRestoreTarget(null)
          }
        >

          <div
            className="w-full max-w-[420px] rounded-[16px] border border-[#E3DACB] bg-[#FFFDF8] p-6 shadow-[0_20px_60px_-20px_rgba(20,28,48,0.35)]"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            <div className="flex h-11 w-11 items-center justify-center rounded-[11px] bg-[#E7F0EA] text-[#4C7A5E]">

              <svg
                width="21"
                height="21"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M3 12a9 9 0 1 0 3-6.7" />
                <path d="M3 4v6h6" />
              </svg>

            </div>


            <h2 className="mt-4 font-['Fraunces',serif] text-[20px] font-semibold text-[#141C30]">
              Pulihkan kelas?
            </h2>


            <p className="mt-2 text-[13px] leading-6 text-[#6B7080]">

              Pulihkan kelas{' '}

              <span className="font-semibold text-[#1E2A47]">
                {restoreTarget.nama}
              </span>{' '}

              agar kembali muncul
              pada daftar kelas aktif?

            </p>


            <div className="mt-6 flex justify-end gap-2.5">

              <button
                type="button"
                disabled={
                  processingArchive
                }
                onClick={() =>
                  setRestoreTarget(null)
                }
                className="rounded-[9px] border border-[#E3DACB] bg-[#FFFDF8] px-4 py-2.5 text-[12px] font-semibold text-[#6B7080] transition hover:bg-[#F5F1E9] disabled:opacity-50"
              >
                Batal
              </button>


              <button
                type="button"
                disabled={
                  processingArchive
                }
                onClick={
                  handleRestoreClass
                }
                className="rounded-[9px] bg-[#4C7A5E] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#3E674D] disabled:cursor-not-allowed disabled:opacity-50"
              >

                {processingArchive
                  ? 'Memulihkan...'
                  : 'Ya, pulihkan'}

              </button>

            </div>

          </div>

        </div>

      )}

    </KelasSayaLayout>
  );
}