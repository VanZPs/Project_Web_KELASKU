<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Assignment extends Model
{
    use HasFactory;

    protected $fillable = [
        'title',
        'description',
        'start_date',
        'due_date',
        'activation_at',
        'activation_processed_at',
        'submission_mode',
        'status',
        'is_published',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'datetime',
            'due_date' => 'datetime',
            'activation_at' => 'datetime',
            'activation_processed_at' => 'datetime',
            'is_published' => 'boolean',
        ];
    }

    public function schedules(): BelongsToMany
    {
        return $this->belongsToMany(
            Schedule::class,
            'assignment_schedules'
        )->withTimestamps();
    }

    public function submissions(): HasMany
    {
        return $this->hasMany(Submission::class);
    }

    public function files(): HasMany
    {
        return $this->hasMany(AssignmentFile::class);
    }

    public function questions(): HasMany
    {
        return $this->hasMany(AssignmentQuestion::class)
            ->orderBy('order');
    }

    public function comments(): HasMany
    {
        return $this->hasMany(TaskComment::class);
    }
}
