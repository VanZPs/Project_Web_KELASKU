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
        Schema::create('submissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('assignment_id')->constrained()->cascadeOnDelete();
            
            // Menunjuk ke id siswa di tabel users
            $table->foreignId('student_id')->constrained('users')->cascadeOnDelete();
            
            $table->string('file_path')->nullable(); // Path file tugas (PDF/Word/Gambar) yang diunggah
            $table->text('student_note')->nullable(); // Pesan tambahan dari siswa saat mengumpulkan
            
            $table->integer('grade')->nullable(); // Nilai dari guru (bisa null jika belum dinilai)
            $table->text('teacher_feedback')->nullable(); // Catatan atau revisi dari guru untuk siswa
            
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('submissions');
    }
};