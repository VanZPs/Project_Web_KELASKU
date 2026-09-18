<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Assignment;
use App\Models\AssignmentFile;
use App\Models\AssignmentOption;
use App\Models\AssignmentQuestion;
use App\Models\Schedule;
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
     * Memastikan schedule merupakan milik guru yang sedang login.
     */
    private function getTeacherSchedule(
        Request $request,
        int $scheduleId
    ): Schedule {
        $user = $this->ensureTeacher($request);

        return Schedule::with([
            'classroom',
            'subject',
        ])
            ->where('id', $scheduleId)
            ->where('teacher_id', $user->id)
            ->firstOrFail();
    }

    /**
     * Daftar tugas milik guru yang sedang login.
     */
    public function index(Request $request)
    {
        $user = $this->ensureTeacher($request);

        $assignments = Assignment::with([
            'schedule.classroom',
            'schedule.subject',
            'questions.options',
            'files',
        ])
            ->whereHas('schedule', function ($query) use ($user) {
                $query->where('teacher_id', $user->id);
            })
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
     * schedule_id
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
            'schedule_id' => [
                'required',
                'integer',
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

            /*
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

            /*
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

        /*
         * Validasi tambahan setelah validasi dasar.
         */
        $validator->after(function ($validator) use ($request) {
            $startDate = $request->input('start_date');
            $dueDate = $request->input('due_date');
            $questions = $request->input('questions', []);

            /*
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

            /*
             * Jika tidak ada questions, tidak perlu validasi
             * struktur soal.
             */
            if (empty($questions)) {
                return;
            }

            /*
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

            /*
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

            /*
             * Upload hanya membutuhkan satu pertanyaan/instruksi.
             */
            if ($type === 'upload' && count($questions) !== 1) {
                $validator->errors()->add(
                    'questions',
                    'Tugas upload hanya dapat memiliki satu instruksi.'
                );
            }

            /*
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

            /*
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

            /*
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

                /*
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

                /*
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

        /*
         * Pastikan schedule memang milik guru yang sedang login.
         */
        $schedule = $this->getTeacherSchedule(
            $request,
            (int) $validated['schedule_id']
        );

        DB::beginTransaction();

        $uploadedObjects = [];

        try {
            /*
             * Buat assignment.
             *
             * Jika submission_mode tidak dikirim,
             * gunakan "once" sebagai default.
             */
            $assignment = Assignment::create([
                'schedule_id' => $schedule->id,
                'title' => $validated['title'],
                'description' => $validated['description'] ?? '',
                'start_date' => $validated['start_date'] ?? null,
                'due_date' => $validated['due_date'] ?? null,
                'submission_mode' => $validated['submission_mode']
                    ?? 'once',
            ]);

            /*
             * Simpan questions dan options.
             */
            if (!empty($validated['questions'])) {
                foreach (
                    array_values($validated['questions'])
                    as $questionIndex => $questionData
                ) {
                    /*
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

                    /*
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

            /*
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

            /*
             * Load seluruh relationship untuk response.
             */
            $assignment->load([
                'schedule.classroom',
                'schedule.subject',
                'questions.options',
                'files',
            ]);

            return response()->json([
                'message' => 'Tugas berhasil dibuat.',
                'data' => $assignment,
            ], 201);
        } catch (\Throwable $e) {
            DB::rollBack();

            /*
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
            'schedule.classroom',
            'schedule.subject',
            'questions.options',

            /*
             * Data siswa yang mengumpulkan tugas.
             */
            'submissions.student.user',

            /*
             * File yang dikumpulkan oleh siswa.
             */
            'submissions.files',

            /*
             * Jawaban siswa beserta pilihan yang dipilih.
             */
            'submissions.answers.selectedOptions.option',

            /*
             * File yang dilampirkan guru pada tugas.
             */
            'files',
        ]);

        abort_unless(
            $assignment->schedule &&
            $assignment->schedule->teacher_id === $user->id,
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

        $assignment->load('schedule');

        abort_unless(
            $assignment->schedule &&
            $assignment->schedule->teacher_id === $user->id,
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
                'string',
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

            /*
             * Mode pengumpulan tugas.
             */
            'submission_mode' => [
                'sometimes',
                'nullable',
                'string',
                'in:once,multiple',
            ],
        ]);

        $validator->after(function ($validator) use (
            $request,
            $assignment
        ) {
            /*
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

            /*
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

        /*
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

        /*
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
            'schedule.classroom',
            'schedule.subject',
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
            'schedule',
            'files',
        ]);

        abort_unless(
            $assignment->schedule &&
            $assignment->schedule->teacher_id === $user->id,
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
}