<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        /*
         * Salin hubungan lama:
         *
         * assignments.schedule_id
         *
         * menjadi:
         *
         * assignment_schedules
         */
        DB::table('assignments')
            ->whereNotNull('schedule_id')
            ->orderBy('id')
            ->eachById(function ($assignment) {
                DB::table('assignment_schedules')->insertOrIgnore([
                    'assignment_id' => $assignment->id,
                    'schedule_id' => $assignment->schedule_id,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        /*
         * Tidak menghapus data pivot secara otomatis
         * karena migration ini hanya bertugas melakukan
         * migrasi hubungan dari kolom lama ke tabel pivot.
         */
    }
};