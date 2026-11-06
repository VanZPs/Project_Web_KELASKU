<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AttendanceQrScan extends Model
{
    protected $fillable = [
        'attendance_session_id',
        'schedule_id',
        'student_id',
        'date',
        'scanned_at',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date',
            'scanned_at' => 'datetime',
        ];
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(AttendanceSession::class, 'attendance_session_id');
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'student_id');
    }
}
