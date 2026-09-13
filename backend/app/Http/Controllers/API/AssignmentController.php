<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Assignment;
use App\Models\AssignmentFile;
use App\Models\Schedule;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
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
    private function getTeacherSchedule(Request $request, int $scheduleId): Schedule
    {
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
     */
    public function store(Request $request)
    {
        $user = $this->ensureTeacher($request);

        $validated = $request->validate([
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
            'due_date' => [
                'required',
                'date',
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

        // Pastikan schedule memang milik guru yang sedang login.
        $schedule = $this->getTeacherSchedule(
            $request,
            (int) $validated['schedule_id']
        );

        DB::beginTransaction();

        $uploadedObjects = [];

        try {
            $assignment = Assignment::create([
                'schedule_id' => $schedule->id,
                'title' => $validated['title'],
                'description' => $validated['description'] ?? '',
                'due_date' => $validated['due_date'],
            ]);

            if ($request->hasFile('files')) {
                foreach ($request->file('files') as $file) {
                    $extension = strtolower(
                        $file->getClientOriginalExtension()
                    );

                    $filename = (string) Str::uuid();

                    if ($extension !== '') {
                        $filename .= '.' . $extension;
                    }

                    $objectKey = "assignments/{$assignment->id}/{$filename}";

                    Storage::disk('s3')->putFileAs(
                        "assignments/{$assignment->id}",
                        $file,
                        $filename
                    );

                    $uploadedObjects[] = $objectKey;

                    AssignmentFile::create([
                        'assignment_id' => $assignment->id,
                        'original_name' => $file->getClientOriginalName(),
                        'object_key' => $objectKey,
                        'mime_type' => $file->getClientMimeType(),
                        'size' => $file->getSize(),
                    ]);
                }
            }

            DB::commit();

            $assignment->load([
                'schedule.classroom',
                'schedule.subject',
                'files',
            ]);

            return response()->json([
                'message' => 'Tugas berhasil dibuat.',
                'data' => $assignment,
            ], 201);
        } catch (\Throwable $e) {
            DB::rollBack();

            // Jika database gagal setelah file berhasil di-upload,
            // hapus kembali object dari MinIO.
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
    public function show(Request $request, Assignment $assignment)
    {
        $user = $this->ensureTeacher($request);

        $assignment->load([
            'schedule.classroom',
            'schedule.subject',
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
     */
    public function update(Request $request, Assignment $assignment)
    {
        $user = $this->ensureTeacher($request);

        $assignment->load('schedule');

        abort_unless(
            $assignment->schedule &&
            $assignment->schedule->teacher_id === $user->id,
            403,
            'Anda tidak memiliki akses ke tugas ini.'
        );

        $validated = $request->validate([
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
            'due_date' => [
                'sometimes',
                'required',
                'date',
            ],
        ]);

        $assignment->update($validated);

        $assignment->load([
            'schedule.classroom',
            'schedule.subject',
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
    public function destroy(Request $request, Assignment $assignment)
    {
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
                    Storage::disk('s3')->delete($file->object_key);
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