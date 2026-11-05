<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Assignment;
use App\Models\Attendance;
use App\Models\Journal;
use App\Models\Schedule;
use Carbon\Carbon;
use Illuminate\Http\Request;

class StudentDashboardController extends Controller
{
    /**
     * GET /api/siswa/dashboard
     *
     * Seluruh data dibatasi pada kelas dan akun siswa yang sedang login.
     */
    public function index(Request $request)
    {
        $student = $request->user();

        abort_unless(
            $student && $student->role === 'siswa',
            403,
            'Akses hanya untuk siswa.'
        );

        $student->load('classrooms:id,name');
        $classroomIds = $student->classrooms->pluck('id');

        $today = Carbon::today();
        $dayNames = [
            1 => 'Senin',
            2 => 'Selasa',
            3 => 'Rabu',
            4 => 'Kamis',
            5 => 'Jumat',
            6 => 'Sabtu',
            7 => 'Minggu',
        ];
        $todayName = $dayNames[$today->dayOfWeekIso] ?? '';

        $schedules = Schedule::query()
            ->with([
                'subject:id,name',
                'teacher:id,name',
                'classroom:id,name',
            ])
            ->whereIn('classroom_id', $classroomIds)
            ->orderBy('start_time')
            ->get();

        $todaySchedules = $schedules
            ->where('day', $todayName)
            ->values()
            ->map(function (Schedule $schedule) use ($today) {
                $now = now();
                $start = Carbon::parse($today->toDateString().' '.$schedule->start_time);
                $end = Carbon::parse($today->toDateString().' '.$schedule->end_time);

                $status = $now->greaterThanOrEqualTo($end)
                    ? 'selesai'
                    : (($now->greaterThanOrEqualTo($start) && $now->lessThanOrEqualTo($end))
                        ? 'berlangsung'
                        : 'belum');

                $periodStarts = [
                    '07:00' => 1, '07:45' => 2, '08:30' => 3,
                    '09:30' => 4, '10:15' => 5, '11:00' => 6,
                    '12:30' => 7, '13:10' => 8, '13:50' => 9,
                    '14:30' => 10,
                ];

                return [
                    'id' => $schedule->id,
                    'jam_ke' => $periodStarts[substr($schedule->start_time, 0, 5)] ?? null,
                    'waktu' => substr($schedule->start_time, 0, 5).' – '.substr($schedule->end_time, 0, 5),
                    'mata_pelajaran' => $schedule->subject?->name ?? 'Mata pelajaran',
                    'topik' => null,
                    'guru' => $schedule->teacher?->name,
                    'status' => $status,
                ];
            });

        $assignments = Assignment::query()
            ->with([
                'schedules:id,classroom_id,subject_id,teacher_id',
                'schedules.subject:id,name',
                'schedules.teacher:id,name',
                'questions:id,assignment_id,type',
            ])
            ->with(['submissions' => function ($query) use ($student) {
                $query->where('student_id', $student->id)
                    ->orderByDesc('created_at');
            }])
            ->where('status', '!=', 'draft')
            ->where('is_published', true)
            ->where(function ($query) {
                $query->whereNull('start_date')
                    ->orWhere('start_date', '<=', now());
            })
            ->whereHas('schedules', function ($query) use ($classroomIds) {
                $query->whereIn('classroom_id', $classroomIds);
            })
            ->orderByRaw('CASE WHEN due_date IS NULL THEN 1 ELSE 0 END')
            ->orderBy('due_date')
            ->get()
            ->filter(function (Assignment $assignment) use ($classroomIds) {
                $studentSchedule = $assignment->schedules->first(
                    fn ($schedule) => $classroomIds->contains($schedule->classroom_id)
                );
                $assignment->setRelation('student_schedule', $studentSchedule);

                // Tugas berupa catatan informasi bukan tugas pengumpulan.
                return !(
                    $assignment->questions->isNotEmpty()
                    && $assignment->questions->every(fn ($question) => $question->type === 'info')
                );
            })
            ->values();

        $pendingAssignments = $assignments
            ->filter(fn (Assignment $assignment) => $assignment->submissions->isEmpty())
            ->take(5)
            ->map(function (Assignment $assignment) {
                $schedule = $assignment->student_schedule;

                return [
                    'id' => $assignment->id,
                    'judul' => $assignment->title,
                    'mata_pelajaran' => $schedule?->subject?->name ?? 'Mata pelajaran',
                    'tipe' => $assignment->questions
                        ->pluck('type')
                        ->unique()
                        ->map(fn ($type) => [
                            'short' => 'Jawaban singkat',
                            'paragraph' => 'Paragraf',
                            'multiple' => 'Pilihan ganda',
                            'checkbox' => 'Kotak centang',
                            'upload' => 'Upload file',
                            'info' => 'Catatan informasi',
                        ][$type] ?? ucfirst($type))
                        ->implode(', '),
                    'tenggat' => $assignment->due_date?->toIso8601String(),
                ];
            })
            ->values();

        // Nilai per tugas memakai nilai tertinggi jika siswa mengirim revisi berulang.
        $highestGrades = $assignments->map(function (Assignment $assignment) {
            $graded = $assignment->submissions
                ->whereNotNull('grade')
                ->pluck('grade');

            return $graded->isEmpty() ? null : (float) $graded->max();
        })->filter(fn ($grade) => $grade !== null)->values();

        $recentGrades = $assignments
            ->filter(fn (Assignment $assignment) => $assignment->submissions->contains(fn ($submission) => $submission->grade !== null))
            ->sortByDesc(fn (Assignment $assignment) => $assignment->submissions->firstWhere('grade', '!=', null)?->updated_at)
            ->take(5)
            ->map(function (Assignment $assignment) {
                $gradedSubmission = $assignment->submissions
                    ->whereNotNull('grade')
                    ->sortByDesc('updated_at')
                    ->first();
                $schedule = $assignment->student_schedule;

                return [
                    'id' => $assignment->id,
                    'judul' => $assignment->title,
                    'mata_pelajaran' => $schedule?->subject?->name ?? 'Mata pelajaran',
                    'tipe' => $assignment->questions->pluck('type')->unique()->implode(', '),
                    'nilai' => (float) $gradedSubmission->grade,
                ];
            })
            ->values();

        $attendanceQuery = Attendance::query()
            ->where('student_id', $student->id)
            ->whereIn('schedule_id', $schedules->pluck('id'));

        $attendanceTotal = (clone $attendanceQuery)->count();
        $attendancePresent = (clone $attendanceQuery)->where('status', 'hadir')->count();
        $attendancePercent = $attendanceTotal > 0
            ? round(($attendancePresent / $attendanceTotal) * 100, 1)
            : null;

        $recentJournals = Journal::query()
            ->with(['schedule.subject:id,name', 'schedule.teacher:id,name'])
            ->whereIn('schedule_id', $schedules->pluck('id'))
            ->whereDate('date', '<=', $today->toDateString())
            ->orderByDesc('date')
            ->orderByDesc('id')
            ->take(5)
            ->get();

        $journalAttendance = Attendance::query()
            ->where('student_id', $student->id)
            ->whereIn('schedule_id', $recentJournals->pluck('schedule_id'))
            ->whereIn('date', $recentJournals->pluck('date')->map(fn ($date) => Carbon::parse($date)->toDateString()))
            ->get()
            ->keyBy(fn (Attendance $item) => $item->schedule_id.'-'.$item->date->toDateString());

        $recentAttendance = $recentJournals
            ->map(function (Journal $journal) use ($journalAttendance) {
                $attendance = $journalAttendance->get(
                    $journal->schedule_id.'-'.$journal->date->toDateString()
                );

                return [
                    'id' => $journal->id,
                    'tanggal' => $journal->date?->toDateString(),
                    'mata_pelajaran' => $journal->schedule?->subject?->name ?? 'Mata pelajaran',
                    'deskripsi' => $journal->topic.($journal->description ? ' — '.$journal->description : ''),
                    'meta' => $journal->schedule?->teacher?->name,
                    'status' => $attendance ? ucfirst($attendance->status) : null,
                ];
            })
            ->values();

        // Materi/pengumuman yang dibuat guru direpresentasikan oleh assignment bertipe info.
        $announcements = Assignment::query()
            ->with([
                'schedules:id,classroom_id,subject_id,teacher_id',
                'schedules.subject:id,name',
                'schedules.teacher:id,name',
                'questions:id,assignment_id,type',
            ])
            ->where('status', '!=', 'draft')
            ->where('is_published', true)
            ->where(function ($query) {
                $query->whereNull('start_date')
                    ->orWhere('start_date', '<=', now());
            })
            ->whereHas('schedules', fn ($query) => $query->whereIn('classroom_id', $classroomIds))
            ->whereHas('questions', fn ($query) => $query->where('type', 'info'))
            ->latest()
            ->get()
            ->filter(fn (Assignment $assignment) => $assignment->questions->isNotEmpty()
                && $assignment->questions->every(fn ($question) => $question->type === 'info'))
            ->take(4)
            ->map(function (Assignment $assignment) use ($classroomIds) {
                $schedule = $assignment->schedules->first(
                    fn ($item) => $classroomIds->contains($item->classroom_id)
                );

                return [
                    'id' => $assignment->id,
                    'judul' => $assignment->title,
                    'mata_pelajaran' => $schedule?->subject?->name,
                    'guru' => $schedule?->teacher?->name,
                    'tanggal' => $assignment->created_at?->toIso8601String(),
                    'baru' => $assignment->created_at?->greaterThan(now()->subDays(3)) ?? false,
                ];
            });

        $subjectGradeValues = [];
        foreach ($assignments as $assignment) {
            $graded = $assignment->submissions->whereNotNull('grade');
            if ($graded->isEmpty()) {
                continue;
            }
            $schedule = $assignment->student_schedule;
            $subjectName = $schedule?->subject?->name ?? 'Lainnya';
            $subjectGradeValues[$subjectName] ??= [];
            $subjectGradeValues[$subjectName][] = (float) $graded->max('grade');
        }

        $subjectAverages = collect($subjectGradeValues)
            ->map(fn (array $grades, string $subjectName) => [
                'mata_pelajaran' => $subjectName,
                'rata_rata' => round(array_sum($grades) / count($grades), 2),
            ])
            ->values();

        return response()->json([
            'success' => true,
            'data' => [
                'siswa' => [
                    'nama' => $student->name,
                    'kelas' => $student->classrooms->pluck('name')->implode(', '),
                ],
                'statistik' => [
                    'mata_pelajaran_hari_ini' => $todaySchedules->count(),
                    'rata_rata_nilai' => $highestGrades->isEmpty()
                        ? null
                        : round($highestGrades->avg(), 2),
                    'tugas_belum_dikumpulkan' => $assignments
                        ->filter(fn (Assignment $assignment) => $assignment->submissions->isEmpty())
                        ->count(),
                    'kehadiran' => $attendancePercent,
                ],
                'jadwal_hari_ini' => $todaySchedules,
                'tugas_belum_dikumpulkan' => $pendingAssignments,
                'pengumuman' => $announcements,
                'aktivitas_terbaru' => $recentAttendance,
                'nilai_terbaru' => $recentGrades,
                'nilai_per_mapel' => $subjectAverages,
            ],
        ]);
    }

