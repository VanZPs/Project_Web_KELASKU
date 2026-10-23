<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('journals:generate-holidays')
    ->dailyAt('00:05')
    ->timezone('Asia/Jakarta');

Schedule::command('journals:generate-empty')
    ->everyMinute()
    ->timezone('Asia/Jakarta')
    ->withoutOverlapping();

// Publikasikan tugas yang telah mencapai waktu aktivasi terjadwal.
Artisan::command('assignments:activate-scheduled', function () {
    $now = now('UTC');

    $activated = \App\Models\Assignment::query()
        ->whereNotNull('activation_at')
        ->whereNull('activation_processed_at')
        ->where('activation_at', '<=', $now)
        ->update([
            'is_published' => true,
            'activation_processed_at' => $now,
            'updated_at' => $now,
        ]);

    $this->info("Tugas yang diaktifkan otomatis: {$activated}.");
})->purpose('Aktifkan tugas saat jadwal aktivasi tercapai');

Schedule::command('assignments:activate-scheduled')
    ->everyMinute()
    ->timezone('Asia/Jakarta')
    ->withoutOverlapping();
