<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Schedule extends Model
{
    use HasFactory;

    protected $fillable = [
        'classroom_id',
        'subject_id',
        'teacher_id',
        'day',
        'start_time',
        'end_time',
    ];

    /**
     * Schedule -> Classroom
     */
    public function classroom(): BelongsTo
    {
        return $this->belongsTo(
            Classroom::class,
            'classroom_id'
        );
    }

    /**
     * Schedule -> Subject
     */
    public function subject(): BelongsTo
    {
        return $this->belongsTo(
            Subject::class,
            'subject_id'
        );
    }

    /**
     * Schedule -> User/Guru
     *
     * schedules.teacher_id menyimpan users.id.
     */
    public function teacher(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'teacher_id'
        );
    }

    /**
     * Schedule -> Journal
     */
    public function journals(): HasMany
    {
        return $this->hasMany(
            Journal::class
        );
    }

    /**
     * Schedule -> Assignment
     */
    public function assignments(): HasMany
    {
        return $this->hasMany(
            Assignment::class
        );
    }

    /**
     * Schedule -> Attendance
     */
    public function attendances(): HasMany
    {
        return $this->hasMany(
            Attendance::class
        );
    }
}