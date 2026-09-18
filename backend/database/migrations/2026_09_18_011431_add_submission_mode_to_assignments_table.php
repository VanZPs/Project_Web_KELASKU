<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Menambahkan mode pengumpulan tugas.
     *
     * once     = siswa hanya dapat mengumpulkan satu kali.
     * multiple  = siswa dapat mengumpulkan berkali-kali
     *             selama tugas masih terbuka.
     */
    public function up(): void
    {
        Schema::table('assignments', function (Blueprint $table) {
            $table->string('submission_mode')
                ->default('once')
                ->after('due_date');
        });
    }

    /**
     * Menghapus kolom submission_mode.
     */
    public function down(): void
    {
        Schema::table('assignments', function (Blueprint $table) {
            $table->dropColumn('submission_mode');
        });
    }
};