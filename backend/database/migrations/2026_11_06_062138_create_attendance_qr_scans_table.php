<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attendance_qr_scans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('attendance_session_id')
                ->constrained('attendance_sessions')
                ->cascadeOnDelete();
            $table->foreignId('schedule_id')->constrained()->cascadeOnDelete();
            $table->foreignId('student_id')->constrained('users')->cascadeOnDelete();
            $table->date('date');
            $table->timestamp('scanned_at');
            $table->timestamps();

            // Satu siswa hanya memiliki satu scan pending per jadwal dan tanggal.
            $table->unique(['schedule_id', 'student_id', 'date'], 'qr_scan_schedule_student_date_unique');
            $table->index(['attendance_session_id', 'date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendance_qr_scans');
    }
};