    /**
     * GET /api/siswa/jadwal
     *
     * Jadwal dan tenggat tugas hanya untuk kelas siswa yang login.
     */
    public function schedule(Request $request)
    {
        $student = $request->user();

        abort_unless(
            $student && $student->role === 'siswa',
            403,
            'Akses hanya untuk siswa.'
        );

        $student->load('classrooms:id,name');
        $classroomIds = $student->classrooms->pluck('id');

        $schedules = Schedule::query()
            ->with([
                'classroom:id,name',
                'subject:id,name',
                'teacher:id,name',
            ])
            ->whereIn('classroom_id', $classroomIds)
            ->orderByRaw("CASE day
                WHEN 'Senin' THEN 1
                WHEN 'Selasa' THEN 2
                WHEN 'Rabu' THEN 3
                WHEN 'Kamis' THEN 4
                WHEN 'Jumat' THEN 5
                WHEN 'Sabtu' THEN 6
                ELSE 7 END")
            ->orderBy('start_time')
            ->get();

        $assignments = Assignment::query()
            ->with([
                'schedules:id,classroom_id,subject_id',
                'schedules.subject:id,name',
                'questions:id,assignment_id,type',
            ])
            ->where('status', '!=', 'draft')
            ->where('is_published', true)
            ->where(function ($query) {
                $query->whereNull('start_date')
                    ->orWhere('start_date', '<=', now());
            })
            ->whereNotNull('due_date')
            ->whereHas('schedules', function ($query) use ($classroomIds) {
                $query->whereIn('classroom_id', $classroomIds);
            })
            ->orderBy('due_date')
            ->get()
            ->filter(function (Assignment $assignment) use ($classroomIds) {
                $schedule = $assignment->schedules->first(
                    fn ($item) => $classroomIds->contains($item->classroom_id)
                );

                // Abaikan catatan informasi yang bukan tugas pengumpulan.
                $isInformationOnly = $assignment->questions->isNotEmpty()
                    && $assignment->questions->every(
                        fn ($question) => $question->type === 'info'
                    );

                if (!$schedule || $isInformationOnly) {
                    return false;
                }

                $assignment->setRelation('student_schedule', $schedule);
                return true;
            })
            ->map(function (Assignment $assignment) {
                return [
                    'id' => $assignment->id,
                    'title' => $assignment->title,
                    'due_date' => $assignment->due_date?->toIso8601String(),
                    'subject' => $assignment->student_schedule?->subject?->name,
                ];
            })
            ->values();

        return response()->json([
            'success' => true,
            'data' => [
                'student' => [
                    'name' => $student->name,
                    'classroom' => $student->classrooms->pluck('name')->implode(', '),
                ],
                'schedules' => $schedules,
                'assignments' => $assignments,
            ],
        ]);
    }

}
