<?php

namespace App\Services;

use App\Models\Attendance;
use App\Models\DailyAttendance;
use App\Models\Journal;
use App\Models\Schedule;
use App\Models\User;
use Carbon\Carbon;

class DailyAttendanceService
{
    private const EMPTY_TOPIC = 'Jurnal Kelas Kosong';

    /**
     * Sinkronkan presensi utama kelas pada tanggal tertentu.
     * Sumber awal adalah jurnal guru paling awal berdasarkan jam jadwal,
     * bukan nomor jam pelajaran yang ditetapkan secara tetap.
     */
    public static function syncClassDate(int $classroomId, string $date): void
    {
        $day = Carbon::parse($date, 'Asia/Jakarta')
            ->locale('id')
            ->translatedFormat('l');

        $schedules = Schedule::query()
            ->where('classroom_id', $classroomId)
            ->where('day', $day)
            ->orderBy('start_time')
            ->get();

        if ($schedules->isEmpty()) {
            return;
        }

        $scheduleIds = $schedules->pluck('id');

        $journals = Journal::query()
            ->whereIn('schedule_id', $scheduleIds)
            ->whereDate('date', $date)
            ->where('is_holiday', false)
            ->where('topic', '!=', self::EMPTY_TOPIC)
            ->get()
            ->keyBy('schedule_id');

        $students = User::query()
            ->where('role', 'siswa')
            ->whereHas('classrooms', fn ($query) => $query->where('classrooms.id', $classroomId))
            ->get(['id']);

        if ($students->isEmpty()) {
            return;
        }

        $firstSchedule = $schedules->first(
            fn (Schedule $schedule) => $journals->has($schedule->id)
        );

        if ($firstSchedule) {
            $sourceRows = Attendance::query()
                ->where('schedule_id', $firstSchedule->id)
                ->whereDate('date', $date)
                ->get()
                ->keyBy('student_id');

            foreach ($students as $student) {
                $row = $sourceRows->get($student->id);
                $daily = DailyAttendance::firstOrCreate(
                    [
                        'classroom_id' => $classroomId,
                        'student_id' => $student->id,
                        'date' => $date,
                    ],
                    [
                        'status' => $row?->status ?? 'alpa',
                        'source_schedule_id' => $firstSchedule->id,
                    ]
                );

                // Perubahan pada sumber awal dapat memperbarui status harian,
                // tetapi tidak boleh menurunkan status Hadir yang sudah tercapai.
                if (
                    !$daily->wasRecentlyCreated
                    && $daily->status !== 'hadir'
                    && (int) $daily->source_schedule_id === (int) $firstSchedule->id
                ) {
                    $daily->update([
                        'status' => $row?->status ?? 'alpa',
                    ]);
                }
            }
        }

        // Jika siswa tercatat Hadir pada pertemuan mana pun, presensi harian
        // menjadi Hadir. Status pertemuan yang sudah tersimpan tidak diubah.
        $presentStudentIds = Attendance::query()
            ->whereIn('schedule_id', $scheduleIds->all())
            ->whereDate('date', $date)
            ->where('status', 'hadir')
            ->pluck('student_id')
            ->unique();

        foreach ($presentStudentIds as $studentId) {
            DailyAttendance::updateOrCreate(
                [
                    'classroom_id' => $classroomId,
                    'student_id' => $studentId,
                    'date' => $date,
                ],
                [
                    'status' => 'hadir',
                    'source_schedule_id' => $firstSchedule?->id,
                ]
            );
        }
    }

    /**
     * Ketika tidak ada jurnal guru di kelas sampai akhir hari,
     * seluruh siswa mendapat Hadir harian tanpa membuat presensi mapel.
     */
    public static function markClassPresent(int $classroomId, string $date): int
    {
        $students = User::query()
            ->where('role', 'siswa')
            ->whereHas('classrooms', fn ($query) => $query->where('classrooms.id', $classroomId))
            ->get(['id']);

        foreach ($students as $student) {
            DailyAttendance::firstOrCreate(
                [
                    'classroom_id' => $classroomId,
                    'student_id' => $student->id,
                    'date' => $date,
                ],
                [
                    'status' => 'hadir',
                    'source_schedule_id' => null,
                ]
            );
        }

        return $students->count();
    }
}
