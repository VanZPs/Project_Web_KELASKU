<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Assignment;
use App\Models\AssignmentFile;
use App\Models\Submission;
use App\Models\SubmissionFile;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class FileController extends Controller
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
     * Memastikan guru memiliki akses ke assignment.
     */
    private function authorizeTeacherAssignment(
        Request $request,
        Assignment $assignment
    ): Assignment {
        $user = $this->ensureTeacher($request);

        $assignment->load('schedule');

        abort_unless(
            $assignment->schedule &&
            $assignment->schedule->teacher_id === $user->id,
            403,
            'Anda tidak memiliki akses ke tugas ini.'
        );

        return $assignment;
    }

    /**
     * Memastikan siswa merupakan anggota kelas assignment.
     */
    private function authorizeStudentAssignment(
        Request $request,
        Assignment $assignment
    ): Assignment {
        $user = $this->ensureStudent($request);

        $assignment->load('schedule.classroom');

        abort_unless(
            $assignment->schedule &&
            $assignment->schedule->classroom,
            404,
            'Data kelas tugas tidak ditemukan.'
        );

        $isMember = $assignment->schedule
            ->classroom
            ->users()
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
     * Download file tugas oleh guru.
     */
    public function teacherAssignmentFile(
        Request $request,
        Assignment $assignment,
        AssignmentFile $file
    ) {
        $this->authorizeTeacherAssignment(
            $request,
            $assignment
        );

        abort_unless(
            $file->assignment_id === $assignment->id,
            404,
            'File tidak ditemukan.'
        );

        return $this->streamFile($file->object_key, $file->original_name);
    }

    /**
     * Download file tugas oleh siswa.
     */
    public function studentAssignmentFile(
        Request $request,
        Assignment $assignment,
        AssignmentFile $file
    ) {
        $this->authorizeStudentAssignment(
            $request,
            $assignment
        );

        abort_unless(
            $file->assignment_id === $assignment->id,
            404,
            'File tidak ditemukan.'
        );

        return $this->streamFile($file->object_key, $file->original_name);
    }

    /**
     * Preview file tugas oleh siswa.
     */
    public function studentAssignmentPreview(
        Request $request,
        Assignment $assignment,
        AssignmentFile $file
    ) {
        $this->authorizeStudentAssignment(
            $request,
            $assignment
        );

        abort_unless(
            $file->assignment_id === $assignment->id,
            404,
            'File tidak ditemukan.'
        );

        return $this->previewFile(
            $file->object_key,
            $file->original_name,
            $file->mime_type
        );
    }

    /**
     * Download file submission milik siswa sendiri.
     */
    public function studentSubmissionFile(
        Request $request,
        Assignment $assignment,
        SubmissionFile $file
    ) {
        $user = $this->ensureStudent($request);

        $this->authorizeStudentAssignment(
            $request,
            $assignment
        );

        $submission = Submission::where('id', $file->submission_id)
            ->where('assignment_id', $assignment->id)
            ->where('student_id', $user->id)
            ->firstOrFail();

        abort_unless(
            $file->submission_id === $submission->id,
            404,
            'File tidak ditemukan.'
        );

        return $this->streamFile(
            $file->object_key,
            $file->original_name
        );
    }

    /**
     * Preview file submission milik siswa sendiri.
     */
    public function studentSubmissionPreview(
        Request $request,
        Assignment $assignment,
        SubmissionFile $file
    ) {
        $user = $this->ensureStudent($request);

        $this->authorizeStudentAssignment(
            $request,
            $assignment
        );

        $submission = Submission::where('id', $file->submission_id)
            ->where('assignment_id', $assignment->id)
            ->where('student_id', $user->id)
            ->firstOrFail();

        abort_unless(
            $file->submission_id === $submission->id,
            404,
            'File tidak ditemukan.'
        );

        return $this->previewFile(
            $file->object_key,
            $file->original_name,
            $file->mime_type
        );
    }

    /**
     * Download file submission siswa oleh guru.
     */
    public function teacherSubmissionFile(
        Request $request,
        Assignment $assignment,
        SubmissionFile $file
    ) {
        $this->authorizeTeacherAssignment(
            $request,
            $assignment
        );

        $submission = Submission::where('id', $file->submission_id)
            ->where('assignment_id', $assignment->id)
            ->firstOrFail();

        abort_unless(
            $file->submission_id === $submission->id,
            404,
            'File tidak ditemukan.'
        );

        return $this->streamFile(
            $file->object_key,
            $file->original_name
        );
    }

    /**
     * Preview file submission siswa oleh guru.
     */
    public function teacherSubmissionPreview(
        Request $request,
        Assignment $assignment,
        SubmissionFile $file
    ) {
        $this->authorizeTeacherAssignment(
            $request,
            $assignment
        );

        $submission = Submission::where('id', $file->submission_id)
            ->where('assignment_id', $assignment->id)
            ->firstOrFail();

        abort_unless(
            $file->submission_id === $submission->id,
            404,
            'File tidak ditemukan.'
        );

        return $this->previewFile(
            $file->object_key,
            $file->original_name,
            $file->mime_type
        );
    }

    /**
     * Stream file dari MinIO ke browser.
     */
    private function streamFile(
        string $objectKey,
        string $originalName
    ) {
        $disk = Storage::disk('s3');

        abort_unless(
            $disk->exists($objectKey),
            404,
            'File tidak ditemukan di storage.'
        );

        $stream = $disk->readStream($objectKey);

        abort_unless(
            $stream !== false,
            404,
            'File tidak dapat dibaca.'
        );

        $mimeType = $disk->mimeType($objectKey)
            ?: 'application/octet-stream';

        return response()->streamDownload(
            function () use ($stream) {
                fpassthru($stream);

                if (is_resource($stream)) {
                    fclose($stream);
                }
            },
            $originalName,
            [
                'Content-Type' => $mimeType,
                'Content-Disposition' =>
                    'attachment; filename="' .
                    addslashes($originalName) .
                    '"',
            ]
        );
    }

    /**
     * Preview file yang didukung browser.
     */
    private function previewFile(
        string $objectKey,
        string $originalName,
        ?string $storedMimeType = null
    ) {
        $disk = Storage::disk('s3');

        abort_unless(
            $disk->exists($objectKey),
            404,
            'File tidak ditemukan di storage.'
        );

        $stream = $disk->readStream($objectKey);

        abort_unless(
            $stream !== false,
            404,
            'File tidak dapat dibaca.'
        );

        $mimeType = $storedMimeType
            ?: $disk->mimeType($objectKey)
            ?: 'application/octet-stream';

        /*
         * Hanya tipe tertentu yang aman untuk
         * ditampilkan secara inline oleh browser.
         */
        $previewableMimeTypes = [
            'application/pdf',

            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',

            'audio/mpeg',
            'audio/wav',
            'audio/ogg',
            'audio/mp4',

            'video/mp4',
            'video/webm',
            'video/ogg',

            'text/plain',
            'text/csv',
        ];

        if (!in_array($mimeType, $previewableMimeTypes, true)) {
            fclose($stream);

            return $this->streamFile(
                $objectKey,
                $originalName
            );
        }

        return response()->stream(
            function () use ($stream) {
                fpassthru($stream);

                if (is_resource($stream)) {
                    fclose($stream);
                }
            },
            200,
            [
                'Content-Type' => $mimeType,
                'Content-Disposition' =>
                    'inline; filename="' .
                    addslashes($originalName) .
                    '"',
                'Cache-Control' => 'private, no-cache',
            ]
        );
    }
}