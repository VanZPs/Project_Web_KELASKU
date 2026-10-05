<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssignmentSchedule extends Model
{
    use HasFactory;

    protected $table = 'assignment_schedules';

    protected $fillable = [
        'assignment_id',
        'schedule_id',
    ];

    /**
     * AssignmentSchedule -> Assignment
     */
    public function assignment(): BelongsTo
    {
        return $this->belongsTo(
            Assignment::class
        );
    }

    /**
     * AssignmentSchedule -> Schedule
     */
    public function schedule(): BelongsTo
    {
        return $this->belongsTo(
            Schedule::class
        );
    }
}