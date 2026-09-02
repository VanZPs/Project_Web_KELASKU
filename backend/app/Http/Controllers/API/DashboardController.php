<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function guru(Request $request)
    {
        if ($request->user()->role !== 'guru') {
            return response()->json(['success' => false, 'message' => 'Akses ditolak.'], 403);
        }

        // TODO: Ambil data sebenarnya dari database di sini nantinya.
        // Untuk saat ini, kirimkan data kosong/default.

        $data = [
            'guru' => [
                'nama' => $request->user()->name,
                // Bisa menambahkan relasi ke tabel detail guru (mata pelajaran) nanti
                'mata_pelajaran' => 'Guru Mata Pelajaran' 
            ],
            'statistik' => [
                'kelas_diajar' => 0,
                'total_siswa' => 0,
                'tugas_menunggu' => 0,
                'kehadiran_hari_ini' => '0%'
            ],
            'jadwal_hari_ini' => [],
            'jurnal_terbaru' => [],
            'tugas_menunggu_dinilai' => [],
            'rata_rata_kelas' => []
        ];

        return response()->json([
            'success' => true,
            'data' => $data
        ]);
    }
}