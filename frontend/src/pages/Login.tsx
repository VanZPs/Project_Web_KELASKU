import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import logoKesatrian from '../assets/Logo-Kesatrian.jpeg';
import fotoGedung from '../assets/Foto-Gedung.png';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/login', { email, password });

      if (response.data.success) {
        const { data: user, token } = response.data;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));

        if (rememberMe) {
          localStorage.setItem('saved_email', email);
        } else {
          localStorage.removeItem('saved_email');
        }

        navigate(user.role === 'guru' ? '/guru' : '/siswa', { replace: true });
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Email atau kata sandi salah.');
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

      <div className="w-full max-w-[1040px] min-h-[640px] bg-[#FFFDF8] rounded-[22px] overflow-hidden grid grid-cols-1 md:grid-cols-[0.85fr_1.15fr] shadow-[0_1px_2px_rgba(30,25,15,0.04),0_20px_44px_-20px_rgba(20,17,10,0.28)]">
        
        {/* ===== LEFT: brand panel ===== */}
        <div 
          className="hidden md:flex flex-col justify-between p-[44px_38px] relative text-[#EDEFF5] bg-cover bg-center"
          style={{ 
            backgroundImage: `linear-gradient(135deg, rgba(20, 28, 48, 0.78) 0%, rgba(30, 42, 71, 0.75) 50%, rgba(20, 28, 48, 0.82) 100%), url(${fotoGedung})` 
          }}
        >
          <div className="flex items-center gap-[13px] relative z-10">
            <div className="w-[50px] h-[50px] rounded-full bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-sm border border-white/20">
              <img src={logoKesatrian} alt="Logo SMA Kesatrian 1 Semarang" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="font-['Fraunces',serif] font-semibold text-[20px] text-white leading-[1.1]">KELASKU</div>
              <div className="text-[11.5px] text-[#D0D9EE] mt-0.5">SMA Kesatrian 1 Semarang</div>
            </div>
          </div>

          <div className="max-w-[340px] relative z-10">
            <div className="text-[13px] text-[#F3E2BD] mb-3 font-medium">Ruang kelas digital</div>
            
            <h1 className="font-['Fraunces',serif] font-semibold text-[31px] leading-[1.2] text-white tracking-[-0.01em]">
              Ruang belajar digital untuk guru dan siswa.
            </h1>
            
            <p className="text-[14px] text-[#E0E6F5] mt-[14px] leading-[1.6]">
              Mewujudkan pembelajaran yang lebih teratur, praktis, dan terhubung dengan memudahkan guru dan siswa mengelola berbagai aktivitas pembelajaran secara digital, kapan saja dan di mana saja.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 border-t border-white/20 pt-5 text-center relative z-10">
            <div>
              <div className="font-['Fraunces',serif] font-bold text-[18px] text-white">1</div>
              <div className="text-[11px] text-[#D0D9EE] mt-0.5">Guru aktif</div>
            </div>
            <div>
              <div className="font-['Fraunces',serif] font-bold text-[18px] text-white">1</div>
              <div className="text-[11px] text-[#D0D9EE] mt-0.5">Siswa terdaftar</div>
            </div>
            <div>
              <div className="font-['Fraunces',serif] font-bold text-[18px] text-white">1</div>
              <div className="text-[11px] text-[#D0D9EE] mt-0.5">Kelas berjalan</div>
            </div>
          </div>
        </div>

        {/* ===== RIGHT: form login panel ===== */}
        <div className="flex flex-col justify-center p-9 md:p-[40px_46px_32px]">
          <div className="mb-6">
            <h2 className="font-['Fraunces',serif] font-semibold text-[23px] text-[#141C30] tracking-[-0.01em] m-0">Masuk ke akun kamu</h2>
            <p className="text-[13.5px] text-[#6B7080] mt-1.5">Gunakan akun yang diberikan oleh pihak sekolah.</p>
          </div>

          {error && <div className="text-red-600 text-sm mb-4">{error}</div>}

          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="block text-[12.5px] font-semibold text-[#23283A] mb-1.5">Email</label>
              <div className="flex items-center gap-[9px] border border-[#E3DACB] rounded-[10px] px-3 bg-[#FFFDF8] focus-within:border-[#2C3B5E] transition-all">
                <svg className="text-[#9C9582] shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="Masukkan email" className="w-full py-2.5 border-none outline-none bg-transparent text-[13.5px] placeholder-[#B3AE9C]" />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-[12.5px] font-semibold text-[#23283A] mb-1.5">Kata sandi</label>
              <div className="flex items-center gap-[9px] border border-[#E3DACB] rounded-[10px] px-3 bg-[#FFFDF8] focus-within:border-[#2C3B5E] transition-all">
                <svg className="text-[#9C9582] shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required placeholder="Masukkan kata sandi" className="w-full py-2.5 border-none outline-none bg-transparent text-[13.5px] placeholder-[#B3AE9C]" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="shrink-0 flex items-center border-none bg-transparent text-[#6B7080] cursor-pointer" aria-label="Tampilkan kata sandi">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    {showPassword 
                      ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></> 
                      : <><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></>}
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-[13px] mb-5">
              <label className="flex items-center gap-2 cursor-pointer text-[#6B7080]">
                <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} className="w-[15px] h-[15px] accent-[#1E2A47]" />
                <span>Ingat saya</span>
              </label>
              <a href="#" className="text-[#1E2A47] font-semibold hover:underline">Lupa kata sandi?</a>
            </div>

            <button type="submit" disabled={loading} className="w-full bg-[#1E2A47] text-white border-none rounded-[10px] py-3 text-[14.5px] font-bold flex items-center justify-center gap-2 hover:bg-[#141C30] disabled:opacity-50 cursor-pointer shadow-md">
              {loading ? 'Memproses...' : <>Masuk &rarr;</>}
            </button>
          </form>

          <div className="relative text-center my-5">
            <span className="bg-[#FFFDF8] px-3 text-[12px] text-[#9C9582] relative z-10">atau</span>
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#E3DACB]"></div></div>
          </div>

          <Link to="/register" className="w-full bg-transparent text-[#1E2A47] border border-[#E3DACB] rounded-[10px] py-[11px] text-[14px] font-semibold flex items-center justify-center gap-2 hover:bg-[#F9F6EE] transition-all no-underline">
            <span>Buat akun baru</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
          </Link>

          <div className="text-[11.5px] text-[#9C9582] text-center mt-5 leading-[1.5]">
            Belum bisa masuk? Hubungi admin tata usaha sekolah untuk bantuan akun.
          </div>
        </div>
      </div>
    </div>
  );
}