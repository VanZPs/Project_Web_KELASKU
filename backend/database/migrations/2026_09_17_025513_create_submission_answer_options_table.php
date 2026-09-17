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
        Schema::create('submission_answer_options', function (Blueprint $table) {
            $table->id();

            // Menunjukkan jawaban siswa yang memiliki
            // pilihan jawaban ini.
            $table->foreignId('submission_answer_id')
                ->constrained('submission_answers')
                ->cascadeOnDelete();

            // Menunjukkan pilihan jawaban yang dipilih siswa.
            $table->foreignId('assignment_option_id')
                ->constrained('assignment_options')
                ->cascadeOnDelete();

            $table->timestamps();

            // Satu jawaban siswa tidak boleh memilih
            // pilihan yang sama lebih dari satu kali.
            $table->unique([
                'submission_answer_id',
                'assignment_option_id',
            ]);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('submission_answer_options');
    }
};