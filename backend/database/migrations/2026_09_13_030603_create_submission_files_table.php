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
        Schema::create('submission_files', function (Blueprint $table) {
            $table->id();

            // Menunjukkan submission yang memiliki file.
            $table->foreignId('submission_id')
                ->constrained('submissions')
                ->cascadeOnDelete();

            // Nama file asli yang diunggah oleh siswa.
            $table->string('original_name');

            // Lokasi/object key file di MinIO.
            $table->string('object_key');

            // MIME type file, misalnya application/pdf atau video/mp4.
            $table->string('mime_type')->nullable();

            // Ukuran file dalam byte.
            $table->unsignedBigInteger('size')->nullable();

            $table->timestamps();

            $table->index('submission_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('submission_files');
    }
};