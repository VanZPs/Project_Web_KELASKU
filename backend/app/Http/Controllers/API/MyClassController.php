<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Classroom;
use Illuminate\Http\Request;

class MyClassController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        /*
         * ==========================================
         * VALIDASI ROLE
         * ==========================================
         */
        if ($user->role !== 'guru') {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak.',
            ], 403);
        }

        /*
         * ==========================================
         * AMBIL PROFIL GURU
         * ==========================================
         */
        $user->load([
            'teacher.subjects',
        ]);

        $teacher = $user->teacher;

        if (!$teacher) {
            return response()->json([
                'success' => false,
                'message' => 'Profil guru tidak ditemukan.',
            ], 404);
        }

        /*
         * ==========================================
         * AMBIL KELAS YANG DIAJAR GURU
         * ==========================================
         *
         * Relasi:
         *
         * Teacher
         *    ↓
         * Schedule
         *    ↓
         * Classroom
         */
        $classroomIds = $teacher->schedules()
            ->pluck('classroom_id')
            ->unique()
            ->values();

        if ($classroomIds->isEmpty()) {
            return response()->json([
                'success' => true,
                'data' => [],
            ]);
        }

        /*
         * ==========================================
         * AMBIL DATA KELAS
         * ==========================================
         */
        $classrooms = Classroom::with([
            'users' => function ($query) {
                $query
                    ->where('role', 'siswa')
                    ->orderBy('name');
            },

            'users.student',

            'schedules' => function ($query) use ($teacher) {
                $query
                    ->where('teacher_id', $teacher->id)
                    ->with([
                        'subject',
                    ])
                    ->orderBy('day')
                    ->orderBy('start_time');
            },
        ])
            ->whereIn('id', $classroomIds)
            ->orderBy('name')
            ->get();

        /*
         * ==========================================
         * FORMAT DATA KELAS
         * ==========================================
         */
        $data = $classrooms->map(function ($classroom) {
            $schedules = $classroom->schedules;

            /*
             * Ambil daftar mata pelajaran dari jadwal
             */
            $mataPelajaran = $schedules
                ->map(function ($schedule) {
                    return $schedule->subject?->name;
                })
                ->filter()
                ->unique()
                ->values();

            /*
             * Daftar siswa
             */
            $siswa = $classroom->users
                ->map(function ($student) {
                    return [
                        'id' => $student->id,
                        'nama' => $student->name,
                        'email' => $student->email,
                    ];
                })
                ->values();

            /*
             * Daftar jadwal
             */
            $jadwal = $schedules
                ->map(function ($schedule) {
                    return [
                        'id' => $schedule->id,
                        'hari' => $schedule->day,
                        'waktu' => $schedule->start_time
                            && $schedule->end_time
                            ? substr($schedule->start_time, 0, 5)
                                . ' - '
                                . substr($schedule->end_time, 0, 5)
                            : '-',
                        'mata_pelajaran' => $schedule->subject?->name
                            ?? '-',
                    ];
                })
                ->values();

            return [
                'id' => $classroom->id,

                'nama' => $classroom->name,

                'jumlah_siswa' => $siswa->count(),

                'mata_pelajaran' => $mataPelajaran,

                'jumlah_jadwal' => $jadwal->count(),

                'siswa' => $siswa,

                'jadwal' => $jadwal,
            ];
        })->values();

        /*
         * ==========================================
         * RESPONSE
         * ==========================================
         */
        return response()->json([
            'success' => true,

            'data' => $data,
        ]);
    }
}