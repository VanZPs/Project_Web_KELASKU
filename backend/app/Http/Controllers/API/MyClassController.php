<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Classroom;
use Illuminate\Http\Request;

class MyClassController extends Controller
{
    /**
     * ==========================================================
     * GET /api/guru/kelas-saya
     * ==========================================================
     *
     * Menampilkan seluruh kelas yang dimiliki/diajarkan oleh guru.
     *
     * Kelas aktif maupun kelas yang sudah diarsipkan
     * tetap dikirim ke frontend.
     *
     * Status:
     * - archived = false → kelas aktif
     * - archived = true  → kelas arsip
     *
     * Filtering tampilan:
     * - Semua kelas
     * - Berlangsung
     * - Arsip
     *
     * dilakukan di frontend.
     */
    public function index(Request $request)
    {
        $user = $request->user();

        /*
         * ======================================================
         * VALIDASI ROLE
         * ======================================================
         */
        if ($user->role !== 'guru') {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak.',
            ], 403);
        }

        /*
         * ======================================================
         * AMBIL PROFIL GURU
         * ======================================================
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
         * ======================================================
         * AMBIL ID KELAS YANG DIAJAR
         * ======================================================
         *
         * Mengambil seluruh classroom_id yang memiliki
         * jadwal milik guru yang sedang login.
         *
         * Kelas yang sudah diarsipkan tetap termasuk di sini.
         */
        $classroomIds = $teacher
            ->schedules()
            ->pluck('classroom_id')
            ->unique()
            ->values();

        /*
         * ======================================================
         * JIKA GURU BELUM MEMILIKI KELAS
         * ======================================================
         */
        if ($classroomIds->isEmpty()) {
            return response()->json([
                'success' => true,
                'data' => [],
            ]);
        }

        /*
         * ======================================================
         * AMBIL DATA KELAS
         * ======================================================
         *
         * PENTING:
         *
         * Jangan menggunakan:
         *
         * ->where('archived', false)
         *
         * karena kelas yang sudah diarsipkan harus tetap
         * dikirim ke frontend agar dapat ditampilkan pada
         * tab "Arsip" meskipun halaman direfresh.
         */
        $classrooms = Classroom::with([

            /*
             * --------------------------------------------------
             * DAFTAR SISWA
             * --------------------------------------------------
             */
            'users' => function ($query) {
                $query
                    ->where(
                        'role',
                        'siswa'
                    )
                    ->orderBy(
                        'name'
                    );
            },

            /*
             * --------------------------------------------------
             * PROFIL STUDENT
             * --------------------------------------------------
             */
            'users.student',

            /*
             * --------------------------------------------------
             * JADWAL GURU PADA KELAS TERSEBUT
             * --------------------------------------------------
             *
             * Hanya mengambil jadwal milik guru yang sedang
             * login.
             */
            'schedules' => function ($query) use ($user) {
                $query
                    ->where(
                        'teacher_id',
                        $user->id
                    )
                    ->with([
                        'subject',
                    ])
                    ->orderBy(
                        'day'
                    )
                    ->orderBy(
                        'start_time'
                    );
            },

        ])

            /*
             * --------------------------------------------------
             * HANYA KELAS YANG DIAJAR GURU
             * --------------------------------------------------
             */
            ->whereIn(
                'id',
                $classroomIds
            )

            /*
             * --------------------------------------------------
             * JANGAN FILTER archived DI SINI
             * --------------------------------------------------
             *
             * Kelas aktif dan kelas arsip harus sama-sama
             * dikirim ke frontend.
             */
            ->orderBy(
                'name'
            )
            ->get();

        /*
         * ======================================================
         * FORMAT DATA
         * ======================================================
         */
        $data = $classrooms->map(
            function ($classroom) {

                /*
                 * ----------------------------------------------
                 * JADWAL
                 * ----------------------------------------------
                 */
                $schedules = $classroom->schedules;

                /*
                 * ----------------------------------------------
                 * MATA PELAJARAN
                 * ----------------------------------------------
                 *
                 * Diambil dari jadwal guru pada kelas tersebut.
                 */
                $mataPelajaran = $schedules
                    ->map(
                        function ($schedule) {

                            return $schedule
                                ->subject
                                ?->name;
                        }
                    )
                    ->filter()
                    ->unique()
                    ->values();

                /*
                 * ----------------------------------------------
                 * SISWA
                 * ----------------------------------------------
                 */
                $siswa = $classroom
                    ->users
                    ->map(
                        function ($student) {

                            return [
                                'id' =>
                                    $student->id,

                                'nama' =>
                                    $student->name,

                                'email' =>
                                    $student->email,
                            ];
                        }
                    )
                    ->values();

                /*
                 * ----------------------------------------------
                 * FORMAT JADWAL
                 * ----------------------------------------------
                 */
                $jadwal = $schedules
                    ->map(
                        function ($schedule) {

                            $startTime =
                                $schedule->start_time;

                            $endTime =
                                $schedule->end_time;

                            return [
                                'id' =>
                                    $schedule->id,

                                'hari' =>
                                    $schedule->day,

                                'waktu' =>
                                    $startTime
                                    && $endTime
                                        ? substr(
                                            $startTime,
                                            0,
                                            5
                                        )
                                        . ' - '
                                        . substr(
                                            $endTime,
                                            0,
                                            5
                                        )
                                        : '-',

                                'mata_pelajaran' =>
                                    $schedule
                                        ->subject
                                        ?->name
                                    ?? '-',
                            ];
                        }
                    )
                    ->values();

                /*
                 * ----------------------------------------------
                 * RESPONSE KELAS
                 * ----------------------------------------------
                 */
                return [

                    /*
                     * ID KELAS
                     */
                    'id' =>
                        $classroom->id,

                    /*
                     * NAMA KELAS
                     */
                    'nama' =>
                        $classroom->name,

                    /*
                     * STATUS ARSIP
                     *
                     * Nilai ini diambil langsung dari database.
                     *
                     * false = aktif
                     * true  = arsip
                     */
                    'archived' =>
                        (bool) $classroom->archived,

                    /*
                     * JUMLAH SISWA
                     */
                    'jumlah_siswa' =>
                        $siswa->count(),

                    /*
                     * MATA PELAJARAN
                     */
                    'mata_pelajaran' =>
                        $mataPelajaran,

                    /*
                     * JUMLAH JADWAL
                     */
                    'jumlah_jadwal' =>
                        $jadwal->count(),

                    /*
                     * DAFTAR SISWA
                     */
                    'siswa' =>
                        $siswa,

                    /*
                     * DAFTAR JADWAL
                     */
                    'jadwal' =>
                        $jadwal,
                ];
            }
        )
        ->values();

        /*
         * ======================================================
         * RESPONSE
         * ======================================================
         */
        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }
}