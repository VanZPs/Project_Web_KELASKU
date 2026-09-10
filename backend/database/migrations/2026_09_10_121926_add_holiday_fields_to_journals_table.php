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
        Schema::table('journals', function (Blueprint $table) {
            $table->boolean('is_holiday')
                ->default(false)
                ->after('description');

            $table->string('holiday_name')
                ->nullable()
                ->after('is_holiday');

            /*
             * Satu schedule hanya boleh memiliki
             * satu jurnal untuk satu tanggal.
             */
            $table->unique(
                ['schedule_id', 'date'],
                'journals_schedule_date_unique'
            );
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('journals', function (Blueprint $table) {
            $table->dropUnique(
                'journals_schedule_date_unique'
            );

            $table->dropColumn([
                'is_holiday',
                'holiday_name',
            ]);
        });
    }
};