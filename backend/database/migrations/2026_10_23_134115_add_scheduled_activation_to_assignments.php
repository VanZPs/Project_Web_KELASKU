<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assignments', function (Blueprint $table) {
            $table->dateTime('activation_at')->nullable()->after('due_date');
            $table->dateTime('activation_processed_at')->nullable()->after('activation_at');
        });
    }

    public function down(): void
    {
        Schema::table('assignments', function (Blueprint $table) {
            $table->dropColumn(['activation_at', 'activation_processed_at']);
        });
    }
};
