<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Assignment;
use App\Models\Attendance;
use App\Models\Journal;
use App\Models\Schedule;
use App\Models\User;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function guru(Request $request)
    {
        $user = $request->user();

        if ($user->role !== 'guru') {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak.',
            ], 403);
        }

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
         * DATA GURU
         * ==========================================
         */
        $mataPelajaran = $teacher->subjects
            ->pluck('name')
            ->join(', ');

        /*
         * ==========================================
         * JADWAL HARI INI
         * ==========================================
         */
        $hariIni = now()->locale('id')->translatedFormat('l');

        $jadwalHariIni = Schedule::with([
            'classroom',
            'subject',
            'journals',
        ])
            ->where('teacher_id', $teacher->id)
            ->whereRaw('LOWER(day) = LOWER(?)', [$hariIni])
            ->orderBy('start_time')
            ->get();

        /*
         * ==========================================
         * KELAS YANG DIAJAR
         * ==========================================
         */
        $kelasDiajar = Schedule::where('teacher_id', $teacher->id)
            ->distinct('classroom_id')
            ->count('classroom_id');

        /*
         * ==========================================
         * TOTAL SISWA
         * ==========================================
         */
        $classroomIds = Schedule::where('teacher_id', $teacher->id)
            ->pluck('classroom_id')
            ->unique();

        $totalSiswa = 0;

        if ($classroomIds->isNotEmpty()) {
            $totalSiswa = User::where('role', 'siswa')
                ->whereHas('classrooms', function ($query) use ($classroomIds) {
                    $query->whereIn(
                        'classrooms.id',
                        $classroomIds
                    );
                })
                ->count();
        }

        /*
         * ==========================================
         * FORMAT JADWAL HARI INI
         * ==========================================
         */
        $jadwalData = $jadwalHariIni
            ->values()
            ->map(function ($schedule, $index) {
                $now = now();

                $start = $schedule->start_time
                    ? now()->setTimeFromTimeString(
                        $schedule->start_time
                    )
                    : null;

                $end = $schedule->end_time
                    ? now()->setTimeFromTimeString(
                        $schedule->end_time
                    )
                    : null;

                $status = 'belum';

                if ($start && $end) {
                    if ($now->between($start, $end)) {
                        $status = 'berlangsung';
                    } elseif ($now->greaterThan($end)) {
                        $status = 'selesai';
                    }
                }

                $jurnalHariIni = $schedule->journals
                    ->first(function ($journal) {
                        return $journal->date?->isToday();
                    });

                return [
                    'id' => $schedule->id,
                    'jam_ke' => $index + 1,

                    'waktu' => $schedule->start_time
                        && $schedule->end_time
                        ? substr($schedule->start_time, 0, 5)
                            . ' - '
                            . substr($schedule->end_time, 0, 5)
                        : '-',

                    'kelas' => $schedule->classroom?->name ?? '-',

                    'topik' => $jurnalHariIni?->topic
                        ?? 'Belum ada topik',

                    'status' => $status,
                ];
            });

        /*
         * ==========================================
         * JURNAL TERBARU
         * ==========================================
         */
        $jurnalTerbaru = Journal::with([
            'schedule.classroom',
            'schedule.subject',
        ])
            ->whereHas('schedule', function ($query) use ($teacher) {
                $query->where('teacher_id', $teacher->id);
            })
            ->latest('date')
            ->latest('id')
            ->limit(5)
            ->get()
            ->map(function ($journal) {
                return [
                    'id' => $journal->id,

                    'tanggal' => $journal->date
                        ? $journal->date->translatedFormat('d M Y')
                        : '-',

                    'kelas_mapel' => (
                        $journal->schedule?->classroom?->name
                        ?? '-'
                    )
                        . ' · '
                        . (
                            $journal->schedule?->subject?->name
                            ?? '-'
                        ),

                    'topik' => $journal->topic ?? '-',

                    'meta' => $journal->description ?? '-',

                    'status' => 'terisi',
                ];
            });

        /*
         * ==========================================
         * TUGAS MENUNGGU DINILAI
         * ==========================================
         */
        $tugasMenunggu = Assignment::with([
            'schedule.classroom',
            'submissions',
        ])
            ->whereHas('schedule', function ($query) use ($teacher) {
                $query->where('teacher_id', $teacher->id);
            })
            ->whereHas('submissions', function ($query) {
                $query->whereNull('grade');
            })
            ->latest('due_date')
            ->limit(5)
            ->get()
            ->map(function ($assignment) {
                $submissionBelumDinilai = $assignment->submissions
                    ->whereNull('grade')
                    ->count();

                return [
                    'id' => $assignment->id,
                    'judul' => $assignment->title,
                    'kelas' => $assignment->schedule?->classroom?->name
                        ?? '-',
                    'terkumpul' => $submissionBelumDinilai,
                ];
            });

        /*
         * ==========================================
         * KEHADIRAN HARI INI
         * ==========================================
         */
        $jadwalIdsHariIni = $jadwalHariIni->pluck('id');

        $kehadiranHariIni = '0%';

        if ($jadwalIdsHariIni->isNotEmpty()) {
            $totalAbsensi = Attendance::whereIn(
                'schedule_id',
                $jadwalIdsHariIni
            )
                ->whereDate('date', today())
                ->count();

            $totalHadir = Attendance::whereIn(
                'schedule_id',
                $jadwalIdsHariIni
            )
                ->whereDate('date', today())
                ->where('status', 'hadir')
                ->count();

            if ($totalAbsensi > 0) {
                $persentase = round(
                    ($totalHadir / $totalAbsensi) * 100
                );

                $kehadiranHariIni = $persentase . '%';
            }
        }

        /*
         * ==========================================
         * RATA-RATA NILAI PER KELAS
         * ==========================================
         *
         * Hanya mengambil submission yang:
         * 1. Berasal dari assignment milik guru ini
         * 2. Sudah memiliki nilai
         *
         * Relasi:
         *
         * Submission
         *      ↓
         * Assignment
         *      ↓
         * Schedule
         *      ↓
         * Classroom
         */
        $rataRataKelas = \App\Models\Submission::with([
            'assignment.schedule.classroom',
        ])
            ->whereNotNull('grade')
            ->whereHas('assignment.schedule', function ($query) use ($teacher) {
                $query->where('teacher_id', $teacher->id);
            })
            ->get()
            ->groupBy(function ($submission) {
                return $submission
                    ->assignment
                    ?->schedule
                    ?->classroom
                    ?->name ?? '-';
            })
            ->map(function ($submissions, $kelas) {
                return [
                    'kelas' => $kelas,
                    'nilai' => round(
                        $submissions->avg('grade'),
                        2
                    ),
                ];
            })
            ->values();

        /*
         * ==========================================
         * RESPONSE
         * ==========================================
         */
        return response()->json([
            'success' => true,

            'data' => [
                'guru' => [
                    'nama' => $user->name,
                    'mata_pelajaran' => $mataPelajaran
                        ?: 'Guru Mata Pelajaran',
                ],

                'statistik' => [
                    'kelas_diajar' => $kelasDiajar,
                    'total_siswa' => $totalSiswa,
                    'tugas_menunggu' => $tugasMenunggu->count(),
                    'kehadiran_hari_ini' => $kehadiranHariIni,
                ],

                'jadwal_hari_ini' => $jadwalData,

                'jurnal_terbaru' => $jurnalTerbaru,

                'tugas_menunggu_dinilai' => $tugasMenunggu,

                'rata_rata_kelas' => $rataRataKelas,
            ],
        ]);
    }
}