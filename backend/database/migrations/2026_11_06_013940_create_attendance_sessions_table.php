<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attendance_sessions', function (Blueprint $table) {
            $table->id();

            $table->foreignId('schedule_id')
                ->constrained()
                ->cascadeOnDelete();

            $table->date('date');

            // Token asli tidak disimpan di database.
            $table->string('token_hash', 64)->unique();

            $table->timestamp('expires_at');

            $table->timestamp('closed_at')->nullable();

            $table->foreignId('created_by')
                ->constrained('users')
                ->cascadeOnDelete();

            $table->timestamps();

            $table->index([
                'schedule_id',
                'date',
                'closed_at',
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendance_sessions');
    }
};