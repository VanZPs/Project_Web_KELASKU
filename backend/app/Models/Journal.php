<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Journal extends Model
{
    use HasFactory;

    protected $fillable = [
        'schedule_id',
        'date',
        'topic',
        'description',
        'is_holiday',
        'holiday_name',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date',
            'is_holiday' => 'boolean',
        ];
    }

    public function schedule(): BelongsTo
    {
        return $this->belongsTo(Schedule::class);
    }
}