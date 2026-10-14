<?php

namespace App\Console\Commands;

use App\Models\Attendance;
use App\Models\Journal;
use App\Models\Schedule;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class GenerateEmptyJournals extends Command
{
    protected $signature = 'journals:generate-empty {--date= : Tanggal YYYY-MM-DD}';
    protected $description = 'Membuat jurnal kosong dan menyinkronkan presensi kelas setelah jadwal berakhir';

    private const EMPTY_TOPIC = 'Jurnal Kelas Kosong';
    private const EMPTY_DESCRIPTION = 'Guru belum mengisi jurnal kelas/kelas kosong';
    private const SCHOOL_END_TIME = '15:15:00';

    public function handle(): int
    {
        $timezone = 'Asia/Jakarta';
        $now = now($timezone);
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
        $currentTime = $now->format('H:i:s');
        $endOfDay = $dateString < $now->toDateString()
            || ($dateString === $now->toDateString() && $currentTime >= self::SCHOOL_END_TIME);

        $schedules = Schedule::with('classroom.users')
            ->where('day', $day)
            ->orderBy('start_time')
            ->get();

        if ($schedules->isEmpty()) {
            $this->info("Tidak ada jadwal untuk {$day}, {$dateString}.");
            return self::SUCCESS;
        }

        $created = 0;

        DB::transaction(function () use ($schedules, $dateString, $currentTime, $endOfDay, &$created) {
            foreach ($schedules as $schedule) {
                $endTime = substr((string) $schedule->end_time, 0, 8);
                if (!$endOfDay && $endTime > $currentTime) {
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

            foreach ($schedules->groupBy('classroom_id') as $classSchedules) {
                $classSchedules = $classSchedules->sortBy('start_time')->values();
                $scheduleIds = $classSchedules->pluck('id');

                // Pilih jadwal paling awal yang jurnalnya diisi guru dan memiliki presensi.
                $sourceAttendance = collect();
                foreach ($classSchedules as $candidate) {
                    $journal = Journal::where('schedule_id', $candidate->id)
                        ->whereDate('date', $dateString)
                        ->first();

                    if (!$journal || $journal->is_holiday || $journal->topic === self::EMPTY_TOPIC) {
                        continue;
                    }

                    $rows = Attendance::where('schedule_id', $candidate->id)
                        ->whereDate('date', $dateString)
                        ->orderBy('student_id')
                        ->get();

                    if ($rows->isNotEmpty()) {
                        $sourceAttendance = $rows;
                        break;
                    }
                }

                $emptySchedules = $classSchedules->filter(fn ($schedule) =>
                    Journal::where('schedule_id', $schedule->id)
                        ->whereDate('date', $dateString)
                        ->where('topic', self::EMPTY_TOPIC)
                        ->exists()
                );

                if ($sourceAttendance->isNotEmpty()) {
                    foreach ($emptySchedules as $emptySchedule) {
                        foreach ($sourceAttendance as $source) {
                            Attendance::updateOrCreate(
                                [
                                    'schedule_id' => $emptySchedule->id,
                                    'student_id' => $source->student_id,
                                    'date' => $dateString,
                                ],
                                ['status' => $source->status, 'notes' => $source->notes]
                            );
                        }
                    }
                    continue;
                }

                // Fallback akhir hari: hadir hanya jika tidak ada jurnal guru di kelas/tanggal itu.
                if ($endOfDay) {
                    $hasTeacherJournal = Journal::whereIn('schedule_id', $scheduleIds)
                        ->whereDate('date', $dateString)
                        ->where('topic', '!=', self::EMPTY_TOPIC)
                        ->where('is_holiday', false)
                        ->exists();

                    if (!$hasTeacherJournal) {
                        $students = $classSchedules->first()->classroom?->users
                            ?->where('role', 'siswa') ?? collect();

                        foreach ($emptySchedules as $emptySchedule) {
                            foreach ($students as $student) {
                                Attendance::updateOrCreate(
                                    [
                                        'schedule_id' => $emptySchedule->id,
                                        'student_id' => $student->id,
                                        'date' => $dateString,
                                    ],
                                    ['status' => 'hadir', 'notes' => null]
                                );
                            }
                        }
                    }
                }
            }
        });

        $this->info("Tanggal: {$dateString}");
        $this->info("Jurnal kosong baru dibuat: {$created}");
        return self::SUCCESS;
    }
}