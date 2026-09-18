<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Assignment;
use App\Models\AssignmentQuestion;
use App\Models\Submission;
use App\Models\SubmissionAnswer;
use App\Models\SubmissionAnswerOption;
use App\Models\SubmissionFile;
use App\Services\AutoGradingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class SubmissionController extends Controller
{
    /**
     * Memastikan user yang login adalah siswa.
     */
    private function ensureStudent(Request $request)
    {
        $user = $request->user();

        abort_unless(
            $user && $user->role === 'siswa',
            403,
            'Akses hanya untuk siswa.'
        );

        return $user;
    }

    /**
     * Memastikan siswa memiliki akses ke assignment.
     */
    private function getAuthorizedAssignment(
        Request $request,
        Assignment $assignment
    ): Assignment {
        $user = $this->ensureStudent($request);

        $assignment->load([
            'schedule.classroom',
            'schedule.subject',
            'files',
            'questions.options',
        ]);

        abort_unless(
            $assignment->schedule !== null,
            404,
            'Jadwal tugas tidak ditemukan.'
        );

        $classroom = $assignment->schedule->classroom;

        abort_unless(
            $classroom !== null,
            404,
            'Kelas tugas tidak ditemukan.'
        );

        $isMember = $classroom->users()
            ->where('users.id', $user->id)
            ->where('users.role', 'siswa')
            ->exists();

        abort_unless(
            $isMember,
            403,
            'Anda bukan anggota kelas dari tugas ini.'
        );

        return $assignment;
    }

    /**
     * Memastikan assignment memang dapat menerima submission siswa.
     *
     * Assignment bertipe info hanya digunakan guru untuk
     * memberikan informasi atau materi kepada siswa.
     */
    private function ensureSubmissionAllowed(
        Assignment $assignment
    ): void {
        $isInfoAssignment = $assignment->questions->isNotEmpty()
            && $assignment->questions->every(
                fn ($question) => $question->type === 'info'
            );

        abort_if(
            $isInfoAssignment,
            422,
            'Tugas jenis informasi tidak memerlukan pengumpulan dari siswa.'
        );
    }

    /**
     * Memastikan assignment sedang berada dalam periode
     * pengumpulan submission.
     *
     * Jika start_date diisi, siswa tidak dapat mengumpulkan
     * atau memperbarui submission sebelum waktu tersebut.
     *
     * Jika due_date diisi, siswa tidak dapat mengumpulkan
     * atau memperbarui submission setelah batas waktu tersebut.
     */
    private function ensureAssignmentIsOpen(
        Assignment $assignment
    ): void {
        $now = now();

        if (
            $assignment->start_date !== null
            && $now->lt($assignment->start_date)
        ) {
            abort(
                422,
                'Tugas belum dapat dikumpulkan karena belum memasuki waktu mulai.'
            );
        }

        if (
            $assignment->due_date !== null
            && $now->gt($assignment->due_date)
        ) {
            abort(
                422,
                'Tugas sudah melewati batas waktu pengumpulan.'
            );
        }
    }

    /**
     * Menentukan apakah submission dikumpulkan terlambat.
     *
     * Submission yang dibuat setelah due_date dianggap terlambat.
     */
    private function isLate(
        Submission $submission,
        Assignment $assignment
    ): bool {
        return $assignment->due_date !== null
            && $submission->created_at !== null
            && $submission->created_at->greaterThan(
                $assignment->due_date
            );
    }

    /**
     * Menentukan apakah assignment memiliki soal yang dapat
     * dinilai secara otomatis.
     */
    private function hasAutoGradableQuestions(
        Assignment $assignment
    ): bool {
        return $assignment->questions->contains(
            function ($question) {
                return in_array(
                    $question->type,
                    [
                        'short',
                        'multiple',
                        'checkbox',
                    ],
                    true
                );
            }
        );
    }

    /**
     * Mengambil nilai tertinggi dari seluruh submission siswa
     * pada sebuah assignment.
     *
     * Jika belum ada nilai, return null.
     */
    private function getHighestGrade(
        Assignment $assignment,
        int $studentId
    ): ?float {
        $highestGrade = Submission::where(
            'assignment_id',
            $assignment->id
        )
            ->where(
                'student_id',
                $studentId
            )
            ->whereNotNull('grade')
            ->max('grade');

        if ($highestGrade === null) {
            return null;
        }

        return round(
            (float) $highestGrade,
            2
        );
    }

    /**
     * Menilai submission menggunakan AutoGradingService.
     *
     * Hanya assignment yang memiliki soal:
     * - short
     * - multiple
     * - checkbox
     *
     * yang akan diproses secara otomatis.
     *
     * Untuk assignment paragraph/upload, nilai tidak
     * diubah karena membutuhkan penilaian guru.
     */
    private function autoGradeSubmission(
        Submission $submission,
        Assignment $assignment
    ): void {
        if (!$this->hasAutoGradableQuestions($assignment)) {
            return;
        }

        $autoGradingService = app(
            AutoGradingService::class
        );

        $grade = $autoGradingService->grade(
            $submission,
            $assignment
        );

        $submission->update([
            'grade' => $grade,
        ]);
    }

    /**
     * Format submission untuk response siswa.
     *
     * Field sensitif seperti:
     * - correct_answer
     * - is_correct pada option
     * - points
     *
     * tidak dikirim ke siswa.
     */
    private function formatSubmission(
        Submission $submission,
        Assignment $assignment,
        ?float $highestGrade = null
    ): array {
        $answers = $submission->answers
            ->map(function ($answer) {
                return [
                    'id' => $answer->id,
                    'submission_id' => $answer->submission_id,
                    'assignment_question_id' =>
                        $answer->assignment_question_id,
                    'answer_text' => $answer->answer_text,
                    'created_at' => $answer->created_at,
                    'updated_at' => $answer->updated_at,

                    'question' => $answer->question
                        ? [
                            'id' => $answer->question->id,
                            'assignment_id' =>
                                $answer->question->assignment_id,
                            'type' => $answer->question->type,
                            'question' => $answer->question->question,
                            'order' => $answer->question->order,
                            'is_required' =>
                                $answer->question->is_required,
                        ]
                        : null,

                    'selected_options' =>
                        $answer->selectedOptions
                            ->map(function ($selectedOption) {
                                return [
                                    'id' => $selectedOption->id,
                                    'submission_answer_id' =>
                                        $selectedOption
                                            ->submission_answer_id,
                                    'assignment_option_id' =>
                                        $selectedOption
                                            ->assignment_option_id,
                                    'created_at' =>
                                        $selectedOption->created_at,
                                    'updated_at' =>
                                        $selectedOption->updated_at,

                                    'option' =>
                                        $selectedOption->option
                                            ? [
                                                'id' =>
                                                    $selectedOption
                                                        ->option
                                                        ->id,
                                                'assignment_question_id' =>
                                                    $selectedOption
                                                        ->option
                                                        ->assignment_question_id,
                                                'option_text' =>
                                                    $selectedOption
                                                        ->option
                                                        ->option_text,
                                                'order' =>
                                                    $selectedOption
                                                        ->option
                                                        ->order,
                                            ]
                                            : null,
                                ];
                            })
                            ->values()
                            ->all(),
                ];
            })
            ->values()
            ->all();

        $isHighestGrade = false;

        if (
            $highestGrade !== null
            && $submission->grade !== null
        ) {
            $isHighestGrade =
                round(
                    (float) $submission->grade,
                    2
                ) === round(
                    $highestGrade,
                    2
                );
        }

        return [
            'id' => $submission->id,
            'assignment_id' => $submission->assignment_id,
            'student_id' => $submission->student_id,
            'file_path' => $submission->file_path,
            'student_note' => $submission->student_note,

            /*
             * Nilai submission ini.
             */
            'grade' => $submission->grade,

            /*
             * Menandai apakah submission ini memiliki
             * nilai tertinggi dari seluruh attempt.
             */
            'is_highest_grade' => $isHighestGrade,

            'teacher_feedback' =>
                $submission->teacher_feedback,

            'created_at' => $submission->created_at,
            'updated_at' => $submission->updated_at,

            'is_late' => $this->isLate(
                $submission,
                $assignment
            ),

            'files' => $submission->files
                ->values()
                ->all(),

            'answers' => $answers,
        ];
    }

    /**
     * Format satu option untuk response siswa.
     *
     * Field is_correct sengaja tidak disertakan.
     */
    private function formatStudentOption($option): array
    {
        return [
            'id' => $option->id,
            'assignment_question_id' =>
                $option->assignment_question_id,
            'option_text' => $option->option_text,
            'order' => $option->order,
            'created_at' => $option->created_at,
            'updated_at' => $option->updated_at,
        ];
    }

    /**
     * Format satu question untuk response siswa.
     *
     * Field correct_answer sengaja tidak disertakan.
     * Field is_correct dari option juga tidak disertakan.
     */
    private function formatStudentQuestion($question): array
    {
        return [
            'id' => $question->id,
            'assignment_id' => $question->assignment_id,
            'type' => $question->type,
            'question' => $question->question,
            'order' => $question->order,
            'is_required' => $question->is_required,
            'created_at' => $question->created_at,
            'updated_at' => $question->updated_at,

            'options' => $question->options
                ->map(function ($option) {
                    return $this->formatStudentOption(
                        $option
                    );
                })
                ->values()
                ->all(),
        ];
    }

    /**
     * Format assignment untuk response siswa.
     *
     * Field sensitif seperti correct_answer dan
     * is_correct tidak pernah dikirim.
     */
    private function formatStudentAssignment(
        Assignment $assignment,
        array $formattedSubmissions,
        ?float $highestGrade = null
    ): array {
        return [
            'id' => $assignment->id,
            'schedule_id' => $assignment->schedule_id,
            'title' => $assignment->title,
            'description' => $assignment->description,

            /*
             * Mode pengumpulan:
             *
             * once     = satu kali pengumpulan
             * multiple = dapat mengumpulkan berkali-kali
             */
            'submission_mode' =>
                $assignment->submission_mode ?? 'once',

            'due_date' => $assignment->due_date,
            'created_at' => $assignment->created_at,
            'updated_at' => $assignment->updated_at,
            'start_date' => $assignment->start_date,

            /*
             * Nilai tertinggi dari seluruh submission siswa.
             */
            'final_grade' => $highestGrade,

            'submissions' => $formattedSubmissions,

            'schedule' => $assignment->schedule,

            'files' => $assignment->files
                ->values()
                ->all(),

            'questions' => $assignment->questions
                ->sortBy('order')
                ->values()
                ->map(function ($question) {
                    return $this->formatStudentQuestion(
                        $question
                    );
                })
                ->all(),
        ];
    }

    /**
     * Validasi jawaban siswa.
     */
    private function validateAnswers(
        array $answers,
        Assignment $assignment
    ): array {
        $questions = $assignment->questions
            ->sortBy('order')
            ->values();

        if ($questions->isEmpty()) {
            if (!empty($answers)) {
                abort(
                    422,
                    'Tugas ini tidak memiliki soal.'
                );
            }

            return [];
        }

        $questionMap = $questions->keyBy(
            fn ($question) => (int) $question->id
        );

        $submittedQuestionIds = [];
        $normalized = [];

        foreach ($answers as $index => $answer) {
            if (!is_array($answer)) {
                abort(
                    422,
                    "Format jawaban pada index {$index} tidak valid."
                );
            }

            if (!array_key_exists(
                'assignment_question_id',
                $answer
            )) {
                abort(
                    422,
                    "assignment_question_id wajib diisi pada jawaban index {$index}."
                );
            }

            $questionId = (int) $answer['assignment_question_id'];

            if (!$questionMap->has($questionId)) {
                abort(
                    422,
                    "Soal dengan ID {$questionId} tidak termasuk dalam tugas ini."
                );
            }

            if (in_array(
                $questionId,
                $submittedQuestionIds,
                true
            )) {
                abort(
                    422,
                    "Jawaban untuk soal ID {$questionId} dikirim lebih dari satu kali."
                );
            }

            $submittedQuestionIds[] = $questionId;

            /** @var AssignmentQuestion $question */
            $question = $questionMap->get($questionId);

            $answerText = $answer['answer_text'] ?? null;

            if (
                $answerText !== null
                && !is_string($answerText)
            ) {
                abort(
                    422,
                    "answer_text pada soal ID {$questionId} harus berupa teks."
                );
            }

            if (
                is_string($answerText)
                && trim($answerText) === ''
            ) {
                $answerText = null;
            }

            $selectedOptionIds =
                $answer['selected_option_ids'] ?? [];

            if (!is_array($selectedOptionIds)) {
                abort(
                    422,
                    "selected_option_ids pada soal ID {$questionId} harus berupa array."
                );
            }

            $selectedOptionIds = array_values(
                array_unique(
                    array_map(
                        'intval',
                        $selectedOptionIds
                    )
                )
            );

            $optionMap = $question->options->keyBy(
                fn ($option) => (int) $option->id
            );

            foreach ($selectedOptionIds as $optionId) {
                if (!$optionMap->has($optionId)) {
                    abort(
                        422,
                        "Pilihan ID {$optionId} bukan pilihan dari soal ID {$questionId}."
                    );
                }
            }

            switch ($question->type) {
                case 'short':
                case 'paragraph':
                    if (!empty($selectedOptionIds)) {
                        abort(
                            422,
                            "Soal ID {$questionId} tidak mendukung pilihan jawaban."
                        );
                    }

                    if (
                        $question->is_required
                        && $answerText === null
                    ) {
                        abort(
                            422,
                            "Jawaban untuk soal ID {$questionId} wajib diisi."
                        );
                    }

                    break;

                case 'multiple':
                    if (count($selectedOptionIds) !== 1) {
                        abort(
                            422,
                            "Pilih tepat satu jawaban untuk soal ID {$questionId}."
                        );
                    }

                    if ($answerText !== null) {
                        abort(
                            422,
                            "Soal pilihan ganda ID {$questionId} tidak menggunakan answer_text."
                        );
                    }

                    break;

                case 'checkbox':
                    if (
                        $question->is_required
                        && count($selectedOptionIds) === 0
                    ) {
                        abort(
                            422,
                            "Minimal satu pilihan harus dipilih untuk soal ID {$questionId}."
                        );
                    }

                    if ($answerText !== null) {
                        abort(
                            422,
                            "Soal checkbox ID {$questionId} tidak menggunakan answer_text."
                        );
                    }

                    break;

                case 'upload':
                    if ($answerText !== null) {
                        abort(
                            422,
                            "Soal upload ID {$questionId} tidak menggunakan answer_text."
                        );
                    }

                    if (!empty($selectedOptionIds)) {
                        abort(
                            422,
                            "Soal upload ID {$questionId} tidak menggunakan pilihan jawaban."
                        );
                    }

                    break;

                case 'info':
                    if ($answerText !== null) {
                        abort(
                            422,
                            "Soal info ID {$questionId} tidak dapat dijawab."
                        );
                    }

                    if (!empty($selectedOptionIds)) {
                        abort(
                            422,
                            "Soal info ID {$questionId} tidak menggunakan pilihan jawaban."
                        );
                    }

                    break;

                default:
                    abort(
                        422,
                        "Tipe soal {$question->type} tidak didukung."
                    );
            }

            $normalized[] = [
                'question' => $question,
                'answer_text' => $answerText,
                'selected_option_ids' => $selectedOptionIds,
            ];
        }

        $normalizedQuestionIds = collect($normalized)
            ->map(function ($item) {
                return (int) $item['question']->id;
            })
            ->values()
            ->all();

        foreach ($questions as $question) {
            if (
                !$question->is_required
                || $question->type === 'info'
                || $question->type === 'upload'
            ) {
                continue;
            }

            if (!in_array(
                (int) $question->id,
                $normalizedQuestionIds,
                true
            )) {
                abort(
                    422,
                    "Jawaban untuk soal ID {$question->id} wajib diisi."
                );
            }
        }

        return $normalized;
    }

    /**
     * Validasi file submission untuk tugas bertipe upload.
     *
     * Tugas upload hanya memiliki satu pertanyaan upload.
     */
    private function validateSubmissionFiles(
        Assignment $assignment,
        int $existingFileCount,
        int $newFileCount
    ): void {
        $uploadQuestion = $assignment->questions
            ->firstWhere('type', 'upload');

        if (!$uploadQuestion) {
            return;
        }

        if (
            $uploadQuestion->is_required
            && (
                $existingFileCount + $newFileCount
            ) === 0
        ) {
            abort(
                422,
                'File wajib diunggah untuk tugas ini.'
            );
        }
    }

    /**
     * Menyimpan jawaban siswa ke submission tertentu.
     */
    private function saveAnswers(
        Submission $submission,
        array $answers
    ): void {
        foreach ($answers as $answerData) {
            /** @var AssignmentQuestion $question */
            $question = $answerData['question'];

            if ($question->type === 'info') {
                continue;
            }

            if ($question->type === 'upload') {
                continue;
            }

            $answer = SubmissionAnswer::updateOrCreate(
                [
                    'submission_id' => $submission->id,
                    'assignment_question_id' => $question->id,
                ],
                [
                    'answer_text' => $answerData['answer_text'],

                    /*
                     * Reset hasil grading sebelum proses
                     * auto-grading dijalankan.
                     */
                    'is_correct' => null,
                    'points' => 0,
                ]
            );

            SubmissionAnswerOption::where(
                'submission_answer_id',
                $answer->id
            )->delete();

            foreach (
                $answerData['selected_option_ids']
                as $optionId
            ) {
                SubmissionAnswerOption::create([
                    'submission_answer_id' => $answer->id,
                    'assignment_option_id' => $optionId,
                ]);
            }
        }
    }

    /**
     * Sinkronisasi jawaban siswa saat melakukan edit submission.
     *
     * Jawaban lama yang tidak lagi dikirim oleh frontend akan
     * dihapus dari database.
     *
     * Hal ini penting untuk soal opsional.
     *
     * Contoh:
     *
     * Sebelumnya:
     * - Q31 = Jakarta
     * - Q32 = PHP
     *
     * Saat edit siswa hanya mengirim:
     * - Q31 = Jakarta
     *
     * Maka:
     * - Q31 tetap tersimpan
     * - Q32 dihapus
     *
     * Dengan demikian Q32 tidak lagi ikut dalam proses
     * auto-grading.
     */
    private function syncAnswers(
        Submission $submission,
        array $answers
    ): void {
        $submittedQuestionIds = collect($answers)
            ->map(function ($answerData) {
                return (int) $answerData['question']->id;
            })
            ->values()
            ->all();

        /*
         * Ambil seluruh jawaban lama dari submission.
         */
        $existingAnswers = SubmissionAnswer::where(
            'submission_id',
            $submission->id
        )->get();

        /*
         * Hapus jawaban lama yang sudah tidak dikirim
         * pada request terbaru.
         */
        foreach ($existingAnswers as $existingAnswer) {
            if (
                !in_array(
                    (int) $existingAnswer->assignment_question_id,
                    $submittedQuestionIds,
                    true
                )
            ) {
                /*
                 * Hapus selected options terlebih dahulu
                 * agar tidak meninggalkan data relasi.
                 */
                SubmissionAnswerOption::where(
                    'submission_answer_id',
                    $existingAnswer->id
                )->delete();

                $existingAnswer->delete();
            }
        }

        /*
         * Simpan atau update jawaban yang masih dikirim.
         */
        $this->saveAnswers(
            $submission,
            $answers
        );
    }

    /**
     * Membuat submission baru beserta file yang diunggah.
     */
    private function uploadSubmissionFiles(
        Request $request,
        Submission $submission,
        array &$uploadedObjects
    ): void {
        if (!$request->hasFile('files')) {
            return;
        }

        foreach (
            $request->file('files')
            as $file
        ) {
            $extension = strtolower(
                $file->getClientOriginalExtension()
            );

            $filename = (string) Str::uuid();

            if ($extension !== '') {
                $filename .= '.' . $extension;
            }

            $objectKey =
                "submissions/{$submission->id}/{$filename}";

            Storage::disk('s3')->putFileAs(
                "submissions/{$submission->id}",
                $file,
                $filename
            );

            $uploadedObjects[] = $objectKey;

            SubmissionFile::create([
                'submission_id' => $submission->id,
                'original_name' =>
                    $file->getClientOriginalName(),
                'object_key' => $objectKey,
                'mime_type' =>
                    $file->getClientMimeType(),
                'size' => $file->getSize(),
            ]);
        }
    }

    /**
     * Mengambil seluruh submission milik siswa pada assignment.
     */
    private function getStudentSubmissions(
        Assignment $assignment,
        int $studentId
    ) {
        return Submission::where(
            'assignment_id',
            $assignment->id
        )
            ->where(
                'student_id',
                $studentId
            )
            ->with([
                'files',
                'answers.question',
                'answers.selectedOptions.option',
                'assignment.schedule.classroom',
                'assignment.schedule.subject',
            ])
            ->orderBy(
                'created_at',
                'asc'
            )
            ->get();
    }

    /**
     * Daftar tugas yang dapat diakses siswa.
     */
    public function index(Request $request)
    {
        $user = $this->ensureStudent($request);

        $classroomIds = $user->classrooms()
            ->pluck('classrooms.id');

        $assignments = Assignment::with([
            'schedule.classroom',
            'schedule.subject',
            'files',
            'questions.options',
            'submissions' => function ($query) use ($user) {
                $query->where(
                    'student_id',
                    $user->id
                )->with([
                    'files',
                    'answers.question',
                    'answers.selectedOptions.option',
                ])->orderBy(
                    'created_at',
                    'asc'
                );
            },
        ])
            ->whereHas(
                'schedule',
                function ($query) use ($classroomIds) {
                    $query->whereIn(
                        'classroom_id',
                        $classroomIds
                    );
                }
            )
            ->latest()
            ->get();

        $data = $assignments
            ->map(function ($assignment) use ($user) {
                $highestGrade = $this->getHighestGrade(
                    $assignment,
                    $user->id
                );

                $formattedSubmissions =
                    $assignment->submissions
                        ->map(function ($submission) use (
                            $assignment,
                            $highestGrade
                        ) {
                            return $this->formatSubmission(
                                $submission,
                                $assignment,
                                $highestGrade
                            );
                        })
                        ->values()
                        ->all();

                return $this->formatStudentAssignment(
                    $assignment,
                    $formattedSubmissions,
                    $highestGrade
                );
            })
            ->values()
            ->all();

        return response()->json([
            'message' => 'Daftar tugas berhasil diambil.',
            'data' => $data,
        ]);
    }

    /**
     * Detail tugas untuk siswa.
     */
    public function show(
        Request $request,
        Assignment $assignment
    ) {
        $user = $this->ensureStudent($request);

        $assignment = $this->getAuthorizedAssignment(
            $request,
            $assignment
        );

        $assignment->load([
            'schedule.classroom',
            'schedule.subject',
            'files',
            'questions.options',
            'submissions' => function ($query) use ($user) {
                $query->where(
                    'student_id',
                    $user->id
                )->with([
                    'files',
                    'answers.question',
                    'answers.selectedOptions.option',
                ])->orderBy(
                    'created_at',
                    'asc'
                );
            },
        ]);

        $highestGrade = $this->getHighestGrade(
            $assignment,
            $user->id
        );

        $formattedSubmissions =
            $assignment->submissions
                ->map(function ($submission) use (
                    $assignment,
                    $highestGrade
                ) {
                    return $this->formatSubmission(
                        $submission,
                        $assignment,
                        $highestGrade
                    );
                })
                ->values()
                ->all();

        $data = $this->formatStudentAssignment(
            $assignment,
            $formattedSubmissions,
            $highestGrade
        );

        return response()->json([
            'message' => 'Detail tugas berhasil diambil.',
            'data' => $data,
        ]);
    }

    /**
     * Membuat submission baru atau memperbarui submission
     * berdasarkan submission_mode.
     *
     * Mode once:
     * - Hanya satu submission diperbolehkan.
     *
     * Mode multiple:
     * - Setiap pemanggilan submit membuat attempt baru.
     * - Nilai tertinggi dari seluruh attempt menjadi final grade.
     */
    public function submit(
        Request $request,
        Assignment $assignment
    ) {
        $user = $this->ensureStudent($request);

        $assignment = $this->getAuthorizedAssignment(
            $request,
            $assignment
        );

        $this->ensureSubmissionAllowed(
            $assignment
        );

        $this->ensureAssignmentIsOpen(
            $assignment
        );

        $validated = $request->validate([
            'student_note' => [
                'nullable',
                'string',
            ],

            'answers' => [
                'nullable',
                'array',
            ],

            'answers.*.assignment_question_id' => [
                'required',
                'integer',
            ],

            'answers.*.answer_text' => [
                'nullable',
                'string',
            ],

            'answers.*.selected_option_ids' => [
                'nullable',
                'array',
            ],

            'answers.*.selected_option_ids.*' => [
                'integer',
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

        $normalizedAnswers = $this->validateAnswers(
            $validated['answers'] ?? [],
            $assignment
        );

        $submissionMode =
            $assignment->submission_mode ?? 'once';

        /*
         * Ambil seluruh submission siswa.
         */
        $existingSubmissions =
            $this->getStudentSubmissions(
                $assignment,
                $user->id
            );

        /*
         * Mode once:
         *
         * Jika sudah pernah mengumpulkan, endpoint submit
         * tidak boleh membuat submission kedua.
         *
         * Siswa harus menggunakan endpoint update.
         */
        if (
            $submissionMode === 'once'
            && $existingSubmissions->isNotEmpty()
        ) {
            abort(
                422,
                'Tugas ini hanya dapat dikumpulkan satu kali. Gunakan fitur edit submission untuk memperbarui jawaban.'
            );
        }

        /*
         * Mode multiple:
         *
         * Setiap submit selalu membuat submission baru.
         *
         * Hal ini penting agar riwayat attempt tidak
         * tertimpa oleh submission berikutnya.
         */
        $submission = null;

        /*
         * Karena submission baru belum memiliki file,
         * existingFileCount selalu 0.
         */
        $existingFileCount = 0;

        $newFileCount = $request->hasFile('files')
            ? count($request->file('files'))
            : 0;

        $this->validateSubmissionFiles(
            $assignment,
            $existingFileCount,
            $newFileCount
        );

        DB::beginTransaction();

        $uploadedObjects = [];

        try {
            /*
             * Selalu membuat submission baru pada endpoint
             * submit.
             */
            $submission = Submission::create([
                'assignment_id' => $assignment->id,
                'student_id' => $user->id,
                'file_path' => null,
                'student_note' =>
                    $validated['student_note'] ?? null,
                'grade' => null,
            ]);

            /*
             * Simpan jawaban siswa.
             */
            $this->saveAnswers(
                $submission,
                $normalizedAnswers
            );

            /*
             * Upload file submission.
             */
            $this->uploadSubmissionFiles(
                $request,
                $submission,
                $uploadedObjects
            );

            /*
             * Auto-grading dilakukan setelah semua jawaban
             * berhasil disimpan.
             */
            $this->autoGradeSubmission(
                $submission,
                $assignment
            );

            DB::commit();

            /*
             * Reload seluruh relasi setelah transaction selesai.
             */
            $submission->load([
                'assignment.schedule.classroom',
                'assignment.schedule.subject',
                'files',
                'answers.question',
                'answers.selectedOptions.option',
            ]);

            $highestGrade = $this->getHighestGrade(
                $assignment,
                $user->id
            );

            $isLate = $this->isLate(
                $submission,
                $assignment
            );

            return response()->json([
                'message' => $isLate
                    ? 'Tugas berhasil dikumpulkan, tetapi terlambat.'
                    : 'Tugas berhasil dikumpulkan.',

                'data' => [
                    'submission' => $this->formatSubmission(
                        $submission,
                        $assignment,
                        $highestGrade
                    ),

                    /*
                     * Nilai akhir siswa selalu mengambil
                     * nilai tertinggi.
                     */
                    'final_grade' => $highestGrade,

                    'submission_mode' =>
                        $submissionMode,

                    'submission_count' =>
                        $existingSubmissions->count() + 1,
                ],
            ], 201);
        } catch (\Throwable $e) {
            DB::rollBack();

            foreach ($uploadedObjects as $objectKey) {
                try {
                    Storage::disk('s3')->delete(
                        $objectKey
                    );
                } catch (\Throwable $storageException) {
                    report($storageException);
                }
            }

            throw $e;
        }
    }

    /**
     * Mengambil submission siswa.
     *
     * Response sekarang mengembalikan:
     * - seluruh riwayat submission
     * - final_grade / nilai tertinggi
     */
    public function submission(
        Request $request,
        Assignment $assignment
    ) {
        $user = $this->ensureStudent($request);

        $assignment = $this->getAuthorizedAssignment(
            $request,
            $assignment
        );

        $this->ensureSubmissionAllowed(
            $assignment
        );

        $submissions =
            $this->getStudentSubmissions(
                $assignment,
                $user->id
            );

        if ($submissions->isEmpty()) {
            return response()->json([
                'message' => 'Siswa belum mengumpulkan tugas.',
                'data' => null,
            ]);
        }

        $highestGrade = $this->getHighestGrade(
            $assignment,
            $user->id
        );

        $formattedSubmissions =
            $submissions
                ->map(function ($submission) use (
                    $assignment,
                    $highestGrade
                ) {
                    return $this->formatSubmission(
                        $submission,
                        $assignment,
                        $highestGrade
                    );
                })
                ->values()
                ->all();

        return response()->json([
            'message' =>
                'Pengumpulan tugas berhasil diambil.',

            'data' => [
                'submission_mode' =>
                    $assignment->submission_mode ?? 'once',

                'final_grade' =>
                    $highestGrade,

                'submission_count' =>
                    $submissions->count(),

                'submissions' =>
                    $formattedSubmissions,
            ],
        ]);
    }

    /**
     * Memperbarui submission siswa.
     *
     * Endpoint ini digunakan untuk mengedit submission
     * yang sudah ada.
     *
     * Pada mode:
     *
     * once:
     * - submission pertama dapat diperbarui.
     *
     * multiple:
     * - submission terakhir dapat diperbarui.
     * - attempt sebelumnya tetap tersimpan.
     */
    public function update(
        Request $request,
        Assignment $assignment
    ) {
        $user = $this->ensureStudent($request);

        $assignment = $this->getAuthorizedAssignment(
            $request,
            $assignment
        );

        $this->ensureSubmissionAllowed(
            $assignment
        );

        $this->ensureAssignmentIsOpen(
            $assignment
        );

        /*
         * Ambil submission terbaru milik siswa.
         */
        $submission = Submission::where(
            'assignment_id',
            $assignment->id
        )
            ->where(
                'student_id',
                $user->id
            )
            ->latest('created_at')
            ->first();

        if (!$submission) {
            abort(
                404,
                'Submission belum ditemukan. Silakan kumpulkan tugas terlebih dahulu.'
            );
        }

        $validated = $request->validate([
            'student_note' => [
                'nullable',
                'string',
            ],

            'answers' => [
                'nullable',
                'array',
            ],

            'answers.*.assignment_question_id' => [
                'required',
                'integer',
            ],

            'answers.*.answer_text' => [
                'nullable',
                'string',
            ],

            'answers.*.selected_option_ids' => [
                'nullable',
                'array',
            ],

            'answers.*.selected_option_ids.*' => [
                'integer',
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

        $normalizedAnswers = [];

        if (
            array_key_exists(
                'answers',
                $validated
            )
        ) {
            $normalizedAnswers = $this->validateAnswers(
                $validated['answers'] ?? [],
                $assignment
            );
        }

        $existingFileCount = $submission
            ->files()
            ->count();

        $newFileCount = $request->hasFile('files')
            ? count($request->file('files'))
            : 0;

        $this->validateSubmissionFiles(
            $assignment,
            $existingFileCount,
            $newFileCount
        );

        DB::beginTransaction();

        $uploadedObjects = [];

        try {
            /*
             * Update catatan siswa jika dikirim.
             */
            if (
                array_key_exists(
                    'student_note',
                    $validated
                )
            ) {
                $submission->update([
                    'student_note' =>
                        $validated['student_note'],
                ]);
            }

            /*
             * Sinkronisasi jawaban jika dikirim.
             *
             * Berbeda dengan saveAnswers(), method
             * syncAnswers() juga menghapus jawaban lama
             * yang sudah tidak dikirim oleh frontend.
             *
             * Ini diperlukan agar jawaban soal opsional
             * yang dihapus siswa tidak tetap tersimpan
             * dan ikut dalam auto-grading.
             */
            if (
                array_key_exists(
                    'answers',
                    $validated
                )
            ) {
                $this->syncAnswers(
                    $submission,
                    $normalizedAnswers
                );
            }

            /*
             * Tambahkan file baru jika ada.
             */
            $this->uploadSubmissionFiles(
                $request,
                $submission,
                $uploadedObjects
            );

            /*
             * Jika assignment auto-gradable, nilai submission
             * dihitung ulang setelah jawaban diperbarui.
             */
            if (
                array_key_exists(
                    'answers',
                    $validated
                )
            ) {
                $this->autoGradeSubmission(
                    $submission,
                    $assignment
                );
            }

            DB::commit();

            $submission->load([
                'files',
                'answers.question',
                'answers.selectedOptions.option',
                'assignment.schedule.classroom',
                'assignment.schedule.subject',
            ]);

            $highestGrade = $this->getHighestGrade(
                $assignment,
                $user->id
            );

            $isLate = $this->isLate(
                $submission,
                $assignment
            );

            return response()->json([
                'message' => $isLate
                    ? 'Pengumpulan tugas berhasil diperbarui. Submission tetap tercatat sebagai terlambat.'
                    : 'Pengumpulan tugas berhasil diperbarui.',

                'data' => [
                    'submission' => $this->formatSubmission(
                        $submission,
                        $assignment,
                        $highestGrade
                    ),

                    'final_grade' =>
                        $highestGrade,

                    'submission_mode' =>
                        $assignment->submission_mode ?? 'once',
                ],
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();

            foreach ($uploadedObjects as $objectKey) {
                try {
                    Storage::disk('s3')->delete(
                        $objectKey
                    );
                } catch (\Throwable $storageException) {
                    report($storageException);
                }
            }

            throw $e;
        }
    }

    /**
     * Menghapus file dari submission siswa.
     *
     * File hanya dapat dihapus selama assignment masih
     * terbuka.
     */
    public function destroyFile(
        Request $request,
        Assignment $assignment,
        SubmissionFile $file
    ) {
        $user = $this->ensureStudent($request);

        $assignment = $this->getAuthorizedAssignment(
            $request,
            $assignment
        );

        $this->ensureSubmissionAllowed(
            $assignment
        );

        $this->ensureAssignmentIsOpen(
            $assignment
        );

        $submission = Submission::where(
            'id',
            $file->submission_id
        )
            ->where(
                'assignment_id',
                $assignment->id
            )
            ->where(
                'student_id',
                $user->id
            )
            ->firstOrFail();

        abort_unless(
            $file->submission_id === $submission->id,
            404,
            'File tidak ditemukan.'
        );

        /*
         * Jangan izinkan penghapusan file terakhir pada
         * tugas upload yang bersifat wajib.
         */
        $uploadQuestion = $assignment->questions
            ->firstWhere('type', 'upload');

        if (
            $uploadQuestion
            && $uploadQuestion->is_required
            && $submission->files()->count() <= 1
        ) {
            abort(
                422,
                'File tidak dapat dihapus karena tugas ini mewajibkan minimal satu file.'
            );
        }

        DB::beginTransaction();

        try {
            if (
                $file->object_key
                && Storage::disk('s3')->exists(
                    $file->object_key
                )
            ) {
                Storage::disk('s3')->delete(
                    $file->object_key
                );
            }

            $fileId = $file->id;

            $file->delete();

            DB::commit();

            return response()->json([
                'message' => 'File berhasil dihapus.',
                'data' => [
                    'submission_id' => $submission->id,
                    'file_id' => $fileId,
                ],
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();

            throw $e;
        }
    }

    /**
     * Menghapus seluruh submission siswa.
     *
     * Submission tidak boleh dihapus karena dapat digunakan
     * untuk mengakali:
     *
     * - mode once
     * - riwayat attempt
     * - perhitungan nilai tertinggi
     *
     * Untuk memperbaiki jawaban, gunakan endpoint update.
     */
    public function destroy(
        Request $request,
        Assignment $assignment
    ) {
        $this->ensureStudent($request);

        $assignment = $this->getAuthorizedAssignment(
            $request,
            $assignment
        );

        $this->ensureSubmissionAllowed(
            $assignment
        );

        abort(
            422,
            'Submission tidak dapat dihapus. Gunakan fitur edit submission untuk memperbarui jawaban.'
        );
    }
}