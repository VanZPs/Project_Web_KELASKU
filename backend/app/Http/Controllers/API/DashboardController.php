<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Assignment;
use App\Models\Attendance;
use App\Models\Journal;
use App\Models\Schedule;
use App\Models\Submission;
use App\Models\User;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function guru(Request $request)
    {
        $user = $request->user();

        /*
         * ==========================================================
         * VALIDASI ROLE
         * ==========================================================
         */
        if ($user->role !== 'guru') {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak.',
            ], 403);
        }

        /*
         * ==========================================================
         * DATA GURU
         * ==========================================================
         *
         * teacher digunakan untuk mengambil relasi
         * mata pelajaran guru.
         *
         * CATATAN:
         * schedules.teacher_id menyimpan users.id,
         * bukan teachers.id.
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
         * ==========================================================
         * ID GURU UNTUK DATA SCHEDULE
         * ==========================================================
         *
         * schedules.teacher_id -> users.id
         *
         * Jadi seluruh query Schedule harus menggunakan:
         *
         * $user->id
         *
         * BUKAN:
         *
         * $teacher->id
         */
        $teacherUserId = $user->id;

        /*
         * ==========================================================
         * DATA MATA PELAJARAN GURU
         * ==========================================================
         */
        $mataPelajaran = $teacher->subjects
            ->pluck('name')
            ->join(', ');

        /*
         * ==========================================================
         * JADWAL HARI INI
         * ==========================================================
         */
        $hariIni = now()
            ->locale('id')
            ->translatedFormat('l');

        $jadwalHariIni = Schedule::with([
            'classroom',
            'subject',
            'journals',
        ])
            ->where('teacher_id', $teacherUserId)
            ->whereRaw(
                'LOWER(day) = LOWER(?)',
                [$hariIni]
            )
            ->orderBy('start_time')
            ->get();

        /*
         * ==========================================================
         * KELAS YANG DIAJAR
         * ==========================================================
         *
         * Menghitung jumlah classroom unik yang memiliki
         * jadwal milik guru ini.
         */
        $kelasDiajar = Schedule::where(
            'teacher_id',
            $teacherUserId
        )
            ->distinct('classroom_id')
            ->count('classroom_id');

        /*
         * ==========================================================
         * TOTAL SISWA
         * ==========================================================
         *
         * Ambil semua classroom yang diajar guru ini.
         */
        $classroomIds = Schedule::where(
            'teacher_id',
            $teacherUserId
        )
            ->pluck('classroom_id')
            ->unique();

        $totalSiswa = 0;

        if ($classroomIds->isNotEmpty()) {
            $totalSiswa = User::where(
                'role',
                'siswa'
            )
                ->whereHas(
                    'classrooms',
                    function ($query) use ($classroomIds) {
                        $query->whereIn(
                            'classrooms.id',
                            $classroomIds
                        );
                    }
                )
                ->count();
        }

        /*
         * ==========================================================
         * FORMAT JADWAL HARI INI
         * ==========================================================
         */
        $jadwalData = $jadwalHariIni
            ->values()
            ->map(
                function ($schedule, $index) {
                    $now = now();

                    /*
                     * Waktu mulai
                     */
                    $start = $schedule->start_time
                        ? now()->setTimeFromTimeString(
                            $schedule->start_time
                        )
                        : null;

                    /*
                     * Waktu selesai
                     */
                    $end = $schedule->end_time
                        ? now()->setTimeFromTimeString(
                            $schedule->end_time
                        )
                        : null;

                    /*
                     * Status default
                     */
                    $status = 'belum';

                    if ($start && $end) {
                        if ($now->between($start, $end)) {
                            $status = 'berlangsung';
                        } elseif ($now->greaterThan($end)) {
                            $status = 'selesai';
                        }
                    }

                    /*
                     * Cari jurnal untuk jadwal hari ini.
                     */
                    $jurnalHariIni = $schedule->journals
                        ->first(
                            function ($journal) {
                                return $journal->date?->isToday();
                            }
                        );

                    return [
                        'id' => $schedule->id,

                        'jam_ke' => $index + 1,

                        'waktu' => $schedule->start_time
                            && $schedule->end_time
                            ? substr(
                                $schedule->start_time,
                                0,
                                5
                            )
                                . ' - '
                                . substr(
                                    $schedule->end_time,
                                    0,
                                    5
                                )
                            : '-',

                        'kelas' => $schedule
                            ->classroom
                            ?->name ?? '-',

                        'topik' => $jurnalHariIni
                            ?->topic
                            ?? 'Belum ada topik',

                        'status' => $status,
                    ];
                }
            );

        /*
         * ==========================================================
         * JURNAL TERBARU
         * ==========================================================
         *
         * Hanya mengambil jurnal dari jadwal milik guru ini.
         */
        $jurnalTerbaru = Journal::with([
            'schedule.classroom',
            'schedule.subject',
        ])
            ->whereHas(
                'schedule',
                function ($query) use ($teacherUserId) {
                    $query->where(
                        'teacher_id',
                        $teacherUserId
                    );
                }
            )
            ->latest('date')
            ->latest('id')
            ->limit(5)
            ->get()
            ->map(
                function ($journal) {
                    return [
                        'id' => $journal->id,

                        'tanggal' => $journal->date
                            ? $journal->date
                                ->translatedFormat('d M Y')
                            : '-',

                        'kelas_mapel' => (
                            $journal
                                ->schedule
                                ?->classroom
                                ?->name
                            ?? '-'
                        )
                            . ' · '
                            . (
                                $journal
                                    ->schedule
                                    ?->subject
                                    ?->name
                                ?? '-'
                            ),

                        'topik' => $journal->topic
                            ?? '-',

                        'meta' => $journal->description
                            ?? '-',

                        'status' => 'terisi',
                    ];
                }
            );

        /*
         * ==========================================================
         * TUGAS MENUNGGU DINILAI
         * ==========================================================
         *
         * Mengambil assignment yang:
         *
         * 1. Berasal dari jadwal guru ini.
         * 2. Memiliki submission.
         * 3. Submission tersebut belum memiliki nilai.
         */
        $tugasMenunggu = Assignment::with([
            'schedule.classroom',
            'submissions',
        ])
            ->whereHas(
                'schedule',
                function ($query) use ($teacherUserId) {
                    $query->where(
                        'teacher_id',
                        $teacherUserId
                    );
                }
            )
            ->whereHas(
                'submissions',
                function ($query) {
                    $query->whereNull('grade');
                }
            )
            ->latest('due_date')
            ->limit(5)
            ->get()
            ->map(
                function ($assignment) {
                    $submissionBelumDinilai =
                        $assignment->submissions
                            ->whereNull('grade')
                            ->count();

                    return [
                        'id' => $assignment->id,

                        'judul' => $assignment->title,

                        'kelas' => $assignment
                            ->schedule
                            ?->classroom
                            ?->name
                            ?? '-',

                        'terkumpul' =>
                            $submissionBelumDinilai,
                    ];
                }
            );

        /*
         * ==========================================================
         * KEHADIRAN HARI INI
         * ==========================================================
         */
        $jadwalIdsHariIni = $jadwalHariIni
            ->pluck('id');

        $kehadiranHariIni = '0%';

        if ($jadwalIdsHariIni->isNotEmpty()) {
            /*
             * Total seluruh absensi hari ini.
             */
            $totalAbsensi = Attendance::whereIn(
                'schedule_id',
                $jadwalIdsHariIni
            )
                ->whereDate(
                    'date',
                    today()
                )
                ->count();

            /*
             * Total siswa yang hadir.
             */
            $totalHadir = Attendance::whereIn(
                'schedule_id',
                $jadwalIdsHariIni
            )
                ->whereDate(
                    'date',
                    today()
                )
                ->where(
                    'status',
                    'hadir'
                )
                ->count();

            /*
             * Hitung persentase kehadiran.
             */
            if ($totalAbsensi > 0) {
                $persentase = round(
                    ($totalHadir / $totalAbsensi) * 100
                );

                $kehadiranHariIni =
                    $persentase . '%';
            }
        }

        /*
         * ==========================================================
         * RATA-RATA NILAI PER KELAS
         * ==========================================================
         */
        $rataRataKelas = Submission::with([
            'assignment.schedule.classroom',
        ])
            ->whereNotNull('grade')
            ->whereHas(
                'assignment.schedule',
                function ($query) use ($teacherUserId) {
                    $query->where(
                        'teacher_id',
                        $teacherUserId
                    );
                }
            )
            ->get()
            ->groupBy(
                function ($submission) {
                    return $submission
                        ->assignment
                        ?->schedule
                        ?->classroom
                        ?->name
                        ?? '-';
                }
            )
            ->map(
                function ($submissions, $kelas) {
                    return [
                        'kelas' => $kelas,

                        'nilai' => round(
                            $submissions->avg(
                                'grade'
                            ),
                            2
                        ),
                    ];
                }
            )
            ->values();

        /*
         * ==========================================================
         * RESPONSE
         * ==========================================================
         */
        return response()->json([
            'success' => true,

            'data' => [
                /*
                 * --------------------------------------------------
                 * DATA GURU
                 * --------------------------------------------------
                 */
                'guru' => [
                    'nama' => $user->name,

                    'mata_pelajaran' =>
                        $mataPelajaran
                        ?: 'Guru Mata Pelajaran',
                ],

                /*
                 * --------------------------------------------------
                 * STATISTIK
                 * --------------------------------------------------
                 */
                'statistik' => [
                    'kelas_diajar' =>
                        $kelasDiajar,

                    'total_siswa' =>
                        $totalSiswa,

                    'tugas_menunggu' =>
                        $tugasMenunggu->count(),

                    'kehadiran_hari_ini' =>
                        $kehadiranHariIni,
                ],

                /*
                 * --------------------------------------------------
                 * JADWAL HARI INI
                 * --------------------------------------------------
                 */
                'jadwal_hari_ini' =>
                    $jadwalData,

                /*
                 * --------------------------------------------------
                 * JURNAL TERBARU
                 * --------------------------------------------------
                 */
                'jurnal_terbaru' =>
                    $jurnalTerbaru,

                /*
                 * --------------------------------------------------
                 * TUGAS MENUNGGU DINILAI
                 * --------------------------------------------------
                 */
                'tugas_menunggu_dinilai' =>
                    $tugasMenunggu,

                /*
                 * --------------------------------------------------
                 * RATA-RATA NILAI
                 * --------------------------------------------------
                 */
                'rata_rata_kelas' =>
                    $rataRataKelas,
            ],
        ]);
    }
}