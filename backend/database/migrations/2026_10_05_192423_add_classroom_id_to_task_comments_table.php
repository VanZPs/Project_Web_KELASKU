<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('task_comments', function (Blueprint $table) {
            $table
                ->foreignId('classroom_id')
                ->nullable()
                ->after('assignment_id')
                ->constrained('classrooms')
                ->cascadeOnDelete();

            $table->index([
                'assignment_id',
                'classroom_id',
                'created_at',
            ]);
        });
    }

    public function down(): void
    {
        Schema::table('task_comments', function (Blueprint $table) {
            $table->dropForeign([
                'classroom_id',
            ]);

            $table->dropIndex(
                'task_comments_assignment_id_classroom_id_created_at_index'
            );

            $table->dropColumn('classroom_id');
        });
    }
};