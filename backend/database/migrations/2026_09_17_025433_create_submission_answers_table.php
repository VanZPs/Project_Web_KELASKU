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
        Schema::create('submission_answers', function (Blueprint $table) {
            $table->id();

            // Menunjukkan submission/jawaban siswa yang memiliki
            // jawaban untuk pertanyaan ini.
            $table->foreignId('submission_id')
                ->constrained('submissions')
                ->cascadeOnDelete();

            // Menunjukkan pertanyaan yang sedang dijawab.
            $table->foreignId('assignment_question_id')
                ->constrained('assignment_questions')
                ->cascadeOnDelete();

            // Digunakan untuk jawaban berbentuk teks:
            //
            // short     = Jawaban singkat
            // paragraph = Paragraf
            //
            // Untuk multiple/checkbox, pilihan yang dipilih
            // disimpan melalui submission_answer_options.
            $table->text('answer_text')->nullable();

            $table->timestamps();

            // Satu submission hanya boleh memiliki satu jawaban
            // untuk setiap pertanyaan.
            $table->unique([
                'submission_id',
                'assignment_question_id',
            ]);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('submission_answers');
    }
};