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
        Schema::create('assignment_schedules', function (Blueprint $table) {
            $table->id();

            /*
             * Assignment yang diberikan ke jadwal tertentu.
             */
            $table->foreignId('assignment_id')
                ->constrained('assignments')
                ->cascadeOnDelete();

            /*
             * Jadwal yang menerima assignment.
             *
             * Schedule sekaligus mewakili:
             * - kelas
             * - mata pelajaran
             * - guru
             * - hari
             * - jam
             */
            $table->foreignId('schedule_id')
                ->constrained('schedules')
                ->cascadeOnDelete();

            $table->timestamps();

            /*
             * Satu assignment tidak boleh
             * terhubung ke schedule yang sama
             * lebih dari satu kali.
             */
            $table->unique([
                'assignment_id',
                'schedule_id',
            ]);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('assignment_schedules');
    }
};