<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DailyAttendance extends Model
{
    protected $fillable = [
        'classroom_id',
        'student_id',
        'date',
        'status',
        'source_schedule_id',
    ];

    protected $casts = [
        'date' => 'date',
    ];

    public function classroom(): BelongsTo
    {
        return $this->belongsTo(Classroom::class);
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function sourceSchedule(): BelongsTo
    {
        return $this->belongsTo(Schedule::class, 'source_schedule_id');
    }
}
