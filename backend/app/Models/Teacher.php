<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Teacher extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'nipy',
    ];

    /**
     * Teacher dimiliki oleh satu User.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Teacher dapat mengajar satu atau lebih Subject.
     */
    public function subjects(): BelongsToMany
    {
        return $this->belongsToMany(
            Subject::class,
            'teacher_subject'
        );
    }

    /**
     * Teacher memiliki banyak Schedule.
     */
    public function schedules(): HasMany
    {
        return $this->hasMany(
            Schedule::class,
            'teacher_id'
        );
    }
}