<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Assignment;
use App\Models\Classroom;
use App\Models\Schedule;
use App\Models\Submission;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class GradeController extends Controller
{
    /**
     * Memastikan pengguna yang mengakses halaman Nilai
     * adalah guru yang sudah login.
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
     * Mengambil siswa yang terdaftar pada suatu kelas.
     *
     * Nama, email, dan jenis kelamin berasal dari database.
     */
    private function getClassStudents(int $classroomId): Collection
    {
        $classroom = Classroom::findOrFail($classroomId);

        return $classroom->users()
            ->where('users.role', 'siswa')
            ->with('student')
            ->orderBy('users.name')
            ->get([
                'users.id',
                'users.name',
                'users.email',
                'users.role',
            ]);
    }

    /**
     * Mengambil tugas bernilai yang terhubung dengan
     * jadwal milik guru.
     *
     * Tugas draft tidak ditampilkan.
     * Tugas yang seluruh soalnya bertipe info dikecualikan.
     */
    private function getGradedAssignments(
        int $teacherId,
        array $scheduleIds,
        array $studentIds
    ): Collection {
        if (empty($scheduleIds)) {
            return collect();
        }

        $assignments = Assignment::query()
            ->with([
                'schedules:id,classroom_id,subject_id,teacher_id',
                'questions:id,assignment_id,type,question,order',
                'submissions' => function ($query) use ($studentIds) {
                    $query->select([
                        'id',
                        'assignment_id',
                        'student_id',
                        'grade',
                    ])
                        ->whereIn('student_id', $studentIds)
                        ->whereNotNull('grade');
                },
            ])
            ->where('status', '!=', 'draft')
            ->whereHas('schedules', function ($query) use (
                $teacherId,
                $scheduleIds
            ) {
                $query
                    ->whereIn('schedules.id', $scheduleIds)
                    ->where('schedules.teacher_id', $teacherId);
            })
            ->orderBy('created_at')
            ->orderBy('id')
            ->get();

        return $assignments
            ->filter(function (Assignment $assignment) {
                $questions = $assignment->questions;

                // Tugas tanpa soal tetap dapat ditampilkan jika
                // merupakan tugas lama yang mempunyai nilai.
                if ($questions->isEmpty()) {
                    return true;
                }

                // Keluarkan tugas yang seluruh soalnya hanya
                // berupa catatan informasi.
                return !$questions->every(
                    fn ($question) => $question->type === 'info'
                );
            })
            ->values();
    }

    /**
     * Menghitung nilai tertinggi untuk setiap pasangan:
     * siswa + tugas.
     *
     * Hasil:
     * [
     *   assignment_id => [
     *     student_id => grade
     *   ]
     * ]
     */
    private function buildGradeMap(
        Collection $assignments
    ): array {
        $gradeMap = [];

        foreach ($assignments as $assignment) {
            $assignmentId = (int) $assignment->id;

            foreach ($assignment->submissions as $submission) {
                if ($submission->grade === null) {
                    continue;
                }

                $studentId = (int) $submission->student_id;
                $grade = (float) $submission->grade;

                if (
                    !isset($gradeMap[$assignmentId][$studentId]) ||
                    $grade > $gradeMap[$assignmentId][$studentId]
                ) {
                    $gradeMap[$assignmentId][$studentId] = $grade;
                }
            }
        }

        return $gradeMap;
    }

    /**
     * Mengambil seluruh nilai yang tersedia dari grade map.
     */
    private function collectGradeValues(array $gradeMap): array
    {
        $values = [];

        foreach ($gradeMap as $studentGrades) {
            foreach ($studentGrades as $grade) {
                $values[] = (float) $grade;
            }
        }

        return $values;
    }

    /**
     * Menghitung rata-rata.
     *
     * Mengembalikan null jika belum ada nilai.
     */
    private function calculateAverage(array $values): ?float
    {
        if (count($values) === 0) {
            return null;
        }

        return round(
            array_sum($values) / count($values),
            2
        );
    }

    /**
     * GET /api/guru/nilai
     *
     * Ringkasan nilai seluruh mata pelajaran dan kelas
     * yang diajar oleh guru yang sedang login.
     */
    public function index(Request $request)
    {
        $teacher = $this->ensureTeacher($request);

        $schedules = Schedule::query()
            ->with([
                'subject:id,name',
                'classroom:id,name',
            ])
            ->where('teacher_id', $teacher->id)
            ->get();

        // Kelompokkan jadwal berdasarkan mata pelajaran.
        $subjectGroups = $schedules
            ->filter(
                fn ($schedule) =>
                    $schedule->subject !== null &&
                    $schedule->classroom !== null
            )
            ->groupBy('subject_id');

        $subjects = [];
        $overallGradeValues = [];
        $overallStudentCount = 0;

        foreach ($subjectGroups as $subjectId => $subjectSchedules) {
            $subject = $subjectSchedules->first()->subject;

            // Beberapa jadwal dapat mewakili kelas dan mata
            // pelajaran yang sama. Kelompokkan kelas agar
            // statistik dan siswa tidak dihitung berulang.
            $classGroups = $subjectSchedules
                ->groupBy('classroom_id');

            $classes = [];
            $subjectGradeValues = [];
            $subjectStudentCount = 0;

            foreach ($classGroups as $classroomId => $classSchedules) {
                $classroom = $classSchedules->first()->classroom;

                $scheduleIds = $classSchedules
                    ->pluck('id')
                    ->map(fn ($id) => (int) $id)
                    ->unique()
                    ->values()
                    ->all();

                $students = $this->getClassStudents(
                    (int) $classroomId
                );

                $studentIds = $students
                    ->pluck('id')
                    ->map(fn ($id) => (int) $id)
                    ->all();

                $assignments = $this->getGradedAssignments(
                    (int) $teacher->id,
                    $scheduleIds,
                    $studentIds
                );

                $gradeMap = $this->buildGradeMap($assignments);
                $gradeValues = $this->collectGradeValues($gradeMap);

                $average = $this->calculateAverage($gradeValues);

                // Hitung rata-rata untuk setiap tugas agar dapat
                // ditampilkan sebagai grafik pada card kelas.
                $taskAverages = $assignments
                    ->map(function (Assignment $assignment) use ($gradeMap) {
                        $assignmentId = (int) $assignment->id;
                        $taskGrades = array_values(
                            $gradeMap[$assignmentId] ?? []
                        );

                        return [
                            'assignment_id' => $assignmentId,
                            'title' => $assignment->title,
                            'average' => $this->calculateAverage($taskGrades),
                            'graded_count' => count($taskGrades),
                        ];
                    })
                    ->values()
                    ->all();

                $classes[] = [
                    'classroom_id' => (int) $classroomId,
                    'classroom_name' => $classroom->name,
                    'subject_id' => (int) $subjectId,
                    'subject_name' => $subject->name,
                    'student_count' => $students->count(),
                    'task_count' => $assignments->count(),
                    'graded_count' => count($gradeValues),
                    'average' => $average,
                    'task_averages' => $taskAverages,
                ];

                $subjectStudentCount += $students->count();

                foreach ($gradeValues as $value) {
                    $subjectGradeValues[] = $value;
                    $overallGradeValues[] = $value;
                }
            }

            $subjects[] = [
                'subject_id' => (int) $subjectId,
                'subject_name' => $subject->name,
                'class_count' => count($classes),
                'student_count' => $subjectStudentCount,
                'average' => $this->calculateAverage(
                    $subjectGradeValues
                ),
                'classes' => $classes,
            ];

            $overallStudentCount += $subjectStudentCount;
        }

        // Urutkan nama mata pelajaran dan kelas secara konsisten.
        usort(
            $subjects,
            fn ($a, $b) => strcasecmp(
                $a['subject_name'],
                $b['subject_name']
            )
        );

        foreach ($subjects as &$subjectData) {
            usort(
                $subjectData['classes'],
                fn ($a, $b) => strcasecmp(
                    $a['classroom_name'],
                    $b['classroom_name']
                )
            );
        }
        unset($subjectData);

        return response()->json([
            'message' => 'Ringkasan nilai berhasil diambil.',
            'data' => [
                'summary' => [
                    'subject_count' => count($subjects),
                    'student_count' => $overallStudentCount,
                    'average' => $this->calculateAverage(
                        $overallGradeValues
                    ),
                    'graded_count' => count($overallGradeValues),
                ],
                'subjects' => $subjects,
            ],
        ]);
    }

    /**
     * GET /api/guru/nilai/leger
     *
     * Query:
     * classroom_id
     * subject_id
     *
     * Mengambil siswa, tugas, dan nilai untuk satu kelas
     * pada satu mata pelajaran.
     */
    public function leger(Request $request)
    {
        $teacher = $this->ensureTeacher($request);

        $validated = $request->validate([
            'classroom_id' => [
                'required',
                'integer',
                'exists:classrooms,id',
            ],
            'subject_id' => [
                'required',
                'integer',
                'exists:subjects,id',
            ],
        ]);

        $classroomId = (int) $validated['classroom_id'];
        $subjectId = (int) $validated['subject_id'];

        // Pastikan kelas dan mata pelajaran memang ada
        // dalam jadwal guru yang sedang login.
        $schedules = Schedule::query()
            ->with([
                'subject:id,name',
                'classroom:id,name',
            ])
            ->where('teacher_id', $teacher->id)
            ->where('classroom_id', $classroomId)
            ->where('subject_id', $subjectId)
            ->get();

        abort_if(
            $schedules->isEmpty(),
            404,
            'Kelas atau mata pelajaran tidak ditemukan pada jadwal Anda.'
        );

        $classroom = $schedules->first()->classroom;
        $subject = $schedules->first()->subject;

        $students = $this->getClassStudents($classroomId);

        $studentIds = $students
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();

        $scheduleIds = $schedules
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();

        $assignments = $this->getGradedAssignments(
            (int) $teacher->id,
            $scheduleIds,
            $studentIds
        );

        $gradeMap = $this->buildGradeMap($assignments);

        $typeLabels = [
            'short' => 'Jawaban singkat',
            'paragraph' => 'Paragraf',
            'multiple' => 'Pilihan ganda',
            'checkbox' => 'Kotak centang',
            'upload' => 'Upload file',
            'info' => 'Catatan informasi',
        ];

        $taskData = $assignments->map(function ($assignment) use (
            $typeLabels,
            $gradeMap
        ) {
            $types = $assignment->questions
                ->pluck('type')
                ->unique()
                ->values();

            $labels = $types
                ->map(
                    fn ($type) =>
                        $typeLabels[$type] ?? ucfirst($type)
                )
                ->values();

            $taskGrades = $gradeMap[(int) $assignment->id] ?? [];

            return [
                'id' => (int) $assignment->id,
                'title' => $assignment->title,
                'type' => $types->count() === 1
                    ? $types->first()
                    : ($types->isEmpty() ? 'legacy' : 'mixed'),
                'type_label' => $labels->isEmpty()
                    ? 'Tugas'
                    : $labels->implode(', '),
                'graded_count' => count($taskGrades),
                'average' => $this->calculateAverage(
                    array_values($taskGrades)
                ),
            ];
        })->values();

        $studentData = $students->map(function ($student) use (
            $assignments,
            $gradeMap
        ) {
            $scores = [];
            $studentGrades = [];

            foreach ($assignments as $assignment) {
                $assignmentId = (int) $assignment->id;
                $studentId = (int) $student->id;

                $grade = $gradeMap[$assignmentId][$studentId] ?? null;

                $scores[] = [
                    'assignment_id' => $assignmentId,
                    'grade' => $grade,
                ];

                if ($grade !== null) {
                    $studentGrades[] = (float) $grade;
                }
            }

            $gender = $student->student?->jenis_kelamin;

            return [
                'id' => (int) $student->id,
                'name' => $student->name,
                'email' => $student->email,
                'gender' => $gender,
                'initials' => collect(
                    preg_split('/\s+/', trim($student->name))
                )
                    ->filter()
                    ->take(2)
                    ->map(fn ($part) => mb_substr($part, 0, 1))
                    ->implode(''),
                'average' => $this->calculateAverage($studentGrades),
                'scores' => $scores,
            ];
        })->values();

        $allGrades = $this->collectGradeValues($gradeMap);

        return response()->json([
            'message' => 'Leger nilai berhasil diambil.',
            'data' => [
                'classroom' => [
                    'id' => (int) $classroom->id,
                    'name' => $classroom->name,
                ],
                'subject' => [
                    'id' => (int) $subject->id,
                    'name' => $subject->name,
                ],
                'summary' => [
                    'student_count' => $studentData->count(),
                    'task_count' => $taskData->count(),
                    'graded_count' => count($allGrades),
                    'average' => $this->calculateAverage($allGrades),
                ],
                'tasks' => $taskData,
                'students' => $studentData,
            ],
        ]);
    }

    // Memperbarui nilai siswa pada kelas dan mata pelajaran tertentu.
    public function updateGrade(Request $request)
    {
        $validated = $request->validate([
            'classroom_id' => ['required', 'integer', 'exists:classrooms,id'],
            'subject_id' => ['required', 'integer', 'exists:subjects,id'],
            'student_id' => ['required', 'integer', 'exists:users,id'],
            'assignment_id' => ['required', 'integer', 'exists:assignments,id'],
            'grade' => ['required', 'numeric', 'min:0', 'max:100'],
        ]);

        $teacherId = $request->user()->id;

        // Pastikan guru memang mengajar mapel di kelas tersebut.
        $hasSchedule = Schedule::query()
            ->where('teacher_id', $teacherId)
            ->where('classroom_id', $validated['classroom_id'])
            ->where('subject_id', $validated['subject_id'])
            ->exists();

        if (! $hasSchedule) {
            return response()->json([
                'message' => 'Anda tidak berhak mengubah nilai pada kelas ini.',
            ], 403);
        }

        // Pastikan tugas terkait dengan kelas dan mata pelajaran tersebut.
        $assignment = Assignment::query()
            ->whereKey($validated['assignment_id'])
            ->whereHas('schedules', function ($query) use ($validated) {
                $query->where('classroom_id', $validated['classroom_id'])
                    ->where('subject_id', $validated['subject_id']);
            })
            ->first();

        if (! $assignment) {
            return response()->json([
                'message' => 'Tugas tidak ditemukan pada kelas dan mata pelajaran ini.',
            ], 404);
        }

        // Pastikan siswa terdaftar pada kelas yang dipilih.
        $studentIsInClass = DB::table('classroom_user')
            ->where('classroom_id', $validated['classroom_id'])
            ->where('user_id', $validated['student_id'])
            ->exists();

        if (! $studentIsInClass) {
            return response()->json([
                'message' => 'Siswa tidak terdaftar pada kelas ini.',
            ], 422);
        }

        // Perbarui nilai yang ada atau buat record nilai jika belum tersedia.
        $submission = Submission::updateOrCreate(
            [
                'assignment_id' => $validated['assignment_id'],
                'student_id' => $validated['student_id'],
            ],
            [
                'grade' => $validated['grade'],
            ]
        );

        return response()->json([
            'message' => 'Nilai berhasil diperbarui.',
            'data' => [
                'student_id' => $submission->student_id,
                'assignment_id' => $submission->assignment_id,
                'grade' => $submission->grade,
            ],
        ]);
    }
}