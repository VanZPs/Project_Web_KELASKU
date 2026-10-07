<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Assignment;
use App\Models\AssignmentFile;
use App\Models\AssignmentOption;
use App\Models\AssignmentQuestion;
use App\Models\Schedule;
use App\Models\Student;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class AssignmentController extends Controller
{
    /**
     * Memastikan user yang login adalah guru.
     */
    private function ensureTeacher(Request $request)
    {
        $user = $request->user();

        abort_unless(
            $user && $user->role === 'guru',
            403,
            'Akses hanya untuk guru.'
        );

        return $user;
    }

    /**
     * Memastikan seluruh schedule merupakan milik guru yang sedang login.
     *
     * Digunakan ketika membuat tugas dengan beberapa schedule sekaligus.
     */
    private function getTeacherSchedules(
        Request $request,
        array $scheduleIds
    ) {
        $user = $this->ensureTeacher($request);

        $scheduleIds = array_values(array_unique(
            array_map('intval', $scheduleIds)
        ));

        $schedules = Schedule::with([
            'classroom',
            'subject',
        ])
            ->whereIn('id', $scheduleIds)
            ->where('teacher_id', $user->id)
            ->get();

        abort_unless(
            $schedules->count() === count($scheduleIds),
            403,
            'Satu atau lebih jadwal bukan milik Anda atau tidak ditemukan.'
        );

        return $schedules;
    }

    /**
     * Memastikan schedule/classroom tertentu memang terkait dengan assignment
     * dan merupakan milik guru yang sedang login.
     */
/**
     * Memastikan siswa hanya dapat mengakses komentar dari kelasnya sendiri
     * dan assignment tersebut memang diberikan ke kelas tersebut.
     */
/**
     * Mengambil komentar assignment hanya untuk classroom tertentu.
     */
/**
     * Daftar tugas milik guru yang sedang login.
     */
    public function index(Request $request)
    {
        $user = $this->ensureTeacher($request);

        $assignments = Assignment::with([
            'schedules.classroom',
            'schedules.subject',
            'questions.options',
            'files',
        ])
            ->whereHas('schedules', function ($query) use ($user) {
                $query->where('teacher_id', $user->id);
            })
            ->where('status', '!=', 'draft')
            ->latest()
            ->get();

        return response()->json([
            'message' => 'Daftar tugas berhasil diambil.',
            'data' => $assignments,
        ]);
    }

    /**
     * Membuat tugas baru.
     *
     * Struktur request:
     *
     * schedule_ids[]
     * title
     * description
     * start_date
     * due_date
     * submission_mode
     * questions[]
     * files[]
     */
    public function store(Request $request)
    {
        $this->ensureTeacher($request);

        $validator = Validator::make($request->all(), [
            'schedule_ids' => [
                'required',
                'array',
                'min:1',
            ],

            'schedule_ids.*' => [
                'required',
                'integer',
                'distinct',
                'exists:schedules,id',
            ],

            'title' => [
                'required',
                'string',
                'max:255',
            ],

            'description' => [
                'nullable',
                'string',
            ],

            'start_date' => [
                'nullable',
                'date',
            ],

            'due_date' => [
                'nullable',
                'date',
            ],

            /**
             * Mode pengumpulan tugas:
             *
             * once     = siswa hanya dapat mengumpulkan satu kali
             * multiple = siswa dapat mengumpulkan berkali-kali
             */
            'submission_mode' => [
                'nullable',
                'string',
                'in:once,multiple',
            ],

            'questions' => [
                'nullable',
                'array',
                'max:50',
            ],

            'questions.*.type' => [
                'required_with:questions',
                'in:short,paragraph,multiple,checkbox,upload,info',
            ],

            'questions.*.question' => [
                'required_with:questions',
                'string',
            ],

            /**
             * Jawaban benar untuk soal Jawaban Singkat.
             *
             * Validasi khusus berdasarkan tipe soal
             * dilakukan pada validator->after().
             */
            'questions.*.correct_answer' => [
                'nullable',
                'string',
            ],

            'questions.*.order' => [
                'nullable',
                'integer',
                'min:1',
            ],

            'questions.*.is_required' => [
                'nullable',
                'boolean',
            ],

            'questions.*.options' => [
                'nullable',
                'array',
            ],

            'questions.*.options.*.option_text' => [
                'required',
                'string',
            ],

            'questions.*.options.*.order' => [
                'nullable',
                'integer',
                'min:1',
            ],

            'questions.*.options.*.is_correct' => [
                'nullable',
                'boolean',
            ],

            'files' => [
                'nullable',
                'array',
                'max:10',
            ],

            'files.*' => [
                'file',
                'max:512000',
            ],
        ]);

        /**
         * Validasi tambahan setelah validasi dasar.
         */
        $validator->after(function ($validator) use ($request) {
            $startDate = $request->input('start_date');
            $dueDate = $request->input('due_date');
            $questions = $request->input('questions', []);

            /**
             * start_date tidak boleh lebih besar dari due_date.
             */
            if ($startDate && $dueDate) {
                try {
                    $start = \Carbon\Carbon::parse($startDate);
                    $due = \Carbon\Carbon::parse($dueDate);

                    if ($start->greaterThan($due)) {
                        $validator->errors()->add(
                            'start_date',
                            'Tanggal mulai tidak boleh setelah tenggat.'
                        );
                    }
                } catch (\Throwable $e) {
                    // Validasi format tanggal sudah ditangani
                    // oleh rule date.
                }
            }

            /**
             * Jika tidak ada questions, tidak perlu validasi
             * struktur soal.
             */
            if (empty($questions)) {
                return;
            }

            /**
             * Semua questions dalam satu assignment
             * harus memiliki tipe yang sama.
             */
            $types = collect($questions)
                ->pluck('type')
                ->filter()
                ->unique()
                ->values();

            if ($types->count() > 1) {
                $validator->errors()->add(
                    'questions',
                    'Satu tugas hanya dapat menggunakan satu jenis soal.'
                );

                return;
            }

            $type = $types->first();


            /**
             * Info tidak membutuhkan tanggal mulai
             * maupun tenggat.
             */
            if ($type === 'info') {
                if ($startDate || $dueDate) {
                    $validator->errors()->add(
                        'questions',
                        'Tugas jenis informasi tidak memerlukan tanggal mulai atau tenggat.'
                    );
                }
            }

            /**
             * Upload hanya membutuhkan satu pertanyaan/instruksi.
             */
            if ($type === 'upload' && count($questions) !== 1) {
                $validator->errors()->add(
                    'questions',
                    'Tugas upload hanya dapat memiliki satu instruksi.'
                );
            }

            /**
             * Validasi tipe short dan paragraph.
             */
            if (
                in_array($type, ['short', 'paragraph'], true) &&
                count($questions) < 1
            ) {
                $validator->errors()->add(
                    'questions',
                    'Minimal harus terdapat satu soal.'
                );
            }

            /**
             * Validasi khusus Jawaban Singkat.
             *
             * Setiap soal short wajib memiliki jawaban benar
             * karena jawaban tersebut digunakan oleh
             * AutoGradingService.
             */
            if ($type === 'short') {
                foreach ($questions as $index => $question) {
                    $correctAnswer = $question['correct_answer'] ?? null;

                    if (
                        $correctAnswer === null ||
                        trim((string) $correctAnswer) === ''
                    ) {

                        $validator->errors()->add(
                            "questions.$index.correct_answer",
                            'Jawaban benar wajib diisi untuk soal Jawaban Singkat.'
                        );
                    }
                }
            }

            /**
             * Tipe selain short tidak boleh memiliki
             * correct_answer.
             *
             * Multiple dan checkbox menggunakan
             * assignment_options.is_correct sebagai
             * sumber jawaban benar.
             */
            foreach ($questions as $index => $question) {
                $questionType = $question['type'] ?? null;
                $options = $question['options'] ?? [];
                $correctAnswer = $question['correct_answer'] ?? null;

                if (
                    $questionType !== 'short' &&
                    $correctAnswer !== null &&
                    trim((string) $correctAnswer) !== ''
                ) {
                    $validator->errors()->add(
                        "questions.$index.correct_answer",
                        'Jawaban benar hanya dapat digunakan untuk soal Jawaban Singkat.'
                    );
                }

                /**
                 * Multiple dan checkbox harus memiliki options.
                 */
                if (
                    in_array(
                        $questionType,
                        ['multiple', 'checkbox'],
                        true
                    )
                ) {

                    if (count($options) < 2) {
                        $validator->errors()->add(
                            "questions.$index.options",
                            'Soal pilihan harus memiliki minimal dua pilihan.'
                        );
                    }

                    $correctCount = collect($options)
                        ->filter(function ($option) {
                            return filter_var(
                                $option['is_correct'] ?? false,
                                FILTER_VALIDATE_BOOLEAN
                            );
                        })
                        ->count();

                    if ($questionType === 'multiple') {
                        if ($correctCount !== 1) {
                            $validator->errors()->add(
                                "questions.$index.options",
                                'Pilihan ganda harus memiliki tepat satu jawaban benar.'
                            );
                        }
                    }

                    if ($questionType === 'checkbox') {
                        if ($correctCount < 1) {
                            $validator->errors()->add(
                                "questions.$index.options",
                                'Kotak centang harus memiliki minimal satu jawaban benar.'
                            );
                        }
                    }
                }

                /**
                 * Tipe selain multiple/checkbox tidak boleh
                 * memiliki pilihan jawaban.
                 */
                if (
                    !in_array(
                        $questionType,
                        ['multiple', 'checkbox'],
                        true
                    ) &&
                    !empty($options)
                ) {
                    $validator->errors()->add(
                        "questions.$index.options",
                        'Jenis soal ini tidak membutuhkan pilihan jawaban.'
                    );
                }
            }
        });

        $validated = $validator->validate();

        /**
         * Pastikan seluruh schedule memang milik guru yang sedang login.
         */
        $schedules = $this->getTeacherSchedules(
            $request,
            $validated['schedule_ids']
        );

        DB::beginTransaction();

        $uploadedObjects = [];

        try {
            /**
             * Buat assignment.
             *
             * Jika submission_mode tidak dikirim,
             * gunakan "once" sebagai default.
             */
            $assignment = Assignment::create([
                'title' => $validated['title'],
                'description' => $validated['description'] ?? '',
                'start_date' => $validated['start_date'] ?? null,
                'due_date' => $validated['due_date'] ?? null,
                'submission_mode' => $validated['submission_mode']
                    ?? 'once',
                'status' => 'active',
            ]);

            /**
             * Hubungkan satu assignment dengan seluruh schedule
             * yang dipilih guru melalui tabel pivot assignment_schedules.
             */
            $assignment->schedules()->attach(
                $schedules->pluck('id')->all()
            );

            /**
             * Simpan questions dan options.
             */
            if (!empty($validated['questions'])) {
                foreach (
                    array_values($validated['questions'])
                    as $questionIndex => $questionData
                ) {
                    /**
                     * correct_answer hanya disimpan untuk
                     * jenis soal short.
                     *
                     * Jenis soal lain akan mendapatkan null.
                     */
                    $correctAnswer = null;

                    if ($questionData['type'] === 'short') {
                        $correctAnswer = trim(
                            (string) (
                                $questionData['correct_answer'] ?? ''
                            )
                        );
                    }

                    $question = AssignmentQuestion::create([
                        'assignment_id' => $assignment->id,
                        'type' => $questionData['type'],
                        'question' => $questionData['question'],
                        'correct_answer' => $correctAnswer,
                        'order' => $questionData['order']
                            ?? ($questionIndex + 1),
                        'is_required' => $questionData['is_required']
                            ?? true,
                    ]);

                    /**
                     * Simpan pilihan jawaban.
                     *
                     * Hanya multiple dan checkbox
                     * yang memiliki options.
                     */
                    if (
                        !empty($questionData['options']) &&
                        in_array(
                            $questionData['type'],
                            ['multiple', 'checkbox'],
                            true
                        )
                    ) {
                        foreach (
                            array_values($questionData['options'])
                            as $optionIndex => $optionData
                        ) {
                            AssignmentOption::create([
                                'assignment_question_id' => $question->id,
                                'option_text' => $optionData['option_text'],
                                'order' => $optionData['order']
                                    ?? ($optionIndex + 1),
                                'is_correct' => $optionData['is_correct']
                                    ?? false,
                            ]);
                        }
                    }
                }
            }

            /**
             * Upload file tugas ke MinIO.
             */
            if ($request->hasFile('files')) {
                foreach ($request->file('files') as $file) {
                    $extension = strtolower(
                        $file->getClientOriginalExtension()
                    );

                    $filename = (string) Str::uuid();

                    if ($extension !== '') {
                        $filename .= '.' . $extension;
                    }

                    $objectKey =
                        "assignments/{$assignment->id}/{$filename}";

                    Storage::disk('s3')->putFileAs(
                        "assignments/{$assignment->id}",
                        $file,
                        $filename
                    );

                    $uploadedObjects[] = $objectKey;

                    AssignmentFile::create([
                        'assignment_id' => $assignment->id,
                        'original_name' =>
                            $file->getClientOriginalName(),
                        'object_key' => $objectKey,
                        'mime_type' => $file->getClientMimeType(),
                        'size' => $file->getSize(),
                    ]);
                }
            }

            DB::commit();

            /**
             * Load seluruh relationship untuk response.
             */
            $assignment->load([
                'schedules.classroom',
                'schedules.subject',
                'questions.options',
                'files',
            ]);

            return response()->json([
                'message' => 'Tugas berhasil dibuat.',
                'data' => $assignment,
            ], 201);
        } catch (\Throwable $e) {
            DB::rollBack();

            /**
             * Jika database gagal setelah file berhasil
             * di-upload, hapus kembali object dari MinIO.
             */
            foreach ($uploadedObjects as $objectKey) {
                try {
                    Storage::disk('s3')->delete($objectKey);
                } catch (\Throwable $storageException) {
                    report($storageException);
                }
            }

            throw $e;
        }
    }

    /**
     * Menampilkan detail tugas.
     */
    public function show(
        Request $request,
        Assignment $assignment
    ) {
        $user = $this->ensureTeacher($request);

        $assignment->load([
            'schedules.classroom',
            'schedules.subject',
            'questions.options',

            /**
             * Data siswa yang mengumpulkan tugas.
             */
            'submissions.student.user',

            /**
             * File yang dikumpulkan oleh siswa.
             */
            'submissions.files',


            /**
             * Jawaban siswa beserta pilihan yang dipilih.
             */
            'submissions.answers.selectedOptions.option',


            /**
             * File yang dilampirkan guru pada tugas.
             */
            'files',
        ]);

        abort_unless(
            $assignment->schedules->contains(
                'teacher_id',
                $user->id
            ),
            403,
            'Anda tidak memiliki akses ke tugas ini.'
        );

        return response()->json([
            'message' => 'Detail tugas berhasil diambil.',
            'data' => $assignment,
        ]);
    }

    /**
     * Mengubah data tugas.
     *
     * Untuk saat ini update menangani informasi utama
     * tugas dan submission_mode.
     *
     * Pengelolaan soal tetap belum diubah pada tahap ini
     * agar tidak mencampur proses edit tugas dengan
     * pengelolaan jawaban siswa.
     */
    public function update(
        Request $request,
        Assignment $assignment
    ) {
        $user = $this->ensureTeacher($request);

        $assignment->load('schedules');

        abort_unless(
            $assignment->schedules->contains(
                'teacher_id',
                $user->id
            ),
            403,
            'Anda tidak memiliki akses ke tugas ini.'
        );

        $validator = Validator::make($request->all(), [
            'title' => [
                'sometimes',
                'required',
                'string',
                'max:255',
            ],

            'description' => [
                'sometimes',
                'nullable',
                'string'
            ],

            'start_date' => [
                'sometimes',
                'nullable',
                'date',
            ],

            'due_date' => [
                'sometimes',
                'nullable',
                'date',
            ],

            /**
             * Mode pengumpulan tugas.
             */
            'submission_mode' => [
                'sometimes',
                'nullable',
                'string',
                'in:once,multiple',
            ],

            'status' => [
            'sometimes',
            'required',
            'string',
            'in:active,draft',
            ],
        ]);

        $validator->after(function ($validator) use (
            $request,
            $assignment
        ) {

            /**
             * Jika salah satu tanggal tidak dikirim
             * pada request update, gunakan nilai yang
             * sudah tersimpan pada assignment.
             */
            $startDate = $request->has('start_date')
                ? $request->input('start_date')
                : $assignment->start_date;

            $dueDate = $request->has('due_date')
                ? $request->input('due_date')
                : $assignment->due_date;

            if ($startDate && $dueDate) {
                try {
                    $start = \Carbon\Carbon::parse($startDate);
                    $due = \Carbon\Carbon::parse($dueDate);

                    if ($start->greaterThan($due)) {
                        $validator->errors()->add(
                            'start_date',
                            'Tanggal mulai tidak boleh setelah tenggat.'
                        );
                    }

                } catch (\Throwable $e) {
                    // Rule date menangani format tanggal.
                }
            }

            /**
             * Tugas jenis info tidak boleh memiliki
             * tanggal mulai maupun tenggat.
             */
            $assignmentType = $assignment->questions()
                ->value('type');

            if ($assignmentType === 'info') {
                if ($startDate || $dueDate) {
                    $validator->errors()->add(
                        'start_date',
                        'Tugas jenis informasi tidak memerlukan tanggal mulai atau tenggat.'
                    );
                }
            }
        });

        $validated = $validator->validate();

        /**
         * Jangan mengubah submission_mode menjadi null
         * jika field tidak dikirim.
         *
         * Jika field dikirim null, gunakan mode lama
         * agar assignment selalu memiliki mode yang valid.
         */

        if (
            array_key_exists('submission_mode', $validated) &&
            $validated['submission_mode'] === null
        ) {
            $validated['submission_mode'] =
                $assignment->submission_mode ?? 'once';
        }

        /**
         * Jika assignment lama belum memiliki nilai
         * submission_mode, gunakan "once".
         */
        if (
            !array_key_exists('submission_mode', $validated) &&
            empty($assignment->submission_mode)
        ) {
            $validated['submission_mode'] = 'once';
        }

        $assignment->update($validated);

        $assignment->load([
            'schedules.classroom',
            'schedules.subject',
            'questions.options',
            'files',
        ]);

        return response()->json([
            'message' => 'Tugas berhasil diperbarui.',
            'data' => $assignment,
        ]);
    }

    /**
     * Menghapus tugas beserta file-file yang tersimpan di MinIO.
     */
    public function destroy(
        Request $request,
        Assignment $assignment
    ) {
        $user = $this->ensureTeacher($request);

        $assignment->load([
            'schedules',
            'files',
        ]);

        abort_unless(
            $assignment->schedules->contains(
                'teacher_id',
                $user->id
            ),
            403,
            'Anda tidak memiliki akses ke tugas ini.'
        );

        DB::beginTransaction();

        try {
            foreach ($assignment->files as $file) {
                if (
                    $file->object_key &&
                    Storage::disk('s3')->exists($file->object_key)
                ) {
                    Storage::disk('s3')->delete(
                        $file->object_key
                    );
                }
            }

            $assignment->delete();

            DB::commit();

            return response()->json([
                'message' => 'Tugas berhasil dihapus.',
            ]);

        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Data halaman Kelola Tugas berdasarkan satu schedule.
     *
     * Endpoint:
     * GET /api/guru/tugas/kelola/{schedule}
     *
     * Data yang dikembalikan:
     * - informasi kelas
     * - mata pelajaran
     * - siswa
     * - tugas
     * - submission siswa
     * - soal dan pilihan
     * - jawaban siswa
     * - file
     * - statistik
     */
    public function manageBySchedule(
        Request $request,
        Schedule $schedule
    ) {
        $user = $this->ensureTeacher($request);

        /**
         * Pastikan schedule memang milik guru yang login.
         */
        abort_unless(
            (int) $schedule->teacher_id ===
                (int) $user->id,
            403,
            'Anda tidak memiliki akses ke kelas ini.'
        );

        /**
         * Load informasi schedule.
         */
        $schedule->load([
            'classroom.users',
            'subject',
            'teacher',
        ]);

        /**
         * Ambil seluruh user siswa
         * yang berada di classroom tersebut.
         */
        $studentUserIds = $schedule->classroom
            ? $schedule->classroom
                ->users()
                ->where('users.role', 'siswa')
                ->pluck('users.id')
                ->values()
            : collect();

        /**
         * Ambil model Student berdasarkan user_id.
         */
        $students = Student::with('user')
            ->whereIn(
                'user_id',
                $studentUserIds
            )
            ->get()
            ->sortBy(function ($student) {
                return $student->user?->name ?? '';
            })
            ->values();

        $studentIds = $students
            ->pluck('id')
            ->values();

        /**
         * Ambil semua assignment yang diberikan
         * ke schedule ini.
         */
        $assignments = Assignment::with([
            'schedules.classroom',
            'schedules.subject',
            'questions.options',
            'files',

            /**
             * Submission hanya milik siswa
             * pada classroom ini.
             */
            'submissions' => function ($query) use ($studentIds) {
                $query
                    ->whereIn(
                        'student_id',
                        $studentIds
                    )

                    ->with([
                        'student.user',
                        'files',
                        'answers.question',
                        'answers.selectedOptions.option',
                    ])

                    ->orderByDesc('created_at');
            },

            /**
             * Komentar tugas.
             */
            'comments' => function ($query) use ($schedule) {
                $query
                    ->where('classroom_id', $schedule->classroom_id)
                    ->with('user:id,name,role')
                    ->latest();
            },
        ])
            ->whereHas(
                'schedules',
                function ($query) use ($schedule) {
                    $query->where(
                        'schedules.id',
                        $schedule->id
                    );
                }
            )

            ->latest()

            ->get();

        /**
         * Bentuk data assignment agar frontend
         * tidak perlu melakukan terlalu banyak
         * transformasi.
         */
        $assignments = $assignments
            ->map(function ($assignment) use ($students) {

                /**
                 * Semua submission assignment.
                 */
                $allSubmissions = $assignment->submissions;

                /**
                 * Pilih satu submission terbaik
                 * untuk setiap siswa.
                 *
                 * Jika ada submission dengan nilai,
                 * pilih nilai tertinggi.
                 *
                 * Jika belum ada nilai,
                 * gunakan submission terbaru.
                 */
                $representativeSubmissions = $allSubmissions
                    ->groupBy('student_id')
                    ->map(function ($submissions) {
                        $graded = $submissions
                            ->filter(
                                fn ($submission) =>
                                    $submission->grade !== null
                            );

                        if ($graded->isNotEmpty()) {
                            return $graded
                                ->sortByDesc(
                                    fn ($submission) =>
                                        (float) $submission->grade
                                )
                                ->first();
                        }

                        return $submissions
                            ->sortByDesc('created_at')
                            ->first();
                    });

                /**
                 * Apakah tugas memiliki submission?
                 *
                 * info tidak membutuhkan submission.
                 */

                $type = $assignment->questions
                    ->first()?->type;

                $isInfo = $type === 'info';

                /**
                 * Hitung siswa yang sudah mengumpulkan.
                 */
                $submittedCount = $isInfo
                    ? 0
                    : $representativeSubmissions->count();

                /**
                 * Hitung submission yang masih perlu
                 * dinilai secara manual.
                 */
                $needsGradingCount = 0;

                if (!$isInfo) {
                    foreach (
                        $representativeSubmissions
                        as $submission
                    ) {

                        /**
                         * Jika belum memiliki grade,
                         * berarti masih perlu dinilai.
                         */
                        if ($submission->grade === null) {
                            $needsGradingCount++;
                        }
                    }
                }

                /**
                 * Jumlah komentar.
                 */
                $commentCount = $assignment
                    ->comments
                    ->count();

                /**
                 * Tambahkan roster sederhana
                 * untuk kebutuhan frontend.
                 */
                $roster = $students
                    ->map(function ($student) use (
                        $representativeSubmissions
                    ) {
                        $submission =
                            $representativeSubmissions
                                ->get($student->id);

                        return [
                            'student' => $student,
                            'submission' => $submission,
                        ];
                    })
                    ->values();

                return [
                    'id' => $assignment->id,
                    'title' => $assignment->title,
                    'description' => $assignment->description,
                    'start_date' => $assignment->start_date,
                    'due_date' => $assignment->due_date,
                    'status' => $assignment->status,

                    'submission_mode' =>
                        $assignment->submission_mode,

                    'type' => $type,

                    'questions' =>
                        $assignment->questions,

                    'files' =>
                        $assignment->files,

                    'comments' =>
                        $assignment->comments,

                    'comment_count' =>
                        $commentCount,

                    'student_count' =>
                        $students->count(),

                    'submitted_count' =>
                        $submittedCount,

                    'needs_grading_count' =>
                        $needsGradingCount,

                    'submissions' =>
                        $representativeSubmissions
                            ->values(),

                    'roster' =>
                        $roster,
                ];
            })
            ->values();

        /**
         * Statistik halaman Kelola Tugas.
         */
        $totalAssignments = $assignments->count();

        $draftAssignments = $assignments
            ->filter(function ($assignment) {
                return $assignment['status'] === 'draft';
            })
            ->count();

        $activeAssignments = $assignments
            ->filter(function ($assignment) {
                return $assignment['status'] !== 'draft';
            })
            ->count();

        $needsGrading = $assignments
            ->sum('needs_grading_count');

        return response()->json([
            'message' =>
                'Data Kelola Tugas berhasil diambil.',

            'data' => [
                'schedule' => [
                    'id' => $schedule->id,

                    'day' =>
                        $schedule->day,

                    'start_time' =>
                        $schedule->start_time,

                    'end_time' =>
                        $schedule->end_time,

                    'classroom' =>
                        $schedule->classroom,

                    'subject' =>
                        $schedule->subject,

                    'teacher' =>
                        $schedule->teacher,
                ],

                'students' =>
                    $students,

                'assignments' =>
                    $assignments,

                'summary' => [
                    'total_tasks' =>
                        $totalAssignments,

                    'active_tasks' =>
                        $activeAssignments,

                    'needs_grading' =>
                        $needsGrading,

                    'draft_tasks' =>
                        $draftAssignments,
                ],
            ],
        ]);
    }

/**
     * Memperbarui nilai submission siswa.
     *
     * PUT
     * /api/guru/tugas/{assignment}/submission/{submission}/nilai
     */
    public function updateSubmissionGrade(
        Request $request,
        Assignment $assignment,
        \App\Models\Submission $submission
    ) {
        $user = $this->ensureTeacher($request);

        /**
         * Assignment harus milik guru.
         */
        $assignment->load([
            'schedules',
        ]);

        abort_unless(
            $assignment->schedules->contains(
                'teacher_id',
                $user->id
            ),
            403,
            'Anda tidak memiliki akses ke tugas ini.'
        );

        /**
         * Submission harus berasal dari assignment
         * yang sedang dinilai.
         */
        abort_unless(
            (int) $submission->assignment_id ===
                (int) $assignment->id,
            404,
            'Submission tidak ditemukan untuk tugas ini.'
        );

        /**
         * Validasi nilai.
         */
        $validator = Validator::make(
            $request->all(),
            [
                'grade' => [
                    'required',
                    'numeric',
                    'min:0',
                    'max:100',
                ],
            ],
            [
                'grade.required' =>
                    'Nilai wajib diisi.',

                'grade.numeric' =>
                    'Nilai harus berupa angka.',

                'grade.min' =>
                    'Nilai minimal adalah 0.',

                'grade.max' =>
                    'Nilai maksimal adalah 100.',
            ]
        );

        $validated = $validator->validate();

        /**
         * Simpan nilai.
         */
        $submission->update([
            'grade' => $validated['grade'],
        ]);

        /**
         * Return submission terbaru.
         */
        $submission->load([
            'student.user',
            'files',
            'answers.question',
            'answers.selectedOptions.option',
        ]);

        return response()->json([
            'message' =>
                'Nilai berhasil diperbarui.',
            'data' =>
                $submission,
        ]);
    }
}