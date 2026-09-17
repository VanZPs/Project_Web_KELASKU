<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Assignment;
use App\Models\AssignmentQuestion;
use App\Models\Submission;
use App\Models\SubmissionAnswer;
use App\Models\SubmissionAnswerOption;
use App\Models\SubmissionFile;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class SubmissionController extends Controller
{
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
     * memberikan informasi atau pengumuman kepada siswa.
     * Assignment tersebut tidak memerlukan submission.
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

    private function formatSubmission(
        Submission $submission,
        Assignment $assignment
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

        return [
            'id' => $submission->id,
            'assignment_id' => $submission->assignment_id,
            'student_id' => $submission->student_id,
            'file_path' => $submission->file_path,
            'student_note' => $submission->student_note,
            'grade' => $submission->grade,
            'teacher_feedback' => $submission->teacher_feedback,
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
     * Field is_correct dari option sengaja tidak disertakan.
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
     * Dibuat secara eksplisit agar field sensitif seperti
     * is_correct tidak pernah ikut dikirim.
     */
    private function formatStudentAssignment(
        Assignment $assignment,
        array $formattedSubmissions
    ): array {
        return [
            'id' => $assignment->id,
            'schedule_id' => $assignment->schedule_id,
            'title' => $assignment->title,
            'description' => $assignment->description,
            'due_date' => $assignment->due_date,
            'created_at' => $assignment->created_at,
            'updated_at' => $assignment->updated_at,
            'start_date' => $assignment->start_date,

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
     * Jika pertanyaan upload bersifat wajib, minimal harus
     * terdapat satu file pada submission.
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
                ]);
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
            ->map(function ($assignment) {
                $formattedSubmissions =
                    $assignment->submissions
                        ->map(function ($submission) use ($assignment) {
                            return $this->formatSubmission(
                                $submission,
                                $assignment
                            );
                        })
                        ->values()
                        ->all();

                return $this->formatStudentAssignment(
                    $assignment,
                    $formattedSubmissions
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
                ]);
            },
        ]);

        $formattedSubmissions =
            $assignment->submissions
                ->map(function ($submission) use ($assignment) {
                    return $this->formatSubmission(
                        $submission,
                        $assignment
                    );
                })
                ->values()
                ->all();

        $data = $this->formatStudentAssignment(
            $assignment,
            $formattedSubmissions
        );

        return response()->json([
            'message' => 'Detail tugas berhasil diambil.',
            'data' => $data,
        ]);
    }

    /**
     * Membuat atau memperbarui submission siswa.
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

        $existingSubmission = Submission::where(
            'assignment_id',
            $assignment->id
        )
            ->where(
                'student_id',
                $user->id
            )
            ->first();

        $existingFileCount = $existingSubmission
            ? $existingSubmission->files()->count()
            : 0;

        $newFileCount = $request->hasFile('files')
            ? count($request->file('files'))
            : 0;

        $this->validateSubmissionFiles(
            $assignment,
            $existingFileCount,
            $newFileCount
        );

        $submission = $existingSubmission;

        DB::beginTransaction();

        $uploadedObjects = [];

        try {
            if (!$submission) {
                $submission = Submission::create([
                    'assignment_id' => $assignment->id,
                    'student_id' => $user->id,
                    'file_path' => null,
                    'student_note' =>
                        $validated['student_note'] ?? null,
                ]);
            } else {
                $submission->update([
                    'student_note' =>
                        $validated['student_note'] ?? null,
                ]);
            }

            $this->saveAnswers(
                $submission,
                $normalizedAnswers
            );

            if ($request->hasFile('files')) {
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

            DB::commit();

            $submission->load([
                'assignment.schedule.classroom',
                'assignment.schedule.subject',
                'files',
                'answers.question',
                'answers.selectedOptions.option',
            ]);

            $submission->answers->each(
                function ($answer) {
                    $answer->load([
                        'question',
                        'selectedOptions.option',
                    ]);
                }
            );

            $isLate = $this->isLate(
                $submission,
                $assignment
            );

            return response()->json([
                'message' => $isLate
                    ? 'Tugas berhasil dikumpulkan, tetapi terlambat.'
                    : 'Tugas berhasil dikumpulkan.',
                'data' => $this->formatSubmission(
                    $submission,
                    $assignment
                ),
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

        $submission = Submission::with([
            'files',
            'answers.question',
            'answers.selectedOptions.option',
            'assignment.schedule.classroom',
            'assignment.schedule.subject',
        ])
            ->where(
                'assignment_id',
                $assignment->id
            )
            ->where(
                'student_id',
                $user->id
            )
            ->first();

        if (!$submission) {
            return response()->json([
                'message' => 'Siswa belum mengumpulkan tugas.',
                'data' => null,
            ]);
        }

        $submission->answers->each(
            function ($answer) {
                $answer->load([
                    'question',
                    'selectedOptions.option',
                ]);
            }
        );

        return response()->json([
            'message' =>
                'Pengumpulan tugas berhasil diambil.',
            'data' => $this->formatSubmission(
                $submission,
                $assignment
            ),
        ]);
    }

    /**
     * Memperbarui submission siswa.
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

        $submission = Submission::where(
            'assignment_id',
            $assignment->id
        )
            ->where(
                'student_id',
                $user->id
            )
            ->firstOrFail();

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

            if (
                array_key_exists(
                    'answers',
                    $validated
                )
            ) {
                $this->saveAnswers(
                    $submission,
                    $normalizedAnswers
                );
            }

            if ($request->hasFile('files')) {
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

            DB::commit();

            $submission->load([
                'files',
                'answers.question',
                'answers.selectedOptions.option',
                'assignment.schedule.classroom',
                'assignment.schedule.subject',
            ]);

            $submission->answers->each(
                function ($answer) {
                    $answer->load([
                        'question',
                        'selectedOptions.option',
                    ]);
                }
            );

            $isLate = $this->isLate(
                $submission,
                $assignment
            );

            return response()->json([
                'message' => $isLate
                    ? 'Pengumpulan tugas berhasil diperbarui. Submission tetap tercatat sebagai terlambat.'
                    : 'Pengumpulan tugas berhasil diperbarui.',
                'data' => $this->formatSubmission(
                    $submission,
                    $assignment
                ),
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
     */
    public function destroy(
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

        $submission = Submission::with('files')
            ->where(
                'assignment_id',
                $assignment->id
            )
            ->where(
                'student_id',
                $user->id
            )
            ->firstOrFail();

        /*
         * Submission tetap boleh dihapus secara keseluruhan.
         *
         * Setelah submission dihapus, siswa dapat membuat
         * submission baru. Jika tugas merupakan upload wajib,
         * submission baru tetap harus memiliki minimal satu file.
         */

        DB::beginTransaction();

        try {
            foreach ($submission->files as $file) {
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
            }

            $submission->delete();

            DB::commit();

            return response()->json([
                'message' =>
                    'Pengumpulan tugas berhasil dihapus.',
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();

            throw $e;
        }
    }
}