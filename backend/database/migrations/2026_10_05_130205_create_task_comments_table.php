<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Jalankan migration.
     */
    public function up(): void
    {
        Schema::create('task_comments', function (Blueprint $table) {
            $table->id();

            /**
             * Tugas yang dikomentari.
             */
            $table->foreignId('assignment_id')
                ->constrained('assignments')
                ->cascadeOnDelete();

            /**
             * User yang membuat komentar.
             *
             * Bisa guru maupun siswa.
             */
            $table->foreignId('user_id')
                ->constrained('users')
                ->cascadeOnDelete();

            /**
             * Isi komentar.
             */
            $table->text('comment');

            $table->timestamps();

            /**
             * Mempercepat query komentar berdasarkan
             * tugas dan waktu komentar.
             */
            $table->index([
                'assignment_id',
                'created_at',
            ]);
        });
    }

    /**
     * Rollback migration.
     */
    public function down(): void
    {
        Schema::dropIfExists('task_comments');
    }
};