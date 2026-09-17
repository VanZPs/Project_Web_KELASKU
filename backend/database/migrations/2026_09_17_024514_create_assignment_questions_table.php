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
        Schema::create('assignment_questions', function (Blueprint $table) {
            $table->id();

            // Menunjukkan tugas yang memiliki pertanyaan ini.
            $table->foreignId('assignment_id')
                ->constrained('assignments')
                ->cascadeOnDelete();

            // Jenis pertanyaan/konten.
            //
            // short     = Jawaban singkat
            // paragraph = Paragraf
            // multiple  = Pilihan ganda
            // checkbox  = Kotak centang
            // upload    = Upload file
            // info      = Catatan informasi
            $table->enum('type', [
                'short',
                'paragraph',
                'multiple',
                'checkbox',
                'upload',
                'info',
            ]);

            // Isi pertanyaan, instruksi upload,
            // atau isi catatan informasi.
            $table->text('question');

            // Urutan pertanyaan di dalam tugas.
            $table->unsignedInteger('order');

            // Menentukan apakah pertanyaan wajib dijawab.
            $table->boolean('is_required')->default(true);

            $table->timestamps();

            // Mempercepat pengambilan pertanyaan berdasarkan tugas
            // sekaligus pengurutan pertanyaan.
            $table->index([
                'assignment_id',
                'order',
            ]);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('assignment_questions');
    }
};