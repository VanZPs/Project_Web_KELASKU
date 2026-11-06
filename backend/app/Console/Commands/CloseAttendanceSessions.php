<?php

namespace App\Console\Commands;

use App\Models\AttendanceSession;
use App\Models\Schedule;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class CloseAttendanceSessions extends Command
{
    protected $signature = 'attendance:close-ended';

    protected $description = 'Menutup sesi QR presensi setelah jam pelajaran berakhir';

    public function handle(): int
    {
        $timezone = 'Asia/Jakarta';
        $now = Carbon::now($timezone);
        $date = $now->toDateString();
        $day = $now->copy()->locale('id')->translatedFormat('l');

        $schedules = Schedule::query()
            ->where('day', $day)
            ->where('end_time', '<=', $now->format('H:i:s'))
            ->get();

        $closed = 0;

        DB::transaction(function () use ($schedules, $date, $now, &$closed) {
            foreach ($schedules as $schedule) {
                // Penutupan sesi QR dilakukan per jadwal. Penentuan Hadir/Alpa
                // ditunda sampai seluruh jadwal sekolah pada hari tersebut selesai.
                $closed += AttendanceSession::where('schedule_id', $schedule->id)
                    ->whereDate('date', $date)
                    ->whereNull('closed_at')
                    ->update(['closed_at' => $now]);
            }
        });

        $this->info("Sesi QR yang ditutup: {$closed}");

        return self::SUCCESS;
    }
}
