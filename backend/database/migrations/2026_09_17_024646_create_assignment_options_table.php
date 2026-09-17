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
        Schema::create('assignment_options', function (Blueprint $table) {
            $table->id();

            // Menunjukkan pertanyaan yang memiliki pilihan ini.
            $table->foreignId('assignment_question_id')
                ->constrained('assignment_questions')
                ->cascadeOnDelete();

            // Isi pilihan jawaban.
            $table->text('option_text');

            // Urutan pilihan jawaban di dalam pertanyaan.
            $table->unsignedInteger('order');

            // Menentukan apakah pilihan ini merupakan jawaban benar.
            //
            // multiple  = hanya satu pilihan yang boleh benar.
            // checkbox  = dapat memiliki beberapa pilihan yang benar.
            $table->boolean('is_correct')->default(false);

            $table->timestamps();

            // Mempercepat pengambilan pilihan berdasarkan pertanyaan
            // sekaligus pengurutan pilihan.
            $table->index([
                'assignment_question_id',
                'order',
            ]);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('assignment_options');
    }
};