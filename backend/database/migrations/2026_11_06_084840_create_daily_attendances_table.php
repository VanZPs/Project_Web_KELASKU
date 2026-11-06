<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('daily_attendances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('classroom_id')->constrained()->cascadeOnDelete();
            $table->foreignId('student_id')->constrained('users')->cascadeOnDelete();
            $table->date('date');
            $table->enum('status', ['hadir', 'izin', 'sakit', 'dispen', 'alpa']);
            $table->foreignId('source_schedule_id')->nullable()->constrained('schedules')->nullOnDelete();
            $table->timestamps();
            $table->unique(['classroom_id', 'student_id', 'date'], 'daily_attendance_unique');
            $table->index(['student_id', 'date']);
        });

        // Backfill ringkasan harian dari data presensi yang sudah tersimpan.
        // Riwayat per mata pelajaran pada tabel attendances tidak diubah.
        $pairs = \Illuminate\Support\Facades\DB::table('attendances')
            ->join('schedules', 'schedules.id', '=', 'attendances.schedule_id')
            ->select('schedules.classroom_id', 'attendances.date')
            ->distinct()
            ->get();

        foreach ($pairs as $pair) {
            $schedules = \Illuminate\Support\Facades\DB::table('schedules')
                ->where('classroom_id', $pair->classroom_id)
                ->where('day', \Carbon\Carbon::parse($pair->date)->locale('id')->translatedFormat('l'))
                ->orderBy('start_time')
                ->get();

            $scheduleIds = $schedules->pluck('id');
            $sourceSchedule = \Illuminate\Support\Facades\DB::table('journals')
                ->join('schedules', 'schedules.id', '=', 'journals.schedule_id')
                ->whereIn('journals.schedule_id', $scheduleIds)
                ->whereDate('journals.date', $pair->date)
                ->where('journals.is_holiday', false)
                ->where('journals.topic', '!=', 'Jurnal Kelas Kosong')
                ->orderBy('schedules.start_time')
                ->select('schedules.id')
                ->first();

            $students = \Illuminate\Support\Facades\DB::table('classroom_user')
                ->join('users', 'users.id', '=', 'classroom_user.user_id')
                ->where('classroom_user.classroom_id', $pair->classroom_id)
                ->where('users.role', 'siswa')
                ->pluck('users.id');

            foreach ($students as $studentId) {
                $status = 'hadir';
                $sourceScheduleId = null;

                if ($sourceSchedule) {
                    $sourceScheduleId = $sourceSchedule->id;
                    $sourceRow = \Illuminate\Support\Facades\DB::table('attendances')
                        ->where('schedule_id', $sourceScheduleId)
                        ->where('student_id', $studentId)
                        ->whereDate('date', $pair->date)
                        ->first();

                    $status = $sourceRow->status ?? 'alpa';

                    $presentLater = \Illuminate\Support\Facades\DB::table('attendances')
                        ->join('journals', function ($join) use ($pair) {
                            $join->on('journals.schedule_id', '=', 'attendances.schedule_id')
                                ->whereDate('journals.date', $pair->date)
                                ->where('journals.is_holiday', false)
                                ->where('journals.topic', '!=', 'Jurnal Kelas Kosong');
                        })
                        ->whereIn('attendances.schedule_id', $scheduleIds)
                        ->where('attendances.student_id', $studentId)
                        ->whereDate('attendances.date', $pair->date)
                        ->where('attendances.status', 'hadir')
                        ->exists();

                    if ($presentLater) {
                        $status = 'hadir';
                    }
                }

                \Illuminate\Support\Facades\DB::table('daily_attendances')->updateOrInsert(
                    [
                        'classroom_id' => $pair->classroom_id,
                        'student_id' => $studentId,
                        'date' => $pair->date,
                    ],
                    [
                        'status' => $status,
                        'source_schedule_id' => $sourceScheduleId,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]
                );
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('daily_attendances');
    }
};
