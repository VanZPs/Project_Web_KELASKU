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
        Schema::create('assignment_files', function (Blueprint $table) {
            $table->id();

            // Menunjukkan tugas yang memiliki file.
            $table->foreignId('assignment_id')
                ->constrained('assignments')
                ->cascadeOnDelete();

            // Nama file asli yang diunggah oleh guru.
            $table->string('original_name');

            // Lokasi/object key file di MinIO.
            $table->string('object_key');

            // MIME type file, misalnya application/pdf atau video/mp4.
            $table->string('mime_type')->nullable();

            // Ukuran file dalam byte.
            $table->unsignedBigInteger('size')->nullable();

            $table->timestamps();

            $table->index('assignment_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('assignment_files');
    }
};