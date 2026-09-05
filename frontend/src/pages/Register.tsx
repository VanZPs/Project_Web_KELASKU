import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import logoKesatrian from '../assets/Logo-Kesatrian.jpeg';
import fotoGedung from '../assets/Foto-Gedung.png';

interface Option {
  id: number;
  name: string;
}

interface RegisterErrorResponse {
  message?: string;
  errors?: Record<string, string[]>;
}

export default function Register() {
  const [role, setRole] = useState<'guru' | 'siswa'>('guru');

  const [name, setName] = useState('');
  const [nipy, setNipy] = useState('');
  const [email, setEmail] = useState('');

  const [subjects, setSubjects] = useState<Option[]>([]);
  const [classrooms, setClassrooms] = useState<Option[]>([]);

  const [selectedSubject, setSelectedSubject] = useState<Option | null>(null);
  const [selectedClassroom, setSelectedClassroom] = useState<Option | null>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);

  const [error, setError] = useState('');

  // State untuk kontrol custom dropdown
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const navigate = useNavigate();

  /**
   * Mengambil data mata pelajaran dan kelas dari backend.
   */
  useEffect(() => {
    const fetchRegisterOptions = async () => {
      try {
        setLoadingOptions(true);
        setError('');

        const [subjectsResponse, classroomsResponse] = await Promise.all([
          api.get('/subjects'),
          api.get('/classrooms'),
        ]);

        const subjectData: Option[] = subjectsResponse.data.data ?? [];
        const classroomData: Option[] = classroomsResponse.data.data ?? [];

        setSubjects(subjectData);
        setClassrooms(classroomData);

        // Pilihan awal untuk guru
        if (subjectData.length > 0) {
          setSelectedSubject(subjectData[0]);
        }

        // Pilihan awal untuk siswa
        if (classroomData.length > 0) {
          setSelectedClassroom(classroomData[0]);
        }
      } catch (err: unknown) {
        console.error('Gagal mengambil data register:', err);

        setError(
          'Gagal memuat daftar mata pelajaran dan kelas. Pastikan backend Laravel sedang berjalan.'
        );
      } finally {
        setLoadingOptions(false);
      }
    };

    fetchRegisterOptions();
  }, []);

  /**
   * Menutup dropdown ketika user klik di luar dropdown.
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  /**
   * Mengubah role Guru / Siswa.
   */
  const handleRoleChange = (newRole: 'guru' | 'siswa') => {
    if (role !== newRole) {
      setRole(newRole);
      setIsOpen(false);
      setError('');
    }
  };

  /**
   * Mengambil pilihan dropdown sesuai role.
   */
  const currentOptions = role === 'guru' ? subjects : classrooms;

  /**
   * Mengambil pilihan yang sedang aktif.
   */
  const currentSelection =
    role === 'guru' ? selectedSubject : selectedClassroom;

  /**
   * Memilih item pada dropdown.
   */
  const handleOptionSelect = (option: Option) => {
    if (role === 'guru') {
      setSelectedSubject(option);
    } else {
      setSelectedClassroom(option);
    }

    setIsOpen(false);
    setError('');
  };

  /**
   * Mengecek kekuatan password.
   */
  const getPasswordStrength = () => {
    if (password.length === 0) return '';

    if (password.length < 8) return 'weak';
    if (password.length < 12) return 'medium';

    return 'strong';
  };

  const strength = getPasswordStrength();

  const isPasswordFilled = confirmPassword.length > 0;

  const isPasswordMatch =
    isPasswordFilled && password === confirmPassword;

  /**
   * Mengambil pesan error dari response Laravel.
   */
  const getErrorMessage = (err: unknown): string => {
    const response = (
      err as {
        response?: {
          data?: RegisterErrorResponse;
        };
      }
    )?.response?.data;

    if (response?.errors) {
      const firstError = Object.values(response.errors)[0]?.[0];

      if (firstError) {
        return firstError;
      }
    }

    if (response?.message) {
      return response.message;
    }

    return 'Gagal mendaftar. Silakan coba lagi.';
  };

  /**
   * Proses registrasi.
   */
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    setError('');

    if (!agreed) {
      setError(
        'Anda harus men-checklist persetujuan Ketentuan Penggunaan dan Kebijakan Privasi terlebih dahulu.'
      );

      return;
    }

    if (password !== confirmPassword) {
      setError('Kata sandi tidak cocok.');

      return;
    }

    if (password.length < 8) {
      setError('Kata sandi minimal 8 karakter.');

      return;
    }

    if (role === 'guru' && !selectedSubject) {
      setError('Silakan pilih mata pelajaran terlebih dahulu.');

      return;
    }

    if (role === 'siswa' && !selectedClassroom) {
      setError('Silakan pilih kelas terlebih dahulu.');

      return;
    }

    setLoading(true);

    try {
      /**
       * Data dasar yang digunakan oleh semua role.
       */
      const registerData: {
        name: string;
        email: string;
        password: string;
        password_confirmation: string;
        role: 'guru' | 'siswa';
        nipy?: string;
        subject_id?: number;
        classroom_id?: number;
      } = {
        name,
        email,
        password,
        password_confirmation: confirmPassword,
        role,
      };

      /**
       * Data khusus Guru.
       */
      if (role === 'guru') {
        registerData.nipy = nipy;
        registerData.subject_id = selectedSubject!.id;
      }

      /**
       * Data khusus Siswa.
       */
      if (role === 'siswa') {
        registerData.classroom_id = selectedClassroom!.id;
      }

      const response = await api.post('/register', registerData);

      if (response.data.success) {
        const { data: user, token } = response.data;

        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));

        navigate(
          user.role === 'guru' ? '/guru' : '/siswa',
          { replace: true }
        );
      }
    } catch (err: unknown) {
      console.error('Register error:', err);

      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F1E7] text-[#23283A] p-7 font-['Plus_Jakarta_Sans',sans-serif] antialiased animate-fade-only">
      <style>{`
        @keyframes fadeInOnly {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .animate-fade-only {
          animation: fadeInOnly 0.35s ease-in-out forwards;
        }
      `}</style>

      <div className="w-full max-w-[1040px] min-h-[680px] bg-[#FFFDF8] rounded-[22px] overflow-hidden grid grid-cols-1 md:grid-cols-[0.85fr_1.15fr] shadow-[0_1px_2px_rgba(30,25,15,0.04),0_20px_44px_-20px_rgba(20,17,10,0.28)]">

        {/* ===== LEFT: brand panel ===== */}
        <div
          className="hidden md:flex flex-col justify-between p-[44px_38px] relative text-[#EDEFF5] bg-cover bg-center"
          style={{
            backgroundImage: `linear-gradient(135deg, rgba(20, 28, 48, 0.78) 0%, rgba(30, 42, 71, 0.75) 50%, rgba(20, 28, 48, 0.82) 100%), url(${fotoGedung})`
          }}
        >
          <div className="flex items-center gap-[13px] relative z-10">
            <div className="w-[50px] h-[50px] rounded-full bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-sm border border-white/20">
              <img
                src={logoKesatrian}
                alt="Logo SMA Kesatrian 1 Semarang"
                className="w-full h-full object-cover"
              />
            </div>

            <div>
              <div className="font-['Fraunces',serif] font-semibold text-[20px] text-white leading-[1.1]">
                KELASKU
              </div>

              <div className="text-[11.5px] text-[#D0D9EE] mt-0.5">
                SMA Kesatrian 1 Semarang
              </div>
            </div>
          </div>

          <div className="max-w-[300px] relative z-10">
            <div className="text-[13px] text-[#F3E2BD] mb-3 font-medium">
              Aktivasi akun
            </div>

            <h1 className="font-['Fraunces',serif] font-semibold text-[28px] leading-[1.25] text-white tracking-[-0.01em]">
              Buat akun resmi untuk civitas sekolah.
            </h1>

            <div className="flex flex-col gap-[18px] mt-[30px]">
              <div className="flex gap-3 items-start">
                <div className="w-[26px] h-[26px] rounded-lg bg-white/10 border border-white/15 flex items-center justify-center font-['Fraunces',serif] font-semibold text-[12.5px] text-[#F3E2BD] shrink-0">
                  1
                </div>

                <div>
                  <div className="text-[13.5px] font-semibold text-white">
                    Lengkapi data diri
                  </div>

                  <div className="text-[12px] text-[#D0D9EE] mt-0.5 leading-[1.5]">
                    Isi identitas dan buat kata sandi baru.
                  </div>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <div className="w-[26px] h-[26px] rounded-lg bg-white/10 border border-white/15 flex items-center justify-center font-['Fraunces',serif] font-semibold text-[12.5px] text-[#F3E2BD] shrink-0">
                  2
                </div>

                <div>
                  <div className="text-[13.5px] font-semibold text-white">
                    Langsung bisa dipakai
                  </div>

                  <div className="text-[12px] text-[#D0D9EE] mt-0.5 leading-[1.5]">
                    Akun aktif dan siap untuk masuk ke KELASKU.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="text-[12px] text-[#D0D9EE] border-t border-white/20 pt-[18px] leading-[1.6] relative z-10">
            Ada kendala saat mendaftar? Hubungi bagian tata usaha di sekolah.
          </div>
        </div>

        {/* ===== RIGHT: form panel ===== */}
        <div className="flex flex-col justify-center p-9 md:p-[40px_46px_32px] max-h-screen overflow-y-auto">

          <div className="mb-5">
            <h2 className="font-['Fraunces',serif] font-semibold text-[23px] text-[#141C30] tracking-[-0.01em] m-0">
              Daftar akun baru
            </h2>

            <p className="text-[13.5px] text-[#6B7080] mt-1.5">
              Sudah punya akun?{' '}
              <Link
                to="/login"
                className="text-[#1E2A47] font-semibold hover:underline"
              >
                Masuk di sini
              </Link>
            </p>
          </div>

          {/* Role */}
          <div className="flex bg-[#EFEADB] rounded-[11px] p-1 mb-5">
            <button
              type="button"
              className={`flex-1 py-[9px] rounded-lg text-[13.5px] font-semibold transition-all duration-200 ${
                role === 'guru'
                  ? 'bg-[#FFFDF8] text-[#141C30] shadow-sm scale-[1.02]'
                  : 'text-[#6B7080] hover:text-[#141C30]'
              }`}
              onClick={() => handleRoleChange('guru')}
            >
              Guru
            </button>

            <button
              type="button"
              className={`flex-1 py-[9px] rounded-lg text-[13.5px] font-semibold transition-all duration-200 ${
                role === 'siswa'
                  ? 'bg-[#FFFDF8] text-[#141C30] shadow-sm scale-[1.02]'
                  : 'text-[#6B7080] hover:text-[#141C30]'
              }`}
              onClick={() => handleRoleChange('siswa')}
            >
              Siswa
            </button>
          </div>

          {/* Information */}
          <div className="flex items-start gap-2.5 bg-[#E7F0EA] border border-[#C7DBCC] rounded-[10px] p-[11px_13px] mb-[18px] text-[12px] text-[#33553F] leading-[1.55]">
            <svg
              className="shrink-0 mt-px text-[#4C7A5E]"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M9 12l2 2 4-4" />
              <circle cx="12" cy="12" r="10" />
            </svg>

            <span>
              Pendaftaran hanya untuk civitas SMA Kesatrian 1 Semarang.
              Gunakan email sekolah yang aktif.
            </span>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 text-[12.5px] text-[#AE5A3E] bg-[#F9EBE8] border border-[#EAC4BD] rounded-[10px] p-3 mb-4 leading-[1.5] animate-fade-only">
              <svg
                className="shrink-0 mt-0.5"
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>

              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleRegister}>
            <div key={role} className="animate-fade-only">

              {/* Nama + NIPY / Email */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mb-3.5">

                {/* Nama */}
                <div>
                  <label className="block text-[12.5px] font-semibold text-[#23283A] mb-1.5">
                    Nama lengkap
                  </label>

                  <div className="flex items-center gap-[9px] border border-[#E3DACB] rounded-[10px] px-3 bg-[#FFFDF8] focus-within:border-[#2C3B5E] transition-all">
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      required
                      placeholder="Sesuai data sekolah"
                      className="w-full py-2.5 border-none outline-none bg-transparent text-[13.5px] placeholder-[#B3AE9C]"
                    />
                  </div>
                </div>

                {/* NIPY untuk Guru / Email untuk Siswa */}
                <div>
                  {role === 'guru' ? (
                    <div>
                      <label className="block text-[12.5px] font-semibold text-[#23283A] mb-1.5">
                        NIPY
                      </label>

                      <div className="flex items-center gap-[9px] border border-[#E3DACB] rounded-[10px] px-3 bg-[#FFFDF8] focus-within:border-[#2C3B5E] transition-all">
                        <input
                          type="text"
                          value={nipy}
                          onChange={e => setNipy(e.target.value)}
                          required
                          placeholder="Masukkan NIPY"
                          className="w-full py-2.5 border-none outline-none bg-transparent text-[13.5px] placeholder-[#B3AE9C]"
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[12.5px] font-semibold text-[#23283A] mb-1.5">
                        Email
                      </label>

                      <div className="flex items-center gap-[9px] border border-[#E3DACB] rounded-[10px] px-3 bg-[#FFFDF8] focus-within:border-[#2C3B5E] transition-all">
                        <input
                          type="email"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          required
                          placeholder="Masukkan email"
                          className="w-full py-2.5 border-none outline-none bg-transparent text-[13.5px] placeholder-[#B3AE9C]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Subject/Class + Email */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mb-3.5">

                {/* Dropdown */}
                <div
                  className="relative"
                  ref={dropdownRef}
                >
                  <label className="block text-[12.5px] font-semibold text-[#23283A] mb-1.5">
                    {role === 'guru' ? 'Mata pelajaran' : 'Kelas'}
                  </label>

                  <div
                    onClick={() => {
                      if (!loadingOptions && currentOptions.length > 0) {
                        setIsOpen(!isOpen);
                      }
                    }}
                    className={`w-full py-2.5 px-3 border border-[#E3DACB] rounded-[10px] bg-[#FFFDF8] text-[13.5px] text-[#23283A] flex items-center justify-between select-none transition-all ${
                      loadingOptions || currentOptions.length === 0
                        ? 'cursor-not-allowed opacity-60'
                        : 'cursor-pointer hover:border-[#2C3B5E]'
                    }`}
                  >
                    <span>
                      {loadingOptions
                        ? 'Memuat data...'
                        : currentSelection?.name ?? 'Pilih'}
                    </span>

                    <svg
                      className={`w-4 h-4 text-[#6B7080] transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      viewBox="0 0 24 24"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>

                  {isOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-[#FFFDF8] border border-[#E3DACB] rounded-[10px] shadow-lg z-50 max-h-[210px] overflow-y-auto animate-fade-only">
                      {currentOptions.map((option) => (
                        <div
                          key={option.id}
                          onClick={() => handleOptionSelect(option)}
                          className={`py-2 px-3 text-[13.5px] cursor-pointer transition-colors ${
                            currentSelection?.id === option.id
                              ? 'bg-[#1E2A47] text-white font-medium'
                              : 'text-[#23283A] hover:bg-[#F5F1E7]'
                          }`}
                        >
                          {option.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Email Guru */}
                <div>
                  {role === 'guru' && (
                    <div>
                      <label className="block text-[12.5px] font-semibold text-[#23283A] mb-1.5">
                        Email
                      </label>

                      <div className="flex items-center gap-[9px] border border-[#E3DACB] rounded-[10px] px-3 bg-[#FFFDF8] focus-within:border-[#2C3B5E] transition-all">
                        <input
                          type="email"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          required
                          placeholder="Masukkan email"
                          className="w-full py-2.5 border-none outline-none bg-transparent text-[13.5px] placeholder-[#B3AE9C]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Password */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mb-[6px]">

                {/* Password */}
                <div>
                  <label className="block text-[12.5px] font-semibold text-[#23283A] mb-1.5">
                    Kata sandi
                  </label>

                  <div className="flex items-center gap-[9px] border border-[#E3DACB] rounded-[10px] px-3 bg-[#FFFDF8] focus-within:border-[#2C3B5E] transition-all">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      placeholder="Minimal 8 karakter"
                      className="w-full py-2.5 border-none outline-none bg-transparent text-[13.5px] placeholder-[#B3AE9C]"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="shrink-0 flex items-center border-none bg-transparent text-[#6B7080] cursor-pointer"
                      aria-label="Tampilkan kata sandi"
                    >
                      <svg
                        width="17"
                        height="17"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        {showPassword ? (
                          <>
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </>
                        ) : (
                          <>
                            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                            <circle cx="12" cy="12" r="3" />
                          </>
                        )}
                      </svg>
                    </button>
                  </div>

                  {/* Password strength */}
                  <div className="flex gap-1 mt-2">
                    <div
                      className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                        strength
                          ? strength === 'weak'
                            ? 'bg-[#AE5A3E]'
                            : strength === 'medium'
                              ? 'bg-[#B98A3E]'
                              : 'bg-[#4C7A5E]'
                          : 'bg-[#EAE3D0]'
                      }`}
                    />

                    <div
                      className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                        strength === 'medium' || strength === 'strong'
                          ? strength === 'medium'
                            ? 'bg-[#B98A3E]'
                            : 'bg-[#4C7A5E]'
                          : 'bg-[#EAE3D0]'
                      }`}
                    />

                    <div
                      className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                        strength === 'strong'
                          ? 'bg-[#4C7A5E]'
                          : 'bg-[#EAE3D0]'
                      }`}
                    />
                  </div>

                  {password.length > 0 && (
                    <div
                      className={`text-[11.5px] font-semibold mt-1.5 transition-opacity duration-200 ${
                        strength === 'weak'
                          ? 'text-[#AE5A3E]'
                          : strength === 'medium'
                            ? 'text-[#B98A3E]'
                            : 'text-[#4C7A5E]'
                      }`}
                    >
                      {strength === 'weak' && 'Weak'}
                      {strength === 'medium' && 'Medium'}
                      {strength === 'strong' && 'Strong'}
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-[12.5px] font-semibold text-[#23283A] mb-1.5">
                    Konfirmasi kata sandi
                  </label>

                  <div
                    className={`flex items-center gap-[9px] border rounded-[10px] px-3 bg-[#FFFDF8] transition-all ${
                      isPasswordFilled
                        ? isPasswordMatch
                          ? 'border-[#4C7A5E]'
                          : 'border-[#AE5A3E]'
                        : 'border-[#E3DACB] focus-within:border-[#2C3B5E]'
                    }`}
                  >
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      required
                      placeholder="Ulangi kata sandi"
                      className="w-full py-2.5 border-none outline-none bg-transparent text-[13.5px] placeholder-[#B3AE9C]"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      className="shrink-0 flex items-center border-none bg-transparent text-[#6B7080] cursor-pointer"
                      aria-label="Tampilkan konfirmasi kata sandi"
                    >
                      <svg
                        width="17"
                        height="17"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        {showConfirmPassword ? (
                          <>
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </>
                        ) : (
                          <>
                            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                            <circle cx="12" cy="12" r="3" />
                          </>
                        )}
                      </svg>
                    </button>
                  </div>

                  {isPasswordFilled && (
                    <div
                      className={`text-[11.5px] font-semibold mt-1.5 flex items-center gap-1 transition-opacity duration-200 ${
                        isPasswordMatch
                          ? 'text-[#4C7A5E]'
                          : 'text-[#AE5A3E]'
                      }`}
                    >
                      <span>
                        {isPasswordMatch
                          ? 'Kata sandi sudah sesuai'
                          : 'Kata sandi belum sesuai'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Agreement */}
            <label className="flex items-start gap-2.5 text-[12.5px] text-[#6B7080] leading-[1.55] my-[20px] cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={e => {
                  setAgreed(e.target.checked);

                  if (e.target.checked) {
                    setError('');
                  }
                }}
                className="w-[15px] h-[15px] mt-0.5 accent-[#1E2A47] shrink-0"
              />

              <span>
                Saya menyatakan data yang diisi sudah benar dan menyetujui{' '}
                <a
                  href="#"
                  className="text-[#1E2A47] font-semibold hover:underline"
                >
                  Ketentuan Penggunaan
                </a>{' '}
                serta{' '}
                <a
                  href="#"
                  className="text-[#1E2A47] font-semibold hover:underline"
                >
                  Kebijakan Privasi
                </a>{' '}
                KELASKU.
              </span>
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || loadingOptions}
              className={`w-full border-none rounded-[10px] py-3 text-[14.5px] font-bold flex items-center justify-center gap-2 transition-all duration-200 ${
                agreed && !loading && !loadingOptions
                  ? 'bg-[#1E2A47] text-white hover:bg-[#141C30] cursor-pointer shadow-md'
                  : 'bg-[#D1CFCD] text-[#7A7570] cursor-not-allowed'
              }`}
            >
              {loading ? 'Memproses...' : 'Buat akun'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}