<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\DailyAttendance;
use App\Models\Schedule;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;

class StudentAttendanceController extends Controller
{
    /**
     * GET /api/siswa/kehadiran
     *
     * Riwayat presensi per mata pelajaran dan presensi harian
     * untuk kelas yang diikuti siswa yang sedang login.
     */
    public function index(Request $request)
    {
        /** @var User|null $student */
        $student = $request->user();

        abort_unless($student && $student->role === 'siswa', 403, 'Akses hanya untuk siswa.');

        $student->load('classrooms:id,name');
        $classroomIds = $student->classrooms->pluck('id');

        if ($classroomIds->isEmpty()) {
            return response()->json([
                'success' => true,
                'data' => [
                    'student' => [
                        'name' => $student->name,
                        'classroom' => '',
                    ],
                    'history' => [],
                    'daily_history' => [],
                    'current_session' => null,
                    'period' => ['start_date' => null, 'end_date' => now('Asia/Jakarta')->toDateString()],
                ],
            ]);
        }

        $history = Attendance::query()
            ->with([
                'schedule:id,classroom_id,subject_id,teacher_id,day,start_time,end_time',
                'schedule.subject:id,name',
                'schedule.teacher:id,name',
            ])
            ->where('student_id', $student->id)
            ->whereHas('schedule', fn ($query) => $query->whereIn('classroom_id', $classroomIds))
            ->orderByDesc('date')
            ->orderByDesc('id')
            ->get()
            ->map(function (Attendance $attendance) {
                $schedule = $attendance->schedule;

                return [
                    'id' => $attendance->id,
                    'date' => $attendance->date?->toDateString(),
                    'status' => $attendance->status,
                    'notes' => $attendance->notes,
                    'method' => $attendance->method ?: 'guru',
                    'start_time' => $schedule?->start_time,
                    'end_time' => $schedule?->end_time,
                    'day' => $schedule?->day,
                    'subject' => $schedule?->subject?->name ?? 'Mata pelajaran',
                    'teacher' => $schedule?->teacher?->name ?? 'Guru',
                    'schedule_id' => $schedule?->id,
                ];
            })
            ->values();

        $dailyHistory = DailyAttendance::query()
            ->where('student_id', $student->id)
            ->whereIn('classroom_id', $classroomIds)
            ->orderByDesc('date')
            ->get()
            ->map(fn (DailyAttendance $attendance) => [
                'id' => $attendance->id,
                'date' => $attendance->date?->toDateString(),
                'status' => $attendance->status,
                'source_schedule_id' => $attendance->source_schedule_id,
            ])
            ->values();

        $now = Carbon::now('Asia/Jakarta');
        $today = $now->toDateString();
        $dayName = $now->copy()->locale('id')->translatedFormat('l');

        $currentSchedule = Schedule::query()
            ->with([
                'subject:id,name',
                'teacher:id,name',
            ])
            ->whereIn('classroom_id', $classroomIds)
            ->where('day', $dayName)
            ->whereTime('start_time', '<=', $now->format('H:i:s'))
            ->whereTime('end_time', '>', $now->format('H:i:s'))
            ->orderBy('start_time')
            ->get()
            ->first(function (Schedule $schedule) use ($student, $today) {
                return !Attendance::query()
                    ->where('schedule_id', $schedule->id)
                    ->where('student_id', $student->id)
                    ->whereDate('date', $today)
                    ->exists();
            });

        $firstDate = collect([
            $history->min('date'),
            $dailyHistory->min('date'),
        ])->filter()->sort()->first();

        return response()->json([
            'success' => true,
            'data' => [
                'student' => [
                    'name' => $student->name,
                    'classroom' => $student->classrooms->pluck('name')->implode(', '),
                ],
                'history' => $history,
                'daily_history' => $dailyHistory,
                'current_session' => $currentSchedule ? [
                    'schedule_id' => $currentSchedule->id,
                    'subject' => $currentSchedule->subject?->name ?? 'Mata pelajaran',
                    'teacher' => $currentSchedule->teacher?->name ?? 'Guru',
                    'start_time' => $currentSchedule->start_time,
                    'end_time' => $currentSchedule->end_time,
                    'day' => $currentSchedule->day,
                ] : null,
                'period' => [
                    'start_date' => $firstDate,
                    'end_date' => $today,
                ],
            ],
        ]);
    }
}
