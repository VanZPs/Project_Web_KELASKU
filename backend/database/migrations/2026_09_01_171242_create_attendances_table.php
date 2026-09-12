<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('attendances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('schedule_id')->constrained()->cascadeOnDelete();
            
            // Mengarah ke id siswa di tabel users
            $table->foreignId('student_id')->constrained('users')->cascadeOnDelete();
            
            $table->date('date');
            $table->enum('status', ['hadir', 'sakit', 'izin', 'dispen','alpa']);
            $table->string('notes')->nullable(); // Catatan tambahan guru untuk absensi ini
            
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('attendances');
    }
};