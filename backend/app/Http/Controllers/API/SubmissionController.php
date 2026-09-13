<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Assignment;
use App\Models\Submission;
use App\Models\SubmissionFile;
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
     * Memastikan siswa merupakan anggota kelas dari tugas.
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
     * Menentukan apakah submission terlambat.
     *
     * Submission tetap diperbolehkan setelah due_date.
     */
    private function isLate(
        Submission $submission,
        Assignment $assignment
    ): bool {
        return $submission->created_at !== null
            && $submission->created_at->greaterThan($assignment->due_date);
    }

    /**
     * Menambahkan informasi status keterlambatan
     * ke response submission.
     */
    private function formatSubmission(
        Submission $submission,
        Assignment $assignment
    ): array {
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
            'is_late' => $this->isLate($submission, $assignment),
            'files' => $submission->files,
        ];
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
            'submissions' => function ($query) use ($user) {
                $query->where('student_id', $user->id)
                    ->with('files');
            },
        ])
            ->whereHas('schedule', function ($query) use ($classroomIds) {
                $query->whereIn('classroom_id', $classroomIds);
            })
            ->latest()
            ->get();

        /*
         * Tambahkan status keterlambatan pada submission
         * milik siswa yang sedang login.
         */
        $assignments->each(function ($assignment) {
            $assignment->submissions->each(function ($submission) use ($assignment) {
                $submission->setAttribute(
                    'is_late',
                    $this->isLate($submission, $assignment)
                );
            });
        });

        return response()->json([
            'message' => 'Daftar tugas berhasil diambil.',
            'data' => $assignments,
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
            'submissions' => function ($query) use ($user) {
                $query->where('student_id', $user->id)
                    ->with('files');
            },
        ]);

        $assignment->submissions->each(function ($submission) use ($assignment) {
            $submission->setAttribute(
                'is_late',
                $this->isLate($submission, $assignment)
            );
        });

        return response()->json([
            'message' => 'Detail tugas berhasil diambil.',
            'data' => $assignment,
        ]);
    }

    /**
     * Membuat atau mengganti pengumpulan tugas siswa.
     *
     * Submission tetap diperbolehkan meskipun sudah melewati
     * due_date. Status keterlambatan dihitung berdasarkan
     * created_at submission.
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

        $validated = $request->validate([
            'student_note' => [
                'nullable',
                'string',
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

        $submission = Submission::where('assignment_id', $assignment->id)
            ->where('student_id', $user->id)
            ->first();

        DB::beginTransaction();

        $uploadedObjects = [];

        try {
            /*
             * Submission baru.
             *
             * created_at akan menjadi waktu pertama kali
             * siswa mengumpulkan tugas.
             */
            if (!$submission) {
                $submission = Submission::create([
                    'assignment_id' => $assignment->id,
                    'student_id' => $user->id,
                    'file_path' => null,
                    'student_note' => $validated['student_note'] ?? null,
                ]);
            } else {
                /*
                 * Jika submission sudah ada, created_at tidak berubah.
                 * Dengan demikian status terlambat tetap berdasarkan
                 * waktu pertama kali dikumpulkan.
                 */
                $submission->update([
                    'student_note' => $validated['student_note'] ?? null,
                ]);
            }

            /*
             * Upload file ke MinIO.
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

                    $objectKey = "submissions/{$submission->id}/{$filename}";

                    Storage::disk('s3')->putFileAs(
                        "submissions/{$submission->id}",
                        $file,
                        $filename
                    );

                    $uploadedObjects[] = $objectKey;

                    SubmissionFile::create([
                        'submission_id' => $submission->id,
                        'original_name' => $file->getClientOriginalName(),
                        'object_key' => $objectKey,
                        'mime_type' => $file->getClientMimeType(),
                        'size' => $file->getSize(),
                    ]);
                }
            }

            DB::commit();

            $submission->load([
                'assignment.schedule.classroom',
                'assignment.schedule.subject',
                'files',
            ]);

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

            /*
             * Jika database gagal setelah file berhasil
             * di-upload, hapus object tersebut dari MinIO.
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
     * Mengambil submission milik siswa yang sedang login.
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

        $submission = Submission::with([
            'files',
            'assignment.schedule.classroom',
            'assignment.schedule.subject',
        ])
            ->where('assignment_id', $assignment->id)
            ->where('student_id', $user->id)
            ->first();

        if (!$submission) {
            return response()->json([
                'message' => 'Siswa belum mengumpulkan tugas.',
                'data' => null,
            ]);
        }

        return response()->json([
            'message' => 'Pengumpulan tugas berhasil diambil.',
            'data' => $this->formatSubmission(
                $submission,
                $assignment
            ),
        ]);
    }

    /**
     * Mengubah catatan dan menambahkan file baru
     * pada submission yang sudah ada.
     *
     * created_at tetap dipertahankan sehingga status
     * keterlambatan tetap berdasarkan waktu pengumpulan pertama.
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

        $submission = Submission::where('assignment_id', $assignment->id)
            ->where('student_id', $user->id)
            ->firstOrFail();

        $validated = $request->validate([
            'student_note' => [
                'nullable',
                'string',
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

        DB::beginTransaction();

        $uploadedObjects = [];

        try {
            if (array_key_exists('student_note', $validated)) {
                $submission->update([
                    'student_note' => $validated['student_note'],
                ]);
            }

            /*
             * File baru ditambahkan ke submission yang sama.
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

                    $objectKey = "submissions/{$submission->id}/{$filename}";

                    Storage::disk('s3')->putFileAs(
                        "submissions/{$submission->id}",
                        $file,
                        $filename
                    );

                    $uploadedObjects[] = $objectKey;

                    SubmissionFile::create([
                        'submission_id' => $submission->id,
                        'original_name' => $file->getClientOriginalName(),
                        'object_key' => $objectKey,
                        'mime_type' => $file->getClientMimeType(),
                        'size' => $file->getSize(),
                    ]);
                }
            }

            DB::commit();

            $submission->load([
                'files',
                'assignment.schedule.classroom',
                'assignment.schedule.subject',
            ]);

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
                    Storage::disk('s3')->delete($objectKey);
                } catch (\Throwable $storageException) {
                    report($storageException);
                }
            }

            throw $e;
        }
    }

    /**
     * Menghapus satu file dari submission siswa.
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

        /*
        * Pastikan file memang berasal dari submission
        * milik assignment yang sedang diakses.
        */
        $submission = Submission::where('id', $file->submission_id)
            ->where('assignment_id', $assignment->id)
            ->where('student_id', $user->id)
            ->firstOrFail();

        abort_unless(
            $file->submission_id === $submission->id,
            404,
            'File tidak ditemukan.'
        );

        DB::beginTransaction();

        try {
            /*
            * Hapus object dari MinIO terlebih dahulu.
            */
            if (
                $file->object_key &&
                Storage::disk('s3')->exists($file->object_key)
            ) {
                Storage::disk('s3')->delete($file->object_key);
            }

            /*
            * Setelah object berhasil dihapus,
            * hapus metadata file dari PostgreSQL.
            */
            $file->delete();

            DB::commit();

            return response()->json([
                'message' => 'File berhasil dihapus.',
                'data' => [
                    'submission_id' => $submission->id,
                    'file_id' => $file->id,
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

        $submission = Submission::with('files')
            ->where('assignment_id', $assignment->id)
            ->where('student_id', $user->id)
            ->firstOrFail();

        DB::beginTransaction();

        try {
            foreach ($submission->files as $file) {
                if (
                    $file->object_key &&
                    Storage::disk('s3')->exists($file->object_key)
                ) {
                    Storage::disk('s3')->delete($file->object_key);
                }
            }

            $submission->delete();

            DB::commit();

            return response()->json([
                'message' => 'Pengumpulan tugas berhasil dihapus.',
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();

            throw $e;
        }
    }
}