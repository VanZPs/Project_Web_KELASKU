<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Assignment extends Model
{
    use HasFactory;

    protected $fillable = [
        'schedule_id',
        'title',
        'description',
        'start_date',
        'due_date',
        'submission_mode',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'datetime',
            'due_date' => 'datetime',
        ];
    }

    /**
     * Assignment -> Schedule
     *
     * Satu tugas dibuat berdasarkan satu jadwal
     * yang mewakili guru, kelas, dan mata pelajaran.
     */
    public function schedule(): BelongsTo
    {
        return $this->belongsTo(Schedule::class);
    }

    /**
     * Assignment -> Submission
     *
     * Satu tugas dapat memiliki banyak submission
     * dari siswa.
     */
    public function submissions(): HasMany
    {
        return $this->hasMany(Submission::class);
    }

    /**
     * Assignment -> AssignmentFile
     *
     * Satu tugas dapat memiliki banyak file materi/lampiran.
     */
    public function files(): HasMany
    {
        return $this->hasMany(AssignmentFile::class);
    }

    /**
     * Assignment -> AssignmentQuestion
     *
     * Satu tugas dapat memiliki banyak pertanyaan.
     */
    public function questions(): HasMany
    {
        return $this->hasMany(AssignmentQuestion::class)
            ->orderBy('order');
    }
}