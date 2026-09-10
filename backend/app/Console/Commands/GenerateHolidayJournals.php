<?php

namespace App\Console\Commands;

use App\Models\Journal;
use App\Models\Schedule;
use App\Services\HolidayService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class GenerateHolidayJournals extends Command
{
    protected $signature = 'journals:generate-holidays
                            {--date= : Tanggal yang ingin diproses (format YYYY-MM-DD)}';

    protected $description =
        'Membuat jurnal otomatis untuk jadwal guru yang bertepatan dengan tanggal merah';

    public function handle(
        HolidayService $holidayService
    ): int {
        /*
        |--------------------------------------------------------------------------
        | Tentukan tanggal yang akan diproses
        |--------------------------------------------------------------------------
        |
        | Jika --date diberikan, gunakan tanggal tersebut.
        | Jika tidak, gunakan tanggal hari ini.
        |
        */

        $dateOption = $this->option('date');

        if ($dateOption) {
            try {
                $date = \Carbon\Carbon::createFromFormat(
                    'Y-m-d',
                    $dateOption
                )
                    ->timezone('Asia/Jakarta')
                    ->toDateString();
            } catch (\Throwable $exception) {
                $this->error(
                    'Format tanggal tidak valid. Gunakan format YYYY-MM-DD.'
                );

                return self::FAILURE;
            }
        } else {
            $date = now()
                ->timezone('Asia/Jakarta')
                ->toDateString();
        }

        /*
        |--------------------------------------------------------------------------
        | Cek apakah tanggal tersebut merupakan hari libur
        |--------------------------------------------------------------------------
        */

        $holiday = $holidayService->getHolidayByDate($date);

        if (!$holiday) {
            $this->info(
                "Tanggal {$date} bukan tanggal merah."
            );

            return self::SUCCESS;
        }

        /*
        |--------------------------------------------------------------------------
        | Ambil nama hari dan nama hari libur
        |--------------------------------------------------------------------------
        */

        $carbonDate = \Carbon\Carbon::parse($date)
            ->timezone('Asia/Jakarta')
            ->locale('id');

        $day = $carbonDate->translatedFormat('l');

        $holidayName = $holiday['name']
            ?? 'Hari Libur Nasional';

        /*
        |--------------------------------------------------------------------------
        | Ambil semua jadwal yang berlangsung pada hari tersebut
        |--------------------------------------------------------------------------
        */

        $schedules = Schedule::where(
            'day',
            $day
        )->get();

        if ($schedules->isEmpty()) {
            $this->info(
                "Tidak ada jadwal pada {$day}, {$date}."
            );

            return self::SUCCESS;
        }

        /*
        |--------------------------------------------------------------------------
        | Buat jurnal otomatis
        |--------------------------------------------------------------------------
        */

        $created = 0;
        $existing = 0;

        foreach ($schedules as $schedule) {
            $journal = Journal::firstOrCreate(
                [
                    'schedule_id' => $schedule->id,
                    'date' => $date,
                ],
                [
                    'topic' => 'Hari Libur Nasional',

                    'description' => $holidayName,

                    'is_holiday' => true,

                    'holiday_name' => $holidayName,
                ]
            );

            if ($journal->wasRecentlyCreated) {
                $created++;

                Log::info(
                    'Jurnal hari libur berhasil dibuat.',
                    [
                        'schedule_id' => $schedule->id,
                        'date' => $date,
                        'holiday_name' => $holidayName,
                    ]
                );
            } else {
                $existing++;
            }
        }

        /*
        |--------------------------------------------------------------------------
        | Tampilkan hasil
        |--------------------------------------------------------------------------
        */

        $this->info(
            "Tanggal: {$date}"
        );

        $this->info(
            "Hari: {$day}"
        );

        $this->info(
            "Hari libur: {$holidayName}"
        );

        $this->info(
            "Jurnal baru: {$created}"
        );

        $this->info(
            "Jurnal sudah ada: {$existing}"
        );

        return self::SUCCESS;
    }
}