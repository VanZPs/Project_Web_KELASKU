<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Schedule;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ScheduleController extends Controller
{
    /**
     * Menampilkan jadwal.
     *
     * Guru:
     * - Hanya melihat jadwal miliknya sendiri.
     *
     * Siswa:
     * - Melihat jadwal berdasarkan kelasnya.
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
     * Menambahkan jadwal baru oleh guru.
     *
     * Kelas utama:
     * {
     *     "classroom_id": 1,
     *     "schedules": [
     *         {
     *             "day": "Senin",
     *             "start_time": "07:00",
     *             "end_time": "08:30"
     *         }
     *     ]
     * }
     *
     * Kelas tambahan:
     * {
     *     "classroom_id": 1,
     *     "subject_id": 2,
     *     "schedules": [
     *         {
     *             "day": "Senin",
     *             "start_time": "09:15",
     *             "end_time": "10:45"
     *         }
     *     ]
     * }
     */
    public function store(Request $request)
    {
        $user = $request->user();

        /*
         * Hanya guru yang boleh membuat jadwal.
         */
        if ($user->role !== 'guru') {
            return response()->json([
                'success' => false,
                'message' =>
                    'Hanya guru yang dapat menambahkan jadwal.',
            ], 403);
        }

        /*
         * Pastikan data guru tersedia.
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
         * Validasi request.
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
         * ---------------------------------------------------------
         * MENENTUKAN MATA PELAJARAN
         * ---------------------------------------------------------
         *
         * Jika subject_id dikirim:
         * → berarti kelas tambahan.
         *
         * Jika subject_id tidak dikirim:
         * → gunakan mata pelajaran utama guru.
         */

        if (!empty($validated['subject_id'])) {
            /*
             * Pastikan mata pelajaran tersebut memang
             * dimiliki/diajarkan oleh guru.
             */
            $hasSubject = $teacher
                ->subjects()
                ->where(
                    'subjects.id',
                    $validated['subject_id']
                )
                ->exists();

            if (!$hasSubject) {
                return response()->json([
                    'success' => false,
                    'message' =>
                        'Mata pelajaran tersebut bukan mata pelajaran yang Anda ajarkan.',
                ], 422);
            }

            $subjectId =
                (int) $validated['subject_id'];
        } else {
            /*
             * Untuk sementara, mata pelajaran utama
             * menggunakan mata pelajaran pertama guru.
             *
             * Jika nanti database sudah mempunyai
             * penanda mata pelajaran utama, bagian ini
             * dapat diubah menggunakan is_primary.
             */
            $mainSubject = $teacher
                ->subjects()
                ->orderBy('subjects.id')
                ->first();

            if (!$mainSubject) {
                return response()->json([
                    'success' => false,
                    'message' =>
                        'Guru belum memiliki mata pelajaran.',
                ], 422);
            }

            $subjectId =
                (int) $mainSubject->id;
        }

        /*
         * ---------------------------------------------------------
         * KONFIGURASI JAM SEKOLAH
         * ---------------------------------------------------------
         */

        $schoolStart = 7 * 60;   // 07:00
        $schoolEnd = 16 * 60;    // 16:00

        /*
         * 1 JP = 45 menit.
         */
        $lessonDuration = 45;

        $validDays = [
            'Senin',
            'Selasa',
            'Rabu',
            'Kamis',
            'Jumat',
            'Sabtu',
        ];

        /*
         * Menampung jadwal yang dikirim dalam request.
         *
         * Digunakan untuk mengecek bentrok
         * antar jadwal dalam request yang sama.
         */
        $newSchedules = [];

        /*
         * ---------------------------------------------------------
         * VALIDASI SETIAP JADWAL
         * ---------------------------------------------------------
         */
        foreach ($validated['schedules'] as $schedule) {
            $day =
                $schedule['day'];

            $startTime =
                $schedule['start_time'];

            $endTime =
                $schedule['end_time'];

            /*
             * Pastikan hari valid.
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
             * Konversi waktu mulai menjadi menit.
             */
            [
                $startHour,
                $startMinute
            ] = array_map(
                'intval',
                explode(':', $startTime)
            );

            /*
             * Konversi waktu selesai menjadi menit.
             */
            [
                $endHour,
                $endMinute
            ] = array_map(
                'intval',
                explode(':', $endTime)
            );

            $startMinutes =
                ($startHour * 60) +
                $startMinute;

            $endMinutes =
                ($endHour * 60) +
                $endMinute;

            /*
             * Pastikan berada di antara
             * 07:00 - 16:00.
             */
            if (
                $startMinutes < $schoolStart ||
                $endMinutes > $schoolEnd
            ) {
                return response()->json([
                    'success' => false,
                    'message' =>
                        'Jadwal harus berada antara pukul 07:00 sampai 16:00.',
                ], 422);
            }

            /*
             * Waktu mulai harus lebih kecil
             * daripada waktu selesai.
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
             * Hitung durasi.
             */
            $duration =
                $endMinutes -
                $startMinutes;

            /*
             * Durasi harus kelipatan 45 menit.
             */
            if (
                $duration % $lessonDuration !== 0
            ) {
                return response()->json([
                    'success' => false,
                    'message' =>
                        "Durasi jadwal {$day} {$startTime} - {$endTime} harus merupakan kelipatan 45 menit.",
                ], 422);
            }

            /*
             * -----------------------------------------------------
             * CEK BENTROK ANTAR DATA REQUEST
             * -----------------------------------------------------
             */
            foreach (
                $newSchedules
                as $existingNewSchedule
            ) {
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
         * ---------------------------------------------------------
         * SIMPAN KE DATABASE
         * ---------------------------------------------------------
         *
         * Transaction digunakan supaya:
         *
         * - Jika semua berhasil → commit.
         * - Jika satu gagal → rollback semuanya.
         */
        try {
            $createdSchedules =
                DB::transaction(
                    function () use (
                        $validated,
                        $user,
                        $subjectId,
                        $newSchedules
                    ) {
                        /*
                         * Ambil jadwal yang berpotensi bentrok:
                         *
                         * 1. Jadwal pada kelas yang sama.
                         * 2. Jadwal milik guru yang sama.
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
                         * -------------------------------------------------
                         * CEK SETIAP JADWAL BARU
                         * -------------------------------------------------
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

                            /*
                             * Bandingkan dengan jadwal
                             * yang sudah ada di database.
                             */
                            foreach (
                                $existingSchedules
                                as $existing
                            ) {
                                /*
                                 * Jadwal di hari berbeda
                                 * tidak mungkin bentrok.
                                 */
                                if (
                                    $existing->day
                                    !== $day
                                ) {
                                    continue;
                                }

                                /*
                                 * Ambil HH:MM dari waktu database.
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
                                 * Konversi start time.
                                 */
                                [
                                    $existingStartHour,
                                    $existingStartMinute
                                ] = array_map(
                                    'intval',
                                    explode(
                                        ':',
                                        $existingStartTime
                                    )
                                );

                                /*
                                 * Konversi end time.
                                 */
                                [
                                    $existingEndHour,
                                    $existingEndMinute
                                ] = array_map(
                                    'intval',
                                    explode(
                                        ':',
                                        $existingEndTime
                                    )
                                );

                                $existingStart =
                                    (
                                        $existingStartHour
                                        * 60
                                    ) +
                                    $existingStartMinute;

                                $existingEnd =
                                    (
                                        $existingEndHour
                                        * 60
                                    ) +
                                    $existingEndMinute;

                                /*
                                 * -------------------------------------------------
                                 * RUMUS BENTROK
                                 * -------------------------------------------------
                                 */
                                $overlap =
                                    $existingStart < $newEnd &&
                                    $existingEnd > $newStart;

                                if (!$overlap) {
                                    continue;
                                }

                                /*
                                 * -------------------------------------------------
                                 * BENTROK DENGAN GURU SENDIRI
                                 * -------------------------------------------------
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
                                 * -------------------------------------------------
                                 * BENTROK DENGAN KELAS
                                 * -------------------------------------------------
                                 *
                                 * Guru lain tidak boleh menggunakan
                                 * kelas yang sama pada waktu yang sama.
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
                         * -------------------------------------------------
                         * BUAT JADWAL
                         * -------------------------------------------------
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
             * Load relasi untuk response.
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
             * Error validasi yang memang kita buat sendiri.
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
     * Mengambil seluruh jadwal untuk kalender guru.
     *
     * Endpoint:
     * GET /api/guru/jadwal-terpakai
     *
     * Digunakan frontend untuk membedakan:
     *
     * - Jadwal guru yang sedang login
     *   → light blue
     *
     * - Jadwal guru lain
     *   → merah
     */
    public function occupied(Request $request)
    {
        $user = $request->user();

        /*
         * Hanya guru yang membutuhkan
         * informasi jadwal ini.
         */
        if ($user->role !== 'guru') {
            return response()->json([
                'success' => false,

                'message' =>
                    'Hanya guru yang dapat mengakses data jadwal.',
            ], 403);
        }

        /*
         * Ambil SEMUA jadwal.
         *
         * Sebelumnya endpoint ini hanya mengambil
         * jadwal guru lain menggunakan:
         *
         * where('teacher_id', '!=', $user->id)
         *
         * Sekarang semua jadwal dikirim agar frontend
         * dapat membedakan jadwal milik sendiri dan
         * jadwal guru lain.
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
                             * jadwal milik guru yang sedang login.
                             *
                             * False:
                             * jadwal milik guru lain.
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