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
            
            // Tugas terikat pada jadwal tertentu (mewakili kelas, mapel, dan guru)
            $table->foreignId('schedule_id')->constrained()->cascadeOnDelete();
            
            $table->string('title');
            $table->text('description'); // Deskripsi tugas atau instruksi pengerjaan
            $table->dateTime('due_date'); // Batas akhir pengumpulan (tenggat waktu)
            
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