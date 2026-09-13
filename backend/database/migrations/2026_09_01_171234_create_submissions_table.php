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

            // Menunjukkan tugas yang dikumpulkan.
            $table->foreignId('assignment_id')
                ->constrained()
                ->cascadeOnDelete();

            // Menunjukkan siswa yang mengumpulkan tugas.
            $table->foreignId('student_id')
                ->constrained('users')
                ->cascadeOnDelete();

            // Dipertahankan untuk kompatibilitas dengan struktur lama.
            // File baru nantinya akan menggunakan tabel submission_files
            // dan disimpan di MinIO.
            $table->string('file_path')->nullable();

            // Catatan tambahan dari siswa ketika mengumpulkan tugas.
            $table->text('student_note')->nullable();

            // Nilai yang diberikan guru.
            $table->integer('grade')->nullable();

            // Feedback, catatan, atau revisi dari guru.
            $table->text('teacher_feedback')->nullable();

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