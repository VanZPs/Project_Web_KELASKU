<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Classroom;
use App\Models\Schedule;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ScheduleController extends Controller
{
    /**
     * ==========================================================
     * KONFIGURASI JAM PELAJARAN SEKOLAH
     * ==========================================================
     *
     * JP 1  : 07:00 - 07:45
     * JP 2  : 07:45 - 08:30
     * JP 3  : 08:30 - 09:15
     *
     * Istirahat:
     * 09:15 - 09:30
     *
     * JP 4  : 09:30 - 10:15
     * JP 5  : 10:15 - 11:00
     * JP 6  : 11:00 - 11:45
     *
     * Istirahat:
     * 11:45 - 12:30
     *
     * JP 7  : 12:30 - 13:10
     * JP 8  : 13:10 - 13:50
     * JP 9  : 13:50 - 14:30
     * JP 10 : 14:30 - 15:15
     */
    private function lessonSlots(): array
    {
        return [
            [
                'jp' => 1,
                'start' => '07:00',
                'end' => '07:45',
                'duration' => 45,
            ],
            [
                'jp' => 2,
                'start' => '07:45',
                'end' => '08:30',
                'duration' => 45,
            ],
            [
                'jp' => 3,
                'start' => '08:30',
                'end' => '09:15',
                'duration' => 45,
            ],

            [
                'break' => true,
                'start' => '09:15',
                'end' => '09:30',
                'duration' => 15,
            ],

            [
                'jp' => 4,
                'start' => '09:30',
                'end' => '10:15',
                'duration' => 45,
            ],
            [
                'jp' => 5,
                'start' => '10:15',
                'end' => '11:00',
                'duration' => 45,
            ],
            [
                'jp' => 6,
                'start' => '11:00',
                'end' => '11:45',
                'duration' => 45,
            ],

            [
                'break' => true,
                'start' => '11:45',
                'end' => '12:30',
                'duration' => 45,
            ],

            [
                'jp' => 7,
                'start' => '12:30',
                'end' => '13:10',
                'duration' => 40,
            ],
            [
                'jp' => 8,
                'start' => '13:10',
                'end' => '13:50',
                'duration' => 40,
            ],
            [
                'jp' => 9,
                'start' => '13:50',
                'end' => '14:30',
                'duration' => 40,
            ],
            [
                'jp' => 10,
                'start' => '14:30',
                'end' => '15:15',
                'duration' => 45,
            ],
        ];
    }

    /**
     * ==========================================================
     * KONVERSI WAKTU KE MENIT
     * ==========================================================
     */
    private function timeToMinutes(string $time): int
    {
        [$hour, $minute] = array_map(
            'intval',
            explode(':', substr($time, 0, 5))
        );

        return ($hour * 60) + $minute;
    }

    /**
     * ==========================================================
     * MENCARI SLOT JP BERDASARKAN WAKTU MULAI
     * ==========================================================
     */
    private function findLessonSlot(string $startTime): ?array
    {
        $startTime = substr($startTime, 0, 5);

        foreach ($this->lessonSlots() as $slot) {
            if (
                isset($slot['jp']) &&
                $slot['start'] === $startTime
            ) {
                return $slot;
            }
        }

        return null;
    }

    /**
     * ==========================================================
     * MENCARI SLOT JP BERDASARKAN WAKTU SELESAI
     * ==========================================================
     */
    private function findLessonSlotByEnd(string $endTime): ?array
    {
        $endTime = substr($endTime, 0, 5);

        foreach ($this->lessonSlots() as $slot) {
            if (
                isset($slot['jp']) &&
                $slot['end'] === $endTime
            ) {
                return $slot;
            }
        }

        return null;
    }

    /**
     * ==========================================================
     * VALIDASI RENTANG WAKTU SESUAI SLOT SEKOLAH
     * ==========================================================
     */
    private function isValidLessonRange(
        string $startTime,
        string $endTime
    ): bool {
        $slots = $this->lessonSlots();

        $startTime = substr($startTime, 0, 5);
        $endTime = substr($endTime, 0, 5);

        /*
         * Start harus merupakan awal JP.
         */
        $startIndex = null;

        foreach ($slots as $index => $slot) {
            if (
                isset($slot['jp']) &&
                $slot['start'] === $startTime
            ) {
                $startIndex = $index;
                break;
            }
        }

        if ($startIndex === null) {
            return false;
        }

        /*
         * End harus merupakan akhir JP.
         */
        $endIndex = null;

        foreach ($slots as $index => $slot) {
            if (
                isset($slot['jp']) &&
                $slot['end'] === $endTime
            ) {
                $endIndex = $index;
                break;
            }
        }

        if ($endIndex === null) {
            return false;
        }

        /*
         * End harus berada setelah start.
         */
        if ($endIndex <= $startIndex) {
            return false;
        }

        /*
         * Pastikan tidak ada break di tengah rentang.
         */
        for (
            $index = $startIndex;
            $index <= $endIndex;
            $index++
        ) {
            if (
                isset($slots[$index]['break']) &&
                $slots[$index]['break'] === true
            ) {
                return false;
            }
        }

        return true;
    }

    /**
     * ==========================================================
     * GET /api/schedules
     * ==========================================================
     */
    public function index(Request $request)
    {
        $user = $request->user();

        if ($user->role === 'guru') {
            $schedules = Schedule::with([
                'classroom:id,name',
                'subject:id,name',
            ])
                ->where('teacher_id', $user->id)
                ->orderBy('day')
                ->orderBy('start_time')
                ->get();
        } else {
            $classroomIds = $user
                ->classrooms()
                ->pluck('classrooms.id');

            $schedules = Schedule::with([
                'classroom:id,name',
                'subject:id,name',
            ])
                ->whereIn(
                    'classroom_id',
                    $classroomIds
                )
                ->orderBy('day')
                ->orderBy('start_time')
                ->get();
        }

        return response()->json([
            'success' => true,
            'data' => $schedules,
        ]);
    }

    /**
     * ==========================================================
     * POST /api/guru/kelas
     * ==========================================================
     *
     * Menambahkan jadwal baru oleh guru.
     *
     * Kelas utama:
     * - subject_id tidak dikirim.
     * - Sistem menggunakan subject dengan is_primary = true.
     *
     * Kelas tambahan:
     * - subject_id dikirim.
     * - Subject boleh belum terdaftar pada teacher_subject.
     * - Jika belum terdaftar, otomatis didaftarkan sebagai
     *   subject tambahan dengan is_primary = false.
     */
    public function store(Request $request)
    {
        $user = $request->user();

        /*
         * ------------------------------------------------------
         * VALIDASI ROLE
         * ------------------------------------------------------
         */
        if ($user->role !== 'guru') {
            return response()->json([
                'success' => false,
                'message' =>
                    'Hanya guru yang dapat menambahkan jadwal.',
            ], 403);
        }

        /*
         * ------------------------------------------------------
         * PASTIKAN DATA GURU TERSEDIA
         * ------------------------------------------------------
         */
        $teacher = $user->teacher;

        if (!$teacher) {
            return response()->json([
                'success' => false,
                'message' =>
                    'Data guru tidak ditemukan.',
            ], 404);
        }

        /*
         * ------------------------------------------------------
         * VALIDASI REQUEST
         * ------------------------------------------------------
         */
        $validated = $request->validate([
            'classroom_id' => [
                'required',
                'integer',
                'exists:classrooms,id',
            ],

            'subject_id' => [
                'nullable',
                'integer',
                'exists:subjects,id',
            ],

            'schedules' => [
                'required',
                'array',
                'min:1',
            ],

            'schedules.*.day' => [
                'required',
                'string',
                'in:Senin,Selasa,Rabu,Kamis,Jumat,Sabtu',
            ],

            'schedules.*.start_time' => [
                'required',
                'date_format:H:i',
            ],

            'schedules.*.end_time' => [
                'required',
                'date_format:H:i',
            ],
        ]);

        /*
         * ------------------------------------------------------
         * TENTUKAN JENIS KELAS
         * ------------------------------------------------------
         *
         * subject_id ada
         * → Kelas tambahan.
         *
         * subject_id tidak ada
         * → Kelas utama.
         */
        $isAdditionalClass =
            !empty($validated['subject_id']);

        /*
         * subject_id yang nantinya digunakan
         * pada tabel schedules.
         */
        $subjectId = null;

        /*
         * ------------------------------------------------------
         * TENTUKAN SUBJECT
         * ------------------------------------------------------
         */
        if ($isAdditionalClass) {
            /*
             * --------------------------------------------------
             * KELAS TAMBAHAN
             * --------------------------------------------------
             */
            $subjectId =
                (int) $validated['subject_id'];

            /*
             * Cari apakah subject sudah terdaftar
             * pada guru.
             */
            $teacherSubject =
                $teacher
                    ->subjects()
                    ->where(
                        'subjects.id',
                        $subjectId
                    )
                    ->first();

            /*
             * Jika sudah terdaftar dan merupakan
             * subject utama, tidak boleh digunakan
             * sebagai kelas tambahan.
             */
            if (
                $teacherSubject &&
                (bool) $teacherSubject->pivot->is_primary
            ) {
                return response()->json([
                    'success' => false,
                    'message' =>
                        'Mata pelajaran utama tidak dapat digunakan sebagai kelas tambahan.',
                ], 422);
            }

            /*
             * Jika belum terdaftar, subject akan
             * otomatis ditambahkan ke teacher_subject
             * sebagai subject tambahan.
             *
             * Proses attach dilakukan nanti di dalam
             * transaction agar dapat di-rollback jika
             * pembuatan jadwal gagal.
             */
        } else {
            /*
             * --------------------------------------------------
             * KELAS UTAMA
             * --------------------------------------------------
             *
             * Cari subject yang benar-benar memiliki
             * is_primary = true.
             */
            $mainSubject = $teacher
                ->subjects()
                ->wherePivot(
                    'is_primary',
                    true
                )
                ->first();

            if (!$mainSubject) {
                return response()->json([
                    'success' => false,
                    'message' =>
                        'Guru belum memiliki mata pelajaran utama.',
                ], 422);
            }

            $subjectId =
                (int) $mainSubject->id;
        }

        /*
         * ------------------------------------------------------
         * DAFTAR HARI
         * ------------------------------------------------------
         */
        $validDays = [
            'Senin',
            'Selasa',
            'Rabu',
            'Kamis',
            'Jumat',
            'Sabtu',
        ];

        /*
         * ------------------------------------------------------
         * BATAS WAKTU SEKOLAH
         * ------------------------------------------------------
         */
        $schoolStart =
            $this->timeToMinutes('07:00');

        $schoolEnd =
            $this->timeToMinutes('15:15');

        /*
         * Menampung jadwal baru.
         *
         * Digunakan untuk mengecek bentrok
         * antar data dalam request yang sama.
         */
        $newSchedules = [];

        /*
         * ------------------------------------------------------
         * VALIDASI SETIAP JADWAL
         * ------------------------------------------------------
         */
        foreach ($validated['schedules'] as $schedule) {
            $day =
                $schedule['day'];

            $startTime =
                $schedule['start_time'];

            $endTime =
                $schedule['end_time'];

            /*
             * --------------------------------------------------
             * VALIDASI HARI
             * --------------------------------------------------
             */
            if (!in_array(
                $day,
                $validDays,
                true
            )) {
                return response()->json([
                    'success' => false,
                    'message' =>
                        "Hari {$day} tidak valid.",
                ], 422);
            }

            /*
             * --------------------------------------------------
             * KONVERSI WAKTU
             * --------------------------------------------------
             */
            $startMinutes =
                $this->timeToMinutes(
                    $startTime
                );

            $endMinutes =
                $this->timeToMinutes(
                    $endTime
                );

            /*
             * --------------------------------------------------
             * BATAS WAKTU SEKOLAH
             * --------------------------------------------------
             */
            if (
                $startMinutes < $schoolStart ||
                $endMinutes > $schoolEnd
            ) {
                return response()->json([
                    'success' => false,
                    'message' =>
                        "Jadwal {$day} {$startTime} - {$endTime} berada di luar jam pelajaran sekolah.",
                ], 422);
            }

            /*
             * --------------------------------------------------
             * START < END
             * --------------------------------------------------
             */
            if (
                $startMinutes >= $endMinutes
            ) {
                return response()->json([
                    'success' => false,
                    'message' =>
                        "Waktu {$day} {$startTime} - {$endTime} tidak valid.",
                ], 422);
            }

            /*
             * --------------------------------------------------
             * VALIDASI SLOT RESMI SEKOLAH
             * --------------------------------------------------
             */
            if (!$this->isValidLessonRange(
                $startTime,
                $endTime
            )) {
                return response()->json([
                    'success' => false,
                    'message' =>
                        "Waktu {$day} {$startTime} - {$endTime} tidak sesuai dengan slot jam pelajaran sekolah atau melewati waktu istirahat.",
                ], 422);
            }

            /*
             * --------------------------------------------------
             * CEK SLOT START
             * --------------------------------------------------
             */
            $startSlot =
                $this->findLessonSlot(
                    $startTime
                );

            if (!$startSlot) {
                return response()->json([
                    'success' => false,
                    'message' =>
                        "Waktu mulai {$startTime} bukan merupakan awal jam pelajaran yang valid.",
                ], 422);
            }

            /*
             * --------------------------------------------------
             * CEK SLOT END
             * --------------------------------------------------
             */
            $endSlot =
                $this->findLessonSlotByEnd(
                    $endTime
                );

            if (!$endSlot) {
                return response()->json([
                    'success' => false,
                    'message' =>
                        "Waktu selesai {$endTime} bukan merupakan akhir jam pelajaran yang valid.",
                ], 422);
            }

            /*
             * --------------------------------------------------
             * CEK BENTROK ANTAR REQUEST
             * --------------------------------------------------
             */
            foreach (
                $newSchedules
                as $existingNewSchedule
            ) {
                /*
                 * Hari berbeda tidak mungkin bentrok.
                 */
                if (
                    $existingNewSchedule['day']
                    !== $day
                ) {
                    continue;
                }

                $existingStart =
                    $existingNewSchedule[
                        'start_minutes'
                    ];

                $existingEnd =
                    $existingNewSchedule[
                        'end_minutes'
                    ];

                $overlap =
                    $existingStart < $endMinutes &&
                    $existingEnd > $startMinutes;

                if ($overlap) {
                    return response()->json([
                        'success' => false,
                        'message' =>
                            "Terdapat jadwal yang saling bertabrakan pada hari {$day} pukul {$startTime} - {$endTime}.",
                    ], 422);
                }
            }

            /*
             * --------------------------------------------------
             * SIMPAN KE ARRAY TEMPORARY
             * --------------------------------------------------
             */
            $newSchedules[] = [
                'day' =>
                    $day,

                'start_time' =>
                    $startTime,

                'end_time' =>
                    $endTime,

                'start_minutes' =>
                    $startMinutes,

                'end_minutes' =>
                    $endMinutes,
            ];
        }

        /*
         * ------------------------------------------------------
         * SIMPAN KE DATABASE
         * ------------------------------------------------------
         *
         * Auto-register subject tambahan dan pembuatan
         * jadwal berada dalam transaction yang sama.
         */
        try {
            $createdSchedules =
                DB::transaction(
                    function () use (
                        $validated,
                        $user,
                        $teacher,
                        $subjectId,
                        $isAdditionalClass,
                        $newSchedules
                    ) {
                        /*
                         * --------------------------------------------------
                         * LOCK CLASSROOM
                         * --------------------------------------------------
                         *
                         * Pastikan data kelas yang dipakai
                         * masih valid ketika transaction berjalan.
                         */
                        $classroom =
                            Classroom::query()
                                ->lockForUpdate()
                                ->find(
                                    $validated[
                                        'classroom_id'
                                    ]
                                );

                        if (!$classroom) {
                            throw ValidationException::withMessages([
                                'classroom_id' =>
                                    'Kelas yang dipilih tidak ditemukan.',
                            ]);
                        }

                        /*
                         * --------------------------------------------------
                         * CEK KELAS DIARSIPKAN
                         * --------------------------------------------------
                         *
                         * Kelas yang sudah diarsipkan tidak boleh
                         * digunakan untuk membuat jadwal baru.
                         *
                         * Diasumsikan kolom yang digunakan adalah
                         * "is_archived".
                         */
                        if (
                            isset($classroom->is_archived) &&
                            $classroom->is_archived
                        ) {
                            throw ValidationException::withMessages([
                                'classroom_id' =>
                                    'Kelas yang dipilih sudah diarsipkan dan tidak dapat digunakan untuk membuat jadwal baru.',
                            ]);
                        }

                        /*
                         * --------------------------------------------------
                         * AUTO REGISTER SUBJECT TAMBAHAN
                         * --------------------------------------------------
                         *
                         * Jika subject tambahan belum dimiliki guru,
                         * otomatis daftarkan sebagai subject tambahan.
                         */
                        if ($isAdditionalClass) {
                            $teacherSubject =
                                $teacher
                                    ->subjects()
                                    ->where(
                                        'subjects.id',
                                        $subjectId
                                    )
                                    ->first();

                            /*
                             * Subject belum terdaftar.
                             */
                            if (!$teacherSubject) {
                                $teacher
                                    ->subjects()
                                    ->attach(
                                        $subjectId,
                                        [
                                            'is_primary' =>
                                                false,
                                        ]
                                    );
                            } else {
                                /*
                                 * Subject sudah terdaftar sebagai
                                 * subject utama.
                                 *
                                 * Pengecekan ini dilakukan lagi
                                 * di dalam transaction untuk
                                 * menjaga konsistensi data.
                                 */
                                if (
                                    (bool)
                                        $teacherSubject
                                            ->pivot
                                            ->is_primary
                                ) {
                                    throw ValidationException::withMessages([
                                        'subject_id' =>
                                            'Mata pelajaran utama tidak dapat digunakan sebagai kelas tambahan.',
                                    ]);
                                }
                            }
                        }

                        /*
                         * --------------------------------------------------
                         * AMBIL SEMUA JADWAL YANG BERPOTENSI BENTROK
                         * --------------------------------------------------
                         *
                         * 1. Jadwal pada kelas yang sama.
                         * 2. Jadwal guru yang sama.
                         */
                        $existingSchedules =
                            Schedule::query()
                                ->where(
                                    function ($query) use (
                                        $validated,
                                        $user
                                    ) {
                                        $query
                                            ->where(
                                                'classroom_id',
                                                $validated[
                                                    'classroom_id'
                                                ]
                                            )
                                            ->orWhere(
                                                'teacher_id',
                                                $user->id
                                            );
                                    }
                                )
                                ->lockForUpdate()
                                ->get([
                                    'id',
                                    'classroom_id',
                                    'teacher_id',
                                    'day',
                                    'start_time',
                                    'end_time',
                                ]);

                        /*
                         * --------------------------------------------------
                         * CEK BENTROK DENGAN DATABASE
                         * --------------------------------------------------
                         */
                        foreach (
                            $newSchedules
                            as $newSchedule
                        ) {
                            $newStart =
                                $newSchedule[
                                    'start_minutes'
                                ];

                            $newEnd =
                                $newSchedule[
                                    'end_minutes'
                                ];

                            $day =
                                $newSchedule[
                                    'day'
                                ];

                            foreach (
                                $existingSchedules
                                as $existing
                            ) {
                                /*
                                 * Hari berbeda tidak bentrok.
                                 */
                                if (
                                    $existing->day
                                    !== $day
                                ) {
                                    continue;
                                }

                                /*
                                 * Normalisasi waktu database
                                 * menjadi HH:MM.
                                 */
                                $existingStartTime =
                                    substr(
                                        (string)
                                            $existing->start_time,
                                        0,
                                        5
                                    );

                                $existingEndTime =
                                    substr(
                                        (string)
                                            $existing->end_time,
                                        0,
                                        5
                                    );

                                /*
                                 * Konversi waktu existing
                                 * menjadi menit.
                                 */
                                $existingStart =
                                    $this->timeToMinutes(
                                        $existingStartTime
                                    );

                                $existingEnd =
                                    $this->timeToMinutes(
                                        $existingEndTime
                                    );

                                /*
                                 * --------------------------------------------------
                                 * RUMUS BENTROK
                                 * --------------------------------------------------
                                 */
                                $overlap =
                                    $existingStart < $newEnd &&
                                    $existingEnd > $newStart;

                                if (!$overlap) {
                                    continue;
                                }

                                /*
                                 * --------------------------------------------------
                                 * BENTROK DENGAN GURU SENDIRI
                                 * --------------------------------------------------
                                 */
                                if (
                                    (int)
                                        $existing->teacher_id
                                    ===
                                    (int)
                                        $user->id
                                ) {
                                    throw ValidationException::withMessages([
                                        'schedules' =>
                                            "Anda sudah memiliki jadwal pada hari {$day} pukul {$existingStartTime} - {$existingEndTime}. Silakan pilih jam lain.",
                                    ]);
                                }

                                /*
                                 * --------------------------------------------------
                                 * BENTROK DENGAN KELAS
                                 * --------------------------------------------------
                                 */
                                if (
                                    (int)
                                        $existing->classroom_id
                                    ===
                                    (int)
                                        $validated[
                                            'classroom_id'
                                        ]
                                ) {
                                    throw ValidationException::withMessages([
                                        'classroom_id' =>
                                            "Kelas yang dipilih sudah memiliki jadwal pada hari {$day} pukul {$existingStartTime} - {$existingEndTime}. Silakan pilih jam lain.",
                                    ]);
                                }
                            }
                        }

                        /*
                         * --------------------------------------------------
                         * BUAT JADWAL
                         * --------------------------------------------------
                         */
                        $created = [];

                        foreach (
                            $newSchedules
                            as $newSchedule
                        ) {
                            $created[] =
                                Schedule::create([
                                    'classroom_id' =>
                                        $validated[
                                            'classroom_id'
                                        ],

                                    'subject_id' =>
                                        $subjectId,

                                    /*
                                     * teacher_id menggunakan
                                     * users.id.
                                     */
                                    'teacher_id' =>
                                        $user->id,

                                    'day' =>
                                        $newSchedule[
                                            'day'
                                        ],

                                    'start_time' =>
                                        $newSchedule[
                                            'start_time'
                                        ],

                                    'end_time' =>
                                        $newSchedule[
                                            'end_time'
                                        ],
                                ]);
                        }

                        return $created;
                    }
                );

            /*
             * ------------------------------------------------------
             * LOAD RELASI
             * ------------------------------------------------------
             */
            $createdSchedules =
                collect(
                    $createdSchedules
                )->map(
                    function ($schedule) {
                        return $schedule->load([
                            'classroom:id,name',
                            'subject:id,name',
                        ]);
                    }
                );

            return response()->json([
                'success' => true,

                'message' =>
                    'Jadwal berhasil ditambahkan.',

                'data' =>
                    $createdSchedules,
            ], 201);
        } catch (
            ValidationException $e
        ) {
            /*
             * Error validasi yang kita buat sendiri.
             */
            return response()->json([
                'success' => false,

                'message' =>
                    collect(
                        $e->errors()
                    )
                        ->flatten()
                        ->first()
                        ??
                        'Jadwal tidak dapat ditambahkan.',

                'errors' =>
                    $e->errors(),
            ], 422);
        } catch (
            \Throwable $e
        ) {
            /*
             * Simpan detail error ke Laravel log.
             */
            report($e);

            return response()->json([
                'success' => false,

                'message' =>
                    'Terjadi kesalahan saat menyimpan jadwal.',
            ], 500);
        }
    }

    /**
     * ==========================================================
     * GET /api/guru/jadwal-terpakai
     * ==========================================================
     *
     * Mengambil seluruh jadwal untuk kalender guru.
     */
    public function occupied(Request $request)
    {
        $user = $request->user();

        /*
         * ------------------------------------------------------
         * VALIDASI ROLE
         * ------------------------------------------------------
         */
        if ($user->role !== 'guru') {
            return response()->json([
                'success' => false,

                'message' =>
                    'Hanya guru yang dapat mengakses data jadwal.',
            ], 403);
        }

        /*
         * ------------------------------------------------------
         * AMBIL SEMUA JADWAL
         * ------------------------------------------------------
         */
        $schedules =
            Schedule::query()
                ->select([
                    'id',
                    'day',
                    'start_time',
                    'end_time',
                    'teacher_id',
                    'classroom_id',
                    'subject_id',
                ])
                ->orderBy('day')
                ->orderBy('start_time')
                ->get()
                ->map(
                    function ($schedule) use ($user) {
                        return [
                            'id' =>
                                $schedule->id,

                            'day' =>
                                $schedule->day,

                            'start_time' =>
                                $schedule->start_time,

                            'end_time' =>
                                $schedule->end_time,

                            'teacher_id' =>
                                $schedule->teacher_id,

                            'classroom_id' =>
                                $schedule->classroom_id,

                            'subject_id' =>
                                $schedule->subject_id,

                            /*
                             * True:
                             * jadwal guru yang sedang login.
                             *
                             * False:
                             * jadwal guru lain.
                             */
                            'is_mine' =>
                                (int) $schedule->teacher_id
                                ===
                                (int) $user->id,
                        ];
                    }
                );

        return response()->json([
            'success' => true,

            'data' =>
                $schedules,
        ]);
    }
}