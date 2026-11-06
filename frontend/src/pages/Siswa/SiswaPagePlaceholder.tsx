// import React from 'react';
import { Link } from 'react-router-dom';

export default function SiswaPagePlaceholder({ title }: { title: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F1E7] p-6 font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="max-w-md rounded-2xl border border-[#E3DACB] bg-[#FFFDF8] p-8 text-center shadow-sm">
        <h1 className="font-['Fraunces',serif] text-2xl font-semibold text-[#141C30]">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#6B7080]">Halaman ini belum tersedia. Saat ini dashboard siswa sedang disiapkan sebagai tahap awal pengembangan.</p>
        <Link to="/siswa/dashboard" className="mt-5 inline-flex rounded-lg bg-[#1E2A47] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2C3B5E]">Kembali ke dashboard</Link>
      </div>
    </div>
  );
}
