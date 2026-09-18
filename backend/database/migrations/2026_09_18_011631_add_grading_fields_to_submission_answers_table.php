<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Menambahkan informasi hasil auto-grading
     * pada setiap jawaban siswa.
     */
    public function up(): void
    {
        Schema::table('submission_answers', function (Blueprint $table) {
            $table->boolean('is_correct')
                ->nullable()
                ->after('answer_text');

            $table->decimal('points', 5, 2)
                ->default(0)
                ->after('is_correct');
        });
    }

    /**
     * Menghapus field hasil grading.
     */
    public function down(): void
    {
        Schema::table('submission_answers', function (Blueprint $table) {
            $table->dropColumn([
                'is_correct',
                'points',
            ]);
        });
    }
};