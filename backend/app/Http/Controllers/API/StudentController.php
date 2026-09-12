<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\Schedule;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class StudentController extends Controller
{
    /**
     * Memastikan user yang mengakses adalah guru.
     */
    private function ensureTeacher(Request $request): ?JsonResponse
    {
        if ($request->user()->role !== 'guru') {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak. Hanya guru yang dapat mengakses data siswa.',
            ], 403);
        }

        return null;
    }

    /**
     * Mendapatkan ID jadwal yang dimiliki guru yang sedang login.
     */
    private function teacherScheduleIds(Request $request)
    {
        return Schedule::where('teacher_id', $request->user()->id)
            ->pluck('id');
    }

    /**
     * Menampilkan daftar kelas dan ringkasan siswa
     * yang diajar oleh guru yang sedang login.
     */
    public function index(Request $request): JsonResponse
    {
        if ($response = $this->ensureTeacher($request)) {
            return $response;
        }

        $teacherId = $request->user()->id;

        /*
         * Ambil seluruh jadwal milik guru.
         */
        $schedules = Schedule::with([
            'classroom',
            'subject',
        ])
            ->where('teacher_id', $teacherId)
            ->get();

        /*
         * Kelompokkan jadwal berdasarkan kelas.
         *
         * Satu guru dapat memiliki beberapa jadwal
         * untuk kelas yang sama.
         */
        $classrooms = $schedules
            ->groupBy('classroom_id')
            ->map(function ($classSchedules) {

                $firstSchedule = $classSchedules->first();

                if (!$firstSchedule || !$firstSchedule->classroom) {
                    return null;
                }

                $classroom = $firstSchedule->classroom;

                /*
                 * Ambil seluruh siswa yang tergabung
                 * dalam kelas tersebut.
                 */
                $students = $classroom->users()
                    ->with('student')
                    ->where('users.role', 'siswa')
                    ->get();

                $studentIds = $students->pluck('id');

                /*
                 * Ambil seluruh presensi siswa pada
                 * jadwal guru untuk kelas tersebut.
                 */
                $attendances = Attendance::whereIn(
                    'schedule_id',
                    $classSchedules->pluck('id')
                )
                    ->whereIn('student_id', $studentIds)
                    ->get();

                /*
                 * Hitung rata-rata kehadiran kelas.
                 */
                $totalAttendance = $attendances->count();

                $totalPresent = $attendances
                    ->where('status', 'hadir')
                    ->count();

                $averageAttendance = $totalAttendance > 0
                    ? round(($totalPresent / $totalAttendance) * 100)
                    : 0;

                /*
                 * Buat data siswa beserta ringkasan presensi
                 * masing-masing siswa.
                 */
                $studentData = $students
                    ->map(function ($student) use ($attendances) {

                        $studentAttendances = $attendances->where(
                            'student_id',
                            $student->id
                        );

                        $statuses = [
                            'hadir',
                            'izin',
                            'sakit',
                            'dispen',
                            'alpa',
                        ];

                        /*
                         * Hitung jumlah setiap status presensi.
                         */
                        $counts = collect($statuses)
                            ->mapWithKeys(function ($status) use ($studentAttendances) {
                                return [
                                    $status => $studentAttendances
                                        ->where('status', $status)
                                        ->count(),
                                ];
                            });

                        $total = $studentAttendances->count();

                        /*
                         * Persentase kehadiran siswa.
                         *
                         * Jika belum memiliki riwayat presensi,
                         * persentase ditampilkan 0.
                         */
                        $percentage = $total > 0
                            ? round(
                                ($counts['hadir'] / $total) * 100
                            )
                            : 0;

                        return [
                            'id' => $student->id,

                            'nama' => $student->name,

                            'email' => $student->email,

                            'jenis_kelamin' =>
                                $student->student?->jenis_kelamin,

                            'summary' => [
                                'hadir' => $counts['hadir'],

                                'izin' => $counts['izin'],

                                'sakit' => $counts['sakit'],

                                'dispen' => $counts['dispen'],

                                'alpa' => $counts['alpa'],

                                'persentase' => $percentage,
                            ],
                        ];
                    })
                    ->values();

                /*
                 * Hitung jumlah siswa yang perlu perhatian.
                 *
                 * Batas perhatian:
                 * < 75% kehadiran.
                 */
                $studentsNeedAttention = $studentData
                    ->filter(function ($student) {
                        return $student['summary']['persentase'] < 75
                            && (
                                $student['summary']['hadir']
                                + $student['summary']['izin']
                                + $student['summary']['sakit']
                                + $student['summary']['dispen']
                                + $student['summary']['alpa']
                            ) > 0;
                    })
                    ->count();

                /*
                 * Ambil mata pelajaran unik dari jadwal guru
                 * pada kelas tersebut.
                 */
                $subjects = $classSchedules
                    ->map(function ($schedule) {
                        return $schedule->subject?->name;
                    })
                    ->filter()
                    ->unique()
                    ->values();

                return [
                    'id' => $classroom->id,

                    'nama' => $classroom->name,

                    'mata_pelajaran' => $subjects,

                    'jumlah_siswa' => $students->count(),

                    'rata_kehadiran' => $averageAttendance,

                    'perlu_perhatian' => $studentsNeedAttention,

                    'siswa' => $studentData,
                ];
            })
            ->filter()
            ->sortBy('nama')
            ->values();

        /*
         * Ringkasan seluruh kelas yang diajar guru.
         */
        $summary = [
            'jumlah_kelas' => $classrooms->count(),

            'jumlah_siswa' => $classrooms->sum(
                'jumlah_siswa'
            ),

            'rata_kehadiran' => $classrooms->count() > 0
                ? round($classrooms->avg('rata_kehadiran'))
                : 0,

            'perlu_perhatian' => $classrooms->sum(
                'perlu_perhatian'
            ),
        ];

        return response()->json([
            'success' => true,

            'data' => [
                'summary' => $summary,

                'kelas' => $classrooms,
            ],
        ]);
    }

    /**
     * Menampilkan detail seorang siswa beserta
     * riwayat presensinya pada kelas yang diajar guru.
     */
    public function show(
        Request $request,
        User $student
    ): JsonResponse {
        if ($response = $this->ensureTeacher($request)) {
            return $response;
        }

        /*
         * Pastikan user yang diminta benar-benar siswa.
         */
        if ($student->role !== 'siswa') {
            return response()->json([
                'success' => false,
                'message' => 'User yang diminta bukan siswa.',
            ], 404);
        }

        /*
         * Ambil ID kelas yang diajar guru.
         */
        $teacherClassroomIds = Schedule::where(
            'teacher_id',
            $request->user()->id
        )
            ->pluck('classroom_id')
            ->unique()
            ->values();

        /*
         * Cari kelas siswa yang juga diajar oleh guru.
         */
        $classroom = $student->classrooms()
            ->whereIn(
                'classrooms.id',
                $teacherClassroomIds
            )
            ->first();

        if (!$classroom) {
            return response()->json([
                'success' => false,
                'message' => 'Siswa bukan anggota kelas yang diajar guru ini.',
            ], 403);
        }

        /*
         * Ambil jadwal guru untuk kelas siswa tersebut.
         */
        $scheduleIds = Schedule::where(
            'teacher_id',
            $request->user()->id
        )
            ->where(
                'classroom_id',
                $classroom->id
            )
            ->pluck('id');

        /*
         * Ambil seluruh riwayat presensi siswa.
         */
        $attendances = Attendance::with([
            'schedule.subject',
        ])
            ->whereIn(
                'schedule_id',
                $scheduleIds
            )
            ->where(
                'student_id',
                $student->id
            )
            ->orderByDesc('date')
            ->get();

        /*
         * Status presensi yang digunakan KELASKU.
         */
        $statuses = [
            'hadir',
            'izin',
            'sakit',
            'dispen',
            'alpa',
        ];

        /*
         * Hitung jumlah setiap status.
         */
        $counts = collect($statuses)
            ->mapWithKeys(function ($status) use ($attendances) {
                return [
                    $status => $attendances
                        ->where('status', $status)
                        ->count(),
                ];
            });

        $totalAttendance = $attendances->count();

        /*
         * Persentase kehadiran:
         * hadir / seluruh presensi x 100.
         *
         * Jika belum memiliki presensi, gunakan 100%
         * agar siswa tidak langsung dianggap bermasalah.
         */
        $attendancePercentage = $totalAttendance > 0
            ? round(
                ($counts['hadir'] / $totalAttendance) * 100
            )
            : 100;

        /*
         * Data siswa.
         */
        $studentData = [
            'id' => $student->id,

            'nama' => $student->name,

            'email' => $student->email,

            'jenis_kelamin' => $student->student?->jenis_kelamin,

            'kelas' => $classroom->name,
        ];

        /*
         * Data riwayat presensi.
         */
        $history = $attendances
            ->map(function ($attendance) {

                return [
                    'id' => $attendance->id,

                    'tanggal' => $attendance->date
                        ? $attendance->date->format('Y-m-d')
                        : null,

                    'status' => $attendance->status,

                    'keterangan' => $attendance->notes ?? '',

                    'mata_pelajaran' =>
                        $attendance->schedule?->subject?->name
                        ?? '-',
                ];
            })
            ->values();

        return response()->json([
            'success' => true,

            'data' => [
                'student' => $studentData,

                'summary' => [
                    'hadir' => $counts['hadir'],

                    'izin' => $counts['izin'],

                    'sakit' => $counts['sakit'],

                    'dispen' => $counts['dispen'],

                    'alpa' => $counts['alpa'],

                    'persentase' => $attendancePercentage,
                ],

                'riwayat' => $history,
            ],
        ]);
    }

    /**
     * Mengubah data presensi seorang siswa.
     */
    public function updateAttendance(
        Request $request,
        User $student,
        Attendance $attendance
    ): JsonResponse {
        if ($response = $this->ensureTeacher($request)) {
            return $response;
        }

        /*
         * Pastikan user adalah siswa.
         */
        if ($student->role !== 'siswa') {
            return response()->json([
                'success' => false,
                'message' => 'User yang diminta bukan siswa.',
            ], 404);
        }

        /*
         * Validasi input.
         */
        $validated = $request->validate([
            'status' => [
                'required',
                Rule::in([
                    'hadir',
                    'izin',
                    'sakit',
                    'dispen',
                    'alpa',
                ]),
            ],

            'notes' => [
                'nullable',
                'string',
                'max:255',
            ],
        ]);

        /*
         * Pastikan attendance memang milik siswa
         * yang ada pada URL.
         */
        if ($attendance->student_id !== $student->id) {
            return response()->json([
                'success' => false,
                'message' => 'Presensi tersebut bukan milik siswa ini.',
            ], 403);
        }

        /*
         * Ambil jadwal presensi.
         */
        $schedule = Schedule::with('classroom')
            ->find($attendance->schedule_id);

        if (!$schedule) {
            return response()->json([
                'success' => false,
                'message' => 'Jadwal presensi tidak ditemukan.',
            ], 404);
        }

        /*
         * Pastikan jadwal tersebut milik guru
         * yang sedang login.
         */
        if ($schedule->teacher_id !== $request->user()->id) {
            return response()->json([
                'success' => false,
                'message' => 'Anda tidak memiliki akses untuk mengubah presensi ini.',
            ], 403);
        }

        /*
         * Pastikan siswa memang anggota kelas
         * dari jadwal tersebut.
         */
        $studentBelongsToClassroom = $schedule->classroom
            ? $schedule->classroom
                ->users()
                ->where('users.id', $student->id)
                ->where('users.role', 'siswa')
                ->exists()
            : false;

        if (!$studentBelongsToClassroom) {
            return response()->json([
                'success' => false,
                'message' => 'Siswa bukan anggota kelas pada jadwal tersebut.',
            ], 403);
        }

        /*
         * Simpan perubahan presensi.
         */
        $attendance->update([
            'status' => $validated['status'],

            'notes' => $validated['notes'] ?? null,
        ]);

        /*
         * Kembalikan data terbaru.
         */
        $attendance->load([
            'schedule.subject',
            'schedule.classroom',
        ]);

        return response()->json([
            'success' => true,

            'message' => 'Presensi berhasil diperbarui.',

            'data' => [
                'id' => $attendance->id,

                'tanggal' => $attendance->date
                    ? $attendance->date->format('Y-m-d')
                    : null,

                'status' => $attendance->status,

                'keterangan' => $attendance->notes ?? '',

                'mata_pelajaran' =>
                    $attendance->schedule?->subject?->name
                    ?? '-',
            ],
        ]);
    }
}