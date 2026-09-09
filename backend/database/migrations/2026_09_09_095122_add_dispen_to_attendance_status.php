<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::statement("
            ALTER TABLE attendances
            DROP CONSTRAINT IF EXISTS attendances_status_check
        ");

        DB::statement("
            ALTER TABLE attendances
            ADD CONSTRAINT attendances_status_check
            CHECK (
                status IN (
                    'hadir',
                    'sakit',
                    'izin',
                    'dispen',
                    'alpa'
                )
            )
        ");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement("
            UPDATE attendances
            SET status = 'izin'
            WHERE status = 'dispen'
        ");

        DB::statement("
            ALTER TABLE attendances
            DROP CONSTRAINT IF EXISTS attendances_status_check
        ");

        DB::statement("
            ALTER TABLE attendances
            ADD CONSTRAINT attendances_status_check
            CHECK (
                status IN (
                    'hadir',
                    'sakit',
                    'izin',
                    'alpa'
                )
            )
        ");
    }
};