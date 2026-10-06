<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Assignment;
use App\Models\TaskComment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class TaskCommentController extends Controller
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
    ) {
        $user = $this->ensureTeacher($request);

        $assignment->loadMissing([
            'schedules.classroom',
        ]);

        abort_unless(
            $assignment->schedules->contains(
                'teacher_id',
                $user->id
            ),
            403,
            'Anda tidak memiliki akses ke tugas ini.'
        );

        return $user;
    }

    /**
     * Memastikan classroom merupakan classroom
     * yang digunakan oleh assignment dan guru tersebut.
     */
    private function authorizeTeacherClassroom(
        Assignment $assignment,
        int $classroomId,
        int $teacherId
    ) {
        $schedule = $assignment->schedules
            ->first(function ($schedule) use (
                $classroomId,
                $teacherId
            ) {
                return (int) $schedule->classroom_id ===
                    $classroomId
                    &&
                    (int) $schedule->teacher_id ===
                    $teacherId;
            });

        abort_unless(
            $schedule,
            403,
            'Anda tidak memiliki akses ke kelas ini untuk tugas tersebut.'
        );

        return $schedule;
    }

    /**
     * Memastikan siswa memiliki akses ke assignment.
     *
     * Siswa hanya boleh mengakses tugas yang diberikan
     * kepada schedule yang classroom-nya diikuti siswa tersebut.
     */
    private function authorizeStudentAssignment(
        Request $request,
        Assignment $assignment
    ) {
        $user = $this->ensureStudent($request);

        $assignment->loadMissing([
            'schedules.classroom',
        ]);

        $schedule = $assignment->schedules
            ->first(function ($schedule) use ($user) {
                if (!$schedule->classroom) {
                    return false;
                }

                return $schedule->classroom
                    ->users()
                    ->where('users.id', $user->id)
                    ->exists();
            });

        abort_unless(
            $schedule,
            403,
            'Anda tidak memiliki akses ke tugas ini.'
        );

        return [
            'user' => $user,
            'classroom_id' => (int) $schedule->classroom_id,
        ];
    }

    /**
     * Mengambil daftar komentar tugas untuk guru.
     *
     * GET
     * /api/guru/tugas/{assignment}/komentar
     *
     * Query:
     * ?classroom_id=1
     */
    public function teacherIndex(
        Request $request,
        Assignment $assignment
    ) {
        $user = $this->authorizeTeacherAssignment(
            $request,
            $assignment
        );

        $validator = Validator::make(
            $request->all(),
            [
                'classroom_id' => [
                    'required',
                    'integer',
                    'exists:classrooms,id',
                ],
            ],
            [
                'classroom_id.required' =>
                    'Kelas wajib dipilih.',

                'classroom_id.integer' =>
                    'ID kelas tidak valid.',

                'classroom_id.exists' =>
                    'Kelas tidak ditemukan.',
            ]
        );

        $validated = $validator->validate();

        $classroomId = (int) $validated['classroom_id'];

        $this->authorizeTeacherClassroom(
            $assignment,
            $classroomId,
            (int) $user->id
        );

        $comments = TaskComment::query()
            ->where('assignment_id', $assignment->id)
            ->where('classroom_id', $classroomId)
            ->with([
                'user:id,name,role',
            ])
            ->orderBy('created_at', 'asc')
            ->get();

        return response()->json([
            'message' => 'Komentar tugas berhasil diambil.',
            'data' => $comments,
        ]);
    }

    /**
     * Mengambil daftar komentar tugas untuk siswa.
     *
     * GET
     * /api/siswa/tugas/{assignment}/komentar
     */
    public function studentIndex(
        Request $request,
        Assignment $assignment
    ) {
        $access = $this->authorizeStudentAssignment(
            $request,
            $assignment
        );

        $comments = TaskComment::query()
            ->where('assignment_id', $assignment->id)
            ->where(
                'classroom_id',
                $access['classroom_id']
            )
            ->with([
                'user:id,name,role',
            ])
            ->orderBy('created_at', 'asc')
            ->get();

        return response()->json([
            'message' => 'Komentar tugas berhasil diambil.',
            'data' => $comments,
        ]);
    }

    /**
     * Guru membuat komentar.
     *
     * POST
     * /api/guru/tugas/{assignment}/komentar
     *
     * Body:
     * {
     *     "classroom_id": 1,
     *     "comment": "..."
     * }
     */
    public function teacherStore(
        Request $request,
        Assignment $assignment
    ) {
        $user = $this->authorizeTeacherAssignment(
            $request,
            $assignment
        );

        $validator = Validator::make(
            $request->all(),
            [
                'classroom_id' => [
                    'required',
                    'integer',
                    'exists:classrooms,id',
                ],

                'comment' => [
                    'required',
                    'string',
                    'max:2000',
                ],
            ],
            [
                'classroom_id.required' =>
                    'Kelas wajib dipilih.',

                'classroom_id.integer' =>
                    'ID kelas tidak valid.',

                'classroom_id.exists' =>
                    'Kelas tidak ditemukan.',

                'comment.required' =>
                    'Komentar tidak boleh kosong.',

                'comment.max' =>
                    'Komentar maksimal 2000 karakter.',
            ]
        );

        $validated = $validator->validate();

        $classroomId = (int) $validated['classroom_id'];

        $this->authorizeTeacherClassroom(
            $assignment,
            $classroomId,
            (int) $user->id
        );

        $comment = TaskComment::create([
            'assignment_id' => $assignment->id,
            'classroom_id' => $classroomId,
            'user_id' => $user->id,
            'comment' => trim($validated['comment']),
        ]);

        $comment->load([
            'user:id,name,role',
        ]);

        return response()->json([
            'message' => 'Komentar berhasil dikirim.',
            'data' => $comment,
        ], 201);
    }

    /**
     * Siswa membuat komentar.
     *
     * POST
     * /api/siswa/tugas/{assignment}/komentar
     */
    public function studentStore(
        Request $request,
        Assignment $assignment
    ) {
        $access = $this->authorizeStudentAssignment(
            $request,
            $assignment
        );

        $validator = Validator::make(
            $request->all(),
            [
                'comment' => [
                    'required',
                    'string',
                    'max:2000',
                ],
            ],
            [
                'comment.required' =>
                    'Komentar tidak boleh kosong.',

                'comment.max' =>
                    'Komentar maksimal 2000 karakter.',
            ]
        );

        $validated = $validator->validate();

        $comment = TaskComment::create([
            'assignment_id' => $assignment->id,
            'classroom_id' => $access['classroom_id'],
            'user_id' => $access['user']->id,
            'comment' => trim($validated['comment']),
        ]);

        $comment->load([
            'user:id,name,role',
        ]);

        return response()->json([
            'message' => 'Komentar berhasil dikirim.',
            'data' => $comment,
        ], 201);
    }

    /**
     * Guru menghapus komentar.
     *
     * Guru dapat menghapus komentar yang ada
     * pada kelas yang memang menjadi tanggung jawabnya
     * untuk assignment tersebut.
     */
    public function teacherDestroy(
        Request $request,
        Assignment $assignment,
        TaskComment $comment
    ) {
        $user = $this->authorizeTeacherAssignment(
            $request,
            $assignment
        );

        abort_unless(
            (int) $comment->assignment_id ===
                (int) $assignment->id,
            404,
            'Komentar tidak ditemukan.'
        );

        $this->authorizeTeacherClassroom(
            $assignment,
            (int) $comment->classroom_id,
            (int) $user->id
        );

        $comment->delete();

        return response()->json([
            'message' => 'Komentar berhasil dihapus.',
        ]);
    }

    /**
     * Siswa menghapus komentarnya sendiri.
     */
    public function studentDestroy(
        Request $request,
        Assignment $assignment,
        TaskComment $comment
    ) {
        $access = $this->authorizeStudentAssignment(
            $request,
            $assignment
        );

        abort_unless(
            (int) $comment->assignment_id ===
                (int) $assignment->id,
            404,
            'Komentar tidak ditemukan.'
        );

        abort_unless(
            (int) $comment->classroom_id ===
                (int) $access['classroom_id'],
            404,
            'Komentar tidak ditemukan.'
        );

        /**
         * Siswa hanya boleh menghapus komentar
         * miliknya sendiri.
         */
        abort_unless(
            (int) $comment->user_id ===
                (int) $access['user']->id,
            403,
            'Anda hanya dapat menghapus komentar Anda sendiri.'
        );

        $comment->delete();

        return response()->json([
            'message' => 'Komentar berhasil dihapus.',
        ]);
    }
}