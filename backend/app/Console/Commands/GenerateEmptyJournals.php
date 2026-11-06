<?php

namespace App\Console\Commands;

use App\Services\DailyAttendanceService;
use App\Models\Journal;
use App\Models\Schedule;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class GenerateEmptyJournals extends Command
{
    protected $signature = 'journals:generate-empty {--date= : Tanggal YYYY-MM-DD}';
    protected $description = 'Membuat jurnal kosong dan menetapkan presensi harian setelah seluruh jadwal selesai';

    private const EMPTY_TOPIC = 'Jurnal Kelas Kosong';
    private const EMPTY_DESCRIPTION = 'Guru belum mengisi jurnal kelas/kelas kosong';

    public function handle(): int
    {
        $timezone = 'Asia/Jakarta';
        $now = Carbon::now($timezone);
        $dateOption = $this->option('date');

        try {
            $date = $dateOption
                ? Carbon::createFromFormat('!Y-m-d', $dateOption, $timezone)
                : $now->copy()->startOfDay();
        } catch (\Throwable $exception) {
            $this->error('Format tanggal tidak valid. Gunakan YYYY-MM-DD.');
            return self::FAILURE;
        }

        if (!$date || $date->format('Y-m-d') !== ($dateOption ?: $now->toDateString())) {
            $this->error('Tanggal tidak valid. Gunakan YYYY-MM-DD.');
            return self::FAILURE;
        }

        $dateString = $date->toDateString();
        $day = $date->copy()->locale('id')->translatedFormat('l');
        $isPastDate = $dateString < $now->toDateString();
        $currentTime = $now->format('H:i:s');

        $schedules = Schedule::with('classroom.users')
            ->where('day', $day)
            ->orderBy('start_time')
            ->get();

        if ($schedules->isEmpty()) {
            $this->info("Tidak ada jadwal untuk {$day}, {$dateString}.");
            return self::SUCCESS;
        }

        // Hari dianggap selesai setelah jadwal dengan waktu berakhir paling akhir selesai.
        $lastEndTime = $schedules->max(fn ($schedule) => substr((string) $schedule->end_time, 0, 8));
        $isEndOfDay = $isPastDate || ($dateString === $now->toDateString() && $currentTime >= $lastEndTime);

        $created = 0;
        $attendanceCreated = 0;

        DB::transaction(function () use (
            $schedules,
            $dateString,
            $currentTime,
            $isPastDate,
            $isEndOfDay,
            &$created,
            &$attendanceCreated
        ) {
            // Buat jurnal kosong hanya untuk jadwal yang sudah berakhir.
            foreach ($schedules as $schedule) {
                $endTime = substr((string) $schedule->end_time, 0, 8);
                if (!$isPastDate && $endTime > $currentTime) {
                    continue;
                }

                $journal = Journal::firstOrCreate(
                    ['schedule_id' => $schedule->id, 'date' => $dateString],
                    [
                        'topic' => self::EMPTY_TOPIC,
                        'description' => self::EMPTY_DESCRIPTION,
                        'is_holiday' => false,
                        'holiday_name' => null,
                    ]
                );

                if ($journal->wasRecentlyCreated) {
                    $created++;
                    Log::info('Jurnal kelas kosong otomatis dibuat.', [
                        'schedule_id' => $schedule->id,
                        'classroom_id' => $schedule->classroom_id,
                        'date' => $dateString,
                    ]);
                }
            }

            // Jangan menetapkan Hadir/Alpa sebelum jadwal terakhir sekolah selesai.
            if (!$isEndOfDay) {
                return;
            }

            foreach ($schedules->groupBy('classroom_id') as $classroomId => $classSchedules) {
                $hasTeacherJournal = Journal::whereIn('schedule_id', $classSchedules->pluck('id'))
                    ->whereDate('date', $dateString)
                    ->where('topic', '!=', self::EMPTY_TOPIC)
                    ->where('is_holiday', false)
                    ->exists();

                if (!$hasTeacherJournal) {
                    $attendanceCreated += DailyAttendanceService::markClassPresent(
                        (int) $classroomId,
                        $dateString
                    );

                    Log::info('Presensi harian otomatis Hadir karena tidak ada jurnal guru seharian.', [
                        'classroom_id' => $classroomId,
                        'date' => $dateString,
                    ]);
                    continue;
                }

                DailyAttendanceService::syncClassDate((int) $classroomId, $dateString);
            }
        });

        $this->info("Tanggal: {$dateString}");
        $this->info("Jurnal kosong baru dibuat: {$created}");
        if ($isEndOfDay) {
            $this->info("Presensi otomatis baru dibuat: {$attendanceCreated}");
        } else {
            $this->info('Presensi akhir hari belum diproses karena masih ada jadwal sekolah yang berlangsung/akan dimulai.');
        }

        return self::SUCCESS;
    }
}
