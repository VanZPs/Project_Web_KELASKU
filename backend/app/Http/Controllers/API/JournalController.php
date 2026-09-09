<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\Journal;
use App\Models\Schedule;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class JournalController extends Controller
{
    /**
     * GET /api/guru/jurnal
     *
     * Menampilkan seluruh jadwal guru beserta
     * status jurnal dan ringkasan presensi.
     */
    public function index(Request $request)
    {
        $user = $request->user();

        if ($user->role !== 'guru') {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak.',
            ], 403);
        }

        $schedules = Schedule::with([
            'classroom',
            'subject',
            'journals' => function ($query) {
                $query->latest('date');
            },
            'attendances',
        ])
            ->where('teacher_id', $user->id)
            ->orderByRaw("
                CASE day
                    WHEN 'Senin' THEN 1
                    WHEN 'Selasa' THEN 2
                    WHEN 'Rabu' THEN 3
                    WHEN 'Kamis' THEN 4
                    WHEN 'Jumat' THEN 5
                    WHEN 'Sabtu' THEN 6
                    WHEN 'Minggu' THEN 7
                    ELSE 8
                END
            ")
            ->orderBy('start_time')
            ->get();

        $data = $schedules->map(function ($schedule) {
            $latestJournal = $schedule->journals->first();

            $attendanceCounts = $schedule->attendances
                ->groupBy('status')
                ->map(fn ($items) => $items->count());

            return [
                'id' => $schedule->id,

                'kelas' => $schedule->classroom?->name ?? '-',

                'mata_pelajaran' =>
                    $schedule->subject?->name ?? '-',

                'hari' => $schedule->day,

                'waktu' =>
                    substr($schedule->start_time, 0, 5)
                    . ' - '
                    . substr($schedule->end_time, 0, 5),

                'jurnal_terakhir' => $latestJournal
                    ? [
                        'id' => $latestJournal->id,
                        'tanggal' => $latestJournal->date?->format('Y-m-d'),
                        'topic' => $latestJournal->topic,
                        'description' => $latestJournal->description,
                    ]
                    : null,

                'jumlah_jurnal' =>
                    $schedule->journals->count(),

                'presensi' => [
                    'hadir' =>
                        $attendanceCounts->get('hadir', 0),

                    'izin' =>
                        $attendanceCounts->get('izin', 0),

                    'sakit' =>
                        $attendanceCounts->get('sakit', 0),

                    'dispen' =>
                        $attendanceCounts->get('dispen', 0),

                    'alpa' =>
                        $attendanceCounts->get('alpa', 0),
                ],

                'status' => $latestJournal
                    ? 'lengkap'
                    : 'menunggu',
            ];
        })->values();

        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }

    /**
     * GET /api/guru/jurnal/{schedule}
     *
     * Menampilkan detail satu jadwal,
     * daftar siswa, dan riwayat jurnal.
     */
    public function showSchedule(
        Request $request,
        Schedule $schedule
    ) {
        $user = $request->user();

        if ($user->role !== 'guru') {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak.',
            ], 403);
        }

        if ($schedule->teacher_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Jadwal bukan milik guru yang sedang login.',
            ], 403);
        }

        $schedule->load([
            'classroom.users' => function ($query) {
                $query
                    ->where('role', 'siswa')
                    ->orderBy('name');
            },
            'subject',
            'journals' => function ($query) {
                $query->latest('date');
            },
        ]);

        $students = $schedule->classroom?->users
            ->map(function ($student) use ($schedule) {
                return [
                    'id' => $student->id,
                    'nama' => $student->name,
                    'email' => $student->email,

                    'status' => Attendance::where(
                        'schedule_id',
                        $schedule->id
                    )
                        ->where(
                            'student_id',
                            $student->id
                        )
                        ->whereDate(
                            'date',
                            now()
                        )
                        ->value('status') ?? 'hadir',
                ];
            })
            ->values() ?? collect();

        $journals = $schedule->journals
            ->map(function ($journal) {
                return [
                    'id' => $journal->id,
                    'tanggal' =>
                        $journal->date?->format('Y-m-d'),
                    'topic' => $journal->topic,
                    'description' => $journal->description,
                ];
            })
            ->values();

        return response()->json([
            'success' => true,

            'data' => [
                'schedule' => [
                    'id' => $schedule->id,
                    'kelas' =>
                        $schedule->classroom?->name ?? '-',
                    'mata_pelajaran' =>
                        $schedule->subject?->name ?? '-',
                    'hari' => $schedule->day,
                    'waktu' =>
                        substr($schedule->start_time, 0, 5)
                        . ' - '
                        . substr($schedule->end_time, 0, 5),
                ],

                'students' => $students,

                'journals' => $journals,
            ],
        ]);
    }

    /**
     * POST /api/guru/jurnal/{schedule}/mulai
     *
     * Membuat jurnal sekaligus presensi siswa.
     */
    public function store(
        Request $request,
        Schedule $schedule
    ) {
        $user = $request->user();

        if ($user->role !== 'guru') {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak.',
            ], 403);
        }

        if ($schedule->teacher_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Jadwal bukan milik guru yang sedang login.',
            ], 403);
        }

        $validated = $request->validate([
            'date' => [
                'required',
                'date',
            ],

            'topic' => [
                'required',
                'string',
                'max:255',
            ],

            'description' => [
                'nullable',
                'string',
            ],

            'attendances' => [
                'required',
                'array',
                'min:1',
            ],

            'attendances.*.student_id' => [
                'required',
                'integer',
                'exists:users,id',
            ],

            'attendances.*.status' => [
                'required',
                Rule::in([
                    'hadir',
                    'izin',
                    'sakit',
                    'dispen',
                    'alpa',
                ]),
            ],

            'attendances.*.notes' => [
                'nullable',
                'string',
                'max:255',
            ],
        ]);

        $classroomStudentIds = $schedule
            ->classroom
            ->users()
            ->where('role', 'siswa')
            ->pluck('users.id')
            ->toArray();

        foreach ($validated['attendances'] as $attendance) {
            if (!in_array(
                $attendance['student_id'],
                $classroomStudentIds
            )) {
                return response()->json([
                    'success' => false,
                    'message' =>
                        'Terdapat siswa yang bukan anggota kelas ini.',
                ], 422);
            }
        }

        $journal = DB::transaction(function () use (
            $validated,
            $schedule
        ) {
            $journal = Journal::create([
                'schedule_id' => $schedule->id,
                'date' => $validated['date'],
                'topic' => $validated['topic'],
                'description' =>
                    $validated['description'] ?? null,
            ]);

            foreach ($validated['attendances'] as $attendance) {
                Attendance::updateOrCreate(
                    [
                        'schedule_id' => $schedule->id,
                        'student_id' =>
                            $attendance['student_id'],
                        'date' => $validated['date'],
                    ],
                    [
                        'status' =>
                            $attendance['status'],
                        'notes' =>
                            $attendance['notes'] ?? null,
                    ]
                );
            }

            return $journal;
        });

        return response()->json([
            'success' => true,
            'message' =>
                'Jurnal dan presensi berhasil disimpan.',
            'data' => [
                'journal' => [
                    'id' => $journal->id,
                    'schedule_id' =>
                        $journal->schedule_id,
                    'date' =>
                        $journal->date?->format('Y-m-d'),
                    'topic' => $journal->topic,
                    'description' =>
                        $journal->description,
                ],
            ],
        ], 201);
    }

    /**
     * GET /api/guru/jurnal/riwayat/{schedule}
     *
     * Riwayat jurnal suatu jadwal.
     */
    public function history(
        Request $request,
        Schedule $schedule
    ) {
        $user = $request->user();

        if ($user->role !== 'guru') {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak.',
            ], 403);
        }

        if ($schedule->teacher_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Akses jadwal ditolak.',
            ], 403);
        }

        $journals = Journal::where(
            'schedule_id',
            $schedule->id
        )
            ->with([
                'schedule.classroom',
                'schedule.subject',
            ])
            ->latest('date')
            ->get()
            ->map(function ($journal) {
                return [
                    'id' => $journal->id,

                    'tanggal' =>
                        $journal->date?->format('Y-m-d'),

                    'topic' => $journal->topic,

                    'description' =>
                        $journal->description,

                    'kelas' =>
                        $journal->schedule
                            ?->classroom
                            ?->name ?? '-',

                    'mata_pelajaran' =>
                        $journal->schedule
                            ?->subject
                            ?->name ?? '-',
                ];
            })
            ->values();

        return response()->json([
            'success' => true,
            'data' => $journals,
        ]);
    }
}