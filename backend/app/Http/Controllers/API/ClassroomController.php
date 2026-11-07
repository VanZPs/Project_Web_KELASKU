<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Assignment;
use App\Models\Classroom;
use App\Models\Schedule;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Http\Exceptions\HttpResponseException;

class ClassroomController extends Controller
{
    /**
     * Mengambil seluruh kelas.
     */
    public function index()
    {
        return response()->json([
            'success' => true,
            'data' => Classroom::orderBy('name')
                ->get([
                    'id',
                    'name',
                    'archived',
                ]),
        ]);
    }

    /**
     * Mengarsipkan kelas.
     */
    public function archive(Request $request, Classroom $classroom)
    {
        $this->ensureTeacher($request);

        abort_unless(
            $classroom->schedules()
                ->where('teacher_id', $request->user()->id)
                ->exists(),
            403,
            'Anda tidak memiliki akses ke kelas ini.'
        );

        $classroom->archived = true;
        $classroom->save();

        return response()->json([
            'success' => true,
            'message' => 'Kelas berhasil diarsipkan.',
            'data' => $classroom,
        ]);
    }

    /**
     * Memulihkan kelas dari arsip.
     */
    public function restore(Request $request, Classroom $classroom)
    {
        $this->ensureTeacher($request);

        abort_unless(
            $classroom->schedules()
                ->where('teacher_id', $request->user()->id)
                ->exists(),
            403,
            'Anda tidak memiliki akses ke kelas ini.'
        );

        $classroom->archived = false;
        $classroom->save();

        return response()->json([
            'success' => true,
            'message' => 'Kelas berhasil dipulihkan.',
            'data' => $classroom,
        ]);
    }

    /**
     * Menghapus satu jadwal.
     *
     * Jika jadwal tersebut adalah jadwal terakhir di kelas,
     * request harus menyertakan delete_class=true. Dalam kondisi
     * tersebut seluruh kelas akan dihapus beserta data turunannya.
     */
    public function destroySchedule(Request $request, Schedule $schedule)
    {
        $this->ensureTeacher($request);

        abort_unless(
            (int) $schedule->teacher_id === (int) $request->user()->id,
            403,
            'Anda tidak memiliki akses untuk menghapus jadwal ini.'
        );

        $deleteClass = $request->boolean('delete_class');

        $result = DB::transaction(function () use ($schedule, $deleteClass) {
            $lockedSchedule = Schedule::query()
                ->whereKey($schedule->id)
                ->lockForUpdate()
                ->firstOrFail();

            $classroom = Classroom::query()
                ->whereKey($lockedSchedule->classroom_id)
                ->lockForUpdate()
                ->firstOrFail();

            $scheduleCount = Schedule::query()
                ->where('classroom_id', $classroom->id)
                ->count();

            $isLastSchedule = $scheduleCount <= 1;

            if ($isLastSchedule && !$deleteClass) {
                throw new HttpResponseException(response()->json([
                    'success' => false,
                    'requires_class_deletion_confirmation' => true,
                    'message' => 'Ini merupakan jadwal terakhir. Konfirmasi diperlukan untuk menghapus seluruh kelas.',
                ], 409));
            }

            if (!$isLastSchedule && $deleteClass) {
                // Kondisi jadwal berubah setelah modal konfirmasi dibuka.
                // Minta guru mengonfirmasi ulang penghapusan jadwal saja.
                throw new HttpResponseException(response()->json([
                    'success' => false,
                    'requires_schedule_only_confirmation' => true,
                    'message' => 'Kelas ini masih memiliki jadwal lain. Konfirmasi ulang untuk menghapus jadwal ini saja.',
                ], 409));
            }

            $scheduleIds = $deleteClass
                ? Schedule::query()
                    ->where('classroom_id', $classroom->id)
                    ->pluck('id')
                : collect([$lockedSchedule->id]);

            $assignmentIds = DB::table('assignment_schedules')
                ->whereIn('schedule_id', $scheduleIds)
                ->pluck('assignment_id')
                ->unique()
                ->values();

            if ($deleteClass) {
                $className = $classroom->name;
                $classroom->delete();
            } else {
                $lockedSchedule->delete();
                $className = null;
            }

            // Hanya hapus tugas yang sudah tidak terhubung ke jadwal mana pun.
            $orphanAssignments = Assignment::query()
                ->whereIn('id', $assignmentIds)
                ->whereDoesntHave('schedules')
                ->with([
                    'files',
                    'submissions.files',
                ])
                ->get();

            $objectKeys = [];

            foreach ($orphanAssignments as $assignment) {
                foreach ($assignment->files as $file) {
                    if ($file->object_key) {
                        $objectKeys[] = $file->object_key;
                    }
                }

                foreach ($assignment->submissions as $submission) {
                    foreach ($submission->files as $file) {
                        if ($file->object_key) {
                            $objectKeys[] = $file->object_key;
                        }
                    }

                    // File lama sebelum penggunaan tabel submission_files.
                    if ($submission->file_path) {
                        $objectKeys[] = $submission->file_path;
                    }
                }

                // Relasi anak (soal, nilai, submission, komentar, file)
                // dihapus melalui foreign key cascade.
                $assignment->delete();
            }

            return [
                'deleted_class' => $deleteClass,
                'class_name' => $className,
                'object_keys' => array_values(array_unique($objectKeys)),
            ];
        });

        // File object storage dihapus setelah transaksi database berhasil.
        foreach ($result['object_keys'] as $objectKey) {
            try {
                Storage::disk('s3')->delete($objectKey);
            } catch (\Throwable $storageException) {
                report($storageException);
            }
        }

        return response()->json([
            'success' => true,
            'deleted_class' => $result['deleted_class'],
            'message' => $result['deleted_class']
                ? "Kelas {$result['class_name']} beserta data terkait berhasil dihapus."
                : 'Jadwal berhasil dihapus.',
        ]);
    }

    private function ensureTeacher(Request $request): void
    {
        abort_unless(
            $request->user() && $request->user()->role === 'guru',
            403,
            'Akses hanya untuk guru.'
        );
    }
}
