<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class HolidayService
{
    private const API_URL =
        'https://api.kemendesa.link/libur-nasional/api/holidays/latest';

    /**
     * Mengambil daftar hari libur dari API Kemendesa.
     *
     * Data disimpan dalam cache agar API eksternal
     * tidak dipanggil pada setiap request.
     */
    public function getHolidays(): array
    {
        return Cache::remember(
            'national_holidays_latest',
            now()->addDay(),
            function () {
                try {
                    $response = Http::timeout(10)
                        ->acceptJson()
                        ->get(self::API_URL);

                    if (!$response->successful()) {
                        Log::warning(
                            'Gagal mengambil data hari libur nasional.',
                            [
                                'status' => $response->status(),
                            ]
                        );

                        return [];
                    }

                    $data = $response->json();

                    if (!isset($data['data']) || !is_array($data['data'])) {
                        Log::warning(
                            'Format response API hari libur tidak sesuai.'
                        );

                        return [];
                    }

                    return $data['data'];
                } catch (\Throwable $exception) {
                    Log::error(
                        'Terjadi kesalahan saat mengambil API hari libur.',
                        [
                            'message' => $exception->getMessage(),
                        ]
                    );

                    return [];
                }
            }
        );
    }

    /**
     * Mencari hari libur berdasarkan tanggal.
     *
     * Cuti bersama juga dianggap sebagai tanggal merah
     * karena API menandainya sebagai bagian dari kalender
     * libur nasional/cuti bersama.
     */
    public function getHolidayByDate(
        string $date
    ): ?array {
        $holidays = $this->getHolidays();

        foreach ($holidays as $holiday) {
            if (
                isset($holiday['date']) &&
                $holiday['date'] === $date
            ) {
                return $holiday;
            }
        }

        return null;
    }
}