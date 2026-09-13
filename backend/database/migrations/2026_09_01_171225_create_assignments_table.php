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
        Schema::create('assignments', function (Blueprint $table) {
            $table->id();

            // Tugas terikat pada jadwal tertentu
            // yang mewakili kelas, mata pelajaran, dan guru.
            $table->foreignId('schedule_id')
                ->constrained()
                ->cascadeOnDelete();

            $table->string('title');

            // Deskripsi tugas atau instruksi pengerjaan.
            $table->text('description');

            // Batas akhir pengumpulan tugas.
            $table->dateTime('due_date');

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('assignments');
    }
};