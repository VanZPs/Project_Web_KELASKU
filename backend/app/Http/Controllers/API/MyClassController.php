<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class MyClassController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $data = [
            'guru' => [
                'nama' => $user->name ?? 'Endah Soelistio',
                'mata_pelajaran' => $user->mata_pelajaran ?? 'Guru Mata Pelajaran',
            ],
            'statistik' => [
                'kelas_diajar' => 0,
                'total_siswa' => 0,
                'rata_rata_kehadiran' => '0%',
                'tugas_menunggu' => 0,
            ],
            'kelas' => [] // Data kelas dikosongkan
        ];

        return response()->json([
            'success' => true,
            'message' => 'Data kelas saya berhasil dikosongkan',
            'data' => $data
        ]);
    }
}