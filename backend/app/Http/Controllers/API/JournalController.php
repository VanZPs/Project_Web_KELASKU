<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\Journal;
use App\Models\Schedule;
use App\Services\HolidayService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class JournalController extends Controller
{
    /**
     * GET /api/guru/jurnal
     *
     * Menampilkan daftar jurnal mengajar guru.
     *
     * Jadwal dengan kombinasi:
     *
     * classroom + subject
     *
     * yang sama akan digabung menjadi satu card.
     *
     * Contoh:
     *
     * XII - 1 + PPKn
     * - Kamis
     * - Jumat
     *
     * Akan menjadi:
     *
     * 1 card
     *
     * dengan:
     *
     * 0 / 2 pertemuan
     *
     * Perhitungan kelengkapan hanya berdasarkan
     * minggu berjalan.
     *
     * Data jurnal minggu sebelumnya tetap tersimpan
     * dan dapat dilihat melalui riwayat.
     *
     * Jika hari ini merupakan tanggal merah,
     * sistem akan otomatis membuat jurnal hari libur
     * untuk jadwal guru yang berlangsung pada hari tersebut.
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

        /*
         * ============================================================
         * CEK HARI LIBUR NASIONAL
         * ============================================================
         *
         * Bagian ini menjadi backup apabila scheduler Laravel
         * belum sempat menjalankan command journals:generate-holidays.
         *
         * Jika hari ini merupakan tanggal merah:
         *
         * - Cari jadwal guru hari ini.
         * - Buat jurnal otomatis jika belum ada.
         *
         * Jurnal yang dibuat:
         *
         * topic       = Hari Libur Nasional
         * description = Nama hari libur
         * is_holiday  = true
         * holiday_name= Nama hari libur
         *
         * Tidak ada data presensi yang dibuat.
         */
        $todayDate = now()
            ->timezone('Asia/Jakarta')
            ->toDateString();

        $todayDay = now()
            ->timezone('Asia/Jakarta')
            ->locale('id')
            ->translatedFormat('l');

        $holidayService = app(HolidayService::class);

        $holiday = $holidayService->getHolidayByDate(
            $todayDate
        );

        if ($holiday) {
            $holidayName =
                $holiday['name']
                ?? 'Hari Libur Nasional';

            $todaySchedules = Schedule::where(
                'teacher_id',
                $user->id
            )
                ->where(
                    'day',
                    $todayDay
                )
                ->get();

            foreach ($todaySchedules as $todaySchedule) {
                Journal::firstOrCreate(
                    [
                        'schedule_id' =>
                            $todaySchedule->id,

                        'date' =>
                            $todayDate,
                    ],
                    [
                        'topic' =>
                            'Hari Libur Nasional',

                        'description' =>
                            $holidayName,

                        'is_holiday' =>
                            true,

                        'holiday_name' =>
                            $holidayName,
                    ]
                );
            }
        }

        /*
         * ============================================================
         * PERIODE MINGGU BERJALAN
         * ============================================================
         *
         * Senin menjadi awal minggu.
         *
         * Minggu menjadi hari terakhir periode.
         *
         * Contoh:
         *
         * Senin  : 2026-09-07
         * Selasa : 2026-09-08
         * ...
         * Sabtu  : 2026-09-12
         * Minggu : 2026-09-13
         *
         * Data jurnal lama TIDAK dihapus.
         */
        $startOfWeek = now()->startOfWeek();
        $endOfWeek = now()->endOfWeek();

        /*
         * ============================================================
         * AMBIL SELURUH JADWAL GURU
         * ============================================================
         */
        $schedules = Schedule::with([
            'classroom',
            'subject',
        ])
            ->where(
                'teacher_id',
                $user->id
            )
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

        /*
         * Jika guru belum memiliki jadwal.
         */
        if ($schedules->isEmpty()) {
            return response()->json([
                'success' => true,
                'data' => [],
            ]);
        }

        /*
         * ============================================================
         * ID SELURUH JADWAL GURU
         * ============================================================
         */
        $scheduleIds = $schedules
            ->pluck('id')
            ->values();

        /*
         * ============================================================
         * JURNAL MINGGU BERJALAN
         * ============================================================
         *
         * Jurnal hari libur juga ikut masuk ke sini.
         *
         * Karena jurnal hari libur dianggap sebagai sesi yang
         * sudah ter-cover, maka jumlah_jurnal akan bertambah.
         */
        $journalsThisWeek = Journal::whereIn(
            'schedule_id',
            $scheduleIds
        )
            ->whereBetween('date', [
                $startOfWeek->toDateString(),
                $endOfWeek->toDateString(),
            ])
            ->latest('date')
            ->get();

        /*
         * ============================================================
         * PRESENSI MINGGU BERJALAN
         * ============================================================
         */
        $attendancesThisWeek = Attendance::whereIn(
            'schedule_id',
            $scheduleIds
        )
            ->whereBetween('date', [
                $startOfWeek->toDateString(),
                $endOfWeek->toDateString(),
            ])
            ->get();

        /*
         * ============================================================
         * GROUPING
         * ============================================================
         *
         * Jadwal digabung berdasarkan:
         *
         * classroom_id + subject_id
         */
        $groupedSchedules = $schedules->groupBy(function ($schedule) {
            return $schedule->classroom_id
                . '-'
                . $schedule->subject_id;
        });

        /*
         * ============================================================
         * BENTUK DATA CARD
         * ============================================================
         */
        $data = $groupedSchedules
            ->map(function ($scheduleGroup) use (
                $journalsThisWeek,
                $attendancesThisWeek,
                $todayDay
            ) {
                /*
                 * ----------------------------------------------------
                 * URUTKAN JADWAL
                 * ----------------------------------------------------
                 *
                 * 1. Hari
                 * 2. Jam mulai
                 */
                $dayOrder = [
                    'Senin' => 1,
                    'Selasa' => 2,
                    'Rabu' => 3,
                    'Kamis' => 4,
                    'Jumat' => 5,
                    'Sabtu' => 6,
                    'Minggu' => 7,
                ];

                $scheduleGroup = $scheduleGroup
                    ->sortBy(function ($schedule) use ($dayOrder) {
                        return sprintf(
                            '%02d-%s',
                            $dayOrder[$schedule->day] ?? 8,
                            $schedule->start_time
                        );
                    })
                    ->values();

                /*
                 * ----------------------------------------------------
                 * ID SELURUH SESSION DALAM CARD
                 * ----------------------------------------------------
                 */
                $groupScheduleIds = $scheduleGroup
                    ->pluck('id')
                    ->values();

                /*
                 * ----------------------------------------------------
                 * JUMLAH SESSION
                 * ----------------------------------------------------
                 */
                $totalMeetings = $scheduleGroup->count();

                /*
                 * ----------------------------------------------------
                 * JURNAL GROUP MINGGU BERJALAN
                 * ----------------------------------------------------
                 */
                $groupJournals = $journalsThisWeek
                    ->whereIn(
                        'schedule_id',
                        $groupScheduleIds
                    )
                    ->values();

                /*
                 * ----------------------------------------------------
                 * SESSION YANG SUDAH MEMILIKI JURNAL
                 * ----------------------------------------------------
                 *
                 * Jurnal normal maupun jurnal hari libur
                 * sama-sama dianggap sebagai session yang
                 * sudah ter-cover.
                 */
                $completedScheduleIds = $groupJournals
                    ->pluck('schedule_id')
                    ->unique()
                    ->values();

                $completedMeetings =
                    $completedScheduleIds->count();

                /*
                 * ----------------------------------------------------
                 * JURNAL TERAKHIR MINGGU BERJALAN
                 * ----------------------------------------------------
                 */
                $latestJournal =
                    $groupJournals->first();

                /*
                 * ----------------------------------------------------
                 * JADWAL HARI INI
                 * ----------------------------------------------------
                 */
                $todaySchedules = $scheduleGroup
                    ->filter(function ($schedule) use ($todayDay) {
                        return $schedule->day === $todayDay;
                    })
                    ->values();

                /*
                 * Jika hari ini memiliki beberapa sesi,
                 * gunakan sesi pertama sebagai schedule aktif.
                 */
                $todaySchedule =
                    $todaySchedules->first();

                /*
                 * ----------------------------------------------------
                 * PRESENSI MINGGU BERJALAN
                 * ----------------------------------------------------
                 */
                $groupAttendances =
                    $attendancesThisWeek
                        ->whereIn(
                            'schedule_id',
                            $groupScheduleIds
                        );

                $attendanceCounts =
                    $groupAttendances
                        ->groupBy('status')
                        ->map(function ($items) {
                            return $items->count();
                        });

                /*
                 * ----------------------------------------------------
                 * DAFTAR SELURUH SESSION
                 * ----------------------------------------------------
                 */
                $scheduleData = $scheduleGroup
                    ->map(function ($schedule) {
                        return [
                            'id' =>
                                $schedule->id,

                            'hari' =>
                                $schedule->day,

                            'waktu' =>
                                substr(
                                    $schedule->start_time,
                                    0,
                                    5
                                )
                                . ' - '
                                . substr(
                                    $schedule->end_time,
                                    0,
                                    5
                                ),
                        ];
                    })
                    ->values();

                /*
                 * ----------------------------------------------------
                 * STATUS
                 * ----------------------------------------------------
                 */
                $status =
                    $completedMeetings >= $totalMeetings
                        ? 'lengkap'
                        : 'menunggu';

                return [
                    /*
                     * ID card menggunakan ID schedule pertama.
                     */
                    'id' =>
                        $scheduleGroup
                            ->first()
                            ->id,

                    'kelas' =>
                        $scheduleGroup
                            ->first()
                            ->classroom
                            ?->name ?? '-',

                    'mata_pelajaran' =>
                        $scheduleGroup
                            ->first()
                            ->subject
                            ?->name ?? '-',

                    /*
                     * Jumlah seluruh session.
                     */
                    'total_pertemuan' =>
                        $totalMeetings,

                    /*
                     * Alias jumlah session.
                     */
                    'jumlah_sesi' =>
                        $totalMeetings,

                    /*
                     * Jumlah session yang sudah memiliki jurnal.
                     *
                     * Termasuk jurnal hari libur.
                     */
                    'jumlah_jurnal' =>
                        $completedMeetings,

                    /*
                     * Seluruh jadwal yang tergabung.
                     */
                    'jadwal' =>
                        $scheduleData,

                    /*
                     * Jadwal yang tersedia hari ini.
                     */
                    'jadwal_hari_ini' =>
                        $todaySchedule
                            ? [
                                'id' =>
                                    $todaySchedule->id,

                                'hari' =>
                                    $todaySchedule->day,

                                'waktu' =>
                                    substr(
                                        $todaySchedule->start_time,
                                        0,
                                        5
                                    )
                                    . ' - '
                                    . substr(
                                        $todaySchedule->end_time,
                                        0,
                                        5
                                    ),
                            ]
                            : null,

                    /*
                     * Jurnal terakhir minggu berjalan.
                     */
                    'jurnal_terakhir' =>
                        $latestJournal
                            ? [
                                'id' =>
                                    $latestJournal->id,

                                'tanggal' =>
                                    $latestJournal
                                        ->date
                                        ?->format('Y-m-d'),

                                'topic' =>
                                    $latestJournal->topic,

                                'description' =>
                                    $latestJournal
                                        ->description,

                                'is_holiday' =>
                                    $latestJournal
                                        ->is_holiday,

                                'holiday_name' =>
                                    $latestJournal
                                        ->holiday_name,
                            ]
                            : null,

                    /*
                     * Presensi minggu berjalan.
                     */
                    'presensi' => [
                        'hadir' =>
                            $attendanceCounts
                                ->get('hadir', 0),

                        'izin' =>
                            $attendanceCounts
                                ->get('izin', 0),

                        'sakit' =>
                            $attendanceCounts
                                ->get('sakit', 0),

                        'dispen' =>
                            $attendanceCounts
                                ->get('dispen', 0),

                        'alpa' =>
                            $attendanceCounts
                                ->get('alpa', 0),
                    ],

                    /*
                     * Status kelengkapan minggu berjalan.
                     */
                    'status' =>
                        $status,
                ];
            })
            ->sortBy(function ($item) {
                /*
                 * Card yang memiliki jadwal hari ini
                 * berada paling atas.
                 */
                return $item['jadwal_hari_ini'] !== null
                    ? 0
                    : 1;
            })
            ->values();

        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }

    /**
     * GET /api/guru/jurnal/{schedule}
     *
     * Menampilkan detail satu session jadwal,
     * daftar siswa, dan riwayat jurnal session tersebut.
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
                'message' =>
                    'Jadwal bukan milik guru yang sedang login.',
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

        /*
         * Ambil presensi hari ini.
         */
        $todayAttendances = Attendance::where(
            'schedule_id',
            $schedule->id
        )
            ->whereDate(
                'date',
                now()
            )
            ->get()
            ->keyBy('student_id');

        $students = $schedule->classroom?->users
            ->map(function ($student) use (
                $todayAttendances
            ) {
                $attendance =
                    $todayAttendances->get(
                        $student->id
                    );

                return [
                    'id' =>
                        $student->id,

                    'nama' =>
                        $student->name,

                    'email' =>
                        $student->email,

                    'status' =>
                        $attendance?->status
                        ?? 'hadir',

                    'notes' =>
                        $attendance?->notes
                        ?? '',
                ];
            })
            ->values()
            ?? collect();

        $journals = $schedule->journals
            ->map(function ($journal) {
                return [
                    'id' =>
                        $journal->id,

                    'tanggal' =>
                        $journal->date
                            ?->format('Y-m-d'),

                    'topic' =>
                        $journal->topic,

                    'description' =>
                        $journal->description,

                    'is_holiday' =>
                        $journal->is_holiday,

                    'holiday_name' =>
                        $journal->holiday_name,
                ];
            })
            ->values();

        return response()->json([
            'success' => true,

            'data' => [
                'schedule' => [
                    'id' =>
                        $schedule->id,

                    'kelas' =>
                        $schedule->classroom
                            ?->name ?? '-',

                    'mata_pelajaran' =>
                        $schedule->subject
                            ?->name ?? '-',

                    'hari' =>
                        $schedule->day,

                    'waktu' =>
                        substr(
                            $schedule->start_time,
                            0,
                            5
                        )
                        . ' - '
                        . substr(
                            $schedule->end_time,
                            0,
                            5
                        ),
                ],

                'students' =>
                    $students,

                'journals' =>
                    $journals,
            ],
        ]);
    }

    /**
     * POST /api/guru/jurnal/{schedule}/mulai
     *
     * Membuat jurnal sekaligus presensi siswa.
     *
     * Guru hanya dapat membuat jurnal untuk
     * schedule yang berlangsung pada hari ini.
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

        /*
         * Pastikan schedule milik guru.
         */
        if ($schedule->teacher_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' =>
                    'Jadwal bukan milik guru yang sedang login.',
            ], 403);
        }

        /*
         * ============================================================
         * VALIDASI HARI
         * ============================================================
         */
        $today = now()
            ->locale('id')
            ->translatedFormat('l');

        if ($schedule->day !== $today) {
            return response()->json([
                'success' => false,
                'message' =>
                    "Kelas hanya dapat dimulai pada hari {$schedule->day}. "
                    . "Hari ini adalah {$today}.",
            ], 422);
        }

        /*
         * ============================================================
         * VALIDASI REQUEST
         * ============================================================
         */
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

        /*
         * ============================================================
         * VALIDASI TANGGAL SESUAI HARI JADWAL
         * ============================================================
         */
        $journalDate = \Carbon\Carbon::parse(
            $validated['date']
        );

        $journalDateDay = $journalDate
            ->locale('id')
            ->translatedFormat('l');

        if ($journalDateDay !== $schedule->day) {
            return response()->json([
                'success' => false,
                'message' =>
                    "Tanggal jurnal harus sesuai dengan hari jadwal, "
                    . "yaitu {$schedule->day}.",
            ], 422);
        }

        /*
         * ============================================================
         * VALIDASI TANGGAL HARUS HARI INI
         * ============================================================
         */
        if (!$journalDate->isSameDay(now())) {
            return response()->json([
                'success' => false,
                'message' =>
                    'Jurnal hanya dapat dibuat untuk hari ini.',
            ], 422);
        }

        /*
         * ============================================================
         * VALIDASI SISWA
         * ============================================================
         */
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

        /*
         * ============================================================
         * CEGAH JURNAL DUPLIKAT
         * ============================================================
         */
        $existingJournal = Journal::where(
            'schedule_id',
            $schedule->id
        )
            ->whereDate(
                'date',
                $validated['date']
            )
            ->exists();

        if ($existingJournal) {
            return response()->json([
                'success' => false,
                'message' =>
                    'Jurnal untuk jadwal hari ini sudah dibuat.',
            ], 422);
        }

        /*
         * ============================================================
         * SIMPAN JURNAL + PRESENSI
         * ============================================================
         */
        $journal = DB::transaction(function () use (
            $validated,
            $schedule
        ) {
            $journal = Journal::create([
                'schedule_id' =>
                    $schedule->id,

                'date' =>
                    $validated['date'],

                'topic' =>
                    $validated['topic'],

                'description' =>
                    $validated['description']
                    ?? null,

                /*
                 * Jurnal yang dibuat guru
                 * bukan jurnal hari libur.
                 */
                'is_holiday' =>
                    false,

                'holiday_name' =>
                    null,
            ]);

            foreach ($validated['attendances'] as $attendance) {
                Attendance::updateOrCreate(
                    [
                        'schedule_id' =>
                            $schedule->id,

                        'student_id' =>
                            $attendance['student_id'],

                        'date' =>
                            $validated['date'],
                    ],
                    [
                        'status' =>
                            $attendance['status'],

                        'notes' =>
                            $attendance['notes']
                            ?? null,
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
                    'id' =>
                        $journal->id,

                    'schedule_id' =>
                        $journal->schedule_id,

                    'date' =>
                        $journal->date
                            ?->format('Y-m-d'),

                    'topic' =>
                        $journal->topic,

                    'description' =>
                        $journal->description,

                    'is_holiday' =>
                        $journal->is_holiday,

                    'holiday_name' =>
                        $journal->holiday_name,
                ],
            ],
        ], 201);
    }

    /**
     * GET /api/guru/jurnal/riwayat/{schedule}
     *
     * Menampilkan seluruh riwayat jurnal untuk kombinasi:
     *
     * classroom + subject
     *
     * Jadi apabila:
     *
     * XII - 1 + PPKn
     *
     * memiliki:
     *
     * Kamis
     * Jumat
     *
     * maka riwayat akan mengambil jurnal dari
     * Kamis DAN Jumat.
     *
     * Data dari minggu sebelumnya tetap ditampilkan.
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

        /*
         * Pastikan schedule milik guru.
         */
        if ($schedule->teacher_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' =>
                    'Akses jadwal ditolak.',
            ], 403);
        }

        /*
         * ============================================================
         * CARI SELURUH SCHEDULE DENGAN:
         *
         * classroom yang sama
         * subject yang sama
         * teacher yang sama
         * ============================================================
         */
        $groupScheduleIds = Schedule::where(
            'teacher_id',
            $user->id
        )
            ->where(
                'classroom_id',
                $schedule->classroom_id
            )
            ->where(
                'subject_id',
                $schedule->subject_id
            )
            ->pluck('id');

        /*
         * ============================================================
         * AMBIL SEMUA JURNAL DARI SELURUH SESSION
         * ============================================================
         */
        $journals = Journal::whereIn(
            'schedule_id',
            $groupScheduleIds
        )
            ->with([
                'schedule.classroom',
                'schedule.subject',
            ])
            ->latest('date')
            ->get()
            ->map(function ($journal) {
                return [
                    'id' =>
                        $journal->id,

                    'tanggal' =>
                        $journal->date
                            ?->format('Y-m-d'),

                    'topic' =>
                        $journal->topic,

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

                    /*
                     * Informasi hari libur.
                     */
                    'is_holiday' =>
                        $journal->is_holiday,

                    'holiday_name' =>
                        $journal->holiday_name,
                ];
            })
            ->values();

        return response()->json([
            'success' => true,
            'data' => $journals,
        ]);
    }
}